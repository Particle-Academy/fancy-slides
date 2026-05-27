import { Action, Badge, Dropdown, Separator, Tooltip } from "@particle-academy/react-fancy";
import type { ShapeKind, Theme } from "../../types";
import { builtinThemes } from "../../theme/default-theme";

/**
 * Starter chart-element preset. Picked from the toolbar Insert→Chart
 * dropdown; expands into a starter `ChartElement.option` inside
 * `DeckEditor.insertChart`. The actual saved `ChartElement` doesn't
 * carry this — once the agent or user edits the option JSON, the
 * "kind" is just whatever ECharts series.type the option says.
 */
export type ChartKind = "bar" | "line" | "pie" | "area" | "scatter";

export interface EditorToolbarProps {
    /** Current deck title — shown left of the toolbar. */
    title: string;
    onTitleChange?: (title: string) => void;
    /** Current theme name. */
    themeName?: string;
    /** Apply a theme. */
    onApplyTheme?: (theme: Theme) => void;
    /** Insert a text element on the active slide. */
    onInsertText?: () => void;
    /** Insert an image element. */
    onInsertImage?: () => void;
    /** Insert a shape element. */
    onInsertShape?: (shape: ShapeKind) => void;
    /** Insert a chart element. The `kind` arg picks a starter ECharts option
     *  (`bar` / `line` / `pie` / `area` / `scatter`). Hosts can ignore the
     *  arg if they only support a single chart type. */
    onInsertChart?: (kind: ChartKind) => void;
    /** Insert a code element. */
    onInsertCode?: () => void;
    /** Insert a table element. */
    onInsertTable?: () => void;
    /** Open the viewer (presentation mode). */
    onPresent?: () => void;
    /** When true, disables every Insert button (e.g. when no slide is selected). */
    disabled?: boolean;
}

/**
 * Top toolbar. Built on react-fancy's `Action`, `Dropdown`, `Tooltip`,
 * `Badge`, `Separator`. Designed to be slotted into the editor chrome —
 * doesn't manage its own scroll or sticky behavior.
 */
export function EditorToolbar({
    title,
    onTitleChange,
    themeName,
    onApplyTheme,
    onInsertText,
    onInsertImage,
    onInsertShape,
    onInsertChart,
    onInsertCode,
    onInsertTable,
    onPresent,
    disabled = false,
}: EditorToolbarProps) {
    return (
        <div className="fs-toolbar flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            {/* Title field */}
            <input
                value={title}
                onChange={(e) => onTitleChange?.(e.target.value)}
                placeholder="Untitled deck"
                className="min-w-0 flex-1 max-w-xs border-0 bg-transparent px-1 text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 focus:bg-zinc-50 dark:text-zinc-100 dark:focus:bg-zinc-900"
                aria-label="Deck title"
            />

            <Separator orientation="vertical" />

            {/* Insert actions */}
            <Tooltip content="Insert text">
                <Action variant="ghost" size="sm" icon="type" onClick={onInsertText} disabled={disabled} aria-label="Insert text" />
            </Tooltip>
            <Tooltip content="Insert image">
                <Action variant="ghost" size="sm" icon="image" onClick={onInsertImage} disabled={disabled} aria-label="Insert image" />
            </Tooltip>

            <Dropdown>
                <Dropdown.Trigger>
                    <Action variant="ghost" size="sm" icon="square" iconTrailing="chevron-down" disabled={disabled}>
                        Shape
                    </Action>
                </Dropdown.Trigger>
                <Dropdown.Items>
                    <Dropdown.Item onClick={() => onInsertShape?.("rect")}>Rectangle</Dropdown.Item>
                    <Dropdown.Item onClick={() => onInsertShape?.("rounded-rect")}>Rounded rectangle</Dropdown.Item>
                    <Dropdown.Item onClick={() => onInsertShape?.("ellipse")}>Ellipse</Dropdown.Item>
                    <Dropdown.Item onClick={() => onInsertShape?.("triangle")}>Triangle</Dropdown.Item>
                    <Dropdown.Item onClick={() => onInsertShape?.("line")}>Line</Dropdown.Item>
                    <Dropdown.Item onClick={() => onInsertShape?.("arrow")}>Arrow</Dropdown.Item>
                </Dropdown.Items>
            </Dropdown>

            <Dropdown>
                <Dropdown.Trigger>
                    <Action variant="ghost" size="sm" icon="bar-chart" iconTrailing="chevron-down" disabled={disabled} aria-label="Insert chart" />
                </Dropdown.Trigger>
                <Dropdown.Items>
                    <Dropdown.Item onClick={() => onInsertChart?.("bar")}>Bar chart</Dropdown.Item>
                    <Dropdown.Item onClick={() => onInsertChart?.("line")}>Line chart</Dropdown.Item>
                    <Dropdown.Item onClick={() => onInsertChart?.("area")}>Area chart</Dropdown.Item>
                    <Dropdown.Item onClick={() => onInsertChart?.("pie")}>Pie chart</Dropdown.Item>
                    <Dropdown.Item onClick={() => onInsertChart?.("scatter")}>Scatter</Dropdown.Item>
                </Dropdown.Items>
            </Dropdown>
            <Tooltip content="Insert code">
                <Action variant="ghost" size="sm" icon="code" onClick={onInsertCode} disabled={disabled} aria-label="Insert code" />
            </Tooltip>
            <Tooltip content="Insert table">
                <Action variant="ghost" size="sm" icon="table" onClick={onInsertTable} disabled={disabled} aria-label="Insert table" />
            </Tooltip>

            <Separator orientation="vertical" />

            {/* Theme */}
            <Dropdown>
                <Dropdown.Trigger>
                    <Action variant="ghost" size="sm" iconTrailing="chevron-down">
                        <Badge size="sm" color="zinc">{themeName ?? "default"}</Badge>
                        <span className="ml-2">Theme</span>
                    </Action>
                </Dropdown.Trigger>
                <Dropdown.Items>
                    {Object.values(builtinThemes).map((t) => (
                        <Dropdown.Item key={t.name} onClick={() => onApplyTheme?.(t)}>
                            {t.name}
                        </Dropdown.Item>
                    ))}
                </Dropdown.Items>
            </Dropdown>

            <div className="ml-auto flex items-center gap-2">
                <Tooltip content="Present (F)">
                    <Action color="violet" size="sm" icon="play" onClick={onPresent}>
                        Present
                    </Action>
                </Tooltip>
            </div>
        </div>
    );
}
