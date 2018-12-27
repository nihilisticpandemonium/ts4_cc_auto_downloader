#!/usr/bin/env node

// TSR Auto Downloader by whiro, run from command-line
var moment = require('moment')
var phantom = require('phantom')
var axios = require('axios')
var cheerio = require('cheerio')
var fs = require('fs')
var levelup = require('levelup')
var leveldown = require('leveldown')

var time_format = "YYYY-MM-DD"
var first_date = moment("2014-09-06", time_format)

var categories = ["clothing", "shoes", "hair", "makeup", "accessories", "eyecolors", "skintones", "walls", "floors", "objects", "objectrecolors", "lots", "sims", "pets"]
var category_type = {
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
    "lots": "Tray",
    "sims": "Tray",
    "pets": "Tray"
}

var cldsdb = levelup(leveldown('data/category_date.db'));
var dldb = levelup(leveldown('data/downloaded.db'));

if (!String.prototype.replaceLast) {
    String.prototype.replaceLast = function(find, replace) {
        var index = this.lastIndexOf(find);

        if (index >= 0) {
            return this.substring(0, index) + replace + this.substring(index + find.length);
        }

        return this.toString();
    };
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
            console.log("New date for " + this.category + ": " + this.date.format(time_format));
            cldsdb.put(this.category, this.date.format(time_format));
        } else {
            this.page = this.page + 1;
            console.log("New page for " + this.category + ": " + this.page);
        }
    }
    dl_children($, children) {
        console.log('dl_children');
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
                        return ph.createPage();
                    }).then((page) => {
                        _page = page;
                        return _page.open(url);
                    }).then((status) => {
                        _page.property('content').then((content) => {
                            _page.on('onError', function(msg, trace) {
                                var msgStack = ['ERROR: ' + msg];
                                if (trace && trace.length) {
                                    msgStack.push('TRACE:');
                                    trace.forEach(function(t) {
                                        msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function+'")' : ''));
                                    });
                                }
                                // uncomment to log into the console 
                                // console.error(msgStack.join('\n'));
                            });
                            _page.evaluate(function() {
                                return document.body.innerHTML;
                            }).then((html) => {
                                const $ = cheerio.load(html);
                                var detailChildren = $('a[data-href]');
                                var page_close_promise = _page.close();
                                page_close_promise.then(() => {
                                    _ph.exit();
                                })
                                var now = moment();
                                if (detailChildren.length > 0) {
                                    Promise.all(this.dl_children($, detailChildren));
                                }
                                this.next_page(detailChildren.length <= 21);
                                this.download();
                            });
                        });
                    });
                };
            });
        });
    }
}

var phantom_instance_pool = [];

const detail_downloader = class {
    constructor(category, attr) {
        this.itemID = attr.match(".+/id/([0-9]+)/")[1];
        this.category = category
        this.url = "https://thesimsresource.com" + attr;
        this.downloaded = false;
    }
    download() {
        dldb.get(this.itemID).then((value) => {
            return;
        }).catch((err) => {
            console.log("Downloading " + this.itemID + "...");
            return new Promise(resolve => {
                var _ph, _page;
                phantom.create().then((ph) => {
                    _ph = ph;
                    return ph.createPage();
                }).then((page) => {
                    _page = page;
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
                        _page.on('onError', function(msg, trace) {
                            var msgStack = ['ERROR: ' + msg];
                            if (trace && trace.length) {
                                msgStack.push('TRACE:');
                                trace.forEach(function(t) {
                                    msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function+'")' : ''));
                                });
                            }
                            // uncomment to log into the console 
                            // console.error(msgStack.join('\n'));
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
                                    console.log("Saving download to " + path + file_name);
                                    fs.writeFileSync(path + file_name, response.data);
                                    dldb.put(this.itemID, true);
                                }
                                this.downloaded = true;
                            });
                        });
                        waitForDownload().then(() => {
                            var page_close_promise = _page.close();
                            page_close_promise.then(() => {
                                _ph.exit();
                                resolve(true);
                            });
                        });
                    });
                });
            });
        });
    }
}

var c_dl = [];
var category_downloaders = [];
categories.forEach((category) => {
    console.log("Opening " + category + " for downloading.")
    var c = new category_downloader(category);
    category_downloaders.push(c);
    c_dl.push(c.download());
});

function printDatesAtInterval() {
    return new Promise(resolve => {
        function printCategoryCurrentDates() {
            const printDate = (category) => {
                console.log(category.category + ": " + category.date.format(time_format));
            }
            console.log("Current category dates:");
            category_downloaders.forEach(printDate);
        }

        setInterval(printCategoryCurrentDates, 15000);
    });
}

printDatesAtInterval();

Promise.all(c_dl).then(() => {
    console.log("Finished downloading everything.");
});