/**
 * The page's content area is as wide as the measure container is.
 *
 * Chromium lays a length out in 1/64 px, flooring each one. The page grid spans the content area over three tracks, so a band of 423.307 px (the trattato's 112 mm) came out 423.28125 px wide on the page and 423.296875 px in the measure container; a justified line that measured on one line at the second wrapped to two at the first, and the page below the cut was a line short of what the cut had counted on (specimen `trattato`, page 111).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandTracks } from '../src/margin-boxes.ts';

/** What Chromium makes of a CSS length: 1/64 px, remainder dropped. */
const laidOut = (px: number) => Math.floor(px * 64) / 64;

test('the three tracks lay out to the width one box of the band lays out to', () => {
  for (const band of [423.30708661417333, 112 * 96 / 25.4, 595.2755905511812, 718.1102362204726, 500, 441.9, 7 / 3]) {
    const tracks = bandTracks(band);
    const sum = tracks.reduce((total, track) => total + laidOut(track), 0);
    assert.equal(sum, laidOut(band), `${band} px`);
  }
});

test('each track is a whole number of 1/64 px, so the grid has nothing left to drop', () => {
  for (const track of bandTracks(423.30708661417333)) assert.equal(track * 64, Math.round(track * 64));
});
