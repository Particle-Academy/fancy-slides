import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./vitest.setup.ts"],
        // Vitest empties CSS imports by default, `?raw` included. The stage
        // surround tests load the package stylesheet into jsdom, so let it through.
        css: { include: [/src[/]styles[.]css/] },
    },
});
