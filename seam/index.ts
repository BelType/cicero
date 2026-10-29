/// <reference types="node" />
/**
 * Cicero's BelType adapter — the seam's third implementation, and its second paged one. **Beta since 2026-08-25** ([Cicero enters the seam in beta](../../../.claude/decisions/cicero/cicero-enters-the-seam-in-beta.md)).
 *
 * This directory is the one place in the package allowed to import outward. `src/` is governed by the design tablet and depends on nothing — not on BelType, not on npm — and that property is what keeps the interior portable and its unit suites browserless. The arrow points one way: `seam/` imports `src/`, and nothing under `src/` may import anything here.
 *
 * **What beta means, in three checkable facts.**
 *
 * 1. *Opt-in.* `pagedjs` is still the default; a document that does not name `--engine cicero` is untouched by any of this.
 * 2. *On screen only.* `renderPdf` refuses and names `--engine pagedjs`, on the `engine-site` precedent. The Press's genuine-print delivery is undesigned (the capability checklist, §6), and a paged engine that printed through an unproven path would be this venue's own worst scar — a green nobody can explain — wearing a new coat.
 * 3. *Render conditions are visible.* The DPR half of *render-identical conditions* (I5) is relaxed for the preview and the browser console says so on every run (`client.js`); the explicit-line-height half is provided by the interface sheet, which sits before author sheets and loses every tie.
 *
 * The seam crosses at the level of a finished paged document, which is why so little code is needed here: BelType hands over compiled HTML plus standard CSS Paged Media, and Cicero's whole job is to realize it. Nothing about the belt is Cicero-shaped and nothing here is belt-shaped.
 *
 * @remarks **Checked in node programs only, on purpose.** `vendorAssets` reaches `fileURLToPath` from `url`, which no tab may have, so the package's own program (`lib: dom`, no node types) excludes this file and the editing tools' tab program maps it to `editing-tools/assets/types/cicero-seam.d.ts`, as it does Paged.js's seam; the CLI's, the editing server's and root `test/` check it.
 *
 * @packageDocumentation
 */

import { fileURLToPath } from 'url';
import { BuildError } from '@beltype/common/errors';
import { WORDS_RULES } from '../src/data-beltype.ts';
import type { Engine } from './engine.ts';

/**
 * The second half of *render-identical conditions* (I5), as a string rather than a file (the interface sheet splits, 2026-08-27).
 *
 * Cicero refuses to adjudicate a document whose root line-height computes to `normal` (src/measure.js, the DPR ruling): `normal` is font-metric-derived, and a law that cannot name the leading cannot promise the cut. BelType's UA addendum sets `line-height` on `body`, never on the root, so without this rule every BelType document would refuse.
 *
 * The value is the addendum's own 1.65 rather than an invention, so on the one surface where it can actually cascade — the HTML lane, which ships no addendum — the engine's provision and BelType's default agree. Below `body` it is inert: the addendum's own `body` rule wins by proximity.
 *
 * It is a literal here, and not a line in the linked sheet beside it, because a conformance provision that can 404 is not a provision. A missing sheet — a table entry lost in a refactor, a server restarted mid-edit — would arrive as `I5 (DPR ruling): explicit line-height required`, a law refusing on a typographic claim when the real fault is a missing file, sending the reader to their own stylesheet. Cicero's refusals are load-bearing because they are true; one that names the wrong thing spends that.
 *
 * Recorded as a beta limitation, because the check the law performs is at the root and this satisfies it there: a document whose deeper typography still relies on `normal` is outside what *render-identical conditions* (I5) can see.
 */
const I5_PROVISION = ':root { line-height: 1.65; }';

/**
 * What the document says about a PDF `<object>` before the engine has met it (*the embedded PDF*, 2026-10-14; `seam/facsimile.js`).
 *
 * The first rule hides every such element OUTSIDE `<beltype-root>`: the document's own first load would otherwise lay the `<object>` out, fetch the file and start the browser's PDF viewer — measured, twice and a frame — before the intake parks the original, where it costs nothing. An original inside the root keeps its own computed style, which Cicero reads. **It is safe only because a presenter is registered before the first measure** (measured: without one the Gauge's measuring copies, which live in a `div` in `body` outside the root, are matched and measured as `display: none`), so a document that holds such an element and cannot load `seam/facsimile.js` must refuse, and the client does. The second rule is the default for what the browser would call an inline replaced element, and is zero-specificity so any author rule wins: an `<object>` showing fallback content (the facsimile's canvas) is not replaced, and without it `width` and `height` would not apply to it.
 */
const PDF_OBJECT_RULES = 'object[type="application/pdf"]:not(beltype-root *) { display: none; } :where(object[type="application/pdf"], object[is="beltype-facsimile"]) { display: inline-block; }';

export const ciceroEngine = {
  /**
   * Head fragment: three things, in this order — the provision for *render-identical conditions* (I5) as a literal `<style>` (which also carries the words sheet's rules, `src/dressing.js`: the engine's `!important` trimming and hiding, in a cascade layer that this sheet, first in the head, names first), the screen chrome as a `<link>`, and the client module. Both styles carry `data-beltype`, which is how the rewrite leaves the engine's own sheets as they are (*the measure runs under print media*, 2026-10-06): the interface sheet says `@media screen` and `@media print` on purpose.
   *
   * The sheet was constructed here until 2026-08-27 (the lean-seam posture: one fewer file in every export). The interface-sheet split moved it out, and its motive is the whole of why: `headHtml()` is what a host composes, and a host may be a browser tab with no filesystem — BelType's editing tools compose this fragment client-side and never call `vendorAssets()`. An `fs.readFileSync` inside a seam member made the adapter unimportable there. What could not be linked along with the chrome is the conformance provision above; what could is everything else.
   *
   * The client is loaded as a deferred module script from the head, which puts it in the document's module graph before the shell's bootstrap module runs — module scripts execute in source order — so `window.__beltypeCicero` is set by the time `bootstrapJs()`'s statements ask for it. Loading it here rather than importing it from the bootstrap is also what keeps the URL out of the bootstrap, which is handed no base.
   *
   * @param base - `/` in preview, a relative prefix in an export.
   */
  headHtml(base: string) {
    return `<style data-beltype="cicero-provision">${WORDS_RULES}${I5_PROVISION}${PDF_OBJECT_RULES}</style>
  <link rel="stylesheet" data-beltype="cicero-interface" href="${base}_beltype/cicero-interface.css">
  <script type="module" src="${base}_beltype/cicero/seam/client.js"></script>`;
  },

  /**
   * Pagination statements, spliced by the shell into its single bootstrap module after the compiler's own client stages. The wait is the point: mermaid draws in those stages, and a diagram measured before it has drawn gives every cut downstream of it the wrong height.
   *
   * **The CLI's policy for pagination that can stop at a page** (*the pages are cut as far as they are asked*, 2026-10-12; Egildo's ruling 5 on the note's recommendation): cut the first screen and one page more — or, where the address names a place, as far as the page that holds it — let the browser paint them (when getting them took 100 ms or more, so that the rest is worth waiting for), and then cut to the end without pausing. The reader sees the first page after the time it takes to cut two, and the rest arrives behind it; nothing else about the run changes, and `beltype:ready` for a host that waits on the whole document is `run()`'s promise, which still resolves when the document is complete. The engine offers the mechanism and this is a host's choice: the editing tools choose another.
   *
   * A failure degrades to the unpaginated document rather than a blank page, and says why. Cicero's refusals are load-bearing (*render-identical conditions*, I5: it will not adjudicate under conditions print cannot reproduce), so a refusal must reach the operator as text, not as an empty screen.
   */
  bootstrapJs() {
    return `      if (window.__beltypeCicero) {
        try {
          const cicero = window.__beltypeCicero;
          const named = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
          let answer = await cicero.run({ until: named || 2 });
          if (!answer.complete) {
            const sheet = document.querySelector('beltype-root')?.shadowRoot?.querySelector('beltype-page');
            const pitch = sheet ? sheet.getBoundingClientRect().height + 16 : 0;
            const screen = pitch > 16 ? Math.ceil(window.innerHeight / pitch) + 1 : 2;
            if (!named && screen > answer.pages) answer = await cicero.run({ until: screen });
          }
          if (!answer.complete) {
            // The first view is given a frame to paint in only when it took long enough for the rest to take longer: a document the whole run of which is a few frames is better shown whole, and the frame costs a document that short a fifth of its time.
            if (answer.ms >= 100) await new Promise((resolve) => {
              const late = setTimeout(resolve, 100);
              requestAnimationFrame(() => setTimeout(() => { clearTimeout(late); resolve(); }));
            });
            await cicero.run();
          }
        } catch (error) {
          console.error('BelType/Cicero refused to paginate this document — showing it unpaginated instead.\\n' + (error && error.message || error));
        }
      } else {
        console.error('BelType/Cicero: the engine client did not load; the document is unpaginated.');
      }`;
  },

  /**
   * The engine's half of the `/_beltype/` asset table: the chrome sheet as a file, and the two source directories at their own depths under the `cicero/` prefix.
   *
   * **The depths are the disk's** (*the host rewrites what the parser drops*, 2026-09-14). `src/` used to be published flat beside the client, which is why `client.js` imported `./driver.js` and could not be resolved under Node at all — a posture stated in its own header and paid for the moment `seam/` grew a second module: the rewriter imports the encoding contract from `src/`, and no one specifier could name it both on disk and under a flattened URL. Publishing `seam/` at `cicero/seam/` and `src/` at `cicero/src/` makes the two agree, so every import in this directory is an ordinary relative path that resolves in a browser and in Node alike. The two prefixes are disjoint, so nothing here depends on the order `serveBeltypeAsset` reads them in.
   *
   * The chrome sheet sits flat as `cicero-interface.css`, deliberately outside the `cicero/` prefixes that `dirs` owns: a `files` key inside a `dirs` prefix would make the two tables disagree about who answers that path, and `serveBeltypeAsset` resolves `files` first, so the disagreement would be silent.
   *
   * **`cicero/seam/csstree.js` is the one entry that is not the file of that name on disk** (with the two pdf.js entries beside it, which are the same thing for the same reason), and it has to be: css-tree ships a browser ESM bundle and Node resolves the package, so the seam holds a one-line re-export for Node and this table answers the same URL with the bundle. `seam/csstree.js`'s own header says so from the other side. The bundle is found through `import.meta.resolve` rather than by a guessed path into `node_modules`, because a workspace may hoist the copy or nest it — this repository nests it, since Paged.js pins css-tree 1.x at the root — and a hardcoded depth would 404 the day that changed.
   *
   * `src/hyphen-patterns/` is a subdirectory, and it is the first `dirs` entry in BelType's history that has one. The exporter's directory copy was flat until this round; it is recursive now, which is a fault this engine's arrival found rather than caused.
   *
   * The paths are computed here rather than at module scope, and that is the second half of the interface sheet splits: `fileURLToPath` throws on a non-`file:` URL, so a module-scope `__dirname` made this file unimportable in a browser tab. A host without a filesystem has no use for this table and must never call this method; lazy, the node-only expression is reached only by a host that can honour it.
   */
  vendorAssets() {
    const seam = new URL('./', import.meta.url);
    return {
      files: {
        'cicero-interface.css': fileURLToPath(new URL('cicero-interface.css', seam)),
        'cicero/seam/csstree.js': fileURLToPath(import.meta.resolve('css-tree/dist/csstree.esm')),
        // pdf.js, for `seam/facsimile.js` (the embedded PDF, 2026-10-14): the library's own minified ESM module and its worker, published at names the module imports by URL. Vendored, never fetched from a CDN; the two entries that are not the file of their own name, beside css-tree's.
        'cicero/seam/pdfjs.js': fileURLToPath(import.meta.resolve('pdfjs-dist/build/pdf.min.mjs')),
        'cicero/seam/pdfjs-worker.js': fileURLToPath(import.meta.resolve('pdfjs-dist/build/pdf.worker.min.mjs'))
      },
      dirs: {
        'cicero/seam': fileURLToPath(seam),
        'cicero/src': fileURLToPath(new URL('../src', seam))
      }
    };
  },

  /**
   * Refused, and named. Cicero paginates on screen; delivering those pages to genuine print is the Press, whose design is open (checklist §6) — the essay package prints Cicero's presented pages as a *gate*, over a fixed corpus with a token partition to check against, which is a very different claim from "this PDF is right".
   *
   * Throwing rides the seam's rejection path, the same one `engine-site` uses: the build fails with a clear message instead of the engine wearing a stub. That path is pinned in `test/orchestrator.test.js`.
   */
  async renderPdf() {
    throw new BuildError(
      'Cicero is in beta and paginates on screen only — it has no PDF path yet (the Press\'s print delivery is undesigned). ' +
      'Render the PDF with `--engine pagedjs` (the default), or drop `--pdf` to preview the document under Cicero.'
    );
  }
};
