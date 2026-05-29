import { Action, Card, ColorPicker, Heading, Input, Select, Separator, Slider, Tabs, Text, Textarea } from "@particle-academy/react-fancy";
import type { Slide as SlideData, SlideBackground, SlideElement, SlideTransition, TextElement, TextStyle, ImageElement, ShapeElement, CodeElement, ChartElement, TableElement, EmbedElement } from "../../types";

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
}

/**
 * Right-hand inspector. Tabs split position + style + advanced properties.
 * Per-element-type controls drop in under the Style tab. Built on
 * react-fancy `Card`, `Tabs`, `Input`, `Select`, `Slider`, `ColorPicker`,
 * `Action`.
 */
export function ElementInspector({ element, onPatch, onDelete, onLockToggle, slide, onSetTransition, onSetBackground }: ElementInspectorProps) {
    // No element selected: show slide-level settings when a slide is available.
    if (!element) {
        if (slide) {
            return <SlideSettings slide={slide} onSetTransition={onSetTransition} onSetBackground={onSetBackground} />;
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
                    <Action size="xs" variant="ghost" icon={element.locked ? "lock" : "unlock"} onClick={() => onLockToggle?.(!element.locked)} aria-label={element.locked ? "Unlock" : "Lock"} />
                    {onDelete && (
                        <Action size="xs" variant="ghost" color="red" icon="trash" onClick={onDelete} aria-label="Delete" />
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                <Tabs defaultTab="style" variant="pills">
                    <Tabs.List>
                        <Tabs.Tab value="style">Style</Tabs.Tab>
                        <Tabs.Tab value="layout">Layout</Tabs.Tab>
                        <Tabs.Tab value="advanced">Advanced</Tabs.Tab>
                    </Tabs.List>
                    <Tabs.Panels>
                        <Tabs.Panel value="style">
                            <Card padding="md" className="!bg-white dark:!bg-zinc-950">
                                <StyleSection element={element} onPatch={onPatch} />
                            </Card>
                        </Tabs.Panel>
                        <Tabs.Panel value="layout">
                            <Card padding="md" className="!bg-white dark:!bg-zinc-950">
                                <LayoutSection element={element} onPatch={onPatch} />
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
function SlideSettings({
    slide,
    onSetTransition,
    onSetBackground,
}: {
    slide: SlideData;
    onSetTransition?: (transition?: SlideTransition) => void;
    onSetBackground?: (background?: SlideBackground) => void;
}) {
    const transition = slide.transition;
    const kind = transition?.kind ?? "none";
    const setTransition = (next: Partial<SlideTransition>) => {
        const merged: SlideTransition = { kind, duration: transition?.duration, direction: transition?.direction, ...next };
        // "none" carries no extra knobs — store the bare kind.
        onSetTransition?.(merged.kind === "none" ? { kind: "none" } : merged);
    };

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
                            <FieldLabel label="Color">
                                <ColorPicker
                                    value={slide.background?.color ?? "#ffffff"}
                                    onChange={(c) => onSetBackground({ ...slide.background, color: c })}
                                />
                            </FieldLabel>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}

// ─── Sections ──────────────────────────────────────────────────────────────

function LayoutSection({ element, onPatch }: { element: SlideElement; onPatch: (p: Partial<SlideElement>) => void }) {
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
            <Input label="Z-index" type="number" value={String(element.z ?? 0)} onChange={(e) => onPatch({ z: parseInt(e.target.value, 10) || 0 })} />
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
                <Action size="sm" variant={element.hidden ? "default" : "ghost"} onClick={() => onPatch({ hidden: !element.hidden })}>
                    {element.hidden ? "Hidden — show" : "Hide on slide"}
                </Action>
            </div>
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
            <FieldLabel label="Color"><ColorPicker value={s.color ?? "#0f172a"} onChange={(c) => setStyle({ color: c })} /></FieldLabel>
        </div>
    );
}

function ImageStyleControls({ element, onPatch }: { element: ImageElement; onPatch: (p: Partial<ImageElement>) => void }) {
    return (
        <div className="space-y-3">
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
            {(element.shape === "rounded-rect" || element.shape === "rect") && (
                <Slider label="Corner radius" value={element.radius ?? 0} onValueChange={(v) => onPatch({ radius: Number(v) })} min={0} max={40} />
            )}
        </div>
    );
}

function CodeStyleControls({ element, onPatch }: { element: CodeElement; onPatch: (p: Partial<CodeElement>) => void }) {
    return (
        <div className="space-y-3">
            <Textarea label="Code" value={element.code} onValueChange={(v) => onPatch({ code: v })} rows={6} autoResize />
            <Input label="Language" value={element.language ?? "javascript"} onChange={(e) => onPatch({ language: e.target.value })} />
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
        </div>
    );
}

function ChartStyleControls({ element, onPatch }: { element: ChartElement; onPatch: (p: Partial<ChartElement>) => void }) {
    return (
        <div className="space-y-3">
            <Text size="sm" className="!text-zinc-500">
                Chart option is JSON — paste any ECharts option here.
            </Text>
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
    );
}

function TableStyleControls({ element, onPatch }: { element: TableElement; onPatch: (p: Partial<TableElement>) => void }) {
    return (
        <div className="space-y-3">
            <Textarea
                label="Columns (JSON)"
                value={JSON.stringify(element.columns, null, 2)}
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
                value={JSON.stringify(element.rows, null, 2)}
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
