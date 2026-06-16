export { DeckEditor } from "./DeckEditor";
export type { DeckEditorProps } from "./DeckEditor";

export { DeckEditorProvider } from "./DeckEditorProvider";
export type { DeckEditorProviderProps } from "./DeckEditorProvider";

export { useDeckEditor, DeckEditorContext } from "./context";
export type { DeckEditorContextValue, DeckEditorInsertApi } from "./context";

export {
    DeckEditorToolbar,
    DeckEditorRail,
    DeckEditorCanvas,
    DeckEditorInspector,
    DeckEditorNotes,
    DeckEditorStatusBar,
} from "./slots";
export type {
    DeckEditorToolbarProps,
    DeckEditorRailProps,
    DeckEditorCanvasProps,
    DeckEditorInspectorProps,
    DeckEditorNotesProps,
    DeckEditorStatusBarProps,
} from "./slots";
