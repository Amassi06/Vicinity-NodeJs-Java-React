import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';

type Incident = {
  id: string;
  title: string;
  description?: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
};

export function IncidentsPage(): ReactElement {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Incident['severity']>('MEDIUM');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      const res = await apiFetch<{ items: Incident[] }>('/incidents/my');
      setIncidents(res.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur chargement incidents');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(ev: FormEvent): Promise<void> {
    ev.preventDefault();

    try {
      setErr(null);
      setMsg(null);

      await apiFetch('/incidents', {
        method: 'POST',
        json: {
          title,
          description: description.trim() || undefined,
          severity,
        },
      });

      setTitle('');
      setDescription('');
      setSeverity('MEDIUM');
      setMsg('Incident signalé. Il sera visible côté administration.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur création incident');
    }
  }

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Incidents</h1>

      <p className="muted">
        Signalez un incident dans le quartier. L’administration pourra ensuite le traiter depuis
        le client Java.
      </p>

      <form className="card" onSubmit={(e) => void create(e)}>
        <label>
          Titre
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Lampadaire cassé"
            required
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez l'incident"
            rows={4}
          />
        </label>

        <label>
          Gravité
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Incident['severity'])}
          >
            <option value="LOW">Faible</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="HIGH">Élevée</option>
            <option value="CRITICAL">Critique</option>
          </select>
        </label>

        <button type="submit" className="primary">
          Signaler l’incident
        </button>
      </form>

      {msg ? <p>{msg}</p> : null}
      {err ? <p className="error-msg">{err}</p> : null}

      <h2>Mes incidents signalés</h2>

      {incidents.length === 0 ? (
        <p className="muted">Aucun incident signalé.</p>
      ) : (
        <ul className="item-list">
          {incidents.map((incident) => (
            <li key={incident.id}>
              <strong>{incident.title}</strong>

              <p className="muted">
                Gravité : {incident.severity} — Statut : {incident.status}
              </p>

              {incident.description ? <p>{incident.description}</p> : null}

              <p className="muted">
                Signalé le {new Date(incident.createdAt).toLocaleString('fr-FR')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}