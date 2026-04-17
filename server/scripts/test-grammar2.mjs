// Deeper diagnostics for grammar transparency
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRAMMAR = readFileSync(
  resolve(__dirname, '../../experiments/phase0-prompt/grammars/retrace-response.gbnf'),
  'utf8',
);

const messages = [
  {
    role: 'system',
    content: '必ずJSONで応答してください。',
  },
  { role: 'user', content: '鍵を失くしました。昨晩帰宅時、コートを脱いだところ。' },
];

console.log('=== Test A: fetch direct, grammar, max_tokens=2048 ===');
try {
  const r = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma-4-e4b',
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      grammar: GRAMMAR,
    }),
  });
  const data = await r.json();
  console.log('HTTP:', r.status);
  console.log('finish_reason:', data.choices?.[0]?.finish_reason);
  console.log('usage:', JSON.stringify(data.usage));
  const raw = data.choices?.[0]?.message?.content ?? '';
  console.log('len:', raw.length);
  console.log('Response:', raw);
  try {
    const parsed = JSON.parse(raw);
    console.log('✅ Parsed OK. suspects.length =', parsed.suspects?.length);
  } catch (e) {
    console.log('❌ Parse failed:', String(e));
  }
} catch (e) {
  console.log('❌ Fetch failed:', String(e));
}
console.log();

console.log('=== Test B: openai SDK, grammar as top-level ===');
const client = new OpenAI({
  baseURL: 'http://127.0.0.1:8080/v1',
  apiKey: 'dummy',
});
try {
  const res = await client.chat.completions.create({
    model: 'gemma-4-e4b',
    messages,
    temperature: 0.7,
    max_tokens: 2048,
    grammar: GRAMMAR,
  });
  console.log('finish_reason:', res.choices[0]?.finish_reason);
  const raw = res.choices[0]?.message?.content ?? '';
  console.log('len:', raw.length);
  console.log('Response:', raw);
} catch (e) {
  console.log('❌ SDK failed:', String(e));
  console.log('  stack:', e?.stack?.split('\n').slice(0, 3).join('\n'));
}
