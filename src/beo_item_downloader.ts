import { ItemDownloaderBase } from "./item_downloader_base";
import { uiManager } from "./ui_manager";
import axios from "axios";
import cheerio from "cheerio";
import { DownloadSetBase } from "./download_set_base";
import { f_n_regex } from "./constants";

const f_r = /\S+/;
const u_b = "https://sims-cloud.com/";

export class BEOItemDownloader extends ItemDownloaderBase {
    constructor(owner: DownloadSetBase, url: string) {
        super(owner, url);
    }
    getSavePath(): string {
        return "BEO";
    }
    download(): Promise<void> {
        const _z = async () => {
            uiManager.addCurrentlyDownloadingItem(this);
            this.stage = "Getting DL URL";
            uiManager.markCurrentlyDownloadingInfoPanelDirty();
            const r = await axios.get(this.getUrl());
            const $ = cheerio.load(r.data);
            const dur = $("a[href^='http://sims-cloud.com/?dl']");
            let du: string | null = null;
            dur.each(u => {
                du = dur[u].attribs.href;
            });
            if (du) {
                this.stage = "Grabbing DL Site Page";
                uiManager.markCurrentlyDownloadingInfoPanelDirty();
                const dr = await axios.get(du);
                const d$ = cheerio.load(dr.data);
                this.stage = "Getting DL Link";
                uiManager.markCurrentlyDownloadingInfoPanelDirty();
                const ar = d$("a[href^='download/']");
                let ah = null;
                ar.each(a => {
                    ah = ar[a].attribs.href;
                });
                const fs = ar.find("span.pull-left");
                this.stage = "Getting Filename";
                uiManager.markCurrentlyDownloadingInfoPanelDirty();
                const fn = fs.text().match(f_r)[0];
                await this.save_if_needed(u_b + ah, fn);
            }
            return;
        };
        return _z();
    }
}
