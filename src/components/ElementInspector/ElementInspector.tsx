import { useRef } from "react";
import { Button, Card, ColorPicker, Heading, Input, Select, Separator, Slider, Switch, Tabs, Text, Textarea } from "@particle-academy/react-fancy";
import type { ElementAnimation, Slide as SlideData, SlideBackground, SlideElement, SlideLayout, SlideTransition, TextElement, TextStyle, ImageElement, ShapeElement, CodeElement, ChartElement, TableElement, EmbedElement } from "../../types";
import { chartModelFromOption, chartOptionFromModel, chartColorAt, type ChartKind, type ChartModel } from "../../utils/chart-presets";
import { collectBuilds } from "../../utils/builds";
import { CodeInput } from "./CodeInput";

export interface ElementInspectorProps {
    /** Element being inspected. `null` falls back to slide settings (or the empty state). */
    element: SlideElement | null;
    /** Patch a property on the element. */
    onPatch: (patch: Partial<SlideElement>) => void;
    /** Delete the element. */
    onDelete?: () => void;
    /** Lock toggle. */
    onLockToggle?: (locked: boolean) => void;
    /** Selected slide — shown when no element is selected so the user can edit slide-level settings. */
    slide?: SlideData | null;
    /** Set the slide's entrance transition. */
    onSetTransition?: (transition?: SlideTransition) => void;
    /** Set the slide's background. */
    onSetBackground?: (background?: SlideBackground) => void;
    /** Set the slide's layout preset. */
    onSetLayout?: (layout: SlideLayout) => void;
    /** Set or clear the selected element's entrance build animation. */
    onSetAnimation?: (animation?: ElementAnimation) => void;
    /** Set a specific element's build animation by id — used by the slide-level build-order list. */
    onSetElementAnimation?: (elementId: string, animation?: ElementAnimation) => void;
}

/**
 * Right-hand inspector. Tabs split position + style + advanced properties.
 * Per-element-type controls drop in under the Style tab. Built on
 * react-fancy `Card`, `Tabs`, `Input`, `Select`, `Slider`, `ColorPicker`,
 * `Button`.
 */
export function ElementInspector({ element, onPatch, onDelete, onLockToggle, slide, onSetTransition, onSetBackground, onSetLayout, onSetAnimation, onSetElementAnimation }: ElementInspectorProps) {
    // No element selected: show slide-level settings when a slide is available.
    if (!element) {
        if (slide) {
            return <SlideSettings slide={slide} onSetTransition={onSetTransition} onSetBackground={onSetBackground} onSetLayout={onSetLayout} onSetElementAnimation={onSetElementAnimation} />;
        }
        return (
            <div className="fs-inspector flex h-full flex-col border-l border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <Heading as="h3" size="xs" className="!uppercase !tracking-wider !text-zinc-500">
                    Inspector
                </Heading>
                <Text size="sm" className="mt-2 !text-zinc-500">
                    Select an element to edit its properties.
                </Text>
            </div>
        );
    }

    return (
        <div className="fs-inspector flex h-full w-full flex-col border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <Heading as="h3" size="xs" className="!font-mono !uppercase !tracking-wider !text-zinc-500">
                        {element.type}
                    </Heading>
                    <Text size="xs" className="!font-mono !text-zinc-400">
                        #{element.id.slice(-6)}
                    </Text>
                </div>
                <div className="flex items-center gap-1">
                    <Button size="xs" variant="ghost" icon={element.locked ? "lock" : "unlock"} onClick={() => onLockToggle?.(!element.locked)} aria-label={element.locked ? "Unlock" : "Lock"} />
                    {onDelete && (
                        <Button size="xs" variant="ghost" color="red" icon="trash" onClick={onDelete} aria-label="Delete" />
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                <Tabs defaultTab="style" variant="pills">
                    <Tabs.List>
                        <Tabs.Tab value="style">Style</Tabs.Tab>
                        <Tabs.Tab value="layout">Layout</Tabs.Tab>
                        <Tabs.Tab value="build">Build</Tabs.Tab>
                        <Tabs.Tab value="advanced">Advanced</Tabs.Tab>
                    </Tabs.List>
                    <Tabs.Panels>
                        <Tabs.Panel value="style">
                            <Card padding="md" className="!bg-white dark:!bg-zinc-950">
                                <StyleSection element={element} onPatch={onPatch} />
                            </Card>
                        </Tabs.Panel>
                        <Tabs.Panel value="build">
                            <Card padding="md" className="!bg-white dark:!bg-zinc-950">
                                <AnimateSection animation={element.animation} onSetAnimation={onSetAnimation} isText={element.type === "text"} />
                            </Card>
                        </Tabs.Panel>
                        <Tabs.Panel value="layout">
                            <Card padding="md" className="!bg-white dark:!bg-zinc-950">
                                <LayoutSection element={element} onPatch={onPatch} siblings={slide?.elements ?? []} />
                            </Card>
                        </Tabs.Panel>
                        <Tabs.Panel value="advanced">
                            <Card padding="md" className="!bg-white dark:!bg-zinc-950">
                                <AdvancedSection element={element} onPatch={onPatch} />
                            </Card>
                        </Tabs.Panel>
                    </Tabs.Panels>
                </Tabs>
            </div>
        </div>
    );
}

// ─── Slide settings ─────────────────────────────────────────────────────────

/**
 * Shown in the inspector column when a slide is selected but no element is.
 * Lets a human set the slide's entrance transition (and, as a nicety, its
 * background color). Mirrors the ElementInspector look — same Card/Tabs shell.
 */
const SLIDE_LAYOUTS: Array<{ value: SlideLayout; label: string }> = [
    { value: "blank", label: "Blank" },
    { value: "title", label: "Title" },
    { value: "title-content", label: "Title + content" },
    { value: "two-column", label: "Two column" },
    { value: "section-divider", label: "Section divider" },
    { value: "image-text", label: "Image + text" },
    { value: "text-image", label: "Text + image" },
    { value: "quote", label: "Quote" },
];

/** Which kind of background is active, for the background-mode switch. */
function backgroundMode(bg: SlideBackground | undefined): "color" | "gradient" | "image" {
    if (bg?.gradient) return "gradient";
    if (bg?.image) return "image";
    return "color";
}

function SlideSettings({
    slide,
    onSetTransition,
    onSetBackground,
    onSetLayout,
    onSetElementAnimation,
}: {
    slide: SlideData;
    onSetTransition?: (transition?: SlideTransition) => void;
    onSetBackground?: (background?: SlideBackground) => void;
    onSetLayout?: (layout: SlideLayout) => void;
    onSetElementAnimation?: (elementId: string, animation?: ElementAnimation) => void;
}) {
    const transition = slide.transition;
    const kind = transition?.kind ?? "none";
    const setTransition = (next: Partial<SlideTransition>) => {
        const merged: SlideTransition = { kind, duration: transition?.duration, direction: transition?.direction, ...next };
        // "none" carries no extra knobs — store the bare kind.
        onSetTransition?.(merged.kind === "none" ? { kind: "none" } : merged);
    };
    const bgMode = backgroundMode(slide.background);

    return (
        <div className="fs-inspector flex h-full w-full flex-col border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <Heading as="h3" size="xs" className="!font-mono !uppercase !tracking-wider !text-zinc-500">
                        slide
                    </Heading>
                    <Text size="xs" className="!font-mono !text-zinc-400">
                        #{slide.id.slice(-6)}
                    </Text>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                {onSetLayout && (
                    <Card padding="md" className="mb-3 !bg-white dark:!bg-zinc-950">
                        <div className="space-y-3">
                            <Heading as="h4" size="xs" className="!uppercase !tracking-wider !text-zinc-500">
                                Layout
                            </Heading>
                            <Select
                                label="Preset"
                                list={SLIDE_LAYOUTS}
                                value={slide.layout ?? "blank"}
                                onValueChange={(v) => onSetLayout(v as SlideLayout)}
                            />
                            <Text size="xs" className="!text-zinc-500">
                                The layout hint the deck commits to — carried through to the pptx export's slide layout.
                            </Text>
                        </div>
                    </Card>
                )}
                <Card padding="md" className="!bg-white dark:!bg-zinc-950">
                    <div className="space-y-3">
                        <Heading as="h4" size="xs" className="!uppercase !tracking-wider !text-zinc-500">
                            Transition
                        </Heading>
                        <Select
                            label="Kind"
                            list={[
                                { value: "none", label: "None" },
                                { value: "fade", label: "Fade" },
                                { value: "slide", label: "Slide" },
                                { value: "zoom", label: "Zoom" },
                            ]}
                            value={kind}
                            onValueChange={(v) => setTransition({ kind: v as SlideTransition["kind"] })}
                        />
                        {kind === "slide" && (
                            <Select
                                label="Direction"
                                list={[
                                    { value: "left", label: "From left" },
                                    { value: "right", label: "From right" },
                                    { value: "up", label: "From bottom" },
                                    { value: "down", label: "From top" },
                                ]}
                                value={transition?.direction ?? "right"}
                                onValueChange={(v) => setTransition({ direction: v as SlideTransition["direction"] })}
                            />
                        )}
                        {kind !== "none" && (
                            <Input
                                label="Duration (ms)"
                                type="number"
                                value={String(transition?.duration ?? 400)}
                                onChange={(e) => setTransition({ duration: parseInt(e.target.value, 10) || 400 })}
                            />
                        )}
                        <Text size="xs" className="!text-zinc-500">
                            Entrance animation played when this slide appears in the viewer. Falls back to the theme default. Honors prefers-reduced-motion.
                        </Text>
                    </div>
                </Card>

                {onSetBackground && (
                    <Card padding="md" className="mt-3 !bg-white dark:!bg-zinc-950">
                        <div className="space-y-3">
                            <Heading as="h4" size="xs" className="!uppercase !tracking-wider !text-zinc-500">
                                Background
                            </Heading>
                            <Select
                                label="Type"
                                list={[
                                    { value: "color", label: "Solid color" },
                                    { value: "gradient", label: "Gradient" },
                                    { value: "image", label: "Image" },
                                ]}
                                value={bgMode}
                                onValueChange={(v) => {
                                    // Switching type clears the other modes' fields so the
                                    // background carries exactly one source (matches the writer).
                                    if (v === "color") onSetBackground({ color: slide.background?.color ?? "#ffffff" });
                                    else if (v === "gradient") onSetBackground({ gradient: slide.background?.gradient ?? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" });
                                    else onSetBackground({ image: slide.background?.image ?? "", imageFit: slide.background?.imageFit ?? "cover", color: slide.background?.color });
                                }}
                            />
                            {bgMode === "color" && (
                                <FieldLabel label="Color">
                                    <ColorPicker
                                        value={slide.background?.color ?? "#ffffff"}
                                        onChange={(c) => onSetBackground({ color: c })}
                                    />
                                </FieldLabel>
                            )}
                            {bgMode === "gradient" && (
                                <Textarea
                                    label="CSS gradient"
                                    value={slide.background?.gradient ?? ""}
                                    onValueChange={(v) => onSetBackground({ gradient: v })}
                                    rows={2}
                                />
                            )}
                            {bgMode === "image" && (
                                <>
                                    <Textarea
                                        label="Image URL"
                                        value={slide.background?.image ?? ""}
                                        onValueChange={(v) => onSetBackground({ ...slide.background, image: v })}
                                        rows={2}
                                    />
                                    <Select
                                        label="Fit"
                                        list={[
                                            { value: "cover", label: "Cover" },
                                            { value: "contain", label: "Contain" },
                                            { value: "fill", label: "Fill (stretch)" },
                                        ]}
                                        value={slide.background?.imageFit ?? "cover"}
                                        onValueChange={(v) => onSetBackground({ ...slide.background, imageFit: v as SlideBackground["imageFit"] })}
                                    />
                                </>
                            )}
                        </div>
                    </Card>
                )}

                {onSetElementAnimation && (
                    <Card padding="md" className="mt-3 !bg-white dark:!bg-zinc-950">
                        <BuildOrderList slide={slide} onSetElementAnimation={onSetElementAnimation} />
                    </Card>
                )}
            </div>
        </div>
    );
}

/**
 * Compact build-sequence manager shown in slide settings. Lists the slide's
 * animated elements in build order with up/down buttons. Moving an item
 * reassigns sequential `order` values (0,1,2,…) to the whole list so the
 * sequence stays unambiguous.
 */
function BuildOrderList({
    slide,
    onSetElementAnimation,
}: {
    slide: SlideData;
    onSetElementAnimation: (elementId: string, animation?: ElementAnimation) => void;
}) {
    const builds = collectBuilds(slide);

    const move = (from: number, to: number) => {
        if (to < 0 || to >= builds.length) return;
        const reordered = [...builds];
        const [item] = reordered.splice(from, 1);
        reordered.splice(to, 0, item!);
        // Reassign sequential orders to the whole list.
        reordered.forEach((b, i) => {
            if ((b.animation.order ?? 0) !== i) {
                onSetElementAnimation(b.element.id, { ...b.animation, order: i });
            }
        });
    };

    return (
        <div className="space-y-2">
            <Heading as="h4" size="xs" className="!uppercase !tracking-wider !text-zinc-500">
                Build order
            </Heading>
            {builds.length === 0 ? (
                <Text size="xs" className="!text-zinc-500">
                    No animated elements yet. Select an element and add a build under its Build tab.
                </Text>
            ) : (
                builds.map((b, i) => (
                    <div key={b.element.id} className="flex items-center gap-2">
                        <Text size="xs" className="!font-mono !text-zinc-400 w-5">{i + 1}.</Text>
                        <div className="flex-1 min-w-0">
                            <Text size="sm" className="truncate">
                                {buildLabel(b.element)}
                            </Text>
                            <Text size="xs" className="!font-mono !text-zinc-400">
                                {b.animation.effect} · {b.animation.trigger ?? "on-click"}
                            </Text>
                        </div>
                        <Button size="xs" variant="ghost" icon="chevron-up" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move earlier" />
                        <Button size="xs" variant="ghost" icon="chevron-down" onClick={() => move(i, i + 1)} disabled={i === builds.length - 1} aria-label="Move later" />
                    </div>
                ))
            )}
        </div>
    );
}

/** Short human label for a build-list row. */
function buildLabel(element: SlideElement): string {
    if (element.type === "text") {
        const text = element.content.replace(/\s+/g, " ").trim();
        return text ? (text.length > 28 ? `${text.slice(0, 28)}…` : text) : "Text";
    }
    return `${element.type} #${element.id.slice(-6)}`;
}

// ─── Sections ──────────────────────────────────────────────────────────────

function LayoutSection({ element, onPatch, siblings }: { element: SlideElement; onPatch: (p: Partial<SlideElement>) => void; siblings: SlideElement[] }) {
    const zs = siblings.map((e) => e.z ?? 0);
    const bringToFront = () => onPatch({ z: (zs.length ? Math.max(...zs) : 0) + 1 });
    const sendToBack = () => onPatch({ z: (zs.length ? Math.min(...zs) : 0) - 1 });
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <Input label="X" type="number" value={String(roundFrac(element.x))} onChange={(e) => onPatch({ x: clamp(parseFloat(e.target.value), 0, 1) })} />
                <Input label="Y" type="number" value={String(roundFrac(element.y))} onChange={(e) => onPatch({ y: clamp(parseFloat(e.target.value), 0, 1) })} />
                <Input label="Width" type="number" value={String(roundFrac(element.w))} onChange={(e) => onPatch({ w: clamp(parseFloat(e.target.value), 0, 1) })} />
                <Input label="Height" type="number" value={String(roundFrac(element.h))} onChange={(e) => onPatch({ h: clamp(parseFloat(e.target.value), 0, 1) })} />
            </div>
            <Separator />
            <Slider label="Rotation" value={element.rotation ?? 0} onValueChange={(v) => onPatch({ rotation: Number(v) })} min={-180} max={180} />
            <div className="flex items-end gap-2">
                <Input label="Z-index" type="number" value={String(element.z ?? 0)} onChange={(e) => onPatch({ z: parseInt(e.target.value, 10) || 0 })} className="flex-1" />
                <Button size="sm" variant="ghost" onClick={bringToFront} aria-label="Bring to front">Front</Button>
                <Button size="sm" variant="ghost" onClick={sendToBack} aria-label="Send to back">Back</Button>
            </div>
            <Separator />
            <Input
                label="Link (href)"
                value={element.href ?? ""}
                placeholder="https://…"
                onChange={(e) => onPatch({ href: e.target.value || undefined } as Partial<SlideElement>)}
            />
            <Text size="xs" className="!text-zinc-500">
                Makes the whole element a click target in the viewer (opens a new tab) and exports as a pptx hyperlink. For links inside text, use markdown <code>[label](url)</code>.
            </Text>
        </div>
    );
}

function AdvancedSection({ element, onPatch }: { element: SlideElement; onPatch: (p: Partial<SlideElement>) => void }) {
    return (
        <div className="space-y-3">
            <Input label="Element id" value={element.id} disabled />
            <Text size="xs" className="!text-zinc-500">
                The element id is stable — agents reference elements by id.
            </Text>
            <Separator />
            <div className="flex items-center gap-2">
                <Button size="sm" variant={element.hidden ? "default" : "ghost"} onClick={() => onPatch({ hidden: !element.hidden })}>
                    {element.hidden ? "Hidden — show" : "Hide on slide"}
                </Button>
            </div>
        </div>
    );
}

// ─── Animate (build) section ─────────────────────────────────────────────────

const NO_ANIMATION = "none";

/**
 * Per-element entrance build controls. Picking an effect of "none" clears the
 * animation (drops the element from the slide's build sequence). All other
 * fields edit a single `ElementAnimation`, funneled through `onSetAnimation`.
 */
function AnimateSection({
    animation,
    onSetAnimation,
    isText,
}: {
    animation?: ElementAnimation;
    onSetAnimation?: (animation?: ElementAnimation) => void;
    /** Whether the selected element is a text element (gates the by-paragraph toggle). */
    isText?: boolean;
}) {
    if (!onSetAnimation) {
        return <Text size="sm" className="!text-zinc-500">Build animations aren't wired up in this editor.</Text>;
    }

    const effect = animation?.effect;
    const set = (next: Partial<ElementAnimation>) => {
        const base: ElementAnimation = animation ?? { effect: "fade" };
        onSetAnimation({ ...base, ...next });
    };

    const showDirection = effect === "fly-in" || effect === "wipe";

    return (
        <div className="space-y-3">
            <Select
                label="Effect"
                list={[
                    { value: NO_ANIMATION, label: "None" },
                    { value: "fade", label: "Fade" },
                    { value: "fly-in", label: "Fly in" },
                    { value: "zoom", label: "Zoom" },
                    { value: "wipe", label: "Wipe" },
                ]}
                value={effect ?? NO_ANIMATION}
                onValueChange={(v) => {
                    if (v === NO_ANIMATION) onSetAnimation(undefined);
                    else set({ effect: v as ElementAnimation["effect"] });
                }}
            />
            {effect && (
                <>
                    <Select
                        label="Trigger"
                        list={[
                            { value: "on-click", label: "On click" },
                            { value: "with-prev", label: "With previous" },
                            { value: "after-prev", label: "After previous" },
                        ]}
                        value={animation?.trigger ?? "on-click"}
                        onValueChange={(v) => set({ trigger: v as ElementAnimation["trigger"] })}
                    />
                    {showDirection && (
                        <Select
                            label="Direction"
                            list={[
                                { value: "left", label: "From left" },
                                { value: "right", label: "From right" },
                                { value: "up", label: "From bottom" },
                                { value: "down", label: "From top" },
                            ]}
                            value={animation?.direction ?? "left"}
                            onValueChange={(v) => set({ direction: v as ElementAnimation["direction"] })}
                        />
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            label="Duration (ms)"
                            type="number"
                            value={String(animation?.duration ?? 500)}
                            onChange={(e) => set({ duration: parseInt(e.target.value, 10) || 500 })}
                        />
                        <Input
                            label="Delay (ms)"
                            type="number"
                            value={String(animation?.delay ?? 0)}
                            onChange={(e) => set({ delay: parseInt(e.target.value, 10) || 0 })}
                        />
                    </div>
                    <Input
                        label="Order"
                        type="number"
                        value={String(animation?.order ?? 0)}
                        onChange={(e) => set({ order: parseInt(e.target.value, 10) || 0 })}
                    />
                    {isText && (
                        <Switch
                            label="Animate by paragraph (one line per click)"
                            checked={!!animation?.byParagraph}
                            onCheckedChange={(v) => set({ byParagraph: v })}
                        />
                    )}
                    <Text size="xs" className="!text-zinc-500">
                        Builds reveal in ascending order. "On click" starts a new step; "with previous" plays alongside the step's lead; "after previous" follows it. Honors prefers-reduced-motion.
                    </Text>
                </>
            )}
        </div>
    );
}

function StyleSection({ element, onPatch }: { element: SlideElement; onPatch: (p: Partial<SlideElement>) => void }) {
    switch (element.type) {
        case "text":
            return <TextStyleControls element={element} onPatch={onPatch as (p: Partial<TextElement>) => void} />;
        case "image":
            return <ImageStyleControls element={element} onPatch={onPatch as (p: Partial<ImageElement>) => void} />;
        case "shape":
            return <ShapeStyleControls element={element} onPatch={onPatch as (p: Partial<ShapeElement>) => void} />;
        case "code":
            return <CodeStyleControls element={element} onPatch={onPatch as (p: Partial<CodeElement>) => void} />;
        case "chart":
            return <ChartStyleControls element={element} onPatch={onPatch as (p: Partial<ChartElement>) => void} />;
        case "table":
            return <TableStyleControls element={element} onPatch={onPatch as (p: Partial<TableElement>) => void} />;
        case "embed":
            return <EmbedStyleControls element={element} onPatch={onPatch as (p: Partial<EmbedElement>) => void} />;
        default:
            return <Text size="sm" className="!text-zinc-500">No style controls for this element type.</Text>;
    }
}

function TextStyleControls({ element, onPatch }: { element: TextElement; onPatch: (p: Partial<TextElement>) => void }) {
    const setStyle = (next: Partial<TextStyle>) => onPatch({ style: { ...element.style, ...next } } as Partial<TextElement>);
    const s = element.style ?? {};
    return (
        <div className="space-y-3">
            <Textarea label="Content" value={element.content} onValueChange={(v) => onPatch({ content: v })} rows={4} autoResize />
            <Select
                label="Format"
                list={[
                    { value: "markdown", label: "Markdown" },
                    { value: "plain", label: "Plain" },
                    { value: "html", label: "HTML" },
                ]}
                value={element.format ?? "markdown"}
                onValueChange={(v) => onPatch({ format: v as TextElement["format"] })}
            />
            <Separator />
            <Input label="Font size" type="number" value={String(s.fontSize ?? 28)} onChange={(e) => setStyle({ fontSize: parseFloat(e.target.value) || 28 })} />
            <Select
                label="Weight"
                list={[
                    { value: "normal", label: "Normal" },
                    { value: "medium", label: "Medium" },
                    { value: "semibold", label: "Semibold" },
                    { value: "bold", label: "Bold" },
                ]}
                value={(s.weight as string) ?? "normal"}
                onValueChange={(v) => setStyle({ weight: v as TextStyle["weight"] })}
            />
            <Select
                label="Align"
                list={[
                    { value: "left", label: "Left" },
                    { value: "center", label: "Center" },
                    { value: "right", label: "Right" },
                    { value: "justify", label: "Justify" },
                ]}
                value={s.align ?? "left"}
                onValueChange={(v) => setStyle({ align: v as TextStyle["align"] })}
            />
            <Select
                label="Vertical align"
                list={[
                    { value: "top", label: "Top" },
                    { value: "middle", label: "Middle" },
                    { value: "bottom", label: "Bottom" },
                ]}
                value={s.verticalAlign ?? "top"}
                onValueChange={(v) => setStyle({ verticalAlign: v as TextStyle["verticalAlign"] })}
            />
            <Input label="Line height" type="number" value={String(s.lineHeight ?? 1.4)} onChange={(e) => setStyle({ lineHeight: parseFloat(e.target.value) || 1.4 })} />
            <div className="flex gap-4">
                <Switch label="Italic" checked={!!s.italic} onCheckedChange={(v) => setStyle({ italic: v })} />
                <Switch label="Underline" checked={!!s.underline} onCheckedChange={(v) => setStyle({ underline: v })} />
            </div>
            <FieldLabel label="Color"><ColorPicker value={s.color ?? "#0f172a"} onChange={(c) => setStyle({ color: c })} /></FieldLabel>
        </div>
    );
}

function ImageStyleControls({ element, onPatch }: { element: ImageElement; onPatch: (p: Partial<ImageElement>) => void }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const crop = element.crop;

    const onFile = (file: File | undefined) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") onPatch({ src: reader.result });
        };
        reader.readAsDataURL(file);
    };

    const setCrop = (next: Partial<NonNullable<ImageElement["crop"]>>) => {
        const base = crop ?? { x: 0, y: 0, w: 1, h: 1 };
        onPatch({ crop: { ...base, ...next } });
    };

    return (
        <div className="space-y-3">
            {/* Hidden native file input, triggered by the Button below. */}
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    onFile(e.target.files?.[0]);
                    // Allow re-selecting the same file.
                    e.target.value = "";
                }}
            />
            <Button size="sm" variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>
                Upload image
            </Button>
            <Textarea label="Image URL" value={element.src} onValueChange={(v) => onPatch({ src: v })} rows={2} />
            <Input label="Alt text" value={element.alt ?? ""} onChange={(e) => onPatch({ alt: e.target.value })} />
            <Select
                label="Fit"
                list={[
                    { value: "contain", label: "Contain" },
                    { value: "cover", label: "Cover" },
                    { value: "fill", label: "Fill (stretch)" },
                    { value: "scale-down", label: "Scale down" },
                ]}
                value={element.fit ?? "contain"}
                onValueChange={(v) => onPatch({ fit: v as ImageElement["fit"] })}
            />
            <Separator />
            <div className="flex items-center justify-between">
                <Heading as="h4" size="xs" className="!uppercase !tracking-wider !text-zinc-500">
                    Crop
                </Heading>
                {crop && (
                    <Button size="xs" variant="ghost" onClick={() => onPatch({ crop: undefined })}>
                        Clear crop
                    </Button>
                )}
            </div>
            <Slider label="X" value={crop?.x ?? 0} onValueChange={(v) => setCrop({ x: Number(v) })} min={0} max={1} step={0.01} showValue />
            <Slider label="Y" value={crop?.y ?? 0} onValueChange={(v) => setCrop({ y: Number(v) })} min={0} max={1} step={0.01} showValue />
            <Slider label="Width" value={crop?.w ?? 1} onValueChange={(v) => setCrop({ w: Number(v) })} min={0.01} max={1} step={0.01} showValue />
            <Slider label="Height" value={crop?.h ?? 1} onValueChange={(v) => setCrop({ h: Number(v) })} min={0.01} max={1} step={0.01} showValue />
            <Text size="xs" className="!text-zinc-500">
                Crop is a window into the source image (0..1). Width/height shrink the visible region; X/Y pan it.
            </Text>
        </div>
    );
}

function ShapeStyleControls({ element, onPatch }: { element: ShapeElement; onPatch: (p: Partial<ShapeElement>) => void }) {
    return (
        <div className="space-y-3">
            <Select
                label="Shape"
                list={[
                    { value: "rect", label: "Rectangle" },
                    { value: "rounded-rect", label: "Rounded rectangle" },
                    { value: "ellipse", label: "Ellipse" },
                    { value: "triangle", label: "Triangle" },
                    { value: "line", label: "Line" },
                    { value: "arrow", label: "Arrow" },
                ]}
                value={element.shape}
                onValueChange={(v) => onPatch({ shape: v as ShapeElement["shape"] })}
            />
            <FieldLabel label="Fill"><ColorPicker value={element.fill ?? "#ffffff"} onChange={(c) => onPatch({ fill: c })} /></FieldLabel>
            <FieldLabel label="Stroke"><ColorPicker value={element.stroke ?? "#0f172a"} onChange={(c) => onPatch({ stroke: c })} /></FieldLabel>
            <Slider label="Stroke width" value={element.strokeWidth ?? 2} onValueChange={(v) => onPatch({ strokeWidth: Number(v) })} min={0} max={20} step={0.5} />
            <Switch label="Dashed stroke" checked={!!element.dashed} onCheckedChange={(v) => onPatch({ dashed: v })} />
            {(element.shape === "rounded-rect" || element.shape === "rect") && (
                <Slider label="Corner radius" value={element.radius ?? 0} onValueChange={(v) => onPatch({ radius: Number(v) })} min={0} max={40} />
            )}
        </div>
    );
}

const CODE_LANGUAGES = [
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "jsx", label: "JSX" },
    { value: "tsx", label: "TSX" },
    { value: "html", label: "HTML" },
    { value: "css", label: "CSS" },
    { value: "json", label: "JSON" },
    { value: "python", label: "Python" },
    { value: "php", label: "PHP" },
    { value: "bash", label: "Bash" },
    { value: "go", label: "Go" },
    { value: "sql", label: "SQL" },
    { value: "markdown", label: "Markdown" },
];

function CodeStyleControls({ element, onPatch }: { element: CodeElement; onPatch: (p: Partial<CodeElement>) => void }) {
    return (
        <div className="space-y-3">
            <CodeInput
                value={element.code}
                language={element.language ?? "javascript"}
                theme={element.codeTheme ?? "dark"}
                onChange={(v) => onPatch({ code: v })}
            />
            <Select
                label="Language"
                list={CODE_LANGUAGES}
                value={element.language ?? "javascript"}
                onValueChange={(v) => onPatch({ language: v })}
            />
            <Select
                label="Theme"
                list={[
                    { value: "auto", label: "Auto" },
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                ]}
                value={element.codeTheme ?? "auto"}
                onValueChange={(v) => onPatch({ codeTheme: v })}
            />
            <Switch label="Line numbers" checked={element.lineNumbers ?? true} onCheckedChange={(v) => onPatch({ lineNumbers: v })} />
        </div>
    );
}

function ChartStyleControls({ element, onPatch }: { element: ChartElement; onPatch: (p: Partial<ChartElement>) => void }) {
    const model = chartModelFromOption(element.option);
    const writeModel = (m: ChartModel) => onPatch({ option: chartOptionFromModel(m) });

    return (
        <div className="space-y-3">
            {model ? (
                <ChartModelEditor model={model} onChange={writeModel} />
            ) : (
                <Text size="sm" className="rounded-md bg-amber-50 p-2 !text-amber-700 dark:bg-amber-950/40 dark:!text-amber-400">
                    This chart's option is too custom for the visual editor. Edit it as JSON below.
                </Text>
            )}

            <details className="rounded-md border border-zinc-200 dark:border-zinc-800">
                <summary className="cursor-pointer select-none px-2 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Advanced — edit option JSON
                </summary>
                <div className="p-2 pt-0">
                    <Textarea
                        label="ECharts option (JSON)"
                        value={JSON.stringify(element.option, null, 2)}
                        onValueChange={(v) => {
                            try {
                                onPatch({ option: JSON.parse(v) });
                            } catch {
                                /* ignore invalid JSON while typing */
                            }
                        }}
                        rows={10}
                    />
                </div>
            </details>
        </div>
    );
}

const CHART_TYPE_OPTIONS = [
    { value: "bar", label: "Bar" },
    { value: "line", label: "Line" },
    { value: "area", label: "Area" },
    { value: "pie", label: "Pie" },
    { value: "scatter", label: "Scatter" },
];

function ChartModelEditor({ model, onChange }: { model: ChartModel; onChange: (m: ChartModel) => void }) {
    const setKind = (kind: ChartKind) => {
        if (kind === model.kind) return;
        // Switching to/from pie reshapes the data; preserve what we can.
        if (kind === "pie") {
            const first = model.series[0];
            const slices = model.slices.length
                ? model.slices
                : (model.categories.length
                    ? model.categories.map((name, i) => ({ name, value: first?.values[i] ?? 0 }))
                    : [{ name: "Slice 1", value: 1 }]);
            onChange({ ...model, kind, slices });
            return;
        }
        if (model.kind === "pie") {
            const categories = model.slices.length ? model.slices.map((s) => s.name) : ["A", "B", "C"];
            const values = model.slices.length ? model.slices.map((s) => s.value) : [1, 2, 3];
            onChange({ ...model, kind, categories, series: [{ name: "Series 1", color: chartColorAt(0), values }] });
            return;
        }
        onChange({ ...model, kind });
    };

    return (
        <div className="space-y-3">
            <Select
                label="Chart type"
                list={CHART_TYPE_OPTIONS}
                value={model.kind}
                onValueChange={(v) => setKind(v as ChartKind)}
            />
            {model.kind === "pie" ? (
                <PieSliceEditor model={model} onChange={onChange} />
            ) : (
                <CartesianChartEditor model={model} onChange={onChange} />
            )}
        </div>
    );
}

function PieSliceEditor({ model, onChange }: { model: ChartModel; onChange: (m: ChartModel) => void }) {
    const slices = model.slices;
    const update = (i: number, next: Partial<{ name: string; value: number }>) => {
        const copy = slices.map((s, idx) => (idx === i ? { ...s, ...next } : s));
        onChange({ ...model, slices: copy });
    };
    const remove = (i: number) => onChange({ ...model, slices: slices.filter((_, idx) => idx !== i) });
    const add = () => onChange({ ...model, slices: [...slices, { name: `Slice ${slices.length + 1}`, value: 0 }] });

    return (
        <div className="space-y-2">
            <Heading as="h4" size="xs" className="!uppercase !tracking-wider !text-zinc-500">Slices</Heading>
            {slices.map((s, i) => (
                <div key={i} className="flex items-end gap-2">
                    <div className="flex-1"><Input label={i === 0 ? "Name" : undefined} value={s.name} onChange={(e) => update(i, { name: e.target.value })} /></div>
                    <div className="w-20"><Input label={i === 0 ? "Value" : undefined} type="number" value={String(s.value)} onChange={(e) => update(i, { value: parseFloat(e.target.value) || 0 })} /></div>
                    <Button size="xs" variant="ghost" color="red" icon="x" onClick={() => remove(i)} aria-label="Remove slice" />
                </div>
            ))}
            <Button size="xs" variant="ghost" icon="plus" onClick={add}>Add slice</Button>
        </div>
    );
}

function CartesianChartEditor({ model, onChange }: { model: ChartModel; onChange: (m: ChartModel) => void }) {
    const { categories, series } = model;

    const updateCategory = (i: number, label: string) => {
        onChange({ ...model, categories: categories.map((c, idx) => (idx === i ? label : c)) });
    };
    const removeCategory = (i: number) => {
        onChange({
            ...model,
            categories: categories.filter((_, idx) => idx !== i),
            series: series.map((s) => ({ ...s, values: s.values.filter((_, idx) => idx !== i) })),
        });
    };
    const addCategory = () => {
        onChange({
            ...model,
            categories: [...categories, `Cat ${categories.length + 1}`],
            series: series.map((s) => ({ ...s, values: [...s.values, 0] })),
        });
    };

    const updateSeries = (si: number, next: Partial<{ name: string; color: string }>) => {
        onChange({ ...model, series: series.map((s, idx) => (idx === si ? { ...s, ...next } : s)) });
    };
    const updateValue = (si: number, ci: number, value: number) => {
        onChange({
            ...model,
            series: series.map((s, idx) =>
                idx === si ? { ...s, values: s.values.map((v, vi) => (vi === ci ? value : v)) } : s,
            ),
        });
    };
    const removeSeries = (si: number) => onChange({ ...model, series: series.filter((_, idx) => idx !== si) });
    const addSeries = () =>
        onChange({
            ...model,
            series: [
                ...series,
                { name: `Series ${series.length + 1}`, color: chartColorAt(series.length), values: categories.map(() => 0) },
            ],
        });

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <Heading as="h4" size="xs" className="!uppercase !tracking-wider !text-zinc-500">Categories</Heading>
                {categories.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="flex-1"><Input value={c} onChange={(e) => updateCategory(i, e.target.value)} /></div>
                        <Button size="xs" variant="ghost" color="red" icon="x" onClick={() => removeCategory(i)} aria-label="Remove category" />
                    </div>
                ))}
                <Button size="xs" variant="ghost" icon="plus" onClick={addCategory}>Add category</Button>
            </div>

            <Separator />

            <div className="space-y-3">
                <Heading as="h4" size="xs" className="!uppercase !tracking-wider !text-zinc-500">Series</Heading>
                {series.map((s, si) => (
                    <div key={si} className="space-y-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                        <div className="flex items-end gap-2">
                            <div className="flex-1"><Input label="Name" value={s.name} onChange={(e) => updateSeries(si, { name: e.target.value })} /></div>
                            <FieldLabel label="Color"><ColorPicker value={s.color ?? chartColorAt(si)} onChange={(c) => updateSeries(si, { color: c })} /></FieldLabel>
                            <Button size="xs" variant="ghost" color="red" icon="x" onClick={() => removeSeries(si)} aria-label="Remove series" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {categories.map((c, ci) => (
                                <Input
                                    key={ci}
                                    label={c}
                                    type="number"
                                    value={String(s.values[ci] ?? 0)}
                                    onChange={(e) => updateValue(si, ci, parseFloat(e.target.value) || 0)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
                <Button size="xs" variant="ghost" icon="plus" onClick={addSeries}>Add series</Button>
            </div>
        </div>
    );
}

function TableStyleControls({ element, onPatch }: { element: TableElement; onPatch: (p: Partial<TableElement>) => void }) {
    const columns = element.columns;
    const rows = element.rows;

    /** Mint a column key that's unique among existing keys (col1, col2, …). */
    const nextColKey = (): string => {
        const existing = new Set(columns.map((c) => c.key));
        let n = columns.length + 1;
        while (existing.has(`col${n}`)) n++;
        return `col${n}`;
    };

    const setColumnLabel = (i: number, label: string) => {
        // Only the label changes — the key stays stable.
        onPatch({ columns: columns.map((c, idx) => (idx === i ? { ...c, label } : c)) });
    };
    const removeColumn = (i: number) => {
        const key = columns[i]?.key;
        const nextCols = columns.filter((_, idx) => idx !== i);
        const nextRows = key
            ? rows.map((r) => {
                  const { [key]: _drop, ...rest } = r;
                  return rest;
              })
            : rows;
        onPatch({ columns: nextCols, rows: nextRows });
    };
    const addColumn = () => {
        const key = nextColKey();
        onPatch({
            columns: [...columns, { key, label: `Column ${columns.length + 1}` }],
            rows: rows.map((r) => ({ ...r, [key]: "" })),
        });
    };

    const setCell = (rowIdx: number, key: string, value: string) => {
        onPatch({ rows: rows.map((r, idx) => (idx === rowIdx ? { ...r, [key]: value } : r)) });
    };
    const removeRow = (rowIdx: number) => onPatch({ rows: rows.filter((_, idx) => idx !== rowIdx) });
    const addRow = () => {
        const blank: Record<string, unknown> = {};
        for (const c of columns) blank[c.key] = "";
        onPatch({ rows: [...rows, blank] });
    };

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <Heading as="h4" size="xs" className="!uppercase !tracking-wider !text-zinc-500">Columns</Heading>
                {columns.map((c, i) => (
                    <div key={c.key} className="flex items-center gap-2">
                        <div className="flex-1">
                            <Input value={c.label} onChange={(e) => setColumnLabel(i, e.target.value)} aria-label={`Column ${i + 1} label`} />
                        </div>
                        <Text size="xs" className="!font-mono !text-zinc-400">{c.key}</Text>
                        <Button size="xs" variant="ghost" color="red" icon="x" onClick={() => removeColumn(i)} aria-label="Remove column" />
                    </div>
                ))}
                <Button size="xs" variant="ghost" icon="plus" onClick={addColumn}>Add column</Button>
            </div>

            <Separator />

            <div className="space-y-2">
                <Heading as="h4" size="xs" className="!uppercase !tracking-wider !text-zinc-500">Rows</Heading>
                {columns.length === 0 ? (
                    <Text size="xs" className="!text-zinc-500">Add a column to start adding rows.</Text>
                ) : (
                    <>
                        {rows.map((r, rowIdx) => (
                            <div key={rowIdx} className="flex items-start gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800">
                                <div className="grid flex-1 grid-cols-1 gap-1">
                                    {columns.map((c) => (
                                        <Input
                                            key={c.key}
                                            label={c.label}
                                            value={r[c.key] == null ? "" : String(r[c.key])}
                                            onChange={(e) => setCell(rowIdx, c.key, e.target.value)}
                                        />
                                    ))}
                                </div>
                                <Button size="xs" variant="ghost" color="red" icon="x" onClick={() => removeRow(rowIdx)} aria-label="Remove row" />
                            </div>
                        ))}
                        <Button size="xs" variant="ghost" icon="plus" onClick={addRow}>Add row</Button>
                    </>
                )}
            </div>

            <details className="rounded-md border border-zinc-200 dark:border-zinc-800">
                <summary className="cursor-pointer select-none px-2 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Edit as JSON
                </summary>
                <div className="space-y-3 p-2 pt-0">
                    <Textarea
                        label="Columns (JSON)"
                        value={JSON.stringify(columns, null, 2)}
                        onValueChange={(v) => {
                            try {
                                onPatch({ columns: JSON.parse(v) });
                            } catch {
                                /* ignore */
                            }
                        }}
                        rows={5}
                    />
                    <Textarea
                        label="Rows (JSON)"
                        value={JSON.stringify(rows, null, 2)}
                        onValueChange={(v) => {
                            try {
                                onPatch({ rows: JSON.parse(v) });
                            } catch {
                                /* ignore */
                            }
                        }}
                        rows={8}
                    />
                </div>
            </details>
        </div>
    );
}

function EmbedStyleControls({ element, onPatch }: { element: EmbedElement; onPatch: (p: Partial<EmbedElement>) => void }) {
    return (
        <div className="space-y-3">
            <Input label="Embed URL" value={element.src} onChange={(e) => onPatch({ src: e.target.value })} />
            <Input label="Title (a11y)" value={element.title ?? ""} onChange={(e) => onPatch({ title: e.target.value })} />
            <Input label="Sandbox" value={element.sandbox ?? "allow-scripts"} onChange={(e) => onPatch({ sandbox: e.target.value })} />
        </div>
    );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
            {children}
        </label>
    );
}

function clamp(n: number, min: number, max: number): number {
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

function roundFrac(n: number): number {
    return Math.round(n * 1000) / 1000;
}
