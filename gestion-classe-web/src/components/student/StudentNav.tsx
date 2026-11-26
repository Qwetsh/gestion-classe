import { BookOpen, ChartColumn, House, Shield, Stamp, type LucideIcon } from 'lucide-react';

/** Les cinq entrées de l'espace élève (direction A). Tampons et Maison n'existent que si la classe les a. */
export type StudentView = 'home' | 'notes' | 'cours' | 'stamps' | 'academy';

const ENTRIES: { key: StudentView; label: string; Icon: LucideIcon }[] = [
  { key: 'home', label: 'Accueil', Icon: House },
  { key: 'notes', label: 'Notes', Icon: ChartColumn },
  { key: 'cours', label: 'Cours', Icon: BookOpen },
  { key: 'stamps', label: 'Tampons', Icon: Stamp },
  { key: 'academy', label: 'Maison', Icon: Shield },
];

interface Props {
  active: StudentView;
  /** Entrées ouvertes à cet élève, dans l'ordre de la barre. */
  available: StudentView[];
  onChange: (view: StudentView) => void;
  /** Sur l'onglet Maison, la barre garde les teintes sombres de l'Académie. */
  academy?: boolean;
}

/** Barre du bas : toujours au même endroit, à portée de pouce. */
export function StudentNav({ active, available, onChange, academy }: Props) {
  return (
    <nav className={academy ? 'el-nav el-nav--academy' : 'el-nav'} aria-label="Navigation">
      <div className="el-nav__inner">
        {ENTRIES.filter((e) => available.includes(e.key)).map(({ key, label, Icon }) => (
          <button key={key} type="button" onClick={() => onChange(key)} aria-current={active === key ? 'page' : undefined}>
            <Icon size={24} strokeWidth={1.8} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
