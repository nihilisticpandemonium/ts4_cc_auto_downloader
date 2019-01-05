import blessed, { Widgets, colors, BlessedProgram } from "blessed";
import contrib, { Widgets as ContribWidgets } from "blessed-contrib";
import si from "systeminformation";
import util from "util";
import { exec } from "child_process";
import rc from "rc";
import os from "os";
import numeral from "numeral";

import "./array_extensions";

require("./ts4_ad_util.js");
require("./array_extensions");

import { formatBytes, titleCase } from "./ts4_ad_util.js";
import { DownloadSetBase } from "./download_set_base";
import { ItemDownloaderBase } from "./item_downloader_base";
import { finished } from "stream";

const conf = rc("ts4ccad", {
    destination: `${os.homedir()}/s4s`
});

const sleep = util.promisify(setTimeout);

const download_set_info_panel_label = "Download Set Status Info";
const currently_downloading_info_panel_label = "Currently Downloading Info";

const max_network_rx_tx_data_points = 30;

const directories_to_monitor = [
    "CAS",
    "BB",
    "TRAY/LOTS",
    "TRAY/SIMS",
    "TRAY/PETS",
    "DWP",
    "BEO"
];

class UIManager {
    private network_usage_first_pass: boolean;
    private network_usage_rx_data: Array<number>;
    private network_usage_tx_data: Array<number>;
    private screen: Widgets.Screen;
    private downloadSetInfoPanel: Widgets.ListElement;
    private currentlyDownloadingInfoPanel: Widgets.ListElement;
    private monitorLog: ContribWidgets.LogElement;
    private numberOfDownloadedItems: Widgets.TextElement;
    private throughputSpark: ContribWidgets.SparklineElement;
    private cpuLoadGraph: ContribWidgets.BarElement;
    private downloadSetInfoDirty: boolean;
    private currentDownloadInfoDirty: boolean;

    private network_stat_interval: NodeJS.Timeout;
    private cpu_load_interval: NodeJS.Timeout;
    private number_downloaded_interval: NodeJS.Timeout;
    private render_loop_interval: NodeJS.Timeout;
    private base_download_destination: string;

    private monitored_download_sets: DownloadSetBase[] = [];
    private currently_downloading_items: ItemDownloaderBase[] = [];

    private static _instance: UIManager;

    private constructor() {
        this.network_usage_first_pass = true;

        this.network_usage_rx_data = [];
        this.network_usage_tx_data = [];

        this.base_download_destination = conf.destination;

        this.downloadSetInfoDirty = false;
        this.currentDownloadInfoDirty = false;

        this.screen = blessed.screen({
            smartCSR: true,
            useBCE: true
        });

        this.screen.title = "The SIMS 4 CC Auto Downloader";

        this.screen.key(["escape", "q", "C-c"], () => {
            process.exit(0);
        });

        const displayForm = blessed.form({
            top: "left",
            left: "left",
            width: "100%",
            height: "100%",
            border: {
                type: "line"
            },
            style: {
                fg: "white",
                bg: "black",
                border: {
                    fg: "red"
                }
            }
        });

        this.screen.append(displayForm);

        this.downloadSetInfoPanel = blessed.list({
            parent: displayForm,
            top: "5%",
            left: "5%",
            width: "40%",
            height: "45%",
            interactive: false,
            label: download_set_info_panel_label,
            border: {
                type: "line"
            },
            style: {
                bg: "red",
                item: {
                    fg: "white",
                    bg: "red"
                },
                selected: {
                    fg: "white",
                    bg: "red"
                }
            }
        });

        this.screen.append(this.downloadSetInfoPanel);

        const img = blessed.image({
            file: __dirname + "/ts4logo.png",
            top: "94.5%",
            left: "90%",
            width: "6%",
            height: "4%",
            type: "overlay"
        });

        this.screen.append(img);

        this.currentlyDownloadingInfoPanel = blessed.list({
            parent: displayForm,
            top: "5%",
            left: "55%",
            width: "40%",
            height: "66.5%",
            interactive: false,
            label: currently_downloading_info_panel_label,
            border: {
                type: "line"
            },
            style: {
                item: {
                    fg: "white",
                    bg: "cyan"
                },
                selected: {
                    fg: "white",
                    bg: "cyan"
                }
            }
        });

        this.screen.append(this.currentlyDownloadingInfoPanel);

        this.monitorLog = contrib.log({
            parent: displayForm,
            top: "50%",
            left: "5%",
            width: "40%",
            height: "42.5%",
            align: "left",
            label: "Log",
            border: {
                type: "line"
            },
            style: {
                item: {
                    bg: "blue",
                    fg: "white"
                },
                selected: {
                    bg: "blue",
                    fg: "white"
                }
            }
        });

        this.screen.append(this.monitorLog);

        var separatorLine = blessed.line({
            parent: displayForm,
            top: "93%",
            left: "6%",
            width: "88%",
            orientation: "horizontal",
            style: {
                fg: "red"
            }
        });

        this.screen.append(separatorLine);

        this.numberOfDownloadedItems = blessed.text({
            parent: displayForm,
            top: "95%",
            left: "5%",
            width: "80%",
            height: "3%",
            align: "left"
        });

        this.screen.append(this.numberOfDownloadedItems);

        this.throughputSpark = contrib.sparkline({
            parent: displayForm,
            label: "Throughput (bits/sec)",
            tags: true,
            top: "74%",
            left: "55%",
            height: "20%",
            width: "15%",
            style: {
                fg: "red",
                bg: "black"
            },
            border: {
                type: "line"
            }
        });

        this.screen.append(this.throughputSpark);

        this.cpuLoadGraph = contrib.bar({
            parent: displayForm,
            label: "CPU Load (%)",
            barWidth: 2,
            barSpacing: 1,
            xOffset: 0,
            maxHeight: 9,
            showText: false,
            top: "74%",
            left: "75.5%",
            height: "20%",
            width: "19%",
            style: {
                fg: "blue",
                bg: "black"
            },
            border: {
                type: "line"
            }
        });

        this.screen.append(this.cpuLoadGraph); //must append before setting data
        this.render_loop_interval = this.start_render_loop();
        this.network_stat_interval = this.start_update_network_stats();
        this.cpu_load_interval = this.start_monitor_cpu_load();
        this.number_downloaded_interval = this.start_monitor_download_counts();
    }

    public static get Instance(): UIManager {
        return this._instance || (this._instance = new this());
    }

    private start_render_loop(): NodeJS.Timeout {
        return setInterval(() => {
            this.update_info_panels();
            this.screen.render();
        }, 200);
    }
    destroy(): void {
        clearInterval(this.network_stat_interval);
        clearInterval(this.cpu_load_interval);
        clearInterval(this.number_downloaded_interval);
        clearInterval(this.render_loop_interval);
        this.screen.destroy();
    }
    private make_network_label(key: string, dataPoint: number): string {
        return `${key} (${formatBytes(dataPoint)}/sec)`;
    }
    private start_update_network_stats(): NodeJS.Timeout {
        return setInterval(() => {
            si.networkStats().then(data => {
                if (!this.network_usage_first_pass) {
                    this.network_usage_rx_data.push(data.rx_sec);
                    this.network_usage_tx_data.push(data.tx_sec);

                    this.network_usage_rx_data.truncate(
                        max_network_rx_tx_data_points
                    );
                    this.network_usage_tx_data.truncate(
                        max_network_rx_tx_data_points
                    );

                    const rx_sec_label = this.make_network_label(
                        "rx",
                        data.rx_sec
                    );
                    const tx_sec_label = this.make_network_label(
                        "tx",
                        data.tx_sec
                    );

                    this.throughputSpark.setData(
                        [rx_sec_label, tx_sec_label],
                        [this.network_usage_rx_data, this.network_usage_tx_data]
                    );
                } else {
                    this.network_usage_first_pass = false;
                }
            });
        }, 200);
    }
    private start_monitor_cpu_load(): NodeJS.Timeout {
        return setInterval(() => {
            si.currentLoad().then(data => {
                const cb = data.cpus.map(cpu => cpu.load);
                let cs: number[] = [];
                for (let i = 0; i < cb.length; i += 2) {
                    const c1 = cb[i];
                    const c2 = cb[i + 1];
                    cs.push((c1 + c2) / 2 / 10);
                }
                const titles: string[] = Array.apply(null, new Array(cs.length))
                    .map(Number.call, Number)
                    .map((n: {}, i: number, a: {}[]) => n.toString());
                this.cpuLoadGraph.setData({
                    titles: titles,
                    data: cs
                });
            });
        }, 200);
    }
    private start_monitor_download_counts(): NodeJS.Timeout {
        return setInterval(() => {
            var monitor_promises: Promise<void>[] = [];
            var dir_results: { [index: string]: number } = {};

            directories_to_monitor.forEach((d: string) => {
                const p = (): Promise<void> => {
                    return new Promise(resolve => {
                        exec(
                            `find ${
                                this.base_download_destination
                            }/${d} -type f | wc -l`,
                            (err, stdout) => {
                                if (!err) {
                                    dir_results[d] = parseInt(stdout, 10);
                                } else {
                                    dir_results[d] = 0;
                                }
                                resolve();
                            }
                        );
                    });
                };
                monitor_promises.push(p());
            });

            Promise.all(monitor_promises).then(() => {
                let total = 0;
                directories_to_monitor.forEach(d => (total += dir_results[d]));
                let text = "Number of items downloaded: " + total + " (";
                let sep = "";
                directories_to_monitor.forEach(d => {
                    text += sep + titleCase(d) + ": " + dir_results[d];
                    sep = ", ";
                });
                text += ")";
                this.numberOfDownloadedItems.setText(text);
            });
        }, 200);
    }
    appendLog(text: string): void {
        this.monitorLog.log(text);
    }
    registerDownloadSet(ds: DownloadSetBase): void {
        this.monitored_download_sets.push(ds);
        const t = ds.isFinished()
            ? this.get_text_for_finished_download_set(ds)
            : this.get_text_for_unfinished_download_set(ds);
        this.downloadSetInfoPanel.addItem(t);
        const e = this.downloadSetInfoPanel.getItem(t);
        ds.setElement(e);
        this.markCurrentlyDownloadingInfoPanelDirty();
    }
    markDownloadSetInfoPanelDirty(): void {
        this.downloadSetInfoDirty = true;
    }
    markCurrentlyDownloadingInfoPanelDirty(): void {
        this.currentDownloadInfoDirty = true;
    }

    addCurrentlyDownloadingItem(item: ItemDownloaderBase) {
        this.currently_downloading_items.push(item);
        const t = this.get_text_for_currently_downloading_item(item);
        this.currentlyDownloadingInfoPanel.addItem(t);
        const e = this.currentlyDownloadingInfoPanel.getItem(t);
        item.setElement(e);
        this.markCurrentlyDownloadingInfoPanelDirty();
    }
    removeCurrentlyDownloadingItem(item: ItemDownloaderBase) {
        this.currently_downloading_items.splice(
            this.currently_downloading_items.indexOf(item)
        );
        this.currentlyDownloadingInfoPanel.removeItem(item.getElement());
        this.markCurrentlyDownloadingInfoPanelDirty();
    }
    private get_text_for_unfinished_download_set(ds: DownloadSetBase): string {
        let text =
            ds.getSite() + " " + ds.getSetIdentifier() + ds.getExtraText();
        return `${text}\n`;
    }
    private get_text_for_finished_download_set(ds: DownloadSetBase): string {
        let text = ds.getSite() + " " + ds.getSetIdentifier() + ": finished";
        return `${text}\n`;
    }
    private get_text_for_currently_downloading_item(
        id: ItemDownloaderBase
    ): string {
        let text =
            id.getOwner().getSite() +
            ": " +
            id.getId().substr(0, 10) +
            " (" +
            id.getOwner().getSetIdentifier() +
            ") [" +
            id.getStage();
        if (id.getSaving()) {
            const n = numeral(id.getDownloadProgress());
            text += ` {${n.format("0%")}}`;
        }
        text += "]";
        if (id.getDestination() !== "unknown") {
            text += ` => ${id.getDestination()}`;
        }
        return `${text}\n`;
    }
    private update_in_progress: boolean = false;
    private update_info_panels(): void {
        if (
            this.update_in_progress ||
            (!this.downloadSetInfoDirty && !this.currentDownloadInfoDirty)
        ) {
            return;
        }
        this.update_in_progress = true;
        const ruds = (ds: DownloadSetBase) => {
            this.downloadSetInfoPanel.setItem(
                ds.getElement(),
                this.get_text_for_unfinished_download_set(ds)
            );
        };
        const rfds = (ds: DownloadSetBase) => {
            this.downloadSetInfoPanel.setItem(
                ds.getElement(),
                this.get_text_for_finished_download_set(ds)
            );
        };
        const unfinishedDownloadSets = this.monitored_download_sets.filter(
            entry => {
                return !entry.isFinished();
            }
        );
        const finishedDownloadSets = this.monitored_download_sets.filter(
            entry => {
                return entry.isFinished();
            }
        );

        unfinishedDownloadSets.forEach(ruds);
        finishedDownloadSets.forEach(rfds);

        const rcd = (id: ItemDownloaderBase) => {
            this.currentlyDownloadingInfoPanel.setItem(
                id.getElement(),
                this.get_text_for_currently_downloading_item(id)
            );
        };

        this.currently_downloading_items.forEach(rcd);

        this.downloadSetInfoDirty = false;
        this.currentDownloadInfoDirty = false;
        this.update_in_progress = false;
    }
    getDownloadBaseDestination() {
        return this.base_download_destination;
    }
}

export const uiManager = UIManager.Instance;

export function appendLog(text: string): void {
    uiManager.appendLog(text);
}
