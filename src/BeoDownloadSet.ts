import { DownloadSetBase } from './DownloadSetBase';
import { uiManager } from './UIManager';
import { BeoItemDownloader } from './BeoItemDownloader';

import axios from 'axios';
import cheerio from 'cheerio';

const beoCategory: { [key: string]: string } = {
  'clothing_s4.php': 'clothing',
  'accessories_s4.php': 'accessories',
  'hair_s4.php': 'hair'
};

const bu = 'http://beocreations.com/';

const pr = /([^/]+$)/;

export class BeoDownloadSet extends DownloadSetBase {
  private page: string;
  private currentPage: string;

  constructor(page: string) {
    super('BEO', beoCategory[page]);
    this.page = page;
    this.currentPage = '';

    uiManager.markDownloadSetInfoPanelDirty();
  }
  private getAllDlPages(): Promise<any[]> {
    const g = async () => {
      const r = await axios.get(bu + this.page);
      const $ = cheerio.load(r.data);
      const dp = $('a[href^=\'creations/\']');
      const h: string[] = [];
      dp.each((d: number) => {
        const l = dp[d].attribs.href;
        h.push(bu + l);
      });

      return h;
    };

    return g();
  }
  private downloadPage(p: string): Promise<void> {
    const dz = async () => {
      const i = new BeoItemDownloader(this, p);
      await i.download();
    };

    return dz();
  }
  public download(): Promise<void> {
    const _z = async () => {
      const dlps = await this.getAllDlPages();
      const pz = [];
      for (const dlp of dlps) {
        this.currentPage = dlp.match(pr)[1];
        uiManager.markDownloadSetInfoPanelDirty();
        pz.push(this.downloadPage(dlp));
      }
      await Promise.all(pz);
      this.setFinished(true);
    };

    return _z();
  }
  public getExtraText(): string {
    return `: ${this.currentPage !== '' ? this.currentPage : 'init'}`;
  }
}
