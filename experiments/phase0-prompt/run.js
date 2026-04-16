#!/usr/bin/env node
/**
 * Phase 0 プロンプト検証スクリプト
 *
 * 使い方：
 *   1. llama.cpp serverを別ターミナルで起動しておく
 *      C:\Users\sojir\projects\llama.cpp\bin\llama-server.exe ^
 *        -m C:\Users\sojir\projects\models\google_gemma-4-E4B-it-Q4_K_M.gguf ^
 *        --host 127.0.0.1 --port 8080 ^
 *        --ctx-size 8192 --n-gpu-layers 999
 *
 *   2. node run.js <シナリオ番号>
 *      例：node run.js 1
 *
 *   3. 結果は results/YYYY-MM-DD_scenario-N.md に保存される
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LLAMA_ENDPOINT = 'http://127.0.0.1:8080/v1/chat/completions';
const GBNF_PATH = path.join(__dirname, 'grammars', 'retrace-response.gbnf');

// システムプロンプトを読み込む（実際はprompts/から抽出）
const SYSTEM_PROMPT = `
あなたは名探偵「久世 玄（くぜ げん）」。
自宅内の失くし物を推理で解決する専門家です。
ユーザーはあなたの助手（ワトソン役）。「助手殿」と呼んでください。

## 話し方
- 落ち着いた知的な語り口（です・ます調）
- 「ふむ」「なるほど」を適度に挟む
- 失礼にならない範囲で軽い皮肉を入れてよい

## 推理の方針
- 即断せず、最低3ターンは情報を集める
- 容疑者リストは必ず4項目（具体的な場所3つ＋「その他」）
- 助手の報告を受けて確度を必ず更新する
- 時々、他の探偵が聞かないような「意外な質問」を挟む

## 確度のルール
- 4項目の合計が100になるようにする

## 出力形式
必ず以下のJSON形式だけで応答してください：
{
  "dialogue": "探偵の発言",
  "suspects": [
    {"location": "場所名", "confidence": 数値}
  ],
  "next_action": "助手への次の指示",
  "clue_level": "scarce" | "getting_closer" | "core"
}
`.trim();

// テストシナリオ（簡易版、本番はscenarios.mdから抽出）
const SCENARIOS = {
  1: {
    name: '鍵',
    initial: '鍵が見つかりません。昨日の夜、帰宅した時が最後に見た記憶です。コートを脱いで手を洗いました。',
  },
  2: {
    name: 'イヤホン',
    initial: 'ワイヤレスイヤホンが見つかりません。今朝の通勤で使ったのが最後です。電車を降りてカバンを開けて、何か取り出した気がします。',
  },
  // 追加は必要に応じて
};

async function callLlama(messages, grammar) {
  const res = await fetch(LLAMA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma-4-e4b',
      messages,
      temperature: 0.7,
      max_tokens: 512,
      grammar,
    }),
  });
  if (!res.ok) {
    throw new Error(`llama.cpp server error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

async function main() {
  const scenarioId = process.argv[2];
  if (!scenarioId || !SCENARIOS[scenarioId]) {
    console.error('Usage: node run.js <scenario_id>');
    console.error('Available scenarios:', Object.keys(SCENARIOS).join(', '));
    process.exit(1);
  }

  const scenario = SCENARIOS[scenarioId];
  console.log(`\n=== シナリオ${scenarioId}：${scenario.name} ===\n`);
  console.log(`依頼文：${scenario.initial}\n`);

  const grammar = await fs.readFile(GBNF_PATH, 'utf-8');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: scenario.initial },
  ];

  // 1ターン目
  console.log('--- ターン1 ---');
  const turn1 = await callLlama(messages, grammar);
  console.log(turn1);

  let parsed;
  try {
    parsed = JSON.parse(turn1);
    console.log('\n✅ JSONパース成功');
    console.log('容疑者:', parsed.suspects);
    console.log('手がかり:', parsed.clue_level);
  } catch (e) {
    console.error('\n❌ JSONパース失敗:', e.message);
    return;
  }

  messages.push({ role: 'assistant', content: turn1 });

  // ターン2（最も疑わしい容疑者を確認した結果を送る）
  const topSuspect = parsed.suspects.sort((a, b) => b.confidence - a.confidence)[0];
  const turn2Input = `${topSuspect.location}を確認しました。ありませんでした。`;
  console.log(`\n--- ターン2（入力：${turn2Input}） ---`);
  messages.push({ role: 'user', content: turn2Input });

  const turn2 = await callLlama(messages, grammar);
  console.log(turn2);

  messages.push({ role: 'assistant', content: turn2 });

  // 結果をファイルに保存
  const date = new Date().toISOString().split('T')[0];
  const outputPath = path.join(
    'results',
    `${date}_scenario-${scenarioId}_gemma-e4b.md`
  );

  const output = `# シナリオ${scenarioId}：${scenario.name}

## 実行日時
${new Date().toISOString()}

## 使用モデル
Gemma 4 E4B (Q4_K_M) via llama.cpp server

## temperature
0.7

## 依頼文
${scenario.initial}

## ターン1応答
\`\`\`json
${turn1}
\`\`\`

## ターン2応答（${topSuspect.location}を確認した結果を報告）
\`\`\`json
${turn2}
\`\`\`

## 評価（手動記入）
- JSON構造：
- キャラ一貫性（5段階）：
- 推理の妥当性：
- 意外な質問：
- 所感：
`;

  await fs.mkdir('results', { recursive: true });
  await fs.writeFile(outputPath, output, 'utf-8');
  console.log(`\n結果を保存：${outputPath}`);
}

main().catch((e) => {
  console.error('実行エラー:', e);
  process.exit(1);
});
