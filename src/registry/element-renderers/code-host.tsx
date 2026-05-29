import { lazy, Suspense, type ComponentType } from "react";
import type { CodeElement } from "../../types";
import { PeerMissing } from "./peer-missing";

/**
 * fancy-code is an OPTIONAL peer. As with chart-host, a static
 * `import { CodeEditor } from "@particle-academy/fancy-code"` would make
 * Rollup statically resolve the peer at CONSUMER build time and fail with
 * MISSING_EXPORT when it isn't installed. We load it via a DYNAMIC import and
 * read `CodeEditor` off the resolved module at RUNTIME, guarding the stub case.
 */
interface InnerProps {
    code: string;
    language: string;
    codeTheme: string;
    lineNumbers: boolean;
}

const CodeInner: ComponentType<InnerProps> = lazy(async () => {
    try {
        const mod: Record<string, unknown> = await import("@particle-academy/fancy-code");
        // CodeEditor is a component with a static `.Panel` sub-component.
        const CodeEditor = mod.CodeEditor as
            | (ComponentType<{
                  value: string;
                  language: string;
                  theme: string;
                  readOnly?: boolean;
                  lineNumbers?: boolean;
                  children?: React.ReactNode;
              }> & { Panel: ComponentType })
            | undefined;
        if (!CodeEditor) {
            return { default: () => <PeerMissing label="Code" install="npm i @particle-academy/fancy-code" /> };
        }
        return {
            default: ({ code, language, codeTheme, lineNumbers }: InnerProps) => (
                <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 8 }}>
                    <CodeEditor value={code} language={language} theme={codeTheme} readOnly lineNumbers={lineNumbers}>
                        <CodeEditor.Panel />
                    </CodeEditor>
                </div>
            ),
        };
    } catch {
        return { default: () => <PeerMissing label="Code" install="npm i @particle-academy/fancy-code" /> };
    }
});

export default function CodeHost({ element }: { element: CodeElement }) {
    return (
        <Suspense fallback={null}>
            <CodeInner
                code={element.code}
                language={element.language ?? "javascript"}
                codeTheme={element.codeTheme ?? "dark"}
                lineNumbers={element.lineNumbers ?? true}
            />
        </Suspense>
    );
}
