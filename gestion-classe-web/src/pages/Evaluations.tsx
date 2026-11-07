import { useCallback, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { CarnetTab } from '../components/CarnetTab';

/**
 * Évaluations = le carnet de notes (classe × trimestre). Tout ce qui concerne UNE éval
 * (sujet, corrigé, copies, validation, publication, réglages, statistiques) est sur sa fiche,
 * /evaluations/:id, ouverte depuis le nom de la colonne (cf. PLAN_ergonomie_evaluations.md).
 */
export function Evaluations() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const handleError = useCallback((message: string) => setError(message), []);

  return (
    <Layout fluid>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">
          Évaluations
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Toutes les notes d’une classe sur un trimestre, saisie au clavier. Le nom d’une colonne ouvre la fiche de l’éval.
        </p>
      </div>

      {error && (
        <div style={{ background: 'var(--neg-soft)', color: 'var(--neg)', padding: '8px 12px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--neg)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <CarnetTab userId={user?.id ?? ''} account={user?.email ?? ''} onError={handleError} />
    </Layout>
  );
}
