import { test } from 'node:test';
import assert from 'node:assert/strict';

test('the engine and flags subpaths resolve and export their member alone', async () => {
  const engine = await import('@beltype/cicero/engine');
  const flags = await import('@beltype/cicero/flags');
  assert.deepEqual(Object.keys(engine), ['ciceroEngine']);
  assert.deepEqual(Object.keys(flags), ['ciceroFlags']);
});

test('the fragmentation face carries the leading-decoration door, and it is the internal path\'s', async () => {
  const face = await import('@beltype/cicero/fragmentation');
  const words = await import('@beltype/cicero/internal/data-beltype');
  const fragments = await import('@beltype/cicero/internal/fragments');
  const space = await import('@beltype/cicero/internal/word-space');
  assert.equal(face.WRAPPED, words.WRAPPED);
  assert.equal(face.WRAPPED, 'wrapped');
  assert.equal(face.truncateLeadingDecoration, fragments.truncateLeadingDecoration);
  assert.equal(face.clonesDecoration, space.clonesDecoration);
  // A box whose source clones its decoration, and one that slices: the door marks the first wrapped and the second not, as the engine's own dressing does.
  const box = (decoration: string) => {
    const attrs = new Map<string, string>();
    const style = { boxDecorationBreak: decoration };
    return { isConnected: true, ownerDocument: { defaultView: { getComputedStyle: () => style } }, getAttribute: (n: string) => attrs.get(n) ?? null, setAttribute: (n: string, v: string) => attrs.set(n, v), removeAttribute: (n: string) => attrs.delete(n) } as any;
  };
  for (const [decoration, wraps] of [['clone', true], ['slice', false]] as const) {
    const el = box(decoration);
    assert.equal(face.clonesDecoration(el), wraps);
    face.truncateLeadingDecoration(el);
    assert.equal(face.hasWord(el, face.WRAPPED), wraps, decoration);
    assert.ok(face.hasWord(el, face.SPLIT) && !face.hasWord(el, face.START), `${decoration}: divided at its start`);
  }
});

test('the rim face answers the module the engine\'s own client imports', async () => {
  const face = await import('@beltype/cicero/rim');
  // The client imports `./rim.js` beside it in `dist/seam/`, so the face must be that file and no copy: `knowLoadedFaces` and `bringsNewFace` share the engine's set of announced faces only through the same module instance.
  const own = await import(new URL('../dist/seam/rim.js', import.meta.url).href);
  assert.deepEqual(Object.keys(face).sort(), ['TOLERANCE', 'bringsNewFace', 'frame', 'isKnownFace', 'knowLoadedFaces', 'watchLateTruth']);
  for (const name of ['watchLateTruth', 'bringsNewFace', 'knowLoadedFaces', 'isKnownFace'] as const) assert.equal(face[name], own[name], name);
  const face0 = { family: 'F', style: 'normal', weight: '400', stretch: 'normal', unicodeRange: 'U+0-10FFFF', featureSettings: 'normal', status: 'loaded' } as unknown as FontFace;
  face.knowLoadedFaces([face0] as unknown as FontFaceSet);
  assert.ok(own.isKnownFace(face0), 'a face the host told the face about is one the engine knows');
  assert.equal(face.bringsNewFace({ fontfaces: [face0] } as unknown as Event), false);
});
