import { createContext, useContext, type ReactNode } from "react";
import { Button, Badge, Dropdown, Separator, Tooltip } from "@particle-academy/react-fancy";
import type { ShapeKind, Theme } from "../../types";
import { builtinThemes } from "../../theme/default-theme";

/**
 * Starter chart-element preset. Picked from the toolbar Insert→Chart
 * dropdown; expands into a starter `ChartElement.option` inside
 * `DeckEditor.insertChart`.
 */
export type ChartKind = "bar" | "line" | "pie" | "area" | "scatter";

/**
 * The toolbar action surface, handed to a `renderToolbar` callback so consumers
 * can compose into the toolbar's natural groups (Title / Insert / Themes /
 * Trailing) without forking it.
 */
export interface ToolbarApi {
    title: { value: string; onChange: (t: string) => void };
    theme: { name: string; themes: Theme[]; onApply: (t: Theme) => void };
    insert: {
        text: () => void;
        image: () => void;
        shape: (shape: ShapeKind) => void;
        chart: (kind: ChartKind) => void;
        code: () => void;
        table: () => void;
    };
    present?: () => void;
    disabled: boolean;
}

export interface EditorToolbarProps {
    /** Current deck title — shown left of the toolbar. */
    title?: string;
    onTitleChange?: (title: string) => void;
    /** Current theme name. */
    themeName?: string;
    /** Apply a theme. */
    onApplyTheme?: (theme: Theme) => void;
    /** Theme list the picker offers. Defaults to the built-in themes; pass user-authored themes to extend it. */
    themes?: Theme[];
    /** Insert a text element on the active slide. */
    onInsertText?: () => void;
    /** Insert an image element. */
    onInsertImage?: () => void;
    /** Insert a shape element. */
    onInsertShape?: (shape: ShapeKind) => void;
    /** Insert a chart element. */
    onInsertChart?: (kind: ChartKind) => void;
    /** Insert a code element. */
    onInsertCode?: () => void;
    /** Insert a table element. */
    onInsertTable?: () => void;
    /** Open the viewer (presentation mode). */
    onPresent?: () => void;
    /** When true, disables every Insert button (e.g. when no slide is selected). */
    disabled?: boolean;
    /** Host-injected content rendered on the toolbar's trailing edge, left of Present. Sugar for `<EditorToolbar.Trailing>`. */
    toolbarExtra?: ReactNode;
    /**
     * Compositional mode: pass the {@link ToolbarApi} (from `DeckEditor`'s
     * `renderToolbar`) plus children built from `EditorToolbar.Title` /
     * `.Insert` / `.InsertButton` / `.Themes` / `.Trailing`. When omitted, the
     * toolbar renders its default layout from the props above.
     */
    api?: ToolbarApi;
    children?: ReactNode;
}

const ToolbarContext = createContext<ToolbarApi | null>(null);

function useToolbar(slot: string): ToolbarApi {
    const ctx = useContext(ToolbarContext);
    if (!ctx) {
        throw new Error(`EditorToolbar.${slot} must be used inside <EditorToolbar api={…}> (typically via DeckEditor's renderToolbar).`);
    }
    return ctx;
}

const BAR = "fs-toolbar flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950";

/**
 * Top toolbar — two modes:
 *
 * - **Default (prop-driven):** `<EditorToolbar title=… onInsertText=… />` renders
 *   the full bar. This is what `DeckEditor` uses out of the box.
 * - **Compositional:** `<EditorToolbar api={api}> … </EditorToolbar>` renders your
 *   children inside the bar, with the slot components reading the action surface
 *   from context. Use via `DeckEditor`'s `renderToolbar`.
 */
export function EditorToolbar(props: EditorToolbarProps) {
    // Compositional mode — caller supplied an api + children.
    if (props.api) {
        return (
            <ToolbarContext.Provider value={props.api}>
                <div className={BAR}>{props.children}</div>
            </ToolbarContext.Provider>
        );
    }

    // Default mode — render the full bar from props.
    const {
        title = "",
        onTitleChange,
        themeName,
        onApplyTheme,
        themes,
        onInsertText,
        onInsertImage,
        onInsertShape,
        onInsertChart,
        onInsertCode,
        onInsertTable,
        onPresent,
        disabled = false,
        toolbarExtra,
    } = props;

    const themeList = themes ?? Object.values(builtinThemes);

    return (
        <div className={BAR}>
            <TitleInput value={title} onChange={(t) => onTitleChange?.(t)} />
            <Separator orientation="vertical" />
            <InsertGroup
                disabled={disabled}
                onText={onInsertText}
                onImage={onInsertImage}
                onShape={onInsertShape}
                onChart={onInsertChart}
                onCode={onInsertCode}
                onTable={onInsertTable}
            />
            <Separator orientation="vertical" />
            <ThemePicker themeName={themeName} themes={themeList} onApply={onApplyTheme} />
            <div className="ml-auto flex items-center gap-2">
                {toolbarExtra}
                <PresentButton onPresent={onPresent} />
            </div>
        </div>
    );
}

// ─── Shared building blocks (used by both modes) ────────────────────────────

function TitleInput({ value, onChange }: { value: string; onChange: (t: string) => void }) {
    return (
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Untitled deck"
            className="min-w-0 flex-1 max-w-xs border-0 bg-transparent px-1 text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 focus:bg-zinc-50 dark:text-zinc-100 dark:focus:bg-zinc-900"
            aria-label="Deck title"
        />
    );
}

function InsertGroup({
    disabled,
    onText,
    onImage,
    onShape,
    onChart,
    onCode,
    onTable,
    children,
}: {
    disabled: boolean;
    onText?: () => void;
    onImage?: () => void;
    onShape?: (s: ShapeKind) => void;
    onChart?: (k: ChartKind) => void;
    onCode?: () => void;
    onTable?: () => void;
    children?: ReactNode;
}) {
    return (
        <>
            <Tooltip content="Insert text">
                <Button variant="ghost"size="sm" icon="type" onClick={onText} disabled={disabled} aria-label="Insert text" />
            </Tooltip>
            <Tooltip content="Insert image">
                <Button variant="ghost"size="sm" icon="image" onClick={onImage} disabled={disabled} aria-label="Insert image" />
            </Tooltip>
            <Dropdown>
                <Dropdown.Trigger>
                    <Button variant="ghost"size="sm" icon="square" iconTrailing="chevron-down" disabled={disabled}>
                        Shape
                    </Button>
                </Dropdown.Trigger>
                <Dropdown.Items>
                    <Dropdown.Item onClick={() => onShape?.("rect")}>Rectangle</Dropdown.Item>
                    <Dropdown.Item onClick={() => onShape?.("rounded-rect")}>Rounded rectangle</Dropdown.Item>
                    <Dropdown.Item onClick={() => onShape?.("ellipse")}>Ellipse</Dropdown.Item>
                    <Dropdown.Item onClick={() => onShape?.("triangle")}>Triangle</Dropdown.Item>
                    <Dropdown.Item onClick={() => onShape?.("line")}>Line</Dropdown.Item>
                    <Dropdown.Item onClick={() => onShape?.("arrow")}>Arrow</Dropdown.Item>
                </Dropdown.Items>
            </Dropdown>
            <Dropdown>
                <Dropdown.Trigger>
                    <Button variant="ghost"size="sm" icon="bar-chart" iconTrailing="chevron-down" disabled={disabled} aria-label="Insert chart" />
                </Dropdown.Trigger>
                <Dropdown.Items>
                    <Dropdown.Item onClick={() => onChart?.("bar")}>Bar chart</Dropdown.Item>
                    <Dropdown.Item onClick={() => onChart?.("line")}>Line chart</Dropdown.Item>
                    <Dropdown.Item onClick={() => onChart?.("area")}>Area chart</Dropdown.Item>
                    <Dropdown.Item onClick={() => onChart?.("pie")}>Pie chart</Dropdown.Item>
                    <Dropdown.Item onClick={() => onChart?.("scatter")}>Scatter</Dropdown.Item>
                </Dropdown.Items>
            </Dropdown>
            <Tooltip content="Insert code">
                <Button variant="ghost"size="sm" icon="code" onClick={onCode} disabled={disabled} aria-label="Insert code" />
            </Tooltip>
            <Tooltip content="Insert table">
                <Button variant="ghost"size="sm" icon="table" onClick={onTable} disabled={disabled} aria-label="Insert table" />
            </Tooltip>
            {children}
        </>
    );
}

function ThemePicker({ themeName, themes, onApply }: { themeName?: string; themes: Theme[]; onApply?: (t: Theme) => void }) {
    return (
        <Dropdown>
            <Dropdown.Trigger>
                <Button variant="ghost"size="sm" iconTrailing="chevron-down">
                    <Badge size="sm" color="zinc">{themeName ?? "default"}</Badge>
                    <span className="ml-2">Theme</span>
                </Button>
            </Dropdown.Trigger>
            <Dropdown.Items>
                {themes.map((t) => (
                    <Dropdown.Item key={t.name} onClick={() => onApply?.(t)}>
                        {t.name}
                    </Dropdown.Item>
                ))}
            </Dropdown.Items>
        </Dropdown>
    );
}

function PresentButton({ onPresent }: { onPresent?: () => void }) {
    return (
        <Tooltip content="Present (F)">
            <Button color="violet"size="sm" icon="play" onClick={onPresent}>
                Present
            </Button>
        </Tooltip>
    );
}

// ─── Compositional slot components (read the api from context) ───────────────

EditorToolbar.Title = function Title() {
    const api = useToolbar("Title");
    return <TitleInput value={api.title.value} onChange={api.title.onChange} />;
};

EditorToolbar.Insert = function Insert({ children, builtins = true }: { children?: ReactNode; builtins?: boolean }) {
    const api = useToolbar("Insert");
    if (!builtins) return <>{children}</>;
    return (
        <InsertGroup
            disabled={api.disabled}
            onText={api.insert.text}
            onImage={api.insert.image}
            onShape={api.insert.shape}
            onChart={api.insert.chart}
            onCode={api.insert.code}
            onTable={api.insert.table}
        >
            {children}
        </InsertGroup>
    );
};

EditorToolbar.InsertButton = function InsertButton({ kind }: { kind: "text" | "image" | "code" | "table" }) {
    const api = useToolbar("InsertButton");
    const map = { text: api.insert.text, image: api.insert.image, code: api.insert.code, table: api.insert.table } as const;
    const icon = { text: "type", image: "image", code: "code", table: "table" } as const;
    return (
        <Tooltip content={`Insert ${kind}`}>
            <Button variant="ghost"size="sm" icon={icon[kind]} onClick={map[kind]} disabled={api.disabled} aria-label={`Insert ${kind}`} />
        </Tooltip>
    );
};

EditorToolbar.Themes = function Themes({ themes }: { themes?: Theme[] }) {
    const api = useToolbar("Themes");
    return <ThemePicker themeName={api.theme.name} themes={themes ?? api.theme.themes} onApply={api.theme.onApply} />;
};

EditorToolbar.Trailing = function Trailing({ children, present = true }: { children?: ReactNode; present?: boolean }) {
    const api = useToolbar("Trailing");
    return (
        <div className="ml-auto flex items-center gap-2">
            {children}
            {present && <PresentButton onPresent={api.present} />}
        </div>
    );
};

EditorToolbar.Separator = function ToolbarSeparator() {
    return <Separator orientation="vertical" />;
};
