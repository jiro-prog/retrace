// Shared domain + API types for Retrace MVP.
// Client references this file via tsconfig paths + Vite alias.

// ---------- Domain ----------
export type CaseStatus = 'investigating' | 'solved' | 'cold';
export type ClueLevel = 'scarce' | 'getting_closer' | 'core';

export interface Suspect {
  location: string;
  confidence: number;
}

export interface SuspectSnapshot extends Suspect {
  position: number;
  checked: boolean;
  result: 'found' | 'not_found' | null;
}

export interface Case {
  id: string;
  title: string;
  item: string;
  status: CaseStatus;
  createdAt: string;
  solvedAt?: string;
  foundLocation?: string;
  lastSeen: string;
  lastAction: string;
}

export interface Message {
  id: number;
  caseId: string;
  role: 'detective' | 'assistant';
  content: string;
  turnNumber: number;
  createdAt: string;
}

export interface CaseDetail extends Case {
  messages: Message[];
  suspects: SuspectSnapshot[];
  clueLevel: ClueLevel | null;
  latestTurn: number;
}

// ---------- REST API ----------
export interface CreateCaseRequest {
  item: string;
  lastSeen: string;
  lastAction: string;
}

export interface SolveCaseRequest {
  foundLocation: string;
}

export interface CheckSuspectRequest {
  location: string;
}

export interface CheckSuspectResponse {
  suspects: SuspectSnapshot[];
}

export interface CaseListItem {
  id: string;
  title: string;
  item: string;
  status: CaseStatus;
  createdAt: string;
  solvedAt?: string;
  foundLocation?: string;
}

// ---------- WebSocket ----------
export type WsClientMessage = {
  type: 'user_message';
  content: string;
};

export type WsServerMessage =
  | { type: 'thinking' }
  | {
      type: 'detective_response';
      dialogue: string;
      suspects: Suspect[];
      nextAction: string;
      clueLevel: ClueLevel;
      turnNumber: number;
    }
  | { type: 'error'; message: string; retryable: boolean };

// ---------- LLM raw output ----------
export interface DetectiveRawResponse {
  dialogue: string;
  suspects: Suspect[];
  next_action: string;
  clue_level: ClueLevel;
}
