import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Deck, SlideElement } from "../../types";
import { resolveTheme } from "../../theme/theme-utils";
import { Slide } from "../Slide";
import { useSlideKeyboard } from "../../hooks/use-slide-keyboard";
import { cn } from "../../utils/cn";

export interface PresenterViewProps {
    /** Deck being presented. */
    deck: Deck;
    /** Controlled current slide index. */
    index?: number;
    /** Default current slide index (uncontrolled). */
    defaultIndex?: number;
    /** Called when the presenter advances. */
    onIndexChange?: (index: number) => void;
    /** Called when the presenter exits (Esc). */
    onExit?: () => void;
    /** Reset the elapsed timer to this `Date.now()` value. Defaults to mount time. */
    startedAt?: number;
    /** Optional custom renderer for non-built-in element types. */
    renderElement?: (element: SlideElement, slideWidthPx: number) => ReactNode | undefined;
    className?: string;
}

/**
 * Speaker-only side view designed to live on a second monitor while the
 * audience sees a `<SlideViewer>`. Layout:
 *
 *   ┌────────────────────────────┬────────────────────┐
 *   │                            │  next slide        │
 *   │                            ├────────────────────┤
 *   │  current slide             │                    │
 *   │  (largest viewport)        │  speaker notes     │
 *   │                            │                    │
 *   ├────────────────────────────┴────────────────────┤
 *   │  3 / 12   elapsed 04:21   clock 14:35   prev /  │
 *   │                                          next   │
 *   └─────────────────────────────────────────────────┘
 *
 * Keyboard: same set as SlideViewer — ←/→/Space/Esc/Home/End/B/F/1-9.
 * Notes pane shows the current slide's `notes` field (rendered as
 * preformatted text for now; markdown rendering arrives with the
 * ContentRenderer integration in 0.2).
 */
export function PresenterView({
    deck,
    index: controlledIndex,
    defaultIndex,
    onIndexChange,
    onExit,
    startedAt,
    renderElement,
    className,
}: PresenterViewProps) {
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

    useSlideKeyboard({
        total: deck.slides.length,
        index,
        goTo,
        onExit,
    });

    const theme = resolveTheme(deck.theme);
    const slide = deck.slides[index];
    const nextSlide = deck.slides[index + 1];

    // Tick once a second for the clock + elapsed timer.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    const startedAtRef = useMemo(() => startedAt ?? now, [startedAt]); // initial mount captures now
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: capture mount time once

    return (
        <div
            className={cn("fs-presenter", className)}
            style={{
                display: "grid",
                gridTemplateRows: "1fr auto",
                gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
                width: "100%",
                height: "100%",
                background: "#0b1220",
                color: "#f8fafc",
                fontFamily: theme.fonts?.body,
            }}
            data-fancy-slides-presenter={deck.id}
        >
            {/* Current slide — left, full height of the upper row */}
            <div
                style={{
                    gridRow: 1,
                    gridColumn: 1,
                    padding: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 0,
                }}
            >
                <div
                    style={{
                        width: "100%",
                        aspectRatio: String(theme.aspectRatio ?? 16 / 9),
                        maxHeight: "100%",
                        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                        borderRadius: 8,
                        overflow: "hidden",
                    }}
                >
                    {slide ? <Slide slide={slide} theme={theme} renderElement={renderElement} /> : null}
                </div>
            </div>

            {/* Right column — next slide on top, notes below */}
            <div
                style={{
                    gridRow: 1,
                    gridColumn: 2,
                    display: "grid",
                    gridTemplateRows: "auto 1fr",
                    gap: 12,
                    padding: 24,
                    paddingLeft: 0,
                    minHeight: 0,
                }}
            >
                <div>
                    <SectionLabel>Up next</SectionLabel>
                    {nextSlide ? (
                        <div
                            style={{
                                marginTop: 8,
                                width: "100%",
                                aspectRatio: String(theme.aspectRatio ?? 16 / 9),
                                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                                borderRadius: 6,
                                overflow: "hidden",
                                opacity: 0.85,
                            }}
                        >
                            <Slide slide={nextSlide} theme={theme} renderElement={renderElement} />
                        </div>
                    ) : (
                        <div
                            style={{
                                marginTop: 8,
                                display: "grid",
                                placeItems: "center",
                                aspectRatio: String(theme.aspectRatio ?? 16 / 9),
                                borderRadius: 6,
                                border: "1px dashed rgba(255,255,255,0.2)",
                                color: "rgba(255,255,255,0.4)",
                                fontSize: 13,
                            }}
                        >
                            End of deck
                        </div>
                    )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <SectionLabel>Speaker notes</SectionLabel>
                    <pre
                        style={{
                            marginTop: 8,
                            flex: 1,
                            overflow: "auto",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 6,
                            padding: 12,
                            fontFamily: theme.fonts?.body,
                            fontSize: 15,
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            color: "rgba(248,250,252,0.92)",
                            margin: 0,
                        }}
                    >
                        {slide?.notes?.trim() || (
                            <span style={{ color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>
                                No notes for this slide.
                            </span>
                        )}
                    </pre>
                </div>
            </div>

            {/* Status bar — bottom, spans both columns */}
            <div
                style={{
                    gridRow: 2,
                    gridColumn: "1 / span 2",
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    padding: "12px 24px",
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    fontSize: 13,
                    color: "rgba(248,250,252,0.7)",
                    fontFamily: theme.fonts?.mono,
                }}
            >
                <StatusChip label="Slide">
                    {index + 1} / {deck.slides.length}
                </StatusChip>
                <StatusChip label="Elapsed">{formatElapsed(now - startedAtRef)}</StatusChip>
                <StatusChip label="Clock">{formatClock(now)}</StatusChip>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <NavButton onClick={() => goTo(index - 1)} disabled={index === 0}>
                        ← Prev
                    </NavButton>
                    <NavButton onClick={() => goTo(index + 1)} disabled={index >= deck.slides.length - 1}>
                        Next →
                    </NavButton>
                </div>
            </div>
        </div>
    );
}

function SectionLabel({ children }: { children: ReactNode }) {
    return (
        <div
            style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "rgba(248,250,252,0.5)",
                fontWeight: 600,
            }}
        >
            {children}
        </div>
    );
}

function StatusChip({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
            <span
                style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "rgba(248,250,252,0.4)",
                }}
            >
                {label}
            </span>
            <span style={{ color: "rgba(248,250,252,0.92)", fontWeight: 600 }}>{children}</span>
        </div>
    );
}

function NavButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(248,250,252,0.92)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.4 : 1,
                fontSize: 13,
                fontFamily: "inherit",
            }}
        >
            {children}
        </button>
    );
}

function formatClock(ms: number): string {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatElapsed(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}
