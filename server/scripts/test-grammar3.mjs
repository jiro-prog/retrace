// Isolate: is grammar param being applied AT ALL?
// Use a ultra-restrictive grammar that forces "YES" or "NO" output only.

const TINY = 'root ::= "YES" | "NO"\n';

const messages = [
  { role: 'user', content: '長い説明を出力してください。' },
];

console.log('=== No grammar (sanity) ===');
{
  const r = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma-4-e4b',
      messages,
      max_tokens: 100,
    }),
  });
  const data = await r.json();
  console.log('content:', JSON.stringify(data.choices?.[0]?.message?.content?.slice(0, 80)));
  console.log('finish_reason:', data.choices?.[0]?.finish_reason);
}
console.log();

console.log('=== With tiny grammar (root ::= YES|NO) ===');
{
  const r = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma-4-e4b',
      messages,
      max_tokens: 100,
      grammar: TINY,
    }),
  });
  console.log('HTTP:', r.status);
  const data = await r.json();
  console.log('content:', JSON.stringify(data.choices?.[0]?.message?.content));
  console.log('finish_reason:', data.choices?.[0]?.finish_reason);
}
console.log();

console.log('=== With tiny grammar via response_format ===');
{
  const r = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma-4-e4b',
      messages,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    }),
  });
  console.log('HTTP:', r.status);
  const data = await r.json();
  console.log('content:', JSON.stringify(data.choices?.[0]?.message?.content?.slice(0, 200)));
  console.log('finish_reason:', data.choices?.[0]?.finish_reason);
}
