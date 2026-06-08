/**
 * Stream a full presentation in and out. The `Deck` is already plain JSON
 * (no functions, no React children), so "serialize" is mostly `JSON.stringify`
 * — these helpers add the schema-version stamp, a forgiving structural
 * validation, and a forward-migration shim so a host can persist a deck, hand
 * it to an agent, and load it back safely.
 *
 * Streaming OUT: read `value` / `onChange` from the controlled editor, or call
 * `serializeDeck(deck)`.
 * Streaming IN: `parseDeck(json)` → feed to `DeckEditor`'s `value`, or apply a
 * `{ op: "deck.replace", deck }` op (also exposed as the bridge's `deck_set` tool).
 */

import type { Deck, SlideElement } from "../types";
import { SCHEMA_VERSION } from "../types";

export interface DeckValidation {
    ok: boolean;
    errors: string[];
}

const ELEMENT_TYPES = ["text", "image", "chart", "code", "table", "shape", "embed"];

/**
 * Structurally validate a deck. Forgiving by design — it checks the shape an
 * editor / writer relies on (ids, slides array, element types + 0..1 geometry),
 * not every optional field. Returns all problems found rather than throwing.
 */
export function validateDeck(deck: unknown): DeckValidation {
    const errors: string[] = [];
    const d = deck as Partial<Deck> | null | undefined;
    if (!d || typeof d !== "object") {
        return { ok: false, errors: ["deck is not an object"] };
    }
    if (typeof d.id !== "string" || !d.id) errors.push("deck.id must be a non-empty string");
    if (typeof d.title !== "string") errors.push("deck.title must be a string");
    if (!d.theme || typeof d.theme !== "object") errors.push("deck.theme must be an object");
    if (!Array.isArray(d.slides)) {
        errors.push("deck.slides must be an array");
        return { ok: errors.length === 0, errors };
    }
    d.slides.forEach((slide, si) => {
        if (!slide || typeof slide !== "object") {
            errors.push(`slides[${si}] is not an object`);
            return;
        }
        if (typeof slide.id !== "string" || !slide.id) errors.push(`slides[${si}].id must be a non-empty string`);
        if (!Array.isArray(slide.elements)) {
            errors.push(`slides[${si}].elements must be an array`);
            return;
        }
        slide.elements.forEach((el: SlideElement, ei) => {
            const where = `slides[${si}].elements[${ei}]`;
            if (!el || typeof el !== "object") {
                errors.push(`${where} is not an object`);
                return;
            }
            if (typeof el.id !== "string" || !el.id) errors.push(`${where}.id must be a non-empty string`);
            if (!ELEMENT_TYPES.includes(el.type)) errors.push(`${where}.type "${el.type}" is not a known element type`);
            for (const k of ["x", "y", "w", "h"] as const) {
                const v = el[k];
                if (typeof v !== "number" || v < 0 || v > 1) errors.push(`${where}.${k} must be a number in 0..1`);
            }
        });
    });
    return { ok: errors.length === 0, errors };
}

/** A deck migration: transform a deck from version `to - 1` into version `to`. */
export type DeckMigration = (deck: any) => any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Consumer-registered migrations, keyed by the version they migrate *to*. */
const deckMigrations: Record<number, DeckMigration> = {};

/**
 * Register a migration that upgrades a deck from version `toVersion - 1` to
 * `toVersion`. Called by `migrateDeck` (and so by `<DeckEditor>` / `useDeckState`
 * on load). Keep these in lockstep with `dark-slide`'s PHP-side migrations.
 *
 * ```ts
 * registerDeckMigration(2, (deck) => ({ ...deck, slides: deck.slides.map(addLayoutDefault) }));
 * ```
 */
export function registerDeckMigration(toVersion: number, migrate: DeckMigration): void {
    deckMigrations[toVersion] = migrate;
}

/**
 * Migrate a deck authored against an older schema version forward to the
 * current one, applying each registered {@link registerDeckMigration} step in
 * order, then stamping `version`. Idempotent: a current deck is returned
 * untouched (same reference), so callers can `if (migrated !== deck) persist()`.
 */
export function migrateDeck(deck: Deck): Deck {
    let d: any = deck; // eslint-disable-line @typescript-eslint/no-explicit-any
    let v = d.version ?? 1;
    while (v < SCHEMA_VERSION) {
        const to = v + 1;
        const fn = deckMigrations[to];
        if (fn) {
            d = fn(d);
            v = to;
        } else {
            v = SCHEMA_VERSION; // no migration registered for this step — jump to current
        }
    }
    return d.version === SCHEMA_VERSION ? d : { ...d, version: SCHEMA_VERSION };
}

/** Serialize a deck to a JSON string, stamping the current schema version. */
export function serializeDeck(deck: Deck, pretty = false): string {
    const stamped: Deck = deck.version === SCHEMA_VERSION ? deck : { ...deck, version: SCHEMA_VERSION };
    return JSON.stringify(stamped, null, pretty ? 2 : undefined);
}

/**
 * Parse a deck from a JSON string (or an already-parsed object), migrating it
 * forward and validating its structure. Throws a descriptive error when the
 * JSON is malformed or the structure is invalid — callers streaming untrusted
 * input should try/catch.
 */
export function parseDeck(input: string | unknown): Deck {
    let raw: unknown;
    if (typeof input === "string") {
        try {
            raw = JSON.parse(input);
        } catch (e) {
            throw new Error(`parseDeck: invalid JSON — ${(e as Error).message}`);
        }
    } else {
        raw = input;
    }
    const result = validateDeck(raw);
    if (!result.ok) {
        throw new Error(`parseDeck: invalid deck — ${result.errors.join("; ")}`);
    }
    return migrateDeck(raw as Deck);
}
