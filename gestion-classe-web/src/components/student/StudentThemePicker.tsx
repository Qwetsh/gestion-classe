import { useState } from 'react';
import { Award, BookOpen, Check, Flag, FlaskConical, FolderOpen, Gift, Hand, Lock, Mic, Stamp, type LucideIcon } from 'lucide-react';
import { STUDENT_THEMES, STUDENT_THEME_GROUPS, studentTheme, type StudentTheme, type StudentThemeId } from '../../lib/studentThemes';
import { studentThemeThumb } from '../../lib/studentThemeThumbs';
import { canEarnTheme, goalFor, goalRatio, isThemeUnlocked, type StudentThemeRights, type ThemeGoal, type ThemeGoalKind } from '../../lib/studentThemeUnlocks';

interface Props {
  value: StudentThemeId;
  /** Ce qui est ouvert à cet élève, et le nombre de thèmes qu'il peut encore choisir. */
  rights: StudentThemeRights;
  /** Tampons sur la carte en cours ; null si la classe n'a pas les tampons. */
  stampCount: number | null;
  onChange: (id: StudentThemeId) => void;
  /** Débloque un thème « à gagner » ; rend false si le serveur a refusé. */
  onUnlock: (id: StudentThemeId) => Promise<boolean>;
}

const GOAL_ICON: Record<ThemeGoalKind, LucideIcon> = {
  class: BookOpen, stamps: Stamp, grade: Award, implication: Hand, tp: FlaskConical, oral: Mic, binder: FolderOpen, chapter: Flag,
};

const number = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');

/** « 7 sur 10 tampons », « 13,5 sur 15 » */
const progressText = (goal: ThemeGoal): string =>
  goal.progress ? `${number(goal.progress.value)} sur ${number(goal.progress.target)}${goal.progress.unit ? ` ${goal.progress.unit}` : ''}` : '';

/** L'image d'un thème : une vignette de son vrai décor, sur sa couleur de fond. */
function Thumb({ theme, className }: { theme: StudentTheme; className: string }) {
  const src = studentThemeThumb(theme.id);
  return (
    <span className={className} aria-hidden style={{ background: theme.bg }}>
      {src && <img src={src} alt="" loading="lazy" decoding="async" />}
    </span>
  );
}

/**
 * Écran « Mon thème », ouvert depuis l'accueil : les thèmes rangés par famille, chacun montré par une
 * vignette de son décor, appliqué dès l'appui. Un thème fermé est grisé sous un cadenas et annonce son
 * défi (et où en est l'élève, quand cela se mesure) ; le toucher ouvre sa fiche : le décor en grand,
 * comment l'obtenir, et le bouton pour le débloquer quand l'élève a un thème à choisir.
 */
export function StudentThemePicker({ value, rights, stampCount, onChange, onUnlock }: Props) {
  /** Thème fermé dont la fiche est ouverte. */
  const [shown, setShown] = useState<StudentThemeId | null>(null);
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState(false);

  const openCount = STUDENT_THEMES.filter((t) => isThemeUnlocked(rights, t.id)).length;
  const sheet = shown && !isThemeUnlocked(rights, shown) ? studentTheme(shown) : null;
  const sheetGoal = sheet ? goalFor(rights, sheet, stampCount) : null;
  const sheetEarnable = sheet ? canEarnTheme(rights, sheet.id) : false;
  const SheetIcon = sheetEarnable ? Gift : sheetGoal ? GOAL_ICON[sheetGoal.kind] : Lock;

  const confirm = async () => {
    if (!sheet) return;
    setSaving(true);
    setRefused(false);
    const ok = await onUnlock(sheet.id);
    setSaving(false);
    if (ok) setShown(null);
    else setRefused(true);
  };

  return (
    <>
      <div className="el-head__titles">
        <span className="el-kicker">Il te suit sur tous tes appareils</span>
        <h1 className="el-h1">Mon thème</h1>
      </div>
      <div className="el-collection">
        <span><b>{openCount}</b> thèmes sur {STUDENT_THEMES.length}</span>
        <div className="el-bar" aria-hidden><span style={{ width: `${(openCount / STUDENT_THEMES.length) * 100}%` }} /></div>
      </div>
      {rights.credits > 0 && (
        <div className="el-banner" role="status">
          <Gift size={20} aria-hidden />
          {rights.credits > 1 ? `Tu as gagné ${rights.credits} thèmes : choisis-les` : 'Tu as gagné un thème : choisis-le'} parmi ceux marqués « À choisir ».
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
              const goal = open ? null : goalFor(rights, t, stampCount);
              const GoalIcon = earnable ? Gift : goal ? GOAL_ICON[goal.kind] : Lock;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`el-theme${open ? '' : ' el-theme--locked'}${earnable ? ' el-theme--earn' : ''}`}
                  aria-pressed={on}
                  onClick={() => { if (open) onChange(t.id); else { setRefused(false); setShown(t.id); } }}
                >
                  <span className="el-theme__frame">
                    <Thumb theme={t} className="el-theme__view" />
                    {on && <span className="el-theme__mark el-theme__mark--on"><Check size={16} strokeWidth={2.6} aria-label="Thème choisi" /></span>}
                    {!open && <span className="el-theme__mark">{earnable ? <Gift size={18} strokeWidth={2.2} /> : <Lock size={17} strokeWidth={2.2} />}</span>}
                  </span>
                  <span className="el-theme__name">{t.name}</span>
                  {open && <span className="el-theme__note">{t.note}</span>}
                  {!open && (
                    <span className="el-theme__goal">
                      <GoalIcon size={15} strokeWidth={2} aria-hidden />
                      {earnable ? 'À choisir' : goal?.label ?? 'Fermé'}
                    </span>
                  )}
                  {!open && !earnable && goal?.progress && (
                    <span className="el-theme__progress" aria-label={progressText(goal)}>
                      <span style={{ width: `${goalRatio(goal) * 100}%` }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {sheet && (
        <div className="el-sheet" role="dialog" aria-label={`Thème ${sheet.name}`} onClick={() => { if (!saving) setShown(null); }}>
          <div className="el-sheet__box" onClick={(e) => e.stopPropagation()}>
            <Thumb theme={sheet} className="el-sheet__view" />
            <div className="el-sheet__titles">
              <span className="el-sheet__name">{sheet.name}</span>
              <span className="el-note">{sheet.note}</span>
            </div>
            <div className="el-goal">
              <span className="el-icon-box"><SheetIcon size={22} strokeWidth={1.8} aria-hidden /></span>
              <div className="el-goal__body">
                <span className="el-goal__title">{sheetEarnable ? 'Tu peux le choisir' : 'Comment l’obtenir'}</span>
                <span className="el-goal__text">
                  {sheetEarnable
                    ? `${rights.credits > 1 ? `Il te reste ${rights.credits} thèmes à choisir.` : 'C’est ton thème gagné.'} Une fois débloqué, tu le gardes.`
                    : sheetGoal?.detail ?? 'Ce thème n’est pas encore ouvert.'}
                </span>
                {!sheetEarnable && sheetGoal?.progress && (
                  <>
                    <div className="el-bar" aria-hidden><span style={{ width: `${goalRatio(sheetGoal) * 100}%` }} /></div>
                    <span className="el-goal__count">{progressText(sheetGoal)}</span>
                  </>
                )}
              </div>
            </div>
            {refused && <span className="el-error">Le thème n’a pas pu être débloqué. Réessaie.</span>}
            {sheetEarnable ? (
              <div className="el-grid2">
                <button type="button" className="el-btn" disabled={saving} onClick={() => setShown(null)}>Annuler</button>
                <button type="button" className="el-btn el-btn--primary" disabled={saving} onClick={() => { void confirm(); }}>
                  {saving ? 'Un instant…' : 'Débloquer'}
                </button>
              </div>
            ) : (
              <button type="button" className="el-btn" onClick={() => setShown(null)}>Fermer</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
