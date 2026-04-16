# 02. Retrace 仕様書 v0.2

## 1. システム構成

```
┌─────────────────┐        ┌──────────────────────┐
│ スマホ（PWA）     │◄──────►│ 本部サーバー（PC）     │
│ React + Vite    │ WS     │ Node.js + Fastify    │
│ Web Speech API  │        │  ├ llama.cpp server  │
│ (STT + TTS)     │        │  │  (OpenAI互換API) │
└─────────────────┘        │  └ SQLite            │
                           └──────────────────────┘
        同一Wi-Fi（WSL2ブリッジ要注意）
```

### スマホ側（React PWA）
- **役割**：UI、音声入出力、カメラ、捜査画面表示
- **技術**：React 18 + Vite + TypeScript + Tailwind CSS
- **PWA化**：`vite-plugin-pwa`
- **状態管理**：Zustand
- **通信**：WebSocket

### 本部サーバー側（PC）
- **役割**：LLM推論、事件簿管理、推理ロジック
- **技術**：Node.js 20+ + Fastify + `@fastify/websocket` + `better-sqlite3`
- **LLM**：llama.cpp server + Gemma 4 E4B（Q4_K_M）
- **DB**：SQLite（事件記録、容疑者パターン、迷宮入り）

## 2. llama.cpp server 構成

### 起動コマンド例
```bash
./llama-server \
  -m models/gemma-4-e4b-it-Q4_K_M.gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 8192 \
  --n-gpu-layers 999 \
  --chat-template gemma
```

### API利用
- llama.cpp serverは**OpenAI互換API**を提供
- `/v1/chat/completions`エンドポイント使用
- Node.js側は`openai` npmパッケージで`baseURL`書き換えて叩く

### GBNF Grammar（JSON構造化出力の強制）
```gbnf
root ::= "{" ws
  "\"dialogue\":" ws string "," ws
  "\"suspects\":" ws "[" suspect ("," ws suspect)* "]" "," ws
  "\"next_action\":" ws string "," ws
  "\"clue_level\":" ws clue-level
  ws "}"

suspect ::= "{" ws
  "\"location\":" ws string "," ws
  "\"confidence\":" ws number
  ws "}"

clue-level ::= "\"scarce\"" | "\"getting_closer\"" | "\"core\""

string ::= "\"" ([^"\\] | "\\" .)* "\""
number ::= [0-9]+
ws ::= [ \t\n]*
```

これで**パース失敗が原理的に起きない**。リトライロジック不要。

## 3. 機能仕様

### 3.1 依頼フロー（MVP）

初期質問は最小3つ：
- 何を失くしましたか？
- 最後に見た/使ったのはいつ頃？
- その時何をしていましたか？

音声入力優先、テキスト入力もサポート。

### 3.2 捜査画面レイアウト（スマホ縦）

```
┌──────────────────────┐
│ 事件名：消えたイヤホン │ ← ヘッダー
├──────────────────────┤
│ 【容疑者リスト】        │
│ ▸ カバン      60% ▓▓▓ │
│ ▸ ジャケット   25% ▓   │
│ ▸ 玄関周辺    10%     │
│ ▸ その他       5%     │
├──────────────────────┤
│ 手がかり：掴めた 🔍🔍  │
├──────────────────────┤
│ 💬 探偵チャット         │
│ 「カバンの内ポケットを  │
│  確認してください」     │
├──────────────────────┤
│ [🎤 音声][📷写真][📝入力]│
└──────────────────────┘
```

### 3.3 探偵の対話

#### システムプロンプト（骨格）

```
あなたは名探偵「久世 玄」。失くし物の捜査を専門とする。
ユーザーはあなたの助手。「助手殿」と呼ぶ。

## 話し方
- です・ます調、落ち着いた知的な語り口
- 推理中は「ふむ」「なるほど」を挟む
- 軽い皮肉は可、ただし失礼にならない範囲

## 捜査方針
- 即断しない。最低3ターンは情報を集める
- 容疑者リストは常に4項目（具体3つ＋「その他」）
- 意外な質問を1回は挟む
- ユーザーの報告を受けて確度を必ず更新する
```

#### LLM出力フォーマット
```json
{
  "dialogue": "ふむ、カバンはシロでしたか。となると...",
  "suspects": [
    {"location": "ジャケットのポケット", "confidence": 45},
    {"location": "玄関の棚", "confidence": 30},
    {"location": "ソファの隙間", "confidence": 15},
    {"location": "その他", "confidence": 10}
  ],
  "next_action": "ジャケットのポケットを確認してください",
  "clue_level": "getting_closer"
}
```

### 3.4 解決・迷宮入り

**解決時**
- ユーザーが「見つかった、場所は〇〇」と報告
- 探偵が勝ち誇る（控えめに）
- 事件簿に「解決」として記録
- 発見場所がパターンDBに蓄積

**迷宮入り**
- ユーザーが「諦める」を選択
- 「迷宮入りファイル」に移動
- 数週間後に「再捜査しますか？」通知（フェーズ2）

### 3.5 事件ファイル一覧

過去の捜査記録を時系列で閲覧。
- 解決済み / 迷宮入りでフィルタ
- 失くし物種別でフィルタ
- タイトル自動生成（「消えた充電ケーブル」等）

### 3.6 音声機能（Web Speech API）

**音声認識（STT）**
- `SpeechRecognition` API
- 言語：`ja-JP`
- マイクボタン長押し中に認識、離すと送信

**音声合成（TTS）**
- `SpeechSynthesis` API
- 探偵の応答を読み上げ
- トグルでON/OFF

**ブラウザ対応**
- Chrome Android：◎
- Safari iOS：△（制限あり、フォールバック必須）
- Firefox：△

**前提**：HTTPS必須（mkcert使用）

## 4. データモデル

```typescript
// 事件
interface Case {
  id: string;
  title: string;           // 自動生成
  item: string;            // 失くし物
  status: 'investigating' | 'solved' | 'cold';
  createdAt: Date;
  solvedAt?: Date;
  foundLocation?: string;
  initialContext: {
    lastSeen: string;
    lastAction: string;
  };
  conversations: Message[];
  finalSuspects: Suspect[];
}

interface Message {
  role: 'detective' | 'assistant';
  content: string;
  timestamp: Date;
  image?: string;
}

interface Suspect {
  location: string;
  confidence: number;
  checked: boolean;
  result?: 'found' | 'not_found';
}

// パターンDB（蓄積価値）
interface Pattern {
  item: string;
  foundLocations: {
    location: string;
    count: number;
  }[];
  timePatterns: {
    dayOfWeek?: string;
    timeOfDay?: string;
    count: number;
  }[];
}
```

## 5. 技術スタック

### フロントエンド
- React 18 + Vite + TypeScript
- Tailwind CSS
- Zustand
- `vite-plugin-pwa`
- Web Speech API

### バックエンド
- Node.js 20+
- Fastify + `@fastify/websocket`
- `better-sqlite3`
- `openai` npm（llama.cpp serverをOpenAI互換で叩く）

### LLM
- llama.cpp server
- Gemma 4 E4B（Q4_K_M）
- GBNF Grammar

### 開発環境
- mkcert（ローカルHTTPS）
- 同一Wi-Fi内でスマホ実機テスト

## 6. MVPスコープ

### 入れる
- 依頼フロー（3つの質問）
- 探偵との対話（テキスト）
- 容疑者リスト表示・更新
- 事件ファイル一覧
- 解決/迷宮入り記録
- 音声入出力（Web Speech API）
- パターンDB蓄積（表示は後回しでもOK）

### 入れない（フェーズ2以降）
- 画像による現場報告
- 複数キャラ選択
- 再捜査通知
- 外出先対応（Tailscale）
- 迷宮入りの自動分析

## 7. 開発ロードマップ

### Phase 0：プロンプト検証（1-2日）← 現在
- llama.cpp server + Gemma 4 E4B起動
- 探偵プロンプト・GBNF Grammarを試す
- 5-10ケースで推理品質を評価

### Phase 1：MVP（2-3週間）
- Node.jsバックエンド（WebSocket + llama.cpp連携）
- React PWA（チャットUI + 容疑者リスト）
- 音声入出力統合
- 同一Wi-Fi動作確認（HTTPS含む）
- 1事件の通しプレイ

### Phase 2：蓄積価値
- パターンDB活用
- 事件ファイル閲覧UI
- 迷宮入り管理

### Phase 3：磨き込み
- 演出改善
- 画像対応
- 再捜査通知

## 8. 技術的リスク

1. **Gemma 4 E4Bの日本語キャラ演技力が薄い可能性**
   - Phase 0で検証、ダメならQwen 3.5 9B等に切替

2. **llama.cpp serverのGBNFは構造を保証するが、意味的な正しさは保証しない**
   - 表記ゆれや意味破綻は別途対処
   
3. **Web Speech APIのiOS対応の弱さ**
   - iPhoneユーザー向けにはテキスト入力フォールバック必須

4. **WSL2環境でのスマホからの到達性**
   - `netsh interface portproxy`設定が必要な場合あり
