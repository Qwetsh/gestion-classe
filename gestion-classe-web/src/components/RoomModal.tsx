import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { validateRoomName, validateGridDimensions } from '../lib/security';

// Un groupe = des cases liées formant une grande table (édité dans le plan de classe).
export interface TableGroup {
  id: string;
  label?: string;
  cells: string[]; // "r,c"
}

export interface Room {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
  disabled_cells: string[];
  layout_type?: string;
  table_groups?: TableGroup[];
}

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingRoom?: Room | null;
  userId: string;
}

export function RoomModal({ isOpen, onClose, onSaved, editingRoom, userId }: RoomModalProps) {
  const [roomName, setRoomName] = useState('');
  const [roomRows, setRoomRows] = useState(5);
  const [roomColumns, setRoomColumns] = useState(6);
  const [disabledCells, setDisabledCells] = useState<Set<string>>(new Set());
  // Liens de tables : préservés tels quels (édités dans le plan de classe), nettoyés aux bornes à la sauvegarde.
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingRoom) {
        setRoomName(editingRoom.name);
        setRoomRows(editingRoom.grid_rows);
        setRoomColumns(editingRoom.grid_cols);
        setDisabledCells(new Set(editingRoom.disabled_cells || []));
        setTableGroups(editingRoom.table_groups || []);
      } else {
        setRoomName('');
        setRoomRows(5);
        setRoomColumns(6);
        setDisabledCells(new Set());
        setTableGroups([]);
      }
      setFormError('');
    }
  }, [isOpen, editingRoom]);

  if (!isOpen) return null;

  const toggleCell = (row: number, col: number) => {
    const key = `${row},${col}`;
    setDisabledCells((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  const cleanDisabledCells = (rows: number, cols: number) => {
    setDisabledCells((prev) => {
      const newSet = new Set<string>();
      prev.forEach((key) => {
        const [r, c] = key.split(',').map(Number);
        if (r < rows && c < cols) newSet.add(key);
      });
      return newSet;
    });
  };

  const handleRowsChange = (delta: number) => {
    const newRows = Math.max(1, Math.min(10, roomRows + delta));
    setRoomRows(newRows);
    cleanDisabledCells(newRows, roomColumns);
  };

  const handleColumnsChange = (delta: number) => {
    const newCols = Math.max(1, Math.min(12, roomColumns + delta));
    setRoomColumns(newCols);
    cleanDisabledCells(roomRows, newCols);
  };

  const handleSave = async () => {
    const nameValidation = validateRoomName(roomName);
    if (!nameValidation.isValid) {
      setFormError(nameValidation.error || 'Nom invalide');
      return;
    }
    const gridValidation = validateGridDimensions(roomRows, roomColumns);
    if (!gridValidation.isValid) {
      setFormError(gridValidation.error || 'Dimensions invalides');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    const disabledCellsArray = Array.from(disabledCells);
    // Préserve les liens, en retirant les cases hors de la grille
    const cleanedGroups = tableGroups
      .map((g) => ({
        ...g,
        cells: g.cells.filter((cell) => {
          const [r, c] = cell.split(',').map(Number);
          return r < roomRows && c < roomColumns;
        }),
      }))
      .filter((g) => g.cells.length > 0);

    const payload = {
      name: roomName.trim(),
      grid_rows: roomRows,
      grid_cols: roomColumns,
      disabled_cells: disabledCellsArray,
      table_groups: cleanedGroups,
    };

    if (editingRoom) {
      const { error } = await supabase
        .from('rooms')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingRoom.id);
      if (error) {
        setFormError('Erreur lors de la modification');
        setIsSubmitting(false);
        return;
      }
    } else {
      const { error } = await supabase.from('rooms').insert({ ...payload, user_id: userId });
      if (error) {
        setFormError('Erreur lors de la creation');
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);
    onSaved();
    onClose();
  };

  const totalCells = roomRows * roomColumns;
  const activePlaces = totalCells - disabledCells.size;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
          {editingRoom ? 'Modifier la salle' : 'Nouvelle salle'}
        </h3>

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Nom de la salle</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Ex: Salle 204"
              className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
              autoFocus
            />
          </div>

          <div className="flex gap-6">
            <Stepper label="Rangées" value={roomRows} onDelta={handleRowsChange} min={1} max={10} />
            <Stepper label="Colonnes" value={roomColumns} onDelta={handleColumnsChange} min={1} max={12} />
          </div>

          <p className="text-sm text-[var(--text-dim)]">
            Cliquez sur une cellule pour créer une allée (espace vide). Le regroupement des tables se fait
            ensuite dans le plan de classe.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            <div className="flex-1 min-w-0">
              <div
                className="grid gap-1.5 sm:gap-2 bg-slate-100 dark:bg-slate-800 p-3 sm:p-4 rounded-xl"
                style={{ gridTemplateColumns: `repeat(${roomColumns}, 1fr)` }}
              >
                {Array.from({ length: roomRows * roomColumns }).map((_, i) => {
                  const row = Math.floor(i / roomColumns);
                  const col = i % roomColumns;
                  const key = `${row},${col}`;
                  const isDisabled = disabledCells.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleCell(row, col)}
                      className="aspect-square rounded-md sm:rounded-lg border-2 transition-all duration-150 active:scale-95 sm:hover:scale-105"
                      style={
                        isDisabled
                          ? {
                              backgroundColor: '#94a3b8',
                              borderColor: '#64748b',
                              backgroundImage:
                                'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 6px)',
                            }
                          : { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }
                      }
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex sm:flex-col gap-4 sm:w-32">
              <div className="p-3 bg-[var(--bg)] rounded-lg flex-1 sm:flex-none">
                <div className="text-2xl font-bold text-[var(--indigo)]">{activePlaces}</div>
                <div className="text-xs text-[var(--text-dim)]">
                  place{activePlaces > 1 ? 's' : ''} disponible{activePlaces > 1 ? 's' : ''}
                </div>
                {disabledCells.size > 0 && (
                  <div className="text-xs text-[var(--text-dim)] mt-1">
                    ({disabledCells.size} allée{disabledCells.size > 1 ? 's' : ''})
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {formError && <p className="text-red-500 text-sm mb-4">{formError}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]"
            disabled={isSubmitting}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[var(--indigo)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'En cours...' : editingRoom ? 'Modifier' : 'Creer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onDelta,
  min,
  max,
}: {
  label: string;
  value: number;
  onDelta: (delta: number) => void;
  min: number;
  max: number;
}) {
  const btn =
    'w-10 h-10 flex items-center justify-center bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--indigo)] hover:text-white disabled:opacity-50 disabled:hover:bg-[var(--bg)] disabled:hover:text-[var(--text)] transition-colors';
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text)] mb-2">{label}</label>
      <div className="flex items-center gap-2">
        <button onClick={() => onDelta(-1)} disabled={value <= min} className={btn}>-</button>
        <span className="w-8 text-center font-semibold text-[var(--text)]">{value}</span>
        <button onClick={() => onDelta(1)} disabled={value >= max} className={btn}>+</button>
      </div>
    </div>
  );
}
