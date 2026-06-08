import { useCallback, useEffect, useMemo, useRef } from "react";

export interface SlideKeyboardOptions {
    /** Number of slides — clamps next/prev to bounds. */
    total: number;
    /** Current slide index. */
    index: number;
    /** Move to a specific slide. Used by Home/End/1-9 (and by arrows when no `onAdvance`/`onRetreat`). */
    goTo: (index: number) => void;
    /**
     * Forward step (→ / Space / PageDown). When provided it OWNS forward nav —
     * e.g. step through builds, then advance the slide. Falls back to
     * `goTo(index + 1)` when omitted.
     */
    onAdvance?: () => void;
    /**
     * Backward step (← / PageUp). When provided it OWNS backward nav. Falls back
     * to `goTo(index - 1)` when omitted.
     */
    onRetreat?: () => void;
    /** Called on Esc — typically exits fullscreen. */
    onExit?: () => void;
    /** Called on `B` — typically blacks/whites out the screen. */
    onBlank?: () => void;
    /** Called on `F` — typically toggles fullscreen. */
    onFullscreen?: () => void;
    /** Disable when the editor is focused / a modal is open. */
    enabled?: boolean;
}

/**
 * A custom shortcut handler. Return `true` to let the built-in keymap (and any
 * earlier-registered handler for the same combo) also run — by default a match
 * is consumed.
 */
export type ShortcutHandler = (event: KeyboardEvent) => void | boolean;

/** One row of the active keymap — for rendering a cheatsheet. */
export interface KeymapEntry {
    combo: string;
    description: string;
    source: "builtin" | "custom";
}

export interface SlideKeyboardApi {
    /**
     * Register an app-specific shortcut without forking the hook. Combos use a
     * `Mod+S` grammar (`Mod` = ⌘ on macOS, Ctrl elsewhere; also `Cmd`/`Ctrl`/
     * `Alt`/`Shift`), or a bare key (`/`, `Enter`). Most-recently-registered wins
     * for the same combo. Returns an `unregister` function.
     */
    registerShortcut: (combo: string, handler: ShortcutHandler, description?: string) => () => void;
    /** The active keymap (built-ins + registered) — render a cheatsheet without duplicating source. */
    activeKeymap: () => KeymapEntry[];
}

const BUILTIN_KEYMAP: KeymapEntry[] = [
    { combo: "→ / Space / PageDown", description: "Advance (next build / slide)", source: "builtin" },
    { combo: "← / PageUp", description: "Retreat (previous build / slide)", source: "builtin" },
    { combo: "Home", description: "First slide", source: "builtin" },
    { combo: "End", description: "Last slide", source: "builtin" },
    { combo: "1–9", description: "Jump to slide N", source: "builtin" },
    { combo: "Esc", description: "Exit", source: "builtin" },
    { combo: "B / .", description: "Blank screen", source: "builtin" },
    { combo: "F", description: "Toggle fullscreen", source: "builtin" },
];

function isMac(): boolean {
    if (typeof navigator === "undefined") return false;
    return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || "");
}

function canon(meta: boolean, ctrl: boolean, alt: boolean, shift: boolean, key: string): string {
    const mods: string[] = [];
    if (meta) mods.push("meta");
    if (ctrl) mods.push("ctrl");
    if (alt) mods.push("alt");
    if (shift) mods.push("shift");
    mods.sort();
    return [...mods, key.toLowerCase()].join("+");
}

/** Parse a combo string (`"Mod+S"`, `"Cmd+K"`, `"/"`) into the canonical form. */
function parseCombo(combo: string): string {
    const segs = combo.split("+").map((s) => s.trim()).filter(Boolean);
    const key = segs.pop() ?? "";
    let meta = false,
        ctrl = false,
        alt = false,
        shift = false;
    for (const s of segs) {
        const m = s.toLowerCase();
        if (m === "mod") (isMac() ? (meta = true) : (ctrl = true));
        else if (m === "cmd" || m === "meta" || m === "super" || m === "win") meta = true;
        else if (m === "ctrl" || m === "control") ctrl = true;
        else if (m === "alt" || m === "option" || m === "opt") alt = true;
        else if (m === "shift") shift = true;
    }
    return canon(meta, ctrl, alt, shift, key);
}

function eventCombo(e: KeyboardEvent): string {
    return canon(e.metaKey, e.ctrlKey, e.altKey, e.shiftKey, e.key);
}

/**
 * Standard slideshow keyboard plumbing, plus a `registerShortcut` extension
 * point for app-specific combos.
 *
 *   ←   / PageUp     — retreat (onRetreat, else previous slide)
 *   →   / PageDown / Space — advance (onAdvance, else next slide)
 *   Home / End        — first / last slide
 *   Esc               — onExit
 *   B / .             — onBlank (blackout)
 *   F                 — onFullscreen
 *   1..9              — jump to slide N
 *
 * Returns a {@link SlideKeyboardApi} — existing callers that ignore the return
 * value keep working unchanged.
 */
export function useSlideKeyboard({
    total,
    index,
    goTo,
    onAdvance,
    onRetreat,
    onExit,
    onBlank,
    onFullscreen,
    enabled = true,
}: SlideKeyboardOptions): SlideKeyboardApi {
    // Registered shortcuts live in a ref so registering doesn't re-bind the
    // keydown listener; each entry keeps its raw combo + description for the keymap.
    const shortcutsRef = useRef<Map<string, { handler: ShortcutHandler; combo: string; description: string }>>(new Map());

    const registerShortcut = useCallback<SlideKeyboardApi["registerShortcut"]>((combo, handler, description = "") => {
        const key = parseCombo(combo);
        const entry = { handler, combo, description };
        shortcutsRef.current.set(key, entry);
        return () => {
            // Only remove if a newer registration hasn't replaced it.
            if (shortcutsRef.current.get(key) === entry) shortcutsRef.current.delete(key);
        };
    }, []);

    const activeKeymap = useCallback<SlideKeyboardApi["activeKeymap"]>(() => {
        const custom: KeymapEntry[] = [...shortcutsRef.current.values()].map((e) => ({
            combo: e.combo,
            description: e.description,
            source: "custom" as const,
        }));
        return [...BUILTIN_KEYMAP, ...custom];
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const editable = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
            const hasMod = e.metaKey || e.ctrlKey || e.altKey;

            // Custom shortcuts fire first. A modifier combo (Cmd+S) works even
            // while typing; a bare-key combo (/) is suppressed inside inputs so
            // it doesn't hijack text entry.
            if (hasMod || !editable) {
                const shortcut = shortcutsRef.current.get(eventCombo(e));
                if (shortcut) {
                    const chain = shortcut.handler(e);
                    if (chain !== true) return; // consumed unless it opts into chaining
                }
            }

            // Built-in navigation never runs while editing text.
            if (editable) return;

            switch (e.key) {
                case "ArrowLeft":
                case "PageUp":
                    e.preventDefault();
                    if (onRetreat) onRetreat();
                    else if (index > 0) goTo(index - 1);
                    return;
                case "ArrowRight":
                case "PageDown":
                case " ":
                    e.preventDefault();
                    if (onAdvance) onAdvance();
                    else if (index < total - 1) goTo(index + 1);
                    return;
                case "Home":
                    e.preventDefault();
                    goTo(0);
                    return;
                case "End":
                    e.preventDefault();
                    goTo(total - 1);
                    return;
                case "Escape":
                    if (onExit) {
                        e.preventDefault();
                        onExit();
                    }
                    return;
                case "b":
                case "B":
                case ".":
                    if (onBlank) {
                        e.preventDefault();
                        onBlank();
                    }
                    return;
                case "f":
                case "F":
                    if (onFullscreen) {
                        e.preventDefault();
                        onFullscreen();
                    }
                    return;
                default: {
                    const n = parseInt(e.key, 10);
                    if (Number.isFinite(n) && n >= 1 && n <= 9) {
                        e.preventDefault();
                        goTo(Math.min(total - 1, n - 1));
                    }
                }
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [enabled, index, total, goTo, onAdvance, onRetreat, onExit, onBlank, onFullscreen]);

    return useMemo<SlideKeyboardApi>(() => ({ registerShortcut, activeKeymap }), [registerShortcut, activeKeymap]);
}
