# Retrace

> 使うほど、あなたの癖を知っていく。自宅専用のAI探偵。

Retraceは、**家で失くした物をローカルLLMの推理で探す**、スマホ起点のプライバシー完結型アプリです。

## なぜ作ったか

失くし物を探す時、人はデスクトップの前に座っていない。

ChatGPTのGPTs（Treasure-Finder Extraordinaire等）にも似た試みはあるが、どれも動線が合っていない。失くし物は動きながら探すもの。だから、探偵はポケットにいるべきだ。

## 3つの差別化ポイント

### 🕵️ 推理する探偵との対話体験

ただの検索ツールではありません。Retraceはあなた専属の名探偵。失くし物の手がかりを一緒に辿り、**容疑者リスト（疑わしい場所）を動かしながら**推理を進めます。見つかった瞬間、探偵が勝ち誇る——その小さな物語が、失くし物の焦りをちょっとした楽しみに変えます。

### 📱 ポケットの中の探偵事務所

失くし物は動きながら探すもの。だからRetraceはスマホから始まります。音声で相談して、現場で即報告。両手が塞がっていても大丈夫。**パニックの瞬間に最短距離で呼べる**、それが探偵とあなたの距離感です。

### 🏠 あなたの家から出ないプライバシー

推理エンジンは自宅PCで動く**ローカルLLM**。あなたの家の物・生活パターン・捜査記録は、一切クラウドに送られません。使うほど探偵はあなたの癖を学んでいきます——「金曜夜の鍵は寝室に消えやすい」「イヤホンは8割カバンの内ポケットで発見される」。**あなただけの探偵**が、あなたの家で育つ。

## アーキテクチャ

```
┌─────────────────┐        ┌──────────────────────┐
│ スマホ（PWA）     │◄──────►│ 本部サーバー（PC）     │
│ React + Vite    │ WS     │ Node.js + Fastify    │
│ Web Speech API  │        │  ├ llama.cpp server  │
└─────────────────┘        │  └ SQLite            │
                           └──────────────────────┘
        同一Wi-Fi
```

- **スマホ**：助手のポジション。音声/テキストで依頼、現場報告、結果受信
- **本部PC**：主任探偵のポジション。ローカルLLMが推理、SQLiteに事件記録を蓄積
- **通信**：WebSocketで双方向ストリーミング、同一LAN完結

## 技術スタック

- **フロントエンド**：React 18 + Vite + TypeScript + Tailwind CSS + Zustand + Web Speech API
- **バックエンド**：Node.js + Fastify + WebSocket + SQLite
- **LLM**：llama.cpp server + Gemma 4 E4B（Q4_K_M）+ GBNF Grammarによる構造化出力

## ステータス

**Phase 0：プロンプト検証中**（2026年4月〜）

本プロジェクトは個人開発、段階的に進行。

- [x] コンセプト設計
- [x] 類似プロジェクト調査（→ [docs/03-competitive-analysis.md](docs/03-competitive-analysis.md)）
- [x] 仕様書 v0.2（→ [docs/02-spec.md](docs/02-spec.md)）
- [x] **Phase 0：プロンプト検証**（条件付き合格 → [結果](docs/05-phase0-results.md)）
- [ ] **Phase 1：MVP**（← 現在ここ）
- [ ] Phase 2：蓄積価値（パターンDB・事件ファイル）
- [ ] Phase 3：磨き込み（演出・画像対応）

## ドキュメント

- [コンセプトと差別化](docs/01-concept.md)
- [仕様書 v0.2](docs/02-spec.md)
- [類似プロジェクト調査](docs/03-competitive-analysis.md)
- [Phase 0 検証計画](docs/04-phase0-plan.md)

## ライセンス

[MIT License](LICENSE)

---

**Retrace** — Your local AI detective that finds your lost things. Privacy-preserving, grows with your habits.
