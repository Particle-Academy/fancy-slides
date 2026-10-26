import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FullScreenProvider, useFullScreen, type FullScreenMode } from "@particle-academy/react-fancy";
import type {
    ChartElement,
    CodeElement,
    Deck,
    DeckOp,
    ImageElement,
    ShapeElement,
    ShapeKind,
    Slide as SlideData,
    SlideElement,
    TableElement,
    TextElement,
    Theme,
} from "../../types";
import { resolveTheme } from "../../theme/theme-utils";
import { builtinThemes } from "../../theme/default-theme";
import { elementId } from "../../utils/ids";
import { useDeckState, type IdStrategy } from "../../hooks/use-deck-state";
import { migrateDeck } from "../../utils/serialize";
import { chartStarterOption, type ChartKind } from "../../utils/chart-presets";
import { type ToolbarApi } from "../EditorToolbar";
import { defaultElementRegistry } from "../../registry";
import { DeckEditorContext, type DeckEditorContextValue } from "./context";
import { normalizeZoom, stepZoom as nextZoomStep, zoomScale as scaleFor, type DeckZoom } from "../../utils/zoom";

export interface DeckEditorProviderProps {
    /** Controlled deck — pair with `onChange`. */
    value: Deck;
    /** Called only for a change a person or an op made -- never on mount. */
    onChange: (next: Deck) => void;
    /**
     * Called once per deck id, after mount, when the deck is on an older schema
     * and `migrateDeck` upgraded it. Not an edit: persist it if you want the
     * stamped shape, or ignore it. Omit it and nothing is migrated.
     */
    onNormalize?: (normalized: Deck) => void;
    /** Called after every mutation with the op that produced it — feed into AgentPanel / audit log. */
    onOp?: (op: DeckOp) => void;
    /** Called when the user clicks Present. The host decides how to open the SlideViewer. */
    onPresent?: () => void;
    /** Controlled selected slide id. Uncontrolled by default. */
    selectedSlideId?: string | null;
    onSelectedSlideChange?: (id: string | null) => void;
    /**
     * Renderer for chart / code / table / embed elements. Defaults to the
     * built-in `defaultElementRegistry`; pass your own to override (it wins
     * entirely).
     */
    renderElement?: (element: SlideElement, slideWidthPx: number) => ReactNode | undefined;
    /**
     * Theme list the toolbar's picker offers. Defaults to the built-in themes;
     * pass user-authored themes (`[...builtinThemes, myTheme]`) to extend it.
     */
    themes?: Theme[];
    /** Who mints new slide/element ids. Defaults to `"client"`. See {@link IdStrategy}. */
    idStrategy?: IdStrategy;
    /**
     * Controlled canvas zoom: `"fit"`, `"fit-width"`, or a scale of the slide's
     * design size (`1` = 100%). Pair with `onZoomChange`. A view state: changing
     * it never calls `onChange`.
     */
    zoom?: DeckZoom;
    /** Initial zoom when uncontrolled. Default `"fit"` (the pre-zoom behaviour). */
    defaultZoom?: DeckZoom;
    /** Called when the person (toolbar, Ctrl/Cmd + `=` / `-` / `0`) asks for a zoom. */
    onZoomChange?: (zoom: DeckZoom) => void;
    /**
     * Controlled full screen. Pair with `onFullScreenChange`. A view state: it
     * never calls `onChange`. Runs on react-fancy's `useFullScreen`, the same
     * behaviour as `Editor`.
     */
    fullScreen?: boolean;
    /** Initial full screen when uncontrolled. Default `false`. */
    defaultFullScreen?: boolean;
    /** Called with the requested state: the toolbar toggle, Escape, `setFullScreen`, or leaving the browser's own full screen. */
    onFullScreenChange?: (fullScreen: boolean) => void;
    /**
     * `"overlay"` (default): the editor covers the viewport in place, lifted
     * into the browser top layer where supported. `"native"`: the browser
     * Fullscreen API, falling back to the overlay when refused.
     */
    fullScreenMode?: FullScreenMode;
    /** The composed editor — `DeckEditor.*` slots plus any app chrome. */
    children: ReactNode;
}

/**
 * Runs the editor controller — op surface, slide + element selection, insert
 * handlers, the toolbar action surface — and provides it to every
 * `DeckEditor.*` slot via {@link useDeckEditor}. `<DeckEditor>` mounts this for
 * you with its default layout; mount it yourself to compose a bespoke editor
 * from the slot parts (and your own panels) sharing one controller.
 *
 * Controlled (`value` + `onChange`). The same `DeckOp` enum the agent bridge
 * speaks runs through here — agents and humans drive identical mutations.
 */
export function DeckEditorProvider({
    value,
    onChange,
    onNormalize,
    onOp,
    onPresent,
    selectedSlideId: controlledSlideId,
    onSelectedSlideChange,
    renderElement = defaultElementRegistry,
    themes,
    idStrategy = "client",
    zoom: controlledZoom,
    defaultZoom = "fit",
    onZoomChange,
    fullScreen: controlledFullScreen,
    defaultFullScreen = false,
    onFullScreenChange,
    fullScreenMode = "overlay",
    children,
}: DeckEditorProviderProps) {
    const deck = value;
    const ops = useDeckState({ value: deck, onChange, onOp, idStrategy });

    // Opening a deck is not editing it. This used to migrate the deck forward
    // and report the result through `onChange`, so any deck without the
    // current `version` stamp (every deck dark-slide reads back from a pptx)
    // fired onChange on mount -- twice under StrictMode -- and a host could not
    // tell "opened" from "edited". onChange is now reserved for changes a
    // person or an op made; a host that wants the upgraded shape gets it from
    // `onNormalize` (or calls `migrateDeck` itself). Reported once per deck id:
    // the ref survives StrictMode's effect replay, so the replay is a no-op.
    const normalizedFor = useRef<string | null>(null);
    useEffect(() => {
        if (!onNormalize || normalizedFor.current === value.id) return;
        normalizedFor.current = value.id;
        const migrated = migrateDeck(value);
        if (migrated !== value) onNormalize(migrated);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value.id]);

    // Slide selection — controlled or internal.
    const [internalSlideId, setInternalSlideId] = useState<string | null>(deck.slides[0]?.id ?? null);
    const isControlled = controlledSlideId !== undefined;
    const slideId = isControlled ? controlledSlideId! : internalSlideId;
    const setSlideId = useCallback(
        (id: string | null) => {
            if (!isControlled) setInternalSlideId(id);
            onSelectedSlideChange?.(id);
        },
        [isControlled, onSelectedSlideChange],
    );

    // If the selected slide disappears (deletion / agent ops), fall back to the first slide.
    useEffect(() => {
        if (slideId && !deck.slides.some((s) => s.id === slideId)) {
            setSlideId(deck.slides[0]?.id ?? null);
        } else if (!slideId && deck.slides.length > 0) {
            setSlideId(deck.slides[0]!.id);
        }
    }, [deck.slides, slideId, setSlideId]);

    const slide: SlideData | undefined = deck.slides.find((s) => s.id === slideId);

    // Element selection — internal, resets on slide change.
    const [elementIdSelected, setElementIdSelected] = useState<string | null>(null);
    useEffect(() => {
        setElementIdSelected(null);
    }, [slideId]);

    const selectedElement = slide && elementIdSelected ? slide.elements.find((e) => e.id === elementIdSelected) ?? null : null;

    // ─── Toolbar insert handlers ───────────────────────────────────────────
    const insertEl = useCallback(
        (element: Omit<SlideElement, "id">) => {
            if (!slide) return;
            const id = ops.addElement(slide.id, { id: elementId(), ...element });
            setElementIdSelected(id);
        },
        [slide, ops],
    );

    const insertText = useCallback(
        () =>
            insertEl({
                type: "text",
                x: 0.1,
                y: 0.4,
                w: 0.8,
                h: 0.2,
                content: "Click to edit",
                format: "plain",
                style: { fontSize: 36, weight: "semibold", align: "center" },
            } as Omit<TextElement, "id">),
        [insertEl],
    );

    const insertImage = useCallback(
        () =>
            insertEl({
                type: "image",
                x: 0.25,
                y: 0.25,
                w: 0.5,
                h: 0.5,
                src: "https://placehold.co/600x400?text=Image",
                fit: "contain",
            } as Omit<ImageElement, "id">),
        [insertEl],
    );

    const insertShape = useCallback(
        (shape: ShapeKind) =>
            insertEl({
                type: "shape",
                shape,
                x: 0.3,
                y: 0.3,
                w: 0.4,
                h: 0.4,
                fill: shape === "line" || shape === "arrow" ? "none" : "rgba(139,92,246,0.15)",
                stroke: "#8b5cf6",
                strokeWidth: 2,
            } as Omit<ShapeElement, "id">),
        [insertEl],
    );

    const insertChart = useCallback(
        (kind: ChartKind = "bar") =>
            insertEl({
                type: "chart",
                x: 0.1,
                y: 0.2,
                w: 0.8,
                h: 0.6,
                option: chartStarterOption(kind),
            } as Omit<ChartElement, "id">),
        [insertEl],
    );

    const insertCode = useCallback(
        () =>
            insertEl({
                type: "code",
                x: 0.15,
                y: 0.2,
                w: 0.7,
                h: 0.6,
                code: "function hello() {\n  return \"world\";\n}\n",
                language: "typescript",
                codeTheme: "dark",
            } as Omit<CodeElement, "id">),
        [insertEl],
    );

    const insertTable = useCallback(
        () =>
            insertEl({
                type: "table",
                x: 0.15,
                y: 0.25,
                w: 0.7,
                h: 0.5,
                columns: [
                    { key: "name", label: "Name" },
                    { key: "value", label: "Value" },
                ],
                rows: [
                    { name: "Alpha", value: 12 },
                    { name: "Beta", value: 34 },
                    { name: "Gamma", value: 56 },
                ],
            } as Omit<TableElement, "id">),
        [insertEl],
    );

    const insert = useMemo<DeckEditorContextValue["insert"]>(
        () => ({ text: insertText, image: insertImage, shape: insertShape, chart: insertChart, code: insertCode, table: insertTable }),
        [insertText, insertImage, insertShape, insertChart, insertCode, insertTable],
    );

    const themeList = themes ?? Object.values(builtinThemes);

    // ─── Canvas zoom (view state; never touches the deck) ──────────────────
    const [internalZoom, setInternalZoom] = useState<DeckZoom>(() => normalizeZoom(defaultZoom));
    const zoomControlled = controlledZoom !== undefined;
    const zoom = zoomControlled ? normalizeZoom(controlledZoom!) : internalZoom;
    const [canvasWidth, setCanvasWidth] = useState<number | null>(null);
    const resolvedTheme = useMemo(() => resolveTheme(deck.theme), [deck.theme]);
    const designWidth = resolvedTheme.slideWidth ?? 1920;
    const currentScale = scaleFor(zoom, canvasWidth, designWidth);
    const setZoom = useCallback(
        (z: DeckZoom) => {
            const next = normalizeZoom(z);
            if (!zoomControlled) setInternalZoom(next);
            onZoomChange?.(next);
        },
        [zoomControlled, onZoomChange],
    );
    const stepZoom = useCallback(
        (direction: 1 | -1) => setZoom(nextZoomStep(currentScale ?? (typeof zoom === "number" ? zoom : 1), direction)),
        [setZoom, currentScale, zoom],
    );

    // ─── Full screen (view state; react-fancy's primitive, not our own) ────
    // The editor root goes over the viewport IN PLACE: nothing is portalled or
    // remounted, so selection, the inline text editor and the canvas's
    // ResizeObserver all survive, and "fit" refits to the bigger canvas.
    const fs = useFullScreen<HTMLDivElement>({
        fullScreen: controlledFullScreen,
        defaultFullScreen,
        onFullScreenChange,
        mode: fullScreenMode,
    });

    // The toolbar action surface — handed to a custom `renderToolbar`, and the
    // source for the default toolbar too.
    const toolbarApi: ToolbarApi = useMemo(
        () => ({
            title: { value: deck.title, onChange: (t) => ops.setTitle(t) },
            theme: { name: deck.theme.name, themes: themeList, onApply: (t) => ops.applyTheme(t) },
            insert,
            present: onPresent,
            disabled: !slide,
            zoom: { value: zoom, onChange: setZoom },
        }),
        [deck.title, deck.theme.name, themeList, ops, insert, onPresent, slide, zoom, setZoom],
    );

    const ctx = useMemo<DeckEditorContextValue>(
        () => ({
            deck,
            theme: resolvedTheme,
            ops,
            slideId,
            setSlideId,
            slide,
            selectedElementId: elementIdSelected,
            setSelectedElementId: setElementIdSelected,
            selectedElement,
            insert,
            toolbarApi,
            renderElement,
            themes: themeList,
            onPresent,
            zoom,
            setZoom,
            stepZoom,
            zoomScale: currentScale,
            canvasWidth,
            setCanvasWidth,
            fullScreen: fs.fullScreen,
            setFullScreen: fs.setFullScreen,
            fullScreenTargetProps: fs.targetProps,
        }),
        [
            deck,
            resolvedTheme,
            ops,
            slideId,
            setSlideId,
            slide,
            elementIdSelected,
            selectedElement,
            insert,
            toolbarApi,
            renderElement,
            themeList,
            onPresent,
            zoom,
            setZoom,
            stepZoom,
            currentScale,
            canvasWidth,
            fs.fullScreen,
            fs.setFullScreen,
            fs.targetProps,
        ],
    );

    // FullScreenProvider makes `FullScreen.Toggle` (and `EditorToolbar.FullScreen`)
    // work anywhere inside, and redirects descendant react-fancy Portals (the
    // toolbar's dropdowns, the zoom select, tooltips) into the editor while it
    // is full screen, so they are not left under the overlay.
    return (
        <DeckEditorContext.Provider value={ctx}>
            <FullScreenProvider value={fs}>{children}</FullScreenProvider>
        </DeckEditorContext.Provider>
    );
}
