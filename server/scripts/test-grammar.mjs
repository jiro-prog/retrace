// U1 verification: does openai v4 SDK forward the `grammar` param to llama.cpp?
// Run: node scripts/test-grammar.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRAMMAR = readFileSync(
  resolve(__dirname, '../../experiments/phase0-prompt/grammars/retrace-response.gbnf'),
  'utf8',
);

const client = new OpenAI({
  baseURL: 'http://127.0.0.1:8080/v1',
  apiKey: 'dummy',
});

const messages = [
  {
    role: 'system',
    content: '必ず以下のJSONだけで応答してください。{"dialogue":"...","suspects":[{"location":"...","confidence":数},{"location":"...","confidence":数},{"location":"...","confidence":数},{"location":"その他","confidence":数}],"next_action":"...","clue_level":"scarce"}',
  },
  { role: 'user', content: '鍵を失くしました。昨晩帰宅時です。コートを脱いだところ。' },
];

console.log('=== Test 1: WITHOUT grammar (baseline) ===');
const res1 = await client.chat.completions.create({
  model: 'gemma-4-e4b',
  messages,
  temperature: 0.7,
  max_tokens: 512,
});
console.log('Response:', res1.choices[0]?.message?.content?.slice(0, 400));
console.log();

console.log('=== Test 2: WITH grammar as top-level param ===');
try {
  const res2 = await client.chat.completions.create({
    model: 'gemma-4-e4b',
    messages,
    temperature: 0.7,
    max_tokens: 512,
    grammar: GRAMMAR,
  });
  const raw = res2.choices[0]?.message?.content ?? '';
  console.log('Response:', raw.slice(0, 400));
  try {
    const parsed = JSON.parse(raw);
    console.log('✅ Parsed OK. suspects.length =', parsed.suspects?.length);
  } catch (e) {
    console.log('❌ Parse failed:', String(e));
  }
} catch (e) {
  console.log('❌ Request failed:', String(e));
}
console.log();

console.log('=== Test 3: WITH grammar via extra_body-style raw fetch ===');
try {
  const r = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma-4-e4b',
      messages,
      temperature: 0.7,
      max_tokens: 512,
      grammar: GRAMMAR,
    }),
  });
  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  console.log('Response:', raw.slice(0, 400));
  try {
    const parsed = JSON.parse(raw);
    console.log('✅ Parsed OK. suspects.length =', parsed.suspects?.length);
  } catch (e) {
    console.log('❌ Parse failed:', String(e));
  }
} catch (e) {
  console.log('❌ Fetch failed:', String(e));
}
