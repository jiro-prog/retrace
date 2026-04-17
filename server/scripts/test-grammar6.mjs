// Approach 1: file-based GBNF (avoids escaping errors)
// Approach 2: llama.cpp response_format json_schema
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRAMMAR_V2 = readFileSync(resolve(__dirname, './retrace-v2.gbnf'), 'utf8');

const messages = [
  { role: 'system', content: '必ずJSONで応答。dialogueは短く。' },
  { role: 'user', content: '鍵を失くしました。昨晩帰宅時、コートを脱いだ。' },
];

async function post(body, label) {
  console.log(`=== ${label} ===`);
  const r = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  console.log('HTTP:', r.status, 'finish_reason:', data.choices?.[0]?.finish_reason);
  if (data.error) console.log('ERROR:', JSON.stringify(data.error));
  const raw = data.choices?.[0]?.message?.content ?? '';
  console.log('content:', raw.slice(0, 500));
  try {
    const p = JSON.parse(raw);
    console.log(`✅ Parsed. keys = ${Object.keys(p).join(',')} suspects.len = ${p.suspects?.length}`);
  } catch (e) {
    console.log('❌', String(e).slice(0, 80));
  }
  console.log();
}

console.log('grammar v2 size:', GRAMMAR_V2.length, 'bytes');

await post({
  model: 'gemma-4-e4b',
  messages,
  temperature: 0.7,
  max_tokens: 1024,
  grammar: GRAMMAR_V2,
}, 'A: file-based GBNF via grammar param');

// llama.cpp json_schema via response_format
const JSON_SCHEMA = {
  type: 'object',
  required: ['dialogue', 'suspects', 'next_action', 'clue_level'],
  properties: {
    dialogue: { type: 'string' },
    suspects: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        required: ['location', 'confidence'],
        properties: {
          location: { type: 'string' },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
    },
    next_action: { type: 'string' },
    clue_level: { type: 'string', enum: ['scarce', 'getting_closer', 'core'] },
  },
};

await post({
  model: 'gemma-4-e4b',
  messages,
  temperature: 0.7,
  max_tokens: 1024,
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'retrace', schema: JSON_SCHEMA, strict: true },
  },
}, 'B: response_format json_schema (OpenAI spec)');

// llama.cpp also supports json_schema as a top-level parameter directly
await post({
  model: 'gemma-4-e4b',
  messages,
  temperature: 0.7,
  max_tokens: 1024,
  json_schema: JSON_SCHEMA,
}, 'C: top-level json_schema (llama.cpp native)');
