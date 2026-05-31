import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

/**
 * Editable code field for the inspector — the real fancy-code CodeEditor, not a
 * plain textarea. fancy-code is an OPTIONAL peer, so (like code-host) it loads
 * via a dynamic import and falls back to a monospace textarea when absent.
 */
interface Props {
    value: string;
    language: string;
    theme: string;
    onChange: (value: string) => void;
}

type CodeEditorComponent = ComponentType<{
    value: string;
    onChange?: (value: string) => void;
    language?: string;
    theme?: string;
    readOnly?: boolean;
    lineNumbers?: boolean;
    wordWrap?: boolean;
    minHeight?: number;
    maxHeight?: number;
    children?: ReactNode;
}> & { Panel: ComponentType };

function FallbackTextarea({ value, onChange }: Props) {
    return (
        <textarea
            className="block w-full resize-y rounded-md border border-zinc-300 bg-zinc-950 p-2 font-mono text-xs text-zinc-100 dark:border-zinc-700"
            rows={8}
            value={value}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

const CodeInputInner: ComponentType<Props> = lazy(async () => {
    try {
        const mod: Record<string, unknown> = await import("@particle-academy/fancy-code");
        const CodeEditor = mod.CodeEditor as CodeEditorComponent | undefined;
        if (!CodeEditor) return { default: FallbackTextarea };
        return {
            default: ({ value, language, theme, onChange }: Props) => (
                <div className="overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
                    <CodeEditor
                        value={value}
                        onChange={onChange}
                        language={language}
                        theme={theme}
                        lineNumbers
                        wordWrap
                        minHeight={140}
                        maxHeight={280}
                    >
                        <CodeEditor.Panel />
                    </CodeEditor>
                </div>
            ),
        };
    } catch {
        return { default: FallbackTextarea };
    }
});

export function CodeInput(props: Props) {
    return (
        <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Code</label>
            <Suspense fallback={<FallbackTextarea {...props} />}>
                <CodeInputInner {...props} />
            </Suspense>
        </div>
    );
}
