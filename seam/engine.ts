/**
 * `engine.js` — THE ENGINE SEAM, the whole of what BelType asks of whatever realizes a compiled document (Paged.js, the site, Cicero, a test double).
 *
 * Types, and one runtime value — {@link PRINTERS}, the table of printer names, because a printer name crosses this seam and the parser that admits one (`cli/src/args.js`) must not keep a second copy. The contract is written here, in `packages/common`, because an engine depends on common and never on core, and the two packages that compose an engine (`core/src/shell.js`, `cli/src/orchestrator.js`) both already do.
 *
 * @remarks
 * The seam is internal — constructor injection from the orchestrator's composition table, no published API. An engine module is importable everywhere, a browser tab included; capability lives inside members, never at module scope (pinned by `test/engine-seams.test.js`; see CHANGELOG 2026-08-28).
 *
 * @see .claude/decisions/project/types-live-beside-the-code.md
 * @packageDocumentation
 */

import type { BuildError } from '@beltype/common/errors';

/** The `/_beltype/` asset table — an engine's half of it, or the compiler's (`cli/src/client-assets.js`), or their union. One table, every consumer, so no two servers can disagree about what a `/_beltype/` URL means. */
export type AssetTable = {
  /** URL path relative to `/_beltype/` (`vendor/paged.polyfill.js`) to the absolute path of the one file that answers it. Resolved BEFORE `dirs`, so a `files` key inside a `dirs` prefix silently wins — keep them disjoint. */
  files: Record<string, string>;
  /** URL prefix relative to `/_beltype/` (`cicero/src`) to the absolute path of a directory served whole, subdirectories included. */
  dirs: Record<string, string>;
};

export type BootstrapOptions = {
  /** Ask for a bootstrap that paginates nothing and only signals that the shell's client stages are over, because the host must act before the first page is cut (Caster's `prepare()` changes layout). Honoured by Paged.js; an engine with nothing to defer ignores it. Default `false`. */
  hostDriven?: boolean;
};

/** The printers a `--pdf` run may end in; the first is the default. Frozen: the one table, read by the seam's types and by the parser that refuses every other name. */
export const PRINTERS = Object.freeze((['chromium', 'caster'] as const));

/** A printer a `--pdf` run may end in — the names in {@link PRINTERS}. */
export type PrinterName = typeof PRINTERS[number];

export type RenderPdfOptions = {
  /** Who writes the PDF once the pages stand: Chromium's own print, or Caster over the pages the engine presented. An engine that cannot serve the named printer refuses; it never falls back. Default `'chromium'`. */
  printer?: PrinterName;
};

/** A realized document's pages: a file name (`index.html`, `<heading id>.html`) to the whole HTML document served under it, in reading order. */
export type Pages = Record<string, string>;

/** An engine: four members, all required, and one optional. An engine that cannot honour a required member refuses by throwing from it (a {@link BuildError} naming the door that can), never by omitting it — `engine-site` and `engine-cicero` throw from `renderPdf`, the Paged.js seam throws from `vendorAssets`, and `test/null-engine.js` is the floor. The optional member, `realize`, is omitted by every engine with nothing to answer, which is every engine but the site (*the chunked site*, 2026-10-19, ruling R3a). */
export type Engine = {
  /** The engine's head fragment, as HTML text: its interface sheet, its client script, its configuration. `base` is the prefix every `/_beltype/` URL in it is written against — `/` when served. The shell seats it BEFORE author sheets, so an author rule wins a tie on source order. Pure string work: callable in any realm, a tab with no filesystem included, and it must not throw. */
  headHtml: (base: string) => string;
  /** JavaScript STATEMENTS (not a module, not a function) the shell splices into its one bootstrap module script after the compiler's own client stages, so they may `await` and they run once mermaid has drawn. Owns the engine's completion signal end to end. Pure string work: callable in any realm, and it must not throw. */
  bootstrapJs: (options?: BootstrapOptions) => string;
  /** The engine's half of the `/_beltype/` table. Synchronous, and node only: it answers where files live on this machine, which a tab has no business asking; a composable seam face that cannot answer throws a {@link BuildError} naming the node face. */
  vendorAssets: () => AssetTable;
  /** Render the document served at `url` (a live `http://` URL the caller's own server answers — never a directory, never `file://`) to a PDF at `pdfPath`, and resolve to `pdfPath`. Node only. An engine with no print artifact rejects with a {@link BuildError} naming `--engine pagedjs`; the orchestrator lets that rejection fail the build (pinned in `test/orchestrator.test.js`). */
  renderPdf: (url: string, pdfPath: string, options?: RenderPdfOptions) => Promise<string>;
  /** Cut the whole wrapped document into the pages the engine's medium serves, or answer `null` for one page. Node only, and asynchronous because the cut is reached by a lazy import, as `vendorAssets` reaches its paths lazily. The pipeline calls it once per render, after the closure, and publishes what it answers beside `html` (`pipeline.js`'s `assemble`). The site engine answers it under `site.chunk`; an engine that omits it publishes no pages. */
  realize?: (html: string, config: { site?: { chunk?: number } }) => Promise<Pages | null>;
};

/** The composable face — the two members any host may call unconditionally, and the whole of what `core/src/shell.js` calls, with `realize`, which the pipeline calls when an engine has it. A tab composes a document from the two alone. */
export type ComposableEngine = Pick<Engine, 'headHtml' | 'bootstrapJs' | 'realize'>;

