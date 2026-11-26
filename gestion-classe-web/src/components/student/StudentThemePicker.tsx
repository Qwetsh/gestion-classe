import { Check } from 'lucide-react';
import { STUDENT_THEMES, type StudentThemeId } from '../../lib/studentThemes';

interface Props {
  value: StudentThemeId;
  onChange: (id: StudentThemeId) => void;
}

/**
 * Choix du thème, en bas de l'accueil : un aperçu par thème, appliqué dès l'appui. Chaque aperçu
 * est peint dans les couleurs de son thème (fond, carte, accent), pas dans celles du thème en cours.
 */
export function StudentThemePicker({ value, onChange }: Props) {
  return (
    <section className="el-section">
      <h2 className="el-h2">Mon thème</h2>
      <div className="el-themes">
        {STUDENT_THEMES.map((t) => {
          const on = t.id === value;
          return (
            <button key={t.id} type="button" className="el-theme" aria-pressed={on} onClick={() => onChange(t.id)}>
              <span className="el-theme__view" aria-hidden style={{ background: t.bg }}>
                <span className="el-theme__line" style={{ width: '55%', background: t.text }} />
                <span className="el-theme__card" style={{ background: t.surface }}>
                  <span className="el-theme__dot" style={{ background: t.accent }} />
                  <span className="el-theme__line" style={{ flex: 1, background: t.text, opacity: 0.35 }} />
                </span>
              </span>
              <span className="el-theme__name">
                {t.name}
                {on && <Check size={18} aria-label="Thème choisi" style={{ color: 'var(--el-indigo)' }} />}
              </span>
              <span className="el-theme__note">{t.note}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
