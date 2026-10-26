import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { Deck, TextElement } from "../../../types";
import { defaultTheme } from "../../../theme/default-theme";
import { DeckEditor, type DeckZoom } from "../index";

/*
 * MOIC embeds the editor in a narrow panel. The canvas fits the slide to the
 * panel, so on a ~370 px canvas a 10.5pt title drew about 5 px tall. Zoom is a
 * VIEW state: it changes how big the slide is drawn, never the deck.
 *
 * The slide is laid out at the zoomed width (not CSS-transformed), so a screen
 * pixel inside it is always `1 / renderedWidth` of the slide and the drag math
 * stays exact. The drag tests below pin that.
 */

const DESIGN_WIDTH = defaultTheme.slideWidth ?? 1920;

// ─── A ResizeObserver we can drive ───────────────────────────────────────────

type Observed = { cb: ResizeObserverCallback; targets: Element[]; self: ResizeObserver };
let observers: Observed[] = [];
const RealRO = globalThis.ResizeObserver;

beforeEach(() => {
    observers = [];
    globalThis.ResizeObserver = class {
        private rec: Observed;
        constructor(cb: ResizeObserverCallback) {
            this.rec = { cb, targets: [], self: this as unknown as ResizeObserver };
            observers.push(this.rec);
        }
        observe(el: Element) {
            this.rec.targets.push(el);
        }
        unobserve() {}
        disconnect() {
            this.rec.targets = [];
        }
    } as unknown as typeof ResizeObserver;
    // jsdom has no PointerEvent (so fireEvent.pointer* would drop clientX) and
    // no pointer capture.
    if (typeof globalThis.PointerEvent === "undefined") {
        globalThis.PointerEvent = class extends MouseEvent {
            pointerId: number;
            constructor(type: string, init: PointerEventInit = {}) {
                super(type, init);
                this.pointerId = init.pointerId ?? 0;
            }
        } as unknown as typeof PointerEvent;
    }
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
});

afterEach(() => {
    cleanup();
    globalThis.ResizeObserver = RealRO;
});

/** Tell the canvas how much room it has (its content box, padding excluded). */
function sizeCanvas(container: HTMLElement, width: number, height = 400) {
    const scroller = canvas(container);
    act(() => {
        for (const o of observers) {
            if (!o.targets.includes(scroller)) continue;
            o.cb([{ target: scroller, contentRect: { width, height } } as unknown as ResizeObserverEntry], o.self);
        }
    });
}

function canvas(container: HTMLElement) {
    const el = container.querySelector("[data-fancy-slides-canvas]") as HTMLElement | null;
    if (!el) throw new Error("no [data-fancy-slides-canvas]");
    return el;
}

function scale(container: HTMLElement) {
    return Number(canvas(container).getAttribute("data-fancy-slides-zoom-scale"));
}

function slideEl(container: HTMLElement) {
    return container.querySelector("[data-fancy-slides-slide]") as HTMLElement;
}

function zoomSelect(container: HTMLElement) {
    const wrap = container.querySelector("[data-fancy-slides-zoom-control]") as HTMLElement | null;
    if (!wrap) throw new Error("no [data-fancy-slides-zoom-control]");
    const select = wrap.querySelector("select");
    if (!select) throw new Error("zoom control has no <select>");
    return select as HTMLSelectElement;
}

function makeDeck(): Deck {
    return {
        id: "deck1",
        title: "Zoom",
        theme: defaultTheme,
        slides: [
            {
                id: "s1",
                layout: "blank",
                elements: [
                    { id: "el1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0.2, content: "Title", format: "plain", style: {} } as TextElement,
                ],
                notes: "",
            },
        ],
    };
}

function Host(props: Omit<React.ComponentProps<typeof DeckEditor>, "value" | "onChange"> & { spy?: (d: Deck) => void }) {
    const { spy, ...rest } = props;
    const [deck, setDeck] = useState<Deck>(makeDeck());
    return (
        <DeckEditor
            value={deck}
            onChange={(d) => {
                spy?.(d);
                setDeck(d);
            }}
            hideRail
            hideInspector
            hideNotes
            {...rest}
        />
    );
}

// ─── Scale per mode ──────────────────────────────────────────────────────────

describe("DeckEditor zoom — canvas scale", () => {
    it("defaults to fit, and fit keeps the existing layout", () => {
        const { container } = render(<Host />);
        sizeCanvas(container, 370);
        expect(canvas(container).getAttribute("data-fancy-slides-zoom")).toBe("fit");
        // The pre-zoom frame: 96% of the room, never wider than 1280 px.
        const frame = slideEl(container).parentElement as HTMLElement;
        expect(frame.style.width).toBe("min(96%, 1280px)");
        expect(scale(container)).toBeCloseTo((370 * 0.96) / DESIGN_WIDTH, 4);
    });

    it("fit caps at 1280 px in a wide canvas", () => {
        const { container } = render(<Host />);
        sizeCanvas(container, 3000);
        expect(scale(container)).toBeCloseTo(1280 / DESIGN_WIDTH, 4);
    });

    it("fit-width fills the whole width, uncapped", () => {
        const { container } = render(<Host defaultZoom="fit-width" />);
        sizeCanvas(container, 370);
        expect(scale(container)).toBeCloseTo(370 / DESIGN_WIDTH, 4);
        expect(slideEl(container).style.width).toBe("370px");
    });

    it("100% draws the slide at its design size", () => {
        const { container } = render(<Host defaultZoom={1} />);
        sizeCanvas(container, 370);
        expect(scale(container)).toBe(1);
        expect(slideEl(container).style.width).toBe(`${DESIGN_WIDTH}px`);
    });

    it("200% draws it at twice its design size", () => {
        const { container } = render(<Host defaultZoom={2} />);
        sizeCanvas(container, 370);
        expect(scale(container)).toBe(2);
        expect(slideEl(container).style.width).toBe(`${DESIGN_WIDTH * 2}px`);
    });

    it("100% overflows a narrow canvas, and the canvas scrolls from the slide's edge", () => {
        const { container } = render(<Host defaultZoom={1} />);
        sizeCanvas(container, 370);
        const c = canvas(container);
        expect(c.className).toContain("overflow-auto");
        // Flex centring would push the left of an oversized slide out of reach;
        // zoomed, the frame centres with margin:auto instead, which scrolls.
        expect(c.className).not.toContain("justify-center");
        const frame = slideEl(container).parentElement as HTMLElement;
        expect(frame.style.margin).toBe("auto");
        expect(frame.style.flexShrink).toBe("0");
        expect(parseFloat(frame.style.width)).toBeGreaterThan(370);
    });
});

// ─── Controlled / uncontrolled ───────────────────────────────────────────────

describe("DeckEditor zoom — state", () => {
    it("uncontrolled: the toolbar control changes the zoom", () => {
        const onZoomChange = vi.fn();
        const { container } = render(<Host onZoomChange={onZoomChange} />);
        sizeCanvas(container, 370);
        fireEvent.change(zoomSelect(container), { target: { value: "2" } });
        expect(onZoomChange).toHaveBeenLastCalledWith(2);
        expect(scale(container)).toBe(2);
        expect(zoomSelect(container).value).toBe("2");
    });

    it("offers fit, fit-width and 50 / 75 / 100 / 150 / 200 %", () => {
        const { container } = render(<Host />);
        const values = Array.from(zoomSelect(container).options).map((o) => o.value);
        expect(values).toEqual(expect.arrayContaining(["fit", "fit-width", "0.5", "0.75", "1", "1.5", "2"]));
    });

    it("controlled: reports the request, renders what the host says", () => {
        const onZoomChange = vi.fn();
        function Controlled() {
            const [deck, setDeck] = useState<Deck>(makeDeck());
            return <DeckEditor value={deck} onChange={setDeck} zoom="fit" onZoomChange={onZoomChange} hideRail hideInspector hideNotes />;
        }
        const { container } = render(<Controlled />);
        sizeCanvas(container, 370);
        fireEvent.change(zoomSelect(container), { target: { value: "1.5" } });
        expect(onZoomChange).toHaveBeenLastCalledWith(1.5);
        expect(canvas(container).getAttribute("data-fancy-slides-zoom")).toBe("fit");
    });

    it("controlled: follows the prop", () => {
        function Controlled({ zoom }: { zoom: DeckZoom }) {
            const [deck, setDeck] = useState<Deck>(makeDeck());
            return <DeckEditor value={deck} onChange={setDeck} zoom={zoom} hideRail hideInspector hideNotes />;
        }
        const { container, rerender } = render(<Controlled zoom="fit" />);
        sizeCanvas(container, 370);
        rerender(<Controlled zoom={0.75} />);
        expect(scale(container)).toBe(0.75);
        expect(zoomSelect(container).value).toBe("0.75");
    });

    it("zoom changes NEVER call onChange (control, keyboard)", () => {
        const spy = vi.fn();
        const { container } = render(<Host spy={spy} />);
        sizeCanvas(container, 370);
        fireEvent.change(zoomSelect(container), { target: { value: "2" } });
        const root = container.querySelector("[data-fancy-slides-editor]") as HTMLElement;
        fireEvent.keyDown(root, { key: "=", ctrlKey: true });
        fireEvent.keyDown(root, { key: "-", metaKey: true });
        fireEvent.keyDown(root, { key: "0", ctrlKey: true });
        expect(spy).not.toHaveBeenCalled();
    });
});

// ─── Keyboard ────────────────────────────────────────────────────────────────

describe("DeckEditor zoom — keyboard", () => {
    it("Ctrl/Cmd + = and - step through the presets; Ctrl/Cmd + 0 returns to fit", () => {
        const onZoomChange = vi.fn();
        const { container } = render(<Host defaultZoom={1} onZoomChange={onZoomChange} />);
        sizeCanvas(container, 370);
        const root = container.querySelector("[data-fancy-slides-editor]") as HTMLElement;
        fireEvent.keyDown(root, { key: "=", ctrlKey: true });
        expect(scale(container)).toBe(1.5);
        fireEvent.keyDown(root, { key: "-", metaKey: true });
        fireEvent.keyDown(root, { key: "-", metaKey: true });
        expect(scale(container)).toBe(0.75);
        fireEvent.keyDown(root, { key: "0", ctrlKey: true });
        expect(canvas(container).getAttribute("data-fancy-slides-zoom")).toBe("fit");
        expect(onZoomChange).toHaveBeenLastCalledWith("fit");
    });

    it("steps from fit relative to the scale fit is drawing at", () => {
        const { container } = render(<Host />);
        sizeCanvas(container, 370); // fit ≈ 18.5 %
        const root = container.querySelector("[data-fancy-slides-editor]") as HTMLElement;
        fireEvent.keyDown(root, { key: "=", ctrlKey: true });
        expect(scale(container)).toBe(0.25);
    });

    /*
     * A real browser, on mousedown, focuses the nearest FOCUSABLE ancestor of
     * what was pressed, or the body if there is none. jsdom does not, so this
     * does it the browser's way. The keystroke then goes where the browser
     * would send it: document.activeElement. Measured in Chromium: nothing in
     * the canvas was focusable, a click left focus on BODY, and Ctrl+= zoomed
     * the PAGE instead of the canvas.
     */
    const FOCUSABLE = 'input, select, textarea, button, a[href], [tabindex], [contenteditable=""], [contenteditable="true"]';
    function clickLikeABrowser(target: HTMLElement) {
        fireEvent.pointerDown(target, { clientX: 5, clientY: 5, pointerId: 9 });
        const focusable = target.closest(FOCUSABLE) as HTMLElement | null;
        if (focusable) focusable.focus();
        else (document.activeElement as HTMLElement | null)?.blur();
        fireEvent.pointerUp(target, { clientX: 5, clientY: 5, pointerId: 9 });
        fireEvent.click(target);
    }
    function pressInFocus(init: KeyboardEventInit) {
        fireEvent.keyDown(document.activeElement ?? document.body, init);
    }

    it("a click on a slide element puts focus in the editor, so Ctrl+= zooms the canvas", () => {
        const { container } = render(<Host />);
        sizeCanvas(container, 370);
        clickLikeABrowser(container.querySelector('[data-fancy-slides-element="el1"]') as HTMLElement);
        const root = container.querySelector("[data-fancy-slides-editor]") as HTMLElement;
        expect(root.contains(document.activeElement)).toBe(true);
        pressInFocus({ key: "=", ctrlKey: true });
        expect(canvas(container).getAttribute("data-fancy-slides-zoom")).toBe("0.25");
    });

    it("a click on the empty canvas does the same", () => {
        const { container } = render(<Host />);
        sizeCanvas(container, 370);
        clickLikeABrowser(canvas(container));
        pressInFocus({ key: "=", ctrlKey: true });
        expect(canvas(container).getAttribute("data-fancy-slides-zoom")).toBe("0.25");
    });

    it("a click inside an inline text edit keeps focus in the text, and plain typing is not hijacked", () => {
        const { container } = render(<Host />);
        sizeCanvas(container, 370);
        const el = container.querySelector('[data-fancy-slides-element="el1"]') as HTMLElement;
        clickLikeABrowser(el); // selecting a text element swaps in the inline rich-text editor
        const text = el.querySelector('[contenteditable="true"], [contenteditable=""]') as HTMLElement | null;
        expect(text).not.toBeNull();
        clickLikeABrowser(text!);
        // The canvas is focusable now, but the text is nearer: it keeps focus.
        expect(document.activeElement).toBe(text);
        const ev = new KeyboardEvent("keydown", { key: "0", bubbles: true, cancelable: true });
        text!.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(false);
        expect(canvas(container).getAttribute("data-fancy-slides-zoom")).toBe("fit");
    });

    it("the canvas takes focus without a focus ring and stays out of the tab order", () => {
        const { container } = render(<Host />);
        const c = canvas(container);
        expect(c.getAttribute("tabindex")).toBe("-1");
        expect(c.className).toContain("outline-none");
    });

    it("leaves the keys alone without a modifier (typing '0' in a text box)", () => {
        const onZoomChange = vi.fn();
        const { container } = render(<Host defaultZoom={1} onZoomChange={onZoomChange} />);
        const root = container.querySelector("[data-fancy-slides-editor]") as HTMLElement;
        fireEvent.keyDown(root, { key: "0" });
        fireEvent.keyDown(root, { key: "=" });
        expect(onZoomChange).not.toHaveBeenCalled();
    });
});

// ─── Pointer math ────────────────────────────────────────────────────────────

describe("DeckEditor zoom — dragging stays in slide coordinates", () => {
    const N = 200; // screen pixels dragged

    it.each([
        [0.5, N * 2],
        [1, N],
        [2, N / 2],
    ])("at %sx, dragging %i screen px moves the element by the right design px", (zoom, designPx) => {
        const spy = vi.fn();
        const { container } = render(<Host defaultZoom={zoom} spy={spy} />);
        sizeCanvas(container, 370);
        const el = container.querySelector('[data-fancy-slides-element="el1"]') as HTMLElement;
        fireEvent.pointerDown(el, { clientX: 100, clientY: 100, pointerId: 1 });
        fireEvent.pointerMove(el, { clientX: 100 + N, clientY: 100, pointerId: 1 });
        fireEvent.pointerUp(el, { clientX: 100 + N, clientY: 100, pointerId: 1 });

        const last = spy.mock.lastCall?.[0] as Deck;
        const moved = last.slides[0]!.elements.find((e) => e.id === "el1")!;
        expect((moved.x - 0.1) * DESIGN_WIDTH).toBeCloseTo(designPx, 6);
        expect(moved.y).toBeCloseTo(0.1, 6);
    });

    it("resizing at 200% converts the handle delta the same way", () => {
        const spy = vi.fn();
        const { container } = render(<Host defaultZoom={2} spy={spy} />);
        sizeCanvas(container, 370);
        const el = container.querySelector('[data-fancy-slides-element="el1"]') as HTMLElement;
        // Click selects (no movement), which shows the handles.
        fireEvent.pointerDown(el, { clientX: 10, clientY: 10, pointerId: 1 });
        fireEvent.pointerUp(el, { clientX: 10, clientY: 10, pointerId: 1 });
        const handle = container.querySelector('[data-fancy-slides-resize-handle="e"]') as HTMLElement;
        expect(handle).not.toBeNull();
        fireEvent.pointerDown(handle, { clientX: 500, clientY: 10, pointerId: 2 });
        fireEvent.pointerMove(handle, { clientX: 500 + N, clientY: 10, pointerId: 2 });
        fireEvent.pointerUp(handle, { clientX: 500 + N, clientY: 10, pointerId: 2 });
        const last = spy.mock.lastCall?.[0] as Deck;
        const resized = last.slides[0]!.elements.find((e) => e.id === "el1")!;
        expect((resized.w - 0.3) * DESIGN_WIDTH).toBeCloseTo(N / 2, 6);
    });
});

// ─── Rail unaffected ────────────────────────────────────────────────────────

describe("DeckEditor zoom — rail", () => {
    it("does not resize the rail thumbnails", () => {
        function WithRail({ zoom }: { zoom: DeckZoom }) {
            const [deck, setDeck] = useState<Deck>(makeDeck());
            return <DeckEditor value={deck} onChange={setDeck} zoom={zoom} hideInspector hideNotes />;
        }
        const { container, rerender } = render(<WithRail zoom="fit" />);
        const thumbs = () =>
            Array.from(container.querySelectorAll("[data-fancy-slides-slide]"))
                .filter((s) => !canvas(container).contains(s))
                .map((s) => (s as HTMLElement).getAttribute("style"));
        const before = thumbs();
        expect(before.length).toBeGreaterThan(0);
        rerender(<WithRail zoom={2} />);
        expect(thumbs()).toEqual(before);
    });
});
