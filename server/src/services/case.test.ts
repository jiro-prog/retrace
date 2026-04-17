import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createDb, type DB } from '../db/connection.js';
import type { ClueLevel } from '../types/index.js';
import {
  createCase,
  getCaseDetail,
  getCheckedLocations,
  getLatestTurnNumber,
  markSuspectChecked,
  saveSuspectSnapshot,
  saveTurnAtomic,
  type DetectiveTurnData,
} from './case.js';

const newCase = (testDb: DB): string => {
  const c = createCase(
    { item: '鍵', lastSeen: '昨夜', lastAction: '帰宅' },
    testDb,
  );
  return c.id;
};

const baseSuspects = [
  { location: 'コートのポケット', confidence: 40 },
  { location: '玄関', confidence: 30 },
  { location: '寝室', confidence: 20 },
  { location: 'その他', confidence: 10 },
];

const detectiveTurn = (
  overrides: Partial<DetectiveTurnData> = {},
): DetectiveTurnData => ({
  dialogue: 'ふむ、助手殿。',
  rawJson: '{}',
  suspects: baseSuspects,
  clueLevel: 'scarce' as ClueLevel,
  ...overrides,
});

describe('saveSuspectSnapshot — checked inheritance across turns', () => {
  it('carries checked=1 and result=not_found from the previous turn to the matching location', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);

    saveSuspectSnapshot(caseId, 1, baseSuspects, 'scarce', testDb);
    markSuspectChecked(caseId, 'コートのポケット', testDb);

    saveSuspectSnapshot(
      caseId,
      2,
      [
        { location: 'コートのポケット', confidence: 50 },
        { location: '玄関', confidence: 20 },
        { location: '寝室', confidence: 20 },
        { location: 'その他', confidence: 10 },
      ],
      'getting_closer',
      testDb,
    );

    const detail = getCaseDetail(caseId, testDb);
    const carried = detail?.suspects.find((s) => s.location === 'コートのポケット');
    assert.equal(carried?.checked, true);
    assert.equal(carried?.result, 'not_found');
  });

  it('does not carry checked to locations with different names in the next turn', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);

    saveSuspectSnapshot(caseId, 1, baseSuspects, 'scarce', testDb);
    markSuspectChecked(caseId, 'コートのポケット', testDb);

    saveSuspectSnapshot(
      caseId,
      2,
      [
        { location: 'キッチン', confidence: 40 },
        { location: 'リビング', confidence: 30 },
        { location: '書斎', confidence: 20 },
        { location: 'その他', confidence: 10 },
      ],
      'getting_closer',
      testDb,
    );

    const detail = getCaseDetail(caseId, testDb);
    detail?.suspects.forEach((s) => {
      assert.equal(s.checked, false);
      assert.equal(s.result, null);
    });
  });

  it('leaves checked=0 on every row when no previous turn had checks', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);

    saveSuspectSnapshot(caseId, 1, baseSuspects, 'scarce', testDb);
    saveSuspectSnapshot(caseId, 2, baseSuspects, 'scarce', testDb);

    const detail = getCaseDetail(caseId, testDb);
    detail?.suspects.forEach((s) => assert.equal(s.checked, false));
  });
});

describe('saveTurnAtomic — transactional persistence', () => {
  it('writes user message, detective message, and suspects in one transaction on success', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);

    saveTurnAtomic(caseId, 1, 'どこにあるかな', detectiveTurn(), testDb);

    const detail = getCaseDetail(caseId, testDb);
    assert.equal(detail?.messages.length, 2);
    assert.equal(detail?.messages[0].role, 'assistant');
    assert.equal(detail?.messages[0].content, 'どこにあるかな');
    assert.equal(detail?.messages[1].role, 'detective');
    assert.equal(detail?.suspects.length, 4);
    assert.equal(getLatestTurnNumber(caseId, testDb), 1);
  });

  it('omits the user message when userContent is null (initial reasoning path)', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);

    saveTurnAtomic(caseId, 1, null, detectiveTurn(), testDb);

    const detail = getCaseDetail(caseId, testDb);
    assert.equal(detail?.messages.length, 1);
    assert.equal(detail?.messages[0].role, 'detective');
  });

  it('rolls back all writes if the suspects insert violates a CHECK constraint', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);

    assert.throws(() =>
      saveTurnAtomic(
        caseId,
        1,
        'テスト',
        detectiveTurn({
          suspects: [
            // confidence=150 violates CHECK(confidence >= 0 AND confidence <= 100)
            { location: 'A', confidence: 150 },
            { location: 'B', confidence: 30 },
            { location: 'C', confidence: 20 },
            { location: 'その他', confidence: 10 },
          ],
        }),
        testDb,
      ),
    );

    const detail = getCaseDetail(caseId, testDb);
    assert.equal(detail?.messages.length, 0, 'user and detective messages must be rolled back');
    assert.equal(detail?.suspects.length, 0, 'no suspect rows must persist');
    assert.equal(getLatestTurnNumber(caseId, testDb), 0);
  });

  it('is a silent no-op when another writer already persisted the same turn (UNIQUE race)', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);

    // First writer wins.
    saveTurnAtomic(caseId, 1, null, detectiveTurn({ dialogue: 'A' }), testDb);

    // Second writer with different content for the same turn: must not throw
    // and must not clobber the winner's row.
    saveTurnAtomic(
      caseId,
      1,
      null,
      detectiveTurn({ dialogue: 'B', suspects: baseSuspects }),
      testDb,
    );

    const detail = getCaseDetail(caseId, testDb);
    assert.equal(detail?.messages.length, 1, 'only the winner persists');
    assert.equal(detail?.messages[0].content, 'A');
    assert.equal(detail?.suspects.length, 4, 'no duplicate suspect rows');
  });

  it('preserves the turn-number invariant on retry after a failed turn (B2 regression)', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);

    // Successful turn 1
    saveTurnAtomic(caseId, 1, '最初の報告', detectiveTurn(), testDb);
    assert.equal(getLatestTurnNumber(caseId, testDb), 1);

    // Simulate LLM failure: caller does NOT call saveTurnAtomic.
    // No side effects should have occurred.
    assert.equal(getLatestTurnNumber(caseId, testDb), 1);

    // Retry: nextTurn = prevTurn + 1 = 2. Same number the failed call would have used.
    saveTurnAtomic(
      caseId,
      2,
      '再送',
      detectiveTurn({ dialogue: 'なるほど' }),
      testDb,
    );

    const detail = getCaseDetail(caseId, testDb);
    assert.equal(detail?.messages.length, 4);
    assert.deepEqual(
      detail?.messages.map((m) => m.turnNumber),
      [1, 1, 2, 2],
      'turn numbers are dense (no gap, no duplication)',
    );
  });
});

describe('markSuspectChecked — B1 API entry point', () => {
  it('flips checked=1 and result=not_found on the latest turn snapshot', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);
    saveSuspectSnapshot(caseId, 1, baseSuspects, 'scarce', testDb);

    const snapshot = markSuspectChecked(caseId, 'コートのポケット', testDb);
    assert.notEqual(snapshot, null);
    const row = snapshot?.find((s) => s.location === 'コートのポケット');
    assert.equal(row?.checked, true);
    assert.equal(row?.result, 'not_found');
  });

  it('returns null when the case has no suspects snapshot yet', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);
    assert.equal(markSuspectChecked(caseId, 'どこか', testDb), null);
  });

  it('returns null when the location does not exist in the current snapshot', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);
    saveSuspectSnapshot(caseId, 1, baseSuspects, 'scarce', testDb);

    assert.equal(markSuspectChecked(caseId, '存在しない', testDb), null);
  });

  it('is surfaced by getCheckedLocations', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);
    saveSuspectSnapshot(caseId, 1, baseSuspects, 'scarce', testDb);

    assert.deepEqual(getCheckedLocations(caseId, testDb), []);
    markSuspectChecked(caseId, 'コートのポケット', testDb);
    assert.deepEqual(getCheckedLocations(caseId, testDb), ['コートのポケット']);
  });

  it('affects only the latest turn, leaving earlier snapshots untouched', () => {
    const testDb = createDb();
    const caseId = newCase(testDb);

    saveSuspectSnapshot(caseId, 1, baseSuspects, 'scarce', testDb);
    saveSuspectSnapshot(caseId, 2, baseSuspects, 'scarce', testDb);

    markSuspectChecked(caseId, 'コートのポケット', testDb);

    // Inspect historical rows directly — getCaseDetail only shows the latest turn.
    const turn1Row = testDb
      .prepare(
        `SELECT checked FROM suspects WHERE case_id = ? AND turn_number = 1 AND location = ?`,
      )
      .get(caseId, 'コートのポケット') as { checked: number };
    assert.equal(turn1Row.checked, 0, 'turn 1 must remain untouched');

    const turn2Row = testDb
      .prepare(
        `SELECT checked FROM suspects WHERE case_id = ? AND turn_number = 2 AND location = ?`,
      )
      .get(caseId, 'コートのポケット') as { checked: number };
    assert.equal(turn2Row.checked, 1, 'turn 2 (latest) reflects the check');
  });
});
