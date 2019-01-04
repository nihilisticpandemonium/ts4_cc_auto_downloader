import { ItemDownloaderBase } from "./item_downloader_base";
import { f_n_regex } from "./constants";
import { uiManager } from './ui_manager';

const dwp_item_path = '/home/whiro/s4s/DWP/';

export class DWPItemDownloader extends ItemDownloaderBase {
    constructor(owner, url) {
        super(owner, url);
    }
    download() {
        const _z = async() => {
            const fn = dwp_item_path + this.getUrl().match(f_n_regex)[1].scrubFilename();
            uiManager.addCurrentlyDownloadingItem(this);
            await this._save_if_needed(this.getUrl(), fn);
            return;
        }
        return _z();
    }
}
