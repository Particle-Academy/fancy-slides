/**
 * The fancy-slides data model.
 *
 * Every shape here is JSON-friendly — pure objects, arrays, primitives, and
 * tagged unions. No React children, no functions, no class instances. This
 * is the contract the deck schema commits to: an LLM can emit a deck, a
 * server can store one, a designer can hand-edit one, and the viewer +
 * editor will render it identically.
 *
 * Coordinate system: elements position themselves in slide-relative units
 * where the slide is a 1.0 × (1 / aspectRatio) rectangle. So `x: 0.5, y: 0.5`
 * is the centre of the slide regardless of how big it's rendered. This
 * keeps decks resolution-independent — a fullscreen 1920×1080 viewer and a
 * thumbnail at 320×180 render the same layout.
 */

// ─── Deck ──────────────────────────────────────────────────────────────────

export interface Deck {
    /** Stable id. Required even when persistence is in-memory. */
    id: string;
    /** Human title — shown in the editor chrome + browser tab. */
    title: string;
    /** Ordered slide list. The viewer steps through in this order. */
    slides: Slide[];
    /** Visual theme for the whole deck. */
    theme: Theme;
    /** Free-form metadata — `{ author, createdAt, updatedAt, tags, … }`. */
    metadata?: Record<string, unknown>;
}

// ─── Slide ─────────────────────────────────────────────────────────────────

/** Layout presets that pre-populate / constrain element placement. */
export type SlideLayout =
    | "blank"            // empty canvas, free placement
    | "title"            // centered title
    | "title-content"    // title at top, content area below
    | "two-column"       // left + right halves
    | "section-divider"  // section header with subtitle
    | "image-text"       // image left, text right
    | "text-image"       // text left, image right
    | "quote";           // big centered quote

export interface Slide {
    /** Stable id. */
    id: string;
    /** Optional layout preset. Mostly used by agents — humans tend to free-place. */
    layout?: SlideLayout;
    /** Elements rendered on the slide in z-order (last on top). */
    elements: SlideElement[];
    /** Background fill — color, image, or gradient. Inherits from theme when absent. */
    background?: SlideBackground;
    /** Entrance transition for this slide. Inherits from theme.transition when absent. */
    transition?: SlideTransition;
    /** Speaker notes — markdown. */
    notes?: string;
    /** Free-form metadata — `{ title, tags, durationSec, … }`. */
    metadata?: Record<string, unknown>;
}

// ─── Elements ──────────────────────────────────────────────────────────────

/**
 * Every element is positioned in slide-relative coordinates (0..1). x/y are
 * the top-left corner; w/h are width/height as a fraction of the slide.
 */
export interface ElementBase {
    /** Stable id. Agents reference elements by id. */
    id: string;
    /** Element kind — discriminator. */
    type: SlideElement["type"];
    /** Left edge, 0..1 (fraction of slide width). */
    x: number;
    /** Top edge, 0..1 (fraction of slide height). */
    y: number;
    /** Width, 0..1. */
    w: number;
    /** Height, 0..1. */
    h: number;
    /** Rotation in degrees, clockwise. */
    rotation?: number;
    /** Z-order — higher renders on top. Falls back to array order when undefined. */
    z?: number;
    /** Lock from editing. */
    locked?: boolean;
    /** Hide on this slide (still in the data — for animated reveals). */
    hidden?: boolean;
    /** Entrance build animation — when present the element participates in the slide's build sequence. */
    animation?: ElementAnimation;
}

// ─── Element entrance animations (builds) ────────────────────────────────────

/** Visual entrance effect played when an element builds onto the slide. */
export type AnimationEffect = "fade" | "fly-in" | "zoom" | "wipe";

/** When an element's build fires relative to the surrounding builds. */
export type AnimationTrigger = "on-click" | "with-prev" | "after-prev";

/**
 * Per-element entrance animation ("build step"). Elements with an `animation`
 * start hidden and reveal as the presenter advances through the slide's build
 * sequence. The shape is shared with the sibling `dark-slide` PHP package, so
 * keep it byte-for-byte aligned.
 */
export interface ElementAnimation {
    /** Visual effect. */
    effect: AnimationEffect;
    /** When the build fires relative to its neighbours. Default `"on-click"`. */
    trigger?: AnimationTrigger;
    /** Direction for `fly-in` / `wipe`. Default `"left"`. */
    direction?: "left" | "right" | "up" | "down";
    /** Effect duration in ms. Default `500`. */
    duration?: number;
    /** Delay before the effect starts, in ms. Default `0`. */
    delay?: number;
    /** Build order within the slide, ascending; ties broken by element array index. */
    order?: number;
    /**
     * Reveal a TEXT element one paragraph/line at a time (PowerPoint/Google
     * Slides "By paragraph"). The element expands into one build per paragraph
     * — the element's `content` split on `"\n"` (a trailing empty line is
     * dropped). The first paragraph uses this animation's `trigger`; every
     * subsequent paragraph reveals on a fresh click. Only meaningful for text
     * elements; ignored for other types and when the element has 0/1 paragraphs
     * (then it behaves like a normal single build).
     */
    byParagraph?: boolean;
}

export interface TextElement extends ElementBase {
    type: "text";
    /** Content — markdown by default; can also be plain text or HTML. */
    content: string;
    /** Content format. Defaults to `"markdown"`. */
    format?: "markdown" | "html" | "plain";
    /** Typography. */
    style?: TextStyle;
}

export interface TextStyle {
    /** Font family — falls back to theme.fonts.body. */
    fontFamily?: string;
    /** Font size in px at the slide's design width (theme.slideWidth). */
    fontSize?: number;
    /** Font weight (`100..900`, or `"normal" | "bold"`). */
    weight?: "normal" | "medium" | "semibold" | "bold" | number;
    /** Horizontal alignment. */
    align?: "left" | "center" | "right" | "justify";
    /** Vertical alignment within the box. */
    verticalAlign?: "top" | "middle" | "bottom";
    /** Color (any CSS color). Falls back to theme.colors.text. */
    color?: string;
    /** Line height (multiplier). */
    lineHeight?: number;
    /** Italic. */
    italic?: boolean;
    /** Underline. */
    underline?: boolean;
}

export interface ImageElement extends ElementBase {
    type: "image";
    /** Image URL or data URI. */
    src: string;
    /** Alt text for accessibility. */
    alt?: string;
    /** How the image is fit inside its box. */
    fit?: "contain" | "cover" | "fill" | "scale-down";
    /** Optional crop window (slide-relative). */
    crop?: { x: number; y: number; w: number; h: number };
}

export interface ChartElement extends ElementBase {
    type: "chart";
    /** Apache ECharts option object. Passed straight to `<EChart>`. */
    option: Record<string, unknown>;
    /** Theme name passed to `<EChart>`. */
    chartTheme?: string;
}

export interface CodeElement extends ElementBase {
    type: "code";
    /** Source code. */
    code: string;
    /** Language alias for the highlighter. */
    language?: string;
    /** Show line numbers. Defaults to `true`. */
    lineNumbers?: boolean;
    /** Theme — `"light"`, `"dark"`, `"auto"`, or a custom registered name. */
    codeTheme?: string;
}

export interface TableElement extends ElementBase {
    type: "table";
    /** Column definitions — `{ key, label }`. */
    columns: Array<{ key: string; label: string }>;
    /** Row data — array of objects keyed by column. */
    rows: Array<Record<string, unknown>>;
}

export type ShapeKind = "rect" | "rounded-rect" | "ellipse" | "line" | "arrow" | "triangle";

export interface ShapeElement extends ElementBase {
    type: "shape";
    shape: ShapeKind;
    /** Fill color (any CSS color, or `"none"`). */
    fill?: string;
    /** Stroke color. */
    stroke?: string;
    /** Stroke width in px at the slide's design width. */
    strokeWidth?: number;
    /** Dashed stroke. */
    dashed?: boolean;
    /** Corner radius (px) for `rect` / `rounded-rect`. */
    radius?: number;
}

export interface EmbedElement extends ElementBase {
    type: "embed";
    /** Embed URL — typically a video, dashboard, or fancy-screens Screen. */
    src: string;
    /** iframe `title` for accessibility. */
    title?: string;
    /** Sandbox attribute. Defaults to allow-scripts (no allow-same-origin). */
    sandbox?: string;
}

export type SlideElement =
    | TextElement
    | ImageElement
    | ChartElement
    | CodeElement
    | TableElement
    | ShapeElement
    | EmbedElement;

// ─── Background, transitions, theme ────────────────────────────────────────

export interface SlideBackground {
    /** Solid color, or `"transparent"` to inherit theme. */
    color?: string;
    /** Image background URL. Takes precedence over color when present. */
    image?: string;
    /** How the background image is fit. Defaults to `"cover"`. */
    imageFit?: "contain" | "cover" | "fill";
    /** Optional gradient — `"linear-gradient(...)"` or `"radial-gradient(...)"` string. */
    gradient?: string;
}

export type TransitionKind = "none" | "fade" | "slide" | "zoom";

export interface SlideTransition {
    kind: TransitionKind;
    /** Duration in ms. */
    duration?: number;
    /** Direction for `slide` transitions. */
    direction?: "left" | "right" | "up" | "down";
}

export interface Theme {
    /** Theme name — used for serialization + agent routing. */
    name: string;
    /** Aspect ratio — defaults to 16:9. Custom themes can pick anything. */
    aspectRatio?: number;
    /** Design width in px. Slides scale to fit; this just sets the unit base for fontSize/strokeWidth. */
    slideWidth?: number;
    colors?: ThemeColors;
    fonts?: ThemeFonts;
    /** Default transition for slides that don't specify their own. */
    defaultTransition?: SlideTransition;
}

export interface ThemeColors {
    background?: string;
    text?: string;
    muted?: string;
    accent?: string;
    surface?: string;
}

export interface ThemeFonts {
    /** Used for `Heading`-like text elements (the default for large fontSize). */
    heading?: string;
    /** Used for body text. */
    body?: string;
    /** Used by CodeElement. */
    mono?: string;
}

// ─── Agent / Human+ surface ────────────────────────────────────────────────

/**
 * Agent activity broadcast whenever the deck mutates. Hosts subscribe to feed
 * an AgentPanel, presence layer, or audit log.
 */
export interface DeckActivity {
    /** Stable activity id. */
    id: string;
    /** Wall-clock timestamp. */
    at: number;
    /** Who made the change. */
    actor: { kind: "human" | "agent"; id: string; name?: string; color?: string };
    /** What changed. */
    op: DeckOp;
}

export type DeckOp =
    | { kind: "deck_set_title"; title: string }
    | { kind: "deck_apply_theme"; theme: Theme }
    | { kind: "slide_add"; index: number; slide: Slide }
    | { kind: "slide_remove"; id: string }
    | { kind: "slide_reorder"; id: string; toIndex: number }
    | { kind: "slide_set_layout"; id: string; layout: SlideLayout }
    | { kind: "slide_set_notes"; id: string; notes: string }
    | { kind: "slide_set_background"; id: string; background?: SlideBackground }
    | { kind: "slide_set_transition"; id: string; transition?: SlideTransition }
    | { kind: "element_add"; slideId: string; element: SlideElement }
    | { kind: "element_remove"; slideId: string; elementId: string }
    | { kind: "element_update"; slideId: string; elementId: string; patch: Partial<SlideElement> }
    | { kind: "element_move"; slideId: string; elementId: string; x: number; y: number }
    | { kind: "element_resize"; slideId: string; elementId: string; w: number; h: number }
    | { kind: "element_set_animation"; slideId: string; elementId: string; animation?: ElementAnimation };
