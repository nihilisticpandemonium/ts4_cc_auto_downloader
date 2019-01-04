import { DownloadSetBase } from "./download_set_base";
import { uiManager } from './ui_manager';
import { sleep } from './ts4_ad_util';

const axios = require('axios');

const dwp_root = {
    'ts4patreon-index.php': 'ts4patreon/',
    'adult-index.php': 'ts4adult/',
    'ts4pay-index.php': 'ts4pay/'
}
const dwp_category = {
    'ts4patreon-index.php': 'patreon',
    'adult-index.php': 'adult',
    'ts4pay-index.php': 'pay',
}

const dwp_filter_pages = ['index.php', 'ts3patreon-index.php', 'ts4patreon-index.php', 'adult-index.php', 'disclaimer.php', 'ts4pay-index.php', 'mailto:downwithpatreon@yahoo.com?subject=Attention', 'faq.php', '#', 'basemental.php', 'blackcin.php', 'turbodriver.php'];

const b_u = 'http://downwithpatreon.org/';
const f_r = /([^/]+$)/;

export class DWPDownloadSet extends DownloadSetBase {
    #page;
    #currentPage;
    
    constructor(page) {
        super("DWP", dwp_category[page]);
        this.#page = page;
        this.#currentPage = null;
        uiManager.setPendingDownloadSetUpdate();
    }
    #get_all_dl_pages() {
        const g = async () => {
            const r = await axios.get(b_u + this.#page);
            const $ = cheerio.load(r.data);
            const dp = $('a');
            let h = [];
            dp.each((d) => {
                const l = dp[d].attribs.href;
                if (l.match('.php$') !== null && !dwp_filter_pages.includes(l)) {
                    h.push(b_u + l);
                }
            });
            return h;
        }
        return g();
    }
    #get_zips_from_page(p) {
        // eslint-disable-next-line init-declarations
        var z;

        axios.get(p).then((r) => {
            const $ = cheerio.load(r.data);
            const zr = $('a');
            z = [];
            zr.each((x) => {
                const a = zr[x].attribs.href;
                if (a.match('.zip$') !== null) {
                    z.push(b_u + dwp_root[this.#page] + a);
                }
            });
        });
        const wfz = async () => {
            if (typeof zips !== 'undefined') {
                return zips;
            } else {
                sleep(500);
                return wfz();
            }
        }
        return wfz();
    }
    download() {
        const _z = async () => {
            const dlps = await this.#get_all_dl_pages();
            const dzs = (zs) => {
                var pz = [];
                zs.forEach((z) => {
                    pz.push(dz(z));
                })
                return pz;
            }
            for (const dlp of dlps) {
                this.#currentPage = dlp.match(f_r)[1];
                if (!dwp_filter_pages.includes(this.#currentPage)) {
                    uiManager.setPendingDownloadSetUpdate();
                    // eslint-disable-next-line no-await-in-loop
                    const z = await this.#get_zips_from_page(dlp);
                    const pz = dzs(z);
                    // eslint-disable-next-line no-await-in-loop
                    await Promise.all(pz);
                    this._set_finished(true);
                }
            }
        }
        return _z();
    }
    getExtraText() {
        return ": " + this.#currentPage !== null ? this.#currentPage : "init";
    }
}
