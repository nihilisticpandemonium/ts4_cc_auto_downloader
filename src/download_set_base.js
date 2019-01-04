import { uiManager } from './ui_manager';

export class DownloadSetBase {
    #site;
    #identifier;
    #finished;

    constructor(site, identifier) {
        this.#site = site;
        this.#identifier = identifier;
        this.#finished = false;
        uiManager.registerDownloadSet(this);
    }
    _set_finished(finished) {
        this.#finished = finished;
    }
    getSite() {
        return this.#site;
    }
    getSetIdentifier() {
        return this.#identifier;
    }
    getExtraText() {
        return "";
    }
    isFinished() {
        return this.#finished;
    }
}