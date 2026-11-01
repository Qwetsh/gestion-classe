import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { CarnetTab } from '../components/CarnetTab';
import { CopyViewer } from '../components/CopyViewer';
import { COPY_STAGE_LABEL, describeCopyOverview, type CopyOverview, type CopyStage } from '../lib/copyStatus';
import { docxToPdf, isDocx } from '../lib/docConvert';
import {
  fetchAssessments,
  fetchClasses,
  createAssessment,
  fetchCopyOverviews,
  getDocUrl,
  uploadAssessmentDoc,
  deleteAssessmentDoc,
  uploadSeriesDoc,
  deleteSeriesDoc,
  clearSeriesAssessmentDocs,
  effectiveDocPath,
  type AssessmentRow,
  type ClassRow,
  type AssessmentDocKind,
} from '../lib/evaluationQueries';

const STAGE_ORDER: CopyStage[] = ['vide', 'scan', 'scannee', 'corrigee', 'validee', 'publiee'];

const STAGE_COLORS: Record<CopyStage, [string, string]> = {
  vide: ['var(--surface-3)', 'var(--text-dim)'],
  scan: ['var(--warn-soft)', 'var(--warn)'],
  scannee: ['var(--indigo-soft)', 'var(--indigo)'],
  corrigee: ['var(--warn-soft)', 'var(--warn)'],
  validee: ['var(--pos-soft)', 'var(--pos)'],
  publiee: ['var(--pos)', '#fff'],
};

function StageChip({ stage, title }: { stage: CopyStage; title?: string }) {
  const [bg, fg] = STAGE_COLORS[stage];
  return (
    <span title={title} style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 7px', background: bg, color: fg, whiteSpace: 'nowrap' }}>
      {COPY_STAGE_LABEL[stage]}
    </span>
  );
}

function formatSession(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Une évaluation telle que le prof la pense : *un* devoir, même s'il existe une ligne
 * par classe en base. Les lignes d'une même série sont donc repliées en une seule
 * entrée ; le sujet et le corrigé sont communs, seules les copies sont par classe.
 */
interface AssessmentGroup {
  key: string;
  name: string;
  /** NULL pour une éval d'une seule classe, créée hors série. */
  seriesId: string | null;
  /** Une entrée par classe, triée par nom de classe. */
  items: AssessmentRow[];
}

function groupAssessments(rows: AssessmentRow[]): AssessmentGroup[] {
  const map = new Map<string, AssessmentGroup>();
  for (const a of rows) {
    const key = a.series_id ? `series:${a.series_id}` : `solo:${a.id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: a.assessment_series?.name ?? a.name,
        seriesId: a.series_id,
        items: [],
      });
    }
    map.get(key)!.items.push(a);
  }
  for (const g of map.values()) {
    g.items.sort((x, y) => (x.classes?.name ?? '').localeCompare(y.classes?.name ?? ''));
  }
  return [...map.values()];
}

/**
 * Étape d'une éval repliée sur plusieurs classes : la moins avancée des classes qui ont
 * des copies (une série n'est « scannée » que si toutes ses classes le sont).
 */
function groupStage(group: AssessmentGroup, overviews: Record<string, CopyOverview>): CopyStage | null {
  const stages = group.items
    .map((a) => overviews[a.id])
    .filter((o): o is CopyOverview => !!o && (o.stage !== 'vide' || o.scanned > 0))
    .map((o) => o.stage);
  if (stages.length === 0) return null;
  return stages.reduce((min, st) => (STAGE_ORDER.indexOf(st) < STAGE_ORDER.indexOf(min) ? st : min));
}

/** Chemin du document à afficher pour un groupe : celui de la série, sinon celui de l'éval. */
function groupDocPath(group: AssessmentGroup, kind: AssessmentDocKind): string | null {
  const series = group.items[0]?.assessment_series ?? null;
  if (group.seriesId && series) {
    const shared = kind === 'subject' ? series.subject_path : series.correction_path;
    if (shared) return shared;
  }
  for (const a of group.items) {
    const own = effectiveDocPath(a, kind);
    if (own) return own;
  }
  return null;
}

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
  const [uploading, setUploading] = useState<AssessmentDocKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Création d'une éval depuis le web
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBareme, setFormBareme] = useState('20');
  const [creating, setCreating] = useState(false);

  const handleError = useCallback((message: string) => setError(message), []);

  const subjectInputRef = useRef<HTMLInputElement>(null);
  const correctionInputRef = useRef<HTMLInputElement>(null);

  const loadAssessments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await fetchAssessments(user.id);
      setAssessments(rows);
      // L'état des copies ne concerne que l'écrit ; il n'empêche pas d'afficher la liste.
      fetchCopyOverviews(rows.filter((a) => a.kind === 'ecrit' || a.kind === 'dm'))
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
    setCopyClassAssessmentId(g.items.find((a) => (overviews[a.id]?.scanned ?? 0) > 0)?.id ?? null);
  };

  const openDoc = async (path: string) => {
    const url = await getDocUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  const handleFile = async (kind: AssessmentDocKind, file: File | undefined) => {
    if (!file || !user || !selected) return;

    // Le stockage ne contient que des PDF ou des images : l'élève comme le prof ouvrent
    // toujours un format lisible sans Word. Un .docx doit donc être converti — mais la
    // conversion faite dans le navigateur (mammoth + jsPDF) ne garde que la STRUCTURE du
    // document : colonnes, zones de texte et position des images sont perdues. Word, lui,
    // exporte un PDF parfait en un clic. On le dit, plutôt que de rendre une fiche illisible.
    if (isDocx(file.name)) {
      const ok = window.confirm(
        [
          `« ${file.name} » est un document Word.`,
          'La conversion automatique ne respecte pas la mise en page : colonnes, zones de '
            + 'texte et placement des images seront approximatifs.',
          'Le mieux : dans Word, Fichier → Enregistrer sous → PDF, puis déposer ce PDF ici.',
          'OK : convertir quand même · Annuler : je dépose un PDF.',
        ].join('\n\n'),
      );
      if (!ok) return;
    }

    setUploading(kind);
    try {
      const toUpload = isDocx(file.name) ? await docxToPdf(file) : file;
      if (selected.seriesId) {
        // Un seul fichier pour toutes les classes de la série, et on efface les copies
        // propres qui le masqueraient (cf. effectiveDocPath).
        const series = selected.items[0]?.assessment_series ?? null;
        const prev = kind === 'subject' ? series?.subject_path ?? null : series?.correction_path ?? null;
        await uploadSeriesDoc(user.id, selected.seriesId, kind, toUpload, prev);
        await clearSeriesAssessmentDocs(selected.seriesId, kind);
      } else {
        const a = selected.items[0];
        const prev = kind === 'subject' ? a.subject_path : a.correction_path;
        await uploadAssessmentDoc(user.id, a.id, kind, toUpload, prev);
      }
      await loadAssessments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de l’upload');
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteDoc = async (kind: AssessmentDocKind) => {
    if (!selected) return;
    const path = groupDocPath(selected, kind);
    if (!path) return;
    const label = kind === 'subject' ? 'le sujet' : 'la correction';
    const scope = selected.items.length > 1 ? ` pour les ${selected.items.length} classes` : '';
    if (!window.confirm(`Supprimer ${label}${scope} ?`)) return;
    try {
      if (selected.seriesId) {
        const series = selected.items[0]?.assessment_series ?? null;
        const shared = kind === 'subject' ? series?.subject_path : series?.correction_path;
        if (shared) await deleteSeriesDoc(selected.seriesId, kind, shared);
        await clearSeriesAssessmentDocs(selected.seriesId, kind);
      } else {
        await deleteAssessmentDoc(selected.items[0].id, kind, path);
      }
      await loadAssessments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la suppression');
    }
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
            : 'Sujets, corrections, copies scannées et notes par élève.'}
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
          {!selected ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
              Sélectionne une évaluation pour voir le sujet, la correction, les copies et les notes.
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
                  {selected.items.length > 1 ? ' · sujet et correction communs' : ''}
                </div>
              </div>

              {/* Sujet & correction */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {(['subject', 'correction'] as AssessmentDocKind[]).map((kind) => {
                  const path = groupDocPath(selected, kind);
                  const label = kind === 'subject' ? 'Sujet' : 'Correction';
                  const inputRef = kind === 'subject' ? subjectInputRef : correctionInputRef;
                  return (
                    <div key={kind} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{label}</div>
                      <input
                        ref={inputRef}
                        type="file"
                        accept="application/pdf,image/*,.docx"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFile(kind, e.target.files?.[0])}
                      />
                      {path ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button onClick={() => openDoc(path)} style={btnPrimary}>Ouvrir</button>
                          <button onClick={() => inputRef.current?.click()} style={btnGhost} disabled={uploading === kind}>
                            {uploading === kind ? '…' : 'Remplacer'}
                          </button>
                          <button onClick={() => handleDeleteDoc(kind)} style={btnDanger}>Supprimer</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => inputRef.current?.click()} style={btnPrimary} disabled={uploading === kind}>
                            {uploading === kind ? 'Envoi…' : `+ Ajouter ${label.toLowerCase()} (PDF ou image)`}
                          </button>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
                            Document Word : dans Word, <strong>Fichier → Enregistrer sous → PDF</strong>.
                            La conversion automatique d’un .docx abîme la mise en page.
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Copies : une ligne par classe, puis la visionneuse de la classe choisie */}
              {selected.items.some((a) => a.kind === 'ecrit' || a.kind === 'dm') && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Copies</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                      {selected.items.map((a) => {
                        const o = overviews[a.id];
                        const on = copyClassAssessmentId === a.id;
                        return (
                          <tr key={a.id} style={{ borderTop: '1px solid var(--border)', background: on ? 'var(--indigo-soft)' : undefined }}>
                            <td style={{ padding: '8px 6px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                              {a.classes?.name ?? '—'}
                            </td>
                            <td style={{ padding: '8px 6px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {sessionStarts[a.id] ? `séance du ${formatSession(sessionStarts[a.id])}` : a.date ? formatSession(a.date) : ''}
                            </td>
                            <td style={{ padding: '8px 6px' }}>{o && <StageChip stage={o.stage} />}</td>
                            <td style={{ padding: '8px 6px', color: 'var(--text-muted)' }}>{o ? describeCopyOverview(o) : '…'}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                              <button
                                onClick={() => setCopyClassAssessmentId(on ? null : a.id)}
                                disabled={!o || o.scanned === 0}
                                style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, opacity: !o || o.scanned === 0 ? 0.5 : 1 }}
                              >
                                {on ? 'Fermer' : 'Voir les copies'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {selected.items.every((a) => (overviews[a.id]?.scanned ?? 0) === 0) && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
                      Les copies se scannent au téléphone, en séance : bouton « Copies ».
                    </div>
                  )}
                  {(() => {
                    const target = selected.items.find((a) => a.id === copyClassAssessmentId);
                    return target ? (
                      <div style={{ marginTop: 16 }}>
                        <CopyViewer assessment={target} onError={handleError} onChanged={loadAssessments} />
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
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
const btnDanger: React.CSSProperties = { ...btnBase, background: 'var(--neg-soft)', color: 'var(--neg)' };
