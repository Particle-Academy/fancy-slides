/**
 * Editor canvas zoom — a VIEW state. It decides how big the slide is drawn in
 * the editor, never what is in the deck.
 *
 * - `"fit"`: the pre-zoom behaviour, unchanged — 96% of the canvas width,
 *   never wider than 1280 px.
 * - `"fit-width"`: the whole canvas width, uncapped; scrolls vertically if the
 *   slide is then taller than the canvas.
 * - a number: a scale of the slide's DESIGN size (`theme.slideWidth`, 1920 by
 *   default). `1` is 100%; the canvas scrolls when the slide is bigger.
 */
export type DeckZoom = "fit" | "fit-width" | number;

/** The fixed zoom levels the toolbar offers and Ctrl/Cmd + `=` / `-` step through. */
export const DECK_ZOOM_STEPS: readonly number[] = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

/** Smallest / largest numeric zoom accepted. */
export const DECK_ZOOM_MIN = 0.1;
export const DECK_ZOOM_MAX = 8;

/** The fit frame: 96% of the available width, capped at this many px. */
export const FIT_MAX_PX = 1280;
export const FIT_FRACTION = 0.96;

/** Clamp a numeric zoom into range; pass the modes through. */
export function normalizeZoom(zoom: DeckZoom): DeckZoom {
    if (typeof zoom !== "number") return zoom;
    if (!Number.isFinite(zoom) || zoom <= 0) return 1;
    return Math.min(DECK_ZOOM_MAX, Math.max(DECK_ZOOM_MIN, zoom));
}

/**
 * The scale (rendered px per design px) a zoom draws at, given the canvas's
 * available content width. `null` when a fit mode has not been measured yet.
 */
export function zoomScale(zoom: DeckZoom, availableWidth: number | null, designWidth: number): number | null {
    if (typeof zoom === "number") return zoom;
    if (!availableWidth || availableWidth <= 0 || designWidth <= 0) return null;
    if (zoom === "fit-width") return availableWidth / designWidth;
    return Math.min(availableWidth * FIT_FRACTION, FIT_MAX_PX) / designWidth;
}

/** The next fixed step above (`+1`) or below (`-1`) the current scale. */
export function stepZoom(currentScale: number, direction: 1 | -1): number {
    const eps = 1e-6;
    if (direction > 0) {
        return DECK_ZOOM_STEPS.find((s) => s > currentScale + eps) ?? DECK_ZOOM_STEPS[DECK_ZOOM_STEPS.length - 1]!;
    }
    for (let i = DECK_ZOOM_STEPS.length - 1; i >= 0; i--) {
        if (DECK_ZOOM_STEPS[i]! < currentScale - eps) return DECK_ZOOM_STEPS[i]!;
    }
    return DECK_ZOOM_STEPS[0]!;
}

/** `"fit"` / `"fit-width"` / `"1.5"` — the string a select option carries. */
export function zoomToString(zoom: DeckZoom): string {
    return typeof zoom === "number" ? String(zoom) : zoom;
}

export function zoomFromString(value: string): DeckZoom {
    if (value === "fit" || value === "fit-width") return value;
    return normalizeZoom(Number(value));
}

/**
 * The surround a slide sits on — the letterbox in the viewer, the canvas in the
 * editor. It belongs to the HOST, not the deck: the slide paints its own
 * background on top. Light falls back to react-fancy's secondary surface
 * (zinc-100); `styles.css` sets the dark value under `.dark` and
 * `[data-theme="dark"]`. A host re-points it with `--fs-stage-surface`.
 */
export const STAGE_SURFACE = "var(--fs-stage-surface, var(--color-secondary-100, #f4f4f5))";
