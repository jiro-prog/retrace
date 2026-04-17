import type { Suspect } from '@retrace/types';

interface Props {
  suspects: Suspect[];
  checkedLocations: string[];
  nextAction: string;
  disabled: boolean;
  onCheck: (location: string) => void;
}

function sortSuspects(suspects: Suspect[]): Suspect[] {
  const others = suspects.filter((s) => s.location === 'その他');
  const rest = suspects.filter((s) => s.location !== 'その他');
  return [...rest, ...others];
}

export function SuspectList({
  suspects,
  checkedLocations,
  nextAction,
  disabled,
  onCheck,
}: Props): JSX.Element {
  const sorted = sortSuspects(suspects);

  return (
    <div className="border-b border-detective-dim/30 p-3">
      <h2 className="text-xs text-detective-accent mb-2">容疑者リスト</h2>
      <ul className="flex flex-col gap-2">
        {sorted.length === 0 && (
          <li className="text-detective-dim text-sm">推理を待っています…</li>
        )}
        {sorted.map((s) => {
          const checked = checkedLocations.includes(s.location);
          const isOther = s.location === 'その他';
          const showButton = !isOther && !checked && !disabled;
          return (
            <li key={s.location} className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`text-sm break-words flex-1 min-w-0 ${
                    checked ? 'line-through text-detective-dim' : ''
                  }`}
                >
                  {s.location}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="tabular-nums text-xs text-detective-dim">
                    {s.confidence}%
                  </span>
                  {showButton && (
                    <button
                      onClick={() => onCheck(s.location)}
                      className="text-[10px] text-detective-dim border border-detective-dim/40 rounded px-1.5 py-0.5 hover:text-detective-accent hover:border-detective-accent"
                    >
                      シロ
                    </button>
                  )}
                </div>
              </div>
              <div className="h-2 bg-black/40 rounded overflow-hidden">
                <div
                  className={`h-full ${checked ? 'bg-detective-dim' : 'bg-detective-accent'}`}
                  style={{ width: `${s.confidence}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {nextAction && (
        <p className="mt-3 text-xs text-detective-ink/80 bg-black/30 rounded p-2">
          <span className="text-detective-accent">次の行動：</span>
          {nextAction}
        </p>
      )}
    </div>
  );
}
