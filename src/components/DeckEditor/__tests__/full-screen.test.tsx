import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import css from "../../../styles.css?raw";
import type { Deck, TextElement } from "../../../types";
import { defaultTheme } from "../../../theme/default-theme";
import { DeckEditor, useDeckEditor } from "../index";
import { EditorToolbar } from "../../EditorToolbar";

/*
 * MOIC embeds the editor in a narrow panel and asked for full screen. Owner's
 * ruling: Fancy provides the editors, so full screen is built in. DeckEditor
 * adopts react-fancy's `useFullScreen` (the same one `Editor` uses) rather than
 * growing its own: the root goes over the viewport in place, nothing remounts,
 * Escape leaves, focus comes back.
 *
 * jsdom has no popover API, so here the surface stays on the `position: fixed`
 * fallback (`data-fullscreen-layer="fixed"`). The top layer is checked in a
 * real browser.
 */

const DESIGN_WIDTH = defaultTheme.slideWidth ?? 1920;

// ─── A ResizeObserver we can drive (as in zoom.test.tsx) ─────────────────────

type Observed = { cb: ResizeObserverCallback; targets: Element[]; self: ResizeObserver };
let observers: Observed[] = [];
const RealRO = globalThis.ResizeObserver;

beforeAll(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
});

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
});

afterEach(() => {
    cleanup();
    globalThis.ResizeObserver = RealRO;
    document.body.style.overflow = "";
});

function root(container: HTMLElement) {
    const el = container.querySelector("[data-fancy-slides-editor]") as HTMLElement | null;
    if (!el) throw new Error("no [data-fancy-slides-editor]");
    return el;
}

function canvas(container: HTMLElement) {
    const el = container.querySelector("[data-fancy-slides-canvas]") as HTMLElement | null;
    if (!el) throw new Error("no [data-fancy-slides-canvas]");
    return el;
}

function toggle(container: HTMLElement) {
    const el = container.querySelector("[data-fancy-slides-fullscreen-toggle]") as HTMLButtonElement | null;
    if (!el) throw new Error("no [data-fancy-slides-fullscreen-toggle]");
    return el;
}

function isFull(container: HTMLElement) {
    return root(container).getAttribute("data-fullscreen") === "true";
}

function scale(container: HTMLElement) {
    return Number(canvas(container).getAttribute("data-fancy-slides-zoom-scale"));
}

function sizeCanvas(container: HTMLElement, width: number, height = 400) {
    const scroller = canvas(container);
    act(() => {
        for (const o of observers) {
            if (!o.targets.includes(scroller)) continue;
            o.cb([{ target: scroller, contentRect: { width, height } } as unknown as ResizeObserverEntry], o.self);
        }
    });
}

function makeDeck(): Deck {
    return {
        id: "deck1",
        title: "Full screen",
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

// ─── State ───────────────────────────────────────────────────────────────────

describe("DeckEditor full screen — state", () => {
    it("is off by default and the root carries the handle", () => {
        const { container } = render(<Host />);
        expect(root(container).getAttribute("data-fullscreen")).toBe("false");
        expect(root(container).style.position).toBe("");
    });

    it("uncontrolled: the toolbar toggle enters and leaves", () => {
        const onFullScreenChange = vi.fn();
        const { container } = render(<Host onFullScreenChange={onFullScreenChange} />);
        fireEvent.click(toggle(container));
        expect(isFull(container)).toBe(true);
        expect(onFullScreenChange).toHaveBeenLastCalledWith(true);
        // The overlay: fixed to the viewport, in place (not portalled).
        const r = root(container);
        expect(r.style.position).toBe("fixed");
        expect(r.style.width).toBe("100%");
        expect(r.style.height).toBe("100%");
        expect(container.contains(r)).toBe(true);
        expect(r.getAttribute("data-fullscreen-mode")).toBe("overlay");

        fireEvent.click(toggle(container));
        expect(isFull(container)).toBe(false);
        expect(onFullScreenChange).toHaveBeenLastCalledWith(false);
        expect(onFullScreenChange).toHaveBeenCalledTimes(2);
    });

    it("defaultFullScreen starts full screen", () => {
        const { container } = render(<Host defaultFullScreen />);
        expect(isFull(container)).toBe(true);
        expect(root(container).style.position).toBe("fixed");
    });

    it("controlled: reports the request and renders what the host says", () => {
        const onFullScreenChange = vi.fn();
        function Controlled({ fullScreen }: { fullScreen: boolean }) {
            const [deck, setDeck] = useState<Deck>(makeDeck());
            return (
                <DeckEditor
                    value={deck}
                    onChange={setDeck}
                    fullScreen={fullScreen}
                    onFullScreenChange={onFullScreenChange}
                    hideRail
                    hideInspector
                    hideNotes
                />
            );
        }
        const { container, rerender } = render(<Controlled fullScreen={false} />);
        fireEvent.click(toggle(container));
        expect(onFullScreenChange).toHaveBeenLastCalledWith(true);
        expect(isFull(container)).toBe(false);
        rerender(<Controlled fullScreen />);
        expect(isFull(container)).toBe(true);
        rerender(<Controlled fullScreen={false} />);
        expect(isFull(container)).toBe(false);
    });

    it("full screen is a view state: it never calls onChange", () => {
        const spy = vi.fn();
        const { container } = render(<Host spy={spy} />);
        fireEvent.click(toggle(container));
        fireEvent.keyDown(toggle(container), { key: "Escape" });
        expect(spy).not.toHaveBeenCalled();
    });

    it("fullScreenMode='native' asks the browser and falls back to the overlay when refused", async () => {
        const request = vi.fn(() => Promise.reject(new Error("denied")));
        const orig = HTMLElement.prototype.requestFullscreen;
        HTMLElement.prototype.requestFullscreen = request as unknown as typeof orig;
        try {
            const { container } = render(<Host fullScreenMode="native" />);
            await act(async () => {
                fireEvent.click(toggle(container));
            });
            expect(request).toHaveBeenCalledTimes(1);
            expect(isFull(container)).toBe(true);
            expect(root(container).getAttribute("data-fullscreen-mode")).toBe("overlay");
        } finally {
            HTMLElement.prototype.requestFullscreen = orig;
        }
    });
});

// ─── Toolbar ─────────────────────────────────────────────────────────────────

describe("DeckEditor full screen — toolbar", () => {
    it("the toggle sits right after the zoom control, with an accessible name that follows the state", () => {
        const { container } = render(<Host />);
        const t = toggle(container);
        const zoom = container.querySelector("[data-fancy-slides-zoom-control]") as HTMLElement;
        expect(zoom).not.toBeNull();
        expect(zoom.nextElementSibling).toBe(t);
        // It is react-fancy's shared toggle, so the shared handle is there too.
        expect(t.hasAttribute("data-react-fancy-fullscreen-toggle")).toBe(true);
        expect(t.getAttribute("type")).toBe("button");
        // react-fancy's toggle sets no text colour; on a dark host that leaves
        // a black icon on zinc-950. It takes the toolbar buttons' soft text.
        expect(t.className).toContain("text-[color:var(--fancy-text-soft,var(--color-zinc-700))]");
        expect(t.className).toContain("dark:text-[color:var(--fancy-text-soft-dark,var(--color-zinc-300))]");
        expect(t.getAttribute("aria-label")).toBe("Enter full screen");
        expect(t.getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(t);
        expect(toggle(container).getAttribute("aria-label")).toBe("Exit full screen");
        expect(toggle(container).getAttribute("aria-pressed")).toBe("true");
    });

    it("EditorToolbar.FullScreen adds it to a composed toolbar", () => {
        const { container } = render(
            <Host
                renderToolbar={(api) => (
                    <EditorToolbar api={api}>
                        <EditorToolbar.Title />
                        <EditorToolbar.Trailing present={false}>
                            <EditorToolbar.Zoom />
                            <EditorToolbar.FullScreen />
                        </EditorToolbar.Trailing>
                    </EditorToolbar>
                )}
            />,
        );
        fireEvent.click(toggle(container));
        expect(isFull(container)).toBe(true);
    });

    it("EditorToolbar.FullScreen renders nothing outside a DeckEditor", () => {
        const api = {
            title: { value: "", onChange: () => {} },
            theme: { name: "default", themes: [], onApply: () => {} },
            insert: { text() {}, image() {}, shape() {}, chart() {}, code() {}, table() {} },
            disabled: false,
        };
        const { container } = render(
            <EditorToolbar api={api}>
                <EditorToolbar.FullScreen />
            </EditorToolbar>,
        );
        expect(container.querySelector("[data-fancy-slides-fullscreen-toggle]")).toBeNull();
    });

    it("toolbarExtra stays in the toolbar while full screen, so a host's Save is reachable", () => {
        const onSave = vi.fn();
        const { container } = render(
            <Host
                toolbarExtra={
                    <button type="button" data-host-save="" onClick={onSave}>
                        Save
                    </button>
                }
            />,
        );
        fireEvent.click(toggle(container));
        const save = container.querySelector("[data-host-save]") as HTMLButtonElement | null;
        expect(save).not.toBeNull();
        expect(root(container).contains(save)).toBe(true);
        expect(save!.closest(".fs-toolbar")).not.toBeNull();
        fireEvent.click(save!);
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(isFull(container)).toBe(true);
    });

    it("does not add an F shortcut to the editor (that is the viewer's)", () => {
        const onFullScreenChange = vi.fn();
        const { container } = render(<Host onFullScreenChange={onFullScreenChange} />);
        fireEvent.keyDown(root(container), { key: "f" });
        fireEvent.keyDown(root(container), { key: "F" });
        expect(onFullScreenChange).not.toHaveBeenCalled();
        expect(isFull(container)).toBe(false);
    });
});

// ─── Keyboard + focus ────────────────────────────────────────────────────────

describe("DeckEditor full screen — Escape and focus", () => {
    it("Escape leaves full screen and focus goes back to where it was", () => {
        const onFullScreenChange = vi.fn();
        const { container, getByText } = render(
            <div>
                <button type="button">Open editor</button>
                <Host onFullScreenChange={onFullScreenChange} />
            </div>,
        );
        const opener = getByText("Open editor");
        opener.focus();
        fireEvent.click(toggle(container));
        // Focus moved inside, out from behind the overlay.
        expect(root(container).contains(document.activeElement)).toBe(true);
        fireEvent.keyDown(document.activeElement!, { key: "Escape" });
        expect(isFull(container)).toBe(false);
        expect(onFullScreenChange).toHaveBeenLastCalledWith(false);
        expect(document.activeElement).toBe(opener);
    });

    it("Escape with nothing focused also leaves", () => {
        const { container } = render(<Host />);
        fireEvent.click(toggle(container));
        (document.activeElement as HTMLElement | null)?.blur();
        fireEvent.keyDown(document.body, { key: "Escape" });
        expect(isFull(container)).toBe(false);
    });

    it("Escape outside full screen is left alone", () => {
        const onFullScreenChange = vi.fn();
        const { container } = render(<Host onFullScreenChange={onFullScreenChange} />);
        const ev = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
        root(container).dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(false);
        expect(onFullScreenChange).not.toHaveBeenCalled();
    });

    it("the zoom shortcuts still work in full screen (the root's key handlers are merged)", () => {
        const { container } = render(<Host />);
        sizeCanvas(container, 370);
        fireEvent.click(toggle(container));
        fireEvent.keyDown(root(container), { key: "=", ctrlKey: true });
        expect(canvas(container).getAttribute("data-fancy-slides-zoom")).toBe("0.25");
        expect(isFull(container)).toBe(true);
    });

    it("locks body scroll while full screen", () => {
        const { container } = render(<Host />);
        fireEvent.click(toggle(container));
        expect(document.body.style.overflow).toBe("hidden");
        fireEvent.click(toggle(container));
        expect(document.body.style.overflow).toBe("");
    });
});

// ─── Layout ──────────────────────────────────────────────────────────────────

describe("DeckEditor full screen — layout", () => {
    it("the root is a flex column and the canvas takes the remaining height", () => {
        const { container } = render(<Host />);
        fireEvent.click(toggle(container));
        const r = root(container);
        expect(r.className).toMatch(/\bflex\b/);
        expect(r.className).toMatch(/\bflex-col\b/);
        const c = canvas(container);
        expect(c.className).toMatch(/\bflex-1\b/);
        expect(c.className).toMatch(/\bmin-h-0\b/);
    });

    it("the bigger canvas refits: the fit zoom scale follows the new width", () => {
        const { container } = render(<Host />);
        sizeCanvas(container, 370);
        const before = scale(container);
        expect(before).toBeCloseTo((370 * 0.96) / DESIGN_WIDTH, 4);

        fireEvent.click(toggle(container));
        // The overlay gives the canvas the viewport; the observer reports it.
        sizeCanvas(container, 1100, 700);
        const after = scale(container);
        expect(after).toBeCloseTo((1100 * 0.96) / DESIGN_WIDTH, 4);
        expect(after).toBeGreaterThan(before);
        expect(canvas(container).getAttribute("data-fancy-slides-zoom")).toBe("fit");

        // And back.
        fireEvent.click(toggle(container));
        sizeCanvas(container, 370);
        expect(scale(container)).toBeCloseTo(before, 4);
    });

    it("the canvas is not remounted on entry (same element, same observer)", () => {
        const { container } = render(<Host />);
        const c = canvas(container);
        fireEvent.click(toggle(container));
        expect(canvas(container)).toBe(c);
    });
});

// ─── useDeckEditor ───────────────────────────────────────────────────────────

describe("DeckEditor full screen — useDeckEditor()", () => {
    function Probe() {
        const { fullScreen, setFullScreen } = useDeckEditor();
        return (
            <button type="button" data-probe={String(fullScreen)} onClick={() => setFullScreen(!fullScreen)}>
                probe
            </button>
        );
    }

    it("exposes fullScreen and setFullScreen to any panel", () => {
        const onFullScreenChange = vi.fn();
        const { container } = render(<Host toolbarExtra={<Probe />} onFullScreenChange={onFullScreenChange} />);
        const probe = () => container.querySelector("[data-probe]") as HTMLElement;
        expect(probe().getAttribute("data-probe")).toBe("false");
        fireEvent.click(probe());
        expect(isFull(container)).toBe(true);
        expect(probe().getAttribute("data-probe")).toBe("true");
        expect(onFullScreenChange).toHaveBeenLastCalledWith(true);
        fireEvent.click(toggle(container));
        expect(probe().getAttribute("data-probe")).toBe("false");
    });

    it("a bespoke composition spreads fullScreenTargetProps on its own root", () => {
        function Root({ children }: { children: ReactNode }) {
            const { fullScreenTargetProps } = useDeckEditor();
            return (
                <div data-bespoke="" {...fullScreenTargetProps}>
                    {children}
                </div>
            );
        }
        function Bespoke() {
            const [deck, setDeck] = useState<Deck>(makeDeck());
            return (
                <DeckEditor.Provider value={deck} onChange={setDeck}>
                    <Root>
                        <Probe />
                        <DeckEditor.Canvas />
                    </Root>
                </DeckEditor.Provider>
            );
        }
        const { container } = render(<Bespoke />);
        fireEvent.click(container.querySelector("[data-probe]") as HTMLElement);
        const b = container.querySelector("[data-bespoke]") as HTMLElement;
        expect(b.getAttribute("data-fullscreen")).toBe("true");
        expect(b.style.position).toBe("fixed");
    });
});

// ─── Dark surround ───────────────────────────────────────────────────────────

/** Nearest ancestor-or-self value of a custom property (CSS inheritance). */
function inherited(el: Element, name: string): string {
    for (let n: Element | null = el; n; n = n.parentElement) {
        const v = getComputedStyle(n).getPropertyValue(name).trim();
        if (v) return v;
    }
    return "";
}

function resolveVar(value: string, el: Element): string {
    const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]*))?\)$/.exec(value.trim());
    if (!m) return value.trim();
    const own = inherited(el, m[1]!);
    if (own) return resolveVar(own, el);
    return m[2] !== undefined ? resolveVar(m[2], el) : "";
}

describe("DeckEditor full screen — dark surround", () => {
    it.each([
        ["dark-class", { className: "dark" }],
        ["dark-attr", { "data-theme": "dark" }],
    ] as const)("in a %s host the canvas surround stays dark while full screen", (_mode, attrs) => {
        const { container } = render(
            <div {...attrs}>
                <Host />
            </div>,
        );
        fireEvent.click(toggle(container));
        expect(isFull(container)).toBe(true);
        const c = canvas(container);
        expect(resolveVar(c.style.background, c).toLowerCase()).toBe("#09090b");
    });
});
