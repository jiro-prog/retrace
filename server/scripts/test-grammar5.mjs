// Try a rewritten grammar based on llama.cpp canonical json.gbnf style.
const REWRITE = `root ::= "{" ws
  "\\"dialogue\\":" ws string "," ws
  "\\"suspects\\":" ws suspects "," ws
  "\\"next_action\\":" ws string "," ws
  "\\"clue_level\\":" ws clue-level
  ws "}"

suspects ::= "[" ws suspect ws "," ws suspect ws "," ws suspect ws "," ws suspect ws "]"

suspect ::= "{" ws
  "\\"location\\":" ws string "," ws
  "\\"confidence\\":" ws number
  ws "}"

clue-level ::= "\\"scarce\\"" | "\\"getting_closer\\"" | "\\"core\\""

string ::= "\\"" (
    [^"\\\\\\x7F\\x00-\\x1F] |
    "\\\\" (["\\\\bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F])
  )* "\\""

number ::= "0" | [1-9] [0-9]? [0-9]?

ws ::= [ \\t\\n]*
`;

const messages = [
  { role: 'system', content: '必ずJSONで応答。dialogueは短く。' },
  { role: 'user', content: '鍵を失くしました。昨晩帰宅時、コートを脱いだ。' },
];

console.log('=== Rewritten grammar ===');
const r = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gemma-4-e4b',
    messages,
    temperature: 0.7,
    max_tokens: 1024,
    grammar: REWRITE,
  }),
});
const data = await r.json();
console.log('HTTP:', r.status);
console.log('finish_reason:', data.choices?.[0]?.finish_reason);
const raw = data.choices?.[0]?.message?.content ?? '';
console.log('len:', raw.length);
console.log('content:', raw);
if (data.error) console.log('ERROR:', JSON.stringify(data.error, null, 2));
try {
  const p = JSON.parse(raw);
  console.log('✅ Parsed. suspects.length =', p.suspects?.length, 'clue_level =', p.clue_level);
} catch (e) {
  console.log('❌', String(e));
}
