# @beltype/cicero

Cicero is a paged-media engine for the live browser. It cuts a document into pages under CSS Paged Media (`@page`, margin boxes, running elements, named strings, counters, fragmentation) and presents them as real `<beltype-page>` frames, editable and re-cut in place. Beta.

`SPEC.md` is what it does; `.specify/memory/constitution.md` is how it is worked on.

## Faces

| Import | What |
| --- | --- |
| `@beltype/cicero` | The host face: `ciceroEngine` (BelType's engine seam) and `rewriteDocumentSheets`. |
| `@beltype/cicero/client` | The page side: loading it sets `window.__beltypeCicero`, typed in `seam/handle.d.ts`. |
| `@beltype/cicero/facsimile` | The embedded PDF page (`<object type="application/pdf">`). |
| `@beltype/cicero/fragmentation` | The members a view adapter builds on, re-exported unchanged. |
| `@beltype/cicero/internal/*` | Every module of `src/`, for BelType's essay venue. **Unstable**: no promise across versions. |

Installed as a git dependency for now:

```json
"@beltype/cicero": "git+ssh://git@codeberg.org/BelType/cicero.git#v0.1.0"
```

`prepare` builds `dist/`, so the install is a built package.

## Working on it

```bash
pnpm install
pnpm run check   # tsc over src and seam, strict
pnpm test        # node:test, the .ts tests run directly
pnpm run build   # dist/
```

The battery (the essay venue's gates) lives in BelType and runs against this package's `dist/`.

MIT.
