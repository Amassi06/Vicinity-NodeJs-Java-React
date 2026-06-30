import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type WalletBalance = {
  balance: number;
};

type PointTransaction = {
  id?: string;
  _id?: string;
  amount: number;
  reason: string;
  createdAt: string;
  fromUserId?: string | null;
  toUserId?: string | null;
  listingId?: string | null;
  contractId?: string | null;
};

export function WalletPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function loadWallet() {
    try {
      setErr(null);

      const balanceRes = await apiFetch<WalletBalance>('/me/wallet');
      setBalance(balanceRes.balance);

      const txRes = await apiFetch<{ items: PointTransaction[] }>(
        '/me/wallet/transactions',
      );
      setTransactions(txRes.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur chargement portefeuille');
    }
  }

  useEffect(() => {
    void loadWallet();
  }, []);

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Portefeuille de points</h1>

      {err && <p className="error">{err}</p>}

      <div className="stat-card">
        <strong>Solde actuel</strong>
        <p style={{ fontSize: 32, margin: '8px 0' }}>
          {balance === null ? '—' : `${balance} pts`}
        </p>
      </div>

      <div className="row-actions">
        <button type="button" onClick={() => void loadWallet()}>
          Rafraîchir
        </button>
      </div>

      <h2>Historique des transactions</h2>

      {transactions.length === 0 ? (
        <p className="muted">Aucune transaction pour le moment.</p>
      ) : (
        <ul className="item-list">
          {transactions.map((tx) => (
            <li key={tx.id ?? tx._id}>
              <strong>
                {tx.amount > 0 ? '+' : ''}
                {tx.amount} pts
              </strong>
              <p className="muted">
                {tx.reason} — {new Date(tx.createdAt).toLocaleString()}
              </p>
              {(tx.listingId || tx.contractId) && (
                <p className="muted">
                  {tx.listingId ? `Annonce : ${tx.listingId}` : ''}
                  {tx.contractId ? ` · Contrat : ${tx.contractId}` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}