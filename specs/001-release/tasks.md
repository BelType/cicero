# Tasks 001: release

- [x] Name the `loadingdone` listener; add `released` and `release()` to `seam/client.ts`; add `release` to the `Handle`.
- [x] `handle` constant in place of reads of `window.__beltypeCicero`.
- [x] `run()` rejects after release; the pacer rejects a cancelled session.
- [x] `BeltypeRoot.dispose()`, naming its window listeners.
- [x] `facsimile.dispose()`.
- [x] `test/release.test.ts`: after `stop()` every listener the rim added is removed (DOM-free).
- [x] SPEC.md XII.7; CHANGELOG.
- [x] `pnpm run check`, `pnpm test`, `pnpm run build`.
- [x] `test/browser/release.browser.ts` (`pnpm run test:browser`, playwright-core 1.63.0): six cases in headless Chromium, each seen red.
- [ ] The kept page's re-seat proves it in the cli (uncommitted proof, reverted).
- [ ] The decision record in `codeberg.org/BelType/decisions` (owed).
