import { useCallback, useEffect, useRef, useState } from "react";
import type { Deck, DeckOp } from "../types";
import { reduce } from "./use-deck-state";

/** Where the sync loop currently is. Render a save-status pill straight from this. */
export type DeckSyncStatus = "idle" | "saving" | "agent-active" | "error";

/**
 * Transport seam — supply your own persist + op channel for non-Laravel/Echo
 * stacks. When omitted, {@link useDeckSync} uses a built-in `fetch` PUT to
 * `persistUrl` (no live channel).
 */
export interface DeckSyncTransport {
    /** Persist the full deck. Reject to surface the `"error"` status. */
    persist: (deck: Deck) => Promise<void>;
    /**
     * Subscribe to a remote op channel. Invoke `onOp` for each incoming op;
     * return an unsubscribe function. Omit to skip live updates.
     */
    subscribe?: (onOp: (op: DeckOp) => void) => () => void;
}

export interface UseDeckSyncOptions {
    /** Initial deck (e.g. the Inertia/loader-provided document). */
    initial: Deck;
    /** Debounce window for the full-deck persist after edits. Default 600ms. */
    debounceMs?: number;
    /** A transport. Provide this OR `persistUrl`. */
    transport?: DeckSyncTransport;
    /** Laravel/Inertia convenience — PUT `{ deck }` as JSON here. Ignored when `transport` is set. */
    persistUrl?: string;
    /** Header carrying the CSRF token for `persistUrl`. Default `"X-XSRF-TOKEN"`. */
    csrfHeader?: string;
    /** CSRF token value. When omitted, read from the `XSRF-TOKEN` cookie. */
    csrfToken?: string;
    /** Notified whenever an op is applied — `source` distinguishes local edits from remote ops. */
    onOp?: (op: DeckOp, source: "local" | "remote") => void;
}

export interface DeckSyncApi {
    /** The live deck — feed to `<DeckEditor value={deck} onChange={setDeck} onOp={applyOp} />`. */
    deck: Deck;
    /** Apply a single op locally and debounce a save. Wire to `DeckEditor`'s `onOp`. */
    applyOp: (op: DeckOp) => void;
    /** Replace the whole deck and debounce a save. Wire to `DeckEditor`'s `onChange`. */
    setDeck: (deck: Deck) => void;
    /** `idle` | `saving` | `agent-active` | `error`. */
    status: DeckSyncStatus;
    /** Persist now, cancelling the pending debounce (e.g. on `Cmd+S` or before navigating away). */
    flush: () => void;
}

function readCookie(name: string): string | undefined {
    if (typeof document === "undefined") return undefined;
    const match = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

/**
 * The integration glue every live fancy-slides consumer otherwise hand-writes:
 * controlled deck state, debounced full-deck persist after direct edits, optional
 * remote op-channel subscription with replay, and a save-status indicator —
 * behind one hook.
 *
 * ```tsx
 * const { deck, applyOp, setDeck, status, flush } = useDeckSync({
 *   initial: document.deck,
 *   persistUrl: `/documents/${id}/deck`,
 *   transport: { persist, subscribe },   // or Laravel default via persistUrl
 * });
 * <DeckEditor value={deck} onChange={setDeck} onOp={applyOp} />
 * ```
 */
export function useDeckSync(options: UseDeckSyncOptions): DeckSyncApi {
    const { initial, debounceMs = 600, transport, persistUrl, csrfHeader = "X-XSRF-TOKEN", csrfToken, onOp } = options;

    const [deck, setDeckState] = useState<Deck>(initial);
    const [status, setStatus] = useState<DeckSyncStatus>("idle");

    // Latest deck, persist timer, and an "agent-active" decay timer — in refs so
    // callbacks stay stable and the persist always sees the freshest deck.
    const deckRef = useRef(deck);
    deckRef.current = deck;
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const agentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Stable refs to the option callbacks so the effect/handlers don't churn.
    const cfg = useRef({ transport, persistUrl, csrfHeader, csrfToken, onOp });
    cfg.current = { transport, persistUrl, csrfHeader, csrfToken, onOp };

    const doPersist = useCallback(async () => {
        const { transport: t, persistUrl: url, csrfHeader: header, csrfToken: token } = cfg.current;
        const current = deckRef.current;
        setStatus("saving");
        try {
            if (t) {
                await t.persist(current);
            } else if (url) {
                const xsrf = token ?? readCookie("XSRF-TOKEN");
                const res = await fetch(url, {
                    method: "PUT",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        ...(xsrf ? { [header]: xsrf } : {}),
                    },
                    body: JSON.stringify({ deck: current }),
                });
                if (!res.ok) throw new Error(`persist failed: ${res.status}`);
            }
            // Don't clobber an "agent-active" badge that arrived mid-save.
            setStatus((s) => (s === "agent-active" ? s : "idle"));
        } catch {
            setStatus("error");
        }
    }, []);

    const schedule = useCallback(() => {
        setStatus((s) => (s === "agent-active" ? s : "saving"));
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void doPersist(), debounceMs);
    }, [debounceMs, doPersist]);

    const flush = useCallback(() => {
        clearTimeout(saveTimer.current);
        void doPersist();
    }, [doPersist]);

    const applyOp = useCallback(
        (op: DeckOp) => {
            setDeckState((d) => reduce(d, op));
            cfg.current.onOp?.(op, "local");
            schedule();
        },
        [schedule],
    );

    const setDeck = useCallback(
        (next: Deck) => {
            setDeckState(next);
            schedule();
        },
        [schedule],
    );

    // Subscribe to the remote op channel: apply incoming ops + flag agent activity.
    useEffect(() => {
        const t = cfg.current.transport;
        if (!t?.subscribe) return;
        const unsub = t.subscribe((op) => {
            setDeckState((d) => reduce(d, op));
            cfg.current.onOp?.(op, "remote");
            setStatus("agent-active");
            clearTimeout(agentTimer.current);
            agentTimer.current = setTimeout(() => setStatus("idle"), 1500);
        });
        return () => {
            unsub?.();
        };
        // transport identity is captured via cfg.current; resubscribe only when the
        // transport reference itself changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transport]);

    // Flush any pending save on unmount.
    useEffect(() => {
        return () => {
            if (saveTimer.current) {
                clearTimeout(saveTimer.current);
                void doPersist();
            }
            clearTimeout(agentTimer.current);
        };
    }, [doPersist]);

    return { deck, applyOp, setDeck, status, flush };
}
