# Spec 001: release

**Why.** `beltype serve` keeps one print page and re-seats each document into it with `document.open()`. The `Window`, its `FontFaceSet` and every listener registered on them survive. The previous client's rim and its `loadingdone` listener then hear the next document's faces as late truth and start a run of their own, and the host's run stops after one page.

**Ruling.** Egildo's ruling of 2026-11-03, the kept page of beltype serve (the decision record is owed in `codeberg.org/BelType/decisions`).

**Requirements** (SPEC.md Article XII.7)
1. The handle gains `release()`. After it, nothing the client registered still runs: the `loadingdone` listener is removed, the rim is stopped, the batch of late truth is dropped, the root's idle build, observer and window listeners are released, the facsimile observer is disconnected and the handle is deleted from the window.
2. A run stopped at a page is let go. A run measuring stops at its next page; one that cannot be paced finishes. The promise resolves when nothing is under way.
3. `run()` after `release()` rejects by name. `release()` twice is a no-op.
4. No state of the custom-element classes is changed: the window keeps their definitions, and the next document is built from them.

**Out of scope.** Undefining custom elements (impossible). Cancelling an unpaced run mid-page.
