import util from 'util';
import shortUuid from 'short-uuid';
import fs from 'fs';
import axios, { AxiosResponse } from 'axios';
import { DownloadSetBase } from './DownloadSetBase.js';
import { UIListElement } from './UIListElement.js';
import progressStream from 'progress-stream';
import { uiManager, appendLog } from './UIManager';

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

  prg.on('progress', (p: any) => {
    id.setDownloadProgress(p.percentage / 100);
    uiManager.markCurrentlyDownloadingInfoPanelDirty();
  });

  return new Promise((resolve: P<void>) => {
    const out = fs.createWriteStream(id.getFullDestination());
    out.on('finish', () => {
      id.setDownloadProgress(1);
      resolve();
    });
    response.data.pipe(prg).pipe(out);
  });
}

const access = util.promisify(fs.access);
const close = util.promisify(fs.close);

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
    const _z = async () => {
      let s = false;
      const fns = fn.scrubFilename();

      this.stage = 'Checking';
      const dest = `${uiManager.getDownloadBaseDestination()}/${this.getSavePath()}/${fns}`;
      this.destination = fns;
      this.fullDestination = dest;
      try {
        await access(dest);
      } catch (err) {
        this.stage = 'Saving';
        this.setSaving(true);
        uiManager.markCurrentlyDownloadingInfoPanelDirty();
        try {
          const r = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
          });
          await writeBinaryDataToFile(this, r);
        } catch (err) {
          appendLog(`Had error with ${url}`);
        }
        s = true;
      }
      this.stage = s ? 'Finished' : 'Skipped';
      uiManager.markCurrentlyDownloadingInfoPanelDirty();
      setTimeout(() => {
        uiManager.removeCurrentlyDownloadingItem(this);
      }, 5000);

      return;
    };

    return _z();
  }
}
