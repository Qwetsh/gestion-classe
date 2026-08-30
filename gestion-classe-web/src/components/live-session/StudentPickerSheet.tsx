import { DB } from './directionB';
import { MobileSheet, SheetTitle, SheetGhostButton } from './MobileSheet';

interface PickerStudent {
  id: string;
  pseudo: string;
  badge?: string;
}

interface StudentPickerSheetProps {
  title: string;
  subtitle?: string;
  students: PickerStudent[];
  onSelect: (student: PickerStudent) => void;
  onClose: () => void;
}

/** Sheet generique de selection d'eleve (Remarque, Oral > Choisir, Supprimer). */
export function StudentPickerSheet({ title, subtitle, students, onSelect, onClose }: StudentPickerSheetProps) {
  const sorted = [...students].sort((a, b) => a.pseudo.localeCompare(b.pseudo));

  return (
    <MobileSheet onClose={onClose}>
      <SheetTitle>{title}</SheetTitle>
      {subtitle && (
        <p style={{ fontSize: 13, color: DB.textSecondary, margin: '0 0 12px' }}>{subtitle}</p>
      )}

      <div
        className="overflow-y-auto mb-4"
        style={{
          maxHeight: 340,
          border: `1px solid ${DB.border}`,
          borderRadius: 14,
        }}
      >
        {sorted.map((student, index) => (
          <button
            key={student.id}
            onClick={() => onSelect(student)}
            className="w-full flex items-center justify-between text-left active:bg-black/5"
            style={{
              padding: '13px 16px',
              border: 'none',
              borderTop: index > 0 ? `1px solid ${DB.borderLight}` : 'none',
              background: 'transparent',
            }}
          >
            <span className="truncate" style={{ fontSize: 15, fontWeight: 500, color: DB.text }}>
              {student.pseudo}
            </span>
            {student.badge && (
              <span
                className="shrink-0 ml-2"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: DB.textSecondary,
                  background: '#F3F4F7',
                  borderRadius: 999,
                  padding: '3px 8px',
                }}
              >
                {student.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex">
        <SheetGhostButton onClick={onClose}>Annuler</SheetGhostButton>
      </div>
    </MobileSheet>
  );
}
