import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes.js';
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await registerRoutes(app);
const port = Number(process.env.PORT ?? 4301);
await app.listen({ port, host: '0.0.0.0' });
