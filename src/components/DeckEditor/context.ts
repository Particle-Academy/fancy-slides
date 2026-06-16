import { createContext, useContext, type ReactNode } from "react";
import type { Deck, ShapeKind, Slide as SlideData, SlideElement, Theme } from "../../types";
import type { DeckStateApi } from "../../hooks/use-deck-state";
import type { ChartKind, ToolbarApi } from "../EditorToolbar";

/**
 * The editor's insert action surface — one entry per element type the toolbar
 * can add. Each inserts a starter element on the active slide and selects it.
 */
export interface DeckEditorInsertApi {
    text(): void;
    image(): void;
    shape(kind: ShapeKind): void;
    chart(kind?: ChartKind): void;
    code(): void;
    table(): void;
}

/**
 * The shared editor controller — everything a slot part needs to render itself
 * and drive the deck. Provided by {@link DeckEditorProvider} (and therefore by
 * `<DeckEditor>` itself), read by every `DeckEditor.*` slot via
 * {@link useDeckEditor}. Selection lives here, so all slots — and any app panel
 * the host drops alongside them — share one controller rather than re-deriving
 * their own.
 */
export interface DeckEditorContextValue {
    /** The controlled deck (== the provider's `value`). */
    deck: Deck;
    /** Resolved theme (`resolveTheme(deck.theme)`) — defaults filled in. */
    theme: Theme;
    /** The op surface from `useDeckState`. */
    ops: DeckStateApi;
    /** Currently-selected slide id. */
    slideId: string | null;
    setSlideId: (id: string | null) => void;
    /** The currently-selected slide, if any. */
    slide: SlideData | undefined;
    /** Currently-selected element id (shared across slots — the crux of #11). */
    selectedElementId: string | null;
    setSelectedElementId: (id: string | null) => void;
    /** The currently-selected element, if any. */
    selectedElement: SlideElement | null;
    /** Insert handlers — add a starter element of each type to the active slide. */
    insert: DeckEditorInsertApi;
    /** The toolbar action surface (title / theme / insert / present / disabled). */
    toolbarApi: ToolbarApi;
    /** Renderer for chart / code / table / embed elements. */
    renderElement: (element: SlideElement, slideWidthPx: number) => ReactNode | undefined;
    /** The theme list the picker offers (defaults to the built-ins). */
    themes: Theme[];
    /** Present handler, if the host wired one. */
    onPresent?: () => void;
}

export const DeckEditorContext = createContext<DeckEditorContextValue | null>(null);

/**
 * Read the shared editor controller. Must be called inside a
 * `<DeckEditor.Provider>` (which `<DeckEditor>` mounts for you) — throws a clear
 * error otherwise, mirroring `EditorToolbar`'s slot guard.
 */
export function useDeckEditor(): DeckEditorContextValue {
    const ctx = useContext(DeckEditorContext);
    if (!ctx) {
        throw new Error("useDeckEditor() (and DeckEditor.* slots) must be used inside <DeckEditor.Provider> (mounted for you by <DeckEditor>).");
    }
    return ctx;
}
