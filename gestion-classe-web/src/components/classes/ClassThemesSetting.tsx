import { useEffect, useState } from 'react';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { STUDENT_THEMES, type StudentTheme, type StudentThemeId } from '../../lib/studentThemes';
import { fetchClassThemes, setClassTheme } from '../../lib/studentThemeUnlocks';
import { VisibilityToggle } from '../VisibilityToggle';

const WITH_COURSE = STUDENT_THEMES.filter((t) => t.unlock === 'class');
/** Thèmes « avec le cours », rangés par matière (sciences, français). */
const COURSE_SUBJECTS = [
  { title: 'Avec le cours de sciences', themes: WITH_COURSE.filter((t) => t.group === 'sciences') },
  { title: 'Avec le cours de français', themes: WITH_COURSE.filter((t) => t.group === 'francais') },
  { title: 'Avec le cours', themes: WITH_COURSE.filter((t) => t.group !== 'sciences' && t.group !== 'francais') },
].filter((s) => s.themes.length > 0);
const TO_EARN = STUDENT_THEMES.filter((t) => t.unlock === 'card');

const heading: React.CSSProperties = { padding: '6px 8px 2px', fontSize: 11, lineHeight: '15px', color: 'var(--text-muted)' };

/**
 * Thèmes de l'espace élève ouverts à une classe (page Classes, sous « Visibilité élèves »).
 * Six thèmes sont libres pour tous et n'apparaissent pas ici. Les thèmes de sciences et ceux de
 * français s'ouvrent avec le cours ; les autres se gagnent par les tampons, mais peuvent aussi être
 * ouverts à toute la classe.
 */
export function ClassThemesSetting({ classId, userId }: { classId: string; userId: string }) {
  const { toast } = useUIFeedback();
  const [unfolded, setUnfolded] = useState(false);
  /** Thèmes ouverts à la classe affichée ; null pendant la lecture. */
  const [loaded, setLoaded] = useState<{ classId: string; themes: StudentThemeId[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const themes = loaded?.classId === classId ? loaded.themes : null;

  useEffect(() => {
    let alive = true;
    fetchClassThemes(classId)
      .then((list) => { if (alive) setLoaded({ classId, themes: list }); })
      .catch(() => { if (alive) setLoaded({ classId, themes: [] }); });
    return () => { alive = false; };
  }, [classId]);

  const toggle = async (theme: StudentTheme) => {
    if (!themes || saving) return;
    const open = !themes.includes(theme.id);
    setLoaded({ classId, themes: open ? [...themes, theme.id] : themes.filter((id) => id !== theme.id) });
    setSaving(true);
    try {
      await setClassTheme(classId, userId, theme.id, open);
    } catch (err) {
      console.error('Error saving class theme:', err);
      toast('Erreur lors de la mise à jour', 'error');
      setLoaded({ classId, themes });
    } finally {
      setSaving(false);
    }
  };

  const line = (theme: StudentTheme) => (
    <VisibilityToggle
      key={theme.id}
      icon={<span aria-hidden style={{ display: 'block', width: 12, height: 12, borderRadius: 6, background: theme.accent, boxShadow: `0 0 0 2px ${theme.bg}, 0 0 0 3px var(--border)` }} />}
      label={theme.name}
      enabled={!!themes?.includes(theme.id)}
      disabled={!themes || saving}
      onToggle={() => { void toggle(theme); }}
    />
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setUnfolded((o) => !o)}
        aria-expanded={unfolded}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 28,
          padding: '4px 6px', border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text)',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
        }}
        title="Thèmes de l'espace élève ouverts à toute cette classe"
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={{ display: 'inline-block', width: 14, textAlign: 'center', transform: unfolded ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>▸</span>
          Thèmes ouverts
        </span>
        <span style={{ color: 'var(--text-muted)' }}>{themes ? `${themes.length} sur ${WITH_COURSE.length + TO_EARN.length}` : '…'}</span>
      </button>
      {unfolded && (
        <>
          {COURSE_SUBJECTS.map((subject) => (
            <div key={subject.title}>
              <div style={heading}>{subject.title}</div>
              {subject.themes.map(line)}
            </div>
          ))}
          <div style={heading}>Se gagnent aussi par les tampons</div>
          {TO_EARN.map(line)}
        </>
      )}
    </>
  );
}
