import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Deck, SlideElement } from "../../types";
import { resolveTheme } from "../../theme/theme-utils";
import { Slide } from "../Slide";
import { useSlideKeyboard } from "../../hooks/use-slide-keyboard";
import { cn } from "../../utils/cn";

export interface SlideViewerProps {
    /** Deck to play. */
    deck: Deck;
    /** Controlled current slide index. Use with `onIndexChange`. */
    index?: number;
    /** Default current slide index (uncontrolled). */
    defaultIndex?: number;
    /** Called when the viewer advances. */
    onIndexChange?: (index: number) => void;
    /** Called when the viewer exits (Esc). */
    onExit?: () => void;
    /** Auto-advance interval in ms — kiosk mode. Omit to disable. */
    autoAdvanceMs?: number;
    /** Hide the bottom progress bar + slide counter. */
    hideChrome?: boolean;
    /** Optional custom renderer for element types Slide doesn't render natively (chart/code/table/embed). */
    renderElement?: (element: SlideElement, slideWidthPx: number) => ReactNode | undefined;
    /** Extra classes on the viewer wrapper. */
    className?: string;
}

/**
 * Read-only deck viewer. Renders one slide at a time at the maximum size
 * that fits the container while preserving the theme's aspect ratio.
 * Keyboard nav is built in; expand a fullscreen-ready container around
 * `<SlideViewer>` to get the F11-style experience.
 */
export function SlideViewer({
    deck,
    index: controlledIndex,
    defaultIndex,
    onIndexChange,
    onExit,
    autoAdvanceMs,
    hideChrome = false,
    renderElement,
    className,
}: SlideViewerProps) {
    const isControlled = controlledIndex !== undefined;
    const [internalIndex, setInternalIndex] = useState(defaultIndex ?? 0);
    const index = isControlled ? controlledIndex! : internalIndex;

    const goTo = useCallback(
        (i: number) => {
            const clamped = Math.max(0, Math.min(deck.slides.length - 1, i));
            if (!isControlled) setInternalIndex(clamped);
            onIndexChange?.(clamped);
        },
        [deck.slides.length, isControlled, onIndexChange],
    );

    const [blanked, setBlanked] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useSlideKeyboard({
        total: deck.slides.length,
        index,
        goTo,
        onExit,
        onBlank: () => setBlanked((b) => !b),
        onFullscreen: () => {
            const el = containerRef.current;
            if (!el) return;
            if (document.fullscreenElement) document.exitFullscreen();
            else el.requestFullscreen?.();
        },
    });

    // Auto-advance loop for kiosk mode.
    useEffect(() => {
        if (!autoAdvanceMs || deck.slides.length <= 1) return;
        const t = setTimeout(() => {
            goTo(index + 1 < deck.slides.length ? index + 1 : 0);
        }, autoAdvanceMs);
        return () => clearTimeout(t);
    }, [autoAdvanceMs, index, deck.slides.length, goTo]);

    const slide = deck.slides[index];
    const theme = resolveTheme(deck.theme);
    const aspectRatio = theme.aspectRatio ?? 16 / 9;

    return (
        <div
            ref={containerRef}
            className={cn("fs-viewer", className)}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                background: blanked ? "#000000" : theme.colors?.background ?? "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}
            tabIndex={0}
            data-fancy-slides-viewer={deck.id}
        >
            {!blanked && slide && (
                <div
                    style={{
                        // Box that fits the slide while preserving aspect ratio.
                        width: "min(100%, calc(100vh * var(--fs-ratio)))",
                        aspectRatio: String(aspectRatio),
                        // CSS var lets us inline-style the aspect ratio so it works in any container.
                        ["--fs-ratio" as keyof React.CSSProperties as string]: aspectRatio.toString(),
                        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
                    } as React.CSSProperties}
                >
                    <Slide slide={slide} theme={theme} renderElement={renderElement} />
                </div>
            )}

            {!hideChrome && !blanked && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 16,
                        right: 16,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "rgba(15, 23, 42, 0.6)",
                        color: "#f8fafc",
                        fontSize: 12,
                        fontFamily: theme.fonts?.mono,
                        backdropFilter: "blur(6px)",
                    }}
                    aria-label="Slide counter"
                >
                    {index + 1} / {deck.slides.length}
                </div>
            )}
        </div>
    );
}
