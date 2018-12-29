#!/usr/bin/env node

// TSR Auto Downloader by whiro, run from command-line
const moment = require('moment')
const phantom = require('phantom')
const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const levelup = require('levelup')
const leveldown = require('leveldown')
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const intercept = require("intercept-stdout");
const si = require("systeminformation");
const {
    exec
} = require("child_process");


var disableStdoutIntercept = intercept((txt) => {
    return;
});
var disableStderrIntercept = intercept((txt) => {
    return;
});

const time_format = "YYYY-MM-DD"
const first_date_string = "2014-09-06"
const first_date = moment(first_date_string, time_format);

const categories = ["clothing", "shoes", "hair", "makeup", "accessories", "eyecolors", "skintones", "walls", "floors", "objects", "objectrecolors", "lots", "sims", "pets"]
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
}

const cldsdb = levelup(leveldown('data/category_date.db'));

process.on('unhandledRejection', function(reason, promise) {
    //logger.error('Unhandled rejection', {reason: reason, promise: promise})
});

if (!String.prototype.replaceLast) {
    String.prototype.replaceLast = function(find, replace) {
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

screen.key(['escape', 'q', 'C-c'], (ch, key) => {
    exec("Killall -KILL phantomjs", (err, stdout, stderr) => {
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
})

screen.append(currentlyDownloading);

var log = contrib.log({
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
    top: '95%',
    left: '5%',
    width: '25%',
    height: '3%',
    align: 'left'
})

screen.append(numberOfDownloadedItems);

var numberOfOpenPhamtomJSInstances = blessed.text({
    top: '95%',
    left: '75%',
    width: '25%',
    height: '3%',
    align: 'left'
})

screen.append(numberOfOpenPhamtomJSInstances)

var spark = contrib.sparkline({
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

async function updateNetworkStats() {
    setInterval(() => {
        si.networkStats().then((data) => {
            if (!firstRun) {
                firstRun = true;
            } else {
                networkRxData.push(data.rx_sec);
                networkTxData.push(data.tx_sec);
                const truncateArray = (ary) => {
                    while (ary.length > numToTrack) {
                        ary.shift();
                    }
                }
                truncateArray(networkRxData);
                truncateArray(networkTxData);
                var rx_sec_label = 'rx (' + formatBytes(data.rx_sec) + '/sec)';
                var tx_sec_label = 'tx (' + formatBytes(data.tx_sec) + '/sec)';

                spark.setData([rx_sec_label, tx_sec_label], [networkRxData, networkTxData]);
                screen.render();
            }
        });
    }, 1000);
}

updateNetworkStats();

async function updateNumberOfDownloadedItems() {
    const delay = 2000;
    const f = () => {
        exec('ls /home/whiro/s4s/{CAS,BB,Tray/{Lots,Sims,Pets}}/* | wc -l', (err, stdout, stderr) => {
            if (!err) {
                numberOfDownloadedItems.setText("Number of items downloaded: " + stdout);
                screen.render();
            }
        });
    };
    setInterval(f, delay);
};

updateNumberOfDownloadedItems();

async function updateNumberOfOpenPhantomJSInstances() {
    const delay = 2000;
    const f = () => {
        exec('pgrep phantomjs | wc -l', (err, stdout, stderr) => {
            if (!err) {
                numberOfOpenPhamtomJSInstances.setText("PhantomJS Instances: " + stdout);
                screen.render();
            }
        });
    };
    setInterval(f, delay);
}

updateNumberOfOpenPhantomJSInstances();

const maxPhantomJSInstances = 60;

function getPhantomInstance() {
    function execPromise(command) {
        return new Promise(function(resolve, reject) {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(stdout.trim());
            });
        });
    }
    const getInstance = async() => {
        var numInstances = await execPromise("pgrep phantomjs | wc -l");
        if (parseInt(numInstances) < maxPhantomJSInstances) {
            var ph = await phantom.create();
            return ph;
        } else {
            return getInstance();
        }
    }
    return getInstance();
}

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
            if (typeof(category.waitingChildren) !== 'undefined') {
                text += ' [Children: ' + category.waitingChildren + ']';
            }
            categoryDates.addItem(text);
        };
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
        }).catch((err) => {
            this.date = moment(first_date);
        });
        const waitForDate = () => {
            return new Promise(resolve => {
                const delay = 500;
                const f = () => {
                    if (typeof(this.date) !== 'undefined') {
                        resolve(true);
                    } else {
                        setTimeout(f, delay);
                    }
                }
                f();
            });
        }
        waitForDate().then((value) => {
            return;
        });
    }
    make_url() {
        return new Promise(resolve => {
            const delay = 500;
            const f = () => {
                if (typeof this.date !== 'undefined') {
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
            const downloadChild = async(cdl) => {
                try {
                    await cdl.download();
                    this.waitingChildren--;
                    return true;
                } catch (err) {
                    return downloadChild(cdl);
                }
            }
            childPromises.push(downloadChild(cdl));
        });
        return childPromises;
    }
    download_page() {
        return new Promise(resolve => {
            this.make_url().then((url) => {
                var _ph, _page;
                getPhantomInstance().then((ph) => {
                    _ph = ph;
                    return ph.createPage();
                }).then((page) => {
                    _page = page;
                    page.on('onError', function() {
                        return;
                    });
                    return _page.open(url);
                }).then((status) => {
                    _page.property('content').then((content) => {
                        _page.evaluate(function() {
                            return document.body.innerHTML;
                        }).then((html) => {
                            const $ = cheerio.load(html);
                            var detailChildren = $('a[data-href]');
                            var page_close_promise = _page.close();
                            page_close_promise.then(() => {
                                _ph.exit().then(() => {
                                    var now = moment();
                                    if (detailChildren.length > 0) {
                                        Promise.all(this.dl_children($, detailChildren));
                                    }
                                    this.next_page(detailChildren.length <= 21);
                                    resolve(true);
                                });
                            });
                        });
                    });

                });
            });
        });
    }
    download() {
        const downloadPage = async() => {
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


const detail_downloader = class {
    constructor(category, attr) {
        this.itemID = attr.match(".+/id/([0-9]+)/")[1];
        this.category = category
        this.url = "https://thesimsresource.com" + attr;
        this.downloaded = false;
    }
    download() {
        return new Promise((resolve, reject) => {
            var killTimeout = setTimeout(() => {
                reject(false);
            }, 45000);
            var _ph, _page;
            addCurrentlyDownloading(this.itemID, this.category);
            setCurrentlyDownloadingStage(this.itemID, "Starting");
            getPhantomInstance().then((ph) => {
                _ph = ph;
                return ph.createPage();
            }).then((page) => {
                _page = page;
                page.on('onError', function() {
                    return;
                });
                return _page.open(this.url);
            }).then((status) => {
                const waitForDownload = () => {
                    return new Promise(resolve => {
                        const delay = 500;
                        const f = () => {
                            if (this.downloaded === true) {
                                resolve(true);
                            } else {
                                setTimeout(f, delay);
                            }
                        };
                        f();
                    });
                }

                _page.property('content').then((content) => {
                    var url = null;
                    _page.on('onConsoleMessage', function(msg) {
                        if (msg.match('http://d27wosp86lso6u.cloudfront.net/downloads') !== null) {
                            url = msg;
                        }
                    });
                    _page.evaluate(function(itemID) {
                        _dl(itemID, null, function(url, data) {
                            console.log(url);
                        });
                    }, this.itemID);
                    const get_url = () => {
                        return new Promise(resolve => {
                            const delay = 500;
                            const f = () => {
                                if (url !== null) {
                                    var page_close_promise = _page.close();
                                    page_close_promise.then(() => {
                                        _ph.exit().then(() => {
                                            resolve(url);
                                        });
                                    });
                                } else {
                                    setTimeout(f, delay);
                                }
                            }
                            f();
                        });
                    }
                    setCurrentlyDownloadingStage(this.itemID, "Get DL URL");
                    var saved = false;

                    get_url().then((url) => {
                        function grabFilenameFromResponse(headers) {
                            return headers.match("filename=\"(.+)\"")[1];
                        }

                        setCurrentlyDownloadingStage(this.itemID, "Get Filename");
                        axios.get(url).then((response) => {
                            clearTimeout(killTimeout);
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
                        });
                    });
                    waitForDownload().then(() => {
                        setCurrentlyDownloadingStage(this.itemID, saved ? "Finished" : "Skipped");
                        setTimeout(() => {
                            deleteCurrentlyDownloading(this.itemID);
                        }, 5000);
                        resolve(true);
                    });
                });
            }).catch((err) => {
                reject(false);
            });
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
});