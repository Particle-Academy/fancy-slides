import { fontStack } from "../../utils/font-stack";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FauxClient, type FauxClientProps } from "@particle-academy/react-fancy";
import type { Deck, SlideElement, SlideTransition } from "../../types";
import { resolveTheme } from "../../theme/theme-utils";
import { Slide } from "../Slide";
import { useSlideKeyboard } from "../../hooks/use-slide-keyboard";
import { totalBuildSteps } from "../../utils/builds";
import { cn } from "../../utils/cn";
import { defaultElementRegistry } from "../../registry";
import { STAGE_SURFACE } from "../../utils/zoom";

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
    /**
     * Custom renderer for element types Slide doesn't render natively
     * (chart/code/table/embed). Defaults to the built-in
     * `defaultElementRegistry` so decks play fully out of the box; pass your
     * own to override.
     */
    renderElement?: (element: SlideElement, slideWidthPx: number) => ReactNode | undefined;
    /** Extra classes on the viewer wrapper. */
    className?: string;
    /**
     * Show the deck in react-fancy's `FauxClient` frame: a device bezel with a
     * zoom bar and a full-screen button, out of sight until the frame is
     * hovered. Default `true`; `false` for the bare viewer, as before 0.21.
     */
    frame?: boolean;
    /** Passed to the frame: `variant`, `zoom` / `onZoomChange`, `onFullscreenChange`, … */
    frameProps?: Partial<FauxClientProps>;
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
    renderElement = defaultElementRegistry,
    className,
    frame = true,
    frameProps,
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
    const frameRef = useRef<HTMLDivElement>(null);
    // The frame shows the zoom controls; the SLIDE does the zooming, because a
    // viewer that fits itself to its box only re-fits under a scaled frame.
    const [ownZoom, setOwnZoom] = useState(frameProps?.defaultZoom ?? 1);
    const zoom = frame ? (frameProps?.zoom ?? ownZoom) : 1;
    const onZoomChange = useCallback(
        (z: number) => {
            setOwnZoom(z);
            frameProps?.onZoomChange?.(z);
        },
        [frameProps],
    );

    // Track nav direction so `slide` transitions default sensibly: advancing
    // forward enters from the right, going back enters from the left.
    const prevIndexRef = useRef(index);
    const forward = index >= prevIndexRef.current;

    // ─── Intra-slide build (entrance-animation) step-through ────────────────
    // 0 = nothing built yet on the current slide. Each forward advance fires
    // the next step until `totalBuildSteps`, after which we move to the next
    // slide. Going backward lands on the previous slide fully built.
    const slide = deck.slides[index];
    const totalSteps = totalBuildSteps(slide);
    const [buildStep, setBuildStep] = useState(0);

    // Reset the build step on slide change. Only a forward advance INTO the next
    // slide replays builds from 0; every other landing (retreat, Home/End,
    // digit jump, external control) shows the slide fully built. `nextFreshRef`
    // flags the one forward-advance case.
    const nextFreshRef = useRef(false);
    useEffect(() => {
        if (index === prevIndexRef.current) return;
        prevIndexRef.current = index;
        const fresh = nextFreshRef.current;
        nextFreshRef.current = false;
        setBuildStep(fresh ? 0 : totalBuildSteps(deck.slides[index]));
    }, [index, deck.slides]);

    const advance = useCallback(() => {
        if (buildStep < totalSteps) {
            setBuildStep((s) => s + 1);
        } else if (index < deck.slides.length - 1) {
            nextFreshRef.current = true; // next slide starts with nothing built
            goTo(index + 1);
        }
    }, [buildStep, totalSteps, index, deck.slides.length, goTo]);

    const retreat = useCallback(() => {
        // v1: reversing individual builds is out of scope — step back a whole
        // slide, showing it fully built (handled by the reset effect).
        if (index > 0) goTo(index - 1);
    }, [index, goTo]);

    useSlideKeyboard({
        total: deck.slides.length,
        index,
        goTo,
        onAdvance: advance,
        onRetreat: retreat,
        onExit,
        onBlank: () => setBlanked((b) => !b),
        onFullscreen: () => {
            // The frame, not the viewer: full screen keeps the zoom bar and the
            // exit button, and the frame's own button stays in step with it.
            const el = frame ? frameRef.current : containerRef.current;
            if (!el) return;
            if (document.fullscreenElement) document.exitFullscreen();
            else el.requestFullscreen?.();
        },
    });

    // Auto-advance loop for kiosk mode — steps through builds then slides.
    useEffect(() => {
        if (!autoAdvanceMs || deck.slides.length <= 1) return;
        const t = setTimeout(() => {
            if (buildStep < totalSteps) {
                setBuildStep((s) => s + 1);
            } else {
                nextFreshRef.current = true;
                goTo(index + 1 < deck.slides.length ? index + 1 : 0);
            }
        }, autoAdvanceMs);
        return () => clearTimeout(t);
    }, [autoAdvanceMs, index, deck.slides.length, goTo, buildStep, totalSteps]);
    const theme = resolveTheme(deck.theme);
    const aspectRatio = theme.aspectRatio ?? 16 / 9;

    // Resolve the incoming slide's entrance transition (slide → theme default → none).
    const transition: SlideTransition | undefined = slide?.transition ?? theme.defaultTransition;
    const enterStyle = transitionEnterStyle(transition, forward);

    const viewer = (
        <div
            ref={containerRef}
            className={cn("fs-viewer", className)}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                // The letterbox is the HOST's surface, so it follows the host's light /
                // dark mode; the slide paints the deck's own background on top.
                // (It used to be the deck background: a white band around a
                // white slide inside a dark dialog, with no visible edge.)
                background: blanked ? "#000000" : STAGE_SURFACE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}
            tabIndex={0}
            data-fancy-slides-viewer={deck.id}
            data-fancy-slides-build-step={buildStep}
            onClick={(e) => {
                if (blanked) return;
                // Click zones: the left third goes back, the rest goes forward,
                // as in a book. A click anywhere used to go forward only.
                const box = e.currentTarget.getBoundingClientRect();
                if (box.width > 0 && e.clientX - box.left < box.width / 3) retreat();
                else advance();
            }}
        >
            {/* Keyframes for slide entrance transitions. Pure CSS — no runtime deps.
                Gated behind prefers-reduced-motion so animations vanish entirely
                for users who ask for less motion. */}
            <style>{TRANSITION_KEYFRAMES}</style>

            {!blanked && slide && (
                // What scrolls when the slide is zoomed past the frame. The
                // counter and the previous / next buttons sit outside it, so they
                // stay where they are.
                <div
                    data-fancy-slides-scroller=""
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        overflow: zoom > 1 ? "auto" : "hidden",
                        // A size container, so the slide can fit THIS box's
                        // height (cqh) rather than the window's (vh).
                        containerType: "size",
                    }}
                >
                <div
                    data-fancy-slides-slide-box=""
                    style={{
                        // Box that fits the slide while preserving aspect ratio,
                        // times the frame's zoom. `margin: auto` centres it while
                        // it fits and lets it scroll from its edge once it does not.
                        width: zoom === 1
                            ? "min(100cqw, calc(100cqh * var(--fs-ratio)))"
                            : `calc(min(100cqw, calc(100cqh * var(--fs-ratio))) * ${zoom})`,
                        flexShrink: 0,
                        margin: "auto",
                        aspectRatio: String(aspectRatio),
                        // CSS var lets us inline-style the aspect ratio so it works in any container.
                        ["--fs-ratio" as keyof React.CSSProperties as string]: aspectRatio.toString(),
                        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
                    } as React.CSSProperties}
                >
                    {/* Keyed by index so React remounts on every slide change and the
                        enter animation replays from its first frame. */}
                    <div key={index} className="fs-slide-enter" style={enterStyle}>
                        <Slide slide={slide} theme={theme} buildStep={buildStep} renderElement={renderElement} />
                    </div>
                </div>
                </div>
            )}

            {!blanked && index > 0 && (
                <button
                    type="button"
                    className="fs-nav"
                    data-fancy-slides-prev=""
                    aria-label="Previous slide"
                    title="Previous slide"
                    onClick={(e) => {
                        e.stopPropagation();
                        retreat();
                    }}
                    style={{ ...NAV_BUTTON, left: 12 }}
                >
                    <Chevron direction="left" />
                </button>
            )}
            {!blanked && (index < deck.slides.length - 1 || buildStep < totalSteps) && (
                <button
                    type="button"
                    className="fs-nav"
                    data-fancy-slides-next=""
                    aria-label="Next slide"
                    title="Next slide"
                    onClick={(e) => {
                        e.stopPropagation();
                        advance();
                    }}
                    style={{ ...NAV_BUTTON, right: 12 }}
                >
                    <Chevron direction="right" />
                </button>
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
                        fontFamily: fontStack(theme.fonts?.mono, "mono"),
                        backdropFilter: "blur(6px)",
                    }}
                    aria-label="Slide counter"
                >
                    {index + 1} / {deck.slides.length}
                </div>
            )}
        </div>
    );

    if (!frame) return viewer;

    return (
        <FauxClient
            ref={frameRef}
            variant="device"
            fill
            controls
            {...frameProps}
            zoom={zoom}
            onZoomChange={onZoomChange}
            applyZoom={false}
            className={cn("fs-viewer-frame", frameProps?.className)}
        >
            {viewer}
        </FauxClient>
    );
}

/** The previous / next buttons: hidden until the viewer is hovered, like the frame's controls. */
const NAV_BUTTON: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(15, 23, 42, 0.55)",
    color: "#f8fafc",
    cursor: "pointer",
    backdropFilter: "blur(6px)",
    zIndex: 2,
};

function Chevron({ direction }: { direction: "left" | "right" }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
        </svg>
    );
}

// ─── Transitions ─────────────────────────────────────────────────────────────

const DEFAULT_DURATION = 400;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out

/**
 * Build the inline style that drives a slide's entrance animation. The actual
 * keyframes live in {@link TRANSITION_KEYFRAMES}; here we just pick the right
 * `animation-name` + duration. `prefers-reduced-motion: reduce` is handled in
 * CSS (the keyframe-bearing rules are wrapped in a media query), so a reduced-
 * motion user simply sees the final frame with no movement.
 */
function transitionEnterStyle(transition: SlideTransition | undefined, forward: boolean): React.CSSProperties {
    const kind = transition?.kind ?? "none";
    if (kind === "none") return { width: "100%", height: "100%" };

    const duration = transition?.duration ?? DEFAULT_DURATION;
    let name: string;
    switch (kind) {
        case "fade":
            name = "fs-fade-in";
            break;
        case "zoom":
            name = "fs-zoom-in";
            break;
        case "slide": {
            const dir = transition?.direction ?? (forward ? "right" : "left");
            name = `fs-slide-in-${dir}`;
            break;
        }
        default:
            return { width: "100%", height: "100%" };
    }

    return {
        width: "100%",
        height: "100%",
        animationName: name,
        animationDuration: `${duration}ms`,
        animationTimingFunction: EASE,
        animationFillMode: "both",
    };
}

/**
 * Keyframes for every transition kind. Wrapped in
 * `@media (prefers-reduced-motion: no-preference)` so that reduced-motion users
 * get no animation at all — `animation-fill-mode: both` would otherwise pin the
 * element at its `from` frame, so we disable the animation entirely instead.
 */
const TRANSITION_KEYFRAMES = `
@media (prefers-reduced-motion: reduce) {
    .fs-slide-enter { animation: none !important; }
}
@media (prefers-reduced-motion: no-preference) {
    @keyframes fs-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes fs-zoom-in {
        from { opacity: 0; transform: scale(0.92); }
        to { opacity: 1; transform: scale(1); }
    }
    @keyframes fs-slide-in-right {
        from { opacity: 0; transform: translateX(8%); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fs-slide-in-left {
        from { opacity: 0; transform: translateX(-8%); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fs-slide-in-up {
        from { opacity: 0; transform: translateY(8%); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fs-slide-in-down {
        from { opacity: 0; transform: translateY(-8%); }
        to { opacity: 1; transform: translateY(0); }
    }
}
.fs-viewer .fs-nav { opacity: 0; transition: opacity 150ms ease; }
.fs-viewer:hover .fs-nav, .fs-viewer .fs-nav:focus-visible { opacity: 1; }
.fs-viewer .fs-nav:hover { background: rgba(15, 23, 42, 0.75) !important; }
@media (hover: none) { .fs-viewer .fs-nav { opacity: 1; } }
`;
