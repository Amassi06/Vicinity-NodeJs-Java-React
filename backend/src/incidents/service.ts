import { prisma } from '../db/prisma.js';

export type CreateIncidentInput = {
  title: string;
  description?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  localId?: string;
  reportedBy?: string;
};

export async function listIncidents() {
  return prisma.incident.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function createIncident(input: CreateIncidentInput) {
  return prisma.incident.create({
    data: {
      title: input.title,
      severity: input.severity,
      description: input.description ?? null,
      localId: input.localId ?? null,
      reportedBy: input.reportedBy ?? null,
    },
  });
}

export async function resolveIncident(id: string) {
  return prisma.incident.update({
    where: { id },
    data: { status: 'RESOLVED' },
  });
}