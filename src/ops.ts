/**
 * The canonical DeckOp vocabulary — the contract shared with the sibling
 * `dark-slide` PHP package.
 *
 * This module ships two things every cross-language consumer needs:
 *  - {@link mapLegacyOp} — convert pre-0.13 `kind`-flavored ops forward so an
 *    existing op log / stored stream keeps replaying.
 *  - {@link deckOpSchema} — the JSON Schema of record for a single op, so a
 *    backend (PHP, Go, anything) can validate ops on the wire and `dark-slide`
 *    can ship a byte-identical reducer.
 *
 * The reducer itself lives in `use-deck-state.ts` (`reduce` / `reduceDeck`).
 */

import type { DeckOp, LegacyDeckOp } from "./types";

/**
 * Map a pre-0.13 `kind`-flavored op to the canonical {@link DeckOp}. Lets a
 * consumer migrate a stored op log or an in-flight stream gradually:
 *
 * ```ts
 * deckEditor.apply(mapLegacyOp(oldOp));
 * ```
 */
export function mapLegacyOp(legacy: LegacyDeckOp): DeckOp {
    switch (legacy.kind) {
        case "deck_set_title":
            return { op: "deck.setTitle", title: legacy.title };
        case "deck_apply_theme":
            return { op: "deck.setTheme", theme: legacy.theme };
        case "deck_set":
            return { op: "deck.replace", deck: legacy.deck };
        case "slide_add":
            return { op: "slide.add", index: legacy.index, slide: legacy.slide };
        case "slide_remove":
            return { op: "slide.remove", slideId: legacy.id };
        case "slide_reorder":
            return { op: "slide.reorder", slideId: legacy.id, toIndex: legacy.toIndex };
        case "slide_set_layout":
            return { op: "slide.setLayout", slideId: legacy.id, layout: legacy.layout };
        case "slide_set_notes":
            return { op: "slide.setNotes", slideId: legacy.id, notes: legacy.notes };
        case "slide_set_background":
            return { op: "slide.setBackground", slideId: legacy.id, background: legacy.background };
        case "slide_set_transition":
            return { op: "slide.setTransition", slideId: legacy.id, transition: legacy.transition };
        case "element_add":
            return { op: "element.add", slideId: legacy.slideId, element: legacy.element };
        case "element_remove":
            return { op: "element.remove", slideId: legacy.slideId, elementId: legacy.elementId };
        case "element_update":
            return { op: "element.update", slideId: legacy.slideId, elementId: legacy.elementId, patch: legacy.patch };
        case "element_move":
            return { op: "element.move", slideId: legacy.slideId, elementId: legacy.elementId, x: legacy.x, y: legacy.y };
        case "element_resize":
            return { op: "element.resize", slideId: legacy.slideId, elementId: legacy.elementId, w: legacy.w, h: legacy.h };
        case "element_set_animation":
            return { op: "element.setAnimation", slideId: legacy.slideId, elementId: legacy.elementId, animation: legacy.animation };
    }
}

/** Every canonical op name, in dependency-friendly order. The source of truth for the `op` discriminator. */
export const DECK_OP_TYPES = [
    "deck.setTitle",
    "deck.setTheme",
    "deck.replace",
    "slide.add",
    "slide.remove",
    "slide.reorder",
    "slide.setLayout",
    "slide.setNotes",
    "slide.setBackground",
    "slide.setTransition",
    "element.add",
    "element.remove",
    "element.update",
    "element.move",
    "element.resize",
    "element.setAnimation",
] as const;

/**
 * The JSON Schema of record for a single {@link DeckOp}. A `oneOf` keyed on the
 * `op` discriminator. Nested deck/slide/element/theme payloads are described as
 * generic objects here — their full shapes live in the deck schema (and in
 * `dark-slide`'s `Schema::jsonSchema()`), which the writer/validator already
 * owns; this schema's job is to validate the *op envelope* on the wire and to
 * register the op vocabulary as an LLM tool definition.
 *
 * Ship this byte-for-byte alongside `dark-slide` so both sides validate ops
 * against the same contract.
 */
export function deckOpSchema(): Record<string, unknown> {
    const slideId = { type: "string", description: "Target slide id." };
    const elementId = { type: "string", description: "Target element id." };
    const obj = (description: string) => ({ type: "object", description });

    const variant = (op: string, props: Record<string, unknown>, required: string[]) => ({
        type: "object",
        properties: { op: { const: op }, ...props },
        required: ["op", ...required],
        additionalProperties: false,
    });

    return {
        $schema: "http://json-schema.org/draft-07/schema#",
        $id: "https://particle.academy/schema/deck-op.json",
        title: "DeckOp",
        description: "A single canonical operation on a Deck, shared by fancy-slides and dark-slide.",
        oneOf: [
            variant("deck.setTitle", { title: { type: "string" } }, ["title"]),
            variant("deck.setTheme", { theme: obj("Theme object.") }, ["theme"]),
            variant("deck.replace", { deck: obj("A full Deck object.") }, ["deck"]),
            variant("slide.add", { index: { type: "integer", minimum: 0 }, slide: obj("A Slide object.") }, ["index", "slide"]),
            variant("slide.remove", { slideId }, ["slideId"]),
            variant("slide.reorder", { slideId, toIndex: { type: "integer", minimum: 0 } }, ["slideId", "toIndex"]),
            variant("slide.setLayout", { slideId, layout: { type: "string" } }, ["slideId", "layout"]),
            variant("slide.setNotes", { slideId, notes: { type: "string" } }, ["slideId", "notes"]),
            variant("slide.setBackground", { slideId, background: obj("A SlideBackground object, or null to clear.") }, ["slideId"]),
            variant("slide.setTransition", { slideId, transition: obj("A SlideTransition object, or null to clear.") }, ["slideId"]),
            variant("element.add", { slideId, element: obj("A SlideElement object.") }, ["slideId", "element"]),
            variant("element.remove", { slideId, elementId }, ["slideId", "elementId"]),
            variant("element.update", { slideId, elementId, patch: obj("Partial SlideElement fields to merge.") }, ["slideId", "elementId", "patch"]),
            variant("element.move", { slideId, elementId, x: { type: "number" }, y: { type: "number" } }, ["slideId", "elementId", "x", "y"]),
            variant("element.resize", { slideId, elementId, w: { type: "number" }, h: { type: "number" } }, ["slideId", "elementId", "w", "h"]),
            variant("element.setAnimation", { slideId, elementId, animation: obj("An ElementAnimation object, or null to clear.") }, ["slideId", "elementId"]),
        ],
    };
}
