import { describe, it, expect } from "vitest";
import { splitParagraphs, textBlocks } from "./builds";

describe("splitParagraphs", () => {
    it("splits on single newlines into one block per line", () => {
        expect(splitParagraphs("Intro:\n- one\n- two\n- three")).toEqual([
            "Intro:",
            "- one",
            "- two",
            "- three",
        ]);
    });

    it("preserves interior blank lines but drops a single trailing newline", () => {
        expect(splitParagraphs("a\n\nb\n")).toEqual(["a", "", "b"]);
    });
});

describe("textBlocks", () => {
    // Regression for Particle-Academy/fancy-slides#10: the static (non-build)
    // markdown render path used to hand the whole multi-line string to a
    // CommonMark renderer, which folds a lone "\n" into a soft break (a space),
    // collapsing bullet lists onto one wrapped line. The static path must split
    // line-by-line so each "\n" is a hard break, matching the paraReveal path and
    // the dark-slide pptx export.
    it("splits markdown content line-by-line so single newlines are hard breaks", () => {
        const blocks = textBlocks("Intro:\n- one\n- two\n- three", "markdown");
        expect(blocks).toEqual(["Intro:", "- one", "- two", "- three"]);
        // The pre-fix behaviour rendered exactly ONE block (the whole string).
        expect(blocks.length).toBeGreaterThan(1);
    });

    it("splits html content line-by-line too", () => {
        expect(textBlocks("first\nsecond", "html")).toEqual(["first", "second"]);
    });

    it("keeps plain content as a single block (pre-wrap preserves its newlines)", () => {
        expect(textBlocks("a\nb\nc", "plain")).toEqual(["a\nb\nc"]);
    });
});
