import { z } from 'zod';

export const ListingCreateSchema = z.object({
  neighbourhoodId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().optional(),
  kind: z.enum(['offer', 'request']),
  category: z.string().min(1),
  pricePoints: z.number().int().min(0).max(100000).default(0),
});
export type ListingCreateInput = z.infer<typeof ListingCreateSchema>;

export const ListingListQuerySchema = z.object({
  neighbourhoodId: z.string().uuid().optional(),
  kind: z.enum(['offer', 'request']).optional(),
  category: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'closed', 'cancelled']).optional(),
});

export type ListingListQuery = z.infer<typeof ListingListQuerySchema>;
