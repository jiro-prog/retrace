# Retrace プロジェクト規範

スマホ起点 × ローカルLLM × 探偵ロールプレイ × 蓄積学習で失くし物探しを再発明するプロダクト。

本質優先。実装コストや流行りに流されない。

# 開発スタイル

- TDD で開発する（探索 → Red → Green → Refactoring）
- KPI やカバレッジ目標が与えられたら、達成するまで試行する
- 不明瞭な指示は質問して明確にする
- 実装前に「何を・なぜ・どうやるか」を短く述べる
- Phase 0 は検証優先で薄め、Phase 1 以降で主要ロジックに単体テストを入れる

# コード設計

- 関心の分離を保つ
- 状態とロジックを分離する
- 可読性と保守性を重視する
- コントラクト層（API/型）を厳密に定義し、実装層は再生成可能に保つ
- YAGNI を尊重し、過剰抽象化・shared/パッケージを避ける

# 技術スタック（固定）

変更提案がある場合は必ず人間に相談する。Redux/Jotai/Express/Hono/Ollama/UI コンポーネントライブラリは禁止。

- フロントエンド: React 18 + Vite + TypeScript + Tailwind CSS + Zustand + Web Speech API + vite-plugin-pwa
- バックエンド: Node.js 20+ + Fastify + @fastify/websocket + better-sqlite3 + openai npm
- LLM: llama.cpp server + Gemma 4 E4B (Q4_K_M) + response_format json_schema（GBNF も llama.cpp 内部で等価に扱われる。Phase 1a は json_schema を採用）
- E2E: playwright
- 開発環境: mkcert（HTTPS、Web Speech API 必須）

# 絶対禁止事項

- クラウド AI API（OpenAI/Anthropic/Gemini 等）への送信コードを書かない
- 事件記録・捜査ログ・音声・画像データの外部送信禁止
- テレメトリ・アナリティクスも導入しない
- 新規 npm 依存の追加は必ず人間に相談
- UI コンポーネントライブラリ（MUI/Chakra 等）は使わない（Tailwind 素）
- モノリシックをマイクロサービスに化けさせない
- フォルダ構成を勝手に大きく変えない

# 言語

- UI 文言は日本語（初期ターゲットが日本語圏のミステリ好き・ガジェット好き層）
- コード内のコメント・変数名は英語
- docs/ 配下と README は日本語（個人プロジェクト段階、OSS 開放時に英訳検討）
- コミットメッセージは英語プレフィックス（`chore:` `feat:` `fix:` `docs:` 等）+ 日本語本文可

# ドメイン用語

- 事件 = Case
- 容疑者 = Suspect
- 手がかり = Clue
- 迷宮入り = ColdCase
- 助手 = Assistant（ユーザー）
- 主任探偵 = LeadDetective（AI）
- 事件簿 = Casebook（蓄積データ）

# 品質基準

- TypeScript の `any` は避ける、`unknown` 経由
- Promise chain に catch を必ず書く
- WebSocket は再接続ロジック前提
- コミット粒度は 1 コミット 1 変更理由

# Phase 0 特有のルール

- 実装の美しさより仮説検証を優先
- プロンプト・GBNF・テストケースは `experiments/phase0-prompt/` 配下
- 検証結果は `results/` に日付入りで保存
- agents 構成は Phase 0 では使わない

Phase 1 以降は `.claude/agents/` の architect / implementer を利用。

# Claude Code への期待

期待する挙動:

- ファイル編集前に全体像を読む
- 不確実な判断は人間に相談する
- テストケースを自分で考えて足す
- llama.cpp 関連のエラーは公式ドキュメントを優先参照

避ける挙動:

- 勝手な技術スタック変更（例: Fastify → Express）
- 過剰な抽象化
- ドメイン用語の勝手な英訳（例: 「容疑者」を `Target` に変える）
- 本プロジェクトと無関係な一般論提案で時間を奪う
- 勝手なパッケージ追加

# 参考リンク

- llama.cpp: https://github.com/ggerganov/llama.cpp
- GBNF guide: https://github.com/ggerganov/llama.cpp/blob/master/grammars/README.md
- Fastify: https://fastify.dev/
- Web Speech API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API

# 開発者

So（日本 / Windows + RTX 4060 Ti 8GB）

- llama.cpp server は Windows 上で直接起動
- スマホからのアクセスは同一 Wi-Fi + Windows ファイアウォール許可
- 8GB VRAM で Gemma 4 E4B を運用、Qwen 3.5 9B は量子化とオフロード設定次第
