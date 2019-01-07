import { DownloadSetBase } from './DownloadSetBase';
import {
  TIME_FORMAT,
  TSR_FIRST_DATE,
  TSR_PETS_FIRST_DATE,
  now
} from './Constants';
import { sleep } from './TS4ADUtil.js';
import { uiManager, appendLog } from './UIManager';
import { TSRItemDownloader } from './TSRItemDownloader';

import levelup from 'levelup';
import leveldown from 'leveldown';
import axios from 'axios';
import cheerio from 'cheerio';
import moment, { Moment } from 'moment';

const cldsdb = levelup(leveldown('./data/category_date.db'));

export class TSRDownloadSet extends DownloadSetBase {
  private baseUrl: string;
  private page: number;
  private dateFound: boolean;
  private date: Moment;
  private waitingDownloads: number;
  private advanceDate: boolean;

  public constructor(category: string) {
    super('TSR', category);
    this.baseUrl = `http://thesimsresource.com/downloads/browse/category/sims4-${category}`;
    this.page = 1;
    this.dateFound = false;
    this.waitingDownloads = 0;
    this.advanceDate = false;
    this.date = moment('1901-01-01', TIME_FORMAT);

    const gd = async () => {
      try {
        const value = await cldsdb.get(this.getSetIdentifier());
        this.date = moment(value.toString(), TIME_FORMAT);
        if (this.date.isAfter(now)) {
          this.date = moment(now);
        }
      } catch (err) {
        if (this.getSetIdentifier() === 'pets') {
          this.date = moment(TSR_PETS_FIRST_DATE);
        } else {
          this.date = moment(TSR_FIRST_DATE);
        }
      }
      this.dateFound = true;
    };
    gd();
  }
  private makeURL(): Promise<string> {
    return new Promise((resolve: P<string>) => {
      const delay = 500;
      const f = () => {
        if (this.dateFound) {
          resolve(
            `${this.baseUrl}/released/${this.date.format(TIME_FORMAT)}/page/${
              this.page
            }/skipsetitems/1`
          );
        } else {
          setTimeout(f, delay);
        }
      };
      f();
    });
  }
  private nextPage() {
    if (this.advanceDate) {
      this.date.add(1, 'd');
      this.page = 1;
      cldsdb.put(this.getSetIdentifier(), this.date.format(TIME_FORMAT));
    } else {
      this.page += 1;
    }
    uiManager.markDownloadSetInfoPanelDirty();
    this.advanceDate = false;
  }
  public markDownloadFinished() {
    this.waitingDownloads -= 1;
    uiManager.markDownloadSetInfoPanelDirty();
  }
  private downloadPageItems(h: string): Promise<void> {
    return new Promise((resolve: P<void>) => {
      const $ = cheerio.load(h);
      const ds = $('a[data-href]');
      this.waitingDownloads = ds.length;
      uiManager.markDownloadSetInfoPanelDirty();
      const dp: Promise<void>[] = [];
      ds.each((_: number, e: CheerioElement) => {
        const dh = e.attribs['data-href'];
        const ddl = new TSRItemDownloader(this, dh);
        dp.push(ddl.download());
      });
      this.advanceDate = ds.length <= 21;
      const z = async () => {
        await Promise.all(dp);
        resolve();
      };
      z();
    });
  }
  private downloadPage(): Promise<boolean> {
    return new Promise((resolve: P<boolean>) => {
      const k = setTimeout(() => resolve(false), 45000);
      const dl = async () => {
        const u = await this.makeURL();
        uiManager.markDownloadSetInfoPanelDirty();
        appendLog(
          `${this.getSetIdentifier()}: ${this.date.format(TIME_FORMAT)}`
        );
        const r = await axios.get(u);
        clearTimeout(k);

        await this.downloadPageItems(r.data);
        resolve(true);
      };
      dl();
    });
  }
  public download(): Promise<void> {
    const dp = async (): Promise<void> => {
      let r = false;
      while (!r) {
        // eslint-disable-next-line no-await-in-loop
        r = await this.downloadPage();
      }

      await sleep(2000);

      this.nextPage();

      if (this.date.isAfter(now)) {
        this.setFinished(true);

        return;
      }

      return dp();
    };

    return dp();
  }
  public getExtraText(): string {
    if (this.dateFound) {
      return `: ${this.date.format(TIME_FORMAT)} [Downloads: ${
        this.waitingDownloads
      }]`;
    }

    return 'init';
  }
}
