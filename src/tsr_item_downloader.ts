import { tsr_ajax_base_url, tsr_ajax_ext } from "./constants";
import { ItemDownloaderBase } from "./item_downloader_base";
import { uiManager, appendLog } from "./ui_manager";

import axios from "axios";
import { TSRDownloadSet } from "./tsr_download_set";
import { DownloadSetBase } from "./download_set_base";
const item_id_regex = /.+\/id\/([0-9]+)\//;
const url_base = "https://thesimsresource.com/";

const download_set_destination: { [index: string]: string } = {
    clothing: "CAS",
    shoes: "CAS",
    hair: "CAS",
    makeup: "CAS",
    accessories: "CAS",
    eyecolors: "CAS",
    skintones: "CAS",
    walls: "BB",
    floors: "BB",
    objects: "BB",
    objectrecolors: "BB",
    lots: "TRAY/LOTS",
    sims: "TRAY/SIMS",
    pets: "TRAY/PETS"
};

const f_r = /filename="(.+)"/;

export class TSRItemDownloader extends ItemDownloaderBase {
    private itemID: number;

    constructor(owner: DownloadSetBase, href: string) {
        super(owner, url_base + href);
        const ir_m = href.match(item_id_regex);
        if (ir_m) {
            this.itemID = parseInt(ir_m[1], 10);
        } else {
            this.itemID = -1;
        }
    }
    getSavePath(): string {
        return download_set_destination[this.getOwner().getSetIdentifier()];
    }
    download(): Promise<void> {
        if (this.itemID === -1) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            uiManager.addCurrentlyDownloadingItem(this);
            const _z = async () => {
                this.stage = "Get DL URL";
                uiManager.markCurrentlyDownloadingInfoPanelDirty();
                const ur = await axios.get(
                    tsr_ajax_base_url + this.itemID + tsr_ajax_ext
                );
                const u = ur.data.url;
                var s = false;
                const r = await axios.get(u);
                const gffr = (h: string) => {
                    return h.match(f_r)[1];
                };
                const fn = gffr(r.headers["content-disposition"]);
                if (fn) {
                    await this.save_if_needed(u, fn);
                }
                (this.getOwner() as TSRDownloadSet).markDownloadFinished();
                resolve();
            };
            _z();
        });
    }
}
