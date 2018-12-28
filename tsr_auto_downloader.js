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

var openPhantomInstances = {};

screen.key(['escape', 'q', 'C-c'], (ch, key) => {
    Object.keys(openPhantomInstances).forEach((k) => {
        openPhantomInstances[k].exit();
    });
    return process.exit(0);
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

var currentlyDownloadingTbl = {};

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
    const {
        exec
    } = require('child_process');
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
    const delay = 500;
    const f = () => {
        numberOfOpenPhamtomJSInstances.setText("PhantomJS Instances: " + Object.keys(openPhantomInstances).length);
        screen.render();
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
            categoryDates.addItem(category.category + ": " + category.date.format(time_format) + " (P: " + category.page + ")" + "[Children remaining: " + category.waitingChildren + "]");
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

/* Basic flow:
   Category downloader:
      State:  currentDate, currentPageNumber
      Open category to the last seen date
      Use axios to request the page, load the page into cheerio,
      scrape the download links.
      Create a detail downloader for each item on the page.
      If no items or items on page are less than 21, go to the next date.
      Go to the next page.
*/
const category_downloader = class {
    constructor(category) {
        this.category = category
        this.base_url = "http://thesimsresource.com/downloads/browse/category/sims4-" + category
        this.page = 1;
        this.date = undefined;
        this.waitingChildren = 0;
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
            appendLog("New date for " + this.category + ": " + this.date.format(time_format));
        } else {
            this.page = this.page + 1;
            appendLog("New page for " + this.category + ": " + this.page);
        }
        updateCategoryDates();
    }
    dl_children($, children) {
        if (children === null) {
            return [new Promise(resovle => {
                resolve(true);
            })];
        }
        var childPromises = [];
        this.waitingChildren = children.length;
        children.each((child) => {
            var data_href = children[child].attribs['data-href'];
            var cdl = new detail_downloader(this.category, data_href);
            const downloadChild = (cdl) => {
                return new Promise(resolve => {
                    cdl.download().then(() => {
                        this.waitingChildren--;
                        resolve(true);
                    })
                });
            }
            const promiseWhile = (data, condition, action) => {
                var whilst = (data) => {
                    return condition(data) ?
                        action(data).then(whilst) :
                        Promise.resolve(true);
                }
                return whilst(data);
            };
            childPromises.push(promiseWhile(cdl, (cdl) => {
                return !cdl.ack;
            }, (cdl) => {
                return downloadChild(cdl);
            }));
        });
        return childPromises;
    }
    download_page() {
        return new Promise(resolve => {
            this.make_url().then((url) => {

                var _ph, _page;
                phantom.create().then((ph) => {
                    _ph = ph;
                    openPhantomInstances[this.category] = ph;
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
                                _ph.exit();
                                delete openPhantomInstances[this.category];
                            })
                            Promise.all(this.dl_children($, detailChildren)).then(() => {
                                this.next_page(detailChildren.length <= 21);
                                resolve(true);
                            });
                        });
                    });
                });
            });
        });
    }
    download() {
        const promiseWhile = (condition, action) => {
            var whilst = () => {
                return condition() ?
                    this[action]().then(whilst) :
                    Promise.resolve(true);
            }
            return whilst();
        };

        return promiseWhile(() => {
            return (typeof this.date === 'undefined') || this.date.isBefore(now);
        }, "download_page");
    }
}

function addCurrentlyDownloading(itemID, category) {
    currentlyDownloadingTbl[itemID] = {
        category: category,
        stage: "Start"
    };
    updateCurrentlyDownloadingList();
}

function deleteCurrentlyDownloading(itemID) {
    delete currentlyDownloadingTbl[itemID];
    updateCurrentlyDownloadingList();
}

function setCurrentlyDownloadingFileName(itemID, fileName) {
    currentlyDownloadingTbl[itemID].fileName = fileName;
    updateCurrentlyDownloadingList();
}

function setCurrentlyDownloadingStage(itemID, stage) {
    currentlyDownloadingTbl[itemID].stage = stage;
    updateCurrentlyDownloadingList();
}

const detail_downloader = class {
    constructor(category, attr) {
        this.itemID = attr.match(".+/id/([0-9]+)/")[1];
        this.category = category
        this.url = "https://thesimsresource.com" + attr;
        this.downloaded = false;
        this.ack = false;
    }
    download() {
        return new Promise(resolve => {
            setTimeout(() => {
                if (!this.ack) {
                    resolve(false);
                }
            }, 60000);
            var _ph, _page;
            addCurrentlyDownloading(this.itemID, this.category);
            setCurrentlyDownloadingStage(this.itemID, "PhantomJS");
            phantom.create().then((ph) => {
                _ph = ph;
                openPhantomInstances[this.itemID] = ph;
                return ph.createPage();
            }).then((page) => {
                setCurrentlyDownloadingStage(this.itemID, "Page Open");
                this.stage = "Open Page"
                _page = page;
                page.on('onError', function() {
                    return;
                });
                return _page.open(this.url);
            }).then((status) => {
                setCurrentlyDownloadingStage(this.itemID, "Checking");
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
                        var urlOut = null;
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
                                        _ph.exit();
                                        delete openPhantomInstances[this.itemID];
                                        resolve(url);
                                    });
                                } else {
                                    setTimeout(f, delay);
                                }
                            }
                            f();
                        });
                    }
                    var saving = false;
                    get_url().then((url) => {
                        function grabFilenameFromResponse(headers) {
                            return headers.match("filename=\"(.+)\"")[1];
                        }

                        axios.get(url).then((response) => {
                            var file_name = grabFilenameFromResponse(response.headers['content-disposition']).replace(/[^a-z0-9]/gi, '_').toLowerCase().replaceLast("_package", ".package").replaceLast("_zip", ".zip");
                            var path = "/home/whiro/s4s/" + category_type[this.category] + '/';
                            if (!fs.existsSync(path + file_name)) {
                                saving = true;
                                setCurrentlyDownloadingStage(this.itemID, "Saving");
                                setCurrentlyDownloadingFileName(this.itemID, path + file_name);
                                fs.writeFileSync(path + file_name, response.data);
                            }
                            this.downloaded = true;
                        });
                    });
                    waitForDownload().then(() => {
                        setCurrentlyDownloadingStage(this.itemID, saving ? "Finished" : "Skipped");
                        setTimeout(() => {
                            deleteCurrentlyDownloading(this.itemID);
                        }, 5000);
                        this.ack = true;
                        resolve(true);
                    });
                });
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