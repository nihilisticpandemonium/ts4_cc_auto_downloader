import { DownloadSetBase } from "./download_set_base";
import { uiManager } from "./ui_manager";
import { BEOItemDownloader } from "./beo_item_downloader";

const axios = require("axios");
const cheerio = require("cheerio");

const beo_category: { [key: string]: string } = {
    "clothing_s4.php": "clothing",
    "accessories_s4.php": "accessories",
    "hair_s4.php": "hair"
};

const b_u = "http://beocreations.com/";

const p_r = /([^/]+$)/;

export class BeoDownloadSet extends DownloadSetBase {
    private page: string;
    private currentPage: string;

    constructor(page: string) {
        super("BEO", beo_category[page]);
        this.page = page;
        this.currentPage = "";

        uiManager.markDownloadSetInfoPanelDirty();
    }
    private get_all_dl_pages(): Promise<Array<any>> {
        const g = async () => {
            const r = await axios.get(b_u + this.page);
            const $ = cheerio.load(r.data);
            const dp = $("a[href^='creations/']");
            let h = new Array<string>();
            dp.each((d: number) => {
                const l = dp[d].attribs.href;
                h.push(b_u + l);
            });
            return h;
        };
        return g();
    }
    private download_page(p: string): Promise<void> {
        const dz = async () => {
            const i = new BEOItemDownloader(this, p);
            await i.download();
        };
        return dz();
    }
    download(): Promise<void> {
        const _z = async () => {
            const dlps = await this.get_all_dl_pages();
            const pz = [];
            for (const dlp of dlps) {
                this.currentPage = dlp.match(p_r)[1];
                uiManager.markDownloadSetInfoPanelDirty();
                pz.push(this.download_page(dlp));
            }
            await Promise.all(pz);
            this.set_finished(true);
        };
        return _z();
    }
    getExtraText(): string {
        return ": " + (this.currentPage !== "" ? this.currentPage : "init");
    }
}
