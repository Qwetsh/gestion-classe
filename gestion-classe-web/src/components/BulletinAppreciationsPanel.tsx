/**
 * Mode « Bulletin » de la page Élèves : l'appréciation de chaque élève pour un trimestre,
 * modifiable sur place (enregistrée en quittant le champ), avec compteur 300 caractères
 * (limite Pronote) et bouton « Copier » pour la recopier dans Pronote.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APPRECIATION_MAX_LENGTH,
  fetchAppreciationsForStudents,
  markAppreciationCopied,
  saveAppreciation,
  type BulletinAppreciation,
} from '../lib/bulletinAppreciationsQueries';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import '../styles/bulletin-appreciations.css';

export interface BulletinPanelStudent {
  id: string;
  pseudo: string;
  grade: number;
}

interface Props {
  userId: string;
  classId: string;
  className: string;
  schoolYear: string;
  currentTrimester: number;
  students: BulletinPanelStudent[];
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function BulletinAppreciationsPanel({ userId, classId, className, schoolYear, currentTrimester, students }: Props) {
  const { toast } = useUIFeedback();
  const [trimester, setTrimester] = useState(currentTrimester);
  const [rows, setRows] = useState<Map<string, BulletinAppreciation>>(new Map());
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => { setTrimester(currentTrimester); }, [currentTrimester]);
  // Le trimestre affiché, lu par un enregistrement qui se termine après un changement de trimestre.
  const shownTrimester = useRef(trimester);
  useEffect(() => { shownTrimester.current = trimester; }, [trimester]);

  const studentIds = useMemo(() => students.map((s) => s.id), [students]);
  const studentKey = studentIds.join(',');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    fetchAppreciationsForStudents(studentIds, schoolYear, trimester)
      .then((map) => {
        if (cancelled) return;
        setRows(map);
        setDrafts(new Map());
      })
      .catch(() => { if (!cancelled) setLoadError('Impossible de charger les appréciations.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // studentKey résume studentIds (évite de recharger à chaque rendu)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentKey, schoolYear, trimester]);

  const valueOf = (studentId: string) => drafts.get(studentId) ?? rows.get(studentId)?.content ?? '';

  const setDraft = (studentId: string, value: string) => {
    setDrafts((prev) => new Map(prev).set(studentId, value.slice(0, APPRECIATION_MAX_LENGTH)));
  };

  const commit = useCallback(async (studentId: string) => {
    const draft = drafts.get(studentId);
    if (draft === undefined) return;
    const saved = rows.get(studentId)?.content ?? '';
    if (draft.trim() === saved.trim()) {
      setDrafts((prev) => { const next = new Map(prev); next.delete(studentId); return next; });
      return;
    }
    setSavingId(studentId);
    try {
      const row = await saveAppreciation({
        userId, studentId, classId, className, schoolYear, trimester, content: draft,
      });
      // Trimestre changé pendant l'enregistrement : la ligne est en base, mais elle n'a pas sa
      // place dans la liste affichée, qui est celle d'un autre trimestre.
      if (shownTrimester.current !== trimester) return;
      setRows((prev) => {
        const next = new Map(prev);
        if (row) next.set(studentId, row); else next.delete(studentId);
        return next;
      });
      setDrafts((prev) => { const next = new Map(prev); next.delete(studentId); return next; });
    } catch {
      toast("L'appréciation n'a pas pu être enregistrée.", 'error');
    } finally {
      setSavingId(null);
    }
  }, [drafts, rows, userId, classId, className, schoolYear, trimester, toast]);

  const copyOne = async (studentId: string) => {
    const row = rows.get(studentId);
    if (!row) return;
    if (!(await copyText(row.content))) {
      toast('Copie impossible dans ce navigateur.', 'error');
      return;
    }
    toast('Appréciation copiée', 'success');
    try {
      const copiedAt = await markAppreciationCopied(row.id);
      setRows((prev) => new Map(prev).set(studentId, { ...row, copied_at: copiedAt }));
    } catch { /* la copie a eu lieu ; l'indicateur se mettra à jour au prochain chargement */ }
  };

  const copyAll = async () => {
    const lines = students
      .filter((s) => rows.has(s.id))
      .map((s) => `${s.pseudo} : ${rows.get(s.id)!.content}`);
    if (lines.length === 0) return;
    if (await copyText(lines.join('\n'))) toast(`${lines.length} appréciations copiées`, 'success');
    else toast('Copie impossible dans ce navigateur.', 'error');
  };

  const filled = students.filter((s) => rows.has(s.id)).length;
  const toCopy = students.filter((s) => { const r = rows.get(s.id); return r && !r.copied_at; }).length;

  return (
    <div className="bap">
      <div className="bap__bar">
        <div className="segbtn" role="group" aria-label="Trimestre">
          {[1, 2, 3].map((t) => (
            <button key={t} className={`segbtn__b ${trimester === t ? 'is-on' : ''}`} onClick={() => setTrimester(t)}>
              T{t}
            </button>
          ))}
        </div>
        <span className="bap__meta">
          {isLoading ? 'chargement…' : `${filled} / ${students.length} rédigées${toCopy > 0 ? ` · ${toCopy} à recopier dans Pronote` : ''}`}
        </span>
        <div className="bap__spacer" />
        <button className="btn btn--ghost" onClick={copyAll} disabled={filled === 0}>
          Copier tout
        </button>
      </div>

      {loadError && <div className="bap__error">{loadError}</div>}

      <div className="bap__list">
        {students.map((s) => {
          const value = valueOf(s.id);
          const row = rows.get(s.id);
          const dirty = drafts.has(s.id) && value.trim() !== (row?.content ?? '').trim();
          const otherClass = row?.class_name && row.class_name !== className ? row.class_name : null;
          return (
            <div key={s.id} className="bap__row">
              <div className="bap__who">
                <span className="bap__name">{s.pseudo}</span>
                <span className="bap__grade">{s.grade.toFixed(1).replace('.', ',')}</span>
                {otherClass && <span className="bap__tag" title="Appréciation écrite dans une autre classe">{otherClass}</span>}
              </div>
              <div className="bap__field">
                <textarea
                  className="bap__text"
                  value={value}
                  rows={3}
                  maxLength={APPRECIATION_MAX_LENGTH}
                  placeholder="Appréciation du trimestre…"
                  disabled={isLoading}
                  onChange={(e) => setDraft(s.id, e.target.value)}
                  onBlur={() => { void commit(s.id); }}
                  aria-label={`Appréciation de ${s.pseudo}, trimestre ${trimester}`}
                />
                <div className="bap__foot">
                  <span className={`bap__count ${value.length >= APPRECIATION_MAX_LENGTH ? 'is-full' : ''}`}>
                    {value.length} / {APPRECIATION_MAX_LENGTH}
                  </span>
                  <span className="bap__state">
                    {savingId === s.id ? 'enregistrement…' : dirty ? 'modifiée, non enregistrée' : row ? (row.copied_at ? 'recopiée' : 'à recopier') : ''}
                  </span>
                  <button className="btn btn--ghost bap__copy" onClick={() => { void copyOne(s.id); }} disabled={!row || dirty}>
                    Copier
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {students.length === 0 && <div className="empty">Aucun élève avec ces filtres.</div>}
      </div>
    </div>
  );
}
