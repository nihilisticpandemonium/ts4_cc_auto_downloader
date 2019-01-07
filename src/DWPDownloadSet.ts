import { DownloadSetBase } from './DownloadSetBase';
import { uiManager, appendLog } from './UIManager';
import { sleep, P } from './TS4ADUtil';
import { DWPItemDownloader } from './DWPItemDownloader';

import axios, { AxiosResponse } from 'axios';
import cheerio from 'cheerio';

const patreonIndex = 'ts4patreon-index.php';
const adultIndex = 'adult-index.php';
const payIndex = 'ts4pay-index.php';

const dwpRoot: { [index: string]: string } = {
  [patreonIndex]: 'ts4patreon/',
  [adultIndex]: 'ts4adult/',
  [payIndex]: 'ts4/',
};
const dwpCategory: { [index: string]: string } = {
  [patreonIndex]: 'patreon',
  [adultIndex]: 'adult',
  [payIndex]: 'pay',
};

const dwpFilterPages = [
  'index.php',
  'ts3patreon-index.php',
  'ts4patreon-index.php',
  'adult-index.php',
  'disclaimer.php',
  'ts4pay-index.php',
  'mailto:downwithpatreon@yahoo.com?subject=Attention',
  'faq.php',
  '#',
  'basemental.php',
  'blackcin.php',
  'turbodriver.php',
];

const bu = 'http://downwithpatreon.org/';
const fr = /([^/]+$)/;

export class DWPDownloadSet extends DownloadSetBase {
  private page: string
  private currentPage: string

  public constructor(page: string) {
    super('DWP', dwpCategory[page]);
    this.page = page;
    this.currentPage = '';
    uiManager.markDownloadSetInfoPanelDirty();
  }
  private getAllDlPages(): Promise<any[]> {
    return new Promise((resolve: (value: P<string[]>) => void) => {
      const g = async () => {
        const r = await axios.get(bu + this.page);
        const $ = cheerio.load(r.data);
        const dp = $('a');
        const h: string[] = [];
        dp.each((_: number, e: CheerioElement) => {
          const l = e.attribs.href;
          if (l.match('.php$') !== null && !dwpFilterPages.includes(l)) {
            h.push(bu + l);
          }
        });
        resolve(h);
      };
      g();
    });
  }
  private getZipsFromPage(p: string): Promise<any[]> {
    // eslint-disable-next-line init-declarations
    let z: string[];

    axios.get(p).then((r: AxiosResponse) => {
      const $ = cheerio.load(r.data);
      const zr = $('a');
      z = [];
      zr.each((_: number, e: CheerioElement) => {
        const a = e.attribs.href;
        if (a.match('.zip$') !== null) {
          z.push(bu + dwpRoot[this.page] + a);
        }
      });
    });

    return new Promise((resolve: P<string[]>) => {
      const delay = 500;
      const f = () => {
        if (z !== undefined) {
          resolve(z);
        } else {
          setTimeout(f, delay);
        }
      };
      f();
    });
  }
  public download(): Promise<void> {
    const _z = async () => {
      const dlps = await this.getAllDlPages();
      const dz = (z: string) => {
        const zd = new DWPItemDownloader(this, z);

        return zd.download();
      };
      const dzs = (zs: string[]) => {
        const pz: Promise<void>[] = [];
        zs.forEach((z: string) => {
          pz.push(dz(z));
        });

        return pz;
      };
      for (const dlp of dlps) {
        this.currentPage = dlp.match(fr)?.[1];
        if (this.currentPage !== null && !dwpFilterPages.includes(this.currentPage)) {
          uiManager.markDownloadSetInfoPanelDirty();
          appendLog(dlp);
          // eslint-disable-next-line no-await-in-loop
          const z = await this.getZipsFromPage(dlp);
          const pz = dzs(z);
          // eslint-disable-next-line no-await-in-loop
          await Promise.all(pz);
          this.setFinished(true);
        }
      }
    };

    return _z();
  }
  public getExtraText(): string {
    return `: ${this.currentPage !== '' ? this.currentPage : 'init'}`;
  }
}
