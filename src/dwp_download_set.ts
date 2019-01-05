import { DownloadSetBase } from "./download_set_base";
import { uiManager, appendLog } from "./ui_manager";
import { sleep } from "./ts4_ad_util";
import { DWPItemDownloader } from "./dwp_item_downloader";

import axios from "axios";
import cheerio from "cheerio";

const dwp_root: { [index: string]: string } = {
    "ts4patreon-index.php": "ts4patreon/",
    "adult-index.php": "ts4adult/",
    "ts4pay-index.php": "ts4/"
};
const dwp_category: { [index: string]: string } = {
    "ts4patreon-index.php": "patreon",
    "adult-index.php": "adult",
    "ts4pay-index.php": "pay"
};

const dwp_filter_pages = [
    "index.php",
    "ts3patreon-index.php",
    "ts4patreon-index.php",
    "adult-index.php",
    "disclaimer.php",
    "ts4pay-index.php",
    "mailto:downwithpatreon@yahoo.com?subject=Attention",
    "faq.php",
    "#",
    "basemental.php",
    "blackcin.php",
    "turbodriver.php"
];

const b_u = "http://downwithpatreon.org/";
const f_r = /([^/]+$)/;

export class DWPDownloadSet extends DownloadSetBase {
    private page: string;
    private currentPage: string;

    constructor(page: string) {
        super("DWP", dwp_category[page]);
        this.page = page;
        this.currentPage = "";
        uiManager.markDownloadSetInfoPanelDirty();
    }
    private get_all_dl_pages(): Promise<Array<any>> {
        return new Promise((resolve: (value: any[]) => void) => {
            const g = async () => {
                const r = await axios.get(b_u + this.page);
                const $ = cheerio.load(r.data);
                const dp = $("a");
                let h = new Array<string>();
                dp.each((d: number) => {
                    const l = dp[d].attribs.href;
                    if (
                        l.match(".php$") !== null &&
                        !dwp_filter_pages.includes(l)
                    ) {
                        h.push(b_u + l);
                    }
                });
                resolve(h);
            };
            g();
        });
    }
    private get_zips_from_page(p: string): Promise<Array<any>> {
        // eslint-disable-next-line init-declarations
        var z: string[];

        axios.get(p).then(r => {
            const $ = cheerio.load(r.data);
            const zr = $("a");
            z = [];
            zr.each(x => {
                const a = zr[x].attribs.href;
                if (a.match(".zip$") !== null) {
                    z.push(b_u + dwp_root[this.page] + a);
                }
            });
        });
        return new Promise(resolve => {
            const delay = 500;
            const f = () => {
                if (typeof z !== "undefined") {
                    resolve(z);
                } else {
                    setTimeout(f, delay);
                }
            };
            f();
        });
    }
    download(): Promise<void> {
        const _z = async () => {
            const dlps = await this.get_all_dl_pages();
            const dz = (z: string) => {
                const zd = new DWPItemDownloader(this, z);
                return zd.download();
            };
            const dzs = (zs: string[]) => {
                var pz: Promise<void>[] = [];
                zs.forEach(z => {
                    pz.push(dz(z));
                });
                return pz;
            };
            for (const dlp of dlps) {
                this.currentPage = dlp.match(f_r)[1];
                if (!dwp_filter_pages.includes(this.currentPage)) {
                    uiManager.markDownloadSetInfoPanelDirty();
                    appendLog(dlp);
                    // eslint-disable-next-line no-await-in-loop
                    const z = await this.get_zips_from_page(dlp);
                    const pz = dzs(z);
                    // eslint-disable-next-line no-await-in-loop
                    await Promise.all(pz);
                    this.set_finished(true);
                }
            }
        };
        return _z();
    }
    getExtraText(): string {
        return ": " + (this.currentPage !== "" ? this.currentPage : "init");
    }
}
