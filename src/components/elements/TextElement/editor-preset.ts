import type { EditorAction } from "@particle-academy/react-fancy";

/**
 * Presentation-tuned toolbar preset for the react-fancy `Editor` used to edit
 * slide text inline. Only commands that round-trip cleanly through the editor's
 * `htmlToMarkdown` output are included — bold (`**`), italic (`*`), heading
 * (`## `), and bullet list (`- `). Box-level typography (alignment, color, font
 * size, line height) is NOT here: those are per-element `TextStyle` properties
 * edited in the ElementInspector, and `text-align`/color spans don't survive the
 * markdown the slide content commits to.
 */
export const PRESENTATION_EDITOR_ACTIONS: EditorAction[] = [
    { icon: "B", label: "Bold", command: "bold" },
    { icon: "I", label: "Italic", command: "italic" },
    { icon: "H", label: "Heading", command: "formatBlock", commandArg: "<h2>" },
    { icon: "P", label: "Paragraph", command: "formatBlock", commandArg: "<p>" },
    { icon: "•", label: "Bullet list", command: "insertUnorderedList" },
];

/**
 * Normalize the `Editor`'s markdown output to the *line-based* paragraph model
 * the slide content commits to. The editor emits a blank line (`\n\n`) between
 * `<p>` blocks, but `splitParagraphs` (and the dark-slide pptx writer) treat a
 * single `\n` as one paragraph / build unit, and a blank interior line as its
 * own (phantom) build. Collapsing runs of newlines to a single `\n` keeps
 * "by paragraph" reveals and per-paragraph pptx builds correct — bullets are
 * already one-per-`\n`, so they're unaffected. The round-trip invariant
 * (`content → Editor → normalize → content` preserves the `\n` paragraph count)
 * is covered by a unit test.
 */
export function normalizeSlideMarkdown(md: string): string {
    return md
        .replace(/\r\n/g, "\n")
        .replace(/\n{2,}/g, "\n")
        .replace(/[ \t]+$/gm, "")
        .trim();
}
