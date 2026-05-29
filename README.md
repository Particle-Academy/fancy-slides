# @particle-academy/fancy-slides

Presentation editor + web viewer for the Fancy UI set. Google-Slides-style deck
authoring with a JSON-friendly schema, full keyboard-driven viewer, and an agent
bridge so LLMs can compose decks directly.

## Install

```bash
npm install @particle-academy/fancy-slides @particle-academy/react-fancy
```

Optional peers (only needed if your decks include those element types):

```bash
npm install @particle-academy/fancy-echarts   # ChartElement
npm install @particle-academy/fancy-code      # CodeElement
```

## Quickstart — viewer

```tsx
import { SlideViewer } from "@particle-academy/fancy-slides";
import "@particle-academy/fancy-slides/styles.css";

const deck = {
    id: "demo",
    title: "Welcome",
    slides: [
        {
            id: "s1",
            layout: "title",
            elements: [
                {
                    id: "e1",
                    type: "text",
                    x: 0.1, y: 0.4, w: 0.8, h: 0.2,
                    content: "Welcome to Fancy Slides",
                    style: { fontSize: 48, weight: "bold", align: "center" },
                },
            ],
        },
    ],
    theme: { name: "default" },
};

<SlideViewer deck={deck} />
```

## Quickstart — editor

```tsx
import { DeckEditor } from "@particle-academy/fancy-slides";

function App() {
    const [deck, setDeck] = useState(initialDeck);
    return <DeckEditor value={deck} onChange={setDeck} />;
}
```

## Human+ contract

`fancy-slides` is designed around the Human+ contract: humans and agents share
the same surface. The deck is plain JSON — easy for an LLM to emit. Every
slide and element has a stable `id`. State is controlled. An agent bridge
exposes MCP tools (`deck_add_slide`, `slide_add_element`,
`slide_set_layout`, `deck_apply_theme`, …) so agents drive the deck via the
same operations a human would.

See `docs/human-plus.md` for the full contract.

## Element types

| Type     | Renders via                                | Notes |
|----------|--------------------------------------------|-------|
| `text`   | inline contenteditable (or react-fancy `Editor`) | rich text, markdown |
| `image`  | `<img>`                                    | URL or data URI |
| `chart`  | `@particle-academy/fancy-echarts` `<EChart>` | optional peer |
| `code`   | `@particle-academy/fancy-code` `<CodeEditor>` | optional peer |
| `table`  | react-fancy `<Table>`                      | |
| `shape`  | SVG primitives (rect, ellipse, line, arrow) | |
| `embed`  | iframe                                     | for video / external |

## Build animations

Any element can carry an `animation` to reveal it as an entrance "build step",
the way PowerPoint/Keynote builds work:

```ts
element.animation = {
    effect: "fly-in",      // "fade" | "fly-in" | "zoom" | "wipe"
    trigger: "on-click",   // "on-click" (new step) | "with-prev" | "after-prev"
    direction: "left",     // for fly-in / wipe
    duration: 500,         // ms
    delay: 0,              // ms
    order: 0,              // build order, ascending; ties broken by element index
    byParagraph: false,    // text only — reveal one line/bullet per click
};
```

For a **text** element you can set `byParagraph: true` to reveal it one
paragraph at a time (PowerPoint/Google Slides "By paragraph"). The element's
`content` is split on `"\n"` (a trailing empty line is dropped) and expands into
one build per line — the first line uses the element's own `trigger`, every
subsequent line reveals on a fresh click. Each markdown line renders through the
normal path, so a `- …` bullet line builds in as its own item. Toggle it from
the Build tab when a text element has an effect selected.

A slide's builds group into *click steps*: the first build and every
`on-click` build opens a new step; `with-prev` plays alongside that step's lead
and `after-prev` follows it. In `SlideViewer` / `PresenterView`, → / Space /
click fires the next step, then advances to the next slide once all builds have
run; ← steps back a whole slide shown fully built. Elements with no `animation`
are always visible; the editor canvas always shows everything. All effects are
pure CSS and honor `prefers-reduced-motion: reduce`. Edit builds in the
inspector's **Build** tab (per element) and the **Build order** list in slide
settings.

## Theme

```ts
type Theme = {
    name: string;
    colors: { background, text, accent, muted };
    fonts: { heading, body, mono };
    slideRatio: 16 / 9;
};
```

A few built-in themes ship; consumers can register their own.

## License

MIT
