// Is the retrace grammar file the problem?
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FULL = readFileSync(
  resolve(__dirname, '../../experiments/phase0-prompt/grammars/retrace-response.gbnf'),
  'utf8',
);

// Strip comments and blank lines
const STRIPPED = FULL.split('\n')
  .filter((l) => !l.trim().startsWith('#') && l.trim().length > 0)
  .join('\n');

const messages = [
  { role: 'system', content: '必ずJSONで応答してください。' },
  { role: 'user', content: '鍵を失くしました。昨晩帰宅時、コートを脱いだ。' },
];

async function test(label, grammar) {
  console.log(`=== ${label} ===`);
  const r = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma-4-e4b',
      messages,
      temperature: 0.7,
      max_tokens: 1024,
      grammar,
    }),
  });
  const data = await r.json();
  console.log('HTTP:', r.status);
  console.log('finish_reason:', data.choices?.[0]?.finish_reason);
  const raw = data.choices?.[0]?.message?.content ?? '';
  console.log('len:', raw.length);
  console.log('content:', raw.slice(0, 300));
  if (data.error) console.log('ERROR:', JSON.stringify(data.error));
  console.log();
  return raw;
}

console.log('Full grammar has comment lines?', FULL.includes('#'));
console.log('Stripped size:', STRIPPED.length, 'vs full:', FULL.length);
console.log();

await test('A: full grammar (with comments)', FULL);
await test('B: stripped grammar (no comments)', STRIPPED);

// Minimal retrace-like grammar
const MINIMAL = `root ::= "{" ws "\\"ok\\":" ws "true" ws "}"
ws ::= [ \\t\\n]*`;
await test('C: minimal {ok:true} grammar', MINIMAL);
