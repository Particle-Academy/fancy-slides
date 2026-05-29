// Components
export { Slide } from "./components/Slide";
export type { SlideProps } from "./components/Slide";
export { useSlideContext, useSlideTheme, useIsDarkSlide } from "./components/Slide/slide-context";
export type { SlideContextValue } from "./components/Slide/slide-context";

export { SlideViewer } from "./components/SlideViewer";
export type { SlideViewerProps } from "./components/SlideViewer";

export { PresenterView } from "./components/PresenterView";
export type { PresenterViewProps } from "./components/PresenterView";

export { SlideThumbnail } from "./components/SlideThumbnail";
export type { SlideThumbnailProps } from "./components/SlideThumbnail";

export { DeckEditor } from "./components/DeckEditor";
export type { DeckEditorProps } from "./components/DeckEditor";

export { SlideRail } from "./components/SlideRail";
export type { SlideRailProps } from "./components/SlideRail";

export { EditorToolbar } from "./components/EditorToolbar";
export type { EditorToolbarProps, ChartKind } from "./components/EditorToolbar";

export { ElementInspector } from "./components/ElementInspector";
export type { ElementInspectorProps } from "./components/ElementInspector";

export { SpeakerNotes } from "./components/SpeakerNotes";
export type { SpeakerNotesProps } from "./components/SpeakerNotes";

export { TextElementRenderer, PRESENTATION_EDITOR_ACTIONS, normalizeSlideMarkdown } from "./components/elements/TextElement";
export type { TextElementRendererProps } from "./components/elements/TextElement";

export { ImageElementRenderer } from "./components/elements/ImageElement";
export type { ImageElementRendererProps } from "./components/elements/ImageElement";

export { ShapeElementRenderer } from "./components/elements/ShapeElement";
export type { ShapeElementRendererProps } from "./components/elements/ShapeElement";

// Hooks
export { useSlideKeyboard } from "./hooks/use-slide-keyboard";
export type { SlideKeyboardOptions } from "./hooks/use-slide-keyboard";

export { useDeckState, reduce as reduceDeck } from "./hooks/use-deck-state";
export type { UseDeckStateOptions, DeckStateApi } from "./hooks/use-deck-state";

// Theme
export { defaultTheme, darkTheme, vividTheme, builtinThemes } from "./theme/default-theme";
export { defineTheme, resolveTheme } from "./theme/theme-utils";

// Utils
export { nextId, slideId, elementId, deckId } from "./utils/ids";
export { chartStarterOption } from "./utils/chart-presets";
export { collectBuilds, buildSteps, totalBuildSteps, visibleElementIds, buildsForStep, stepDelays, splitParagraphs, isByParagraph, paragraphReveals } from "./utils/builds";
export type { Build, BuildStep, ParaReveal } from "./utils/builds";
export { serializeDeck, parseDeck, validateDeck, migrateDeck } from "./utils/serialize";
export type { DeckValidation } from "./utils/serialize";

// Schema version constant
export { SCHEMA_VERSION } from "./types";

// Types
export type {
    Deck,
    Slide as SlideData,
    SlideLayout,
    SlideElement,
    SlideBackground,
    SlideTransition,
    TransitionKind,
    AnimationEffect,
    AnimationTrigger,
    ElementAnimation,
    ElementBase,
    TextElement,
    TextStyle,
    ImageElement,
    ChartElement,
    CodeElement,
    TableElement,
    ShapeElement,
    ShapeKind,
    EmbedElement,
    Theme,
    ThemeColors,
    ThemeFonts,
    DeckActivity,
    DeckOp,
} from "./types";
