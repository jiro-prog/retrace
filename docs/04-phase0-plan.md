# 04. Phase 0：プロンプト検証計画

## 目的

**Retraceの土台が成立するかを最小コストで検証する。**

成立しなければ仕様ごと見直し。Phase 1（MVP実装）に進む前の必須関門。

## 検証する3つの仮説

1. **Gemma 4 E4B（Q4_K_M）が「探偵っぽい日本語対話」を成立させられる**
2. **GBNF Grammarによる容疑者リストJSON出力が安定する**
3. **推理の質がゲーム体験として成立する**（浅すぎず、暴走せず）

## 作業場所

`experiments/phase0-prompt/`配下で完結させる。

```
experiments/phase0-prompt/
├── prompts/
│   └── detective-system-prompt.md
├── grammars/
│   └── retrace-response.gbnf
├── test-cases/
│   └── scenarios.md
├── run.sh                   # 実行スクリプト
└── results/                 # 出力ログ（日付入り）
    └── YYYY-MM-DD_gemma-e4b.md
```

## ステップ1：環境準備

**前提**：llama.cpp serverは既にWindows上でビルド済み（CUDA動作確認済み）と想定。

作業：
1. Gemma 4 E4B（Q4_K_M）のGGUFダウンロード（Hugging Face unsloth/bartowski等から）
2. llama-server起動確認：
   ```bash
   ./llama-server \
     -m models/gemma-4-e4b-it-Q4_K_M.gguf \
     --host 127.0.0.1 \
     --port 8080 \
     --ctx-size 8192 \
     --n-gpu-layers 999 \
     --chat-template gemma
   ```
3. `/v1/chat/completions` にcurlで疎通確認

## ステップ2：テストケース準備

`test-cases/scenarios.md`に5〜10件の典型シナリオを用意（同ディレクトリ参照）。

## ステップ3：プロンプトとGrammar配置

`prompts/detective-system-prompt.md`と`grammars/retrace-response.gbnf`を配置。

## ステップ4：検証実行

### A. 1ターン応答品質
- 各シナリオの依頼文を与え、最初の探偵応答を取得
- 5〜10ケース流してログ保存

### B. マルチターン対話
- 依頼→探偵応答→「その場所確認したけどなかった」→次の推理…を3〜5ターン繰り返す
- 推理が更新されるか、確度が動くか、対話が成立するか確認

## ステップ5：評価

| 項目 | 合格ライン | 評価方法 |
|---|---|---|
| JSON出力の安定性 | 95%以上がパース成功 | `JSON.parse`で検証 |
| キャラ一貫性 | 5/10で「久世 玄らしさ」保持 | 目視 |
| 推理の妥当性 | 人間の直感と半分以上合致 | 目視 |
| 対話の継続性 | 3ターン以上自然に続く | 目視 |
| 意外な質問 | 10ケース中2〜3回は光る質問 | 目視 |

**1項目でも致命的に低ければ、モデル変更（Qwen 3.5 9B、ELYZA等）かプロンプト再設計。**

## 想定される落とし穴

### 1. Gemma 4 E4Bの日本語キャラ演技力が薄い
- 対処：Qwen 3.5 9Bへ切替、またはSarashina / Llama-3-ELYZA系を試す

### 2. GBNF Grammarの構文エラー
- llama.cppのGBNF構文は独特
- 公式：https://github.com/ggerganov/llama.cpp/blob/master/grammars/README.md
- `schema_to_grammar.py`でJSON Schemaから自動生成も可能

### 3. 推理がテンプレ的になる
- 「カバンを確認してください」「机の上は？」で終わる凡庸パターン
- 対処：プロンプトに「意外な質問の例」を2〜3個埋め込む

### 4. 確度（confidence）が意味的に変
- 合計が100にならない、特定場所に偏る等
- 対処：プロンプトで「4つの合計が100になるように」と明示
- または後処理で正規化

### 5. VRAM管理
- `nvidia-smi`で使用量を並行監視
- 8GB VRAMで余裕あるか確認。厳しければ`-ngl`を調整

## 次のアクション

Phase 0クリア後：
- Phase 1（MVP実装）の詳細設計書作成
- `.claude/agents/`にarchitect.md、implementer.mdを配置
- GitHubリポジトリPublic化、SNS初告知
