import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../auth/middleware.js';
import {
  creditPoints,
  getWallet,
  listWalletTransactions,
} from '../../wallet/service.js';

export const walletRouter: Router = Router();

walletRouter.get('/me/wallet', requireAuth, async (req, res) => {
  const wallet = await getWallet(req.auth!.sub);
  res.json(wallet);
});

walletRouter.get('/me/wallet/transactions', requireAuth, async (req, res) => {
  const transactions = await listWalletTransactions(req.auth!.sub);
  res.json({ items: transactions });
});

const AdminCreditSchema = z.object({
  toUserId: z.string().uuid(),
  amount: z.number().int().positive().max(100_000),
  reason: z.enum(['WELCOME_BONUS', 'ADMIN_ADJUSTMENT', 'REFUND']),
});

walletRouter.post(
  '/admin/wallet/credit',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    const parsed = AdminCreditSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
      return;
    }
    try {
      await creditPoints(parsed.data);
      res.status(204).end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      const status = message === 'recipient_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  },
);
