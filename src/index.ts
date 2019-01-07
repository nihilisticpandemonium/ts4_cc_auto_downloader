#!/usr/bin/env node
import sourceMapSupport from 'source-map-support';

sourceMapSupport.install();

// TSR Auto Downloader by whiro, run from command-line
import interceptStdout from 'intercept-stdout';

const disableStdoutIntercept = interceptStdout(
  (txt: string): void => {
    return;
  }
);
const disableStderrIntercept = interceptStdout(
  (txt: string): void => {
    return;
  }
);

const disableUnhandledRejection = true;

if (disableUnhandledRejection) {
  process.on('unhandledRejection', () => {
    //logger.error('Unhandled rejection', {reason: reason, promise: promise})
  });
}

import { uiManager, appendLog } from './UIManager';
import { TSRDownloadSet } from './TSRDownloadSet';
import { DWPDownloadSet } from './DWPDownloadSet';
import { BeoDownloadSet } from './BeoDownloadSet';
import { DownloadSetBase } from './DownloadSetBase';

const tsrCategories = [
  'clothing',
  'shoes',
  'hair',
  'makeup',
  'accessories',
  'eyecolors',
  'skintones',
  'walls',
  'floors',
  'objects',
  'objectrecolors',
  'lots',
  'sims',
  'pets'
];
const dwpMainPages = [
  'ts4patreon-index.php',
  'adult-index.php',
  'ts4pay-index.php'
];
const beoMainPages = ['clothing_s4.php', 'accessories_s4.php', 'hair_s4.php'];

const pt: Map<string, string[]> = new Map<string, string[]>();
pt.set('tsr', tsrCategories);
pt.set('dwp', dwpMainPages);
pt.set('beo', beoMainPages);

const ds: Promise<void>[] = [];

for (const kv of pt) {
  const p = kv[1];
  p.forEach((pg: string) => {
    let o: DownloadSetBase;
    switch (kv[0]) {
      case 'tsr':
        o = new TSRDownloadSet(pg);
        break;
      case 'dwp':
        o = new DWPDownloadSet(pg);
        break;
      case 'beo':
        o = new BeoDownloadSet(pg);
        break;
      default:
    }
    if (o !== undefined) {
      ds.push(o.download());
    }
  });
}

Promise.all(ds).then(() => {
  disableStdoutIntercept();
  uiManager.destroy();
  // eslint-disable-next-line no-console
  console.log('Finished downloading everything.');
  process.exit(0);
});

// eslint-disable-next-line eol-last
