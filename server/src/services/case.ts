import { nanoid } from 'nanoid';
import { db, type DB } from '../db/connection.js';
import type {
  Case,
  CaseDetail,
  CaseListItem,
  CaseStatus,
  ClueLevel,
  CreateCaseRequest,
  Message,
  SuspectSnapshot,
} from '../types/index.js';

interface CaseRow {
  id: string;
  title: string;
  item: string;
  status: CaseStatus;
  created_at: string;
  solved_at: string | null;
  found_location: string | null;
  last_seen: string;
  last_action: string;
}

interface MessageRow {
  id: number;
  case_id: string;
  role: 'detective' | 'assistant';
  content: string;
  raw_llm_json: string | null;
  turn_number: number;
  created_at: string;
}

interface SuspectRow {
  id: number;
  case_id: string;
  turn_number: number;
  location: string;
  confidence: number;
  position: number;
  checked: number;
  result: 'found' | 'not_found' | null;
  clue_level: ClueLevel | null;
}

function rowToCase(row: CaseRow): Case {
  return {
    id: row.id,
    title: row.title,
    item: row.item,
    status: row.status,
    createdAt: row.created_at,
    solvedAt: row.solved_at ?? undefined,
    foundLocation: row.found_location ?? undefined,
    lastSeen: row.last_seen,
    lastAction: row.last_action,
  };
}

function rowToListItem(row: CaseRow): CaseListItem {
  return {
    id: row.id,
    title: row.title,
    item: row.item,
    status: row.status,
    createdAt: row.created_at,
    solvedAt: row.solved_at ?? undefined,
    foundLocation: row.found_location ?? undefined,
  };
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    caseId: row.case_id,
    role: row.role,
    content: row.content,
    turnNumber: row.turn_number,
    createdAt: row.created_at,
  };
}

function rowToSuspect(row: SuspectRow): SuspectSnapshot {
  return {
    location: row.location,
    confidence: row.confidence,
    position: row.position,
    checked: row.checked === 1,
    result: row.result,
  };
}

// Every function accepts an optional `database` arg so tests can supply an
// in-memory DB. Production callers omit it and get the module singleton.

export function createCase(input: CreateCaseRequest, database: DB = db): Case {
  const id = nanoid();
  const title = `消えた${input.item}`;
  const stmt = database.prepare(`
    INSERT INTO cases (id, title, item, status, last_seen, last_action)
    VALUES (?, ?, ?, 'investigating', ?, ?)
  `);
  stmt.run(id, title, input.item, input.lastSeen, input.lastAction);
  const row = database.prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRow;
  return rowToCase(row);
}

export function listCases(status?: CaseStatus, database: DB = db): CaseListItem[] {
  const rows = status
    ? (database
        .prepare('SELECT * FROM cases WHERE status = ? ORDER BY created_at DESC')
        .all(status) as CaseRow[])
    : (database.prepare('SELECT * FROM cases ORDER BY created_at DESC').all() as CaseRow[]);
  return rows.map(rowToListItem);
}

export function getCase(id: string, database: DB = db): Case | null {
  const row = database.prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRow | undefined;
  return row ? rowToCase(row) : null;
}

export function getCaseDetail(id: string, database: DB = db): CaseDetail | null {
  const caseRow = database.prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRow | undefined;
  if (!caseRow) return null;

  const messages = (
    database
      .prepare('SELECT * FROM messages WHERE case_id = ? ORDER BY turn_number ASC, id ASC')
      .all(id) as MessageRow[]
  ).map(rowToMessage);

  const latestTurnRow = database
    .prepare('SELECT MAX(turn_number) AS t FROM suspects WHERE case_id = ?')
    .get(id) as { t: number | null };
  const latestTurn = latestTurnRow.t ?? 0;

  const suspectRows = latestTurn
    ? (database
        .prepare(
          'SELECT * FROM suspects WHERE case_id = ? AND turn_number = ? ORDER BY position ASC',
        )
        .all(id, latestTurn) as SuspectRow[])
    : [];

  const clueLevel = suspectRows[0]?.clue_level ?? null;
  const suspects = suspectRows.map(rowToSuspect);

  return {
    ...rowToCase(caseRow),
    messages,
    suspects,
    clueLevel,
    latestTurn,
  };
}

export function solveCase(id: string, foundLocation: string, database: DB = db): Case | null {
  const row = database.prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRow | undefined;
  if (!row) return null;
  database.prepare(
    `UPDATE cases SET status = 'solved', solved_at = datetime('now'), found_location = ? WHERE id = ?`,
  ).run(foundLocation, id);

  const now = new Date();
  database.prepare(
    `INSERT INTO patterns (item, found_location, day_of_week, hour_of_day) VALUES (?, ?, ?, ?)`,
  ).run(row.item, foundLocation, now.getDay(), now.getHours());

  return getCase(id, database);
}

export function coldCase(id: string, database: DB = db): Case | null {
  const row = database.prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRow | undefined;
  if (!row) return null;
  database.prepare(`UPDATE cases SET status = 'cold' WHERE id = ?`).run(id);
  return getCase(id, database);
}

export function appendUserMessage(
  caseId: string,
  content: string,
  turnNumber: number,
  database: DB = db,
): Message {
  const info = database
    .prepare(
      `INSERT INTO messages (case_id, role, content, turn_number) VALUES (?, 'assistant', ?, ?)`,
    )
    .run(caseId, content, turnNumber);
  const row = database
    .prepare('SELECT * FROM messages WHERE id = ?')
    .get(info.lastInsertRowid) as MessageRow;
  return rowToMessage(row);
}

export function appendDetectiveMessage(
  caseId: string,
  dialogue: string,
  rawJson: string,
  turnNumber: number,
  database: DB = db,
): Message {
  const info = database
    .prepare(
      `INSERT INTO messages (case_id, role, content, raw_llm_json, turn_number) VALUES (?, 'detective', ?, ?, ?)`,
    )
    .run(caseId, dialogue, rawJson, turnNumber);
  const row = database
    .prepare('SELECT * FROM messages WHERE id = ?')
    .get(info.lastInsertRowid) as MessageRow;
  return rowToMessage(row);
}

export interface DetectiveTurnData {
  dialogue: string;
  rawJson: string;
  suspects: { location: string; confidence: number }[];
  clueLevel: ClueLevel;
}

// Persist user message + detective response + suspects snapshot in one transaction.
// On LLM failure the caller skips this entirely, so no partial state reaches the DB —
// next user retry observes getLatestTurnNumber = last successful turn and reuses the same
// nextTurn number.
//
// Concurrent writers (two WS connections racing on initial reasoning) are resolved by
// the UNIQUE(case_id, turn_number, role/position) constraints: the loser's transaction
// rolls back and we swallow the SqliteError so the caller can still return its in-flight
// detective_response to its own WS client.
export function saveTurnAtomic(
  caseId: string,
  turnNumber: number,
  userContent: string | null,
  detective: DetectiveTurnData,
  database: DB = db,
): void {
  const tx = database.transaction(() => {
    if (userContent !== null) {
      appendUserMessage(caseId, userContent, turnNumber, database);
    }
    appendDetectiveMessage(caseId, detective.dialogue, detective.rawJson, turnNumber, database);
    saveSuspectSnapshot(caseId, turnNumber, detective.suspects, detective.clueLevel, database);
  });
  try {
    tx();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed')) {
      // Race lost: another connection already persisted this turn. No-op.
      return;
    }
    throw err;
  }
}

export function saveSuspectSnapshot(
  caseId: string,
  turnNumber: number,
  suspects: { location: string; confidence: number }[],
  clueLevel: ClueLevel,
  database: DB = db,
): void {
  // Carry checked flags from the previous turn by location match.
  const prevTurnRow = database
    .prepare(
      'SELECT MAX(turn_number) AS t FROM suspects WHERE case_id = ? AND turn_number < ?',
    )
    .get(caseId, turnNumber) as { t: number | null };
  const prevCheckedLocations = new Set<string>();
  if (prevTurnRow.t !== null) {
    const prevRows = database
      .prepare(
        `SELECT location FROM suspects WHERE case_id = ? AND turn_number = ? AND checked = 1`,
      )
      .all(caseId, prevTurnRow.t) as { location: string }[];
    prevRows.forEach((r) => prevCheckedLocations.add(r.location));
  }

  const insert = database.prepare(
    `INSERT INTO suspects (case_id, turn_number, location, confidence, position, checked, result, clue_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = database.transaction(() => {
    suspects.forEach((s, idx) => {
      const checked = prevCheckedLocations.has(s.location) ? 1 : 0;
      const result = checked ? 'not_found' : null;
      insert.run(caseId, turnNumber, s.location, s.confidence, idx + 1, checked, result, clueLevel);
    });
  });
  tx();
}

export function getCheckedLocations(caseId: string, database: DB = db): string[] {
  const rows = database
    .prepare(
      `SELECT DISTINCT location FROM suspects WHERE case_id = ? AND checked = 1 AND result = 'not_found'`,
    )
    .all(caseId) as { location: string }[];
  return rows.map((r) => r.location);
}

// Mark a suspect as checked (user reported "I looked there, not found")
// on the latest turn's snapshot. Returns the updated snapshot for that turn.
export function markSuspectChecked(
  caseId: string,
  location: string,
  database: DB = db,
): SuspectSnapshot[] | null {
  const latestTurnRow = database
    .prepare('SELECT MAX(turn_number) AS t FROM suspects WHERE case_id = ?')
    .get(caseId) as { t: number | null };
  if (latestTurnRow.t === null) return null;
  const latestTurn = latestTurnRow.t;

  const info = database
    .prepare(
      `UPDATE suspects SET checked = 1, result = 'not_found'
       WHERE case_id = ? AND turn_number = ? AND location = ?`,
    )
    .run(caseId, latestTurn, location);
  if (info.changes === 0) return null;

  const rows = database
    .prepare(
      'SELECT * FROM suspects WHERE case_id = ? AND turn_number = ? ORDER BY position ASC',
    )
    .all(caseId, latestTurn) as SuspectRow[];
  return rows.map(rowToSuspect);
}

export function getLatestTurnNumber(caseId: string, database: DB = db): number {
  const row = database
    .prepare('SELECT MAX(turn_number) AS t FROM messages WHERE case_id = ?')
    .get(caseId) as { t: number | null };
  return row.t ?? 0;
}

export function getRecentMessages(caseId: string, limit = 10, database: DB = db): Message[] {
  const rows = database
    .prepare(
      `SELECT * FROM (SELECT * FROM messages WHERE case_id = ? ORDER BY turn_number DESC, id DESC LIMIT ?) ORDER BY turn_number ASC, id ASC`,
    )
    .all(caseId, limit) as MessageRow[];
  return rows.map(rowToMessage);
}
