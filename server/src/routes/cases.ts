import type { FastifyInstance } from 'fastify';
import {
  coldCase,
  createCase,
  getCaseDetail,
  listCases,
  markSuspectChecked,
  solveCase,
} from '../services/case.js';
import type {
  CaseStatus,
  CheckSuspectRequest,
  CreateCaseRequest,
  SolveCaseRequest,
} from '../types/index.js';

const nonEmptyString = { type: 'string', minLength: 1 } as const;

export async function casesRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateCaseRequest }>(
    '/cases',
    {
      schema: {
        body: {
          type: 'object',
          required: ['item', 'lastSeen', 'lastAction'],
          properties: {
            item: nonEmptyString,
            lastSeen: nonEmptyString,
            lastAction: nonEmptyString,
          },
        },
      },
    },
    async (req, reply) => {
      const created = createCase(req.body);
      reply.code(201);
      return created;
    },
  );

  app.get<{ Querystring: { status?: CaseStatus } }>(
    '/cases',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['investigating', 'solved', 'cold'] },
          },
        },
      },
    },
    async (req) => listCases(req.query.status),
  );

  app.get<{ Params: { id: string } }>('/cases/:id', async (req, reply) => {
    const detail = getCaseDetail(req.params.id);
    if (!detail) {
      reply.code(404);
      return { error: 'case not found' };
    }
    return detail;
  });

  app.patch<{ Params: { id: string }; Body: SolveCaseRequest }>(
    '/cases/:id/solve',
    {
      schema: {
        body: {
          type: 'object',
          required: ['foundLocation'],
          properties: { foundLocation: nonEmptyString },
        },
      },
    },
    async (req, reply) => {
      const updated = solveCase(req.params.id, req.body.foundLocation);
      if (!updated) {
        reply.code(404);
        return { error: 'case not found' };
      }
      return updated;
    },
  );

  app.patch<{ Params: { id: string } }>('/cases/:id/cold', async (req, reply) => {
    const updated = coldCase(req.params.id);
    if (!updated) {
      reply.code(404);
      return { error: 'case not found' };
    }
    return updated;
  });

  app.patch<{ Params: { id: string }; Body: CheckSuspectRequest }>(
    '/cases/:id/check-suspect',
    {
      schema: {
        body: {
          type: 'object',
          required: ['location'],
          properties: { location: nonEmptyString },
        },
      },
    },
    async (req, reply) => {
      const snapshot = markSuspectChecked(req.params.id, req.body.location);
      if (!snapshot) {
        reply.code(404);
        return { error: 'case or suspect location not found' };
      }
      return { suspects: snapshot };
    },
  );
}
