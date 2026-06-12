import { useState, type ReactNode } from "react";
import { Button, ContextMenu, Text } from "@particle-academy/react-fancy";
import type { Slide, SlideElement, Theme } from "../../types";
import { SlideThumbnail } from "../SlideThumbnail";

export interface SlideRailProps {
    /** Slides to render in the rail. */
    slides: Slide[];
    /** Currently-selected slide id. */
    selectedId: string | null;
    /** Theme used for thumbnail rendering. */
    theme?: Theme;
    /** Select a slide by id. */
    onSelect: (id: string) => void;
    /** Add a slide after the given index (or at the end if absent). */
    onAdd: (afterIndex?: number) => void;
    /** Duplicate the given slide. */
    onDuplicate: (id: string) => void;
    /** Delete the given slide. */
    onRemove: (id: string) => void;
    /** Move a slide from `fromIndex` to `toIndex`. */
    onReorder: (id: string, toIndex: number) => void;
    /** Optional custom renderer for non-built-in element types — forwarded to the thumbnails. */
    renderElement?: (element: SlideElement, slideWidthPx: number) => ReactNode | undefined;
    /** Thumbnail width in px. Defaults to 184. */
    thumbnailWidth?: number;
}

/**
 * Left-hand slide rail. Built on react-fancy's `Sidebar` for the chrome and
 * `ContextMenu` for right-click actions. Drag-to-reorder uses native HTML5
 * drag events so we don't take a DnD dependency.
 */
export function SlideRail({
    slides,
    selectedId,
    theme,
    onSelect,
    onAdd,
    onDuplicate,
    onRemove,
    onReorder,
    renderElement,
    thumbnailWidth = 184,
}: SlideRailProps) {
    const [dragOver, setDragOver] = useState<string | null>(null);

    // Plain <aside> instead of react-fancy <Sidebar> because Sidebar hardcodes
    // `w-60` (240px), which overflows any rail container narrower than that.
    // The rail should fill whatever width the host gives it.
    return (
        <aside
            data-react-fancy-slide-rail=""
            className="fs-rail flex h-full w-full min-w-0 flex-col gap-0.5"
        >
            <div className="flex items-center justify-between gap-2 px-3 py-2">
                <Text size="xs" weight="semibold" className="!uppercase !tracking-wider !text-zinc-500">
                    Slides · {slides.length}
                </Text>
                <Button size="xs" icon="plus" onClick={() => onAdd()} aria-label="Add slide">
                    Add
                </Button>
            </div>
            <div className="flex flex-col gap-3 px-3 pb-3">
                {slides.map((slide, i) => (
                    <div
                        key={slide.id}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", slide.id);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setDragOver(slide.id);
                        }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={(e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData("text/plain");
                            setDragOver(null);
                            if (id && id !== slide.id) onReorder(id, i);
                        }}
                        style={{
                            position: "relative",
                            paddingTop: dragOver === slide.id ? 3 : 0,
                            borderTop: dragOver === slide.id ? "2px solid #8b5cf6" : undefined,
                            transition: "padding 80ms ease",
                        }}
                    >
                        <ContextMenu>
                            <ContextMenu.Trigger>
                                <div className="flex items-start gap-2">
                                    <Text size="xs" className="!w-6 shrink-0 !pt-1 !text-right !font-mono !text-zinc-400">
                                        {i + 1}
                                    </Text>
                                    <div className="flex-1">
                                        <SlideThumbnail
                                            slide={slide}
                                            theme={theme}
                                            width={thumbnailWidth - 32}
                                            active={selectedId === slide.id}
                                            onClick={() => onSelect(slide.id)}
                                            renderElement={renderElement}
                                        />
                                    </div>
                                </div>
                            </ContextMenu.Trigger>
                            <ContextMenu.Content>
                                <ContextMenu.Item onClick={() => onSelect(slide.id)}>Open</ContextMenu.Item>
                                <ContextMenu.Item onClick={() => onDuplicate(slide.id)}>Duplicate</ContextMenu.Item>
                                <ContextMenu.Item onClick={() => onAdd(i)}>Insert above</ContextMenu.Item>
                                <ContextMenu.Item onClick={() => onAdd(i + 1)}>Insert below</ContextMenu.Item>
                                <ContextMenu.Separator />
                                <ContextMenu.Item danger onClick={() => onRemove(slide.id)}>
                                    Delete
                                </ContextMenu.Item>
                            </ContextMenu.Content>
                        </ContextMenu>
                    </div>
                ))}
                {slides.length === 0 && (
                    <div className="grid place-items-center rounded-md border border-dashed border-zinc-300 px-3 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
                        Empty deck — add a slide to begin.
                    </div>
                )}
            </div>
        </aside>
    );
}
