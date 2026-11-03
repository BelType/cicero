# Plan 001: release

**Constitution check.** Principle I: the sentence is added to SPEC.md XII.7. Principle III: the fault is a leak found in the kept page, proved red/green by the cli's font-switching byte-identity test. Principle IV: no new import; `src/root.ts` gains one method, DOM-reaching only inside the existing element. Principle VI: the refusal after release names its cause. No dependency, no Complexity Tracking.

**Inventory** (what `document.open()` leaves alive): the client's `loadingdone` counter (now named); the rim (`stop()` already complete; its inert pending frames and `whenDefined` chains check `stopped`); `batch` and the `lateTruth` loop; the root's `hashchange` and `beforeprint` window listeners, its `IntersectionObserver` and idle slice; the facsimile's module-level `IntersectionObserver`; the handle. Bootstrap timers in `seam/index.ts` finish by themselves.

**Design.** `seam/client.ts`: a named listener, a `released` flag of the module instance, `export async function release()`, a `handle` constant the module uses instead of reading `window.__beltypeCicero` (so a late write by a finishing run never lands on the next client's handle), `run()` rejecting after release, the pacer rejecting a cancelled session. `src/root.ts`: per-instance `dispose()`. `seam/facsimile.ts`: `dispose()` disconnecting the observer, recreated lazily. Nothing module-level that the element classes read is touched.

**Measured 2026-11-03.** `customElements.define` of a name twice throws `NotSupportedError`; all three definitions are guarded by `customElements.get`. The same module URL imported again after `document.open()` does not run; a keyed URL does.
