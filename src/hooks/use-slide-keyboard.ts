import { useEffect } from "react";

export interface SlideKeyboardOptions {
    /** Number of slides — clamps next/prev to bounds. */
    total: number;
    /** Current slide index. */
    index: number;
    /** Move to a specific slide. */
    goTo: (index: number) => void;
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
 * Standard slideshow keyboard plumbing:
 *
 *   ←   / PageUp     — previous slide
 *   →   / PageDown / Space — next slide
 *   Home              — first slide
 *   End               — last slide
 *   Esc               — onExit
 *   B / .             — onBlank (blackout)
 *   F                 — onFullscreen
 *   1..9              — jump to slide N
 */
export function useSlideKeyboard({
    total,
    index,
    goTo,
    onExit,
    onBlank,
    onFullscreen,
    enabled = true,
}: SlideKeyboardOptions): void {
    useEffect(() => {
        if (!enabled) return;

        const handler = (e: KeyboardEvent) => {
            // Skip when typing in inputs / textareas / contenteditable.
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
                return;
            }

            switch (e.key) {
                case "ArrowLeft":
                case "PageUp":
                    e.preventDefault();
                    if (index > 0) goTo(index - 1);
                    return;
                case "ArrowRight":
                case "PageDown":
                case " ":
                    e.preventDefault();
                    if (index < total - 1) goTo(index + 1);
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
    }, [enabled, index, total, goTo, onExit, onBlank, onFullscreen]);
}
