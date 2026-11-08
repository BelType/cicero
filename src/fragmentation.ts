/**
 * The fragmentation face: the engine's members a view adapter builds on, `@beltype/cicero/fragmentation`.
 *
 * @remarks
 * Exactly the names the first view adapter imported by deep path on 2026-10-29 (68 of them, from 16 modules), re-exported unchanged, and the names a view has asked for since (the leading-decoration door, `WRAPPED`, `clonesDecoration` and `truncateLeadingDecoration`, 2026-11-07); nothing is un-exported. Which of them stay public, merge or leave is the shape round's question. The face loads in node: `chase.ts`, which defines the `<beltype-page>` element and so needs a DOM at load, is not here; a view imports it for that effect as `@beltype/cicero/page`.
 *
 * @packageDocumentation
 */

export { effectivePageName, readGeometryTable, registerGcpmProperties, sheetReach, topLevelReach, transliterateContent } from './capture.ts';
export { ADJOIN, ARTIFACT, AWAY, END, FRAGMENT, SHELL, SPLIT, START, WRAPPED, addWord, hasWord, removeWord } from './data-beltype.ts';
export { counterStateAt, documentOpsOf, namedStringsForPage, runningAssignmentsOf, stringAssignmentsOf } from './document-state.ts';
export { ensureContinuationDressing, ensureDressing } from './dressing.ts';
export { forcingIndexOf, gapAbove, pageNameDownFrom, runningBoxes, runningPosition, topLevelBlocks } from './driver.ts';
export { ForcingMemo } from './forcing-memo.ts';
export type { Keep } from './forcing-memo.ts';
export { joinedWords, mutateToContinuation, mutateToFirstFragment, pinTrack, truncateLeadingDecoration } from './fragments.ts';
export { takeReport } from './gauge.ts';
export { STRING_KEYWORDS, encodeStringProp } from './gcpm-encoding.ts';
export { assertRenderConditions, awaitCloneImages, awaitFonts, createMeasureContext } from './measure.ts';
export { divides, elAt, extensionPx, indexBlocks, normalizePath, pageContaining, pageIntervals, pathOf, placeAt } from './positions.ts';
export { present, presentation } from './presenters.ts';
export { cssString, findPageSites, findSites, settleReads } from './reads.ts';
export { adjudicate, firstBelowTheEdge, fitsPage, isOutOfFlow, neverCutInside, processionBottoms, reachesBelowTheEdge } from './stonehand.ts';
export { BREAKING_SPACE, clonesDecoration, copyOf, isFixedBox, isInlineBox, isLineBreak, noteSource } from './word-space.ts';
