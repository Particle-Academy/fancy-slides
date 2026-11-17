# Contributing to @particle-academy/fancy-slides

Notes for anyone, human or agent, working ON this package's code. How to USE the
package is in [AGENTS.md](./AGENTS.md); what it is, is in [README.md](./README.md).
`CLAUDE.md` is a symlink to this file, so Claude Code reads these notes when it
works in this repo.

## Commands

```bash
npm run build   # tsup
npm run dev     # tsup --watch
npm run lint    # tsc --noEmit && eslint .
npm test        # vitest run
npm run clean   # remove dist/
```

## Tests

vitest, colocated in `__tests__/` folders beside the components
(`src/components/**/__tests__/*.test.tsx`), with `vitest.setup.ts` at the root.

## Changelog

Update `CHANGELOG.md` in the same commit as the change.
