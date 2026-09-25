import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { supabase } from '../../lib/supabase';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import {
  importSchoolStudents,
  linkClassToSchoolClass,
  listSchoolClasses,
  listSchoolClassStudents,
  schoolErrorMessage,
  type SchoolClass,
  type SchoolClassStudent,
} from '../../lib/schoolQueries';

interface ImportFromSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  myClasses: { id: string; name: string }[];
  /** Appelé après un import réussi (recharger les classes). */
  onImported: (classId: string) => void;
}

/** Même normalisation que school_class_name_key côté SQL : « 5ème 1 » = « 5E1 ». */
function nameKey(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^([0-9])eme/, '$1e');
}

/**
 * Récupérer des élèves déjà saisis par un collègue du même collège : ils gardent leur
 * code de connexion. Choix d'une classe du collège → élèves (décochables pour les
 * demi-groupes / options) → classe cible (nouvelle ou existante).
 */
export function ImportFromSchoolModal({ isOpen, onClose, userId, myClasses, onImported }: ImportFromSchoolModalProps) {
  const { toast } = useUIFeedback();
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<SchoolClass | null>(null);
  const [students, setStudents] = useState<SchoolClassStudent[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<'new' | string>('new');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  // Liste des classes du collège à l'ouverture.
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setPicked(null);
    setStudents(null);
    setSchoolClasses(null);
    setLoadError(null);
    listSchoolClasses()
      .then((rows) => { if (alive) setSchoolClasses(rows); })
      .catch((err) => { if (alive) setLoadError(schoolErrorMessage(err)); });
    return () => { alive = false; };
  }, [isOpen]);

  const pickClass = async (sc: SchoolClass) => {
    setPicked(sc);
    setStudents(null);
    setNewName(sc.name);
    // Classe cible par défaut : une de mes classes au même nom, sinon une nouvelle.
    const same = myClasses.find((c) => nameKey(c.name) === nameKey(sc.name));
    setTarget(same ? same.id : 'new');
    try {
      const rows = await listSchoolClassStudents(sc.id);
      setStudents(rows);
      setSelected(new Set(rows.filter((s) => !s.already_mine).map((s) => s.identity_id)));
    } catch (err) {
      setLoadError(schoolErrorMessage(err));
    }
  };

  const importable = useMemo(() => (students ?? []).filter((s) => !s.already_mine), [students]);
  const allChecked = importable.length > 0 && importable.every((s) => selected.has(s.identity_id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(importable.map((s) => s.identity_id)));
  };

  const handleImport = async () => {
    if (!picked || selected.size === 0) return;
    if (target === 'new' && !newName.trim()) return;
    setBusy(true);
    try {
      let classId = target;
      if (target === 'new') {
        const { data, error } = await supabase
          .from('classes')
          .insert({ name: newName.trim(), user_id: userId })
          .select('id')
          .single();
        if (error) throw error;
        classId = data.id as string;
      }
      // Rattacher la classe cible : les collègues suivants retrouveront mes élèves ajoutés ensuite.
      await linkClassToSchoolClass(classId, { schoolClassId: picked.id });
      const res = await importSchoolStudents(classId, [...selected]);
      toast(
        res.skipped > 0
          ? `${res.imported} élève(s) récupéré(s), ${res.skipped} déjà présent(s).`
          : `${res.imported} élève(s) récupéré(s).`,
        'success',
      );
      onImported(classId);
      onClose();
    } catch (err) {
      toast(schoolErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const footer = picked ? (
    <div className="flex items-center justify-between gap-2 w-full">
      <button className="btn btn--ghost" onClick={() => { setPicked(null); setStudents(null); }} disabled={busy}>
        Retour
      </button>
      <button
        className="btn btn--primary"
        onClick={handleImport}
        disabled={busy || selected.size === 0 || (target === 'new' && !newName.trim())}
      >
        {busy ? 'Import…' : `Récupérer ${selected.size} élève(s)`}
      </button>
    </div>
  ) : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={picked ? `Élèves de ${picked.name}` : 'Récupérer des élèves du collège'} size="lg" footer={footer}>
      {loadError ? (
        <p className="text-sm text-red-500">{loadError}</p>
      ) : !picked ? (
        schoolClasses === null ? (
          <p className="text-sm text-[var(--text-muted)]">Chargement…</p>
        ) : schoolClasses.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Aucune classe n'a encore été partagée dans votre collège cette année.
            Créez la vôtre normalement : elle sera proposée aux collègues suivants.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)] mb-2">
              Les élèves récupérés gardent leur code de connexion. Une classe absente de la liste
              est à créer vous-même.
            </p>
            {schoolClasses.map((sc) => (
              <button
                key={sc.id}
                onClick={() => pickClass(sc)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-left hover:border-[var(--indigo)]"
              >
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">{sc.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {(sc.teachers ?? []).join(', ') || '—'}
                  </div>
                </div>
                <div className="text-xs text-[var(--text-muted)] text-right">
                  {sc.student_count} élève(s)
                  {sc.mine && <div className="text-[var(--indigo)]">déjà chez vous</div>}
                </div>
              </button>
            ))}
          </div>
        )
      ) : students === null ? (
        <p className="text-sm text-[var(--text-muted)]">Chargement…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-muted)]">
                Décochez les élèves qui ne sont pas dans votre groupe.
              </span>
              {importable.length > 0 && (
                <button className="text-xs text-[var(--indigo)]" onClick={toggleAll}>
                  {allChecked ? 'Tout décocher' : 'Tout cocher'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-72 overflow-y-auto">
              {students.map((s) => (
                <label
                  key={s.identity_id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${s.already_mine ? 'opacity-50' : 'cursor-pointer hover:bg-[var(--surface)]'}`}
                  title={s.already_mine ? 'Déjà dans une de vos classes' : undefined}
                >
                  <input
                    type="checkbox"
                    checked={s.already_mine || selected.has(s.identity_id)}
                    disabled={s.already_mine}
                    onChange={() => toggle(s.identity_id)}
                  />
                  <span className="text-[var(--text)]">{s.pseudo}</span>
                  {(s.has_pap || s.has_ppre || s.has_pai) && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {[s.has_pap && 'PAP', s.has_ppre && 'PPRE', s.has_pai && 'PAI'].filter(Boolean).join(' ')}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--text-muted)]">Dans quelle classe ?</div>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={target === 'new'} onChange={() => setTarget('new')} />
              <span>Nouvelle classe</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onFocus={() => setTarget('new')}
                className="flex-1 px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm"
              />
            </label>
            {myClasses.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={target !== 'new'} onChange={() => setTarget(myClasses[0].id)} />
                <span>Une de mes classes</span>
                <select
                  value={target === 'new' ? '' : target}
                  onChange={(e) => setTarget(e.target.value || 'new')}
                  className="flex-1 px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm"
                >
                  <option value="">—</option>
                  {myClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
