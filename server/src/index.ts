import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import { casesRoutes } from './routes/cases.js';
import { caseWsRoutes } from './ws/caseHandler.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.get('/api/health', async () => ({ ok: true }));

  await app.register(casesRoutes, { prefix: '/api' });
  await app.register(caseWsRoutes);

  await app.listen({ port: PORT, host: HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
