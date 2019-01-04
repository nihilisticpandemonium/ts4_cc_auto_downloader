import { tsr_ajax_base_url, tsr_ajax_ext } from './constants';
import { ItemDownloaderBase } from './item_downloader_base';
import { uiManager } from './ui_manager';

const axios = require('axios');
const item_id_regex = /.+\/id\/([0-9]+)\//;
const url_base = "https://thesimsresource.com"

const download_set_destination = {
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

export class TSRItemDownloader extends ItemDownloaderBase {
    #itemID;
    #url;

    constructor(owner, href) {
        super(owner, url_base + href);
        this.#itemID = href.match(item_id_regex)[1];    
    }
    download() {
        return new Promise(resolve => {
            uiManager.addCurrentlyDownloadingItem(this);
            const _z = async () => {
                ui.setCurrentlyDownloadingItemStage(this, "Get DL URL");
                const ur = await axios.get(tsr_ajax_base_url + this.itemID + tsr_ajax_ext);
                const u = ur.data.url;
                var s = false;
                const r = await axios.get(u);
                const gffr = (h) => {
                    return h.match("filename=\"(.+)\"")[1];
                }
                const fn = gffr(r.headers['content-disposition']).scrubFilename();
                const p = "/home/whiro/s4s/" + download_set_destination[this.getOwner().getSetIdentifier()] + '/';
                const fnz = p + fn;
                await this._save_if_needed(u, fnz);
                return;
            }
            _z().then(resolve);
        });
    }
}