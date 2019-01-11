import shortUuid from 'short-uuid';
import fs from 'graceful-fs';
import axios, { AxiosResponse } from 'axios';
import { DownloadSetBase } from './DownloadSetBase.js';
import { UIListElement } from './UIListElement.js';
import progressStream from 'progress-stream';
import { uiManager, appendLog } from './UIManager';
import levelup from 'levelup';
import leveldown from 'leveldown';

import './StringExtensions';

function uuid() {
  return shortUuid.generate();
}

async function writeBinaryDataToFile(
  id: ItemDownloaderBase,
  response: AxiosResponse
) {
  const prg = progressStream({
    length: parseInt(response.headers['content-length'], 10),
    time: 100
  });

  prg.on('progriess', (p: any) => {
    id.setDownloadProgress(p.percentage / 100);
    uiManager.markCurrentlyDownloadingInfoPanelDirty();
  });

  return new Promise((resolve: P<void>) => {
    const out = fs.createWriteStream(id.getFullDestination());
    out.on('finish', () => {
      id.setDownloadProgress(1);
      out.end();
      resolve();
    });
    response.data.pipe(prg).pipe(out);
  });
}

const idld = levelup(leveldown('./data/item_download_data.db'));

export abstract class ItemDownloaderBase extends UIListElement {
  private owner: DownloadSetBase;
  private url: string;
  private id: string;
  private destination: string;
  private fullDestination: string;
  private downloadProgress: number;
  private saving: boolean;
  protected stage: string;

  constructor(owner: DownloadSetBase, url: string) {
    super();
    this.owner = owner;
    this.url = url;
    this.id = uuid();
    this.downloadProgress = 0;
    this.stage = 'Init';
    this.destination = 'unknown';
    this.fullDestination = '';
    this.saving = false;
  }
  public getId(): string {
    return this.id;
  }
  public getOwner(): DownloadSetBase {
    return this.owner;
  }
  public getUrl(): string {
    return this.url;
  }
  public getStage(): string {
    return this.stage;
  }
  public getDestination(): string {
    return this.destination;
  }
  public getFullDestination(): string {
    return this.fullDestination;
  }
  public abstract download(): Promise<void> {}

  public abstract getSavePath(): string {}

  public getDownloadProgress(): number {
    return this.downloadProgress;
  }
  public setDownloadProgress(progress: number): void {
    this.downloadProgress = progress;
  }
  public getSaving(): boolean {
    return this.saving;
  }
  public setSaving(s: boolean): void {
    this.saving = s;
    uiManager.markCurrentlyDownloadingInfoPanelDirty();
  }
  protected save_if_needed(url: string, fn: string): Promise<void> {
    return new Promise(resolve => {
      const fns = fn.scrubFilename();

      this.stage = 'Checking';
      const dest = `${uiManager.getDownloadBaseDestination()}/${this.getSavePath()}/${fns}`;
      this.destination = fns;
      this.fullDestination = dest;
      idld
        .get(fn)
        .then(() => {
          this.stage = 'Skipped';
          uiManager.markCurrentlyDownloadingInfoPanelDirty();
          setTimeout(() => {
            uiManager.removeCurrentlyDownloadingItem(this);
          }, 5000);
          resolve();
        })
        .catch(() => {
          try {
            this.stage = 'HTTP';
            uiManager.markCurrentlyDownloadingInfoPanelDirty();
            axios({
              url,
              method: 'GET',
              responseType: 'stream',
              onDownloadProgress: (progressEvent: ProgressEvent) => {
                const totalLength = progressEvent.lengthComputable
                  ? progressEvent.total
                  : progressEvent.target.getResponseHeader('content-length') ||
                    progressEvent.target.getResponseHeader(
                      'x-decompressed-content-length'
                    );
                if (totalLength !== null) {
                  this.setDownloadProgress(
                    Math.round((progressEvent.loaded * 100) / totalLength)
                  );
                }
              }
            }).then((r: AxiosResponse) => {
              this.stage = 'Saving';
              this.setSaving(true);
              this.setDownloadProgress(0);
              uiManager.markCurrentlyDownloadingInfoPanelDirty();

              writeBinaryDataToFile(this, r).then(() => {
                this.stage = 'Finished';
                uiManager.markCurrentlyDownloadingInfoPanelDirty();
                setTimeout(() => {
                  uiManager.removeCurrentlyDownloadingItem(this);
                }, 5000);
                idld.put(fn, true);
                resolve();
              });
            });
          } catch (err) {
            appendLog(`Had error with ${url}`);
            resolve();
          }
        });
    });
  }
}
