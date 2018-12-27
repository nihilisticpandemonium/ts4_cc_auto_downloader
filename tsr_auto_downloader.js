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

const time_format = "YYYY-MM-DD"
const first_date = moment("2014-09-06", time_format);

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
const dldb = levelup(leveldown('data/downloaded.db'));

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
    smartCSR: true
});

screen.title = 'TSR Auto Downloader';

var openPhantomInstances = {};

screen.key(['escape', 'q', 'C-c'], (ch, key) => {
    Object.keys(openPhantomInstances).forEach((k) => { openPhantomInstances[k].exit(); });
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
    top: '15%',
    left: '10%',
    width: '35%',
    height: '70%',
    interactive: 'false',
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

var categoryDateLabel = blessed.text({
    parent: displayForm,
    top: '5%',
    left: '10%',
    width: '35%',
    height: '10%',
})

categoryDateLabel.setText("Category Dates");

screen.append(categoryDateLabel);

var currentlyDownloading = blessed.list({
    parent: displayForm,
    top: '15%',
    left: '50%',
    width: '35%',
    height: '70%',
    interactive: 'false',
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

var currentlyDownloadingLabel = blessed.text({
    parent: displayForm,
    top: '5%',
    left: '50%',
    width: '35%',
    height: '10%',
})

currentlyDownloadingLabel.setText('Currently Downloading');

screen.append(currentlyDownloadingLabel);

var currentlyDownloadingTbl = {};

var currentlyExecutingText = blessed.text({
    top: '90%', 
    left: '5%',
    width: '90%',
    height: '10%',
    aligh: 'left'
})

screen.append(currentlyExecutingText);

screen.render();

function log(text) {
    currentlyExecutingText.setText(text);
    screen.render();
}

var category_downloaders = [];

function updateCategoryDates() {
    categoryDates.clearItems();
    const renderCategoryDate = (category) => {
        if (typeof category.date !== 'undefined') {
            categoryDates.addItem(category.category + ": " + category.date.format(time_format) + " (P: " + category.page + ")");
        }
    }

    category_downloaders.forEach(renderCategoryDate);
    screen.render();
}

function updateCurrentlyDownloadingList() {
    currentlyDownloading.clearItems();
    const renderCurrentlyDownloading = (key) => {
        var text = key + " (" + currentlyDownloadingTbl[key].category + ")";
        if (typeof currentlyDownloadingTbl[key].fileName !== 'undefined') {
            text += ' => ' + currentlyDownloadingTbl[key].fileName;
        }
        currentlyDownloading.addItem(text);
    }
    Object.keys(currentlyDownloadingTbl).forEach(renderCurrentlyDownloading);
    screen.render();
}

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
        updateCategoryDates();
    }
    dl_children($, children) {
        var childPromises = [];
        children.each((child) => {
            var data_href = children[child].attribs['data-href'];
            var cdl = new detail_downloader(this.category, data_href);
            childPromises.push(cdl.download());
        });
        return childPromises;
    }
    download() {
        return new Promise(resolve => {
            this.make_url().then((url) => {
                var now = moment();
                if (this.date.isAfter(now)) {
                    resolve(true);
                } else {
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
                                var now = moment();
                                if (detailChildren.length > 0) {
                                    Promise.all(this.dl_children($, detailChildren));
                                }
                                this.next_page(detailChildren.length <= 21);
                                this.download().then(() => {
                                    resolve(true);
                                });
                            });
                        });
                    });
                };
            });
        });
    }
}

var phantom_instance_pool = [];

function addCurrentlyDownloading(itemID, category) {
    currentlyDownloadingTbl[itemID] = { category: category };
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

const detail_downloader = class {
    constructor(category, attr) {
        this.itemID = attr.match(".+/id/([0-9]+)/")[1];
        this.category = category
        this.url = "https://thesimsresource.com" + attr;
        this.downloaded = false;
    }
    download() {
        var _waitingForDelete = false;
        if (this.category == "Lots" || this.category === "Sims" || this.category === "Pets") {
            _waitingForDelete = true;
            dldb.del(this.itemID).then(() => {
                _waitingForDelete = false;
            }).catch((err) => {
                _waitingForDelete = false;
            });
        }
        const waitForDelete = () => {
            return new Promise(resolve => {
                const delay = 500;
                const f = () => {
                    if (!_waitingForDelete) {
                        resolve(true);
                    } else {
                        setTimeout(f, delay);
                    }
                }
                f();
            });
        }
        waitForDelete().then((value) => {
            dldb.get(this.itemID).then((value) => {
                return new Promise(resolve => { resolve(true); });
            }).catch((err) => {
                return new Promise(resolve => {
                    var _ph, _page;
                    phantom.create().then((ph) => {
                        _ph = ph;
                        openPhantomInstances[this.itemID] = ph;
                        return ph.createPage();
                    }).then((page) => {
                        _page = page;
                        page.on('onError', function() {
                            return;
                        });
                        return _page.open(this.url);
                    }).then((status) => {
                        addCurrentlyDownloading(this.itemID, this.category);
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
                                            resolve(url);
                                        } else {
                                            setTimeout(f, delay);
                                        }
                                    }
                                    f();
                                });
                            }
                            get_url().then((url) => {
                                function grabFilenameFromResponse(headers) {
                                    return headers.match("filename=\"(.+)\"")[1];
                                }
                                axios.get(url).then((response) => {
                                    var file_name = grabFilenameFromResponse(response.headers['content-disposition']).replace(/[^a-z0-9]/gi, '_').toLowerCase().replaceLast("_package", ".package").replaceLast("_zip", ".zip");
                                    var path = "/home/whiro/s4s/" + category_type[this.category] + '/';
                                    if (!fs.existsSync(path + file_name)) {
                                        setCurrentlyDownloadingFileName(this.itemID, file_name);
                                        fs.writeFileSync(path + file_name, response.data);
                                        dldb.put(this.itemID, true);
                                    }
                                    this.downloaded = true;
                                });
                            });
                            waitForDownload().then(() => {
                                deleteCurrentlyDownloading(this.itemID);
                                var page_close_promise = _page.close();
                                page_close_promise.then(() => {
                                    _ph.exit();
                                    delete openPhantomInstances[this.itemID];
                                    resolve(true);
                                });
                            });
                        });
                    });
                });
            });
        });
    }
}

var c_dl = [];

categories.forEach((category) => {
    log("Opening " + category + " for downloading.")
    var c = new category_downloader(category);
    category_downloaders.push(c);
    c_dl.push(c.download());
});

Promise.all(c_dl).then(() => {
    log("Finished downloading everything.");
});