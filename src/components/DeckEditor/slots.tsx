import { type CSSProperties, type ReactNode } from "react";
import type { SlideElement, TextElement } from "../../types";
import { Slide } from "../Slide";
import { SlideRail } from "../SlideRail";
import { EditorToolbar, type ToolbarApi } from "../EditorToolbar";
import { ElementInspector } from "../ElementInspector";
import { SpeakerNotes } from "../SpeakerNotes";
import { useDeckEditor } from "./context";

export interface DeckEditorToolbarProps {
    className?: string;
    /**
     * Compose the toolbar yourself. Receives the toolbar action surface and
     * returns the toolbar node. When omitted, the default `EditorToolbar` is
     * rendered.
     */
    renderToolbar?: (api: ToolbarApi) => ReactNode;
    /** Extra content on the toolbar's trailing edge (default toolbar only). */
    extra?: ReactNode;
}

/**
 * The editor toolbar, wired to the shared controller. Renders the default
 * `EditorToolbar` from the `toolbarApi`, or your `renderToolbar(api)` node.
 */
export function DeckEditorToolbar({ className, renderToolbar, extra }: DeckEditorToolbarProps) {
    const { toolbarApi, deck, ops, themes } = useDeckEditor();
    if (renderToolbar) {
        return <>{renderToolbar(toolbarApi)}</>;
    }
    const bar = (
        <EditorToolbar
            title={deck.title}
            onTitleChange={(t) => ops.setTitle(t)}
            themeName={deck.theme.name}
            onApplyTheme={(t) => ops.applyTheme(t)}
            themes={themes}
            onInsertText={toolbarApi.insert.text}
            onInsertImage={toolbarApi.insert.image}
            onInsertShape={toolbarApi.insert.shape}
            onInsertChart={toolbarApi.insert.chart}
            onInsertCode={toolbarApi.insert.code}
            onInsertTable={toolbarApi.insert.table}
            onPresent={toolbarApi.present}
            disabled={toolbarApi.disabled}
            toolbarExtra={extra}
        />
    );
    // Keep the default layout's DOM byte-identical: wrap only when a className
    // is supplied (bespoke composition), otherwise render the bar bare.
    return className ? <div className={className}>{bar}</div> : bar;
}

export interface DeckEditorRailProps {
    className?: string;
    style?: CSSProperties;
}

/** The slide rail — thumbnails, add / duplicate / remove / reorder, selection. */
export function DeckEditorRail({ className, style }: DeckEditorRailProps) {
    const { deck, ops, slideId, setSlideId, renderElement } = useDeckEditor();
    return (
        <div
            className={`w-56 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950${className ? ` ${className}` : ""}`}
            style={style}
        >
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
    );
}

export interface DeckEditorCanvasProps {
    className?: string;
    style?: CSSProperties;
}

/** The centered, editable slide canvas (drag / resize / inline-edit). */
export function DeckEditorCanvas({ className, style }: DeckEditorCanvasProps) {
    const { deck, theme, slide, ops, selectedElementId, setSelectedElementId, renderElement } = useDeckEditor();
    return (
        <div className={`flex flex-1 items-center justify-center overflow-auto p-6${className ? ` ${className}` : ""}`} style={style}>
            {slide ? (
                <div
                    className="rounded-lg shadow-xl"
                    style={{
                        width: "min(96%, 1280px)",
                        aspectRatio: String(theme.aspectRatio ?? 16 / 9),
                        background: "white",
                    }}
                >
                    <Slide
                        slide={slide}
                        theme={deck.theme}
                        editing
                        onElementContentChange={(eid, content) => ops.updateElement(slide.id, eid, { content, format: "markdown" } as Partial<TextElement>)}
                        onElementSelect={setSelectedElementId}
                        selectedElementId={selectedElementId}
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
    );
}

export interface DeckEditorInspectorProps {
    className?: string;
    style?: CSSProperties;
}

/** The right-hand element / slide inspector. */
export function DeckEditorInspector({ className, style }: DeckEditorInspectorProps) {
    const { slide, ops, selectedElement, selectedElementId, setSelectedElementId } = useDeckEditor();
    return (
        <div className={`w-72 shrink-0 overflow-y-auto${className ? ` ${className}` : ""}`} style={style}>
            <ElementInspector
                element={selectedElement}
                slide={slide ?? null}
                onPatch={(patch) => slide && selectedElementId && ops.updateElement(slide.id, selectedElementId, patch)}
                onDelete={() => {
                    if (!slide || !selectedElementId) return;
                    ops.removeElement(slide.id, selectedElementId);
                    setSelectedElementId(null);
                }}
                onLockToggle={(locked) => slide && selectedElementId && ops.updateElement(slide.id, selectedElementId, { locked } as Partial<SlideElement>)}
                onSetTransition={(transition) => slide && ops.setTransition(slide.id, transition)}
                onSetBackground={(background) => slide && ops.setBackground(slide.id, background)}
                onSetLayout={(layout) => slide && ops.setLayout(slide.id, layout)}
                onSetAnimation={(animation) => slide && selectedElementId && ops.setAnimation(slide.id, selectedElementId, animation)}
                onSetElementAnimation={(eid, animation) => slide && ops.setAnimation(slide.id, eid, animation)}
            />
        </div>
    );
}

export interface DeckEditorNotesProps {
    className?: string;
    placeholder?: string;
}

/** Speaker notes for the active slide. Renders nothing when no slide is selected. */
export function DeckEditorNotes({ className, placeholder }: DeckEditorNotesProps) {
    const { slide, ops } = useDeckEditor();
    if (!slide) return null;
    const notes = <SpeakerNotes notes={slide.notes} onChange={(n) => ops.setNotes(slide.id, n)} placeholder={placeholder} />;
    // Match the default layout: render bare unless a className wrapper is asked for.
    return className ? <div className={className}>{notes}</div> : notes;
}

export interface DeckEditorStatusBarProps {
    className?: string;
    style?: CSSProperties;
    /** Custom content. Receives the shared controller for a bespoke bar. */
    children?: ReactNode | ((ctx: ReturnType<typeof useDeckEditor>) => ReactNode);
}

/**
 * A status bar summarizing the current slide + selection. Not part of the
 * default `<DeckEditor>` layout — drop it into a bespoke composition. Pass
 * `children` (node or render-prop) to replace the default summary entirely.
 */
export function DeckEditorStatusBar({ className, style, children }: DeckEditorStatusBarProps) {
    const ctx = useDeckEditor();
    const { deck, slideId, slide, selectedElement } = ctx;
    const cls = `fs-statusbar flex items-center gap-3 border-t border-zinc-200 bg-white px-4 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950${className ? ` ${className}` : ""}`;

    if (children !== undefined) {
        return (
            <div className={cls} style={style}>
                {typeof children === "function" ? children(ctx) : children}
            </div>
        );
    }

    const index = slideId ? deck.slides.findIndex((s) => s.id === slideId) : -1;
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    return (
        <div className={cls} style={style}>
            <span>{slide ? `Slide ${index + 1}/${deck.slides.length}` : `${deck.slides.length} slide${deck.slides.length === 1 ? "" : "s"}`}</span>
            {selectedElement && (
                <>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <span className="font-mono">{selectedElement.type}</span>
                    <span className="font-mono">
                        x {pct(selectedElement.x)} · y {pct(selectedElement.y)} · w {pct(selectedElement.w)} · h {pct(selectedElement.h)}
                    </span>
                </>
            )}
        </div>
    );
}
