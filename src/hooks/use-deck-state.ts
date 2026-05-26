import { useCallback, useMemo } from "react";
import type { Deck, DeckOp, Slide, SlideElement, SlideLayout, Theme, SlideBackground } from "../types";
import { elementId, slideId } from "../utils/ids";

/**
 * Hook that wraps a controlled deck with a typed mutation API. Every helper
 * applies a `DeckOp` and emits the new deck via `onChange`. Consumers that
 * want raw control over the deck can skip this and edit the deck directly
 * — the helpers exist so the editor / agent bridge / undo system all funnel
 * through the same shape.
 */
export interface UseDeckStateOptions {
    value: Deck;
    onChange: (next: Deck) => void;
    /** Called after every mutation with the op that produced it — wire up an AgentPanel / audit log. */
    onOp?: (op: DeckOp) => void;
}

export interface DeckStateApi {
    /** Apply a raw DeckOp — the catch-all that every helper funnels through. */
    apply: (op: DeckOp) => void;
    /** Deck-level helpers. */
    setTitle: (title: string) => void;
    applyTheme: (theme: Theme) => void;
    /** Slide-level helpers. */
    addSlide: (index?: number, partial?: Partial<Slide>) => string;
    duplicateSlide: (id: string) => string;
    removeSlide: (id: string) => void;
    reorderSlide: (id: string, toIndex: number) => void;
    setLayout: (id: string, layout: SlideLayout) => void;
    setNotes: (id: string, notes: string) => void;
    setBackground: (id: string, bg?: SlideBackground) => void;
    /** Element-level helpers. */
    addElement: (slideId: string, element: Omit<SlideElement, "id"> & { id?: string }) => string;
    removeElement: (slideId: string, elementId: string) => void;
    updateElement: (slideId: string, elementId: string, patch: Partial<SlideElement>) => void;
    moveElement: (slideId: string, elementId: string, x: number, y: number) => void;
    resizeElement: (slideId: string, elementId: string, w: number, h: number) => void;
    /** Convenience lookups. */
    getSlide: (id: string) => Slide | undefined;
    getElement: (slideId: string, elementId: string) => SlideElement | undefined;
}

export function useDeckState({ value, onChange, onOp }: UseDeckStateOptions): DeckStateApi {
    const apply = useCallback(
        (op: DeckOp) => {
            const next = reduce(value, op);
            onChange(next);
            onOp?.(op);
        },
        [value, onChange, onOp],
    );

    return useMemo<DeckStateApi>(() => {
        return {
            apply,
            setTitle: (title) => apply({ kind: "deck_set_title", title }),
            applyTheme: (theme) => apply({ kind: "deck_apply_theme", theme }),
            addSlide: (index, partial) => {
                const id = partial?.id ?? slideId();
                const slide: Slide = {
                    id,
                    layout: partial?.layout ?? "blank",
                    elements: partial?.elements ?? [],
                    background: partial?.background,
                    transition: partial?.transition,
                    notes: partial?.notes,
                    metadata: partial?.metadata,
                };
                apply({ kind: "slide_add", index: index ?? value.slides.length, slide });
                return id;
            },
            duplicateSlide: (id) => {
                const src = value.slides.find((s) => s.id === id);
                if (!src) return id;
                const newId = slideId();
                const clone: Slide = {
                    ...src,
                    id: newId,
                    elements: src.elements.map((e) => ({ ...e, id: elementId() })),
                };
                const idx = value.slides.findIndex((s) => s.id === id);
                apply({ kind: "slide_add", index: idx + 1, slide: clone });
                return newId;
            },
            removeSlide: (id) => apply({ kind: "slide_remove", id }),
            reorderSlide: (id, toIndex) => apply({ kind: "slide_reorder", id, toIndex }),
            setLayout: (id, layout) => apply({ kind: "slide_set_layout", id, layout }),
            setNotes: (id, notes) => apply({ kind: "slide_set_notes", id, notes }),
            setBackground: (id, background) => apply({ kind: "slide_set_background", id, background }),
            addElement: (slideId, element) => {
                const id = element.id ?? elementId();
                apply({ kind: "element_add", slideId, element: { ...element, id } as SlideElement });
                return id;
            },
            removeElement: (slideIdArg, elementIdArg) => apply({ kind: "element_remove", slideId: slideIdArg, elementId: elementIdArg }),
            updateElement: (slideIdArg, elementIdArg, patch) =>
                apply({ kind: "element_update", slideId: slideIdArg, elementId: elementIdArg, patch }),
            moveElement: (slideIdArg, elementIdArg, x, y) => apply({ kind: "element_move", slideId: slideIdArg, elementId: elementIdArg, x, y }),
            resizeElement: (slideIdArg, elementIdArg, w, h) => apply({ kind: "element_resize", slideId: slideIdArg, elementId: elementIdArg, w, h }),
            getSlide: (id) => value.slides.find((s) => s.id === id),
            getElement: (slideIdArg, elementIdArg) => value.slides.find((s) => s.id === slideIdArg)?.elements.find((e) => e.id === elementIdArg),
        };
    }, [apply, value.slides]);
}

/**
 * Pure reducer — the single source of truth for how every DeckOp mutates a
 * Deck. Agents, undo stacks, replay logs, and the editor all funnel through
 * this. Never mutates the input.
 */
export function reduce(deck: Deck, op: DeckOp): Deck {
    switch (op.kind) {
        case "deck_set_title":
            return { ...deck, title: op.title };
        case "deck_apply_theme":
            return { ...deck, theme: op.theme };
        case "slide_add": {
            const slides = [...deck.slides];
            slides.splice(Math.max(0, Math.min(slides.length, op.index)), 0, op.slide);
            return { ...deck, slides };
        }
        case "slide_remove":
            return { ...deck, slides: deck.slides.filter((s) => s.id !== op.id) };
        case "slide_reorder": {
            const idx = deck.slides.findIndex((s) => s.id === op.id);
            if (idx < 0) return deck;
            const slides = [...deck.slides];
            const [moved] = slides.splice(idx, 1);
            slides.splice(Math.max(0, Math.min(slides.length, op.toIndex)), 0, moved);
            return { ...deck, slides };
        }
        case "slide_set_layout":
            return { ...deck, slides: deck.slides.map((s) => (s.id === op.id ? { ...s, layout: op.layout } : s)) };
        case "slide_set_notes":
            return { ...deck, slides: deck.slides.map((s) => (s.id === op.id ? { ...s, notes: op.notes } : s)) };
        case "slide_set_background":
            return { ...deck, slides: deck.slides.map((s) => (s.id === op.id ? { ...s, background: op.background } : s)) };
        case "element_add":
            return {
                ...deck,
                slides: deck.slides.map((s) => (s.id === op.slideId ? { ...s, elements: [...s.elements, op.element] } : s)),
            };
        case "element_remove":
            return {
                ...deck,
                slides: deck.slides.map((s) =>
                    s.id === op.slideId ? { ...s, elements: s.elements.filter((e) => e.id !== op.elementId) } : s,
                ),
            };
        case "element_update":
            return {
                ...deck,
                slides: deck.slides.map((s) =>
                    s.id === op.slideId
                        ? { ...s, elements: s.elements.map((e) => (e.id === op.elementId ? ({ ...e, ...op.patch } as SlideElement) : e)) }
                        : s,
                ),
            };
        case "element_move":
            return {
                ...deck,
                slides: deck.slides.map((s) =>
                    s.id === op.slideId
                        ? { ...s, elements: s.elements.map((e) => (e.id === op.elementId ? { ...e, x: op.x, y: op.y } : e)) }
                        : s,
                ),
            };
        case "element_resize":
            return {
                ...deck,
                slides: deck.slides.map((s) =>
                    s.id === op.slideId
                        ? { ...s, elements: s.elements.map((e) => (e.id === op.elementId ? { ...e, w: op.w, h: op.h } : e)) }
                        : s,
                ),
            };
    }
}
