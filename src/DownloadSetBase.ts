import { uiManager } from './UIManager';
import { UIListElement } from './UIListElement';
import TS4ADUtil from './TS4ADUtil';

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
  protected setFinished(finished: boolean): void {
    this.finished = finished;
  }
  public getSite(): string {
    return this.site;
  }
  public getSetIdentifier(): string {
    return this.identifier;
  }
  public abstract getExtraText(): string;

  public abstract download(): P<void>;

  public isFinished(): boolean {
    return this.finished;
  }
}
