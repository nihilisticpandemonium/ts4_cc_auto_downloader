import { Widgets } from 'blessed';

export abstract class UIListElement {
    private element: Widgets.BlessedElement;
    setElement(e: Widgets.BlessedElement) {
        this.element = e;
    }
    getElement(): Widgets.BlessedElement {
        return this.element;
    }
}
