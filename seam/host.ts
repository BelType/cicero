/**
 * The host face, `@beltype/cicero`: what a host that is not BelType's CLI needs to paginate a document with Cicero.
 *
 * @remarks
 * `ciceroEngine` is the engine's side of BelType's engine seam (its head, its bootstrap, its vendored assets); `rewriteDocumentSheets` makes a document's sheets Cicero's (the `@page` world renamed, optionally under a layer the host names). The page-side API is the client handle, `window.__beltypeCicero`, typed in `seam/handle.d.ts`.
 *
 * @packageDocumentation
 */

export { ciceroEngine } from './index.ts';
export { rewriteDocumentSheets } from './rewrite-document.ts';
export { ciceroFlags } from './flags.ts';
