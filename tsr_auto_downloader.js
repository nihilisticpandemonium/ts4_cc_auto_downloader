#!/usr/bin/env node

/*jshint esversion: 6 */
// TSR Auto Downloader by whiro, run from command-line
const moment = require('moment');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const levelup = require('levelup');
const leveldown = require('leveldown');
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const intercept = require("intercept-stdout");
const si = require("systeminformation");
const createPhantomPool = require('phantom-pool');

const {
    exec
} = require("child_process");

// Returns a generic-pool instance
const pool = createPhantomPool({
    max: 60, // default
    min: 30, // default
    // how long a resource can stay idle in pool before being removed
    idleTimeoutMillis: 1200000, // default.
    // maximum number of times an individual resource can be reused before being destroyed; set to 0 to disable
    maxUses: 0, // default
    // function to validate an instance prior to use; see https://github.com/coopernurse/node-pool#createpool
    validator: () => Promise.resolve(true), // defaults to always resolving true
    // validate resource before borrowing; required for `maxUses and `validator`
    testOnBorrow: true, // default
    // For all opts, see opts at https://github.com/coopernurse/node-pool#createpool
    phantomArgs: [], // arguments passed to phantomjs-node directly, default is `[]`. For all opts, see https://github.com/amir20/phantomjs-node#phantom-object-api
});

var // eslint-disable-next-line no-unused-vars, no-unused-vars
    disableStdoutIntercept = intercept((txt) => {
        return;
    });
var // eslint-disable-next-line no-unused-vars, no-unused-vars
    disableStderrIntercept = intercept((txt) => {
        return;
    });

const time_format = "YYYY-MM-DD";
const first_date_string = "2014-09-06";
const first_date = moment(first_date_string, time_format);
const pets_first_date_string = "2017-11-10";
const pets_first_date = moment(pets_first_date_string, time_format);

const categories = ["clothing", "shoes", "hair", "makeup", "accessories", "eyecolors", "skintones", "walls", "floors", "objects", "objectrecolors", "lots", "sims", "pets"];
const category_type = {
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
    "lots": "Tray/Lots",
    "sims": "Tray/Sims",
    "pets": "Tray/Pets"
};

const cldsdb = levelup(leveldown('data/category_date.db'));

process.on('unhandledRejection', function () {
    //logger.error('Unhandled rejection', {reason: reason, promise: promise})
});

if (!String.prototype.replaceLast) {
    String.prototype.replaceLast = function (find, replace) {
        var index = this.lastIndexOf(find);

        if (index >= 0) {
            return this.substring(0, index) + replace + this.substring(index + find.length);
        }

        return this.toString();
    };
}

var screen = blessed.screen({
    smartCSR: true,
});

screen.title = 'TSR Auto Downloader';

screen.key(['escape', 'q', 'C-c'], () => {
    pool.drain().then(() => {
        pool.clear();
        process.exit(0);
    });
});

var displayForm = blessed.form({
    top: 'left',
    left: 'left',
    width: '100%',
    height: '100%',
    border: {
        type: 'line'
    },
    style: {
        fg: 'white',
        bg: 'black',
        border: {
            fg: '#f0f0f0'
        },
    }
});

screen.append(displayForm);
var categoryDates = blessed.list({
    parent: displayForm,
    top: '5%',
    left: '5%',
    width: '40%',
    height: '45%',
    interactive: 'false',
    label: 'Category Current Dates',
    border: {
        type: 'line'
    },
    style: {
        fg: 'black',
        bg: 'red',
        border: {
            fg: '#d0d0d0'
        },
        item: {
            fg: 'white',
            bg: 'red',
        },
        selected: {
            fg: 'white',
            bg: 'red',
        }
    },
});

screen.append(categoryDates);

var currentlyDownloadingTbl = {};

function addCurrentlyDownloading(itemID, category) {
    if (!(itemID in currentlyDownloadingTbl)) {
        currentlyDownloadingTbl[itemID] = {
            category: category,
        };
        updateCurrentlyDownloadingList();
    }
}

function deleteCurrentlyDownloading(itemID) {
    if (itemID in currentlyDownloadingTbl) {
        delete currentlyDownloadingTbl[itemID];
        updateCurrentlyDownloadingList();
    }
}

function setCurrentlyDownloadingFileName(itemID, fileName) {
    if (itemID in currentlyDownloadingTbl) {
        currentlyDownloadingTbl[itemID].fileName = fileName;
        updateCurrentlyDownloadingList();
    }
}

function setCurrentlyDownloadingStage(itemID, stage) {
    if (itemID in currentlyDownloadingTbl) {
        currentlyDownloadingTbl[itemID].stage = stage;
        updateCurrentlyDownloadingList();
    }
}

var currentlyDownloading = blessed.list({
    parent: displayForm,
    top: '5%',
    left: '50%',
    width: '40%',
    height: '70%',
    interactive: 'false',
    label: 'Currently Downloading',
    border: {
        type: 'line'
    },
    style: {
        fg: 'black',
        bg: 'cyan',
        border: {
            fg: '#d0d0d0'
        },
        item: {
            fg: 'white',
            bg: 'cyan',
        },
        selected: {
            fg: 'white',
            bg: 'cyan'
        }
    }
});

screen.append(currentlyDownloading);

var log = contrib.log({
    parent: displayForm,
    top: '50%',
    left: '5%',
    width: '40%',
    height: '45%',
    aligh: 'left',
    label: 'Log',
    border: {
        type: "line",
        fg: "cyan"
    },
    style: {
        bg: "blue"
    },
});

screen.append(log);

var numberOfDownloadedItems = blessed.text({
    parent: displayForm,
    top: '95%',
    left: '5%',
    width: '60%',
    height: '3%',
    align: 'left'
})

screen.append(numberOfDownloadedItems);

var numberOfOpenPhamtomJSInstances = blessed.text({
    parent: displayForm,
    top: '95%',
    left: '75%',
    width: '25%',
    height: '3%',
    align: 'left'
})

screen.append(numberOfOpenPhamtomJSInstances)

var spark = contrib.sparkline({
    parent: displayForm,
    label: 'Throughput (bits/sec)',
    tags: true,
    top: '75%',
    left: '50%',
    height: '20%',
    width: '15%',
    style: {
        fg: 'red',
        bg: 'black'
    },
    border: {
        type: "line",
        fg: "magenta"
    }
})

screen.append(spark);

var bar = contrib.bar({
    parent: displayForm,
    label: 'CPU Load (%)',
    barWidth: 2,
    barSpacing: 1,
    xOffset: 0,
    maxHeight: 9,
    showtext: 'false',
    top: '75%',
    left: '70%',
    height: '20%',
    width: '30%',
    style: {
        fg: 'blue',
        bg: 'black',
    },
    border: {
        type: 'line',
        fg: 'green'
    }
})

screen.append(bar) //must append before setting data

const numToTrack = 30;
var networkRxData = [];
var networkTxData = [];
var firstRun = false;

function formatBytes(a, b) {
    if (0 == a) return "0 Bytes";
    var c = 1024,
        d = b || 2,
        e = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
        f = Math.floor(Math.log(a) / Math.log(c));
    return parseFloat((a / Math.pow(c, f)).toFixed(d)) + " " + e[f]
}

Array.prototype.truncate = function (trunclength) {
    while (this.length > trunclength) {
        this.shift();
    }
}

async function updateNetworkStats() {
    setInterval(() => {
        si.networkStats().then((data) => {
            if (!firstRun) {
                firstRun = true;
            } else {
                networkRxData.push(data.rx_sec);
                networkTxData.push(data.tx_sec);

                networkRxData.truncate(numToTrack);
                networkTxData.truncate(numToTrack);

                var rx_sec_label = 'rx (' + formatBytes(data.rx_sec) + '/sec)';
                var tx_sec_label = 'tx (' + formatBytes(data.tx_sec) + '/sec)';

                spark.setData([rx_sec_label, tx_sec_label], [networkRxData, networkTxData]);
                screen.render();
            }
        });
    }, 1000);
}

updateNetworkStats();

async function updateCPULoad() {
    setInterval(() => {
        si.currentLoad().then((data) => {
            var cpu_base = data.cpus.map(cpu => cpu.load);
            var cpus = cpu_base.map(function (entry, index, array) {
                return (index > ((data.cpus.length / 2) - 1)) ? null : Math.floor(((array[index] + array[index + (data.cpus.length / 2)]) / 2) / 10);
            }).filter(function (entry) {
                return entry != null
            });
            bar.setData({
                titles: Array.apply(null, {
                    length: cpus.length
                }).map(Number.call, Number).map(n => n.toString()),
                data: cpus
            });
            screen.render();
        });
    }, 1000);
}

updateCPULoad();

async function updateNumberOfDownloadedItems() {
    const delay = 2000;
    const f = () => {
        // eslint-disable-next-line init-declarations
        var bb, cas, lots, pets, sims;
        exec('ls /home/whiro/s4s/CAS/* | wc -l', (err, stdout) => {
            if (!err) {
                cas = parseInt(stdout, 10);
            } else {
                cas = 0;
            }
        })
        exec('ls /home/whiro/s4s/BB/* | wc -l', (err, stdout) => {
            if (!err) {
                bb = parseInt(stdout, 10);
            } else {
                bb = 0;
            }
        })
        exec('ls /home/whiro/s4s/Tray/Lots/* | wc -l', (err, stdout) => {
            if (!err) {
                lots = parseInt(stdout, 10);
            } else {
                lots = 0;
            }
        })
        exec('ls /home/whiro/s4s/Tray/Sims/* | wc -l', (err, stdout) => {
            if (!err) {
                sims = parseInt(stdout, 10);
            } else {
                sims = 0;
            }
        })
        exec('ls /home/whiro/s4s/Tray/Pets/* | wc -l', (err, stdout) => {
            if (!err) {
                pets = parseInt(stdout, 10);
            } else {
                pets = 0;
            }
        })
        var waitForAllTotals = async () => {
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            if (typeof (cas) !== 'undefined' && typeof (bb) !== 'undefined' && typeof (lots) !== 'undefined' && typeof (sims) !== 'undefined' && typeof (pets) !== 'undefined') {
                return cas + bb + lots + sims + pets;
            } else {
                await delay(500);
                return waitForAllTotals();
            }
        }
        waitForAllTotals().then((total) => {
            var text = "Number of items downloaded: " + total + " (CAS: " + cas + ", BB: " + bb + ", Lots: " + lots + ", Sims: " + sims + ", Pets: " + pets + ")";
            numberOfDownloadedItems.setText(text);
            screen.render();
        })
    };
    setInterval(f, delay);
}

updateNumberOfDownloadedItems();

async function updateNumberOfOpenPhantomJSInstances() {
    const delay = 2000;
    const f = () => {
        exec('pgrep phantomjs | wc -l', (err, stdout) => {
            if (!err) {
                numberOfOpenPhamtomJSInstances.setText("PhantomJS Instances: " + stdout);
                screen.render();
            }
        });
    };
    setInterval(f, delay);
}

updateNumberOfOpenPhantomJSInstances();

screen.render();

function appendLog(text) {
    log.log(text);
    screen.render();
}

var category_downloaders = [];

function updateCategoryDates() {
    categoryDates.clearItems();
    const renderCategoryDate = (category) => {
        if (typeof category.date !== 'undefined') {
            var text = category.category + ": " + category.date.format(time_format) + " (P: " + category.page + ")";
            if (typeof (category.waitingChildren) !== 'undefined') {
                text += ' [Children: ' + category.waitingChildren + ']';
            }
            categoryDates.addItem(text);
        }
    }

    category_downloaders.forEach(renderCategoryDate);
    screen.render();
}

function updateCurrentlyDownloadingList() {
    currentlyDownloading.clearItems();
    const renderCurrentlyDownloading = (key) => {
        var text = key + " (" + currentlyDownloadingTbl[key].category + ") [" + currentlyDownloadingTbl[key].stage + "]";
        if (typeof currentlyDownloadingTbl[key].fileName !== 'undefined') {
            text += ' => ' + currentlyDownloadingTbl[key].fileName;
        }
        currentlyDownloading.addItem(text);
    }
    Object.keys(currentlyDownloadingTbl).forEach(renderCurrentlyDownloading);
    screen.render();
}

async function flushScreenAtInterval() {
    setInterval(() => {
        process.stdout.write('\x1B[2J\x1B[0f\u001b[0;0H');
        screen.realloc();
        screen.render();
    }, 30000)
}

flushScreenAtInterval();

const now = moment();

const category_downloader = class {
    constructor(category) {
        this.category = category
        this.base_url = "http://thesimsresource.com/downloads/browse/category/sims4-" + category
        this.page = 1;
        this.date = undefined;
        cldsdb.get(this.category).then((value) => {
            this.date = moment(value, time_format);
        }).catch(() => {
            if (category == "pets") {
                this.date = moment(pets_first_date);
            } else {
                this.date = moment(first_date);
            }
        });
        const waitForDate = () => {
            return new Promise(resolve => {
                const delay = 500;
                const f = () => {
                    if (typeof (this.date) !== 'undefined') {
                        resolve(true);
                    } else {
                        setTimeout(f, delay);
                    }
                }
                f();
            });
        }
        waitForDate().then(() => {
            return;
        });
    }
    make_url() {
        return new Promise(resolve => {
            const delay = 500;
            const f = () => {
                if (typeof this.date !== 'undefined') {
                    updateCategoryDates();
                    resolve(this.base_url + "/released/" + this.date.format(time_format) + "/page/" + this.page + "/skipsetitems/1");
                } else {
                    setTimeout(f, delay);
                }
            }
            f();
        });
    }
    next_page(incDate) {
        if (incDate) {
            this.date.add(1, 'd')
            this.page = 1
            cldsdb.put(this.category, this.date.format(time_format));
        } else {
            this.page = this.page + 1;
        }
        appendLog("Moving " + this.category + " to next page.");
        updateCategoryDates();
    }
    dl_children($, children) {
        var childPromises = [];
        this.waitingChildren = children.length;
        children.each((child) => {
            var data_href = children[child].attribs['data-href'];
            var cdl = new detail_downloader(this.category, data_href);
            appendLog("Downloading " + cdl.itemID + "...");
            const downloadChild = (cdl) => {
                const dlch = async () => {
                    var res = await cdl.download();
                    appendLog("DL Result: " + cdl.itemID + ": " + res);
                    if (res) {
                        this.waitingChildren--;
                        updateCategoryDates();
                        return true;
                    } else {
                        setCurrentlyDownloadingStage(cdl.itemID, "Stalled");
                        return dlch();
                    }
                }
                return dlch();
            }
            childPromises.push(downloadChild(cdl));
        });
        return childPromises;
    }
    download_page() {
        const dl_page = async () => {
            const ready = new Promise(resolve => {
                pool.use(async (instance) => {
                    var url = await this.make_url();
                    updateCategoryDates();
                    var page = await instance.createPage();
                    await page.on('onError', function () {
                        return;
                    });
                    await page.open(url);
                    await page.property('content');
                    var html = await page.evaluate(function () {
                        // eslint-disable-next-line no-undef
                        return document.body.innerHTML;
                    });
                    await page.close();
                    return html;
                }).then((html) => {
                    const $ = cheerio.load(html);
                    var detailChildren = $('a[data-href]');
                    if (detailChildren.length === 0) {
                        resolve(true);
                    }
                    Promise.all(this.dl_children($, detailChildren)).then(() => {
                        this.next_page(detailChildren.length <= 21);
                        resolve(true);
                    });
                });
            });
            await ready;
            return true;
        }
        return dl_page();
    }
    download() {
        const downloadPage = async () => {
            await this.download_page();

            const delay = ms => {
                return new Promise(resolve => setTimeout(resolve, ms));
            };

            await delay(2000);

            if (this.date.isAfter(now)) {
                return true;
            } else {
                return downloadPage();
            }
        }
        return downloadPage();
    }
}

const dl_url = 'http://d27wosp86lso6u.cloudfront.net/downloads';

const detail_downloader = class {
    constructor(category, attr) {
        this.itemID = attr.match(".+/id/([0-9]+)/")[1];
        this.category = category
        this.url = "https://thesimsresource.com" + attr;
        this.downloaded = false;
    }
    download() {
        return new Promise(resolve => {
            addCurrentlyDownloading(this.itemID, this.category);
            setCurrentlyDownloadingStage(this.itemID, "Init");
            const downloaded = () => {
                return new Promise(resolve => {
                    pool.use(async (instance) => {
                        var killTimeout = setTimeout(() => {
                            resolve(false);
                        }, 45000);
                        var page = await instance.createPage();
                        setCurrentlyDownloadingStage(this.itemID, "Open TSR Page");
                        await page.on('onError', function () {
                            return;
                        });
                        await page.open(this.url);
                        setCurrentlyDownloadingStage(this.itemID, "Get Content");
                        await page.property('content');
                        var _url = null;
                        await page.on('onConsoleMessage', function (msg) {
                            if (msg.match(dl_url)) {
                                _url = msg;
                            }
                        });
                        const get_url = async () => {
                            const delay = (ms) => {
                                return new Promise(resolve => setTimeout(resolve, ms));
                            }
                            if (_url !== null) {
                                await page.close();
                                return _url;
                            } else {
                                await delay(500);
                                return get_url();
                            }
                        }
                        page.evaluate(function (itemID) {
                            // eslint-disable-next-line no-undef
                            _dl(itemID, null, function (url) {
                                // eslint-disable-next-line no-console
                                console.log(url);
                            });
                        }, this.itemID);
                        setCurrentlyDownloadingStage(this.itemID, "Get DL URL");
                        var url = await get_url();
                        clearTimeout(killTimeout);
                        return url;
                    }).then((url) => {
                        var saved = false;
                        var killTimeout = setTimeout(() => {
                            resolve(false);
                        }, 45000);
                        axios.get(url).then((response) => {
                            clearTimeout(killTimeout);
                            const grabFilenameFromResponse = (headers) => {
                                return headers.match("filename=\"(.+)\"")[1];
                            }
                            var file_name = grabFilenameFromResponse(response.headers['content-disposition']).replace(/[^a-z0-9]/gi, '_').toLowerCase().replaceLast("_package", ".package").replaceLast("_zip", ".zip");
                            var path = "/home/whiro/s4s/" + category_type[this.category] + '/';
                            setCurrentlyDownloadingStage(this.itemID, "Checking");
                            if (!fs.existsSync(path + file_name)) {
                                setCurrentlyDownloadingStage(this.itemID, "Saving");
                                setCurrentlyDownloadingFileName(this.itemID, file_name);
                                fs.writeFileSync(path + file_name, response.data);
                                saved = true;
                            }
                            this.downloaded = true;
                            setCurrentlyDownloadingStage(this.itemID, saved ? "Finished" : "Skipped");
                            setTimeout(() => {
                                deleteCurrentlyDownloading(this.itemID);
                            }, 5000);
                            resolve(true);
                        });
                    });
                });
            };
            downloaded().then(resolve);
        });
    }
}

var c_dl = [];

categories.forEach((category) => {
    appendLog("Opening " + category + " for downloading.")
    var c = new category_downloader(category);
    category_downloaders.push(c);
    c_dl.push(c.download());
});

Promise.all(c_dl).then(() => {
    appendLog("Finished downloading everything.");
    pool.drain().then(() => pool.clear())
});