import OpenAI from 'openai';
import type {
  Case,
  ClueLevel,
  DetectiveRawResponse,
  Message,
  Suspect,
} from '../types/index.js';
import { buildMessages } from './prompt.js';

const LLAMA_BASE_URL = process.env.LLAMA_BASE_URL ?? 'http://127.0.0.1:8080/v1';
const MODEL = process.env.LLAMA_MODEL ?? 'gemma-4-e4b';

const client = new OpenAI({
  baseURL: LLAMA_BASE_URL,
  apiKey: 'dummy',
});

// Mirrors DetectiveRawResponse. Passed to llama.cpp via response_format.json_schema
// to force structurally-valid output at the decoder level.
const DETECTIVE_JSON_SCHEMA = {
  type: 'object',
  required: ['dialogue', 'suspects', 'next_action', 'clue_level'],
  properties: {
    dialogue: { type: 'string' },
    suspects: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        required: ['location', 'confidence'],
        properties: {
          location: { type: 'string' },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
    },
    next_action: { type: 'string' },
    clue_level: { type: 'string', enum: ['scarce', 'getting_closer', 'core'] },
  },
} as const;

const MAX_RETRIES = 2;

export class DetectiveParseError extends Error {
  constructor(message: string, public lastRaw: string) {
    super(message);
    this.name = 'DetectiveParseError';
  }
}

export function parseDetectiveResponse(raw: string): DetectiveRawResponse {
  const parsed = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('dialogue' in parsed) ||
    !('suspects' in parsed) ||
    !('next_action' in parsed) ||
    !('clue_level' in parsed)
  ) {
    throw new Error('missing required fields');
  }
  const p = parsed as DetectiveRawResponse;
  if (!Array.isArray(p.suspects) || p.suspects.length !== 4) {
    throw new Error('suspects must be length 4');
  }
  return p;
}

export function normalizeConfidence(
  suspects: Suspect[],
  checkedLocations: string[],
): Suspect[] {
  const zeroed = suspects.map((s) =>
    checkedLocations.includes(s.location) ? { ...s, confidence: 0 } : s,
  );

  const sum = zeroed.reduce((acc, s) => acc + s.confidence, 0);
  if (sum === 0) return zeroed;

  const scaled = zeroed.map((s) =>
    s.confidence > 0
      ? { ...s, confidence: Math.round((s.confidence / sum) * 100) }
      : s,
  );

  const total = scaled.reduce((acc, s) => acc + s.confidence, 0);
  const diff = 100 - total;
  if (diff !== 0) {
    let maxIdx = 0;
    let maxVal = -1;
    scaled.forEach((s, i) => {
      if (s.confidence > maxVal) {
        maxVal = s.confidence;
        maxIdx = i;
      }
    });
    scaled[maxIdx] = { ...scaled[maxIdx], confidence: scaled[maxIdx].confidence + diff };
  }

  return scaled;
}

async function callLlama(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'retrace_detective',
        schema: DETECTIVE_JSON_SCHEMA,
        strict: true,
      },
    },
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('empty response from llama.cpp');
  return content;
}

export interface DetectiveTurnResult {
  dialogue: string;
  suspects: Suspect[];
  nextAction: string;
  clueLevel: ClueLevel;
  rawJson: string;
}

export async function runDetectiveTurn(
  kase: Case,
  recent: Message[],
  nextUserContent: string | null,
  checkedLocations: string[],
): Promise<DetectiveTurnResult> {
  const messages = buildMessages(kase, recent, nextUserContent);

  let lastRaw = '';
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await callLlama(messages);
      lastRaw = raw;
      const parsed = parseDetectiveResponse(raw);
      const normalizedSuspects = normalizeConfidence(parsed.suspects, checkedLocations);
      return {
        dialogue: parsed.dialogue,
        suspects: normalizedSuspects,
        nextAction: parsed.next_action,
        clueLevel: parsed.clue_level,
        rawJson: raw,
      };
    } catch (err) {
      lastErr = err;
    }
  }

  throw new DetectiveParseError(
    `detective call failed after ${MAX_RETRIES + 1} attempts: ${String(lastErr)}`,
    lastRaw,
  );
}
