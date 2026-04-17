import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useCaseStore } from '../stores/caseStore.js';
import type { CaseListItem, CaseStatus } from '@retrace/types';

function statusLabel(s: CaseStatus): string {
  if (s === 'investigating') return '捜査中';
  if (s === 'solved') return '解決';
  return '迷宮入り';
}

function statusColor(s: CaseStatus): string {
  if (s === 'investigating') return 'text-detective-accent';
  if (s === 'solved') return 'text-emerald-400';
  return 'text-detective-dim';
}

export function CaseList(): JSX.Element {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setView = useCaseStore((s) => s.setView);
  const openCase = useCaseStore((s) => s.openCase);

  useEffect(() => {
    setLoading(true);
    api
      .listCases()
      .then((cs) => {
        setCases(cs);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full flex flex-col p-6 max-w-xl mx-auto w-full">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">事件ファイル</h1>
        <button
          onClick={() => setView('create')}
          className="bg-detective-accent text-black font-bold px-4 py-2 rounded"
        >
          新規依頼
        </button>
      </header>

      {loading && <p className="text-detective-dim">読み込み中…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && cases.length === 0 && (
        <p className="text-detective-dim">
          まだ事件はありません。右上から依頼してください。
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {cases.map((c) => (
          <li
            key={c.id}
            onClick={() => openCase(c.id)}
            className="bg-black/40 border border-detective-dim/30 rounded p-4 cursor-pointer hover:border-detective-accent"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{c.title}</h2>
              <span className={`text-xs ${statusColor(c.status)}`}>
                {statusLabel(c.status)}
              </span>
            </div>
            <p className="text-detective-dim text-xs mt-1">
              {new Date(c.createdAt).toLocaleString('ja-JP')}
              {c.foundLocation && ` ・ 発見場所：${c.foundLocation}`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
