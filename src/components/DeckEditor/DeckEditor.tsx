import { type ReactNode } from "react";
import type { Deck, DeckOp, SlideElement, Theme } from "../../types";
import { type IdStrategy } from "../../hooks/use-deck-state";
import { type ToolbarApi } from "../EditorToolbar";
import { DeckEditorProvider } from "./DeckEditorProvider";
import {
    DeckEditorCanvas,
    DeckEditorInspector,
    DeckEditorNotes,
    DeckEditorRail,
    DeckEditorStatusBar,
    DeckEditorToolbar,
} from "./slots";

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
 *
 * This is the **default layout** over a shared controller. To build a bespoke
 * editor — reposition panels, drop an app panel *beside* them, restyle each —
 * compose the parts yourself: `<DeckEditor.Provider>` runs the controller, and
 * `DeckEditor.Toolbar` / `.Rail` / `.Canvas` / `.Inspector` / `.Notes` /
 * `.StatusBar` are slots that share it (selection included). `useDeckEditor()`
 * exposes the same controller to any panel of your own.
 */
export function DeckEditor({
    value,
    onChange,
    onOp,
    onPresent,
    selectedSlideId,
    onSelectedSlideChange,
    renderElement,
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
    return (
        <DeckEditorProvider
            value={value}
            onChange={onChange}
            onOp={onOp}
            onPresent={onPresent}
            selectedSlideId={selectedSlideId}
            onSelectedSlideChange={onSelectedSlideChange}
            renderElement={renderElement}
            themes={themes}
            idStrategy={idStrategy}
        >
            <div
                className={`fs-editor flex h-full w-full flex-col bg-zinc-100 dark:bg-zinc-950 ${className ?? ""}`}
                data-fancy-slides-editor={value.id}
            >
                {!hideToolbar && <DeckEditorToolbar renderToolbar={renderToolbar} extra={toolbarExtra} />}

                <div className="flex min-h-0 flex-1">
                    {!hideRail && <DeckEditorRail />}

                    <div className="flex min-w-0 flex-1 flex-col">
                        <DeckEditorCanvas />
                        {!hideNotes && <DeckEditorNotes />}
                    </div>

                    {!hideInspector && <DeckEditorInspector />}
                </div>
            </div>
        </DeckEditorProvider>
    );
}

// Compound slot statics — match the house style (direct assignment, like
// EditorToolbar.Title) so consumers compose `<DeckEditor.Provider>` +
// `<DeckEditor.Rail>` etc.
DeckEditor.Provider = DeckEditorProvider;
DeckEditor.Toolbar = DeckEditorToolbar;
DeckEditor.Rail = DeckEditorRail;
DeckEditor.Canvas = DeckEditorCanvas;
DeckEditor.Inspector = DeckEditorInspector;
DeckEditor.Notes = DeckEditorNotes;
DeckEditor.StatusBar = DeckEditorStatusBar;
