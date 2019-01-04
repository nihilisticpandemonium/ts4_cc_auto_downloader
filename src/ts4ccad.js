#!/usr/bin/env node

require("@babel/polyfill");

// TSR Auto Downloader by whiro, run from command-line
const intercept = require('intercept-stdout');

// eslint-disable-next-line no-unused-vars, no-unused-vars
const disableStdoutIntercept = intercept((txt) => {
    return;
});
// eslint-disable-next-line no-unused-vars, no-unused-vars
const disableStderrIntercept = intercept((txt) => {
    return;
});

const disableUnhandledRejection = true;

if (disableUnhandledRejection) {
    process.on('unhandledRejection', function () {
        //logger.error('Unhandled rejection', {reason: reason, promise: promise})
    });
}

import { uiManager, appendLog } from './ui_manager';
import { TSRDownloadSet } from './tsr_download_set';
import { DWPDownloadSet } from './dwp_download_set';
import { BeoDownloadSet } from './beo_download_set';

const tsr_categories = ["clothing", "shoes", "hair", "makeup", "accessories", "eyecolors", "skintones", "walls", "floors", "objects", "objectrecolors", "lots", "sims", "pets"];
const dwp_main_pages = ['ts4patreon-index.php', 'adult-index.php', 'ts4pay-index.php'];
const beo_main_pages = ['clothing_s4.php', 'accessories_s4.php', 'hair_s4.php'];

const ds = [];

tsr_categories.forEach((c) => {
    appendLog("Opening " + c + " for downloading.");
    const d = new TSRDownloadSet(c);
    ds.push(d.download());
});

dwp_main_pages.forEach((p) => {
    appendLog("Opening " + p + " for downloading.");
    const d = new DWPDownloadSet(p);
    ds.push(d.download());
});

beo_main_pages.forEach((p) => {
    appendLog("Opening " + p + " for downloading");
    const b = new BeoDownloadSet(p);
    ds.push(b.download());
});;

Promise.all(ds).then(() => {
    disableStdoutIntercept();
    uiManager.destroy();
    // eslint-disable-next-line no-console
    console.log("Finished downloading everything.");
    process.exit(0);
});
// eslint-disable-next-line eol-last
