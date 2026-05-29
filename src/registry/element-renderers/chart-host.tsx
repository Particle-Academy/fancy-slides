import { lazy, Suspense, type ComponentType } from "react";
import type { ChartElement } from "../../types";
import { useIsDarkSlide } from "../../components/Slide/slide-context";
import { PeerMissing } from "./peer-missing";

/**
 * fancy-echarts is an OPTIONAL peer. A static `import { EChart } from
 * "@particle-academy/fancy-echarts"` would make Rollup statically resolve the
 * peer when a CONSUMER builds — and blow up with MISSING_EXPORT if they never
 * installed it. So instead we load the peer via a DYNAMIC import and read its
 * members off the resolved module at RUNTIME, guarding for the stub case.
 *
 * The dynamic `import().then(m => …)` resolves to the optional-peer stub when
 * the peer is absent (`m.EChart` is `undefined`), which we detect and swap for
 * a placeholder — no build-time named binding to break.
 */
interface InnerProps {
    option: unknown;
    theme: string | undefined;
}

const ChartInner: ComponentType<InnerProps> = lazy(async () => {
    try {
        const mod: Record<string, unknown> = await import("@particle-academy/fancy-echarts");
        const EChart = mod.EChart as
            | ComponentType<{ option: unknown; theme?: string }>
            | undefined;
        if (!EChart) {
            return { default: () => <PeerMissing label="Chart" install="npm i @particle-academy/fancy-echarts" /> };
        }
        // fancy-echarts ships its chart types as opt-in tree-shake-friendly
        // modules, so the consumer normally calls `registerAll()` somewhere
        // global. We wire it here, but only once the peer has actually loaded —
        // both calls are idempotent on echarts' side, so re-imports are safe.
        (mod.registerAll as (() => void) | undefined)?.();
        (mod.registerBuiltinThemes as (() => void) | undefined)?.();
        return {
            default: ({ option, theme }: InnerProps) => (
                <div style={{ width: "100%", height: "100%" }}>
                    <EChart option={option} theme={theme} />
                </div>
            ),
        };
    } catch {
        return { default: () => <PeerMissing label="Chart" install="npm i @particle-academy/fancy-echarts" /> };
    }
});

export default function ChartHost({ element }: { element: ChartElement; slideWidthPx: number }) {
    // Hooks stay in the OUTER component (Rules of Hooks); resolved values are
    // passed into the lazily-loaded inner. If the slide background reads as dark
    // and the chart doesn't pin a theme, fall back to echarts' built-in "dark".
    const isDarkSlide = useIsDarkSlide();
    const theme = element.chartTheme ?? (isDarkSlide ? "dark" : undefined);
    return (
        <Suspense fallback={null}>
            <ChartInner option={element.option} theme={theme} />
        </Suspense>
    );
}
