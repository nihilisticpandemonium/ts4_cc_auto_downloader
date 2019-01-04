import { DownloadSetBase } from "./download_set_base";
import { uiManager } from './ui_manager';
import { sleep } from './ts4_ad_util';
import { BEOItemDownloader } from "./beo_item_downloader";

const axios = require('axios');

const beo_category = {
    'clothing_s4.php': 'clothing',
    'accessories_s4.php': 'accessories',
    'hair_s4.php': 'hair'
}

const b_u = 'http://beocreations.com/';

const p_r = /([^/]+$)/;

export class BeoDownloadSet extends DownloadSetBase {
    #page;
    #currentPage;
    constructor(page) {
        super("BEO", beo_category[page]);
        this.#page = page;
        this.#currentPage = null;

        uiManager.setPendingDownloadSetUpdate();
    }
    #get_all_dl_pages() {
        const g = async() => {
            const r = await axios.get(b_u + this.#page);
            const $ = cheerio.load(r.data);
            const dp = $("a[href^='creations/']");
            let h = [];
            dp.each((d) => {
                const l = dp[d].attribs.href;
                h.push(b_u + l);
            });
            return h;
        }
        return g();
    }
    #download_page(p) {
        const dz = async() => {
            const i = new BEOItemDownloader(this, p);
            await i.download();
        }
        return dz();
    }
    download() {
        const _z = async() => {
            const dlps = await this.#get_all_dl_pages();
            const pz = [];
            for (const dlp of dlps) {
                this.#currentPage = dlp.match(p_r)[1];
                uiManager.setPendingDownloadSetUpdate();
                pz.push(this.#download_page(dlp));
            }
            await Promise.all(pz);
            this._set_finished(true);
        }
        return _z();
    }
    getExtraText() {
        return ": " + this.#currentPage !== null ? this.#currentPage : "init";
    }
}
