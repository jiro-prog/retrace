import type { FastifyInstance } from 'fastify';
import {
  getCase,
  getCheckedLocations,
  getLatestTurnNumber,
  getRecentMessages,
  saveTurnAtomic,
} from '../services/case.js';
import {
  DetectiveParseError,
  runDetectiveTurn,
} from '../services/detective.js';
import type { WsClientMessage, WsServerMessage } from '../types/index.js';

// Minimal shape for the `ws` WebSocket exposed by @fastify/websocket. We don't
// ship @types/ws (CLAUDE.md: no extra deps), so we assert this structural type
// once at the handler boundary instead of double-casting inline.
type WsConn = {
  send: (data: string) => void;
  on: (ev: string, fn: (...a: unknown[]) => void) => void;
  close: () => void;
};

function send(conn: WsConn, msg: WsServerMessage): void {
  conn.send(JSON.stringify(msg));
}

async function runTurn(conn: WsConn, caseId: string, userContent: string | null): Promise<void> {
  const kase = getCase(caseId);
  if (!kase) {
    send(conn, { type: 'error', message: 'case not found', retryable: false });
    return;
  }

  send(conn, { type: 'thinking' });

  const prevTurn = getLatestTurnNumber(caseId);
  const nextTurn = prevTurn + 1;

  // Defer all DB writes until after the LLM call succeeds. If it fails, nothing
  // is persisted and the user can retry with the same nextTurn number.
  const recent = getRecentMessages(caseId, 10);
  const checked = getCheckedLocations(caseId);

  try {
    const result = await runDetectiveTurn(kase, recent, userContent, checked);

    saveTurnAtomic(caseId, nextTurn, userContent, {
      dialogue: result.dialogue,
      rawJson: result.rawJson,
      suspects: result.suspects,
      clueLevel: result.clueLevel,
    });

    send(conn, {
      type: 'detective_response',
      dialogue: result.dialogue,
      suspects: result.suspects,
      nextAction: result.nextAction,
      clueLevel: result.clueLevel,
      turnNumber: nextTurn,
    });
  } catch (err) {
    const msg = err instanceof DetectiveParseError ? err.message : String(err);
    send(conn, {
      type: 'error',
      message: `推理に失敗しました: ${msg}`,
      retryable: true,
    });
  }
}

export async function caseWsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>(
    '/ws/cases/:id',
    { websocket: true },
    (socket, req) => {
      const caseId = (req.params as { id: string }).id;
      const kase = getCase(caseId);
      const conn = socket as unknown as WsConn;

      if (!kase) {
        send(conn, { type: 'error', message: 'case not found', retryable: false });
        conn.close();
        return;
      }

      // Serialize turns per connection. UI already blocks sends during thinking;
      // this guards against raw clients (wscat) that could otherwise race two
      // runTurn calls to the same nextTurn number.
      let inFlight = false;
      const runGuarded = async (userContent: string | null): Promise<void> => {
        if (inFlight) {
          send(conn, { type: 'error', message: '推理中です。完了後に再送してください', retryable: true });
          return;
        }
        inFlight = true;
        try {
          await runTurn(conn, caseId, userContent);
        } finally {
          inFlight = false;
        }
      };

      // If no turns yet, run initial reasoning on connect.
      const prevTurn = getLatestTurnNumber(caseId);
      if (prevTurn === 0) {
        void runGuarded(null);
      }

      conn.on('message', (buffer: unknown) => {
        let parsed: WsClientMessage;
        try {
          parsed = JSON.parse(String(buffer)) as WsClientMessage;
        } catch {
          send(conn, { type: 'error', message: 'invalid JSON', retryable: false });
          return;
        }
        if (parsed.type === 'user_message' && typeof parsed.content === 'string') {
          void runGuarded(parsed.content);
        } else {
          send(conn, { type: 'error', message: 'unknown message type', retryable: false });
        }
      });
    },
  );
}
