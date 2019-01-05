import { ItemDownloaderBase } from "./item_downloader_base";
import { f_n_regex } from "./constants";
import { uiManager } from "./ui_manager";
import { DownloadSetBase } from "./download_set_base";

export class DWPItemDownloader extends ItemDownloaderBase {
    constructor(owner: DownloadSetBase, url: string) {
        super(owner, url);
    }
    getSavePath(): string {
        return "DWP";
    }
    download(): Promise<void> {
        return new Promise(resolve => {
            const _z = async () => {
                const fn = this.getUrl().match(f_n_regex)[1];
                uiManager.addCurrentlyDownloadingItem(this);
                await this.save_if_needed(this.getUrl(), fn);
                resolve();
            };
        });
    }
}
