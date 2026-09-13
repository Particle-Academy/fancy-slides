// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ShapeElementRenderer, cornerRadius } from "../ShapeElement";
import type { ShapeElement } from "../../../../types";

/**
 * A `rounded-rect`'s `radius` is a length in design pixels, on both axes.
 *
 * It was drawn as `rx = ry = radius` inside the shape's 0..100 viewBox, which is
 * stretched to the box with `preserveAspectRatio="none"`. That made `radius` a
 * PERCENTAGE of the box on each axis: `8` on a wide box drew a long, flat
 * elliptical corner, and a narrow box of the same radius looked different
 * again. The type said px, and `@particle-academy/dark-slide` writes it to
 * PowerPoint as px, so one deck rounded two ways.
 *
 * Numbers below: a 1920 design canvas rendered 960px wide (scale 0.5), 16:9, so
 * the slide is 960 x 540 and a 0.3 x 0.2 box is 288 x 108 px.
 */
const shape = (extra: Partial<ShapeElement> = {}): ShapeElement => ({
    id: "s1",
    type: "shape",
    shape: "rounded-rect",
    x: 0.1,
    y: 0.1,
    w: 0.3,
    h: 0.2,
    ...extra,
});

describe("cornerRadius", () => {
    it("converts a radius in design pixels to viewBox units on each axis", () => {
        // 64 design px at scale 0.5 is 32 screen px: 32/288 of the width, 32/108 of the height.
        const { rx, ry } = cornerRadius(shape({ radius: 64 }), 0.5, 288, 108);
        expect(rx).toBeCloseTo((32 / 288) * 100, 10);
        expect(ry).toBeCloseTo((32 / 108) * 100, 10);
    });

    it("defaults to 8 design pixels", () => {
        const { rx, ry } = cornerRadius(shape(), 0.5, 288, 108);
        expect(rx).toBeCloseTo((4 / 288) * 100, 10);
        expect(ry).toBeCloseTo((4 / 108) * 100, 10);
    });

    it("caps the radius at half the shorter side, as PowerPoint's roundRect does", () => {
        const { rx, ry } = cornerRadius(shape({ radius: 4000 }), 0.5, 288, 108);
        expect(ry).toBe(50);
        expect(rx).toBeCloseTo((54 / 288) * 100, 10);
    });

    it("draws nothing rounded for a box with no area", () => {
        expect(cornerRadius(shape({ radius: 64 }), 0.5, 0, 108)).toEqual({ rx: 0, ry: 0 });
    });
});

describe("ShapeElementRenderer", () => {
    it("no longer draws the radius as a percentage of the box", () => {
        const { container } = render(
            <ShapeElementRenderer element={shape({ radius: 64 })} slideWidthPx={960} slideHeightPx={540} />,
        );
        const rect = container.querySelector("rect");
        expect(rect).not.toBeNull();

        const rx = Number(rect!.getAttribute("rx"));
        const ry = Number(rect!.getAttribute("ry"));
        // The old rendering was rx="64" ry="64": a corner 64% of the box each way.
        expect(rx).toBeCloseTo((32 / 288) * 100, 6);
        expect(ry).toBeCloseTo((32 / 108) * 100, 6);
        expect(rx).not.toBe(ry);
    });

    it("derives the slide height from the theme's aspect ratio when it is not given", () => {
        const { container } = render(
            <ShapeElementRenderer
                element={shape({ radius: 64 })}
                theme={{ name: "t", aspectRatio: 4 / 3 }}
                slideWidthPx={960}
            />,
        );
        // 960 / (4/3) = 720 tall, so the box is 288 x 144.
        const ry = Number(container.querySelector("rect")!.getAttribute("ry"));
        expect(ry).toBeCloseTo((32 / 144) * 100, 6);
    });
});
