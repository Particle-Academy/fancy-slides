/**
 * Placeholder shown when an OPTIONAL peer package isn't installed. The
 * chart / code hosts load their peer (`fancy-echarts` / `fancy-code`) via a
 * guarded dynamic import; if that import resolves to a stub (because the
 * consumer never installed the peer), the host renders this instead of
 * crashing — and, crucially, the consumer's build never fails on a missing
 * static import.
 *
 * Inline styles only (no Tailwind), fills 100%×100% so it drops into the
 * element box exactly like the real widget would.
 */
export function PeerMissing({ label, install }: { label: string; install: string }) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4em",
                textAlign: "center",
                padding: "0.6em",
                boxSizing: "border-box",
                border: "1px dashed currentColor",
                borderRadius: 8,
                opacity: 0.6,
                overflow: "hidden",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
        >
            <span style={{ fontWeight: 600 }}>{label}</span>
            <code
                style={{
                    fontSize: "0.72em",
                    opacity: 0.85,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
            >
                {install}
            </code>
        </div>
    );
}
