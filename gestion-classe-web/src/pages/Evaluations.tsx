import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import {
  fetchAssessments,
  fetchClasses,
  createAssessment,
  fetchAssessmentCopies,
  fetchAssessmentGrades,
  getCopyUrl,
  getDocUrl,
  uploadAssessmentDoc,
  deleteAssessmentDoc,
  validateGrade,
  type AssessmentRow,
  type ClassRow,
  type CopyPageRow,
  type GradeRow,
  type AssessmentDocKind,
} from '../lib/evaluationQueries';

interface StudentCopies {
  studentId: string;
  pseudo: string;
  pages: CopyPageRow[];
}

function groupByStudent(copies: CopyPageRow[]): StudentCopies[] {
  const map = new Map<string, StudentCopies>();
  for (const c of copies) {
    const pseudo = c.students?.pseudo ?? 'Élève';
    if (!map.has(c.student_id)) {
      map.set(c.student_id, { studentId: c.student_id, pseudo, pages: [] });
    }
    map.get(c.student_id)!.pages.push(c);
  }
  return [...map.values()].sort((a, b) => a.pseudo.localeCompare(b.pseudo));
}

export function Evaluations() {
  const { user } = useAuth();

  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [selected, setSelected] = useState<AssessmentRow | null>(null);
  const [copies, setCopies] = useState<CopyPageRow[]>([]);
  const [copyUrls, setCopyUrls] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploading, setUploading] = useState<AssessmentDocKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Création d'une éval depuis le web
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBareme, setFormBareme] = useState('20');
  const [creating, setCreating] = useState(false);

  const subjectInputRef = useRef<HTMLInputElement>(null);
  const correctionInputRef = useRef<HTMLInputElement>(null);

  const loadAssessments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await fetchAssessments(user.id);
      setAssessments(rows);
      setSelected((prev) => (prev ? rows.find((r) => r.id === prev.id) ?? null : null));
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
      selectAssessment(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible');
    } finally {
      setCreating(false);
    }
  };

  const loadDetail = useCallback(async (assessment: AssessmentRow) => {
    setDetailLoading(true);
    try {
      const [copyRows, gradeRows] = await Promise.all([
        fetchAssessmentCopies(assessment.id),
        fetchAssessmentGrades(assessment.id),
      ]);
      setCopies(copyRows);
      setGrades(gradeRows);
      // Signed URLs des vignettes
      const urls: Record<string, string> = {};
      await Promise.all(
        copyRows.map(async (c) => {
          const u = await getCopyUrl(c.storage_path);
          if (u) urls[c.id] = u;
        }),
      );
      setCopyUrls(urls);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement du détail');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const selectAssessment = (a: AssessmentRow) => {
    setSelected(a);
    setCopies([]);
    setCopyUrls({});
    setGrades([]);
    loadDetail(a);
  };

  const openDoc = async (path: string) => {
    const url = await getDocUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  const handleFile = async (kind: AssessmentDocKind, file: File | undefined) => {
    if (!file || !user || !selected) return;
    setUploading(kind);
    try {
      const prev = kind === 'subject' ? selected.subject_path : selected.correction_path;
      await uploadAssessmentDoc(user.id, selected.id, kind, file, prev);
      await loadAssessments();
      // recharge l'objet sélectionné mis à jour
      const refreshed = await fetchAssessments(user.id);
      setSelected(refreshed.find((r) => r.id === selected.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de l’upload');
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteDoc = async (kind: AssessmentDocKind) => {
    if (!selected) return;
    const path = kind === 'subject' ? selected.subject_path : selected.correction_path;
    if (!path) return;
    if (!window.confirm(`Supprimer ${kind === 'subject' ? 'le sujet' : 'la correction'} ?`)) return;
    try {
      await deleteAssessmentDoc(selected.id, kind, path);
      setSelected({ ...selected, [kind === 'subject' ? 'subject_path' : 'correction_path']: null });
      loadAssessments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la suppression');
    }
  };

  const handleValidate = async (gradeId: string) => {
    try {
      await validateGrade(gradeId);
      setGrades((prev) =>
        prev.map((g) =>
          g.id === gradeId ? { ...g, is_validated: true, validated_at: new Date().toISOString() } : g,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la validation');
    }
  };

  const studentCopies = groupByStudent(copies);
  const gradeByStudent = new Map(grades.map((g) => [g.student_id, g]));

  return (
    <Layout fluid>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Évaluations
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Sujets, corrections, copies scannées et notes par élève.
        </p>
      </div>

      {error && (
        <div style={{ background: 'var(--neg-soft)', color: 'var(--neg)', padding: '8px 12px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--neg)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* ---- Liste des évals ---- */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {assessments.length} évaluation{assessments.length > 1 ? 's' : ''}
            </span>
            <button onClick={openCreate} style={{ ...btnPrimary, padding: '5px 10px', fontSize: 12 }}>
              + Nouvelle
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Chargement…</div>
          ) : assessments.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
              Aucune évaluation. Clique « + Nouvelle » pour en créer une (puis ajoute le sujet/corrigé,
              et scanne les copies depuis l’app mobile).
            </div>
          ) : (
            assessments.map((a) => {
              const isSel = selected?.id === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => selectAssessment(a)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 16px', border: 'none', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: isSel ? 'var(--indigo-soft)' : 'transparent',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {a.classes?.name ?? '—'}{a.subject ? ` · ${a.subject}` : ''} · /{a.bareme_total ?? 20}
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
              {/* Sujet & correction */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {(['subject', 'correction'] as AssessmentDocKind[]).map((kind) => {
                  const path = kind === 'subject' ? selected.subject_path : selected.correction_path;
                  const label = kind === 'subject' ? 'Sujet' : 'Correction';
                  const inputRef = kind === 'subject' ? subjectInputRef : correctionInputRef;
                  return (
                    <div key={kind} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{label}</div>
                      <input
                        ref={inputRef}
                        type="file"
                        accept="application/pdf,image/*"
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
                        <button onClick={() => inputRef.current?.click()} style={btnPrimary} disabled={uploading === kind}>
                          {uploading === kind ? 'Envoi…' : `+ Ajouter ${label.toLowerCase()} (PDF/image)`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Copies par élève */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                  Copies scannées {detailLoading ? '…' : `(${studentCopies.length} élève${studentCopies.length > 1 ? 's' : ''})`}
                </div>
                {!detailLoading && studentCopies.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Aucune copie scannée pour cette évaluation.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {studentCopies.map((sc) => {
                      const g = gradeByStudent.get(sc.studentId);
                      return (
                        <div key={sc.studentId} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{sc.pseudo}</span>
                            {g && (
                              <span style={{ fontSize: 13, fontWeight: 700, color: g.is_validated ? 'var(--pos)' : 'var(--warn)' }}>
                                {g.grade != null ? `${g.grade}/20` : '—'}{g.is_validated ? ' ✓' : ' (brouillon)'}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {sc.pages.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => copyUrls[p.id] && window.open(copyUrls[p.id], '_blank', 'noopener')}
                                title={`Page ${p.page_order}`}
                                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 0, overflow: 'hidden', cursor: 'pointer', background: 'var(--surface-3)' }}
                              >
                                {copyUrls[p.id] ? (
                                  <img src={copyUrls[p.id]} alt={`p${p.page_order}`} style={{ width: 80, height: 106, objectFit: 'cover', display: 'block' }} />
                                ) : (
                                  <div style={{ width: 80, height: 106, display: 'grid', placeItems: 'center', color: 'var(--text-dim)', fontSize: 12 }}>p{p.page_order}</div>
                                )}
                              </button>
                            ))}
                          </div>
                          {g && g.comment && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{g.comment}</div>
                          )}
                          {g && !g.is_validated && (
                            <button onClick={() => handleValidate(g.id)} style={{ ...btnPrimary, marginTop: 8 }}>Valider la note</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
