// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import css from "../../../styles.css?raw";
import { SlideViewer } from "../SlideViewer";
import { DeckEditor } from "../../DeckEditor";
import { defaultTheme } from "../../../theme/default-theme";
import type { Deck } from "../../../types";

/*
 * MOIC, in a dark dialog: `frameProps={{ variant: 'bare', fill: true }}`. The
 * frame went dark, but the letterbox around the slide was painted with the
 * DECK's background (#FFFFFF), so a white band surrounded a white slide and
 * its edges vanished. The surround belongs to the host; the slide to the deck.
 *
 * jsdom applies a stylesheet's custom properties to the elements its rules
 * match, but neither inherits them nor resolves var(). `resolve` does both, the
 * way a browser would, so the assertion is on the colour that gets painted.
 */

const LIGHT_SURFACE = "#f4f4f5"; // zinc-100
const DARK_SURFACE = "#09090b"; // zinc-950
const DECK_BG = "#ffffff";

beforeAll(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
});

afterEach(cleanup);

/** Nearest ancestor-or-self value of a custom property (CSS inheritance). */
function inherited(el: Element, name: string): string {
    for (let n: Element | null = el; n; n = n.parentElement) {
        const v = getComputedStyle(n).getPropertyValue(name).trim();
        if (v) return v;
    }
    return "";
}

/** Resolve `var(--a, var(--b, #fff))` against `el`, the way the browser would. */
function resolve(value: string, el: Element): string {
    const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]*))?\)$/.exec(value.trim());
    if (!m) return value.trim();
    const own = inherited(el, m[1]!);
    if (own) return resolve(own, el);
    return m[2] !== undefined ? resolve(m[2], el) : "";
}

function painted(el: HTMLElement): string {
    const v = resolve(el.style.background || el.style.backgroundColor, el).toLowerCase();
    // jsdom serialises a literal colour as rgb(); compare in hex.
    const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(v);
    return rgb ? "#" + rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("") : v;
}

const deck: Deck = {
    id: "d",
    title: "Board pack",
    theme: { ...defaultTheme, colors: { ...defaultTheme.colors, background: DECK_BG } },
    slides: [{ id: "s1", elements: [] }],
} as unknown as Deck;

function Host({ mode, children }: { mode: "light" | "dark-class" | "dark-attr"; children: React.ReactNode }) {
    if (mode === "dark-class") return <div className="dark">{children}</div>;
    if (mode === "dark-attr") return <div data-theme="dark">{children}</div>;
    return <div>{children}</div>;
}

describe("SlideViewer surround", () => {
    it("loaded the real stylesheet (the harness is measuring something)", () => {
        expect(css).toContain("--fs-stage-surface");
    });

    it.each([
        ["light", LIGHT_SURFACE],
        ["dark-class", DARK_SURFACE],
        ["dark-attr", DARK_SURFACE],
    ] as const)("in a %s host the letterbox is the host surface, not the deck background", (mode, expected) => {
        const { container } = render(
            <Host mode={mode}>
                <SlideViewer deck={deck} frameProps={{ variant: "bare", fill: true }} />
            </Host>,
        );
        const viewer = container.querySelector("[data-fancy-slides-viewer]") as HTMLElement;
        expect(painted(viewer)).toBe(expected);
        expect(painted(viewer)).not.toBe(DECK_BG);
    });

    it.each(["light", "dark-class", "dark-attr"] as const)("in a %s host the slide keeps the deck background", (mode) => {
        const { container } = render(
            <Host mode={mode}>
                <SlideViewer deck={deck} frameProps={{ variant: "bare", fill: true }} />
            </Host>,
        );
        const slide = container.querySelector("[data-fancy-slides-slide]") as HTMLElement;
        expect(painted(slide)).toBe(DECK_BG);
    });

    it("can be re-pointed by the host with --fs-stage-surface", () => {
        const { container } = render(
            <div style={{ ["--fs-stage-surface" as string]: "#123456" } as React.CSSProperties}>
                <SlideViewer deck={deck} frame={false} />
            </div>,
        );
        const viewer = container.querySelector("[data-fancy-slides-viewer]") as HTMLElement;
        expect(painted(viewer)).toBe("#123456");
    });
});

describe("DeckEditor canvas surround", () => {
    it.each([
        ["light", LIGHT_SURFACE],
        ["dark-class", DARK_SURFACE],
        ["dark-attr", DARK_SURFACE],
    ] as const)("in a %s host the canvas surround is the host surface; the slide keeps the deck's", (mode, expected) => {
        const { container } = render(
            <Host mode={mode}>
                <DeckEditor value={deck} onChange={() => {}} hideRail hideInspector hideNotes />
            </Host>,
        );
        const canvas = container.querySelector("[data-fancy-slides-canvas]") as HTMLElement;
        expect(painted(canvas)).toBe(expected);
        const slide = canvas.querySelector("[data-fancy-slides-slide]") as HTMLElement;
        expect(painted(slide)).toBe(DECK_BG);
    });
});
