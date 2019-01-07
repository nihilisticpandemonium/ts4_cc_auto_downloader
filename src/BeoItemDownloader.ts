import { ItemDownloaderBase } from './ItemDownloaderBase';
import { uiManager } from './UIManager';
import { DownloadSetBase } from './DownloadSetBase';
import axios from 'axios';
import cheerio from 'cheerio';

const fr = /\S+/;
const ub = 'https://sims-cloud.com/';

export class BeoItemDownloader extends ItemDownloaderBase {
  public constructor(owner: DownloadSetBase, url: string) {
    super(owner, url);
  }
  public getSavePath(): string {
    return 'BEO';
  }
  public download(): Promise<void> {
    const _z = async () => {
      uiManager.addCurrentlyDownloadingItem(this);
      this.stage = 'Getting DL URL';
      uiManager.markCurrentlyDownloadingInfoPanelDirty();
      const r = await axios.get(this.getUrl());
      const $ = cheerio.load(r.data);
      const dur = $('a[href^=\'http://sims-cloud.com/?dl\']');
      let du: string | null = null;
      dur.each((_: number, e: CheerioElement) => {
        du = e.attribs.href;
      });
      if (du) {
        this.stage = 'Grabbing DL Site Page';
        uiManager.markCurrentlyDownloadingInfoPanelDirty();
        const dr = await axios.get(du);
        const d$ = cheerio.load(dr.data);
        this.stage = 'Getting DL Link';
        uiManager.markCurrentlyDownloadingInfoPanelDirty();
        const ar = d$('a[href^=\'download/\']');
        let ah: string | null = null;
        ar.each((_: number, e: CheerioElement) => {
          ah = e.attribs.href;
        });
        const fs = ar.find('span.pull-left');
        this.stage = 'Getting Filename';
        uiManager.markCurrentlyDownloadingInfoPanelDirty();
        const fn: string | null = fs.text().match(fr)?.[0];
        if (ah && fn) {
          await this.save_if_needed(ub + ah, fn);
        }
      }

      return;
    };

    return _z();
  }
}
