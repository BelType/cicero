<!--
Sync Impact Report
==================
Version change: (none) → 1.0.0
Bump rationale: MAJOR — first ratification, at Cicero's move out of the BelType
monorepo (packages/engine-cicero) into its own repository.

Adapted from Cascata's constitution 1.4.0. Kept: specification supremacy, the
citation discipline, isolated and tested boundaries, the gates, Complexity
Tracking, the amendment procedure. Changed: the stack (strict TypeScript with
erasable syntax only, run by Node directly; node:test instead of Vitest; npm
instead of pnpm), the citation form (decision records by name, never numbers),
and the oracle (the browser and the differential venue, not a conformance
corpus of format cases). Added: the mechanical port and its zero-diff proof,
the layering test, the case-before-fix rule, TSDoc prose.

Open at ratification, for the author:
  - Where the differential venue lives once the engine leaves the monorepo
    (today packages/essay, which imports the engine by path).
  - Whether the seam keeps its dependency on @egildo/beltype-common
    (BuildError, imported by seam/index.js).
-->

# Cicero Constitution

This document governs **how Cicero is built**. It does not restate `SPEC.md`, which governs **what Cicero means**. Where the two meet, Principle I settles it.

## Core principles

### I. Specification supremacy (non-negotiable)

`SPEC.md` is the normative source for every semantic question. A plan, a task, a commit message, a module header and a test cite the article they implement (`Article IV.7`) and the decision record that owns it, by name (*a-cell-keeps-its-own-window*). Behaviour no article states is not implemented until `SPEC.md` is amended by named article. Implementing first and documenting later is drift, and drift is a defect.

On product semantics `SPEC.md` wins; on engineering process this document wins. The design tablet stays sovereign over what pagination is, and `SPEC.md` cites it; neither this document nor a plan may weaken a tablet law.

Decision records are cited by name, never by number, and a record is never rewritten: a reversal is a new record naming the one it supersedes. A measured value is not a name, and it is written as measured, with its date.

Rationale: a specification the implementation can outvote is not a specification, and a citation that has to be looked up before the sentence means anything is a finding.

### II. The browser is the oracle, and the battery is the proof

Cicero owns no geometry. Every length, rect and line comes from the browser, and a module that computes one itself is a second layout engine, refused (`SPEC.md` §2.2).

A claim about how well Cicero paginates is a record the battery asserts, never prose. The standing tallies live in the venue's `gates/records.js` alone; a tally copied anywhere else is asserted by nothing and will decay. A change that moves a standing number is either the change the number was predicted to make, recorded in its decision record's verdict, or a defect. A number is never edited to make a gate pass.

Rationale: a gate's exit code speaks about defects, not distributions. A seed sliding from agreement to divergence looks like a normal run unless the tally is asserted.

### III. A fault earns a case before it earns a fix (non-negotiable)

A fault found in a real document is recorded on the capability checklist with its arithmetic, then authored as a case in the venue and watched failing, and only then fixed (*forcing-under-sections-earns-a-case*, *the-margin-box-leak-earns-a-case*, *the-silent-defects-earn-their-cases*, *two-cases-from-a-second-stranger*). A case written after its fix only says the fix agrees with itself.

A case that will be fixed in parts stays one case, so its red half says which part of the fix happened (*the-line-inside-a-word-earns-a-case*).

A frozen prediction is written in the decision record before the build, with its break-versus-hold criterion decided in advance, and the verdict is written at the close. A wall nobody predicted is recorded as unpredicted.

Rationale: the corpus is generated and the cases are hand-authored, so neither writes what a stranger's stylesheet writes. The case is what turns a stranger's document into a standing claim.

### IV. Layers are tested, not described

The layering is a test, `test/layering.test.ts`, and it fails on any of these:

1. A module under `src/` imports anything outside `src/`: a package, a `node:` builtin, or a path into `seam/`.
2. A module under `seam/` imports a package other than those Technology Constraints names.
3. The import graph under `src/` has a cycle.
4. A module under `src/` other than `chase.ts`, `root.ts` and the modules that import them fails to import under plain Node with no DOM global. The DOM is reached through parameters and lazily, never at load.
5. A module whose header calls it DOM-free (today `ledger`, `positions`, `resume`, `compositor`, `hyphenate`, `counter-styles`, `box-shorthand`, `margin-boxes`, `gcpm-encoding`, `data-beltype`, `presenters`) reads the globals `document`, `window` or `getComputedStyle`.
6. A file under `src/` or `seam/` contains the word `prosemirror`, or the name of any other consumer (project, *the-engine-knows-no-view*).
7. A package face (`SPEC.md` Article XIII) exports a name its table does not list, or lists a name it does not export. `./fragmentation` re-exports from `src/` only; `.` and `./facsimile` from `seam/` only.
8. A form the encoding contract spells is written as a literal outside `gcpm-encoding.ts` and its test; the test takes the forms from the module's own exports (*the-host-rewrites-what-the-parser-drops*).

An exemption is named in the test itself, with the article that grants it. An exemption the test does not name does not exist.

Rationale: `src/`'s no-dependency property is what keeps the interior portable and its suites browserless. A property the code promises about itself is a convention; a property a test checks is a boundary.

### V. A mechanical port is proven by zero diff (non-negotiable)

A change is **mechanical** when it claims to change no behaviour: a port from JavaScript to TypeScript, a move, a rename, a split of a module, a type tightened. A mechanical change is proven, never argued, by zero diff in three artefacts taken before and after it, on the same machine and the same pinned browser:

1. **The Ledgers.** Every case document and every corpus seed, in both modes, produces a byte-identical `ledger` (`SPEC.md` Article XII.2), serialised as JSON.
2. **The battery.** `npm run gates` in the venue reports every standing record unmoved.
3. **The unit suites.** Every test passes with no expectation edited.

A non-zero diff in any of the three makes the change not mechanical. It is then split: the mechanical part lands with its zero diff, and the semantic part lands on its own, citing its article and its record. A port commit never carries a fix, however small, and a fix found during a port is filed and lands after.

A Ledger dump script lives in `scripts/`, and the port's plan names its before and after commits.

Rationale: a port touches every line, and a behaviour change hidden among a thousand mechanical ones is found by nobody. The battery is the one instrument that can say whether a cut moved; asking it is cheaper than reading the diff.

### VI. Refusals are named; fallbacks are justified

A refusal is a detector and a fallback is a hiding place (`SPEC.md` §2.11). Code refuses by name, at intake where it can, and the refusal reaches the operator as a sentence. A fallback is written only where the fact is computed and only its presentation is unknown, and it says so on the console, once per distinct cause. A silent fallback is a defect.

The source document is never written (tablet, C5). Every write lands on a copy, through the `data-beltype` registry's read-modify-write (*one-attribute-has-words*).

## Technology constraints

**Language.** TypeScript under `strict`, with `noUncheckedIndexedAccess` and `erasableSyntaxOnly`. Erasable syntax only means no `enum`, no `namespace`, no parameter properties and no other construct that emits code: Node runs the sources by stripping types, so a `.ts` file is the program and not an input to one. Relative imports carry their `.ts` extension (`allowImportingTsExtensions`), and the emitted build rewrites them (`rewriteRelativeImportExtensions`). No `any`, no non-null assertion, and no assertion cast except where a DOM API's own type is narrower than its behaviour, with a `@remarks` saying which. `@ts-expect-error <reason>` is the only checker directive; `@ts-ignore` never.

**Runtime.** Active Node LTS, ESM only. The browser receives the emitted JavaScript, published by `vendorAssets()` at the depths the source has on disk (*the-host-rewrites-what-the-parser-drops*).

**Tests.** `node:test` and `node:assert/strict`, run as `node --test`. Unit suites are DOM-free and need no browser and no dependency: pure arithmetic against injected providers and plain object trees. Everything that needs Chromium lives in the venue. A test is table-driven where its oracle is a table, as a specification's own table is (*where-in-the-band*).

**Dependencies.** `src/` has none, ever. `seam/` may import `css-tree` (through `seam/csstree.ts` and its narrow subpaths only) and `pdfjs-dist` (pinned exactly, loaded by URL, only when a document holds a PDF `<object>`). Adding a runtime dependency is an amendment to this section. Dev dependencies need none.

**The decision record genre** is checked by `test/decisions.test.ts`: filenames matching headers, the status grammar, supersessions resolving, Context, Decision and Consequences present, a verdict wherever frozen predictions ran, and every relative link landing.

## Prose

**Comments are TSDoc, and their prose follows BelType's house style** (`docs/style.md` in BelType). A comment opens with one summary sentence: the contract first, then the reason that still binds. History lives in the CHANGELOG under its date, or in the decision record that owns it, and a dated citation stays behind (`see CHANGELOG 2026-07-18`).

- **A header**, tagged `@packageDocumentation`, says what the module is, which members are its API, the `SPEC.md` article it implements and the records that own its rules. It carries at most one `@example`.
- **Types live in TypeScript, never in prose.** A JSDoc type tag (`{T}`, `@type`, `@typedef`, `@property`, `@template`, `@param {T}`) is not written; the port removes each one into syntax.
- **The prose tags** are `@remarks` (rationale that binds, measured facts dated as `Measured 2026-09-14: …`), `@param name - sentence`, `@returns`, `@throws` naming the error class, `@defaultValue`, `@see` (a greppable citation), `{@link}`, `@internal`, `@example` and `@packageDocumentation`. A tag outside this list is a question before it is written.
- **Sentences** average under 25 words, one idea each, the point first, the condition before the instruction. The banned words of the house style are banned here.
- **A coined word** is glossed at first use in a file. A run of capitals is a name from the house roster (THE ADDRESS, THE RESUME TREE, THE WORDS SHEET, THE READS, THE RIM, THE INTAKE, THE PAGE AREA, THE MAKE-UP ORDER, THE `data-beltype` REGISTRY) and carries no emphasis.
- **A decision is cited by its name**, in italics, as `SPEC.md` cites it. A bare number is a finding.

## Standing exceptions at 0.1.0

The port from BelType was mechanical (Principle V), so the code arrived as it was. These deviations stand until the shape round answers them, and each leaves this list in the change that ends it.

1. **`noUncheckedIndexedAccess` is off.** Turned on, the ported code reads 438 errors (2026-10-29), each an index read the JSDoc never had to narrow; answering them is a typing change, not a port.
2. **The ported casts and `any` stand.** The JSDoc casts became `as` casts one for one; `new Set()`, `new Map()` and `new Promise(…)` with no type arguments carry `<any>`, which is how JavaScript read them.
3. **The layering test covers items 1 to 4 and 6** of Principle IV. Items 5, 7 and 8 are owed.
4. **The decisions test stays in BelType** with the decision records, which have not moved; `SPEC.md` cites them by name. Their links in source comments still point into the BelType checkout.
5. **The battery stays in BelType's essay venue**, which mounts this package's `dist/`.

## Development workflow and gates

**Flow.** A unit of work opens with its decision record, predictions frozen, and runs in its own branch and worktree. Status changes and new doubt go to the capability checklist; shape changes go to the architecture; the tablet changes only in a design round with Egildo.

**Gates.** A change is mergeable only when all of these hold:

1. `tsc --noEmit` is clean under the options above.
2. `node --test` is green, the layering test (Principle IV) among it.
3. The battery is green with every standing record unmoved, or moved exactly as the change's frozen predictions said (Principle II).
4. A mechanical change shows its zero diff in Ledgers, battery and suites (Principle V).
5. A fix has a case that was red before it (Principle III).
6. Every behaviour the change adds or alters is stated in `SPEC.md` by article, citing its record (Principle I).
7. No runtime dependency is added, or this document is amended in the same change.
8. Every new refusal names its cause, and every new fallback says so on the console (Principle VI).

**Complexity.** A deviation from a principle appears in the plan's Complexity Tracking, with the simpler alternative named and the reason it was refused. An undocumented deviation blocks review.

## Governance

This constitution supersedes ad-hoc practice for every process question; `SPEC.md` supersedes it on product semantics (Principle I). An agent guidance file (`CLAUDE.md`) is an index of these two documents and never contradicts either.

**Amendment.** An amendment is a change to this file that states its version bump, updates the Sync Impact Report above, and is reviewed on its own, never bundled into a feature. Versions are semantic:

- **MAJOR**: a principle is removed, or redefined so that prior compliance no longer holds.
- **MINOR**: a principle or section is added, or materially expanded.
- **PATCH**: wording, clarification, or a non-semantic refinement.

**Compliance review.** Every plan runs a Constitution Check before its design and after it, and every review checks the eight gates. Principles I, III and V admit no Complexity Tracking exception: a change that breaks them is refused, not justified.

**Version**: 1.0.0 | **Ratified**: 2026-10-29 | **Last Amended**: 2026-10-29
