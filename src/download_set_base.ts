import { uiManager } from "./ui_manager";
import { UIListElement } from "./ui_list_element";

export abstract class DownloadSetBase extends UIListElement {
    private site: string;
    private identifier: string;
    private finished: boolean;

    constructor(site: string, identifier: string) {
        super();
        this.site = site;
        this.identifier = identifier;
        this.finished = false;
        uiManager.registerDownloadSet(this);
    }
    protected set_finished(finished: boolean): void {
        this.finished = finished;
    }
    getSite(): string {
        return this.site;
    }
    getSetIdentifier(): string {
        return this.identifier;
    }
    abstract getExtraText(): string;

    isFinished(): boolean {
        return this.finished;
    }
}
