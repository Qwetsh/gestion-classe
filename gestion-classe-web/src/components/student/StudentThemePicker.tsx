import { useState } from 'react';
import { Check, Gift, Lock } from 'lucide-react';
import { STUDENT_THEMES, STUDENT_THEME_GROUPS, studentTheme, type StudentTheme, type StudentThemeId } from '../../lib/studentThemes';
import { canEarnTheme, isThemeUnlocked, type StudentThemeRights } from '../../lib/studentThemeUnlocks';

interface Props {
  value: StudentThemeId;
  /** Ce qui est ouvert à cet élève, et le nombre de thèmes qu'il peut encore choisir. */
  rights: StudentThemeRights;
  onChange: (id: StudentThemeId) => void;
  /** Débloque un thème « à gagner » ; rend false si le serveur a refusé. */
  onUnlock: (id: StudentThemeId) => Promise<boolean>;
}

/** Une ligne sous le nom d'un thème fermé : comment il s'obtient. */
function lockNote(theme: StudentTheme, earnable: boolean): string {
  if (theme.unlock === 'class') return 'S’ouvre avec le cours';
  return earnable ? 'À gagner : tu peux le choisir' : 'À gagner : une carte à tampons pleine';
}

/**
 * Écran « Mon thème », ouvert depuis l'accueil : les thèmes rangés par famille, un aperçu par thème,
 * appliqué dès l'appui. Chaque aperçu est peint dans les couleurs de son thème (fond, carte, accent),
 * pas dans celles du thème en cours. Un thème fermé porte un cadenas et dit comment il s'obtient ;
 * quand l'élève a gagné un thème, ceux « à gagner » deviennent choisissables, après confirmation.
 */
export function StudentThemePicker({ value, rights, onChange, onUnlock }: Props) {
  /** Thème « à gagner » en attente de confirmation. */
  const [pending, setPending] = useState<StudentThemeId | null>(null);
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState(false);

  const confirm = async () => {
    if (!pending) return;
    setSaving(true);
    setRefused(false);
    const ok = await onUnlock(pending);
    setSaving(false);
    if (ok) setPending(null);
    else setRefused(true);
  };

  return (
    <>
      <div className="el-head__titles">
        <span className="el-kicker">Il te suit sur tous tes appareils</span>
        <h1 className="el-h1">Mon thème</h1>
      </div>
      {rights.credits > 0 && (
        <div className="el-banner" role="status">
          <Gift size={20} aria-hidden />
          {rights.credits > 1 ? `Tu as gagné ${rights.credits} thèmes : choisis-les` : 'Tu as gagné un thème : choisis-le'} parmi ceux marqués « à gagner ».
        </div>
      )}
      {STUDENT_THEME_GROUPS.map((group) => (
        <section key={group.id} className="el-section">
          <h2 className="el-h2">{group.name}</h2>
          <div className="el-themes">
            {STUDENT_THEMES.filter((t) => t.group === group.id).map((t) => {
              const on = t.id === value;
              const open = isThemeUnlocked(rights, t.id);
              const earnable = canEarnTheme(rights, t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`el-theme${open ? '' : ' el-theme--locked'}${earnable ? ' el-theme--earn' : ''}`}
                  aria-pressed={on}
                  disabled={!open && !earnable}
                  onClick={() => { if (open) onChange(t.id); else { setRefused(false); setPending(t.id); } }}
                >
                  <span className="el-theme__view" aria-hidden style={{ background: t.bg }}>
                    <span className="el-theme__line" style={{ width: '55%', background: t.text }} />
                    <span className="el-theme__card" style={{ background: t.surface }}>
                      <span className="el-theme__dot" style={{ background: t.accent }} />
                      <span className="el-theme__line" style={{ flex: 1, background: t.text, opacity: 0.35 }} />
                    </span>
                    {!open && <span className="el-theme__lock"><Lock size={16} strokeWidth={2.2} /></span>}
                  </span>
                  <span className="el-theme__name">
                    {t.name}
                    {on && <Check size={18} aria-label="Thème choisi" style={{ color: 'var(--el-indigo)' }} />}
                  </span>
                  {open
                    ? <span className="el-theme__note">{t.note}{t.animated && <span className="el-theme__tag">animé</span>}</span>
                    : <span className="el-theme__note el-theme__note--lock">{lockNote(t, earnable)}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {pending && (
        <div className="el-sheet" role="dialog" aria-label={`Débloquer le thème ${studentTheme(pending).name}`}>
          <div className="el-sheet__box">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 17, lineHeight: '22px', fontWeight: 700 }}>Débloquer « {studentTheme(pending).name} » ?</span>
              <span className="el-note" style={{ fontSize: 14 }}>
                {rights.credits > 1 ? `Il te reste ${rights.credits} thèmes à choisir.` : 'C’est ton thème gagné.'} Une fois débloqué, tu le gardes.
              </span>
              {refused && <span className="el-error">Le thème n’a pas pu être débloqué. Réessaie.</span>}
            </div>
            <div className="el-grid2">
              <button type="button" className="el-btn" disabled={saving} onClick={() => setPending(null)}>Annuler</button>
              <button type="button" className="el-btn el-btn--primary" disabled={saving} onClick={() => { void confirm(); }}>
                {saving ? 'Un instant…' : 'Débloquer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
