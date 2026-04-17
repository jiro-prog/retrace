import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { Suspect } from '../types/index.js';
import { normalizeConfidence, parseDetectiveResponse } from './detective.js';

const sumConfidence = (suspects: Suspect[]): number =>
  suspects.reduce((acc, s) => acc + s.confidence, 0);

describe('normalizeConfidence', () => {
  const base: Suspect[] = [
    { location: 'コートのポケット', confidence: 40 },
    { location: '玄関', confidence: 30 },
    { location: '寝室', confidence: 20 },
    { location: 'その他', confidence: 10 },
  ];

  it('returns unchanged values when no locations are checked', () => {
    const result = normalizeConfidence(base, []);
    assert.deepEqual(
      result.map((s) => [s.location, s.confidence]),
      base.map((s) => [s.location, s.confidence]),
    );
  });

  it('zeroes a checked location and redistributes so the total is 100', () => {
    const result = normalizeConfidence(base, ['コートのポケット']);
    const zeroed = result.find((s) => s.location === 'コートのポケット');
    assert.equal(zeroed?.confidence, 0);
    assert.equal(sumConfidence(result), 100);
  });

  it('handles multiple checked locations', () => {
    const result = normalizeConfidence(base, ['コートのポケット', '玄関']);
    assert.equal(result.find((s) => s.location === 'コートのポケット')?.confidence, 0);
    assert.equal(result.find((s) => s.location === '玄関')?.confidence, 0);
    assert.equal(sumConfidence(result), 100);
  });

  it('returns all zeros when every location is checked (sum=0 passthrough)', () => {
    const result = normalizeConfidence(
      base,
      ['コートのポケット', '玄関', '寝室', 'その他'],
    );
    assert.deepEqual(
      result.map((s) => s.confidence),
      [0, 0, 0, 0],
    );
  });

  it('ignores checked names that do not match any suspect', () => {
    const result = normalizeConfidence(base, ['存在しない場所']);
    assert.deepEqual(
      result.map((s) => s.confidence),
      base.map((s) => s.confidence),
    );
  });

  it('absorbs rounding error into the top-confidence remaining location', () => {
    // Zero out "その他" (conf 10). Remaining ratios: 40/90, 30/90, 20/90, 0.
    // After Math.round: 44, 33, 22, 0 → sum 99. Diff +1 goes to highest (44 → 45).
    const result = normalizeConfidence(base, ['その他']);
    assert.equal(sumConfidence(result), 100);
    // Highest original (コートのポケット @40) should receive the +1 correction.
    const top = result.find((s) => s.location === 'コートのポケット');
    assert.equal(top?.confidence, 45);
  });

  it('is pure — does not mutate the input array', () => {
    const copy: Suspect[] = base.map((s) => ({ ...s }));
    normalizeConfidence(base, ['玄関']);
    assert.deepEqual(base, copy);
  });
});

describe('parseDetectiveResponse', () => {
  const validPayload = {
    dialogue: 'ふむ、助手殿。状況を整理しましょう。',
    suspects: [
      { location: 'コートのポケット', confidence: 40 },
      { location: '玄関', confidence: 30 },
      { location: '寝室', confidence: 20 },
      { location: 'その他', confidence: 10 },
    ],
    next_action: 'まずコートを確認してください。',
    clue_level: 'scarce',
  };

  it('parses a valid detective response JSON', () => {
    const parsed = parseDetectiveResponse(JSON.stringify(validPayload));
    assert.equal(parsed.dialogue, validPayload.dialogue);
    assert.equal(parsed.suspects.length, 4);
    assert.equal(parsed.next_action, validPayload.next_action);
    assert.equal(parsed.clue_level, 'scarce');
  });

  it('throws on invalid JSON syntax', () => {
    assert.throws(() => parseDetectiveResponse('not json at all'), SyntaxError);
  });

  it('throws when required fields are missing', () => {
    const broken = JSON.stringify({ dialogue: 'x', suspects: [] });
    assert.throws(() => parseDetectiveResponse(broken), /missing required fields/);
  });

  it('throws when suspects is not an array', () => {
    const broken = JSON.stringify({
      ...validPayload,
      suspects: 'not an array',
    });
    assert.throws(() => parseDetectiveResponse(broken), /suspects must be length 4/);
  });

  it('throws when suspects has fewer than 4 items', () => {
    const broken = JSON.stringify({
      ...validPayload,
      suspects: validPayload.suspects.slice(0, 3),
    });
    assert.throws(() => parseDetectiveResponse(broken), /suspects must be length 4/);
  });

  it('throws when suspects has more than 4 items', () => {
    const broken = JSON.stringify({
      ...validPayload,
      suspects: [...validPayload.suspects, { location: 'extra', confidence: 0 }],
    });
    assert.throws(() => parseDetectiveResponse(broken), /suspects must be length 4/);
  });

  it('throws on a top-level JSON null', () => {
    assert.throws(() => parseDetectiveResponse('null'), /missing required fields/);
  });
});
