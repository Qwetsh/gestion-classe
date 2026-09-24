/**
 * Import de l'emploi du temps depuis un export .ics de Pronote, et correspondance
 * « libellé Pronote → classe / demi-groupe ». Utilisé dans Réglages › Emploi du temps
 * et depuis l'accueil quand aucun emploi du temps n'est disponible.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { fetchClassGroupsForUser, type ClassGroupInfo } from '../../lib/classGroupQueries';
import { parseIcs, type IcsCalendar } from '../../lib/timetable/icsParser';
import {
  buildLinks,
  collectLabels,
  type LabelLink,
  type MatchClass,
  type TimetableLabel,
} from '../../lib/timetable/labelMatching';
import {
  deleteIcsEntries,
  fetchImportInfo,
  fetchLabelLinks,
  fetchStoredLessonLabels,
  importIcsEntries,
  saveLabelLinks,
  type TimetableImportInfo,
} from '../../lib/timetable/timetableQueries';

type View =
  | { kind: 'status' }
  | { kind: 'review'; calendar: IcsCalendar; fileName: string }
  | { kind: 'links' };

const fmtDay = (iso: string | Date | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

const btnPrimary = 'px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50';
const btnSecondary = 'px-3 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50';
const selectCls = 'w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)]';

function isPronoteConnected(): boolean {
  try { return !!localStorage.getItem('pronote_session'); } catch { return false; }
}

export function TimetableImportPanel({ onImported }: { onImported?: () => void }) {
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<TimetableImportInfo | null>(null);
  const [classes, setClasses] = useState<MatchClass[]>([]);
  const [groups, setGroups] = useState<ClassGroupInfo[]>([]);
  const [savedLinks, setSavedLinks] = useState<LabelLink[]>([]);

  const [view, setView] = useState<View>({ kind: 'status' });
  const [labels, setLabels] = useState<TimetableLabel[]>([]);
  const [links, setLinks] = useState<LabelLink[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [inf, cls, grp, lnk] = await Promise.all([
        fetchImportInfo(user.id),
        supabase.from('classes').select('id, name').eq('user_id', user.id).order('name'),
        fetchClassGroupsForUser(user.id),
        fetchLabelLinks(user.id),
      ]);
      if (cls.error) throw cls.error;
      setInfo(inf);
      setClasses((cls.data || []) as MatchClass[]);
      setGroups(grp);
      setSavedLinks(lnk);
    } catch (e) {
      console.error(e);
      setError("Impossible de charger l'emploi du temps enregistré.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const handleFile = async (file: File) => {
    setError(null);
    setNotice(null);
    try {
      const calendar = parseIcs(await file.text());
      const lessons = calendar.entries.filter(e => e.kind === 'lesson');
      if (lessons.length === 0) {
        setError("Aucun cours trouvé dans ce fichier. Vérifiez qu'il s'agit bien d'un export .ics de Pronote.");
        return;
      }
      const found = collectLabels(lessons);
      setLabels(found);
      setLinks(buildLinks(found, savedLinks, classes, groups));
      setView({ kind: 'review', calendar, fileName: file.name });
    } catch (e) {
      console.error(e);
      setError('Lecture du fichier impossible.');
    }
  };

  const openLinks = async () => {
    if (!user) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const found = collectLabels(await fetchStoredLessonLabels(user.id));
      setLabels(found);
      setLinks(buildLinks(found, savedLinks, classes, groups));
      setView({ kind: 'links' });
    } catch (e) {
      console.error(e);
      setError('Impossible de charger les classes importées.');
    } finally {
      setBusy(false);
    }
  };

  const saveImport = async () => {
    if (!user || view.kind !== 'review') return;
    setBusy(true);
    setError(null);
    try {
      await saveLabelLinks(user.id, links);
      const { calendar, fileName } = view;
      const res = await importIcsEntries(user.id, calendar.entries, {
        fileName, rangeStart: calendar.rangeStart, rangeEnd: calendar.rangeEnd,
      });
      await load();
      setView({ kind: 'status' });
      setNotice(
        `${res.saved} événements enregistrés` +
        (res.removed > 0 ? `, ${res.removed} retirés (absents du nouveau fichier)` : '') + '.',
      );
      onImported?.();
    } catch (e) {
      console.error(e);
      setError("L'enregistrement a échoué. Réessayez ; rien n'a été perdu.");
    } finally {
      setBusy(false);
    }
  };

  const saveLinksOnly = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await saveLabelLinks(user.id, links);
      await load();
      setView({ kind: 'status' });
      setNotice('Correspondance enregistrée.');
      onImported?.();
    } catch (e) {
      console.error(e);
      setError("L'enregistrement a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const removeImport = async () => {
    if (!user) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try {
      await deleteIcsEntries(user.id);
      setConfirmDelete(false);
      await load();
      setNotice("L'emploi du temps importé a été retiré.");
      onImported?.();
    } catch (e) {
      console.error(e);
      setError('La suppression a échoué.');
    } finally {
      setBusy(false);
    }
  };

  const updateLink = (label: string, patch: Partial<LabelLink>) =>
    setLinks(prev => prev.map(l => (l.label === label ? { ...l, ...patch } : l)));

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Chargement…</p>;
  }

  const fileButton = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className={btnPrimary}
        style={{ background: 'var(--indigo)' }}
        disabled={busy}
      >
        {info ? 'Réimporter un fichier .ics' : 'Choisir le fichier .ics'}
      </button>
    </>
  );

  const messages = (
    <>
      {error && <p className="text-xs text-[var(--neg)]">{error}</p>}
      {notice && <p className="text-xs" style={{ color: 'var(--pos)' }}>{notice}</p>}
    </>
  );

  // ── Correspondance (après lecture d'un fichier, ou à la demande) ──
  if (view.kind !== 'status') {
    const review = view.kind === 'review' ? view : null;
    const lessons = review?.calendar.entries.filter(e => e.kind === 'lesson') ?? [];
    const holidays = review ? review.calendar.entries.length - lessons.length : 0;
    const canceled = lessons.filter(e => e.status === 'canceled').length;

    return (
      <div className="space-y-4">
        {review && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm">
            <div className="font-medium text-[var(--text)]">{review.fileName}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              {lessons.length} cours (dont {canceled} annulés) · {holidays} congés ·
              du {fmtDay(review.calendar.rangeStart)} au {fmtDay(review.calendar.rangeEnd)}
            </div>
          </div>
        )}

        <div>
          <div className="text-sm font-medium text-[var(--text)]">Correspondance des classes</div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Reliez chaque classe ou groupe Pronote à une classe de l'application. Les cours
            « pas une de mes classes » restent affichés, sans lien.
          </p>
        </div>

        <div className="space-y-2">
          {labels.map(l => {
            const link = links.find(x => x.label === l.label)!;
            const classGroups = link.classId ? groups.filter(g => g.class_id === link.classId) : [];
            const isSub = l.classLabel !== null && l.label !== l.classLabel;
            return (
              <div
                key={l.label}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] gap-2 items-center px-3 py-2 rounded-lg border border-[var(--border)]"
                style={{ marginLeft: isSub ? 16 : 0 }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text)] truncate">{l.label}</div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate" title={l.subjects.join(', ')}>
                    {l.lessonCount} cours · {l.subjects.join(', ').toLowerCase()}
                  </div>
                </div>
                <select
                  className={selectCls}
                  value={link.ignored || !link.classId ? '' : link.classId}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateLink(l.label, v ? { classId: v, groupId: null, ignored: false } : { classId: null, groupId: null, ignored: true });
                  }}
                  aria-label={`Classe pour ${l.label}`}
                >
                  <option value="">Pas une de mes classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {classGroups.length > 0 ? (
                  <select
                    className={selectCls}
                    value={link.groupId ?? ''}
                    onChange={(e) => updateLink(l.label, { groupId: e.target.value || null })}
                    aria-label={`Groupe pour ${l.label}`}
                  >
                    <option value="">Classe entière</option>
                    {classGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)] px-1">
                    {link.classId ? 'Classe entière' : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {messages}

        <div className="flex gap-2 justify-end">
          <button type="button" className={btnSecondary} onClick={() => setView({ kind: 'status' })} disabled={busy}>
            Annuler
          </button>
          <button
            type="button"
            className={btnPrimary}
            style={{ background: 'var(--indigo)' }}
            onClick={() => void (review ? saveImport() : saveLinksOnly())}
            disabled={busy}
          >
            {busy ? 'Enregistrement…' : review ? "Importer l'emploi du temps" : 'Enregistrer'}
          </button>
        </div>
      </div>
    );
  }

  // ── État ──
  return (
    <div className="space-y-4">
      {isPronoteConnected() && (
        <p className="text-xs rounded-lg px-3 py-2 bg-[var(--indigo-soft)] text-[var(--indigo)]">
          Pronote est connecté : c'est lui qui s'affiche sur l'accueil. Un emploi du temps importé
          sert de secours quand la connexion Pronote n'est pas disponible.
        </p>
      )}

      {info ? (
        <div className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm">
          <div className="font-medium text-[var(--text)]">
            {info.lessonCount} cours · {info.holidayCount} congés
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            Du {fmtDay(info.rangeStart)} au {fmtDay(info.rangeEnd)} · importé le {fmtDay(info.importedAt)}
            {info.fileName ? ` (${info.fileName})` : ''}
          </div>
        </div>
      ) : (
        <div className="text-xs text-[var(--text-muted)] space-y-1.5">
          <p>Sans connexion Pronote, importez l'emploi du temps de l'année depuis Pronote :</p>
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>Dans Pronote, exportez votre emploi du temps au format iCal (<strong>.ics</strong>), sur toute l'année.</li>
            <li>Enregistrez le fichier sur l'ordinateur.</li>
            <li>Déposez ce fichier ici. Réimportez-le quand l'emploi du temps change.</li>
          </ol>
        </div>
      )}

      {messages}

      <div className="flex flex-wrap gap-2">
        {fileButton}
        {info && (
          <>
            <button type="button" className={btnSecondary} onClick={() => void openLinks()} disabled={busy}>
              Correspondance des classes
            </button>
            <button
              type="button"
              onClick={() => void removeImport()}
              disabled={busy}
              className="px-3 py-2 rounded-lg text-sm font-medium border"
              style={{
                borderColor: confirmDelete ? 'var(--neg)' : 'var(--border)',
                color: confirmDelete ? 'var(--neg)' : 'var(--text-muted)',
              }}
            >
              {confirmDelete ? 'Confirmer la suppression' : 'Retirer'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
