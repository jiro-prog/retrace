// End-to-end smoke: create case, run initial reasoning via WS,
// send 2 user messages, check a suspect, solve, verify persistence.

import WebSocket from 'ws';

const API = 'http://127.0.0.1:3000';

async function http(path, init) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

console.log('1. Create case');
const created = await http('/api/cases', {
  method: 'POST',
  body: JSON.stringify({
    item: '鍵',
    lastSeen: '昨日の夜、帰宅した時',
    lastAction: 'コートを脱いで手を洗った',
  }),
});
console.log('   →', created.id, created.title);
const caseId = created.id;

console.log('2. Open WS and wait for initial reasoning');
const ws = new WebSocket(`ws://127.0.0.1:3000/ws/cases/${caseId}`);
const turns = [];

function waitForDetectiveResponse(label) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), 120000);
    ws.once('error', (e) => { clearTimeout(timeout); reject(e); });
    const onMessage = (buf) => {
      const msg = JSON.parse(String(buf));
      if (msg.type === 'thinking') {
        process.stdout.write('   thinking...');
        return;
      }
      if (msg.type === 'detective_response') {
        process.stdout.write(' ok\n');
        clearTimeout(timeout);
        ws.off('message', onMessage);
        resolve(msg);
      }
      if (msg.type === 'error') {
        process.stdout.write(' ERROR\n');
        clearTimeout(timeout);
        ws.off('message', onMessage);
        reject(new Error(msg.message));
      }
    };
    ws.on('message', onMessage);
  });
}

await new Promise((resolve) => ws.once('open', resolve));
console.log('   WS connected. Waiting for initial reasoning...');
const t1 = await waitForDetectiveResponse('initial');
turns.push(t1);
console.log(`   turn ${t1.turnNumber}: ${t1.dialogue}`);
console.log(`   suspects:`, t1.suspects.map(s => `${s.location}=${s.confidence}`).join(', '));
console.log(`   clue: ${t1.clueLevel}, next: ${t1.nextAction.slice(0, 60)}`);

console.log('3. Send user message 1');
ws.send(JSON.stringify({ type: 'user_message', content: 'コートのポケットを確認しましたがありませんでした。' }));
const t2 = await waitForDetectiveResponse('turn2');
turns.push(t2);
console.log(`   turn ${t2.turnNumber}: ${t2.dialogue}`);
console.log(`   suspects:`, t2.suspects.map(s => `${s.location}=${s.confidence}`).join(', '));

console.log('4. Mark "コートのポケット" as checked via REST');
try {
  const checkRes = await http(`/api/cases/${caseId}/check-suspect`, {
    method: 'PATCH',
    body: JSON.stringify({ location: 'コートのポケット' }),
  });
  console.log('   checked →', checkRes.suspects.map(s => `${s.location}=${s.confidence}${s.checked ? ' (✓)' : ''}`).join(', '));
} catch (e) {
  console.log('   (no "コートのポケット" in suspects — skipping check test)');
  console.log('   err:', String(e).slice(0, 200));
}

console.log('5. Send user message 2');
ws.send(JSON.stringify({ type: 'user_message', content: '玄関の棚も見ましたが、ありません。' }));
const t3 = await waitForDetectiveResponse('turn3');
turns.push(t3);
console.log(`   turn ${t3.turnNumber}: ${t3.dialogue}`);
console.log(`   suspects:`, t3.suspects.map(s => `${s.location}=${s.confidence}`).join(', '));
console.log(`   next: ${t3.nextAction.slice(0, 60)}`);

console.log('6. Solve');
const solved = await http(`/api/cases/${caseId}/solve`, {
  method: 'PATCH',
  body: JSON.stringify({ foundLocation: 'ジャケットの内ポケット' }),
});
console.log('   →', solved.status, solved.foundLocation);

console.log('7. Reload detail to verify persistence');
const detail = await http(`/api/cases/${caseId}`);
console.log(`   messages: ${detail.messages.length}, suspects snapshot: ${detail.suspects.length} (turn ${detail.latestTurn})`);
console.log('   status:', detail.status, 'found:', detail.foundLocation);
console.log('   last turn checked flags:', detail.suspects.map(s => `${s.location}=${s.checked ? '✓' : '-'}`).join(', '));

ws.close();
console.log('\n✅ Playthrough complete');
