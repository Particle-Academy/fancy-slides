// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import css from "../../../styles.css?raw";
import { SlideViewer } from "../SlideViewer";
import { DeckFileView } from "../DeckFileView";
import type { Deck } from "../../../types";

/*
 * The viewer root is `tabIndex={0}` — it is where the arrow keys land — and a
 * keyboard user tabbing to it saw nothing at all: `styles.css` shipped
 * `.fs-viewer:focus { outline: none }` and nothing put a ring back. Measured in
 * Chromium with real Tab presses at 375 / 768 / 1280 px: the focused viewer's
 * computed outline-style was `none` and it had no box-shadow.
 *
 * jsdom does not evaluate `:focus-visible`, so this reads the cascade the way a
 * browser would build it: every style rule in the document (the package
 * stylesheet plus whatever the component injects), matched against the real
 * rendered element with the focus pseudo-class stripped off.
 */

beforeAll(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
});

afterEach(cleanup);

const deck = {
    id: "d",
    title: "Board pack",
    slides: [{ id: "s1", elements: [] }],
} as unknown as Deck;

function styleRules(): CSSStyleRule[] {
    const out: CSSStyleRule[] = [];
    const walk = (rules: CSSRuleList) => {
        for (const r of Array.from(rules)) {
            if ("selectorText" in r) out.push(r as CSSStyleRule);
            else if ("cssRules" in r) walk((r as CSSGroupingRule).cssRules);
        }
    };
    for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules);
    return out;
}

/** Split a selector list on its TOP-LEVEL commas (not those inside :where()). */
function selectors(list: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of list) {
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (ch === "," && depth === 0) {
            out.push(cur.trim());
            cur = "";
        } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

/** Rules that apply to `el` when it is focused by keyboard. */
function focusVisibleRules(el: Element): CSSStyleRule[] {
    return styleRules().filter((r) =>
        selectors(r.selectorText).some(
            (s) => s.includes(":focus-visible") && !s.includes(":not(:focus-visible)") && el.matches(s.replace(/:focus-visible/g, "")),
        ),
    );
}

/** Rules that apply to `el` on ANY focus, keyboard included. */
function anyFocusRules(el: Element): CSSStyleRule[] {
    return styleRules().filter((r) =>
        selectors(r.selectorText).some(
            (s) => /:focus(?![-\w])/.test(s) && !s.includes(":not(:focus-visible)") && el.matches(s.replace(/:focus(?![-\w])/g, "")),
        ),
    );
}

function expectVisibleRing(viewer: HTMLElement, token: string) {
    const rules = focusVisibleRules(viewer);
    const ring = rules.find(
        (r) =>
            r.style.getPropertyValue("outline-style") === "solid" &&
            parseFloat(r.style.getPropertyValue("outline-width")) > 0 &&
            r.style.getPropertyValue("outline-color").includes(token),
    );
    expect(ring, `no :focus-visible outline using ${token} applies to the viewer`).toBeDefined();
}

function expectNotSuppressedOnKeyboardFocus(viewer: HTMLElement) {
    for (const r of anyFocusRules(viewer)) {
        expect(r.style.getPropertyValue("outline-style"), r.cssText).not.toBe("none");
        expect(r.style.getPropertyValue("outline"), r.cssText).not.toBe("none");
    }
}

describe("SlideViewer keyboard focus is visible", () => {
    it("loaded the real stylesheet (the harness is measuring something)", () => {
        expect(css).toContain(".fs-viewer");
    });

    it("the focusable viewer root draws the kit focus ring on :focus-visible", () => {
        const { container } = render(<SlideViewer deck={deck} frame={false} />);
        const viewer = container.querySelector("[data-fancy-slides-viewer]") as HTMLElement;
        expect(viewer.tabIndex).toBe(0);
        expectVisibleRing(viewer, "--fancy-focus");
    });

    it("no rule hides the outline on keyboard focus (mouse focus may stay ringless)", () => {
        const { container } = render(<SlideViewer deck={deck} frame={false} />);
        const viewer = container.querySelector("[data-fancy-slides-viewer]") as HTMLElement;
        expectNotSuppressedOnKeyboardFocus(viewer);
    });

    it.each([
        ["class", { className: "dark" }],
        ["attribute", { "data-theme": "dark" }],
    ] as const)("in a dark host (%s) the ring uses the dark focus token", (_, attrs) => {
        const { container } = render(
            <div {...attrs}>
                <SlideViewer deck={deck} frame={false} />
            </div>,
        );
        const viewer = container.querySelector("[data-fancy-slides-viewer]") as HTMLElement;
        const dark = focusVisibleRules(viewer).find((r) =>
            r.style.getPropertyValue("outline-color").includes("--fancy-focus-dark"),
        );
        expect(dark).toBeDefined();
    });

    it("DeckFileView's viewer (framed) gets the same ring", () => {
        const { container } = render(<DeckFileView document={deck} filename="review.pptx" />);
        const viewer = container.querySelector("[data-fancy-slides-viewer]") as HTMLElement;
        expectVisibleRing(viewer, "--fancy-focus");
        expectNotSuppressedOnKeyboardFocus(viewer);
    });
});
