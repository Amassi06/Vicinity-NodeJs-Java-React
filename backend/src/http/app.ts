import express, { type Express } from 'express';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { neighbourhoodRouter } from './routes/neighbourhoods.js';
import { walletRouter } from './routes/wallet.js';
import { listingsRouter } from './routes/listings.js';
import { documentsRouter } from './routes/documents.js';
import { eventsRouter } from './routes/events.js';
import { messagesRouter } from './routes/messages.js';
import { pollsRouter } from './routes/polls.js';
import { dslRouter } from './routes/dsl.js';
import { gdprRouter } from './routes/gdpr.js';
import { pluginsRouter } from './routes/plugins.js';
import { mountOpenApiDocs } from './openapi.js';
import { incidentsRouter } from './routes/incidents.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  mountOpenApiDocs(app);
  app.use(healthRouter);
  app.use(authRouter);
  app.use(neighbourhoodRouter);
  app.use(walletRouter);
  app.use(listingsRouter);
  app.use(documentsRouter);
  app.use(eventsRouter);
  app.use(messagesRouter);
  app.use(pollsRouter);
  app.use(dslRouter);
  app.use(gdprRouter);
  app.use(pluginsRouter);
  app.use(incidentsRouter);
  return app;
}
