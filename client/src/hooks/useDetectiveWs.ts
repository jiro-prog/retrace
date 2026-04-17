import { useEffect, useRef, useState } from 'react';
import type {
  ClueLevel,
  Suspect,
  WsClientMessage,
  WsServerMessage,
} from '@retrace/types';

export interface ChatEntry {
  role: 'detective' | 'assistant';
  content: string;
  turnNumber: number;
}

export interface DetectiveWsState {
  connected: boolean;
  thinking: boolean;
  messages: ChatEntry[];
  suspects: Suspect[];
  clueLevel: ClueLevel | null;
  nextAction: string;
  error: string | null;
  sendMessage: (content: string) => void;
}

const MAX_RECONNECT = 3;

export function useDetectiveWs(caseId: string | null): DetectiveWsState {
  const [connected, setConnected] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [clueLevel, setClueLevel] = useState<ClueLevel | null>(null);
  const [nextAction, setNextAction] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingUserRef = useRef<string | null>(null);
  const reconnectRef = useRef(0);

  useEffect(() => {
    if (!caseId) return;

    let cancelled = false;

    const connect = (): void => {
      if (cancelled) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws/cases/${caseId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectRef.current = 0;
        // Clear any stale in-flight state from a prior connection. If the server's
        // inference on the old socket completed after disconnect, its response was
        // lost — the new socket will never flip thinking back to false otherwise.
        setThinking(false);
        pendingUserRef.current = null;
      };

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as WsServerMessage;
        if (msg.type === 'thinking') {
          setThinking(true);
          return;
        }
        if (msg.type === 'detective_response') {
          setThinking(false);
          setSuspects(msg.suspects);
          setClueLevel(msg.clueLevel);
          setNextAction(msg.nextAction);
          setMessages((prev) => {
            // The user bubble was added optimistically on send. Backfill its
            // turnNumber now that the server has assigned one, and append the
            // detective reply.
            const updated = [...prev];
            if (pendingUserRef.current !== null) {
              const lastIdx = updated.length - 1;
              const last = updated[lastIdx];
              if (last && last.role === 'assistant' && last.turnNumber === -1) {
                updated[lastIdx] = { ...last, turnNumber: msg.turnNumber };
              }
              pendingUserRef.current = null;
            }
            updated.push({
              role: 'detective',
              content: msg.dialogue,
              turnNumber: msg.turnNumber,
            });
            return updated;
          });
          return;
        }
        if (msg.type === 'error') {
          setThinking(false);
          setError(msg.message);
          // Roll back the optimistic user bubble so the UI reflects that
          // nothing was persisted. Matches the server's B2 invariant.
          if (pendingUserRef.current !== null) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant' && last.turnNumber === -1) {
                return prev.slice(0, -1);
              }
              return prev;
            });
            pendingUserRef.current = null;
          }
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (cancelled) return;
        if (reconnectRef.current < MAX_RECONNECT) {
          const delay = 500 * 2 ** reconnectRef.current;
          reconnectRef.current += 1;
          setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        setError('接続エラー');
      };
    };

    connect();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [caseId]);

  const sendMessage = (content: string): void => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('接続されていません');
      return;
    }
    // Optimistically add the user bubble so the sender sees their input
    // during the inference wait. turnNumber=-1 is a sentinel the response
    // handler backfills, or the error handler rolls back.
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content, turnNumber: -1 },
    ]);
    pendingUserRef.current = content;
    const payload: WsClientMessage = { type: 'user_message', content };
    ws.send(JSON.stringify(payload));
    setThinking(true);
  };

  return {
    connected,
    thinking,
    messages,
    suspects,
    clueLevel,
    nextAction,
    error,
    sendMessage,
  };
}
