import { DownloadSetBase } from "./download_set_base";
import { time_format, first_date, pets_first_date, now } from "./constants";
import { sleep } from "./ts4_ad_util.js";
import { uiManager, appendLog } from "./ui_manager";
import { TSRItemDownloader } from "./tsr_item_downloader";

import levelup from "levelup";
import leveldown from "leveldown";
import axios from "axios";
import cheerio from "cheerio";
import moment, { Moment } from "moment";

const cldsdb = levelup(leveldown("./data/category_date.db"));

export class TSRDownloadSet extends DownloadSetBase {
    private base_url: string;
    private page: number;
    private date_found: boolean;
    private date: Moment;
    private waiting_downloads: number;
    private advance_date: boolean;

    constructor(category: string) {
        super("TSR", category);
        this.base_url =
            "http://thesimsresource.com/downloads/browse/category/sims4-" +
            category;
        this.page = 1;
        this.date_found = false;
        this.waiting_downloads = 0;
        this.advance_date = false;
        this.date = moment("1901-01-01", time_format);

        const gd = async () => {
            try {
                const value = await cldsdb.get(this.getSetIdentifier());
                this.date = moment(value.toString(), time_format);
                if (this.date.isAfter(now)) {
                    this.date = moment(now);
                }
            } catch (err) {
                if (this.getSetIdentifier() === "pets") {
                    this.date = moment(pets_first_date);
                } else {
                    this.date = moment(first_date);
                }
            }
            this.date_found = true;
        };
        gd();
    }
    private make_url(): Promise<string> {
        return new Promise(resolve => {
            const delay = 500;
            const f = () => {
                if (this.date_found) {
                    resolve(
                        `${this.base_url}/released/${this.date.format(
                            time_format
                        )}/page/${this.page}/skipsetitems/1`
                    );
                } else {
                    setTimeout(f, delay);
                }
            };
            f();
        });
    }
    private next_page() {
        if (this.advance_date) {
            this.date.add(1, "d");
            this.page = 1;
            cldsdb.put(this.getSetIdentifier(), this.date.format(time_format));
        } else {
            this.page++;
        }
        uiManager.markDownloadSetInfoPanelDirty();
        this.advance_date = false;
    }
    markDownloadFinished() {
        this.waiting_downloads--;
        uiManager.markDownloadSetInfoPanelDirty();
    }
    private download_page_items(h: string): Promise<void> {
        return new Promise(resolve => {
            const $ = cheerio.load(h);
            let ds = $("a[data-href]");
            this.waiting_downloads = ds.length;
            uiManager.markDownloadSetInfoPanelDirty();
            const dp: Promise<void>[] = [];
            ds.each(d => {
                let dh = ds[d].attribs["data-href"];
                let ddl = new TSRItemDownloader(this, dh);
                dp.push(ddl.download());
            });
            this.advance_date = ds.length <= 21;
            const z = async () => {
                await Promise.all(dp);
                resolve();
            };
            z();
        });
    }
    private download_page(): Promise<boolean> {
        return new Promise(resolve => {
            var k = setTimeout(() => resolve(false), 45000);
            const dl = async () => {
                let u = await this.make_url();
                uiManager.markDownloadSetInfoPanelDirty();
                appendLog(
                    this.getSetIdentifier() +
                        ": " +
                        this.date.format(time_format)
                );
                const r = await axios.get(u);
                clearTimeout(k);

                await this.download_page_items(r.data);
                resolve(true);
            };
            dl();
        });
    }
    download(): Promise<void> {
        const dp = async (): Promise<void> => {
            let r = false;
            while (!r) {
                // eslint-disable-next-line no-await-in-loop
                r = await this.download_page();
            }
            23;
            await sleep(2000);

            this.next_page();

            if (this.date.isAfter(now)) {
                this.set_finished(true);
                return;
            } else {
                return dp();
            }
        };
        return dp();
    }
    getExtraText(): string {
        if (this.date_found) {
            return (
                ": " +
                this.date.format(time_format) +
                " [Downloading: " +
                this.waiting_downloads +
                "]"
            );
        } else {
            return "";
        }
    }
}
