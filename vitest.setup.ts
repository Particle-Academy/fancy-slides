// jsdom lacks a few browser APIs that react-fancy primitives touch. Polyfill
// the minimum so component trees render under the test environment.
if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
}

if (typeof globalThis.matchMedia === "undefined") {
    // @ts-expect-error — minimal matchMedia shim for jsdom
    globalThis.matchMedia = (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
            return false;
        },
    });
}
