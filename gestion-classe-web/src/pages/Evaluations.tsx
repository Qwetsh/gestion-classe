import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { CarnetTab } from '../components/CarnetTab';
import { AssessmentDetail, StageChip } from '../components/AssessmentDetail';
import { groupAssessments, groupStage, hasCopies, hasCopyContent, type AssessmentGroup } from '../lib/assessmentGroups';
import type { CopyOverview } from '../lib/copyStatus';
import {
  fetchAssessments,
  fetchClasses,
  createAssessment,
  fetchCopyOverviews,
  type AssessmentRow,
  type ClassRow,
} from '../lib/evaluationQueries';

type Tab = 'carnet' | 'eval';

export function Evaluations() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('carnet');

  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  /** Classe dont on regarde les copies scannées (une série en compte plusieurs). */
  const [copyClassAssessmentId, setCopyClassAssessmentId] = useState<string | null>(null);
  /** État des copies par éval (scannée, corrigée…) et début de la séance liée. */
  const [overviews, setOverviews] = useState<Record<string, CopyOverview>>({});
  const [sessionStarts, setSessionStarts] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Création d'une éval depuis le web
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBareme, setFormBareme] = useState('20');
  const [creating, setCreating] = useState(false);

  const handleError = useCallback((message: string) => setError(message), []);

  const loadAssessments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await fetchAssessments(user.id);
      setAssessments(rows);
      // L'état des copies ne concerne que l'écrit ; il n'empêche pas d'afficher la liste.
      fetchCopyOverviews(rows.filter(hasCopies))
        .then((d) => {
          setOverviews(d.overviews);
          setSessionStarts(d.sessionStarts);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'État des copies indisponible'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  useEffect(() => {
    if (user) fetchClasses(user.id).then(setClasses).catch(() => {});
  }, [user]);

  const openCreate = () => {
    setFormName('');
    setFormSubject('');
    setFormBareme('20');
    setFormClassId(classes[0]?.id ?? '');
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!user) return;
    const name = formName.trim();
    if (!name) { setError('Donne un nom à l’évaluation.'); return; }
    if (!formClassId) { setError('Choisis une classe.'); return; }
    const bareme = parseFloat(formBareme.replace(',', '.'));
    setCreating(true);
    try {
      const created = await createAssessment({
        userId: user.id,
        classId: formClassId,
        name,
        subject: formSubject.trim() || null,
        baremeTotal: Number.isFinite(bareme) && bareme > 0 ? bareme : 20,
      });
      setShowCreate(false);
      await loadAssessments();
      setSelectedKey(`solo:${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible');
    } finally {
      setCreating(false);
    }
  };

  const groups = useMemo(() => groupAssessments(assessments), [assessments]);
  const selected = useMemo(
    () => groups.find((g) => g.key === selectedKey) ?? null,
    [groups, selectedKey],
  );

  const selectGroup = (g: AssessmentGroup) => {
    setSelectedKey(g.key);
    // On ouvre directement les copies d'une classe qui en a ; sinon rien n'est chargé.
    setCopyClassAssessmentId(g.items.find((a) => hasCopyContent(overviews[a.id]))?.id ?? null);
  };

  return (
    <Layout fluid>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Évaluations
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          {tab === 'carnet'
            ? 'Toutes les notes d’une classe sur un trimestre, saisie au clavier.'
            : 'Sujets, corrigés, copies scannées et notes par élève.'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {([['carnet', 'Carnet'], ['eval', 'Éval']] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              color: tab === id ? 'var(--indigo)' : 'var(--text-muted)',
              borderBottom: tab === id ? '2px solid var(--indigo)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: 'var(--neg-soft)', color: 'var(--neg)', padding: '8px 12px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--neg)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {tab === 'carnet' && <CarnetTab userId={user?.id ?? ''} account={user?.email ?? ''} onError={handleError} />}

      {tab === 'eval' && (
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* ---- Liste des évals ---- */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {groups.length} évaluation{groups.length > 1 ? 's' : ''}
            </span>
            <button onClick={openCreate} style={{ ...btnPrimary, padding: '5px 10px', fontSize: 12 }}>
              + Nouvelle
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Chargement…</div>
          ) : groups.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
              Aucune évaluation. Clique « + Nouvelle » pour en créer une (puis ajoute le sujet/corrigé,
              et scanne les copies depuis l’app mobile).
            </div>
          ) : (
            groups.map((g) => {
              const isSel = selectedKey === g.key;
              const first = g.items[0];
              const classNames = g.items.map((a) => a.classes?.name ?? '—').join(', ');
              return (
                <button
                  key={g.key}
                  onClick={() => selectGroup(g)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 16px', border: 'none', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: isSel ? 'var(--indigo-soft)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{g.name}</span>
                    {(() => {
                      const st = groupStage(g, overviews);
                      return st ? <StageChip stage={st} /> : null;
                    })()}
                    {g.items.length > 1 && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: 'var(--indigo)',
                        background: 'var(--indigo-soft)', borderRadius: 999, padding: '1px 7px',
                      }}>
                        {g.items.length} classes
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {classNames}{first.subject ? ` · ${first.subject}` : ''} · /{first.bareme_total ?? 20}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ---- Détail ---- */}
        <div>
          {!selected || !user ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
              Sélectionne une évaluation pour voir le sujet, le corrigé, les copies et les notes.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* En-tête : l'éval et les classes qui la passent */}
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  {selected.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {selected.items.map((a) => a.classes?.name ?? '—').join(', ')}
                  {selected.items.length > 1 ? ' · sujet et corrigé communs' : ''}
                </div>
              </div>

              <AssessmentDetail
                group={selected}
                overviews={overviews}
                sessionStarts={sessionStarts}
                userId={user.id}
                openId={copyClassAssessmentId}
                onOpen={setCopyClassAssessmentId}
                onError={handleError}
                onReload={loadAssessments}
                sheetLink
              />
            </div>
          )}
        </div>
      </div>
      )}

      {/* Modale création d'éval */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: 440, maxWidth: '92vw', boxShadow: 'var(--shadow-2)' }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              Nouvelle évaluation
            </h3>

            <label style={lbl}>Nom</label>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Éval Nutrition" style={inp} />

            <label style={lbl}>Classe</label>
            {classes.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Aucune classe trouvée.
              </div>
            ) : (
              <select value={formClassId} onChange={(e) => setFormClassId(e.target.value)} style={inp}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Matière</label>
                <input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="SVT" style={inp} />
              </div>
              <div style={{ width: 110 }}>
                <label style={lbl}>Barème</label>
                <input value={formBareme} onChange={(e) => setFormBareme(e.target.value)} inputMode="decimal" placeholder="20" style={inp} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowCreate(false)} style={btnGhost}>Annuler</button>
              <button onClick={handleCreate} disabled={creating || classes.length === 0} style={{ ...btnPrimary, opacity: creating || classes.length === 0 ? 0.6 : 1 }}>
                {creating ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '12px 0 4px',
};
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14,
};

const btnBase: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', border: '1px solid transparent',
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo)', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
