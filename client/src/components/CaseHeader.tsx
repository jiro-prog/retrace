import type { Case, ClueLevel } from '@retrace/types';

function clueLabel(c: ClueLevel | null): string {
  if (c === 'scarce') return '手がかり乏しい';
  if (c === 'getting_closer') return '絞り込み中';
  if (c === 'core') return '核心に迫る';
  return '捜査開始前';
}

interface Props {
  kase: Case;
  clueLevel: ClueLevel | null;
  onBack: () => void;
}

export function CaseHeader({ kase, clueLevel, onBack }: Props): JSX.Element {
  return (
    <header className="border-b border-detective-dim/30 p-3 flex items-center gap-3">
      <button
        onClick={onBack}
        className="text-detective-accent text-sm hover:underline"
      >
        ←
      </button>
      <div className="flex-1">
        <h1 className="font-bold">{kase.title}</h1>
        <p className="text-xs text-detective-dim">
          {kase.status === 'investigating' ? clueLabel(clueLevel) : kase.status}
        </p>
      </div>
    </header>
  );
}
