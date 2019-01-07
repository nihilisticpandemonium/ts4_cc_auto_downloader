import { ItemDownloaderBase } from './ItemDownloaderBase';
import { FILENAME_REGEX } from './Constants';
import { uiManager, appendLog } from './UIManager';
import { DownloadSetBase } from './DownloadSetBase';
import { P } from './TS4ADUtil';

export class DWPItemDownloader extends ItemDownloaderBase {
  constructor(owner: DownloadSetBase, url: string) {
    super(owner, url);
  }
  public getSavePath(): string {
    return 'DWP';
  }
  public download(): Promise<void> {
    return new Promise((resolve: P<void>) => {
      const _z = async () => {
        const fn = this.getUrl().match(FILENAME_REGEX)[1];
        uiManager.addCurrentlyDownloadingItem(this);
        await this.save_if_needed(this.getUrl(), fn);
        resolve();
      };
      _z();
    });
  }
}
