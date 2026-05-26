import { CodeEditor } from "@particle-academy/fancy-code";
import type { CodeElement } from "../../types";

export default function CodeHost({ element }: { element: CodeElement }) {
    return (
        <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 8 }}>
            <CodeEditor
                value={element.code}
                language={element.language ?? "javascript"}
                theme={element.codeTheme ?? "dark"}
                readOnly
                lineNumbers={element.lineNumbers ?? true}
            >
                <CodeEditor.Panel />
            </CodeEditor>
        </div>
    );
}
