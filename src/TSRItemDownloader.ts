import { TSR_AJAX_BASE_URL, TSR_AJAX_URL_EXT } from './Constants';
import { ItemDownloaderBase } from './ItemDownloaderBase';
import { uiManager, appendLog } from './UIManager';

import axios from 'axios';
import { TSRDownloadSet } from './TSRDownloadSet';
import { DownloadSetBase } from './DownloadSetBase';
const itemIDRegex = /.+\/id\/([0-9]+)\//;
const URLBase = 'https://thesimsresource.com/';

const downloadSetDestination: { [index: string]: string } = {
  clothing: 'CAS',
  shoes: 'CAS',
  hair: 'CAS',
  makeup: 'CAS',
  accessories: 'CAS',
  eyecolors: 'CAS',
  skintones: 'CAS',
  walls: 'BB',
  floors: 'BB',
  objects: 'BB',
  objectrecolors: 'BB',
  lots: 'TRAY/LOTS',
  sims: 'TRAY/SIMS',
  pets: 'TRAY/PETS'
};

const fr = /filename="(.+)"/;

export class TSRItemDownloader extends ItemDownloaderBase {
  private itemID: number;

  constructor(owner: DownloadSetBase, href: string) {
    super(owner, URLBase + href);
    const irm = href.match(itemIDRegex);
    if (irm) {
      this.itemID = parseInt(irm[1], 10);
    } else {
      this.itemID = -1;
    }
  }
  public getSavePath(): string {
    return downloadSetDestination[this.getOwner().getSetIdentifier()];
  }
  public download(): Promise<void> {
    if (this.itemID === -1) {
      return Promise.resolve();
    }

    return new Promise((resolve: P<void>) => {
      uiManager.addCurrentlyDownloadingItem(this);
      const _z = async () => {
        this.stage = 'Get DL URL';
        uiManager.markCurrentlyDownloadingInfoPanelDirty();
        const ur = await axios.get(
          TSR_AJAX_BASE_URL + this.itemID + TSR_AJAX_URL_EXT
        );
        const u = ur.data.url;
        const s = false;
        const r = await axios.get(u);
        const gffr = (h: string) => {
          return h.match(fr)[1];
        };
        const fn = gffr(r.headers['content-disposition']);
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
