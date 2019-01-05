import util from "util";
import su from 'short-uuid';
import fs from "fs";
import axios, { AxiosResponse } from "axios";
import { DownloadSetBase } from "./download_set_base.js";
import { UIListElement } from "./ui_list_element.js";
import progress from 'progress-stream';
import { uiManager, appendLog } from './ui_manager';

require("./string_extensions");

function uuid() {
    return su.generate();
}

async function writeBinaryDataToFile(
    id: ItemDownloaderBase,
    response: AxiosResponse
) {
    var prg = progress({
        length: parseInt(response.headers['content-length'], 10),
        time: 100
    });

    prg.on('progress', (p: any) => {
        id.setDownloadProgress(p.percentage / 100);
        uiManager.markCurrentlyDownloadingInfoPanelDirty();
    });

    return new Promise(resolve => {
        const out = fs.createWriteStream(id.getFullDestination());
        out.on('finish', () => {
            id.setDownloadProgress(1);
            resolve();
        })
        response.data.pipe(prg).pipe(out);
    });
}

const access = util.promisify(fs.access);
const close = util.promisify(fs.close);

export abstract class ItemDownloaderBase extends UIListElement {
    private owner: DownloadSetBase;
    private url: string;
    private id: string;
    private destination: string;
    private fullDestination: string;
    private downloadProgress: number;
    private saving: boolean;
    protected stage: string;

    constructor(owner: DownloadSetBase, url: string) {
        super();
        this.owner = owner;
        this.url = url;
        this.id = uuid();
        this.downloadProgress = 0;
        this.stage = "Init";
        this.destination = "unknown";
        this.fullDestination = "";
        this.saving = false;
    }
    getId(): string {
        return this.id;
    }
    getOwner(): DownloadSetBase {
        return this.owner;
    }
    getUrl(): string {
        return this.url;
    }
    getStage(): string {
        return this.stage;
    }
    getDestination(): string {
        return this.destination;
    }
    getFullDestination(): string {
        return this.fullDestination;
    }
    abstract download(): Promise<void>;

    abstract getSavePath(): string;

    getDownloadProgress(): number {
        return this.downloadProgress;
    }
    setDownloadProgress(progress: number): void {
        this.downloadProgress = progress;
    }
    getSaving(): boolean {
        return this.saving;
    }
    setSaving(s: boolean): void {
        this.saving = s;
        uiManager.markCurrentlyDownloadingInfoPanelDirty();
    }

    protected save_if_needed(url: string, fn: string): Promise<void> {
        const _z = async () => {
            var s = false;
            const fn_s = fn.scrubFilename();

            this.stage = "Checking";
            const dest = `${uiManager.getDownloadBaseDestination()}/${this.getSavePath()}/${fn_s}`;
            this.destination = fn_s;
            this.fullDestination = dest;
            try {
                await access(dest);
            } catch (err) {
                this.stage = "Saving";
                this.setSaving(true);
                uiManager.markCurrentlyDownloadingInfoPanelDirty();
                try {
                    const r = await axios({
                        url,
                        method: "GET",
                        responseType: "stream"
                    });
                    await writeBinaryDataToFile(this, r);
                } catch (err) {
                    appendLog(`Had error with ${url}`);
                }
                s = true;
            }
            this.stage = s ? "Finished" : "Skipped";
            uiManager.markCurrentlyDownloadingInfoPanelDirty();
            setTimeout(() => {
                uiManager.removeCurrentlyDownloadingItem(this);
            }, 5000);
            return;
        };
        return _z();
    }
}
