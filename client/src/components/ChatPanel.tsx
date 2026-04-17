import { useEffect, useRef, useState } from 'react';
import type { ChatEntry } from '../hooks/useDetectiveWs.js';

interface Props {
  messages: ChatEntry[];
  thinking: boolean;
  error: string | null;
  disabled: boolean;
  onSend: (content: string) => void;
}

export function ChatPanel({ messages, thinking, error, disabled, onSend }: Props): JSX.Element {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const submit = (): void => {
    const t = input.trim();
    if (!t || thinking || disabled) return;
    onSend(t);
    setInput('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded px-3 py-2 text-sm ${
              m.role === 'detective'
                ? 'bg-black/50 border border-detective-accent/40 self-start'
                : 'bg-detective-accent/20 self-end'
            }`}
          >
            <div className="text-[10px] text-detective-dim mb-1">
              {m.role === 'detective' ? '久世 玄' : '助手（あなた）'}
            </div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {thinking && (
          <div className="self-start text-detective-dim text-xs italic">
            久世は思案している…
          </div>
        )}
        {error && (
          <div className="self-start bg-red-900/40 border border-red-400/40 rounded px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-detective-dim/30 p-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={disabled ? '事件は終了しています' : '久世に報告する…'}
          disabled={disabled || thinking}
          className="flex-1 bg-black/40 border border-detective-dim/40 rounded px-3 py-2 text-sm focus:outline-none focus:border-detective-accent disabled:opacity-40"
        />
        <button
          onClick={submit}
          disabled={disabled || thinking || !input.trim()}
          className="bg-detective-accent text-black font-bold px-4 rounded disabled:opacity-40"
        >
          送る
        </button>
      </div>
    </div>
  );
}
