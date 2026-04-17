import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useDetectiveWs } from '../hooks/useDetectiveWs.js';
import { useCaseStore } from '../stores/caseStore.js';
import type { Case, CaseDetail } from '@retrace/types';
import { CaseHeader } from './CaseHeader.js';
import { ChatPanel } from './ChatPanel.js';
import { SuspectList } from './SuspectList.js';

interface Props {
  caseId: string;
}

export function CaseInvestigate({ caseId }: Props): JSX.Element {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSolve, setShowSolve] = useState(false);
  const [showColdConfirm, setShowColdConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [foundLocation, setFoundLocation] = useState('');
  const [localStatus, setLocalStatus] = useState<Case['status'] | null>(null);
  const [extraChecked, setExtraChecked] = useState<string[]>([]);
  const backToList = useCaseStore((s) => s.backToList);

  const ws = useDetectiveWs(caseId);

  useEffect(() => {
    api
      .getCase(caseId)
      .then((d) => {
        setDetail(d);
        setLocalStatus(d.status);
        setExtraChecked([]);
      })
      .catch((e) => setLoadError(String(e)));
  }, [caseId]);

  if (loadError) {
    return (
      <div className="p-6">
        <p className="text-red-400">{loadError}</p>
        <button onClick={backToList} className="text-detective-accent underline mt-2">
          戻る
        </button>
      </div>
    );
  }

  if (!detail) {
    return <div className="p-6 text-detective-dim">読み込み中…</div>;
  }

  const effectiveStatus = localStatus ?? detail.status;
  const isActive = effectiveStatus === 'investigating';

  const solve = async (): Promise<void> => {
    const loc = foundLocation.trim();
    if (!loc) return;
    try {
      const updated = await api.solveCase(caseId, { foundLocation: loc });
      setLocalStatus(updated.status);
      setShowSolve(false);
    } catch (e) {
      setActionError(String(e));
    }
  };

  const confirmCold = async (): Promise<void> => {
    setShowColdConfirm(false);
    try {
      const updated = await api.coldCase(caseId);
      setLocalStatus(updated.status);
      backToList();
    } catch (e) {
      setActionError(String(e));
    }
  };

  // Seed chat with previously saved messages if reloading a case.
  // Simplest path: show them above live ws messages.
  const seedEntries = detail.messages.map((m) => ({
    role: m.role,
    content: m.content,
    turnNumber: m.turnNumber,
  }));

  // If we already have history, hide live initial reasoning duplicates.
  // The WS handler only triggers initial reasoning when no turns exist,
  // so a returning case will start with thinking=false and empty ws.messages.
  const combined =
    ws.messages.length > 0 || seedEntries.length === 0 ? [...seedEntries, ...ws.messages] : seedEntries;

  const suspects = ws.suspects.length > 0 ? ws.suspects : detail.suspects;
  const clueLevel = ws.clueLevel ?? detail.clueLevel;

  const checkedLocations = Array.from(
    new Set([
      ...detail.suspects.filter((s) => s.checked).map((s) => s.location),
      ...extraChecked,
    ]),
  );

  const handleCheck = async (location: string): Promise<void> => {
    if (checkedLocations.includes(location)) return;
    setExtraChecked((prev) => [...prev, location]);
    try {
      await api.checkSuspect(caseId, { location });
    } catch (e) {
      setExtraChecked((prev) => prev.filter((l) => l !== location));
      alert(String(e));
    }
  };

  return (
    <div className="h-full flex flex-col max-w-xl mx-auto w-full bg-black/20">
      <CaseHeader
        kase={{ ...detail, status: effectiveStatus }}
        clueLevel={clueLevel}
        onBack={backToList}
      />

      <SuspectList
        suspects={suspects}
        checkedLocations={checkedLocations}
        nextAction={ws.nextAction}
        disabled={!isActive}
        onCheck={handleCheck}
      />

      <ChatPanel
        messages={combined}
        thinking={ws.thinking}
        error={ws.error}
        disabled={!isActive}
        onSend={ws.sendMessage}
      />

      {isActive && (
        <div className="border-t border-detective-dim/30 p-2 flex gap-2">
          <button
            onClick={() => setShowSolve(true)}
            className="flex-1 bg-emerald-700 text-white text-sm py-2 rounded"
          >
            見つかった
          </button>
          <button
            onClick={() => setShowColdConfirm(true)}
            className="flex-1 bg-black/40 border border-detective-dim/40 text-detective-dim text-sm py-2 rounded"
          >
            諦める
          </button>
        </div>
      )}

      {effectiveStatus === 'solved' && (
        <div className="border-t border-emerald-600/40 p-4 text-center text-emerald-300">
          事件解決！お見事でした、助手殿。
        </div>
      )}

      {showSolve && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-detective-bg border border-detective-accent rounded p-4 w-full max-w-sm">
            <h3 className="font-bold mb-2">発見場所を記録</h3>
            <input
              type="text"
              value={foundLocation}
              onChange={(e) => setFoundLocation(e.target.value)}
              placeholder="例：コートのポケット"
              className="w-full bg-black/40 border border-detective-dim/40 rounded px-3 py-2 mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSolve(false)}
                className="flex-1 border border-detective-dim/40 py-2 rounded text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={solve}
                disabled={!foundLocation.trim()}
                className="flex-1 bg-detective-accent text-black font-bold py-2 rounded text-sm disabled:opacity-40"
              >
                記録する
              </button>
            </div>
          </div>
        </div>
      )}

      {showColdConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-detective-bg border border-detective-dim/40 rounded p-4 w-full max-w-sm">
            <h3 className="font-bold mb-2">迷宮入り</h3>
            <p className="text-sm text-detective-ink/80 mb-4">
              この事件を迷宮入りにしますか？後から見返すことはできます。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowColdConfirm(false)}
                className="flex-1 border border-detective-dim/40 py-2 rounded text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={confirmCold}
                className="flex-1 bg-black/40 border border-detective-dim/40 text-detective-dim font-bold py-2 rounded text-sm"
              >
                諦める
              </button>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-sm w-full mx-4 bg-red-900/90 border border-red-500/60 text-red-100 text-sm rounded px-3 py-2 flex items-start gap-2">
          <span className="flex-1">{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-red-200 hover:text-white"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
