// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { SlideViewer } from "../SlideViewer";
import type { Deck } from "../../../types";

/*
 * A deck in a panel has to be readable and drivable without a keyboard.
 *
 * The viewer drew a slide shrunk to fit whatever box it was given, with no way to
 * look closer, and a click anywhere only ever went FORWARD. It now sits in
 * react-fancy's FauxClient frame (zoom and full screen, out of sight until the
 * frame is hovered), and a click on the left third goes back.
 */

afterEach(cleanup);

const deck: Deck = {
    id: "d",
    title: "Ops review",
    slides: [0, 1, 2, 3].map((i) => ({ id: `s${i}`, elements: [] })),
} as unknown as Deck;

/** jsdom lays nothing out; give the viewer a box so a click has a position in it. */
function boxed(el: HTMLElement) {
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 500, right: 900, bottom: 500, x: 0, y: 0, toJSON() {} }) as DOMRect;
}

function viewer(container: HTMLElement) {
    return container.querySelector("[data-fancy-slides-viewer]") as HTMLElement;
}

describe("SlideViewer frame", () => {
    it("sits in a FauxClient device frame with zoom and full screen", () => {
        const { container } = render(<SlideViewer deck={deck} />);
        const frame = container.querySelector("[data-react-fancy-faux-client]");
        expect(frame).not.toBeNull();
        expect(frame!.querySelector("[data-react-fancy-faux-client-zoom-in]")).not.toBeNull();
        expect(frame!.querySelector("[data-react-fancy-faux-client-fullscreen]")).not.toBeNull();
        expect(frame!.contains(viewer(container))).toBe(true);
    });

    it("magnifies the SLIDE on zoom, not its own buttons, and scrolls to it", () => {
        const { container } = render(<SlideViewer deck={deck} />);
        const zoomIn = container.querySelector("[data-react-fancy-faux-client-zoom-in]") as HTMLButtonElement;
        act(() => zoomIn.click());

        const box = container.querySelector("[data-fancy-slides-slide-box]") as HTMLElement;
        expect(box.style.width).toContain("1.25");
        // The frame does not scale the viewer too: that only re-fit the slide.
        // (jsdom has no `style.zoom`; read the attribute.)
        expect((container.querySelector("[data-react-fancy-faux-client-content]") as HTMLElement).getAttribute("style") ?? "").not.toContain("zoom");
        const scroller = container.querySelector("[data-fancy-slides-scroller]") as HTMLElement;
        expect(scroller.style.overflow).toBe("auto");
        // The counter is not inside what scrolls.
        expect(scroller.querySelector('[aria-label="Slide counter"]')).toBeNull();
    });

    it("fits the slide to its OWN box, not the window", () => {
        // In a wide, short box the slide took the box's width and the window's
        // height, ran out of the bottom, and the docs example showed a blank
        // strip of it. jsdom does no layout, so this pins the rule the browser
        // check measured: a size container, and a width bounded by its height.
        const { container } = render(<SlideViewer deck={deck} />);
        const scroller = container.querySelector("[data-fancy-slides-scroller]") as HTMLElement;
        const box = container.querySelector("[data-fancy-slides-slide-box]") as HTMLElement;
        expect(scroller.getAttribute("style")).toContain("container-type: size");
        expect(box.getAttribute("style")).toContain("100cqh");
        expect(box.getAttribute("style")).not.toContain("100vh");
    });

    it("can go without the frame", () => {
        const { container } = render(<SlideViewer deck={deck} frame={false} />);
        expect(container.querySelector("[data-react-fancy-faux-client]")).toBeNull();
        expect(viewer(container)).not.toBeNull();
    });

    it("puts the FRAME in full screen on F, so the controls come with it", () => {
        const { container } = render(<SlideViewer deck={deck} />);
        const frame = container.querySelector("[data-react-fancy-faux-client]") as HTMLElement;
        const request = vi.fn(() => Promise.resolve());
        frame.requestFullscreen = request;
        fireEvent.keyDown(window, { key: "f" });
        expect(request).toHaveBeenCalledTimes(1);
    });
});

describe("SlideViewer click zones", () => {
    it("goes back on the left third and forward on the rest", () => {
        const onIndexChange = vi.fn();
        const { container } = render(<SlideViewer deck={deck} defaultIndex={2} onIndexChange={onIndexChange} />);
        const el = viewer(container);
        boxed(el);

        fireEvent.click(el, { clientX: 100, clientY: 250 });
        expect(onIndexChange).toHaveBeenLastCalledWith(1);

        fireEvent.click(el, { clientX: 700, clientY: 250 });
        expect(onIndexChange).toHaveBeenLastCalledWith(2);
    });

    it("has a previous and a next button, for anyone who cannot see the zones", () => {
        const onIndexChange = vi.fn();
        const { container } = render(<SlideViewer deck={deck} defaultIndex={1} onIndexChange={onIndexChange} />);
        const prev = container.querySelector("[data-fancy-slides-prev]") as HTMLButtonElement;
        const next = container.querySelector("[data-fancy-slides-next]") as HTMLButtonElement;
        expect(prev.getAttribute("aria-label")).toBe("Previous slide");
        expect(next.getAttribute("aria-label")).toBe("Next slide");

        act(() => next.click());
        expect(onIndexChange).toHaveBeenLastCalledWith(2);
        act(() => prev.click());
        expect(onIndexChange).toHaveBeenLastCalledWith(1);
    });

    it("has no previous button on the first slide and no next on the last", () => {
        const first = render(<SlideViewer deck={deck} defaultIndex={0} />);
        expect(first.container.querySelector("[data-fancy-slides-prev]")).toBeNull();
        expect(first.container.querySelector("[data-fancy-slides-next]")).not.toBeNull();
        cleanup();
        const last = render(<SlideViewer deck={deck} defaultIndex={3} />);
        expect(last.container.querySelector("[data-fancy-slides-next]")).toBeNull();
    });
});
