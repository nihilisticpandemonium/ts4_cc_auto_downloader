import blessed, { Widgets, colors, BlessedProgram } from 'blessed';
import blessedContrib, { Widgets as ContribWidgets } from 'blessed-contrib';
import systeminformation from 'systeminformation';
import rc from 'rc';
import os from 'os';
import numeral from 'numeral';
import fs from 'fs-extra';

import './ArrayExtensions';

import { formatBytes, titleCase } from './TS4ADUtil';
import { DownloadSetBase } from './DownloadSetBase';
import { ItemDownloaderBase } from './ItemDownloaderBase';

const conf = rc('ts4ccad', {
  destination: `${os.homedir()}/s4s`
});

const downloadSetInfoPanelLabel = 'Download Set Status Info';
const currentlyDownloadingInfoPanelLabel = 'Currently Downloading Info';

const maxNetworkRXTXDataPoints = 30;

const directoriesToMonitor = [
  'CAS',
  'BB',
  'TRAY/LOTS',
  'TRAY/SIMS',
  'TRAY/PETS',
  'DWP',
  'BEO'
];

class UIManager {
  private networkUsageFirstPass: boolean;
  private networkUsageRXData: number[];
  private networkUsageTXData: number[];
  private screen: Widgets.Screen;
  private downloadSetInfoPanel: Widgets.ListElement;
  private currentlyDownloadingInfoPanel: Widgets.ListElement;
  private monitorLog: ContribWidgets.LogElement;
  private numberOfDownloadedItems: Widgets.TextElement;
  private throughputSpark: ContribWidgets.SparklineElement;
  private cpuLoadGraph: ContribWidgets.BarElement;
  private downloadSetInfoDirty: boolean;
  private currentDownloadInfoDirty: boolean;

  private networkStatInterval: NodeJS.Timeout;
  private cpuLoadInterval: NodeJS.Timeout;
  private numberDownloadedInterval: NodeJS.Timeout;
  private renderLoopInterval: NodeJS.Timeout;

  private baseDownloadDestination: string;

  private monitoredDownloadSets: DownloadSetBase[];
  private currentlyDownloadingItems: ItemDownloaderBase[];

  private updateInProgress: boolean;

  private static _instance: UIManager;

  private constructor() {
    this.networkUsageFirstPass = true;

    this.networkUsageRXData = [];
    this.networkUsageTXData = [];

    this.monitoredDownloadSets = [];
    this.currentlyDownloadingItems = [];

    this.baseDownloadDestination = conf.destination;

    this.downloadSetInfoDirty = false;
    this.currentDownloadInfoDirty = false;

    this.screen = blessed.screen({
      smartCSR: true
    });

    this.screen.title = 'The SIMS 4 CC Auto Downloader';

    this.screen.key(['escape', 'q', 'C-c'], () => {
      process.exit(0);
    });

    this.initDisplay();

    this.screen.render();

    this.networkStatInterval = this.startUpdateNetworkStats();
    this.cpuLoadInterval = this.startMonitorCPULoad();
    this.numberDownloadedInterval = this.startMonitorDownloadCounts();
    this.renderLoopInterval = this.startRenderLoop();

    this.updateInProgress = false;
  }

  private initDisplay(): void {
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
        }
      }
    });

    this.screen.append(displayForm);

    const img = blessed.overlayimage({
      file: `${__dirname}/ts4logo.png`,
      top: '95.5%',
      left: '94%',
      width: '5%',
      height: '3.5%',
      ansi: false,
      w3mDisplay: '/usr/lib/w3m/w3mimagedisplay'
    });

    this.downloadSetInfoPanel = blessed.list({
      parent: displayForm,
      top: '5%',
      left: '5%',
      width: '40%',
      height: '45%',
      interactive: false,
      label: downloadSetInfoPanelLabel,
      border: {
        type: 'line'
      },
      style: {
        bg: 'red',
        item: {
          fg: 'white',
          bg: 'red'
        },
        selected: {
          fg: 'white',
          bg: 'red'
        }
      }
    });

    this.screen.append(this.downloadSetInfoPanel);

    this.currentlyDownloadingInfoPanel = blessed.list({
      parent: displayForm,
      top: '5%',
      left: '55%',
      width: '40%',
      height: '66.5%',
      interactive: false,
      label: currentlyDownloadingInfoPanelLabel,
      border: {
        type: 'line'
      },
      style: {
        bg: 'cyan',
        item: {
          fg: 'white',
          bg: 'cyan'
        },
        selected: {
          fg: 'white',
          bg: 'cyan'
        }
      }
    });

    this.screen.append(this.currentlyDownloadingInfoPanel);

    this.monitorLog = blessedContrib.log({
      parent: displayForm,
      top: '50%',
      left: '5%',
      width: '40%',
      height: '42.5%',
      align: 'left',
      label: 'Log',
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue'
      }
    });

    this.screen.append(this.monitorLog);

    const separatorLine = blessed.line({
      parent: displayForm,
      top: '93%',
      left: '6%',
      width: '88%',
      orientation: 'horizontal',
      style: {
        fg: 'red'
      }
    });

    this.screen.append(separatorLine);

    this.numberOfDownloadedItems = blessed.text({
      parent: displayForm,
      top: '95%',
      left: '5%',
      width: '80%',
      height: '3%',
      align: 'left'
    });

    this.screen.append(this.numberOfDownloadedItems);

    this.throughputSpark = blessedContrib.sparkline({
      parent: displayForm,
      label: 'Throughput (bits/sec)',
      tags: true,
      top: '74%',
      left: '55%',
      height: '20%',
      width: '15%',
      style: {
        fg: 'red',
        bg: 'black'
      },
      border: {
        type: 'line'
      }
    });

    this.screen.append(this.throughputSpark);

    this.cpuLoadGraph = blessedContrib.bar({
      parent: displayForm,
      label: 'CPU Load (%)',
      barWidth: 2,
      barSpacing: 1,
      xOffset: 0,
      maxHeight: 9,
      showText: false,
      top: '74%',
      left: '75.5%',
      height: '20%',
      width: '19%',
      style: {
        fg: 'blue',
        bg: 'black'
      },
      border: {
        type: 'line'
      }
    });

    this.screen.append(this.cpuLoadGraph); //must append before setting data

    img.setBack();
  }

  public static get Instance(): UIManager {
    return this._instance || (this._instance = new this());
  }

  private startRenderLoop(): NodeJS.Timeout {
    return setInterval(() => {
      this.updateInfoPanels();
      this.screen.render();
    }, 200);
  }
  public destroy(): void {
    clearInterval(this.networkStatInterval);
    clearInterval(this.cpuLoadInterval);
    clearInterval(this.numberDownloadedInterval);
    clearInterval(this.renderLoopInterval);
    this.screen.destroy();
  }
  private makeNetworklabel(key: string, dataPoint: number): string {
    return `${key} (${formatBytes(dataPoint)}/sec)`;
  }
  private startUpdateNetworkStats(): NodeJS.Timeout {
    return setInterval(() => {
      systeminformation
        .networkStats()
        .then((data: systeminformation.NetStatsData) => {
          if (!this.networkUsageFirstPass) {
            this.networkUsageRXData.push(data.rx_sec);
            this.networkUsageTXData.push(data.tx_sec);

            this.networkUsageRXData.truncate(maxNetworkRXTXDataPoints);
            this.networkUsageTXData.truncate(maxNetworkRXTXDataPoints);

            const rxSecLabel = this.makeNetworklabel('rx', data.rx_sec);
            const txSecLabel = this.makeNetworklabel('tx', data.tx_sec);

            this.throughputSpark.setData(
              [rxSecLabel, txSecLabel],
              [this.networkUsageRXData, this.networkUsageTXData]
            );
          } else {
            this.networkUsageFirstPass = false;
          }
        });
    }, 200);
  }
  private startMonitorCPULoad(): NodeJS.Timeout {
    return setInterval(() => {
      systeminformation
        .currentLoad()
        .then((data: SystemInformation.CurrentLoadData) => {
          const cb = data.cpus.map(cpu => cpu.load);
          const cs: number[] = [];
          for (let i = 0; i < cb.length; i += 2) {
            const c1 = cb[i];
            const c2 = cb[i + 1];
            cs.push((c1 + c2) / 2 / 10);
          }

          const titles: string[] = Array.apply(null, new Array(cs.length))
            .map(Number.call, Number)
            .map((n: {}) => n.toString());
          this.cpuLoadGraph.setData({
            titles: titles,
            data: cs
          });
        });
    }, 200);
  }
  private startMonitorDownloadCounts(): NodeJS.Timeout {
    return setInterval(() => {
      const monitorPromises: Promise<void>[] = [];
      const dirResults: { [index: string]: number } = {};

      directoriesToMonitor.forEach((d: string) => {
        const p = (): Promise<void> => {
          return new Promise((resolve: P<void>) => {
            fs.readdir(
              `${this.baseDownloadDestination}/${d}`,
              (err: NodeJS.ErrnoException, files: string[]) => {
                if (!err) {
                  dirResults[d] = files.length;
                } else {
                  dirResults[d] = 0;
                }
                resolve();
              }
            );
          });
        };
        monitorPromises.push(p());
      });

      Promise.all(monitorPromises).then(() => {
        let total = 0;
        directoriesToMonitor.forEach(d => (total += dirResults[d]));
        let text = `Number of items downloaded: ${total} (`;
        let sep = '';
        directoriesToMonitor.forEach((d: string) => {
          text += `${sep}${titleCase(d)}: ${dirResults[d]}`;
          sep = ', ';
        });
        text += ')';
        this.numberOfDownloadedItems.setText(text);
      });
    }, 200);
  }
  public appendLog(text: string): void {
    this.monitorLog.log(text);
  }
  public registerDownloadSet(ds: DownloadSetBase): void {
    this.monitoredDownloadSets.push(ds);
    const t = ds.isFinished()
      ? this.get_text_for_finished_download_set(ds)
      : this.getTextForDownloadSet(ds);
    this.downloadSetInfoPanel.addItem(t);
    const e = this.downloadSetInfoPanel.getItem(t);
    ds.setElement(e);
    this.markCurrentlyDownloadingInfoPanelDirty();
  }
  public markDownloadSetInfoPanelDirty(): void {
    this.downloadSetInfoDirty = true;
  }
  public markCurrentlyDownloadingInfoPanelDirty(): void {
    this.currentDownloadInfoDirty = true;
  }

  public addCurrentlyDownloadingItem(item: ItemDownloaderBase) {
    this.currentlyDownloadingItems.push(item);
    const t = this.getTextForCurrentlyDownloadingItem(item);
    this.currentlyDownloadingInfoPanel.addItem(t);
    const e = this.currentlyDownloadingInfoPanel.getItem(t);
    item.setElement(e);
    this.markCurrentlyDownloadingInfoPanelDirty();
  }
  public removeCurrentlyDownloadingItem(item: ItemDownloaderBase) {
    this.currentlyDownloadingItems.splice(
      this.currentlyDownloadingItems.indexOf(item),
      1
    );
    this.currentlyDownloadingInfoPanel.removeItem(item.getElement());
    this.markCurrentlyDownloadingInfoPanelDirty();
  }
  private getTextForDownloadSet(ds: DownloadSetBase): string {
    return `${ds.getSite()} ${ds.getSetIdentifier()} ${
      ds.isFinished() ? 'finished' : ds.getExtraText()
    }\n`;
  }
  private getTextForCurrentlyDownloadingItem(id: ItemDownloaderBase): string {
    const o = id.getOwner();
    let text = `${o.getSite()}: ${id
      .getId()
      .substr(0, 10)} (${o.getSetIdentifier()}) [${id.getStage()}]`;
    if (id.getSaving()) {
      const n = numeral(id.getDownloadProgress());
      text += ` {${n.format('0%')}}`;
    }
    text += ']';
    if (id.getDestination() !== 'unknown') {
      text += ` => ${id.getDestination()}`;
    }

    return `${text}\n`;
  }
  private updateInfoPanels(): void {
    if (
      this.updateInProgress ||
      (!this.downloadSetInfoDirty && !this.currentDownloadInfoDirty)
    ) {
      return;
    }
    this.updateInProgress = true;
    let firstFinishedDSIndex = 0;
    const renderSetOrder: DownloadSetBase[] = [];
    this.monitoredDownloadSets.forEach((entry: DownloadSetBase) => {
      if (entry.isFinished) {
        renderSetOrder.push(entry);
      } else {
        renderSetOrder.split(firstFinishedDSIndex, 0, entry);
        firstFinishedDSIndex = renderSetOrder.indexOf(entry) + 1;
      }
    });

    const rds = (ds: DownloadSetBase) => {
      this.downloadSetInfoPanel.setItem(
        ds.getElement(),
        this.getTextForDownloadSet(ds)
      );
    };
    renderSetOrder.forEach(rds);

    const rcd = (id: ItemDownloaderBase) => {
      this.currentlyDownloadingInfoPanel.setItem(
        id.getElement(),
        this.getTextForCurrentlyDownloadingItem(id)
      );
    };

    this.currentlyDownloadingItems.forEach(rcd);

    this.downloadSetInfoDirty = false;
    this.currentDownloadInfoDirty = false;
    this.updateInProgress = false;
  }
  public getDownloadBaseDestination() {
    return this.baseDownloadDestination;
  }
}

export const uiManager = UIManager.Instance;

export function appendLog(text: string): void {
  uiManager.appendLog(text);
}
