// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PresenterView } from "../PresenterView";
import type { Deck } from "../../../types";

/*
 * The presenter's chrome is readable on its own dark ground.
 *
 * The status-bar labels ("Slide", "Elapsed", "Clock") were the foreground at
 * 40% alpha on #0b1220: 3.7:1 at 10px (axe color-contrast, lab run 601, K31).
 * "End of deck" and "No notes for this slide." used 40% and 35% the same way.
 * This composites every translucent text colour the view sets over its
 * background and holds each to 4.5:1.
 */

afterEach(cleanup);

const BG: [number, number, number] = [0x0b, 0x12, 0x20];

const deck: Deck = {
    id: "d",
    title: "Ops review",
    slides: [{ id: "s0", elements: [] }],
} as unknown as Deck;

function channel(c: number) {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function lum([r, g, b]: number[]) {
    return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

/** Parse an inline colour and composite it over the presenter background. */
function composite(css: string): number[] | null {
    const m = /rgba?\(([^)]+)\)/.exec(css);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]!.split(",").map((x) => Number(x.trim()));
    return [r!, g!, b!].map((c, i) => c * a! + BG[i]! * (1 - a!));
}

describe("PresenterView contrast", () => {
    it("keeps every translucent text colour at 4.5:1 or better", () => {
        const { container } = render(<PresenterView deck={deck} />);
        const bg = lum(BG);
        const offenders: string[] = [];
        let checked = 0;

        for (const el of container.querySelectorAll<HTMLElement>("[style]")) {
            const text = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
            if (!text || !el.style.color) continue;
            const fg = composite(el.style.color);
            if (!fg) continue;
            checked++;
            const l = lum(fg);
            const ratio = (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05);
            if (ratio < 4.5) offenders.push(`${el.textContent?.trim()} (${el.style.color}) ${ratio.toFixed(2)}`);
        }

        // Slide / Elapsed / Clock labels, End of deck, the no-notes line at least.
        expect(checked).toBeGreaterThanOrEqual(5);
        expect(offenders).toEqual([]);
    });
});
