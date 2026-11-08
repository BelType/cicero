# Cicero — a paged-media engine for the live browser

> The product constitution. It says what Cicero means: what a host may ask of it, what it answers, and the laws each answer keeps. How Cicero is built is the engineering constitution's business, `.specify/memory/constitution.md`.

**Status:** ratified at the move into its own repository, 2026-10-29. It is a living document, amended by named article with an entry in the amendment log (§17), never by drift.

**How to read a citation.** Every normative sentence names the decision record that owns it, as *(see* slug*)*. The record holds the reasoning and the measurement; this document holds the rule. Where no record owns a sentence, the sentence says so and names its owner: a law of the design tablet, cited name first and number beside, as *flow is forward* (I1), or a project record of BelType, marked *project*. A sentence that names neither is a defect in this document.

---

## 1. Motivation and scope

**Cicero paginates a finished HTML document in the browser it is shown in.** A host hands it HTML plus standard CSS Paged Media. Cicero cuts the document into pages, presents them as real elements in the same document, and answers where any source place landed. It never re-lays out text itself: the browser lays out, and Cicero decides where each page ends.

Three consumers are owed something different. The **host** embeds it and wants one handle, a small set of verbs and no surprises (Article XII). The **author** writes ordinary paged-media CSS and wants it honoured, or refused by name. The **view adapter**, a host that holds its own pages (a ProseMirror view, for one), wants the fragmentation machinery without the root that presents it (Article XIII, `./fragmentation`).

Non-goals at this version: a PDF path (the Press is undesigned, see *cicero-enters-the-seam-in-beta*); a second layout engine of any size (see *page-lengths-are-measured*); a parser of CSS inside the engine's interior (see *the-host-rewrites-what-the-parser-drops*).

## 2. Design principles

These are the design tablet's laws, carried as principles. The tablet stays sovereign over what pagination is; this list is how the articles below cite it.

1. **The engine is a set of questions, each with a solver.** Cicero owns every question; the browser keeps one only where measurement has shown it dependable (see *questions-and-solvers*).
2. **The browser is the oracle for geometry.** Every length, rect and line comes from the browser; Cicero owns the typographic decisions (see *page-lengths-are-measured*).
3. **Flow is forward.** A page starts where the previous ended; the Ledger is append-only (tablet, *flow is forward*, I1).
4. **A resume point is a path, one per flow** (tablet, I2, as amended by *the-cut-is-a-place-in-the-tree* and *a-parallel-flow-is-a-fragmentainer*).
5. **Breaks are classified; the line box is the atom** (tablet, *breaks are classified*, I3).
6. **Chrome is resolved, never flowed** (tablet, I4; delivered as declarations the page carries, see *the-page-carries-its-conditions*).
7. **A break decision is valid only under render-identical conditions** (tablet, I5; amended to write a fragment its feed's conditions, see *the-fragment-lays-out-under-the-feeds-conditions*).
8. **Content is one document; pages are views** (tablet, I6). Everything the author wrote is read exactly once (see *an-artifact-is-never-read*).
9. **The source document is never written.** Decisions land only as fragment hints or per-page literals (tablet, C5).
10. **The build cannot fail.** The make-up order is total and the page edge catches the rest (tablet, C2).
11. **A refusal is a detector; a fallback is a hiding place.** A fallback is allowed only where the fact is computed and only its presentation is unknown, and then it says so on the console (see *a-counter-has-a-style*).
12. **The engine knows no view.** Nothing in the engine names a consumer, and every door a view needs is a parameter (project, *the-engine-knows-no-view*).

## 3. Architecture: the pipeline

```
rewrite (seam) → intake → [ cast-off → grab → measure → gauge → stonehand → ledger ]* → reads → present → rim
```

| Stage | Modules | Responsibility |
|---|---|---|
| Rewrite | `seam/rewrite.js`, `seam/rewrite-document.js`, `seam/csstree.js` | The author's sheets into forms the browser's parser keeps (Article X). |
| Intake | `src/measure.js`, `src/capture.js` and its leaves | Render conditions, fonts, images, the geometry table (Article II). |
| Build loop | `src/driver.js`, `src/forcing-memo.js` | Cursor, bound, measure, adjudicate, append, advance (Article V). |
| Gauge | `src/gauge.js` | A sealed geometric report of one layout (Article III). |
| Stonehand | `src/stonehand.js` | Legality, classification, the make-up order (Article IV). |
| Ledger | `src/ledger.js`, `src/positions.js`, `src/word-space.js`, `src/resume.js` | The cuts, their addresses and the resume arithmetic (Article I). |
| Fragments | `src/fragments.js`, `src/data-beltype.js`, `src/dressing.js`, `src/has-words.js`, `src/presenters.js` | One construction of every piece, for the feed and the page (Article VI). |
| Compositor | `src/compositor.js`, `src/compose-dom.js`, `src/composition-key.js`, `src/hyphenate.js` | The composed mode's lines (Article VII). |
| Reads | `src/document-state.js`, `src/reads.js` | Counters, strings, running elements and pointers at a position (Article VIII). |
| View | `src/chase.js`, `src/root.js`, `src/source-point.js` | `<beltype-page>`, `<beltype-root>`, the source doors (Article IX). |
| Seam | `seam/index.js`, `seam/client.js`, `seam/rim.js`, `seam/facsimile.js` | The host's adapter, the browser entry, late truth (Article XI). |

`src/` imports nothing outside `src/`; `seam/` is the one directory that imports outward (see *cicero-enters-the-seam-in-beta*).

---

## 4. Article I — The address and the Ledger

Modules: `src/positions.js`, `src/word-space.js`, `src/ledger.js`, `src/resume.js`.

### I.1 The word space

1. A position is one integer, the global word index `gi = bases[b] + w`, over one word space; ordering is numeric (see *the-flat-position-space*).
2. A word is a maximal run of non-breaking characters in a block's joined text. It continues across a text-node or inline-element seam and stops at every boundary of a box that is not inline (see *a-word-stops-at-a-block-boundary*).
3. Whether a box is inline is read from its computed outer display through one predicate, `isInlineLevel`; a value is inline-level only when it says `inline`, or is `ruby` or `math` (see *the-outer-display-decides*).
4. U+00A0, U+202F and U+FEFF are part of a word. One character class, `BREAKING_SPACE`, is the only test any tokenizer applies (see *a-tie-is-not-a-break*).
5. An author's `<br>` ends a word; the engine's own break mark does not (see *a-line-inside-a-word-is-a-break-point*).
6. The four tokenizers (the position index, the fragments' `joinedWords`, the Gauge's word reading and the character walk) agree by sharing these predicates, never by parallel maintenance (see *a-word-stops-at-a-block-boundary*).
7. A detached clone is never asked for its style. Its elements are registered against their sources when the clone is made, and an unregistered element reads as inline (see *a-word-stops-at-a-block-boundary*).
8. Words are counted in source order, except inside a table, where they are counted in CSS 2.1 §17.2's display order: the table's first header group (`table-header-group`), then its rows and row groups in source order, then its first footer group (`table-footer-group`), wherever each is written; a later header or footer group is a row group, as §17.2 renders it. The order is computed once, by `inDisplayOrder` in `src/word-space.ts`, and every reader of the word space takes it from there: the position index, the paths, the Gauge's procession, the fragments' cuts and the character walk, so the cutter, the addresses, the reads and every consumer see one order (see *the-word-space-follows-the-table-display-order*).

### I.2 The address

1. A cut's address is `{ path, word, px }`: the child-index path to the box the page resumes at, its indices counting a table's children in display order (I.1.8), a leaf-relative word inside a line stack and only there, and a pixel extent for a box divided geometrically. Paths order boxes; words order lines (see *the-cut-is-a-place-in-the-tree*).
2. Inside a word, a `char` in UTF-16 code units refines the address where a line begins inside that word. The flat projection does not carry it (see *a-line-inside-a-word-is-a-break-point*).
3. A word divided at a soft hyphen is addressed at the character after the hyphen. A word the browser hyphenated under `hyphens: auto` is divided where the Gauge measured the hyphen the browser drew, addressed at the character after the break, and the first fragment ends with the hyphenation character; a break between letters under `auto` that drew none is not divided (see *the-hyphen-is-written-at-the-cut*).
4. A cut names a place in the tree, and the boxes it divides are the proper ancestors of that place and nothing else. The cut's class says only whether the place exists (see *the-cut-divides-its-ancestors*).
5. A cut that falls before a box carries that box as a literal path, and the page resumes at the box. A trailing zero collapses wherever no gap stands between a parent's content edge and its first child; a start-edge Class C keeps it (see *the-cut-resumes-at-the-box*).
6. A run of lines beside block children is addressed by its container plus a word in the container's word space (see *the-anonymous-box-is-in-the-procession*).
7. Where the word space under-determines the tree, as at a word-empty block, the tree fact is carried as a literal and never derived by arithmetic (see *the-flat-position-space*).
8. An address is plain JSON, so it crosses any `page.evaluate` boundary. A clone is reached through the clone-to-source map and never by following an index on the clone (see *the-cut-is-a-place-in-the-tree*).

### I.3 The resume record

1. An entry's resume record is a tree: the main flow's node and, under every box the cut passes through that holds parallel flows, one node per flow, recursively. The flat list `paths` is its wire form (see *a-parallel-flow-is-a-fragmentainer*).
2. A page holds the words of its interval, plus the remainders its opening cut carries in, less the remainders its closing cut carries out (see *a-word-is-on-the-page-its-flow-puts-it*).
3. A page that ends in a shell takes no §5.3 extension (see *the-end-gap-takes-no-extension*).
4. The width key a page's composition is looked up by has one definition, `widthKeyOf` (see *the-presentation-composes-the-pages-it-has*).

### I.4 The Ledger

1. A paginated document is a document plus a ledger of cuts; a page is the interval between consecutive entries (tablet, *flow is forward*, I1).
2. Entries are append-only and their positions non-decreasing; only the root node of a resume tree is compared (tablet, I1, as amended by *a-parallel-flow-is-a-fragmentainer*).
3. An unclassed cut cannot be written: `createEntry` refuses it and `append` accepts only entries built there (tablet, *breaks are classified*, I3).
4. Invalidation is not a Ledger verb. A late fact is an edit, and the resumable run is its only machinery (see *late-truth-is-an-edit*).
5. A restarted run rewrites each entry it keeps whole, so no node of a flow outlives the cut that made it (see *a-parallel-flow-is-a-fragmentainer*).

### I.5 Resume arithmetic

1. An entry's key is its address under the run's conditions: every live flow's address, the cut's class, whether the page began at a forced break, whether it is a blank page, the end of the document, and the parity a forcing ahead still owes. The flat `pos`, the page number and the presentation literals are out of it (see *the-run-resumes-from-an-entry*).
2. Convergence is equality of keys under the page shift; the first equal entry stops the run and every later entry is kept (see *the-run-resumes-from-an-entry*).

## 5. Article II — Intake and capture

Modules: `src/measure.js`, `src/capture.js`, `src/box-shorthand.js`, `src/margin-boxes.js`, `src/counter-styles.js`, `src/gcpm-encoding.js`.

### II.1 Render conditions

1. Cicero refuses to adjudicate a document whose root line-height computes to `normal` (tablet, *render-identical conditions*, I5).
2. Unit device pixel ratio is asserted for print. On screen the DPR half is relaxed, and the console says so on every run (see *cicero-enters-the-seam-in-beta*).
3. Fonts are awaited once, before the first measure: a measurement the engine has no way to correct must not be taken early (see *images-are-awaited-at-intake*). The document's images are not awaited since 2026-11-08: the first run makes a `loading="lazy"` image eager and goes on, an image that declares its `width` and `height` is measured at its size before it arrives, and an arrival is late truth, answered by the rim (XI.3.6) (see *late-truth-is-an-edit*, amended 2026-11-08).
4. After every mount of the measure feed, an image not yet settled is awaited and the feed laid out again before the report (see *the-clones-images-are-awaited-where-they-are-measured*). This await stays until it is measured without it in a document a Service Worker controls, the case it was made for.
5. The measure context neutralises native break properties, orphans and widows, and every transform (`transform`, `rotate`, `scale`, `translate`, `perspective`). Legality is read from the sources (see *fragmentation-comes-first*).
6. Right-to-left and vertical writing are outside the beta's scope and refused by name at intake: a root or body that computes `direction: rtl`, a root that computes a `writing-mode` other than `horizontal-tb`, and any box below the root that does. Every read in the engine is left to right and horizontal.
7. The same scope has one interim fallback, which says so on the console (Article I, item 11): a multi-column box (`column-count` or `column-width` not `auto`) taller than a page area at the page's width is laid out as one column on its copies, since the engine does not divide columns, and a multi-column box that fits a page keeps its columns.

### II.2 The geometry table

1. The capture reads the CSSOM and nothing else: a page rule's declarations come from `rule.style`, never `rule.cssText` (see *a-page-rule-reads-its-own-declarations*).
2. The capture reads every sheet the document wears, document sheets first and adopted sheets after (see *the-capture-reads-adopted-sheets*).
3. A page length is resolved by seating the declared value on an engine-owned probe in the page context's conditions and reading the browser's pixels. The six absolute units keep a ratio fast path (see *page-lengths-are-measured*).
4. A length is seated on the property it was declared on, and a border takes room only where the same side's style draws it (see *a-page-box-has-a-border-and-a-padding*).
5. A margin shorthand the CSSOM leaves pending is expanded by grammar and not resolved; each value is the author's raw text, measured like a longhand (see *a-page-rule-reads-its-own-declarations*).
6. Page rules cascade by css-page-3 §4.4's (f, g, h) specificity; a forced break with a parity costs a blank page, and that blank page is an entry (see *a-parity-is-worth-a-page*).
7. Every refusal lands at intake, by name. A page whose page area is too small to hold content is refused there (see *a-page-too-small-to-be-a-page*).
8. Content width changes only at named-page boundaries (tablet, *geometry changes only at page boundaries*, C8).

### II.3 Margin boxes and counter styles

1. The sixteen margin boxes, their grid seats and css-page-3 §6.2's alignment table live in one module, `margin-boxes.js`, as data (see *where-in-the-band*).
2. A margin box is generated by its content alone, and an ungenerated box paints nothing (see *a-margin-box-exists-by-its-content*).
3. The three boxes of each horizontal band flex as css-page-3 §5.3 computes, the browser measuring their content (see *the-margin-boxes-flex*).
4. A counter's style is spelled from the predefined numeric and alphabetic styles. An unknown style falls back to decimal, with one console line per distinct style (see *a-counter-has-a-style*).

### II.4 The encoding contract

1. `gcpm-encoding.js` is the one place the rewritten forms are spelled. The rewriter writes them and the capture reads them, and every form has an `encode`/`decode` pair (see *the-host-rewrites-what-the-parser-drops*).
2. A sheet's reach is read every run: 0 where no selector reaches beyond a box's ancestors, 1 where one reaches a sibling, 2 where one reaches an ancestor or the sheet is unreadable (see *the-forced-break-index-is-kept-across-runs*). A rule whose declarations all set a paint-only property (`capture.js`' `PAINT_ONLY`) is passed over whatever its selector, and so is an `@container` or `@scope` rule every rule under which paints; where the reach puts the memo out of use or narrows it, the console says so once per memo life at each level, naming the first rule that set the level, its sheet, and how many more reached as far.

## 6. Article III — The Gauge

Module: `src/gauge.js`.

1. `takeReport` reads one settled layout and returns an immutable report; taking it seals the mutation phase. The report answers geometry only and decides nothing (tablet, *render-identical conditions*, I5).
2. Words are clustered onto lines by vertical overlap, and a line's box is the union of what stands on it (see *the-line-is-read-by-overlap*).
3. A block container's procession holds its block children and one anonymous box per run of inline content between them (see *the-anonymous-box-is-in-the-procession*).
4. An atom (a foreign-namespace element, a replaced element, an atomic inline) is one unit and is never entered (see *the-procession-stops-at-an-atom*).
5. `tracksOf` answers a table's column widths and a grid's column list, once per box per page, as a measurement and never a decision (see *the-fragment-lays-out-under-the-feeds-conditions*).
6. `reachOf` bounds how low a box's line readings can stand without measuring the lines (see *the-lines-that-cannot-win-are-not-measured*).
7. Every `Range` in `src/` is the one per-document range `rangeOf(doc)` (see *the-page-asks-the-index*).

## 7. Article IV — The Stonehand

Module: `src/stonehand.js`.

1. The Stonehand is the only hand that decides an entry. It collects every candidate in one pass, checks legality by one walk up the ancestor chain, ranks what fits by the make-up order, and takes the first (tablet, *legality is locally decidable*, C4).
2. The make-up order ranks by avoids broken, then by orphans-and-widows shortfall, then by content before the cut (tablet, C3).
3. Fit arithmetic reads candidate positions as border edges, so a margin adjoining a cut never counts against the closing page (css-break-3 §5.2; tablet, I3).
4. When nothing fits, the first boundary past the edge is taken; when no boundary exists, the whole feed is one page (tablet, *the build cannot fail*, C2).
5. A parallel flow offers the Class A boundary before it and nothing inside it to the outer walk; only its height crosses the wall (see *a-parallel-flow-contributes-geometry-and-nothing-else*).
6. A row item or a carried float is adjudicated by the same walk over its own procession, with the outer cut's height as its limit (see *a-parallel-flow-is-a-fragmentainer*).
7. A row is offered at the foot and at every line bottom of its items above it, priced by the sum of its items' shortfalls (see *a-cell-keeps-its-own-window*).
8. A box's end gap is a break point only where the box ends past the page edge (see *the-end-gap-breaks-only-at-the-edge*).
9. The collection runs in two phases: what needs no line measure first, and the line readings only as far as they can win (see *the-lines-that-cannot-win-are-not-measured*).
10. **Decided, not built.** A competing flow (a footnote area, a repeated header) is one fragmentainer that bargains the main flow's foot (see *a-competing-flow-bargains-the-foot-of-the-main-flow*). The footnote area is a row of the content area below the flow (see *the-footnote-area-is-a-row-of-the-page*).
11. A table cell a cut divides is judged with its content set from the cell's top, its `vertical-align` offset dropped, and its first piece reaches the page's foot, as Chromium's print aligns a divided cell within its first fragment (measured 2026-11-07, `test/browser/table-row-cut.browser.ts`; see *a-divided-cell-aligns-within-each-piece*).

## 8. Article V — The build loop

Modules: `src/driver.js`, `src/forcing-memo.js`.

### V.1 The loop

1. `paginate` is plumbing: cursor from the Ledger, the Cast-off's bound on the feed, measure, adjudicate, append, advance. It presents nothing (see *the-cast-off-bounds-the-feed*).
2. A walk that fails to advance the cursor is a defect, and the driver throws it (tablet, *the build cannot fail*, C2).
3. A bounded feed holds every box that can stand on the page and the first in-flow box that cannot, and it cuts only where block layout is forward (see *the-cast-off-bounds-the-feed*).
4. The feed is cloned from the cursor's block through the bound's block and no further, and a box outside the page's interval is cloned hollow (see *the-clone-is-hollow-outside-the-interval*).
5. The grab asks once per page for the first forcing event strictly after the cursor, at any depth, at word granularity (see *the-grab-descends*).
6. A box carries a pending `break-after` into an event only if its subtree closes exactly before that event (see *a-box-is-not-its-first-child*).
7. A forced break inside a row item ends that item's fragment, and the row's neighbours are divided at the row's height (see *a-parallel-flow-is-a-fragmentainer*).
8. A `position: fixed` box leaves the flow at zero footprint, at any depth (see *the-box-on-every-page*, *a-fixed-box-at-any-depth*).
9. A running element leaves the flow likewise, and its assignment is logged at the position the flow stood at (see *a-running-element-is-a-named-node*).
10. The account carries the conditions each page was decided under: `tracks` and `extents`, read from the report that decided the page (see *the-fragment-lays-out-under-the-feeds-conditions*).
11. The run keeps time through `performance.measure`, every name beginning `cicero:`, and through nothing else (see *the-run-keeps-time*).

### V.2 Pace and resumption

1. A `pace` callback runs after every page of the first layout; a pending promise holds the loop with its context, its Ledger and its cursor kept (see *the-pages-are-cut-as-far-as-they-are-asked*).
2. A resumed run restarts one page before the page that holds the edit and stops at the first converging entry (see *the-run-resumes-from-an-entry*).
3. The forcing index keeps its reads across runs, keyed by element, and rebuilds its structure every run (see *the-forced-break-index-is-kept-across-runs*).
4. What an edit makes stale is decided by the sheets' reach: at 0 the replaced boxes are read again, at 1 everything from the earliest change, at 2 everything (see *the-forced-break-index-is-kept-across-runs*).
5. A resumed run keeps every run-level read per top-level box (the position index, the running elements, the document ops, the reads' sites, the `:has()` answers) and reads again only what an edit replaced (see *a-resumed-run-keeps-its-reads*).

## 9. Article VI — Fragments, words and dressing

Modules: `src/fragments.js`, `src/data-beltype.js`, `src/dressing.js`, `src/has-words.js`, `src/presenters.js`.

### VI.1 Fragments

1. One implementation builds every piece, for the measure feed and the presentation alike, so what was measured is what is shown (see *the-cut-is-a-place-in-the-tree*).
2. Both ends of a fragment are cut by the address: a bare path, a path plus a word, or a path plus a pixel extent (see *the-cut-is-a-place-in-the-tree*).
3. A box wears its start decoration on a page whose opening cut does not divide it, and its end decoration where the closing cut does not (see *the-cut-divides-its-ancestors*).
4. `box-decoration-break` is read from the source; under `slice` a continuation keeps no block-start border, padding or corner rounding, a piece the cut closes keeps none of the three at its block end, and a margin is always truncated (see *the-fragment-that-wraps-itself*; the rounding measured against Chromium's print 2026-11-07).
5. After a forced break, the box the page resumes at keeps its block-start margin; the divided ancestors do not (see *the-margin-after-a-forced-break-is-preserved*).
6. Outside its interval a box is kept and not displayed, so structural selectors match on every page as in the source (see *every-branch-gets-a-place*).
7. A fragment is written its page's tracks as literals, never across pages (see *the-fragment-lays-out-under-the-feeds-conditions*).
8. The first fragment ends with the hyphenation character the source asks for, written where the cut falls (see *the-hyphen-is-written-at-the-cut*).
9. A divided table repeats its header group on every continuation and its footer group on every fragment but the last, unless the group is taller than a quarter of the page area (see *the-header-repeats*). A group that does not repeat is shown once, where its words fall in display order (I.1.8): a header on the table's first fragment and a footer on its last, wherever each is written, as Chromium prints them. A footer group written before its rows and taller than the page area is refused by name, as a box taller than its page is (see *the-word-space-follows-the-table-display-order*; measured against Chromium's print 2026-11-07, `test/browser/table-groups.browser.ts`).
10. A repeated header joins the continuation's rows as the whole table does (see *a-repeated-header-joins-the-rows-as-chromium-prints-them*).
11. A piece is laid out by the browser as a box of its own, so `text-wrap` shapes each piece's lines alone: under `balance` a continuation balances its own lines, where Chromium's print does not balance a divided paragraph (measured 2026-11-07: a continuation of fourteen words printed eight and six, and shows seven and seven). The words on each page agree; under `pretty` the lines agreed as well. (see *a-divided-cell-aligns-within-each-piece*)
12. An `<ol>` a cut divides is numbered from the first item its piece keeps: the piece's copy carries a `start` of that item's ordinal, as HTML numbers it with `start`, `value`, `reversed` and a `counter-set` or `counter-increment` of `list-item`, so the browser's own marker counts on (measured against Chromium's print 2026-11-07).

### VI.2 The `data-beltype` registry

1. BelType marks an element through one attribute, `data-beltype`, a space-separated list of words; a value is `key:value` and no key ends with another key (see *one-attribute-has-words*).
2. Every writer reads, modifies and writes; words are written on copies only (see *one-attribute-has-words*).
3. Every mark the engine writes is a word in the registry's table, and the table declares each word once (see *the-piece-words*).
4. `artifact` means PDF's artifact and nothing else, and every artifact is `aria-hidden` (see *an-artifact-is-never-read*).
5. `host` is the one word a host writes on an element of its own: its machinery standing among the document's boxes, which the intake passes over, as it passes over engine scaffolding and the tags that never render (`TEMPLATE`, `LINK`, `META`, `BASE`, `TITLE`, `HEAD`, `NOSCRIPT`, beside `STYLE` and `SCRIPT`). A host that holds the document in an element of its own names it with the `root` option first (ruled 2026-11-08).

### VI.3 Dressing

1. The words sheet holds every rule that trims or hides a copy, `!important`, in the first cascade layer the document names (see *the-piece-words*).
2. The engine asks the document every run whether it wears the engine's sheets, adopts them again where it does not, and offers no reset (see *the-engine-asks-the-document-for-its-sheets*).
3. The continuation dressing withholds a divided box's generated content and first letter and line from the pieces that did not begin it; any host that presents pieces adopts it (project, *the-engine-knows-no-view*).

### VI.4 `:has()` and presenters

1. `:has()` is answered from the originals in their real place, written on copies as `has:` words, and kept per top-level box across runs (see *one-attribute-has-words*, *a-resumed-run-keeps-its-reads*).
2. A host registers a presenter, `present(selector, make)`, and every copy of a matching element, measuring copies and hollow shells included, is the presenter's element (see *a-copy-may-be-presented*).

## 10. Article VII — The Compositor

Modules: `src/compositor.js`, `src/compose-dom.js`, `src/composition-key.js`, `src/hyphenate.js`, `src/hyphen-patterns/`.

1. The composed mode is reached by one argument, `run({ composed: true })`; the default leaves the lines to the browser (see *the-composed-mode-reaches-the-operator*).
2. The Compositor is total-fit line breaking over a paragraph's candidates. It is DOM-free, takes widths from an injected provider, and breaks ties toward earlier breaks, so the result is a total order (tablet, The Line).
3. Each node reads only its feasible window, and the composition lays its clones out once (see *the-composition-lays-out-once*).
4. A ragged line's badness is priced once, against a tolerance of 2em (see *the-rag-is-priced-once*).
5. The Compositor's prices are tablet constants; a page count is never made to come out by tuning them (see *the-eleventh-line*).
6. A paragraph is composed only where the browser would otherwise choose its lines (see *the-paragraph-is-what-the-browser-breaks*).
7. A paragraph whose lines carry generated text keeps the browser's lines (see *the-composition-refuses-generated-text*). So does a block laid out beside a float (see *a-parallel-flow-contributes-geometry-and-nothing-else*).
8. A source in no flat tree is refused by name (see *the-composition-refuses-an-unrendered-source*).
9. The hyphenation character, the indent and the alignment are read from the source's style, and the chosen lines land as forced hints (see *the-properties-the-line-already-had*).
10. Hyphenation is Liang's, decision-side, with its exception list; a chosen candidate becomes a literal character and a break, never a soft hyphen (tablet, The Line). No more than three lines in a row end on a hyphen, where any composition fits without an overfull line (Codeberg issue 5; `hyphenate-limit-lines` is not read, since Chromium does not support it).
11. The composition cache is keyed by the paragraph's path, its markup, its width and its style inputs, never by the element object (see *the-run-resumes-from-an-entry*).
12. A change of the run's conditions clears the cache whole, and the conditions are the document's own sheets (see *the-conditions-are-the-sheets-of-the-document*).
13. The presentation composes the pages the account has, not the page names the stylesheet has (see *the-presentation-composes-the-pages-it-has*).

## 11. Article VIII — Document state and the reads

Modules: `src/document-state.js`, `src/reads.js`.

### VIII.1 The state at a position

1. One log, walked once in document order, answers what the author's machinery stood at, at a position (see *a-counter-is-read-at-the-start-of-the-page*).
2. Counters are its first operation, `string-set` its second, and `position: running()` its third (see *a-counter-is-read-at-the-start-of-the-page*, *the-host-rewrites-what-the-parser-drops*, *a-running-element-is-a-named-node*).
3. An operation applies when its position is strictly before the one asked about, and not inside a remainder still to show; the root's ancestors sit at −1 (see *a-counter-is-read-at-the-start-of-the-page*, *a-word-is-on-the-page-its-flow-puts-it*).
4. A named string's value is evaluated at its element, with the element's own counter operations already in force (see *the-host-rewrites-what-the-parser-drops*).
5. `element()` is answered by the same keyword arithmetic as `string()`, with `null` as the empty value; a second implementation is refused (see *a-running-element-is-a-named-node*).
6. The readers `styleOf`, `textOf` and `attrOf` are the door, so a host that holds its document elsewhere computes the same state (project, *the-engine-knows-no-view*).
7. A `counter-reset` opens a scope over its element, the element's descendants and its following siblings, as CSS 2.1 §12.4.1 and css-lists-3 say; Chromium's print does not reach the following siblings that way (measured F4 for the specification's F2; claimed by no case), and the replay keeps the specification, so a sibling-scoped counter that straddles a page break may read differently in the body and in a margin box (see *a-sibling-counter-scope-stays-by-the-book*).

### VIII.2 The reads

1. A pointer is a read: a site, an address, a fact, a moment, a footprint and a direction (see *a-pointer-is-a-read*).
2. Values reach their sites through one adopted sheet of custom properties, never by writing an author's element (see *a-pointer-is-a-read*).
3. A written or cascade fact is delivered before the run. A layout fact is reserved as `"0"`, delivered after the run, and the run resumes from the first page that holds a moved box (see *delivery-resumes-from-the-moved-page*).
4. A resumed run starts its references from the numbers the run before it left (see *a-resumed-run-starts-from-the-numbers-it-left*).
5. At most three runs settle the reads; on exhaustion the last true values stand and the console names what still moved (see *a-pointer-is-a-read*).
6. A missing target shows nothing, and the console names it once per paginate (see *a-pointer-is-a-read*).
7. `settleReads` takes its `run` and `blocksOf` as parameters, so a view that holds its own pages settles through the same loop (project, *the-engine-knows-no-view*).

## 12. Article IX — The view

Modules: `src/chase.js`, `src/root.js`, `src/source-point.js`.

### IX.1 `<beltype-page>`

1. The page frame holds and never decides. Its shadow is one 5×5 grid: margins as outer tracks, the sixteen boxes in the ring, the content area in the middle (see *where-in-the-band*).
2. There are three clips. The host clips at the page box, which is the bleed area. The flow clips the foot at the cut's extent. The furniture layer clips at the page area (see *the-page-rendering-clips-at-the-bleed-area*, *the-page-clips-at-its-bleed-area-on-the-block-axis-too*).
3. A page is contained (`contain: layout size paint`, `content-visibility: auto`), so it delivers the counters it starts with itself (see *the-run-resumes-from-an-entry*, *the-page-carries-its-conditions*).
4. The page carries its conditions on its host: a number is a counter the host resets, and a text is a custom property `--beltype-string-<name>-<which>` (see *the-page-carries-its-conditions*).
5. A margin box's `content` is transliterated into the page's shadow sheet, never resolved (see *the-page-carries-its-conditions*).
6. The page context dresses the host, minus what Cicero owns (see *the-page-context-dresses-the-host*).
7. A page takes its content through the root's slot chain or directly through `setContent` (project, *the-engine-knows-no-view*).

### IX.2 `<beltype-root>`

1. The document lives once, as the root's light DOM, and the pages are its shadow (tablet, *content is one document*, I6).
2. Every light child is assigned to a parking slot first, and page slots take what they place (see *an-unplaced-original-is-parked-not-unassigned*).
3. A block the closing cut divides is shown on that page through a constructed first fragment, the reading copy, not `aria-hidden` (see *the-first-fragment-is-constructed*).
4. Every page is a sheet of its size at once; a page's content is built when the reader nears it, when a door asks, or in idle slices (see *only-the-pages-near-the-reader-are-built*).
5. A margin box's running element is the page's answer, slotted as a clone (see *a-running-element-is-a-named-node*).
6. The root clears every captured margin box's `content` from the CSSOM once the capture has read it (see *the-second-channel-a-named-page-cannot-close*).
7. The root answers a page for a source place and exposes no index (see *the-engine-answers-the-page*).
8. The root answers the source for a copy and exposes no map; every clone is registered when it is made (see *the-engine-names-the-source*).
9. The source point is answered both ways, exactly, from what the engine recorded; `null` names a point in nothing the author wrote (see *the-engine-names-the-source-point*).

## 13. Article X — The rewrite

Modules: `seam/rewrite.js`, `seam/rewrite-document.js`, `seam/csstree.js`.

1. The host rewrites what Chromium's parser drops into forms it keeps, and the capture reads the CSSOM. The four refused constructs are `string-set`, `position: running()`, `string()`/`element()` in a margin at-rule, and an `@page` selector with `:blank` or a list (see *the-host-rewrites-what-the-parser-drops*).
2. `rewriteSheet` is the one implementation, and every host calls it (see *the-host-rewrites-what-the-parser-drops*).
3. Every edit is a splice into the author's text on the line it was written on; only a selector-list split adds lines (see *the-host-rewrites-what-the-parser-drops*).
4. `target-counter()`, `target-counters()` and `target-text()` become `var(--beltype-read-…, "")` in place (see *a-pointer-is-a-read*).
5. A group rule for `print` or `all` is opened, one for `screen` is removed, and one with a feature is left to the browser (see *the-measure-runs-under-print-media*).
6. Every `:has(A)` becomes a union that a word satisfies on a copy, with the native specificity exactly (see *one-attribute-has-words*).
7. `string()` in an element's `content` becomes `var(--beltype-string-<name>-<which>, "")` (see *the-page-carries-its-conditions*).
8. With `{ pages: false }` a page read is left whole, and the media pass and the `:has()` union do not run. No record owns this option; the source cites *the site reads*, ruling R2a, which has no file.
9. With `{ layer }` the rewritten text is wrapped in that cascade layer and the engine's provision moves into its own first layer. No record owns this option; the source cites *the author's sheets in a layer the host names*, which has no file.
10. `rewriteDocumentSheets` replaces a changed sheet in place by a `<style>` at the same position, skips a cross-origin sheet and names it on the console (see *the-host-rewrites-what-the-parser-drops*).
11. css-tree is reached through narrow subpaths only, because its main entry cannot load in a browser (see *the-host-rewrites-what-the-parser-drops*).

## 14. Article XI — The seam and the rim

Modules: `seam/index.js`, `seam/client.js`, `seam/rim.js`, `seam/facsimile.js`, `seam/cicero-interface.css`.

### XI.1 Beta

1. Cicero is opt-in, on screen only, and visible about its render conditions (see *cicero-enters-the-seam-in-beta*).
2. `renderPdf` refuses and names `--engine pagedjs` (see *cicero-enters-the-seam-in-beta*).
3. The line-height provision is a literal `<style>` in the head fragment, and the screen chrome is a linked sheet (see *the-interface-sheet-splits*).

### XI.2 The client

1. Loading `client.js` sets `window.__beltypeCicero` and does nothing else; rendering waits to be asked (see *cicero-enters-the-seam-in-beta*).
2. A run adopts the document into `<beltype-root>`, paginates as far as it is asked and presents what it cut (see *the-pages-are-cut-as-far-as-they-are-asked*).
3. `run()` may be called again on the frame it presented; the intake is kept, and the Ledger is byte-equal to the first call's within one realm and viewport (see *the-run-resumes-from-an-entry*).
4. `patch` refuses a replacement for a fixed box or a running element only where the replacement is or holds one. The intake adopts only the top-level boxes: a fixed box or a running element written inside a block stays there, so a block that holds one is patched like any other (see *a-fixed-box-refuses-only-its-own-block*, *a-fixed-box-at-any-depth*; Egildo's ruling of 2026-11-08, the record's amendment owed).
5. A running element's edit is a chrome event. `patch` at a top-level running element, or at a box inside one, puts the replacement in the running element's place in the run's list, draws again the margin boxes of every standing page that shows it, cuts nothing, and answers `{ chrome: true }`, which a host tells from an address by its `chrome` member. It refuses where the top-level box no longer names the same running element, and while a sheet holds a `:has()` or a container query. A running element nested in a block is refused by item 4, since the replacement is one (see *the-run-resumes-from-an-entry*, amended 2026-11-08).

### XI.3 The rim

1. A late fact about a box is an edit at that box; a late fact about the conditions, a font, is a whole run (see *late-truth-is-an-edit*).
2. Every signal is one cancelable `beltype:change` on the document, `detail: { kind, boxes }`, `kind` one of `image`, `element`, `font`, `size`, `store` (see *late-truth-is-an-edit*).
3. A top-level box announces its own size; a reading more than a quarter pixel from the measured height is an edit at the box (see *a-box-announces-its-own-size*).
4. Every piece a built page draws a block through is observed, its first reading is its expected height, and a later change is an edit at the page that shows it (see *a-fragment-announces-its-own-size*).
5. A sheet inside an `<svg>` or inside a copy is not a condition of the document (see *the-conditions-are-the-sheets-of-the-document*).
6. A picture's `load` or `error` in a top-level box is judged when the runs have ended, and is an `image` signal only where its arrival changed the box: a box drawn as itself whose height stands within a quarter pixel of the measured height (half a pixel more where the box's own `offsetHeight` is read, the observer having read it as nothing) is no signal; a box not drawn as itself while some page is not built is judged again later; any box the rim cannot compare is a signal (see *late-truth-is-an-edit*, amended 2026-11-08).

### XI.4 The facsimile

1. A copy of `object[type="application/pdf"]` is a customized `<object is="beltype-facsimile">` drawn by pdf.js onto one canvas, with no text layer (see *a-copy-may-be-presented*).
2. Each embedded page's size is read at intake, before the first cut, and the drawing comes when the copy is connected and seen (see *images-are-awaited-at-intake*, *a-copy-may-be-presented*).
3. The module and pdf.js load only when the document holds a PDF `<object>` (see *a-copy-may-be-presented*).

## 15. Article XII — The host API

**The host reaches Cicero through one handle, `window.__beltypeCicero`, set when `seam/client.js` loads** (see *cicero-enters-the-seam-in-beta*). The handle's members are verbs, never indexes or maps: a live DOM reference stays in the realm that checked it (see *the-engine-answers-the-page*).

Of the members below, `run`, `settled` and `table` exist from load, and `last` and `ledger` are set by the first call. The doors are seated by the first presentation; before it they are absent, never stubs, because a stub that answered `null` would be indistinguishable from a refusal that means something (see *the-engine-answers-the-page*).

| Member | Signature | Answers |
|---|---|---|
| `run` | `(opts?: { composed?, resumeAt?, until?, layer? }) → Promise<Result>` | Paginates and presents, as far as asked. |
| `last` | `Result` | The answer of the last call. |
| `ledger` | `Entry[]` | The account the last call cut. |
| `pageOf` | `(el, charOffset = 0) → number \| null \| 'not-yet'` | The page bearing a source place. |
| `addressOf` | `(el, word = 0) → Address \| null` | A source place, spelled as `resumeAt` takes it. |
| `settled` | `() → Promise<void>` | Resolves when nothing is under way. |
| `built` | `() → { pages, built }` | How many pages exist and how many have content. |
| `buildPage` | `(k) → boolean` | Builds page `k` now. |
| `buildAll` | `() → Promise<number>` | Builds every page. |
| `sourceOf` | `(el) → Element \| null` | The original a copy copies. |
| `table` | `GeometryTable \| null` | The geometry the intake captured. |
| `release` | `() → Promise<void>` | Lets go of everything the client registered. |

### XII.1 `run`

1. `run(opts)` paginates and presents the current document, and the pages stay live in the DOM (see *the-pages-are-cut-as-far-as-they-are-asked*).
2. `until` is a page count or a source element, the page that holds its first word. The call stops there with its place kept, and a later call with a further `until`, or none, goes on (see *the-pages-are-cut-as-far-as-they-are-asked*).
3. Until the call that completes the document, `counter(pages)` is blank and a page number not yet reached is reserved at its width (see *the-pages-are-cut-as-far-as-they-are-asked*).
4. `composed` chooses the composed mode; default `false` (see *the-composed-mode-reaches-the-operator*).
5. `resumeAt` is the address of the box edited since the last call, as `addressOf` spells it. The call reuses the prior Ledger and recuts only the pages that differ (see *the-run-resumes-from-an-entry*). `resumeAt: { chrome: true }`, `patch`'s answer for a running element (XI.2.5), is answered at once in the last call's mode: nothing is cut, a run stopped at a page keeps its place, and `resumed` is `{ from: 1, to: 0, shift: 0, converged: true, kept: pages }` (see *the-run-resumes-from-an-entry*, amended 2026-11-08).
6. A resume falls back to a whole run, silently and correctly, when the last call ran in the other mode, under other conditions, or over a different number of top-level blocks (see *the-run-resumes-from-an-entry*).
7. `layer` names the cascade layer for the document's own sheets, and a name that is not a layer name throws a `TypeError`. No record owns it (see Article X.9).
8. The result is `{ pages, ms, composed, complete, resumed, why, composition }`. `resumed` is `{ from, to, shift, converged, kept }` or `null`, and `why` is a sentence exactly when `resumed` is `null`. `composition` is `{ blocks, hits, misses, laid }` in the composed mode and `null` otherwise (see *the-run-resumes-from-an-entry*).
9. Every call of `run`, the rim's included, goes through this handle, so a host that replaces its `run` property sees every run; the handle object is the module's own, and replacing the whole object on `window` is not wrapping it (see *late-truth-is-an-edit*).

### XII.2 `last` and `ledger`

1. `last` is the result of the most recent call, set when the run stops at a page (with `complete: false`) and again when it completes (see *the-pages-are-cut-as-far-as-they-are-asked*).
2. `ledger` is that call's account: one entry per page, each carrying `pos`, `cut`, `paths`, `carried`, `blank`, `trace` and `closes` (`pageNumber`, `contentW`, `contentH`, `strings`, `running`). It is plain data, and the wire form of the resume tree (see *a-parallel-flow-is-a-fragmentainer*).

### XII.3 The source doors

1. `pageOf(el, charOffset)` answers the zero-based page bearing that character of a source element. `charOffset` counts into the element's own joined text (see *the-engine-answers-the-page*).
2. `pageOf` answers `null` where the position space cannot discriminate: nothing presented, an element the index does not hold, an offset past the text, a character inside a monolith cut geometrically, or a word-empty block spanning pages (see *the-engine-answers-the-page*).
3. `pageOf` answers `'not-yet'` for a place beyond the last page of a document still being cut, or in a remainder the last cut carries (see *the-pages-are-cut-as-far-as-they-are-asked*, *a-word-is-on-the-page-its-flow-puts-it*).
4. `addressOf(el, word)` answers `{ path, word }` for an element inside a top-level block, climbing from an inline box to the nearest box the Ledger cuts at, and `null` outside the blocks (see *the-run-resumes-from-an-entry*).
5. `sourceOf(el)` answers the adopted original a presented element copies. An original, an engine mark and an element outside the root answer `null`; a text node has no answer (see *the-engine-names-the-source*).

### XII.4 The windowing doors

1. `built()` answers `{ pages, built }` (see *only-the-pages-near-the-reader-are-built*).
2. `buildPage(k)` builds page `k`'s content now and answers whether the page exists (see *only-the-pages-near-the-reader-are-built*).
3. `buildAll()` builds every page and resolves with how many it built; a host that reads every page awaits it first (see *only-the-pages-near-the-reader-are-built*).
4. A page once built stays built, and building reads or moves no cut (see *only-the-pages-near-the-reader-are-built*).

### XII.5 `settled` and `table`

1. `settled()` resolves when no run is under way and the rim has nothing pending; a run stopped at a page is at rest (see *late-truth-is-an-edit*).
2. `table` is the geometry the intake captured from the author's `@page` rules, margin boxes and their `content` included, and `null` before an intake. A second host in the same document takes it in place of its own reading, since the root clears the margin boxes' `content` (see *the-second-channel-a-named-page-cannot-close*).

### XII.6 Members outside this article

The handle carries further members that this article does not make API. They are listed for the author's ruling (§19):

- **Host doors in use by BelType's editing tools:** `present(selector, make)` (see *a-copy-may-be-presented*), `reveal(el, options)` (see *only-the-pages-near-the-reader-are-built*), `sourcePoint(node, offset)` and `pointOn(node, offset, page)` (see *the-engine-names-the-source-point*), `box(i)` and `patch(i, path, el)` (see *the-run-resumes-from-an-entry*).
- **Harness doors**, which a venue test uses to ask what a run costs when it borrows nothing: `compositionCache`, `forcingMemo`, `forgetJudgedSheets`, `measured(el)` (see *the-forced-break-index-is-kept-across-runs*, *a-box-announces-its-own-size*). They are not product surface.

### XII.7 `release`

1. `release()` lets the client go, for a host that replaces the document in the same window (`document.open()` keeps the window, its font set and their listeners). After it, nothing the client registered runs: the font-set listener is removed, the rim is stopped, the late-truth batch is dropped, the root's idle build, observer and window listeners are released, the facsimile's observer is disconnected, and the handle is deleted from the window (Egildo's ruling of 2026-11-03, the kept page of beltype serve).
2. A run stopped at a page is let go and its pages stay on screen. A run with a pace stops at its next page and rejects with the let-go error, and a first run that has shown no page puts the document back as it found it. A run without a pace finishes and presents. The promise resolves when nothing is under way, and the root's idle build, observer and window listeners and the facsimile's observer are let go then. A later `run()` rejects by name, and a second `release()` is a no-op (same ruling).
3. The custom-element classes are the window's and are not released, so `release()` sets no state they read. The next document's client loads only under a module URL the window has not imported, and the host keys it (same ruling).

## 16. Article XIII — The package faces

**The package publishes nine faces, and nothing outside them is reachable by a stable name.**

| Face | Module |
|---|---|
| `.` | `seam/host.js`, the host's entry |
| `./engine` | `seam/index.js`, the adapter (`ciceroEngine`) |
| `./flags` | `seam/flags.js` |
| `./rewrite` | `seam/rewrite-document.js` (`rewriteDocumentSheets`) |
| `./facsimile` | `seam/facsimile.js` |
| `./client` | `seam/client.js`, the browser entry |
| `./rim` | `seam/rim.js` |
| `./fragmentation` | `src/fragmentation.js` |
| `./page` | `src/chase.js`, the `<beltype-page>` element |

`./internal/*` is the tenth path and is no face (XIII.5), and `./package.json` is the manifest. `test/faces.test.ts` holds this table against `package.json`'s `exports`.

### XIII.1 `.`

1. `ciceroEngine` is the host's adapter, four members (see *cicero-enters-the-seam-in-beta*):
   - `headHtml(base)`: the provision `<style>` (the words sheet, the line-height provision, the PDF `<object>` rules), the linked chrome sheet, and the client module (see *the-interface-sheet-splits*, *the-piece-words*).
   - `bootstrapJs()`: the statements that call `run`, cutting the first screen and one page more before the rest (see *the-pages-are-cut-as-far-as-they-are-asked*). A failure degrades to the unpaginated document and says why on the console.
   - `vendorAssets()`: the asset table, the chrome sheet and the two source directories at their own depths, with css-tree's and pdf.js's browser builds. It is lazy and must not be called by a host without a filesystem (see *the-interface-sheet-splits*).
   - `renderPdf()`: rejects (see *cicero-enters-the-seam-in-beta*).
2. `rewriteDocumentSheets(doc, judged?, { layer?, pages? })` rewrites a live document's own sheets in place (see *the-host-rewrites-what-the-parser-drops*).

### XIII.2 `./facsimile`

1. The facsimile face exports `SOURCE` (`'object[type="application/pdf"]'`), `TAG` (`'beltype-facsimile'`), `locate(source)`, `make(source, missingAlt?)` and `install(doc, present, { missingAlt? })`, where `missingAlt` is `'refuse'` by default or `'warn'` for an editor that shows a PDF embed with no fallback alt and leaves the print to refuse it (see *a-copy-may-be-presented*).
2. `install` reads every embedded page's size and registers the presenter through the `present` it is handed; `make` is synchronous and starts no work (see *a-copy-may-be-presented*).

### XIII.3 `./fragmentation`

**The names a view adapter imports to fragment a document without `<beltype-root>`** (project, *the-engine-knows-no-view*). The list is what the ProseMirror adapter imports today; a name joins it only when a consumer imports it.

| Source module | Names |
|---|---|
| `data-beltype` | `ADJOIN`, `ARTIFACT`, `AWAY`, `END`, `FRAGMENT`, `SHELL`, `SPLIT`, `START`, `WRAPPED`, `addWord`, `hasWord`, `removeWord` |
| `word-space` | `BREAKING_SPACE`, `clonesDecoration`, `copyOf`, `isFixedBox`, `isInlineBox`, `isLineBreak`, `noteSource` |
| `positions` | `divides`, `elAt`, `extensionPx`, `indexBlocks`, `normalizePath`, `pageContaining`, `pageIntervals`, `pathOf`, `placeAt` |
| `fragments` | `joinedWords`, `mutateToContinuation`, `mutateToFirstFragment`, `pinTrack`, `truncateLeadingDecoration` |
| `stonehand` | `adjudicate`, `firstBelowTheEdge`, `fitsPage`, `isOutOfFlow`, `neverCutInside`, `processionBottoms`, `reachesBelowTheEdge` |
| `gauge` | `takeReport` |
| `measure` | `assertRenderConditions`, `awaitCloneImages`, `awaitFonts`, `createMeasureContext` |
| `driver` | `forcingIndexOf`, `gapAbove`, `pageNameDownFrom`, `runningBoxes`, `runningPosition`, `topLevelBlocks` |
| `forcing-memo` | `ForcingMemo`, and the type `Keep` |
| `capture` | `effectivePageName`, `readGeometryTable`, `registerGcpmProperties`, `sheetReach`, `topLevelReach`, `transliterateContent` |
| `gcpm-encoding` | `STRING_KEYWORDS`, `encodeStringProp` |
| `document-state` | `counterStateAt`, `documentOpsOf`, `namedStringsForPage`, `runningAssignmentsOf`, `stringAssignmentsOf` |
| `reads` | `cssString`, `findPageSites`, `findSites`, `settleReads` |
| `dressing` | `ensureContinuationDressing`, `ensureDressing` |
| `presenters` | `present`, `presentation` |

Each name keeps the contract its module's article states. A change to one is a change to this face, and is versioned as one.

The leading-decoration door is the continuation dressing of Article VI.1.4 as a view applies it to a box its slice resumes inside: `clonesDecoration(el)` answers whether the box's source (`noteSource`'s, or the element itself) declares `box-decoration-break: clone`, and `truncateLeadingDecoration(el)` marks the box divided at its start and, when it clones, `WRAPPED`, so the words sheet keeps its block-start border, padding and rounding (see *the-fragment-that-wraps-itself*).

### XIII.4 `./rim`

1. The rim face is `seam/rim.js` itself, the module the client imports, so a host that hears late truth on pages it holds shares the engine's set of announced faces: `watchLateTruth`, `bringsNewFace`, `knowLoadedFaces`, `isKnownFace`, `frame` and `TOLERANCE`, with the contracts of Article XI.3 (see *late-truth-is-an-edit*, *a-box-announces-its-own-size*, *a-fragment-announces-its-own-size*).
2. It needs a DOM only when `watchLateTruth` or `frame` is called; the module loads in node.

### XIII.5 `./internal/*`

1. Every module under `src/` is reachable as `./internal/<path>`; `seam/` is not. It is unstable: no name there is promised from one version to the next, and a consumer that imports one has accepted that.
2. A name a consumer needs from `./internal/*` is a request to widen `./fragmentation` by amendment, never a reason to rely on the internal path.

---

## 17. Amending this document

1. This document is amended by named article, in the commit that changes the behaviour, with an entry below naming the article and the record that owns the change.
2. A behaviour no article states is not implemented until an article states it; implementing first and documenting later is drift, and drift is a defect.
3. A decision record is never rewritten. A reversal is a new record that names the one it supersedes, and the article cites the new one.

| Date | Article | Change | Owning record |
|---|---|---|---|
| 2026-10-29 | all | Ratified at the move into its own repository. | — |
| 2026-11-07 | IV.11 | A divided table cell is judged and presented aligned within its first piece. | — (measured; assessment 2026-11-07) |
| 2026-11-07 | VI.1.4 | A slice's cut edges lose their corner rounding. | *the-fragment-that-wraps-itself* |
| 2026-11-07 | VI.1.11 | `text-wrap` shapes each piece alone, stated. | — (measured; assessment 2026-11-07) |
| 2026-11-07 | XIII.3 | The leading-decoration door joins the face: `WRAPPED`, `clonesDecoration`, `truncateLeadingDecoration`. | *the-fragment-that-wraps-itself* |
| 2026-11-08 | XIII, XIII.3 | The article names the nine faces `package.json` exports and `test/faces.test.ts` holds them; `firstBelowTheEdge` joins the `stonehand` row. | — (assessment 2026-11-07, `spec-faces-drift`) |
| 2026-11-07 | XIII.4, XIII.5 | The rim joins the faces as `./rim`; `./internal/*` is stated as `src/` only, which it always was. | *late-truth-is-an-edit* |
| 2026-11-07 | I.1.8, I.2.1, VI.1.9 | The word space follows CSS 2.1 §17.2's display order inside a table, and a path counts a table's children in it; a group that does not repeat is shown where its words fall. | *the-word-space-follows-the-table-display-order* |
| 2026-11-07 | IV.11, VI.1.11 | Both items now cite their record, *a-divided-cell-aligns-within-each-piece*, written from the ruling of 2026-11-07. | *a-divided-cell-aligns-within-each-piece* |
| 2026-11-08 | XI.2.5, XII.1.5 | A running element's edit is a chrome event: `patch` redraws the margin boxes that show it and answers `{ chrome: true }`, and `run` answers that at once. | *the-run-resumes-from-an-entry*, amended 2026-11-08 |
| 2026-11-07 | VIII.1.7 | The sibling counter scope stays by the book: the replay follows CSS 2.1 §12.4.1 where Chromium's print does not, stated with the measured divergence. | *a-sibling-counter-scope-stays-by-the-book* |
| 2026-11-08 | II.4.2 | The sheets' reach passes over a rule that only paints, and the memo's console notice names the rule and its sheet at both levels. | *the-forced-break-index-is-kept-across-runs* (ruled 2026-11-08) |
| 2026-11-08 | VI.2.5 | The `host` word joins the registry, and the intake passes over it and over the tags that never render, through one filter. | — (ruled 2026-11-08; no record yet) |
| 2026-11-08 | II.1.3, II.1.4, XI.3.6 | The first run no longer awaits the document's images, and lazy ones are made eager; the clone await stays until the Service Worker case is measured; a picture's arrival is a signal only where it changed its box. | *late-truth-is-an-edit*, amended 2026-11-08 |
| 2026-11-08 | XI.2.4 | The intake no longer lifts a fixed box or a running element out of the block it was written in, and `patch` no longer refuses an edit inside that block. | *a-fixed-box-refuses-only-its-own-block* (amendment owed) |

## 18. Known open at ratification

Open work lives on the capability checklist and in `NEEDED-FIXES.md`, and those files win where this list disagrees. The open items at the move: the repeated header's five divergences; a resume started by the size ear in a layered frame; the intake taking a host's own machinery for document content; an edit to a running element costing a whole run; the unit of a kept part. The Press and the competing flows (Article IV.10) are designed and unbuilt.

## 19. Records no source file cites

**For the author's ruling.** The records below are cited by no file under `src/` or `seam/`, checked on 2026-10-29 by searching every source file for each record's slug and for its title written as a citation (in italics or as link text). Nineteen records fail that test.

Four of the nineteen are named in the source in plain prose, so a looser test passes them:

- *the-fragment-lays-out-under-the-feeds-conditions*: cited throughout as *the fragment lays out under the feed's conditions*, apostrophe moved; the title and the citations disagree on spelling.
- *the-interface-sheet-splits*: named without italics in `seam/index.js`.
- *the-second-channel-a-named-page-cannot-close*: its words appear in `src/root.js` and `src/capture.js`, unitalicised.
- *the-flat-position-space*: the phrase appears once in `src/driver.js`, as a description rather than a citation.

Fifteen are named nowhere in the source:

| Record | Status | Kind | Cited by this document |
|---|---|---|---|
| *a-competing-flow-bargains-the-foot-of-the-main-flow* | Decided, not executed | Design | Article IV.10 |
| *a-composed-reference-follows-the-hints* | Executed | Venue (the differential's reference cache) | No |
| *a-parallel-flow-contributes-geometry-and-nothing-else* | Executed | Engine | Articles IV.5, VII.7 |
| *a-resumed-run-starts-from-the-numbers-it-left* | Executed | Engine | Article VIII.2.4 |
| *forcing-under-sections-earns-a-case* | Executed | Process (a fault earns a case first) | No |
| *questions-and-solvers* | Decided | Principle | §2.1 |
| *the-clip-is-a-block-axis-fact* | Superseded by *the-page-rendering-clips-at-the-bleed-area* | Withdrawn | No |
| *the-clones-images-are-awaited-where-they-are-measured* | Executed | Engine | Article II.1.4 |
| *the-eleventh-line* | Executed | Engine (measure before changing a price) | Article VII.5 |
| *the-footnote-area-is-a-row-of-the-page* | Decided, not executed | Design | Article IV.10 |
| *the-line-inside-a-word-earns-a-case* | Executed | Process | No |
| *the-lines-that-cannot-win-are-not-measured* | Executed | Engine | Articles III.6, IV.9 |
| *the-margin-box-leak-earns-a-case* | Executed | Process | No |
| *the-silent-defects-earn-their-cases* | Executed | Process | No |
| *two-cases-from-a-second-stranger* | Executed | Process | No |

The process records govern how a fault is fixed, and the engineering constitution cites them. The engine records each own a rule that runs, so the rule's module should cite its record; the author rules whether each is cited in the source, folded into another record, or retired.
