# 06. Phase 1 設計書：MVP実装

## 目的

**テキストベースで1事件の通しプレイが動く状態**を作る。

音声機能（Web Speech API）はテキスト通しプレイ完成後に追加する。

## スコープ

### Phase 1a（テキスト通しプレイ）← 本設計書の範囲
- 事件作成（3つの質問）
- 探偵との対話チャット（テキスト入力）
- 容疑者リスト表示・リアルタイム更新
- 事件の解決・迷宮入り
- 事件ファイル一覧
- パターンDB蓄積（解決時に記録、表示はPhase 2）

### Phase 1b（音声追加）← 1a完成後
- Web Speech API（STT + TTS）統合
- mkcertによるHTTPS化
- スマホ実機テスト

## システム構成

```
スマホ / PC ブラウザ
  │
  ├── GET/POST /api/cases/*     ← REST（CRUD操作）
  │
  └── WS /ws/cases/:id          ← WebSocket（探偵との対話）
        │
  ┌─────┴──────────────────────┐
  │  Fastify (Node.js)          │
  │  ├── routes/  (REST)        │
  │  ├── ws/      (WebSocket)   │
  │  │   └── caseHandler.ts    │
  │  ├── services/              │
  │  │   ├── detective.ts       │ ← llama.cpp呼び出し + リトライ
  │  │   ├── case.ts            │ ← 事件CRUD
  │  │   └── pattern.ts         │ ← パターン蓄積
  │  └── db/                    │
  │      ├── schema.sql         │
  │      └── connection.ts      │ ← better-sqlite3
  │                             │
  │  llama.cpp server (:8080)   │ ← 別プロセス、OpenAI互換API
  └─────────────────────────────┘
```

## 1. RESTエンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/api/cases` | 事件作成（item, lastSeen, lastAction） |
| `GET` | `/api/cases` | 事件一覧（status でフィルタ可能） |
| `GET` | `/api/cases/:id` | 事件詳細（会話履歴・容疑者含む） |
| `PATCH` | `/api/cases/:id/solve` | 事件解決（foundLocation を記録） |
| `PATCH` | `/api/cases/:id/cold` | 迷宮入り |

### リクエスト/レスポンス例

```typescript
// POST /api/cases
// Request
{
  item: string;        // "鍵"
  lastSeen: string;    // "昨日の夜、帰宅した時"
  lastAction: string;  // "コートを脱いで手を洗った"
}
// Response
{
  id: string;
  title: string;       // 自動生成："消えた鍵"
  status: "investigating";
  createdAt: string;
}

// PATCH /api/cases/:id/solve
// Request
{
  foundLocation: string;  // "コートのポケット"
}
```

## 2. WebSocketプロトコル

接続先：`ws://host:3000/ws/cases/:id`

### クライアント → サーバー

```typescript
// 助手のメッセージ送信
{
  type: "user_message";
  content: string;
}
```

### サーバー → クライアント

```typescript
// 探偵が考え中（llama.cpp推論中に送信）
{
  type: "thinking";
}

// 探偵の応答（llama.cpp完了後）
{
  type: "detective_response";
  dialogue: string;
  suspects: { location: string; confidence: number }[];
  nextAction: string;
  clueLevel: "scarce" | "getting_closer" | "core";
  turnNumber: number;
}

// エラー（パース失敗がリトライ上限に達した等）
{
  type: "error";
  message: string;
  retryable: boolean;
}
```

### 対話フロー

```
クライアント                     サーバー                    llama.cpp
    |                              |                           |
    |--- POST /api/cases --------->|                           |
    |<-- { id, title, ... } ------|                           |
    |                              |                           |
    |--- WS connect /ws/cases/id ->|                           |
    |<-- { type: "detective_response", ... } ←── 初回推理 ←----|
    |                              |                           |
    |--- { type: "user_message" }->|                           |
    |<-- { type: "thinking" } -----|                           |
    |                              |--- /v1/chat/completions ->|
    |                              |<-- JSON response ---------|
    |                              |   parse + validate        |
    |                              |   (失敗→リトライ max 2)   |
    |<-- { type: "detective_response", ... } ←── 確度更新 -----|
    |                              |                           |
    |--- PATCH /cases/id/solve --->|                           |
    |<-- { solved, pattern記録 } --|                           |
```

### 設計判断：ストリーミングしない理由

GBNF GrammarでJSON出力を強制している以上、部分的なトークンをフロントに流しても意味がない（不完全なJSONはパースできない）。`thinking`メッセージで体感を担保し、完成したJSONを一括送信する。

将来、dialogueフィールドだけストリーミングしたくなった場合は、2段階送信（dialogue先行→suspects後追い）に変更可能。

## 3. SQLiteスキーマ

```sql
-- 事件
CREATE TABLE cases (
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

-- 会話ログ
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('detective', 'assistant')),
  content TEXT NOT NULL,           -- detective: dialogue / assistant: ユーザー入力
  raw_llm_json TEXT,               -- detective応答の場合のみ、生JSON保存
  turn_number INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 容疑者スナップショット（各ターンの状態を保存）
CREATE TABLE suspects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  location TEXT NOT NULL,
  confidence INTEGER NOT NULL CHECK(confidence >= 0 AND confidence <= 100),
  position INTEGER NOT NULL,       -- 表示順（1-4、4=その他）
  checked INTEGER NOT NULL DEFAULT 0,
  result TEXT CHECK(result IN ('found', 'not_found') OR result IS NULL)
);

-- パターンDB（蓄積）
CREATE TABLE patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item TEXT NOT NULL,
  found_location TEXT NOT NULL,
  day_of_week INTEGER,             -- 0=日 ... 6=土
  hour_of_day INTEGER,             -- 0-23
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX idx_messages_case ON messages(case_id, turn_number);
CREATE INDEX idx_suspects_case ON suspects(case_id, turn_number);
CREATE INDEX idx_patterns_item ON patterns(item);
```

### 設計メモ
- `suspects`はターンごとにスナップショット保存。最新の状態は`MAX(turn_number)`で取得
- `raw_llm_json`を残すことで、Phase 0的な検証をプロダクション中でも行える
- `patterns`は解決時に1レコード追加。集計はSELECTで行う（Phase 2）

## 4. フォルダ構成

```
retrace/
├── client/                      # React PWA
│   ├── src/
│   │   ├── components/
│   │   │   ├── CaseCreate.tsx     # 依頼フォーム（3つの質問）
│   │   │   ├── CaseList.tsx       # 事件ファイル一覧
│   │   │   ├── ChatPanel.tsx      # 探偵チャット
│   │   │   ├── SuspectList.tsx    # 容疑者リスト
│   │   │   └── CaseHeader.tsx     # 事件名・ステータス
│   │   ├── stores/
│   │   │   └── caseStore.ts       # Zustand
│   │   ├── hooks/
│   │   │   └── useDetectiveWs.ts  # WebSocketフック
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── tsconfig.json             # paths で server/src/types を参照
│   ├── vite.config.ts
│   └── package.json
│
├── server/                      # Fastify バックエンド
│   ├── src/
│   │   ├── routes/
│   │   │   └── cases.ts           # REST endpoints
│   │   ├── ws/
│   │   │   └── caseHandler.ts     # WebSocket handler
│   │   ├── services/
│   │   │   ├── detective.ts       # llama.cpp呼び出し + リトライ
│   │   │   ├── case.ts            # 事件CRUD
│   │   │   └── prompt.ts          # プロンプト組み立て + トークン管理
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   ├── connection.ts      # better-sqlite3 初期化
│   │   │   └── migrations.ts      # スキーマ適用
│   │   ├── types/
│   │   │   └── index.ts           # 共有型定義（WS/REST/Case型等）
│   │   └── index.ts               # Fastify起動
│   ├── tsconfig.json
│   └── package.json
│
├── experiments/                 # Phase 0（既存）
├── docs/
├── CLAUDE.md
├── package.json                 # ルート（npm workspaces）
└── README.md
```

### 型定義の共有方針

`server/src/types/index.ts`に全共有型を定義。clientからはtsconfig.jsonの`paths`で参照する。MVP規模でshared/を独立パッケージにする必要はない。

### ルートpackage.json（npm workspaces）

```json
{
  "name": "retrace",
  "private": true,
  "workspaces": ["client", "server"]
}
```

## 5. Phase 0引き継ぎ項目の対処方針

| # | 項目 | 対処場所 | 方針 |
|---|---|---|---|
| 1 | パース失敗リトライ | `server/services/detective.ts` | 最大2回再送。3回失敗でWebSocketにerror送信 |
| 2 | GBNF突破の原因調査 | Phase 1a初期 | llama-server起動パラメータとgrammar指定方法を再確認。API側の`grammar`パラメータ指定も試す |
| 3 | システムプロンプトのトークン予算 | `server/services/prompt.ts` | システムプロンプト≦500トークン目標。会話履歴は直近10ターンに制限（古いターンは要約して圧縮、Phase 2で検討） |
| 4 | 登場人物の行動推理指示 | プロンプト追加 | 「依頼文に他者（子供・ペット等）が登場する場合、その行動パターンも推理に含めよ」を1行追加 |
| 5 | 失くし物の深刻度トーン調整 | プロンプト追加 | 「失くし物の性質に応じて語気を調整せよ。日用品は軽く、貴重品は真剣に」を1行追加 |
| 6 | 確認済み→0%の後処理正規化 | `server/services/detective.ts` | LLM応答パース後、checked=trueの場所のconfidenceを0に上書き、残りを合計100に再配分 |

## 6. 実装順序

```
Step 1: プロジェクト骨格
  ├── npm workspaces セットアップ（client / server）
  ├── TypeScript設定（client / server、型共有はpathsで解決）
  ├── 共有型定義（server/src/types/index.ts）
  └── Vite + React + Tailwind初期化

Step 2: データ層
  ├── SQLiteスキーマ適用（better-sqlite3）
  ├── 事件CRUDサービス（server/services/case.ts）
  └── DB接続・初期化

Step 3: RESTエンドポイント
  ├── POST/GET/PATCH /api/cases
  └── curlで動作確認

Step 4: llama.cpp連携
  ├── detective.ts（llama.cpp呼び出し）
  ├── prompt.ts（プロンプト組み立て）
  ├── リトライロジック
  ├── 確認済みconfidence正規化
  └── テストスクリプト（node -e でservice直接呼び出し）で動作確認

Step 5: WebSocket
  ├── /ws/cases/:id ハンドラ
  ├── thinking → detective_response フロー
  └── wscat等で動作確認

Step 6: フロントエンド - 事件管理
  ├── CaseCreate（依頼フォーム）
  ├── CaseList（事件一覧）
  └── ブラウザで事件作成・一覧表示を確認

Step 7: フロントエンド - 捜査画面
  ├── ChatPanel（チャットUI）
  ├── SuspectList（容疑者リスト）
  ├── useDetectiveWs（WebSocketフック）
  ├── 解決・迷宮入りフロー
  └── 1事件の完全な通しプレイ
```

### 各Stepの完了条件

| Step | 完了条件 |
|---|---|
| 1 | `npm install`が通り、client devサーバーが起動する |
| 2 | SQLiteにCaseを作成・取得できる（テストスクリプト） |
| 3 | curlでCRUD全操作が動く |
| 4 | テストスクリプトでllama.cpp経由の探偵応答が返り、JSONパースが通る |
| 5 | wscatで対話フローが完走する（thinking→response） |
| 6 | ブラウザで事件作成・一覧表示ができる |
| 7 | 事件作成→対話→解決 の通しプレイが完走する |

## 7. 開発時のllama-server起動コマンド

```bash
# Windows（Phase 1a: ローカルのみ。Phase 1bで --host 0.0.0.0 に切替）
llama-server.exe ^
  -m models/gemma-4-e4b-it-Q4_K_M.gguf ^
  --host 127.0.0.1 ^
  --port 8080 ^
  --ctx-size 8192 ^
  --n-gpu-layers 999
```

注意：`--chat-template`はGGUFメタデータから自動検出されるため省略。将来モデル切替時に不要なフラグが残るリスクを避ける。

Phase 0ではサーバー起動時に`--grammar-file`を指定していたが、Phase 1ではAPIリクエスト側で`grammar`パラメータを渡す方式も試す（引き継ぎ項目#2の調査を兼ねる）。

## 8. 未決定事項（実装中に判断）

1. **事件タイトル自動生成**：`"消えた" + item`で十分か、LLMに生成させるか → まず固定テンプレートで実装、物足りなければLLM生成に変更
2. **会話履歴の上限**：10ターンで足りるか → 実測して判断。ctx-size 8192トークンから逆算
3. **フロントのルーティング**：React Router vs 単一ページ → MVP時点では単一ページ内の状態切替（Zustand）で十分と判断。ページ数が増えたらRouter導入
4. **CORSとプロキシ**：開発時のclient（Vite :5173）→ server（:3000）通信 → Viteのproxy設定で対処
