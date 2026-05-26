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
