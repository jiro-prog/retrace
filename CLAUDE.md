# CLAUDE.md — Retrace Project Guidelines

このファイルはClaude Code（および人間の開発者）がRetraceプロジェクトで作業する際の原則を定める。

## プロジェクトミッション

**Retraceは「スマホ起点×ローカルLLM×探偵ロールプレイ×蓄積学習」によって失くし物探しを再発明するプロダクトである。**

実装コストや流行りの技術に流されず、**本質的かどうか**を常に優先する。

## 技術スタック（固定）

以下は**勝手に変更しない**。変更提案がある場合は必ず人間に相談する。

### フロントエンド
- **React 18 + Vite + TypeScript**
- **Tailwind CSS**
- **Zustand**（状態管理、Redux/Jotai等への変更禁止）
- **Web Speech API**（音声入出力）
- **vite-plugin-pwa**（PWA化）

### バックエンド
- **Node.js 20+ + Fastify**（Express/Hono等への変更禁止）
- **@fastify/websocket**
- **better-sqlite3**（同期API重視）
- **openai** npm パッケージ（llama.cpp serverをOpenAI互換で叩く）

### LLM
- **llama.cpp server**（Ollama等への変更禁止）
- **Gemma 4 E4B（Q4_K_M）**を初期採用（後でQwen 3.5 9Bと比較予定）
- **GBNF Grammar**で構造化出力を強制

### 開発環境
- **mkcert**（ローカルHTTPS、Web Speech API必須条件）
- 同一Wi-Fi前提（初期フェーズ）

## 絶対禁止事項

1. **クラウドAI APIへの送信禁止**
   - OpenAI API、Anthropic API、Google Gemini API等への接続コードを書かない
   - Retraceの核心はプライバシー完結。ここが崩れたら存在意義が消える

2. **個人データの外部送信禁止**
   - 事件記録、捜査ログ、音声データ、画像データは全てローカル完結
   - テレメトリ・アナリティクス等も現時点では入れない

3. **不要なnpm依存の追加禁止**
   - 新規依存を追加する時は必ず人間に相談
   - 特にUIコンポーネントライブラリ（MUI/Chakra等）は入れない（Tailwind素で書く）

4. **勝手にアーキテクチャを変更しない**
   - モノリシックがマイクロサービスに化けたりしない
   - 勝手にフォルダ構成を大きく変えない

## コーディング規範

### 言語と命名

- **UI文言は日本語ベース**（初期ターゲットが日本語圏のミステリ好き・ガジェット好き層のため）
- **コード内のコメント・変数名は英語**
- **ドメイン用語は一貫性を保つ**：
  - 事件 = Case
  - 容疑者 = Suspect
  - 手がかり = Clue
  - 迷宮入り = ColdCase
  - 助手 = Assistant（ユーザー）
  - 主任探偵 = LeadDetective（AI）
  - 事件簿 = Casebook（蓄積データ）

### 品質基準

- **型安全**：TypeScriptの`any`は避ける。`unknown`を経由する
- **エラーハンドリング**：Promise chainにcatchを必ず書く。WebSocketは再接続ロジック前提
- **テスト**：Phase 0は検証優先で薄め、Phase 1以降で主要ロジックに単体テストを入れる
- **コミット粒度**：1コミット1変更理由。`chore:` `feat:` `fix:` `docs:` プレフィックス推奨

## Phase 0 特有のルール（現フェーズ）

現在Phase 0（プロンプト検証）では、以下を優先：

1. **実装の美しさより仮説検証**を優先
2. **プロンプト・GBNF・テストケース**は`experiments/phase0-prompt/`配下に全て置く
3. **検証結果はresults/に日付入りで保存**（LLM出力の再現性検証のため）
4. **agents構成は使わない**（設計しながら試すフェーズのため軽量運用）

## Claude Code への期待される振る舞い

### ✅ 期待される挙動
- ファイル編集前に必ず全体像を読む
- 不確実な判断は人間に相談する
- 実装前に「何を・なぜ・どうやるか」を短く述べる
- テストケースを自分で考えて足す
- llama.cpp関連のエラーは公式ドキュメントを優先参照

### ❌ 避けるべき挙動
- 勝手な技術スタック変更（例：Fastify→Express置き換え）
- 過剰な抽象化（YAGNI原則を守る）
- ドメイン用語の勝手な英訳（例：「容疑者」を`Target`に変える等）
- 本プロジェクトと無関係な一般的ベストプラクティス提案で時間を奪う
- 勝手なパッケージ追加

### ロール分離（Phase 1以降で導入予定）

Phase 1以降、`.claude/agents/architect.md`と`implementer.md`を導入して**設計と実装の分離**を行う予定。Phase 0では不要。

## 参考リンク

- [llama.cpp](https://github.com/ggerganov/llama.cpp)
- [llama.cpp GBNF guide](https://github.com/ggerganov/llama.cpp/blob/master/grammars/README.md)
- [Fastify](https://fastify.dev/)
- [Web Speech API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

## 開発者：So（日本・Windows WSL2 + RTX 3060 Ti 8GB）

環境特有の注意点：
- llama.cpp serverはWSL2内で立ち上げる前提
- スマホからのアクセスは`netsh interface portproxy`等でWindows側ポート開放が必要な場合あり
- 8GB VRAMでGemma 4 E4Bを運用。Qwen 3.5 9Bは量子化とオフロード設定次第
