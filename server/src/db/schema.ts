// Schema embedded as a TS string so it travels with the compiled output
// (no need to copy .sql files in build scripts).
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  item TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'investigating'
    CHECK(status IN ('investigating', 'solved', 'cold')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  solved_at TEXT,
  found_location TEXT,
  last_seen TEXT NOT NULL,
  last_action TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('detective', 'assistant')),
  content TEXT NOT NULL,
  raw_llm_json TEXT,
  turn_number INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Prevent duplicate turns when multiple WS connections race on initial reasoning.
  -- (case_id, turn_number, role) is unique: each turn has at most one user message
  -- and one detective message.
  UNIQUE(case_id, turn_number, role)
);

CREATE TABLE IF NOT EXISTS suspects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  location TEXT NOT NULL,
  confidence INTEGER NOT NULL CHECK(confidence >= 0 AND confidence <= 100),
  position INTEGER NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  result TEXT CHECK(result IN ('found', 'not_found') OR result IS NULL),
  clue_level TEXT,
  -- Each turn's snapshot has positions 1..4; duplicate writes from concurrent
  -- saveSuspectSnapshot calls are rejected at the DB level.
  UNIQUE(case_id, turn_number, position)
);

CREATE TABLE IF NOT EXISTS patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item TEXT NOT NULL,
  found_location TEXT NOT NULL,
  day_of_week INTEGER,
  hour_of_day INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_case ON messages(case_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_suspects_case ON suspects(case_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_patterns_item ON patterns(item);
`;
