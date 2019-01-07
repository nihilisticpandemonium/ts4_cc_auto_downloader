import { Widgets } from 'blessed';

export abstract class UIListElement {
  private element: Widgets.BlessedElement;
  public setElement(e: Widgets.BlessedElement) {
    this.element = e;
  }
  public getElement(): Widgets.BlessedElement {
    return this.element;
  }
}
