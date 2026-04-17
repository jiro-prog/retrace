import { useState } from 'react';
import { api } from '../api.js';
import { useCaseStore } from '../stores/caseStore.js';

export function CaseCreate(): JSX.Element {
  const [item, setItem] = useState('');
  const [lastSeen, setLastSeen] = useState('');
  const [lastAction, setLastAction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openCase = useCaseStore((s) => s.openCase);
  const backToList = useCaseStore((s) => s.backToList);

  const canSubmit = item.trim() && lastSeen.trim() && lastAction.trim() && !submitting;

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createCase({
        item: item.trim(),
        lastSeen: lastSeen.trim(),
        lastAction: lastAction.trim(),
      });
      openCase(created.id);
    } catch (e) {
      setError(String(e));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col p-6 max-w-xl mx-auto w-full">
      <button
        onClick={backToList}
        className="text-detective-accent text-sm self-start mb-4 hover:underline"
      >
        ← 事件ファイルへ戻る
      </button>
      <h1 className="text-2xl font-bold mb-2">新規依頼</h1>
      <p className="text-detective-dim mb-6">
        助手殿、何を失くされましたか。3つの質問にお答えください。
      </p>

      <label className="block mb-4">
        <span className="text-detective-accent text-sm">失くしたもの</span>
        <input
          type="text"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="例：鍵、イヤホン、財布"
          className="w-full mt-1 bg-black/40 border border-detective-dim/40 rounded px-3 py-2 focus:outline-none focus:border-detective-accent"
        />
      </label>

      <label className="block mb-4">
        <span className="text-detective-accent text-sm">最後に見た記憶</span>
        <input
          type="text"
          value={lastSeen}
          onChange={(e) => setLastSeen(e.target.value)}
          placeholder="例：昨日の夜、帰宅した時"
          className="w-full mt-1 bg-black/40 border border-detective-dim/40 rounded px-3 py-2 focus:outline-none focus:border-detective-accent"
        />
      </label>

      <label className="block mb-6">
        <span className="text-detective-accent text-sm">その時に何をしていたか</span>
        <textarea
          value={lastAction}
          onChange={(e) => setLastAction(e.target.value)}
          placeholder="例：コートを脱いで手を洗った"
          rows={3}
          className="w-full mt-1 bg-black/40 border border-detective-dim/40 rounded px-3 py-2 focus:outline-none focus:border-detective-accent"
        />
      </label>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="bg-detective-accent text-black font-bold py-3 rounded disabled:opacity-40"
      >
        {submitting ? '依頼中…' : '探偵に依頼する'}
      </button>
    </div>
  );
}
