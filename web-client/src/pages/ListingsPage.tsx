import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { NeighbourhoodSelect } from '../components/NeighbourhoodSelect.js';
import { useAuth } from '../context/AuthContext.js';


type ListingDoc = {
  _id: string;
  title: string;
  kind: string;
  category: string;
  pricePoints: number;
  status: string;
};

type ContractDoc = {
  _id: string;
  listingId: string;
  authorId: string;
  acceptorId: string;
  payerId: string;
  payeeId: string;
  pricePoints: number;
  status: 'pending' | 'completed' | 'cancelled';
  acceptedAt?: string;
  completedAt?: string | null;
  createdAt?: string;
};

type WalletBalance = {
  balance: number;
};

export function ListingsPage(): ReactElement {
  const { user } = useAuth();
  const { selectedId } = useNeighbourhoods();
  const [items, setItems] = useState<ListingDoc[]>([]);
  const [contracts, setContracts] = useState<ContractDoc[]>([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'offer' | 'request'>('offer');
  const [category, setCategory] = useState('services');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [pricePoints, setPricePoints] = useState('0');

  const load = useCallback(async () => {
    if (!selectedId) {
      setItems([]);
      return;
    }
    try {
	const [listingsRes, contractsRes, walletRes] = await Promise.all([
  apiFetch<{ items: ListingDoc[] }>(`/listings?neighbourhoodId=${selectedId}`),
  apiFetch<{ items: ContractDoc[] }>('/contracts/my'),
  apiFetch<WalletBalance>('/me/wallet'),
]);

setItems(listingsRes.items);
setContracts(contractsRes.items);
setBalance(walletRes.balance);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

const activeContracts = contracts.filter((contract) => contract.status === 'pending');

const completedContracts = contracts.filter((contract) => contract.status === 'completed');

function formatDate(value?: string | null): string {
  if (!value) return 'Date inconnue';

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function describeContractPoints(contract: ContractDoc): string {
  if (contract.pricePoints <= 0) {
    return 'Service gratuit';
  }

  if (contract.payerId === user?.sub) {
    return `Vous avez payé ${contract.pricePoints} pts`;
  }

  if (contract.payeeId === user?.sub) {
    return `Vous avez reçu ${contract.pricePoints} pts`;
  }

  return `${contract.pricePoints} pts`;
}

  async function create(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!selectedId) return;
    try {
await apiFetch('/listings', {
  method: 'POST',
  json: {
    neighbourhoodId: selectedId,
    title,
    description: '',
    kind,
    category,
    pricePoints: Number(pricePoints),
  },
});
setTitle('');
setCategory('services');
setPricePoints('0');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

async function accept(id: string): Promise<void> {
  try {
    setErr(null);

    const listing = items.find((item) => item._id === id);

    if (listing?.pricePoints && listing.pricePoints > 0) {
      const ok = window.confirm(
        `Ce service coûte ${listing.pricePoints} points. Voulez-vous continuer ?`,
      );

      if (!ok) {
        return;
      }
    }

    await apiFetch(`/listings/${id}/accept`, { method: 'POST' });
    setMsg('Service accepté.');
    await load();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur';

    if (message.includes('insufficient_funds')) {
      setErr('Solde insuffisant pour accepter ou terminer ce service.');
      return;
    }

    setErr(message);
  }
}

  async function cancel(id: string): Promise<void> {
    await apiFetch(`/listings/${id}/cancel`, { method: 'POST' });
    await load();
  }

async function completeService(id: string): Promise<void> {
  try {
    setErr(null);

    await apiFetch(`/contracts/${id}/complete`, { method: 'POST' });
    setMsg('Service terminé. Les points ont été transférés.');
    await load();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur';

    if (message.includes('insufficient_funds')) {
      setErr('Solde insuffisant : impossible de terminer ce service payant.');
      return;
    }

    if (message.includes('invalid_state')) {
      setErr('Ce service est déjà terminé ou ne peut plus être modifié.');
      return;
    }

    setErr(message);
  }
}

  return (
  <section className="panel">
    <h1 style={{ marginTop: 0 }}>Annonces</h1>

    <div className="stat-card">
      <strong>Mon solde</strong>
      <p style={{ fontSize: 24, margin: '8px 0' }}>
        {balance === null ? '—' : `${balance} pts`}
      </p>
    </div>

    <NeighbourhoodSelect />

    {!selectedId ? (
      <p className="muted">Sélectionnez un quartier.</p>
    ) : (
      <>
        <form className="inline-form" onSubmit={(e) => void create(e)}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            required
          />

          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'offer' | 'request')}
          >
            <option value="offer">Offre</option>
            <option value="request">Demande</option>
          </select>

          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Catégorie"
          />

          <input
            type="number"
            min="0"
            step="1"
            value={pricePoints}
            onChange={(e) => setPricePoints(e.target.value)}
            placeholder="Prix en points"
          />

          <button type="submit" className="primary">
            Créer
          </button>
        </form>

        {msg ? <p>{msg}</p> : null}
        {err ? <p className="error-msg">{err}</p> : null}

        <h2>Annonces disponibles</h2>

        {items.length === 0 ? (
          <p className="muted">Aucune annonce disponible.</p>
        ) : (
          <ul className="item-list">
            {items.map((l) => (
              <li key={l._id}>
                <strong>{l.title}</strong>

                <p className="muted">
                  {l.kind === 'offer' ? 'Offre' : 'Demande'} — {l.category || 'Sans catégorie'} —{' '}
                  {l.status}
                </p>

                <p className="muted">
                  {l.pricePoints && l.pricePoints > 0
                    ? `Service payant : ${l.pricePoints} pts`
                    : 'Service gratuit'}
                </p>

                <div className="row-actions">
                  {l.status === 'open' ? (
                    <>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void accept(l._id)}
                      >
                        Accepter
                      </button>

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void cancel(l._id)}
                      >
                        Annuler
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </>
    )}

    <h2>Mes services en cours</h2>

{activeContracts.length === 0 ? (
  <p className="muted">Aucun service en cours.</p>
) : (
  <ul className="item-list">
    {activeContracts.map((contract) => (
      <li key={contract._id}>
        <strong>Service en cours</strong>

        <p className="muted">
          Contrat {contract._id.slice(0, 8)} — {describeContractPoints(contract)}
        </p>

        <p className="muted">
          Accepté le {formatDate(contract.acceptedAt ?? contract.createdAt)}
        </p>

        <div className="row-actions">
          <button
            type="button"
            className="primary"
            onClick={() => void completeService(contract._id)}
          >
            Terminer le service
          </button>
        </div>
      </li>
    ))}
  </ul>
)}

<h2>Historique des services</h2>

{completedContracts.length === 0 ? (
  <p className="muted">Aucun service terminé.</p>
) : (
  <ul className="item-list">
    {completedContracts.map((contract) => (
      <li key={contract._id}>
        <strong>Service terminé</strong>

        <p className="muted">
          Contrat {contract._id.slice(0, 8)} — {describeContractPoints(contract)}
        </p>

        <p className="muted">
          Terminé le {formatDate(contract.completedAt)}
        </p>

        <span className="badge">Terminé</span>
      </li>
    ))}
  </ul>
)}
  </section>
);
}
