import { useCallback, useMemo } from "react";
import type { Deck, DeckOp, ElementAnimation, Slide, SlideElement, SlideLayout, Theme, SlideBackground, SlideTransition } from "../types";
import { elementId, slideId } from "../utils/ids";

/**
 * Hook that wraps a controlled deck with a typed mutation API. Every helper
 * applies a `DeckOp` and emits the new deck via `onChange`. Consumers that
 * want raw control over the deck can skip this and edit the deck directly
 * — the helpers exist so the editor / agent bridge / undo system all funnel
 * through the same shape.
 */
/**
 * Who mints new slide/element ids.
 *
 * - `"client"` (default) — ids are final, minted locally. Instant; right for
 *   solo editors.
 * - `"optimistic"` — ids are minted as provisional `tmp_…` ids and surfaced in
 *   the emitted op, so a collaborative/agent-driven host can reconcile them to
 *   the server-assigned id when the op echoes back (see `useDeckSync`).
 * - `"server"` — same provisional `tmp_…` minting; the `tmp_` prefix is the
 *   signal that the authoritative id comes from the server. (The element still
 *   renders immediately under its tmp id; gate on confirmation host-side if you
 *   need strict server-only ids.)
 */
export type IdStrategy = "client" | "optimistic" | "server";

export interface UseDeckStateOptions {
    value: Deck;
    onChange: (next: Deck) => void;
    /** Called after every mutation with the op that produced it — wire up an AgentPanel / audit log. */
    onOp?: (op: DeckOp) => void;
    /** Who mints new ids. Defaults to `"client"`. See {@link IdStrategy}. */
    idStrategy?: IdStrategy;
}

export interface DeckStateApi {
    /** Apply a raw DeckOp — the catch-all that every helper funnels through. */
    apply: (op: DeckOp) => void;
    /** Deck-level helpers. */
    setTitle: (title: string) => void;
    applyTheme: (theme: Theme) => void;
    /** Replace the entire deck — stream a full presentation in atomically. */
    setDeck: (deck: Deck) => void;
    /** Slide-level helpers. */
    addSlide: (index?: number, partial?: Partial<Slide>) => string;
    duplicateSlide: (id: string) => string;
    removeSlide: (id: string) => void;
    reorderSlide: (id: string, toIndex: number) => void;
    setLayout: (id: string, layout: SlideLayout) => void;
    setNotes: (id: string, notes: string) => void;
    setBackground: (id: string, bg?: SlideBackground) => void;
    setTransition: (id: string, transition?: SlideTransition) => void;
    /** Element-level helpers. */
    addElement: (slideId: string, element: Omit<SlideElement, "id"> & { id?: string }) => string;
    removeElement: (slideId: string, elementId: string) => void;
    updateElement: (slideId: string, elementId: string, patch: Partial<SlideElement>) => void;
    moveElement: (slideId: string, elementId: string, x: number, y: number) => void;
    resizeElement: (slideId: string, elementId: string, w: number, h: number) => void;
    /** Set or clear an element's entrance build animation. Pass `undefined` to clear. */
    setAnimation: (slideId: string, elementId: string, animation?: ElementAnimation) => void;
    /** Convenience lookups. */
    getSlide: (id: string) => Slide | undefined;
    getElement: (slideId: string, elementId: string) => SlideElement | undefined;
}

export function useDeckState({ value, onChange, onOp, idStrategy = "client" }: UseDeckStateOptions): DeckStateApi {
    const apply = useCallback(
        (op: DeckOp) => {
            const next = reduce(value, op);
            onChange(next);
            onOp?.(op);
        },
        [value, onChange, onOp],
    );

    // Provisional ids are tagged `tmp_` so a collaborative host can reconcile
    // them to a server-assigned id once the op echoes back.
    const mkId = useCallback(
        (gen: () => string): string => (idStrategy === "client" ? gen() : `tmp_${gen()}`),
        [idStrategy],
    );

    return useMemo<DeckStateApi>(() => {
        return {
            apply,
            setTitle: (title) => apply({ op: "deck.setTitle", title }),
            applyTheme: (theme) => apply({ op: "deck.setTheme", theme }),
            setDeck: (deck) => apply({ op: "deck.replace", deck }),
            addSlide: (index, partial) => {
                const id = partial?.id ?? mkId(slideId);
                const slide: Slide = {
                    id,
                    layout: partial?.layout ?? "blank",
                    elements: partial?.elements ?? [],
                    background: partial?.background,
                    transition: partial?.transition,
                    notes: partial?.notes,
                    metadata: partial?.metadata,
                };
                apply({ op: "slide.add", index: index ?? value.slides.length, slide });
                return id;
            },
            duplicateSlide: (id) => {
                const src = value.slides.find((s) => s.id === id);
                if (!src) return id;
                const newId = mkId(slideId);
                const clone: Slide = {
                    ...src,
                    id: newId,
                    elements: src.elements.map((e) => ({ ...e, id: mkId(elementId) })),
                };
                const idx = value.slides.findIndex((s) => s.id === id);
                apply({ op: "slide.add", index: idx + 1, slide: clone });
                return newId;
            },
            removeSlide: (id) => apply({ op: "slide.remove", slideId: id }),
            reorderSlide: (id, toIndex) => apply({ op: "slide.reorder", slideId: id, toIndex }),
            setLayout: (id, layout) => apply({ op: "slide.setLayout", slideId: id, layout }),
            setNotes: (id, notes) => apply({ op: "slide.setNotes", slideId: id, notes }),
            setBackground: (id, background) => apply({ op: "slide.setBackground", slideId: id, background }),
            setTransition: (id, transition) => apply({ op: "slide.setTransition", slideId: id, transition }),
            addElement: (slideIdArg, element) => {
                const id = element.id ?? mkId(elementId);
                apply({ op: "element.add", slideId: slideIdArg, element: { ...element, id } as SlideElement });
                return id;
            },
            removeElement: (slideIdArg, elementIdArg) => apply({ op: "element.remove", slideId: slideIdArg, elementId: elementIdArg }),
            updateElement: (slideIdArg, elementIdArg, patch) =>
                apply({ op: "element.update", slideId: slideIdArg, elementId: elementIdArg, patch }),
            moveElement: (slideIdArg, elementIdArg, x, y) => apply({ op: "element.move", slideId: slideIdArg, elementId: elementIdArg, x, y }),
            resizeElement: (slideIdArg, elementIdArg, w, h) => apply({ op: "element.resize", slideId: slideIdArg, elementId: elementIdArg, w, h }),
            setAnimation: (slideIdArg, elementIdArg, animation) =>
                apply({ op: "element.setAnimation", slideId: slideIdArg, elementId: elementIdArg, animation }),
            getSlide: (id) => value.slides.find((s) => s.id === id),
            getElement: (slideIdArg, elementIdArg) => value.slides.find((s) => s.id === slideIdArg)?.elements.find((e) => e.id === elementIdArg),
        };
    }, [apply, value.slides, mkId]);
}

/**
 * Pure reducer — the single source of truth for how every DeckOp mutates a
 * Deck. Agents, undo stacks, replay logs, and the editor all funnel through
 * this. Never mutates the input.
 */
export function reduce(deck: Deck, op: DeckOp): Deck {
    switch (op.op) {
        case "deck.setTitle":
            return { ...deck, title: op.title };
        case "deck.setTheme":
            return { ...deck, theme: op.theme };
        case "deck.replace":
            // Replace the whole deck — streaming a full presentation in. The
            // previous deck is what an undo entry would snapshot.
            return op.deck;
        case "slide.add": {
            const slides = [...deck.slides];
            slides.splice(Math.max(0, Math.min(slides.length, op.index)), 0, op.slide);
            return { ...deck, slides };
        }
        case "slide.remove":
            return { ...deck, slides: deck.slides.filter((s) => s.id !== op.slideId) };
        case "slide.reorder": {
            const idx = deck.slides.findIndex((s) => s.id === op.slideId);
            if (idx < 0) return deck;
            const slides = [...deck.slides];
            const [moved] = slides.splice(idx, 1);
            slides.splice(Math.max(0, Math.min(slides.length, op.toIndex)), 0, moved);
            return { ...deck, slides };
        }
        case "slide.setLayout":
            return { ...deck, slides: deck.slides.map((s) => (s.id === op.slideId ? { ...s, layout: op.layout } : s)) };
        case "slide.setNotes":
            return { ...deck, slides: deck.slides.map((s) => (s.id === op.slideId ? { ...s, notes: op.notes } : s)) };
        case "slide.setBackground":
            return { ...deck, slides: deck.slides.map((s) => (s.id === op.slideId ? { ...s, background: op.background } : s)) };
        case "slide.setTransition":
            return { ...deck, slides: deck.slides.map((s) => (s.id === op.slideId ? { ...s, transition: op.transition } : s)) };
        case "element.add":
            return {
                ...deck,
                slides: deck.slides.map((s) => (s.id === op.slideId ? { ...s, elements: [...s.elements, op.element] } : s)),
            };
        case "element.remove":
            return {
                ...deck,
                slides: deck.slides.map((s) =>
                    s.id === op.slideId ? { ...s, elements: s.elements.filter((e) => e.id !== op.elementId) } : s,
                ),
            };
        case "element.update":
            return {
                ...deck,
                slides: deck.slides.map((s) =>
                    s.id === op.slideId
                        ? { ...s, elements: s.elements.map((e) => (e.id === op.elementId ? ({ ...e, ...op.patch } as SlideElement) : e)) }
                        : s,
                ),
            };
        case "element.move":
            return {
                ...deck,
                slides: deck.slides.map((s) =>
                    s.id === op.slideId
                        ? { ...s, elements: s.elements.map((e) => (e.id === op.elementId ? { ...e, x: op.x, y: op.y } : e)) }
                        : s,
                ),
            };
        case "element.resize":
            return {
                ...deck,
                slides: deck.slides.map((s) =>
                    s.id === op.slideId
                        ? { ...s, elements: s.elements.map((e) => (e.id === op.elementId ? { ...e, w: op.w, h: op.h } : e)) }
                        : s,
                ),
            };
        case "element.setAnimation":
            return {
                ...deck,
                slides: deck.slides.map((s) =>
                    s.id === op.slideId
                        ? {
                              ...s,
                              elements: s.elements.map((e) => {
                                  if (e.id !== op.elementId) return e;
                                  if (op.animation === undefined) {
                                      // Clear: drop the key entirely so the element leaves the build sequence.
                                      const { animation: _drop, ...rest } = e;
                                      return rest as SlideElement;
                                  }
                                  return { ...e, animation: op.animation };
                              }),
                          }
                        : s,
                ),
            };
    }
}
