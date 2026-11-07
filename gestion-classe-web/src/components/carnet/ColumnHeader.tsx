import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ExportCorrectionsDialog, type ExportableRow } from '../ExportCorrectionsDialog';
import { PronoteColumnDialog } from '../PronoteColumnDialog';
import { RelinkDialog } from '../RelinkDialog';
import { ClassCopiesDialog, type ClassCopyStudent } from '../ClassCopiesDialog';
import { hasCopies } from '../../lib/assessmentGroups';
import { coefLabel, columnDetailsSummary, type ColumnLabel, type RelinkTarget } from '../../lib/columnHeader';
import { exportAssessmentNotesXlsx } from '../../lib/gradeExport';
import {
  downloadAssessmentDoc,
  effectiveDocPath,
  fetchAssessmentCopies,
  fetchAssessmentGrades,
  fetchAssessmentTranscripts,
  fetchExpectedStudents,
  fetchKitVersions,
  getDocUrl,
  type AssessmentDocKind,
  type AssessmentRow,
} from '../../lib/evaluationQueries';

/**
 * En-tête d'une colonne du carnet (variante B validée le 02/11/2026) : titre sur deux lignes
 * (il ouvre la fiche), ligne d'infos, pastilles, et un bouton ▾ toujours visible qui ouvre les
 * actions de l'éval : sujet et corrigé, scanner les copies, télécharger corrections et notes,
 * Pronote, relier à une autre classe. Le menu et les fenêtres s'affichent par-dessus la page
 * (portail), pas dans l'en-tête collant du tableau.
 *
 * Par défaut l'en-tête est sobre : avancement, « hors moy. », coefficient et nombre de classes
 * de la série n'y figurent que si « Détails des colonnes » est coché. Ils restent lisibles en
 * une ligne en tête du menu ▾ et dans l'infobulle du titre. La pastille « même nom en … »
 * reste toujours visible : c'est une action.
 */
export function ColumnHeader({
  assessment,
  label,
  chip,
  showDetails,
  seriesSize,
  suggestion,
  toCorrect,
  all,
  userId,
  onOpen,
  onDismissSuggestion,
  onChanged,
  onError,
}: {
  assessment: AssessmentRow;
  label: ColumnLabel;
  /** Pastille d'avancement (« 18 sans note », « À valider ») et ses couleurs. */
  chip: { label: string; background: string; color: string } | null;
  /** « Détails des colonnes » coché : pastilles et coefficient dans l'en-tête. */
  showDetails: boolean;
  /** Nombre de classes de sa série (0 ou 1 : pas de série). */
  seriesSize: number;
  /** Même nom dans d'autres classes, pas encore reliée. */
  suggestion: RelinkTarget | null;
  /** Production numérique : envois pas encore corrigés (pastille toujours visible, elle ouvre la correction). */
  toCorrect?: { count: number; onOpen: () => void } | null;
  all: AssessmentRow[];
  userId: string;
  /** Avant de quitter le carnet : enregistre les saisies en attente. */
  onOpen: () => void;
  onDismissSuggestion: () => void;
  /** Série, copies : le carnet recharge. */
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<
    | { kind: 'relink'; preselect: string | null }
    | { kind: 'scan'; students: ClassCopyStudent[]; knownVersions: string[] }
    | { kind: 'pronote' }
    | { kind: 'corrections'; rows: ExportableRow[] }
    | null
  >(null);
  const [busy, setBusy] = useState<string | null>(null);

  const openMenu = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 300;
    setMenu({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)) });
  };
  const closeMenu = useCallback(() => setMenu(null), []);

  // Fermeture : clic ailleurs, Échap, défilement ou redimensionnement (le menu est fixe).
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { closeMenu(); buttonRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [menu, closeMenu]);

  // Le menu ne déborde pas en bas de l'écran.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!menu || !el) return;
    const h = el.getBoundingClientRect().height;
    if (menu.top + h > window.innerHeight - 8) el.style.top = `${Math.max(8, window.innerHeight - h - 8)}px`;
  }, [menu]);

  const docPath = (kind: AssessmentDocKind) => effectiveDocPath(assessment, kind);

  const showDoc = async (kind: AssessmentDocKind) => {
    const path = docPath(kind);
    if (!path) return;
    closeMenu();
    const url = await getDocUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
    else onError('Document introuvable');
  };

  const downloadDoc = async (kind: AssessmentDocKind) => {
    const path = docPath(kind);
    if (!path) return;
    closeMenu();
    try {
      const file = await downloadAssessmentDoc(path, kind);
      const ext = path.split('.').pop() ?? 'pdf';
      const slug = assessment.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      saveBlob(`${slug}_${kind === 'subject' ? 'sujet' : 'corrige'}.${ext}`, file);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Téléchargement impossible');
    }
  };

  const loadRoster = async () => {
    const [roster, grades, transcripts] = await Promise.all([
      fetchExpectedStudents([assessment]), fetchAssessmentGrades(assessment.id), fetchAssessmentTranscripts(assessment.id),
    ]);
    return { roster: roster[assessment.id] ?? [], grades, transcripts };
  };

  const openCorrections = async () => {
    closeMenu();
    setBusy('corrections');
    try {
      const { roster, grades, transcripts } = await loadRoster();
      const byStudent = new Map(grades.map((g) => [g.student_id, g]));
      setDialog({ kind: 'corrections', rows: roster.map((s) => ({ student: s, grade: byStudent.get(s.id) ?? null, transcript: transcripts[s.id] })) });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Corrections introuvables');
    } finally {
      setBusy(null);
    }
  };

  /**
   * « Scanner les copies » : la fenêtre « Ajouter les copies de la classe ». Avec la PR #21
   * (QR code de classe), elle offre un seul QR code : le téléphone liste les élèves, on choisit
   * celui qu'on photographie. Le QR code d'UN élève reste dans sa modale (bouton « i »).
   */
  const openScan = async () => {
    closeMenu();
    setBusy('scan');
    try {
      const [roster, grades, copies, kitVersions] = await Promise.all([
        fetchExpectedStudents([assessment]), fetchAssessmentGrades(assessment.id),
        fetchAssessmentCopies(assessment.id), fetchKitVersions(assessment.id).catch(() => [] as string[]),
      ]);
      const pages: Record<string, number> = {};
      for (const c of copies) pages[c.student_id] = (pages[c.student_id] ?? 0) + 1;
      const byStudent = new Map(grades.map((g) => [g.student_id, g]));
      const absent = new Set(['absent', 'dispense', 'non_rendu', 'non_rendu_zero']);
      const students: ClassCopyStudent[] = (roster[assessment.id] ?? []).map((s) => {
        const g = byStudent.get(s.id) ?? null;
        return { id: s.id, pseudo: s.pseudo, existingPages: pages[s.id] ?? 0, grade: g, absent: !!g && absent.has(g.status) };
      });
      const knownVersions = [...new Set([...grades.map((g) => g.subject_version), ...kitVersions].filter((v): v is string => !!v))].sort();
      setDialog({ kind: 'scan', students, knownVersions });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Élèves introuvables');
    } finally {
      setBusy(null);
    }
  };

  const downloadNotes = async () => {
    closeMenu();
    try {
      const [roster, grades] = await Promise.all([
        fetchExpectedStudents([{ ...assessment, group_id: null }]), fetchAssessmentGrades(assessment.id),
      ]);
      exportAssessmentNotesXlsx(assessment, roster[assessment.id] ?? [], grades);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Export impossible');
    }
  };

  const withCopies = hasCopies(assessment);
  const canRelink = assessment.kind !== 'groupe';
  const coef = label.coefficient;
  const details = columnDetailsSummary({
    chip: chip?.label ?? null, countsInAverage: assessment.counts_in_average, coefficient: coef, seriesSize,
  });
  const pills = showDetails || !!suggestion || !!toCorrect;

  return (
    <>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
        <Link
          to={`/evaluations/${assessment.id}`}
          onClick={onOpen}
          className="gc-colhead__title"
          title={`${assessment.name} — ouvrir la fiche${details ? `\n${details}` : ''}`}
        >
          {label.title}
        </Link>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => (menu ? closeMenu() : openMenu())}
          aria-label={`Actions : ${assessment.name}`}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          className={`gc-colhead__more${menu ? ' is-open' : ''}`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={menu ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>
      </div>
      <div className="gc-colhead__meta">
        {label.meta}
        {showDetails && coef !== null && <> · <strong>{coefLabel(coef)}</strong></>}
      </div>
      {pills && <div className="gc-colhead__pills">
        {toCorrect && (
          <button
            type="button"
            className="gc-pill gc-pill--todo"
            onClick={() => { onOpen(); toCorrect.onOpen(); }}
            title="Productions envoyées par les élèves, pas encore corrigées : ouvrir la correction"
          >
            À corriger · {toCorrect.count}
          </button>
        )}
        {showDetails && chip && <span className="gc-pill" style={{ background: chip.background, color: chip.color }}>{chip.label}</span>}
        {showDetails && !assessment.counts_in_average && <span className="gc-pill gc-pill--outline">hors moy.</span>}
        {showDetails && seriesSize > 1 && <span className="gc-pill gc-pill--indigo" title="Même éval dans plusieurs classes">{seriesSize} classes</span>}
        {suggestion && (
          <button
            type="button"
            className="gc-pill gc-pill--warn"
            onClick={() => setDialog({ kind: 'relink', preselect: suggestion.key })}
            title={`Même nom en ${suggestion.classNames.join(', ')} : relier pour comparer`}
          >
            même nom en {suggestion.classNames.join(', ')}
          </button>
        )}
      </div>}

      {menu && createPortal(
        <div ref={menuRef} role="menu" aria-label={assessment.name} className="gc-colmenu" style={{ top: menu.top, left: menu.left }}>
          {details && <div className="gc-colmenu__summary">{details}</div>}
          <Link role="menuitem" to={`/evaluations/${assessment.id}`} onClick={() => { closeMenu(); onOpen(); }} className="gc-colmenu__item gc-colmenu__item--strong">
            Ouvrir la fiche
          </Link>
          <div className="gc-colmenu__sep" />
          {(['subject', 'correction'] as AssessmentDocKind[]).map((kind) => (
            <div key={kind} className="gc-colmenu__doc">
              <span>{kind === 'subject' ? 'Sujet' : 'Corrigé'}</span>
              {docPath(kind) ? (
                <>
                  <button type="button" role="menuitem" onClick={() => { void showDoc(kind); }} className="gc-colmenu__btn">Afficher</button>
                  <button type="button" role="menuitem" onClick={() => { void downloadDoc(kind); }} className="gc-colmenu__btn gc-colmenu__btn--icon" aria-label={`Télécharger le ${kind === 'subject' ? 'sujet' : 'corrigé'}`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
                  </button>
                </>
              ) : (
                <Link role="menuitem" to={`/evaluations/${assessment.id}`} onClick={() => { closeMenu(); onOpen(); }} className="gc-colmenu__btn gc-colmenu__btn--add">Ajouter</Link>
              )}
            </div>
          ))}
          <div className="gc-colmenu__sep" />
          {suggestion && (
            <button type="button" role="menuitem" className="gc-colmenu__item gc-colmenu__item--warn" onClick={() => { closeMenu(); setDialog({ kind: 'relink', preselect: suggestion.key }); }}>
              <strong>Même nom en {suggestion.classNames.join(', ')}</strong>
              <span>relier pour comparer les notes</span>
            </button>
          )}
          {withCopies && (
            <button type="button" role="menuitem" className="gc-colmenu__item" onClick={() => { void openScan(); }} disabled={busy === 'scan'}>
              <strong>{busy === 'scan' ? 'Chargement…' : 'Scanner les copies…'}</strong>
              <span>toute la classe : téléphone, paquet PDF ou webcam</span>
            </button>
          )}
          {withCopies && (
            <button type="button" role="menuitem" className="gc-colmenu__item" onClick={() => { void openCorrections(); }} disabled={busy === 'corrections'}>
              <strong>{busy === 'corrections' ? 'Chargement…' : 'Télécharger les corrections…'}</strong>
              <span>PDF, Word, Markdown · choisir les élèves</span>
            </button>
          )}
          <button type="button" role="menuitem" className="gc-colmenu__item" onClick={() => { void downloadNotes(); }}>
            <strong>Télécharger les notes</strong>
            <span>Excel, une ligne par élève</span>
          </button>
          <button type="button" role="menuitem" className="gc-colmenu__item" onClick={() => { closeMenu(); setDialog({ kind: 'pronote' }); }}>
            <strong>Copier pour Pronote</strong>
            <span>la colonne des notes, dans l’ordre de Pronote</span>
          </button>
          {canRelink && (
            <>
              <div className="gc-colmenu__sep" />
              <button type="button" role="menuitem" className="gc-colmenu__item" onClick={() => { closeMenu(); setDialog({ kind: 'relink', preselect: suggestion?.key ?? null }); }}>
                <strong>Relier à une autre classe…</strong>
                <span>{seriesSize > 1 ? `déjà reliée · ${seriesSize} classes` : 'même éval, autre classe'}</span>
              </button>
            </>
          )}
        </div>,
        document.body,
      )}

      {dialog && createPortal(
        <>
          {dialog.kind === 'relink' && (
            <RelinkDialog
              assessment={assessment}
              all={all}
              userId={userId}
              preselect={dialog.preselect}
              onDismissSuggestion={suggestion ? () => { onDismissSuggestion(); setDialog(null); } : undefined}
              onClose={() => setDialog(null)}
              onChanged={onChanged}
            />
          )}
          {dialog.kind === 'scan' && (
            <ClassCopiesDialog
              assessment={assessment}
              students={dialog.students}
              knownVersions={dialog.knownVersions}
              onError={onError}
              onClose={(changed) => { setDialog(null); if (changed) onChanged(); }}
            />
          )}
          {dialog.kind === 'pronote' && <PronoteColumnDialog assessment={assessment} onClose={() => setDialog(null)} />}
          {dialog.kind === 'corrections' && (
            <ExportCorrectionsDialog assessment={assessment} rows={dialog.rows} onClose={() => setDialog(null)} />
          )}
        </>,
        document.body,
      )}
    </>
  );
}

function saveBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
