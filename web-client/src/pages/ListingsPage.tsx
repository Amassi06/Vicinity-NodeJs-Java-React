import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { NeighbourhoodSelect } from '../components/NeighbourhoodSelect.js';

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
  pricePoints: number;
  status: string;
};

export function ListingsPage(): ReactElement {
  const { selectedId } = useNeighbourhoods();
  const [items, setItems] = useState<ListingDoc[]>([]);
  const [contracts, setContracts] = useState<ContractDoc[]>([]);
  const [contractId, setContractId] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'offer' | 'request'>('offer');
  const [category, setCategory] = useState('services');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setItems([]);
      return;
    }
    try {
      const [listingsRes, contractsRes] = await Promise.all([
  apiFetch<{ items: ListingDoc[] }>(`/listings?neighbourhoodId=${selectedId}`),
  apiFetch<{ items: ContractDoc[] }>('/contracts/my'),
]);

setItems(listingsRes.items);
setContracts(contractsRes.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!selectedId) return;
    try {
      await apiFetch('/listings', {
        method: 'POST',
        json: {
          neighbourhoodId: selectedId,
          title,
          kind,
          category,
          pricePoints: 0,
        },
      });
      setTitle('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function accept(id: string): Promise<void> {
    const res = await apiFetch<{ contract: { _id: string } }>(`/listings/${id}/accept`, {
      method: 'POST',
    });
    setContractId(String(res.contract._id));
    setMsg(`Contrat créé : ${res.contract._id}`);
    await load();
  }

  async function cancel(id: string): Promise<void> {
    await apiFetch(`/listings/${id}/cancel`, { method: 'POST' });
    await load();
  }

  async function completeContract(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!contractId.trim()) return;
    await apiFetch(`/contracts/${contractId.trim()}/complete`, { method: 'POST' });
    setMsg('Contrat finalisé.');
    await load();
  }

  async function completeService(id: string): Promise<void> {
  try {
    await apiFetch(`/contracts/${id}/complete`, { method: 'POST' });
    setMsg('Service terminé.');
    await load();
  } catch (e) {
    setErr(e instanceof Error ? e.message : 'Erreur');
  }
}

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Annonces</h1>
      <NeighbourhoodSelect />
      {!selectedId ? (
        <p className="muted">Sélectionnez un quartier.</p>
      ) : (
        <>
          <form className="inline-form" onSubmit={(e) => void create(e)}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" required />
            <select value={kind} onChange={(e) => setKind(e.target.value as 'offer' | 'request')}>
              <option value="offer">Offre</option>
              <option value="request">Demande</option>
            </select>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Catégorie" />
            <button type="submit" className="primary">
              Créer
            </button>
          </form>
          <form className="inline-form" onSubmit={(e) => void completeContract(e)}>
            <input
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              placeholder="ID contrat à finaliser"
            />
            <button type="submit" className="secondary">
              Finaliser contrat
            </button>
          </form>
          {msg ? <p>{msg}</p> : null}
          {err ? <p className="error-msg">{err}</p> : null}
          <ul className="item-list">
            {items.map((l) => (
              <li key={l._id}>
                <strong>{l.title}</strong> ({l.kind}, {l.status}) — {l.pricePoints} pts
                <div className="row-actions">
                  {l.status === 'open' ? (
                    <>
                      <button type="button" className="secondary" onClick={() => void accept(l._id)}>
                        Accepter
                      </button>
                      <button type="button" className="secondary" onClick={() => void cancel(l._id)}>
                        Annuler
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <h2>Mes services en cours</h2>
        {contracts.filter((c) => c.status === 'pending').length === 0 ? (
          <p className="muted">Aucun service en cours.</p>
        ) : (
          <ul className="item-list">
            {contracts
              .filter((c) => c.status === 'pending')
              .map((c) => (
                <li key={c._id}>
                  <strong>Contrat {c._id}</strong> — {c.pricePoints} pts
                  <div className="row-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => void completeService(c._id)}>
                      Terminer le service
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
    </section>
  );
}
