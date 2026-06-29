import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware.js';
import {
  ListingCreateSchema,
  ListingListQuerySchema,
} from '../../listings/schemas.js';
import {
  acceptListing,
  cancelListing,
  completeContract,
  createListing,
  deleteListing,
  getListing,
  listListings,
} from '../../listings/service.js';

export const listingsRouter: Router = Router();

const IdParam = z.object({ id: z.string().min(1) });

function parseId(req: Request): string | null {
  const parsed = IdParam.safeParse(req.params);
  return parsed.success ? parsed.data.id : null;
}

listingsRouter.get('/listings', requireAuth, async (req, res) => {
  const parsed = ListingListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', issues: parsed.error.issues });
    return;
  }
  const items = await listListings(parsed.data);
  res.json({ items });
});

listingsRouter.post('/listings', requireAuth, async (req, res) => {
  const parsed = ListingCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    return;
  }
  const listing = await createListing(req.auth!.sub, parsed.data);
  res.status(201).json(listing);
});

listingsRouter.get('/listings/:id', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  const listing = await getListing(id);
  if (!listing) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(listing);
});

listingsRouter.post('/listings/:id/cancel', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const updated = await cancelListing(id, req.auth!.sub);
    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    const status = message === 'forbidden' ? 403 : 409;
    res.status(status).json({ error: message });
  }
});

listingsRouter.post('/listings/:id/accept', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const result = await acceptListing(id, req.auth!.sub);
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    const statusByCode: Record<string, number> = {
      not_found: 404,
      invalid_state: 409,
      cannot_accept_own_listing: 409,
      already_accepted: 409,
      insufficient_funds: 402,
    };
    res.status(statusByCode[message] ?? 400).json({ error: message });
  }
});

listingsRouter.post('/contracts/:id/complete', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const updated = await completeContract(id, req.auth!.sub);
    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(updated);
    } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    const statusByCode: Record<string, number> = {
      forbidden: 403,
      invalid_state: 409,
      listing_not_found: 404,
      invalid_listing_state: 409,
      insufficient_funds: 402,
    };
    res.status(statusByCode[message] ?? 400).json({ error: message });
  }
});

listingsRouter.delete('/listings/:id', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const ok = await deleteListing(id, req.auth!.sub);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    const status = message === 'forbidden' ? 403 : 409;
    res.status(status).json({ error: message });
  }
});
