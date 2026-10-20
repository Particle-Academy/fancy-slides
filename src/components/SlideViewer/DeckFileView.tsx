import { Callout, type FauxClientProps } from "@particle-academy/react-fancy";
import type { Deck } from "../../types";
import { SlideViewer } from "./SlideViewer";

export interface DeckFileViewProps {
    /** A deck as dark-slide's reader returns it (its schema mirrors this package's `Deck`). */
    document: unknown;
    filename?: string;
    /** Passed to SlideViewer's frame. */
    frameProps?: Partial<FauxClientProps>;
}

/**
 * A .pptx in fancy-code's `FileViewer`: register it once at app start.
 *
 * ```ts
 * registerOfficeViewer("pptx", DeckFileView, { read: (b) => new PptxReader().read(b) });
 * ```
 *
 * The props match fancy-code's `OfficeViewerProps` without importing them, so
 * this package does not depend on fancy-code.
 */
export function DeckFileView({ document, filename, frameProps }: DeckFileViewProps) {
    const deck = document as Partial<Deck> | null;

    // A reader that returned something else would otherwise draw an empty frame.
    if (!deck || !Array.isArray(deck.slides)) {
        return <Callout color="red">{filename ?? "This file"} did not read as a deck.</Callout>;
    }

    return <SlideViewer deck={deck as Deck} frameProps={frameProps} />;
}
