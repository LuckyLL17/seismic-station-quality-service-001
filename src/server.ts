import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes.js';
import { STATION_SWEEP_INTERVAL_MS, sweepOfflineStations } from './store.js';
const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await registerRoutes(app);
const sweeper = setInterval(() => {
  const events = sweepOfflineStations();
  for (const event of events) app.log.info({ event }, '台站失联');
}, STATION_SWEEP_INTERVAL_MS);
sweeper.unref();
app.addHook('onClose', async () => { clearInterval(sweeper); });
const port = Number(process.env.PORT ?? 4301);
await app.listen({ port, host: '0.0.0.0' });
