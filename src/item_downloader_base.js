import { uuid, writeBinaryDataToFile } from './ts4_ad_util.js';
import { uiManager } from './ui_manager';

const util = require('util');
const fs = require('fs');
const axios = require('axios');
const stream = require('stream');

const access = util.promisify(fs.access);
const close = util.promisify(fs.close);
const pipeline = util.promisify(stream.pipeline);

export class ItemDownloaderBase {
    #owner;
    #url;
    #id;
    
    constructor(owner, url) {
        this.#owner = owner;
        this.#url = url;
        this.#id = uuid();
    }
    getId() {
        return this.#id;
    }
    getOwner() {
        return this.#owner;
    }
    getUrl() {
        return this.#url;
    }
    download() {
        return Promise.resolve(true);
    }
    _save_if_needed(url, dest) {
        const _z = async() => {
            var s = false;
            uiManager.setCurrentlyDownloadingItemStage(this, "Checking");
            uiManager.setCurrentlyDownloadingItemDestination(this, dest);
            try {
                await access(dest);
                await close(dest);
            } catch (err) {
                uiManager.setCurrentlyDownloadingItemStage(this, "Saving");
                const r = await axios({
                    url,
                    method: 'GET',
                    responseType: 'stream'
                });
                await writeBinaryDataToFile(dest, r);
                s = true;
            }
            uiManager.setCurrentlyDownloadingItemStage(this, s ? "Finished" : "Skipped");
            setTimeout(() => {
                uiManager.deleteCurrentlyDownloadingItem(this);
            }, 5000);
            return;
        }
        return _z();
    }
}