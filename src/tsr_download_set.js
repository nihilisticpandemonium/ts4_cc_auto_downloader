import { DownloadSetBase } from './download_set_base'
import { time_format, first_date, pets_first_date, now } from './constants';
import { sleep } from './ts4_ad_util.js';
import { uiManager, appendLog } from './ui_manager';
import { TSRItemDownloader } from './tsr_item_downloader';

const util = require('util');
const mkdirp = require('mkdirp');

const _mkdirp = util.promisify(mkdirp);

const levelup = require('levelup');
const leveldown = require('leveldown');
const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment');

const categories = ["clothing", "shoes", "hair", "makeup", "accessories", "eyecolors", "skintones", "walls", "floors", "objects", "objectrecolors", "lots", "sims", "pets"];
const category_type = {
    "clothing": "CAS",
    "shoes": "CAS",
    "hair": "CAS",
    "makeup": "CAS",
    "accessories": "CAS",
    "eyecolors": "CAS",
    "skintones": "CAS",
    "walls": "BB",
    "floors": "BB",
    "objects": "BB",
    "objectrecolors": "BB",
    "lots": "TRAY/LOTS",
    "sims": "TRAY/SIMS",
    "pets": "TRAY/PETS"
};

var cldsdb = null;

_mkdirp('../data').then(() => {
    cldsdb = levelup(leveldown('../data/category_date.db'));
});

const cldsdbr = new Promise(resolve => {
    const d = 500;
    const f = () => {
        if (cldsdb !== null) {
            resolve();
        } else {
            setTimeout(f, d);
        }
    }
    f();
});

export class TSRDownloadSet extends DownloadSetBase {
    #base_url;
    #page;
    #date;
    #waiting_downloads;
    #advance_date;

    constructor(category) {
        super("TSR", category);
        this.#base_url = "http://thesimsresource.com/downloads/browse/category/sims4-" + category;
        this.#page = 1;
        this.#date = undefined;
        this.#waiting_downloads = 0;
        this.#advance_date = false;

        const gd = async () => {
            await cldsdbr;
            try {
                const value = await cldsdb.get(this.getSetIdentifier());
                this.#date = moment(value, time_format);
                if (this.#date.isAfter(now)) {
                    this.#date = moment(now);
                }
            } catch (err) {
                if (this.getSetIdentifier() == "pets") {
                    this.#date = moment(pets_first_date);
                } else {
                    this.#date = moment(first_date);
                }
            }
        }
        gd();
    }
    #make_url() {
        const mu = async() => {
            while (typeof this.#date === 'undefined') {
                await sleep(500);
            }
            return this.#base_url + "/released/" + this.#date.format(time_format) + "/page/" + this.page + "/skipsetitems/1";
        }
        return mu();
    }
    #next_page() {
        if (this.#advance_date) {
            this.date.add(1, 'd');
            this.page = 1;
            cldsdb.put(this.getSetIdentifier(), this.date.format(time_format));
        } else {
            this.page++;
        }
        uiManager.setPendingDownloadSetUpdate();
        this.#advance_date = false;
    }
    markDownloadFinished() {
        this.#waiting_downloads--;
        uiManager.setPendingDownloadSetUpdate();
    }
    #download_page_items(h) {
        const $ = cheerio.load($);
        let ds = $('a[data-href]');
        this.#waiting_downloads = ds.length;
        uiManager.setPendingDownloadSetUpdate();
        const dp = [];
        ds.each((d) => {
            let dh = ds[d].attribs['data-href'];
            let ddl = new TSRItemDownloader(this, dh);
            dp.push(ddl.download());
        });
        this.#advance_date = ds.length <= 21;
        const z = async() => {
            await Promise.all(dp);
            return;
        }
        return z();
    }
    #download_page() {
        return new Promise(resolve => {
            var killTimeout = setTimeout(() => resolve(false), 45000);
            const dl = async() => {
                let u = await this.#make_url();
                appendLog(this.getSetIdentifier() + ": " + this.date.format(time_format));
                const response = await axios.get(url);

                clearTimeout(killTimeout);

                await this.#download_page_items(response.data);
                return true;
            }
            dl().then((r) => resolve(r));
        });
    }
    download() {
        const dp = async() => {
            let r = false;
            while (!r) {
                // eslint-disable-next-line no-await-in-loop
                r = await this.#download_page();
            }

            await sleep(2000);

            this.#next_page();

            if (this.#date.isAfter(now)) {
                this._set_finished(true);
                return true;
            } else {
                return dp();
            }
        }
        return dp();
    }
    getExtraText() {
        if (typeof this.#date !== 'undefined') {
            return ": " + this.#date.format(time_format) + " [Downloading: " + this.#waiting_downloads + "]";
        } else {
            return "";
        }
    }
}
