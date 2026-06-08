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
import { Slide } from "../Slide";
import { SlideRail } from "../SlideRail";
import { EditorToolbar, type ToolbarApi } from "../EditorToolbar";
import { ElementInspector } from "../ElementInspector";
import { SpeakerNotes } from "../SpeakerNotes";
import { defaultElementRegistry } from "../../registry";

export interface DeckEditorProps {
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
     * Renderer for chart / code / table / embed elements (the elements this
     * package doesn't render natively). Defaults to the built-in
     * `defaultElementRegistry` so the editor is full out of the box; pass your
     * own to override (it wins entirely). The optional-peer hosts (chart/code)
     * load fancy-echarts/fancy-code via guarded dynamic imports, so the base
     * bundle never statically requires them.
     */
    renderElement?: (element: SlideElement, slideWidthPx: number) => ReactNode | undefined;
    /** Hide the slide rail (e.g. for embedded use). */
    hideRail?: boolean;
    /** Hide the speaker notes panel. */
    hideNotes?: boolean;
    /** Hide the toolbar. */
    hideToolbar?: boolean;
    /** Hide the inspector. */
    hideInspector?: boolean;
    /** Optional extra content on the toolbar's trailing edge. */
    toolbarExtra?: ReactNode;
    /**
     * Theme list the toolbar's picker offers. Defaults to the built-in themes;
     * pass user-authored themes (`[...builtinThemes, myTheme]`) to extend it.
     */
    themes?: Theme[];
    /** Who mints new slide/element ids. Defaults to `"client"`. See {@link IdStrategy}. */
    idStrategy?: IdStrategy;
    /**
     * Compose the toolbar yourself. Receives the toolbar action surface and
     * returns the toolbar node — typically built from `EditorToolbar` + its slot
     * components (`.Title` / `.Insert` / `.Themes` / `.Trailing`). When omitted,
     * the default toolbar is rendered.
     */
    renderToolbar?: (api: ToolbarApi) => ReactNode;
    className?: string;
}

/**
 * Full deck editor — toolbar + rail + canvas + inspector + speaker notes.
 *
 * Controlled (`value` + `onChange`). State is intentionally simple: deck
 * lives in the consumer, the editor just renders a view + dispatches ops.
 * The same `DeckOp` enum that the agent bridge speaks runs through here —
 * agents and humans drive identical mutations.
 */
export function DeckEditor({
    value,
    onChange,
    onOp,
    onPresent,
    selectedSlideId: controlledSlideId,
    onSelectedSlideChange,
    renderElement = defaultElementRegistry,
    hideRail = false,
    hideNotes = false,
    hideToolbar = false,
    hideInspector = false,
    toolbarExtra,
    themes,
    idStrategy = "client",
    renderToolbar,
    className,
}: DeckEditorProps) {
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
    const insert = useCallback(
        (element: Omit<SlideElement, "id">) => {
            if (!slide) return;
            const id = ops.addElement(slide.id, { id: elementId(), ...element });
            setElementIdSelected(id);
        },
        [slide, ops],
    );

    const insertText = useCallback(
        () =>
            insert({
                type: "text",
                x: 0.1,
                y: 0.4,
                w: 0.8,
                h: 0.2,
                content: "Click to edit",
                format: "plain",
                style: { fontSize: 36, weight: "semibold", align: "center" },
            } as Omit<TextElement, "id">),
        [insert],
    );

    const insertImage = useCallback(
        () =>
            insert({
                type: "image",
                x: 0.25,
                y: 0.25,
                w: 0.5,
                h: 0.5,
                src: "https://placehold.co/600x400?text=Image",
                fit: "contain",
            } as Omit<ImageElement, "id">),
        [insert],
    );

    const insertShape = useCallback(
        (shape: ShapeKind) =>
            insert({
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
        [insert],
    );

    const insertChart = useCallback(
        (kind: ChartKind = "bar") =>
            insert({
                type: "chart",
                x: 0.1,
                y: 0.2,
                w: 0.8,
                h: 0.6,
                option: chartStarterOption(kind),
            } as Omit<ChartElement, "id">),
        [insert],
    );

    const insertCode = useCallback(
        () =>
            insert({
                type: "code",
                x: 0.15,
                y: 0.2,
                w: 0.7,
                h: 0.6,
                code: "function hello() {\n  return \"world\";\n}\n",
                language: "typescript",
                codeTheme: "dark",
            } as Omit<CodeElement, "id">),
        [insert],
    );

    const insertTable = useCallback(
        () =>
            insert({
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
        [insert],
    );

    // The toolbar action surface — handed to a custom `renderToolbar`, and the
    // source for the default toolbar too.
    const toolbarApi: ToolbarApi = useMemo(
        () => ({
            title: { value: deck.title, onChange: (t) => ops.setTitle(t) },
            theme: { name: deck.theme.name, themes: themes ?? Object.values(builtinThemes), onApply: (t) => ops.applyTheme(t) },
            insert: { text: insertText, image: insertImage, shape: insertShape, chart: insertChart, code: insertCode, table: insertTable },
            present: onPresent,
            disabled: !slide,
        }),
        [deck.title, deck.theme.name, themes, ops, insertText, insertImage, insertShape, insertChart, insertCode, insertTable, onPresent, slide],
    );

    return (
        <div
            className={`fs-editor flex h-full w-full flex-col bg-zinc-100 dark:bg-zinc-950 ${className ?? ""}`}
            data-fancy-slides-editor={deck.id}
        >
            {/* Top toolbar */}
            {!hideToolbar &&
                (renderToolbar ? (
                    renderToolbar(toolbarApi)
                ) : (
                    <EditorToolbar
                        title={deck.title}
                        onTitleChange={(t) => ops.setTitle(t)}
                        themeName={deck.theme.name}
                        onApplyTheme={(t) => ops.applyTheme(t)}
                        themes={themes}
                        onInsertText={insertText}
                        onInsertImage={insertImage}
                        onInsertShape={insertShape}
                        onInsertChart={insertChart}
                        onInsertCode={insertCode}
                        onInsertTable={insertTable}
                        onPresent={onPresent}
                        disabled={!slide}
                        toolbarExtra={toolbarExtra}
                    />
                ))}

            {/* Main editing area */}
            <div className="flex min-h-0 flex-1">
                {/* Slide rail */}
                {!hideRail && (
                    <div className="w-56 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                        <SlideRail
                            slides={deck.slides}
                            selectedId={slideId}
                            theme={deck.theme}
                            onSelect={setSlideId}
                            onAdd={(after) => {
                                const id = ops.addSlide(after !== undefined ? after : deck.slides.length);
                                setSlideId(id);
                            }}
                            onDuplicate={(id) => {
                                const newId = ops.duplicateSlide(id);
                                setSlideId(newId);
                            }}
                            onRemove={(id) => ops.removeSlide(id)}
                            onReorder={(id, toIndex) => ops.reorderSlide(id, toIndex)}
                            renderElement={renderElement}
                        />
                    </div>
                )}

                {/* Canvas + notes */}
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-1 items-center justify-center overflow-auto p-6">
                        {slide ? (
                            <div
                                className="rounded-lg shadow-xl"
                                style={{
                                    width: "min(96%, 1280px)",
                                    aspectRatio: String(resolveTheme(deck.theme).aspectRatio ?? 16 / 9),
                                    background: "white",
                                }}
                            >
                                <Slide
                                    slide={slide}
                                    theme={deck.theme}
                                    editing
                                    onElementContentChange={(eid, content) => ops.updateElement(slide.id, eid, { content, format: "markdown" } as Partial<TextElement>)}
                                    onElementSelect={setElementIdSelected}
                                    selectedElementId={elementIdSelected}
                                    onElementMove={(eid, x, y) => ops.moveElement(slide.id, eid, x, y)}
                                    onElementResize={(eid, patch) => ops.updateElement(slide.id, eid, patch as Partial<SlideElement>)}
                                    renderElement={renderElement}
                                />
                            </div>
                        ) : (
                            <div className="grid place-items-center rounded-lg border border-dashed border-zinc-300 bg-white px-12 py-24 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
                                Add a slide to start editing.
                            </div>
                        )}
                    </div>

                    {/* Speaker notes */}
                    {!hideNotes && slide && (
                        <SpeakerNotes notes={slide.notes} onChange={(n) => ops.setNotes(slide.id, n)} />
                    )}
                </div>

                {/* Inspector */}
                {!hideInspector && (
                    <div className="w-72 shrink-0 overflow-y-auto">
                        <ElementInspector
                            element={selectedElement}
                            slide={slide ?? null}
                            onPatch={(patch) => slide && elementIdSelected && ops.updateElement(slide.id, elementIdSelected, patch)}
                            onDelete={() => {
                                if (!slide || !elementIdSelected) return;
                                ops.removeElement(slide.id, elementIdSelected);
                                setElementIdSelected(null);
                            }}
                            onLockToggle={(locked) => slide && elementIdSelected && ops.updateElement(slide.id, elementIdSelected, { locked } as Partial<SlideElement>)}
                            onSetTransition={(transition) => slide && ops.setTransition(slide.id, transition)}
                            onSetBackground={(background) => slide && ops.setBackground(slide.id, background)}
                            onSetLayout={(layout) => slide && ops.setLayout(slide.id, layout)}
                            onSetAnimation={(animation) => slide && elementIdSelected && ops.setAnimation(slide.id, elementIdSelected, animation)}
                            onSetElementAnimation={(eid, animation) => slide && ops.setAnimation(slide.id, eid, animation)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
