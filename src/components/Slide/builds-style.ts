/**
 * Pure-CSS entrance animations for element builds. Mirrors the slide-level
 * transition approach in `SlideViewer`: a set of keyframes wrapped in a
 * `prefers-reduced-motion: no-preference` guard, plus a helper that picks the
 * right `animation-name` + timing for a given element animation.
 *
 * No runtime deps — keyframes are injected via a `<style>` tag by `<Slide>`.
 */

import type { CSSProperties } from "react";
import type { ElementAnimation } from "../../types";

const DEFAULT_BUILD_DURATION = 500;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out

/**
 * Inline style that plays an element's entrance build. `delay` is the
 * *effective* delay already resolved for with-prev / after-prev chaining.
 * Under reduced-motion the keyframes are disabled in CSS, so the element
 * simply appears at its final frame.
 */
export function buildEnterStyle(animation: ElementAnimation, effectiveDelay: number): CSSProperties {
    const duration = animation.duration ?? DEFAULT_BUILD_DURATION;
    const dir = animation.direction ?? "left";
    let name: string;
    switch (animation.effect) {
        case "fade":
            name = "fs-build-fade";
            break;
        case "zoom":
            name = "fs-build-zoom";
            break;
        case "fly-in":
            name = `fs-build-fly-${dir}`;
            break;
        case "wipe":
            name = `fs-build-wipe-${dir}`;
            break;
        default:
            name = "fs-build-fade";
    }
    return {
        animationName: name,
        animationDuration: `${duration}ms`,
        animationDelay: `${effectiveDelay}ms`,
        animationTimingFunction: EASE,
        animationFillMode: "both",
    };
}

/**
 * Keyframes for every build effect. `fly-in` translates from the named
 * direction; `wipe` reveals via a `clip-path` inset growing from that edge.
 * Reduced-motion users get no animation — `animation-fill-mode: both` would
 * otherwise pin the `from` frame, so we disable the build animations entirely
 * (the elements are still gated on clicks, they just appear instantly).
 */
export const BUILD_KEYFRAMES = `
@media (prefers-reduced-motion: reduce) {
    .fs-build-enter { animation: none !important; }
}
@media (prefers-reduced-motion: no-preference) {
    @keyframes fs-build-fade {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes fs-build-zoom {
        from { opacity: 0; transform: scale(0.8); }
        to { opacity: 1; transform: scale(1); }
    }
    @keyframes fs-build-fly-left {
        from { opacity: 0; transform: translateX(-24%); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fs-build-fly-right {
        from { opacity: 0; transform: translateX(24%); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fs-build-fly-up {
        from { opacity: 0; transform: translateY(24%); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fs-build-fly-down {
        from { opacity: 0; transform: translateY(-24%); }
        to { opacity: 1; transform: translateY(0); }
    }
    /* wipe: clip-path inset reveals from the named edge toward the opposite one.
       inset(top right bottom left) — start fully clipped on the far side. */
    @keyframes fs-build-wipe-left {
        from { clip-path: inset(0 100% 0 0); }
        to { clip-path: inset(0 0 0 0); }
    }
    @keyframes fs-build-wipe-right {
        from { clip-path: inset(0 0 0 100%); }
        to { clip-path: inset(0 0 0 0); }
    }
    @keyframes fs-build-wipe-up {
        from { clip-path: inset(100% 0 0 0); }
        to { clip-path: inset(0 0 0 0); }
    }
    @keyframes fs-build-wipe-down {
        from { clip-path: inset(0 0 100% 0); }
        to { clip-path: inset(0 0 0 0); }
    }
}
`;
