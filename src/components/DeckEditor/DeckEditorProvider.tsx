import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

export interface DeckEditorProviderProps {
    /** Controlled deck — pair with `onChange`. */
    value: Deck;
    onChange: (next: Deck) => void;
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
    onOp,
    onPresent,
    selectedSlideId: controlledSlideId,
    onSelectedSlideChange,
    renderElement = defaultElementRegistry,
    themes,
    idStrategy = "client",
    children,
}: DeckEditorProviderProps) {
    const deck = value;
    const ops = useDeckState({ value: deck, onChange, onOp, idStrategy });

    // Migrate an older-schema deck forward on load and emit one normalized
    // onChange so the consumer can persist the upgraded shape. migrateDeck is
    // idempotent (returns the same ref once current), so this won't loop. Keyed
    // on deck id: a freshly-loaded deck re-runs the migration.
    useEffect(() => {
        const migrated = migrateDeck(value);
        if (migrated !== value) onChange(migrated);
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

    // The toolbar action surface — handed to a custom `renderToolbar`, and the
    // source for the default toolbar too.
    const toolbarApi: ToolbarApi = useMemo(
        () => ({
            title: { value: deck.title, onChange: (t) => ops.setTitle(t) },
            theme: { name: deck.theme.name, themes: themeList, onApply: (t) => ops.applyTheme(t) },
            insert,
            present: onPresent,
            disabled: !slide,
        }),
        [deck.title, deck.theme.name, themeList, ops, insert, onPresent, slide],
    );

    const ctx = useMemo<DeckEditorContextValue>(
        () => ({
            deck,
            theme: resolveTheme(deck.theme),
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
        }),
        [deck, ops, slideId, setSlideId, slide, elementIdSelected, selectedElement, insert, toolbarApi, renderElement, themeList, onPresent],
    );

    return <DeckEditorContext.Provider value={ctx}>{children}</DeckEditorContext.Provider>;
}
