import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Slide, SlideElement, Theme } from "../../types";
import { resolveTheme } from "../../theme/theme-utils";
import { cn } from "../../utils/cn";
import { TextElementRenderer } from "../elements/TextElement";
import { ImageElementRenderer } from "../elements/ImageElement";
import { ShapeElementRenderer } from "../elements/ShapeElement";
import { SlideContext, isDarkColor, type SlideContextValue } from "./slide-context";

export interface SlideProps {
    /** The slide to render. */
    slide: Slide;
    /** Deck theme — controls fonts/colors/aspect-ratio when the slide doesn't override. */
    theme?: Theme;
    /** Pin the slide to this width in px. When omitted, the slide fills its container with auto-resize. */
    width?: number;
    /** Aspect ratio override — falls back to theme.aspectRatio. */
    aspectRatio?: number;
    /** Edit mode flag — passed to element renderers + enables drag/resize affordances. */
    editing?: boolean;
    /** Called when a text element's content is edited (only in editing mode). */
    onElementContentChange?: (elementId: string, content: string) => void;
    /** Called when an element is clicked — host-driven selection. */
    onElementSelect?: (elementId: string | null) => void;
    /** Selected element id — adds a focus ring and shows resize handles when editing. */
    selectedElementId?: string | null;
    /** Called when the user drags an element body to a new position (slide-relative 0..1). */
    onElementMove?: (elementId: string, x: number, y: number) => void;
    /** Called when the user resizes via a corner / edge handle (slide-relative 0..1). */
    onElementResize?: (elementId: string, patch: { x: number; y: number; w: number; h: number }) => void;
    /** Optional override renderer for a custom element type (or to replace one of the built-ins). */
    renderElement?: (element: SlideElement, slideWidthPx: number) => ReactNode | undefined;
    className?: string;
    style?: CSSProperties;
}

/**
 * Slide — the shared renderer. Used by SlideViewer, DeckEditor canvas,
 * SlideThumbnail, and the agent bridge's preview tools. All resolution-
 * independence lives here: child elements get a `slideWidthPx` so they can
 * scale font sizes / stroke widths to the rendered slide size.
 *
 * In `editing` mode this component grows two extra affordances:
 *   - pointer-drag on an element body moves it
 *   - selected elements show 8 resize handles (4 corners, 4 edges)
 *
 * Both fire through `onElementMove` / `onElementResize` so the host owns
 * the state — Slide stays a pure renderer.
 */
export function Slide({
    slide,
    theme,
    width,
    aspectRatio,
    editing = false,
    onElementContentChange,
    onElementSelect,
    selectedElementId,
    onElementMove,
    onElementResize,
    renderElement,
    className,
    style,
}: SlideProps) {
    const t = resolveTheme(theme);
    const ratio = aspectRatio ?? t.aspectRatio ?? 16 / 9;
    const ref = useRef<HTMLDivElement>(null);
    const [measured, setMeasured] = useState<number>(width ?? 0);

    // Auto-measure when width isn't pinned.
    useEffect(() => {
        if (width !== undefined) {
            setMeasured(width);
            return;
        }
        const el = ref.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            for (const e of entries) {
                setMeasured(e.contentRect.width);
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [width]);

    const slideWidthPx = measured || 1;
    const slideHeightPx = slideWidthPx / ratio;

    const bg = slide.background;
    // The effective background colour used both for the slide div's `background`
    // and for the dark-theme heuristic exposed via SlideContext.
    const effectiveBg =
        bg?.color ?? t.colors?.background ?? "#ffffff";
    const backgroundStyle: CSSProperties = {
        background: bg?.gradient
            ? bg.gradient
            : bg?.image
                ? `${bg.color ?? "transparent"} url(${bg.image}) center/${bg.imageFit ?? "cover"} no-repeat`
                : effectiveBg,
    };

    const slideContext = useMemo<SlideContextValue>(
        () => ({
            theme: t,
            isDark: isDarkColor(effectiveBg),
            slideWidthPx,
        }),
        [t, effectiveBg, slideWidthPx],
    );

    return (
        <SlideContext.Provider value={slideContext}>
            <div
                ref={ref}
                className={cn("fs-slide", className)}
                style={{
                    width: width ? `${width}px` : "100%",
                    height: width ? `${width / ratio}px` : `${slideHeightPx}px`,
                    position: "relative",
                    overflow: "hidden",
                    color: t.colors?.text,
                    ...backgroundStyle,
                    ...style,
                }}
                data-fancy-slides-slide={slide.id}
                onClick={(e) => {
                    if (e.target === e.currentTarget && onElementSelect) onElementSelect(null);
                }}
            >
                {orderedElements(slide.elements).map((element) => (
                    <SlideElementHost
                        key={element.id}
                        element={element}
                        theme={t}
                        slideWidthPx={slideWidthPx}
                        slideHeightPx={slideHeightPx}
                        editing={editing}
                        selected={selectedElementId === element.id}
                        onContentChange={onElementContentChange}
                        onSelect={onElementSelect}
                        onMove={onElementMove}
                        onResize={onElementResize}
                        renderElement={renderElement}
                    />
                ))}
            </div>
        </SlideContext.Provider>
    );
}

interface SlideElementHostProps {
    element: SlideElement;
    theme: Theme;
    slideWidthPx: number;
    slideHeightPx: number;
    editing: boolean;
    selected: boolean;
    onContentChange?: (elementId: string, content: string) => void;
    onSelect?: (elementId: string | null) => void;
    onMove?: (elementId: string, x: number, y: number) => void;
    onResize?: (elementId: string, patch: { x: number; y: number; w: number; h: number }) => void;
    renderElement?: (element: SlideElement, slideWidthPx: number) => ReactNode | undefined;
}

/** Smallest allowed element size, as a fraction of the slide. */
const MIN_DIM = 0.02;

/** Drag distance below which we treat the gesture as a click. */
const CLICK_DRAG_THRESHOLD_PX = 3;

type ResizeAnchor = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface DragState {
    mode: "move" | ResizeAnchor;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    didMove: boolean;
}

function SlideElementHost({
    element,
    theme,
    slideWidthPx,
    slideHeightPx,
    editing,
    selected,
    onContentChange,
    onSelect,
    onMove,
    onResize,
    renderElement,
}: SlideElementHostProps) {
    const dragRef = useRef<DragState | null>(null);

    if (element.hidden) return null;

    const left = element.x * slideWidthPx;
    const top = element.y * slideHeightPx;
    const width = element.w * slideWidthPx;
    const height = element.h * slideHeightPx;

    const interactive = editing && !element.locked;
    const canMove = interactive && !!onMove;
    const canResize = interactive && !!onResize && selected;

    const startDrag = (mode: DragState["mode"]) => (e: ReactPointerEvent<HTMLElement>) => {
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = {
            mode,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startX: element.x,
            startY: element.y,
            startW: element.w,
            startH: element.h,
            didMove: false,
        };
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dxPx = e.clientX - drag.startClientX;
        const dyPx = e.clientY - drag.startClientY;
        if (Math.hypot(dxPx, dyPx) >= CLICK_DRAG_THRESHOLD_PX) drag.didMove = true;
        const dx = dxPx / slideWidthPx;
        const dy = dyPx / slideHeightPx;
        if (drag.mode === "move") {
            if (!onMove) return;
            const maxX = 1 - element.w;
            const maxY = 1 - element.h;
            const nextX = clamp(drag.startX + dx, 0, Math.max(0, maxX));
            const nextY = clamp(drag.startY + dy, 0, Math.max(0, maxY));
            onMove(element.id, nextX, nextY);
            return;
        }
        if (!onResize) return;
        const patch = computeResize(drag, dx, dy);
        onResize(element.id, patch);
    };

    const endDrag = (e: ReactPointerEvent<HTMLElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            /* element may have unmounted; ignore */
        }
        const wasMove = drag.didMove;
        dragRef.current = null;
        if (!wasMove && onSelect) onSelect(element.id);
    };

    const box: CSSProperties = {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        transformOrigin: "center center",
        zIndex: element.z ?? "auto",
        outline: selected ? "2px solid #8b5cf6" : undefined,
        outlineOffset: selected ? 2 : undefined,
        cursor: canMove ? "move" : interactive ? "pointer" : "default",
        touchAction: canMove ? "none" : undefined,
    };

    const inner = renderInner({ element, theme, slideWidthPx, editing, selected, onContentChange }) ?? renderElement?.(element, slideWidthPx);

    return (
        <div
            style={box}
            data-fancy-slides-element={element.id}
            data-fancy-slides-element-type={element.type}
            onPointerDown={canMove ? startDrag("move") : undefined}
            onPointerMove={canMove ? onPointerMove : undefined}
            onPointerUp={canMove ? endDrag : undefined}
            onPointerCancel={canMove ? endDrag : undefined}
            onClick={(e) => {
                // Click fallback for non-pointer environments / non-movable elements.
                if (!onSelect || canMove) return;
                e.stopPropagation();
                onSelect(element.id);
            }}
        >
            {inner}
            {canResize && (
                <ResizeHandles
                    onStart={(anchor) => startDrag(anchor)}
                    onMove={onPointerMove}
                    onEnd={endDrag}
                />
            )}
        </div>
    );
}

interface ResizeHandlesProps {
    onStart: (anchor: ResizeAnchor) => (e: ReactPointerEvent<HTMLElement>) => void;
    onMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onEnd: (e: ReactPointerEvent<HTMLElement>) => void;
}

function ResizeHandles({ onStart, onMove, onEnd }: ResizeHandlesProps) {
    const anchors: Array<{ anchor: ResizeAnchor; style: CSSProperties; cursor: string }> = [
        { anchor: "nw", style: { left: -5, top: -5 }, cursor: "nwse-resize" },
        { anchor: "n", style: { left: "calc(50% - 5px)", top: -5 }, cursor: "ns-resize" },
        { anchor: "ne", style: { right: -5, top: -5 }, cursor: "nesw-resize" },
        { anchor: "e", style: { right: -5, top: "calc(50% - 5px)" }, cursor: "ew-resize" },
        { anchor: "se", style: { right: -5, bottom: -5 }, cursor: "nwse-resize" },
        { anchor: "s", style: { left: "calc(50% - 5px)", bottom: -5 }, cursor: "ns-resize" },
        { anchor: "sw", style: { left: -5, bottom: -5 }, cursor: "nesw-resize" },
        { anchor: "w", style: { left: -5, top: "calc(50% - 5px)" }, cursor: "ew-resize" },
    ];
    return (
        <>
            {anchors.map(({ anchor, style, cursor }) => (
                <div
                    key={anchor}
                    style={{
                        position: "absolute",
                        width: 10,
                        height: 10,
                        background: "#ffffff",
                        border: "1.5px solid #8b5cf6",
                        borderRadius: 2,
                        cursor,
                        touchAction: "none",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                        ...style,
                    }}
                    data-fancy-slides-resize-handle={anchor}
                    onPointerDown={onStart(anchor)}
                    onPointerMove={onMove}
                    onPointerUp={onEnd}
                    onPointerCancel={onEnd}
                />
            ))}
        </>
    );
}

interface RenderInnerArgs {
    element: SlideElement;
    theme: Theme;
    slideWidthPx: number;
    editing: boolean;
    selected: boolean;
    onContentChange?: (elementId: string, content: string) => void;
}

function renderInner({ element, theme, slideWidthPx, editing, selected, onContentChange }: RenderInnerArgs): ReactNode | undefined {
    switch (element.type) {
        case "text":
            return (
                <TextElementRenderer
                    element={element}
                    theme={theme}
                    slideWidthPx={slideWidthPx}
                    editing={editing}
                    selected={selected}
                    onContentChange={onContentChange ? (c) => onContentChange(element.id, c) : undefined}
                />
            );
        case "image":
            return <ImageElementRenderer element={element} />;
        case "shape":
            return <ShapeElementRenderer element={element} theme={theme} slideWidthPx={slideWidthPx} />;
        case "chart":
        case "code":
        case "table":
        case "embed":
            // These render via consumer-provided `renderElement` so we don't
            // pull fancy-echarts / fancy-code / etc. into the package's static
            // graph. Hosts opt into the default registry from
            // `@particle-academy/fancy-slides/registry`.
            return undefined;
        default:
            return null;
    }
}

function orderedElements(elements: SlideElement[]): SlideElement[] {
    // Elements without a `z` keep their array order; explicit z overrides win.
    return [...elements].sort((a, b) => {
        const az = a.z ?? -1;
        const bz = b.z ?? -1;
        if (az === bz) return 0;
        return az < bz ? -1 : 1;
    });
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

/**
 * Given a drag delta + which anchor is being dragged, compute the patch
 * `{ x, y, w, h }` to apply. Clamps so dimensions stay >= MIN_DIM and the
 * element stays within the slide. Opposite edges stay fixed (e.g. dragging
 * the W handle moves the left edge but not the right).
 */
function computeResize(drag: DragState, dx: number, dy: number): { x: number; y: number; w: number; h: number } {
    let { startX: x, startY: y, startW: w, startH: h } = drag;
    const right = drag.startX + drag.startW;
    const bottom = drag.startY + drag.startH;
    const anchor = drag.mode as ResizeAnchor;

    if (anchor.includes("w")) {
        const newX = clamp(drag.startX + dx, 0, right - MIN_DIM);
        x = newX;
        w = right - newX;
    } else if (anchor.includes("e")) {
        w = clamp(drag.startW + dx, MIN_DIM, 1 - drag.startX);
    }
    if (anchor.includes("n")) {
        const newY = clamp(drag.startY + dy, 0, bottom - MIN_DIM);
        y = newY;
        h = bottom - newY;
    } else if (anchor.includes("s")) {
        h = clamp(drag.startH + dy, MIN_DIM, 1 - drag.startY);
    }
    return { x, y, w, h };
}
