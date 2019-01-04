const moment = require('moment');
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const si = require('systeminformation');
const util = require('util');
const {
    exec
} = require("child_process");

require('./ts4_ad_util.js');
import { formatBytes, titleCase } from './ts4_ad_util.js';
import { DownloadSetBase } from './download_set_base';
import { ItemDownloaderBase } from './item_downloader_base';

const sleep = util.promisify(setTimeout);
const _exec = util.promisify(exec);

const download_set_info_panel_label = "Download Set Status Info";
const currently_downloading_info_panel_label = "Currently Downloading Info";

const max_network_rx_tx_data_points = 30;

const directories_to_monitor = ["CAS", "BB", "TRAY/LOTS", "TRAY/SIMS", "TRAY/PETS", "DWP", "BEO"];

class UIManager {
    #current_item_downloads;
    #monitored_download_sets;
    #network_usage_first_pass;
    #network_usage_rx_data;
    #network_usage_tx_data;
    #pending_download_set_update;
    #screen;
    #downloadSetInfoPanel;
    #currentlyDownloadingInfoPanel;
    #monitorLog;
    #numberOfDownloadedItems;
    #throughputSpark;
    #cpuLoadGraph;

    #network_stat_interval;
    #cpu_load_interval;
    #number_downloaded_interval;
    #render_loop_interval;
    
    constructor() {
        this.#network_usage_first_pass = true;
        this.#pending_download_set_update = false;
        this.#current_item_downloads = [];
        this.#monitored_download_sets = [];

        this.#network_usage_rx_data = [];
        this.#network_usage_tx_data = [];

        this.#screen = blessed.screen({
            smartCSR: true,
        });

        this.#screen.title = 'The SIMS 4 CC Auto Downloader';

        this.#screen.key(['escape', 'q', 'C-c'], () => {
            process.exit(0);
        });

        const displayForm = blessed.form({
            top: 'left',
            left: 'left',
            width: '100%',
            height: '100%',
            border: {
                type: 'line'
            },
            style: {
                fg: 'white',
                bg: 'black',
                border: {
                    fg: 'red'
                },
            }
        });

        this.#screen.append(displayForm);

        this.#monitored_download_sets = [];

        this.#downloadSetInfoPanel = blessed.list({
            parent: displayForm,
            top: '5%',
            left: '5%',
            width: '40%',
            height: '45%',
            interactive: 'false',
            label: download_set_info_panel_label,
            border: {
                type: 'line'
            },
            style: {
                fg: 'black',
                bg: 'red',
                border: {
                    fg: '#d0d0d0'
                },
                item: {
                    fg: 'white',
                    bg: 'red',
                },
                selected: {
                    fg: 'white',
                    bg: 'red',
                }
            },
        });

        this.#screen.append(this.#downloadSetInfoPanel);

        this.#currentlyDownloadingInfoPanel = blessed.list({
            parent: displayForm,
            top: '5%',
            left: '55%',
            width: '40%',
            height: '70%',
            interactive: 'false',
            label: currently_downloading_info_panel_label,
            border: {
                type: 'line'
            },
            style: {
                fg: 'black',
                bg: 'cyan',
                border: {
                    fg: 'blue',
                },
                item: {
                    fg: 'white',
                    bg: 'cyan',
                },
                selected: {
                    fg: 'white',
                    bg: 'cyan',
                }
            }
        });

        this.#screen.append(this.#currentlyDownloadingInfoPanel);

        this.#monitorLog = contrib.log({
            parent: displayForm,
            top: '50%',
            left: '5%',
            width: '40%',
            height: '45%',
            aligh: 'left',
            label: 'Log',
            border: {
                type: "line",
                fg: "cyan"
            },
            style: {
                bg: "blue"
            },
        });

        this.#screen.append(this.#monitorLog);

        var separatorLine = blessed.line({
            parent: displayForm,
            top: '93%',
            left: '6%',
            width: '88%',
            orientation: 'horizontal',
            style: {
                'fg': 'red'
            }
        });

        this.#screen.append(separatorLine);

        this.#numberOfDownloadedItems = blessed.text({
            parent: displayForm,
            top: '95%',
            left: '5%',
            width: '60%',
            height: '3%',
            align: 'left'
        })

        this.#screen.append(this.#numberOfDownloadedItems);

        this.#throughputSpark = contrib.sparkline({
            parent: displayForm,
            label: 'Throughput (bits/sec)',
            tags: true,
            top: '78%',
            left: '55%',
            height: '17%',
            width: '15%',
            style: {
                fg: 'red',
                bg: 'black'
            },
            border: {
                type: "line",
                fg: "magenta"
            }
        })

        this.#screen.append(this.#throughputSpark);

        this.#cpuLoadGraph = contrib.bar({
            parent: displayForm,
            label: 'CPU Load (%)',
            barWidth: 2,
            barSpacing: 1,
            xOffset: 0,
            maxHeight: 9,
            showtext: 'false',
            top: '75%',
            left: '75.5%',
            height: '20%',
            width: '19%',
            style: {
                fg: 'blue',
                bg: 'black',
            },
            border: {
                type: 'line',
                fg: 'green'
            }
        })

        this.#screen.append(this.#cpuLoadGraph) //must append before setting data
        this.#start_render_loop();
        this.#start_update_network_stats();
        this.#start_monitor_cpu_load();
        this.#start_monitor_download_counts();
    }
    #start_render_loop() {
        this.#render_loop_interval = setInterval(() => {
            this.#update_download_set_info_panel();
            this.#update_current_download_list();
            this.#screen.render();
        }, 1000);
    }
    destroy() {
        clearInterval(this.#network_stat_interval);
        clearInterval(this.#cpu_load_interval);
        clearInterval(this.#number_downloaded_interval);
        clearInterval(this.#render_loop_interval);
        this.#screen.destroy();
    }
    #check_item(item) {
        if (!(item instanceof ItemDownloaderBase)) {
            throw new Error(`${item} is not a proper item download.`);
        }
    }
    addCurrentlyDownloadingItem(item) {
        this.#check_item(item);
        const uuid = item.getId();
        if (!(uuid in this.#current_item_downloads)) {
            this.#current_item_downloads[uuid] = {
                downloadSet: item.getOwner().getSetIdentifier(),
                site: item.getOwner().getSite(),
                stage: 'Init',
            };
        }
    }
    removeCurrentlyDownloadingItem(item) {
        this.#check_item(item);
        const uuid = item.getId();
        if (uuid in this.#current_item_downloads) {
            delete this.#current_item_downloads[uuid];
        }
    }
    setCurrentlyDownloadingItemSaveDestination(item, fileName) {
        this.#check_item(item);
        const uuid = item.getId();
        if (uuid in this.#current_item_downloads) {
            this.#current_item_downloads[uuid].destination = fileName;
        }
    }
    setCurrentlyDownloadingItemStage(item, stage) {
        this.#check_item(item);
        const uuid = item.getId();
        if (uuid in this.#current_item_downloads) {
            this.#current_item_downloads[uuid].stage = stage;
        }
    }
    #make_network_label(key, dataPoint) {
        return `${key} (${formatBytes(dataPoint)}/sec)`;
    }
    #start_update_network_stats() {
        this.#network_stat_interval = setInterval(() => {
            si.networkStats().then((data) => {
                if (!this.#network_usage_first_pass) {
                    this.#network_usage_rx_data.push(data.rx_sec);
                    this.#network_usage_tx_data.push(data.tx_sec);

                    this.#network_usage_rx_data.truncate(max_network_rx_tx_data_points);
                    this.#network_usage_tx_data.truncate(max_network_rx_tx_data_points);

                    const rx_sec_label = this.#make_network_label('rx', data.rx_sec);
                    const tx_sec_label = this.#make_network_label('tx', data.tx_sec);

                    this.#throughputSpark.setData([rx_sec_label, tx_sec_label], [this.#network_usage_rx_data, this.#network_usage_tx_data]);
                } else {
                    this.#network_usage_first_pass = false;
                }
            })
        }, 1000);
    }
    #start_monitor_cpu_load() {
        this.#cpu_load_interval = setInterval(() => {
            si.currentLoad().then((data) => {
                var cb = data.cpus.map(cpu => cpu.load);
                var cs = cb.map((entry, index, array) => {
                    return (index > ((cb.length / 2) / 1)) ? null : Math.floor(((array[index] + array[index + (data.cpus.length / 2)]) / 2) / 10);
                }).filter(entry => {
                    return entry != null;
                });
                this.#cpuLoadGraph.setData({
                    titles: Array.apply(null, {
                        length: cs.length
                    }).map(Number.call, Number).map(n => n.toString()),
                    data: cs
                });
            })
        }, 1000);
    }
    #start_monitor_download_counts() {
        this.#number_downloaded_interval = setInterval(() => {
            var monitor_promises = [];
            var dir_results = {};

            const gdi = async () => {
                directories_to_monitor.forEach((d) => {
                    var p = async() => {
                        try {
                            var stdout = await _exec('find /home/whiro/s4s' + dir + ' -type f | wc -l');
                            dir_results[d] = parseInt(stdout, 10);                            
                        } catch (err) {
                            dir_results[d] = 0;
                        }
                        return;
                    }
                    monitor_promises.push(p());
                });
                await Promise.all(monitor_promises);
            }

            gdi().then(() => {
                var text = "Number of items downloaded: " + total + " (";
                var sep = "";
                dir_results.forEach((dir) => {
                    text += sep + titleCase(dir) + ": " + dir_results[dir];
                    sep = ", ";
                });
                text += ")";
                this.#numberOfDownloadedItems.setText(text);
            });
        }, 1000);
    }
    appendLog(text) {
        this.#monitorLog.log(text);
    }
    registerDownloadSet(ds) {
        if (!(ds instanceof DownloadSetBase)) {
            throw new Error(`${ds} is not a recognized download set.`);
        }
        this.#monitored_download_sets.push(ds);
    }
    #update_download_set_info_panel() {
        this.#downloadSetInfoPanel.clearItems();
        const unfinishedDownloadSets = this.#monitored_download_sets.filter(entry => { return !entry.isFinished(); });
        const finishedDownloadSets = this.#monitored_download_sets.filter(entry => { return entry.isFinished(); });

        const ruds = (ds) => {
            var text = ds.getSite() + " " + ds.getSetIdentifier() + ds.getExtraText();
            this.#downloadSetInfoPanel.addItem(text);
        }
        const rfds = (ds) => {
            var text = ds.getSite() + " " + ds.getSetIdentifier() + ": finished";
            this.#downloadSetInfoPanel.addItem(text);
        }

        unfinishedDownloadSets.forEach(ruds);
        finishedDownloadSets.forEach(rfds);
        this.#pending_download_set_update = false;
    }
    setPendingDownloadSetUpdate() {
        if (!this.#pending_download_set_update) {
            this.#pending_download_set_update = true;
            this.#update_download_set_info_panel();
        }
    }
    #update_current_download_list() {
        const rcd = (k) => {
            const o = this.#current_item_downloads[k];
            var text = o.site + ": " + k + " (" + o.downloadSet + ") [" + o.stage + "]";
            if (typeof o.destination !== 'undefined') {
                text += ' => ' + o.destination;
            }
            this.#currentlyDownloadingInfoPanel.addItem(text);
        }
        Object.keys(this.#current_item_downloads).forEach(rcd);
    }
}

export const uiManager = new UIManager();
export function appendLog(text) {
    uiManager.appendLog(text);
}
