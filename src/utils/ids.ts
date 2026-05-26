/**
 * Stable id generator. Deliberately simple — uses a counter + timestamp so
 * generated ids are URL-safe and human-readable, not cryptographically
 * unique. Servers / collaborative sessions should overwrite these with real
 * UUIDs when persisting.
 */

let counter = 0;

export function nextId(prefix = "id"): string {
    counter = (counter + 1) % 1_000_000;
    const t = Date.now().toString(36);
    const c = counter.toString(36).padStart(4, "0");
    return `${prefix}-${t}-${c}`;
}

export function slideId(): string {
    return nextId("s");
}

export function elementId(): string {
    return nextId("e");
}

export function deckId(): string {
    return nextId("d");
}
