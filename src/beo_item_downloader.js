import { ItemDownloaderBase } from "./item_downloader_base";
import { uiManager } from './ui_manager';
const cheerio = require('cheerio');

const f_r = /\S+/;
const u_b = 'https://sims-cloud.com/';

export class BEOItemDownloader extends ItemDownloaderBase {
    constructor(owner, url) {
        super(owner, url);
    }
    download() {
        const _z = async() => {
            uiManager.addCurrentlyDownloadingItem(this);
            uiManager.setCurrentlyDownloadingItemStage(this, "Getting DL URL");
            const r = await axios.get(this.getUrl());
            const $ = cheerio.load(r.data);
            const dur = $("a[href^='http://sims-cloud.com/?dl']");
            let du = null;
            dur.each((u) => {
                du = dur[u].attribs.href;
            });
            uiManager.setCurrentlyDownloadingItemStage(this, "Grabbing DL Site Page");
            const dr = await axios.get(du);
            const d$ = cheerio.load(dr.data);
            uiManager.setCurrentlyDownloadingItemStage(this, "Getting DL Link");
            const ar = d$("a[href^='download/']");
            let ah = null;
            ar.each((a) => {
                ah = ar[a].attribs.href;
            });
            const fs = ar.find('span.pull-left');
            uiManager.setCurrentlyDownloadingItemStage(this, "Getting Filename");
            const fn = fs.text().match(f_r)[0].scrubFilename();
            await this._save_if_needed(u_b + ah, fn);
            return;
        }
        return _z();
    }
}