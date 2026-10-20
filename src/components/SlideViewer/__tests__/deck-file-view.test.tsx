// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DeckFileView } from "../DeckFileView";

/*
 * DeckFileView is what an app registers so fancy-code's FileViewer opens a .pptx
 * in SlideViewer: `registerOfficeViewer("pptx", DeckFileView, { read })`. It
 * takes the reader's deck as `document` (dark-slide's deck schema mirrors this
 * package's types, so it goes straight in) and keeps the viewer's frame.
 */

afterEach(cleanup);

const deck = {
    id: "d",
    title: "Ops review",
    slides: [{ id: "s0", elements: [] }, { id: "s1", elements: [] }],
};

describe("DeckFileView", () => {
    it("shows the read deck in the framed SlideViewer", () => {
        const { container } = render(<DeckFileView document={deck} filename="review.pptx" />);
        expect(container.querySelector("[data-fancy-slides-viewer]")).not.toBeNull();
        expect(container.querySelector("[data-react-fancy-faux-client]")).not.toBeNull();
        expect(container.querySelector('[aria-label="Slide counter"]')?.textContent).toBe("1 / 2");
    });

    it("passes frameProps to the frame", () => {
        const { container } = render(<DeckFileView document={deck} frameProps={{ variant: "bare" }} />);
        expect(container.querySelector("[data-react-fancy-faux-client]")!.className).not.toContain("border-[10px]");
    });

    it("says what is wrong when the document is not a deck", () => {
        const { container } = render(<DeckFileView document={{ nope: true }} filename="x.pptx" />);
        expect(container.querySelector("[data-fancy-slides-viewer]")).toBeNull();
        expect(container.textContent).toContain("x.pptx");
    });
});
