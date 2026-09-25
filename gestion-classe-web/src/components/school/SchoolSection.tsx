import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import {
  createSchool,
  getMySchool,
  joinSchool,
  linkClassToSchoolClass,
  listSchoolClasses,
  removeSchoolMember,
  schoolErrorMessage,
  searchSchools,
  updateMySchoolProfile,
  type MySchool,
  type SchoolClass,
  type SchoolSummary,
} from '../../lib/schoolQueries';

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-transparent';

interface MyClassRow {
  id: string;
  name: string;
  school_class_id: string | null;
}

/**
 * Réglages → Etablissement : rattachement à un collège partagé.
 * Non membre : rechercher / rejoindre / créer. Membre : collègues, profil affiché aux
 * élèves, rattachement de mes classes aux classes du collège, accès à l'import.
 */
export function SchoolSection({ onClose }: { onClose: () => void }) {
  const { settings } = useSettings();
  const { toast, confirm } = useUIFeedback();
  const navigate = useNavigate();

  const [school, setSchool] = useState<MySchool | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  // Profil affiché aux élèves (« SVT · M. Charles ») : prérempli depuis le profil enseignant.
  const [displayName, setDisplayName] = useState(settings.teacher.nom);
  const [subject, setSubject] = useState(settings.teacher.matiere);

  // Recherche / création
  const [query, setQuery] = useState(settings.establishment.name);
  const [results, setResults] = useState<SchoolSummary[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newSchool, setNewSchool] = useState({ name: settings.establishment.name, city: '', uai: '' });

  // Rattachement des classes
  const [myClasses, setMyClasses] = useState<MyClassRow[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);

  const load = useCallback(async () => {
    try {
      const s = await getMySchool();
      setSchool(s);
      if (s) {
        setDisplayName(s.my_display_name);
        setSubject(s.my_subject ?? '');
        const [{ data: cls }, scs] = await Promise.all([
          supabase.from('classes').select('id, name, school_class_id').order('name'),
          listSchoolClasses(),
        ]);
        setMyClasses((cls ?? []) as MyClassRow[]);
        setSchoolClasses(scs);
      }
    } catch (err) {
      toast(schoolErrorMessage(err), 'error');
      setSchool(null);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (err) { toast(schoolErrorMessage(err), 'error'); }
    finally { setBusy(false); }
  };

  const handleSearch = () => run(async () => { setResults(await searchSchools(query.trim())); });

  const profileOk = displayName.trim().length > 0;

  const handleJoin = (s: SchoolSummary) => run(async () => {
    await joinSchool(s.id, displayName.trim(), subject.trim());
    toast(`Vous avez rejoint ${s.name}.`, 'success');
    await load();
  });

  const handleCreate = () => run(async () => {
    await createSchool({
      name: newSchool.name.trim(), city: newSchool.city.trim(), uai: newSchool.uai.trim(),
      displayName: displayName.trim(), subject: subject.trim(),
    });
    toast('Collège créé.', 'success');
    await load();
  });

  const handleSaveProfile = () => run(async () => {
    await updateMySchoolProfile(displayName.trim(), subject.trim());
    toast('Profil mis à jour.', 'success');
    await load();
  });

  const handleRemove = async (userId: string, name: string, isMe: boolean) => {
    const ok = await confirm(isMe
      ? {
          title: 'Quitter le collège ?',
          message: "Vos classes ne seront plus proposées à vos collègues. Vos élèves restent chez vous.",
          confirmLabel: 'Quitter', variant: 'warning',
        }
      : {
          title: `Retirer ${name} ?`,
          message: "Ses classes ne seront plus proposées au collège. Les élèves qu'il/elle a déjà récupérés restent chez lui/elle.",
          confirmLabel: 'Retirer', variant: 'danger',
        });
    if (!ok) return;
    await run(async () => {
      await removeSchoolMember(isMe ? undefined : userId);
      await load();
    });
  };

  const handleLink = (cls: MyClassRow, value: string) => run(async () => {
    if (value === '__new__') await linkClassToSchoolClass(cls.id, { newName: cls.name });
    else await linkClassToSchoolClass(cls.id, { schoolClassId: value || null });
    await load();
  });

  const goImport = () => {
    onClose();
    navigate('/classes?import=school');
  };

  if (school === undefined) {
    return <p className="text-sm text-[var(--text-muted)]">Chargement…</p>;
  }

  const profileFields = (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nom affiché aux élèves</label>
        <input className={inputCls} value={displayName} placeholder="M. Dupont" onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Matière</label>
        <input className={inputCls} value={subject} placeholder="SVT" onChange={(e) => setSubject(e.target.value)} />
      </div>
    </div>
  );

  // ── Non membre ──
  if (!school) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">
          Rejoignez votre collège pour récupérer les élèves déjà saisis par vos collègues :
          ils gardent le même code de connexion.
        </p>
        {profileFields}
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={query}
            placeholder="Nom, ville ou UAI du collège"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
          />
          <button className="btn btn--primary" onClick={handleSearch} disabled={busy}>Chercher</button>
        </div>

        {results && (
          results.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Aucun collège trouvé.</p>
          ) : (
            <div className="space-y-2">
              {results.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{s.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {[s.city, s.uai, `${s.member_count} prof(s)`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <button className="btn btn--primary" style={{ fontSize: 12 }} onClick={() => handleJoin(s)} disabled={busy || !profileOk}>
                    Rejoindre
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {!showCreate ? (
          <button className="text-sm text-[var(--indigo)]" onClick={() => setShowCreate(true)}>
            Mon collège n'apparaît pas : le créer
          </button>
        ) : (
          <div className="space-y-3 p-3 rounded-lg border border-[var(--border)]">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nom du collège</label>
              <input className={inputCls} value={newSchool.name} onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Ville</label>
                <input className={inputCls} value={newSchool.city} onChange={(e) => setNewSchool({ ...newSchool, city: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">UAI (facultatif)</label>
                <input className={inputCls} value={newSchool.uai} placeholder="0541234X" maxLength={8} onChange={(e) => setNewSchool({ ...newSchool, uai: e.target.value })} />
              </div>
            </div>
            <button className="btn btn--primary" onClick={handleCreate} disabled={busy || !profileOk || !newSchool.name.trim()}>
              Créer le collège
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Membre ──
  const isAdmin = school.my_role === 'admin';
  return (
    <div className="space-y-5">
      <div className="px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="text-sm font-semibold text-[var(--text)]">{school.name}</div>
        <div className="text-xs text-[var(--text-muted)]">{[school.city, school.uai].filter(Boolean).join(' · ') || '—'}</div>
      </div>

      <div className="space-y-2">
        {profileFields}
        <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={handleSaveProfile} disabled={busy || !profileOk}>
          Enregistrer mon profil
        </button>
      </div>

      <div>
        <div className="text-xs font-semibold text-[var(--text-muted)] mb-2">Collègues ({school.members.length})</div>
        <div className="space-y-1">
          {school.members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between text-sm px-2 py-1">
              <span className="text-[var(--text)]">
                {m.display_name}{m.subject ? ` · ${m.subject}` : ''}
                {m.role === 'admin' && <span className="text-xs text-[var(--text-muted)]"> (créateur)</span>}
                {m.is_me && <span className="text-xs text-[var(--text-muted)]"> — vous</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)]">{new Date(m.joined_at).toLocaleDateString('fr-FR')}</span>
                {isAdmin && !m.is_me && (
                  <button className="text-xs text-red-500" onClick={() => handleRemove(m.user_id, m.display_name, false)} disabled={busy}>
                    Retirer
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">Mes classes dans le collège</div>
        <p className="text-xs text-[var(--text-muted)] mb-2">
          Rattachez vos classes pour que vos collègues puissent récupérer vos élèves.
          Un demi-groupe se rattache à sa classe d'origine ; une option ou un groupe mixte, à rien.
        </p>
        {myClasses.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Aucune classe.</p>
        ) : (
          <div className="space-y-1">
            {myClasses.map((cls) => (
              <div key={cls.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--text)] truncate">{cls.name}</span>
                <select
                  className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm"
                  value={cls.school_class_id ?? ''}
                  onChange={(e) => handleLink(cls, e.target.value)}
                  disabled={busy}
                >
                  <option value="">— non rattachée —</option>
                  {schoolClasses.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                  <option value="__new__">+ Créer « {cls.name} » dans le collège</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button className="btn btn--primary" onClick={goImport}>Récupérer des élèves du collège</button>
        <button className="text-xs text-red-500" onClick={() => handleRemove('', '', true)} disabled={busy}>
          Quitter le collège
        </button>
      </div>
    </div>
  );
}
