import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../auth/middleware.js';
import {
  createIncident,
  listIncidents,
  listMyIncidents,
  resolveIncident,
} from '../../incidents/service.js';

export const incidentsRouter: Router = Router();

const IncidentCreateSchema = z.object({
  localId: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

const UuidParam = z.object({
  id: z.string().uuid(),
});

incidentsRouter.get('/incidents/my', requireAuth, async (req, res) => {
  const incidents = await listMyIncidents(req.auth!.sub);
  res.status(200).json({ items: incidents });
});

incidentsRouter.post('/incidents', requireAuth, async (req, res) => {
  const parsed = IncidentCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid_input',
      issues: parsed.error.issues,
    });
    return;
  }

  const incident = await createIncident({
    title: parsed.data.title,
    severity: parsed.data.severity,
    reportedBy: req.auth!.sub,
    source: 'web',
    ...(parsed.data.description !== undefined
      ? { description: parsed.data.description }
      : {}),
  });

  res.status(201).json(incident);
});

incidentsRouter.get(
  '/admin/incidents',
  requireAuth,
  requireRole('ADMIN', 'MODERATOR'),
  async (_req, res) => {
    const incidents = await listIncidents();
    res.status(200).json(incidents);
  },
);

incidentsRouter.post(
  '/admin/incidents',
  requireAuth,
  requireRole('ADMIN', 'MODERATOR'),
  async (req, res) => {
    const parsed = IncidentCreateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_input',
        issues: parsed.error.issues,
      });
      return;
    }

const createInput = {
  title: parsed.data.title,
  severity: parsed.data.severity,
  reportedBy: req.auth!.sub,
  ...(parsed.data.description !== undefined
    ? { description: parsed.data.description }
    : {}),
  ...(parsed.data.localId !== undefined ? { localId: parsed.data.localId } : {}),
};

const incident = await createIncident(createInput);

      res.status(201).json(incident);
    },
  );

incidentsRouter.patch(
  '/admin/incidents/:id/resolve',
  requireAuth,
  requireRole('ADMIN', 'MODERATOR'),
  async (req, res) => {
    const params = UuidParam.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }

    try {
      const incident = await resolveIncident(params.data.id);
      res.status(200).json(incident);
    } catch {
      res.status(404).json({ error: 'not_found' });
    }
  },
);