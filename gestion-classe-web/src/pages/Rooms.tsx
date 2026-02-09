import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';

interface Room {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
  disabled_cells: string[];
  created_at: string;
}

export function Rooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);

  // Form states
  const [roomName, setRoomName] = useState('');
  const [roomRows, setRoomRows] = useState(5);
  const [roomColumns, setRoomColumns] = useState(6);
  const [disabledCells, setDisabledCells] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRooms = async () => {
    if (!user) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;

      setRooms((data || []).map(r => ({
        ...r,
        disabled_cells: r.disabled_cells || []
      })));
    } catch (err) {
      console.error('Error loading rooms:', err);
      setLoadError('Erreur lors du chargement des salles.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, [user]);

  const handleOpenModal = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setRoomName(room.name);
      setRoomRows(room.grid_rows);
      setRoomColumns(room.grid_cols);
      setDisabledCells(new Set(room.disabled_cells || []));
    } else {
      setEditingRoom(null);
      setRoomName('');
      setRoomRows(5);
      setRoomColumns(6);
      setDisabledCells(new Set());
    }
    setFormError('');
    setShowModal(true);
  };

  // Toggle a cell between active (place) and disabled (allee)
  const toggleCell = (row: number, col: number) => {
    const key = `${row},${col}`;
    setDisabledCells(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Clean up disabled cells when grid size changes
  const cleanDisabledCells = (rows: number, cols: number) => {
    setDisabledCells(prev => {
      const newSet = new Set<string>();
      prev.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        if (r < rows && c < cols) {
          newSet.add(key);
        }
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

  const handleSaveRoom = async () => {
    if (!roomName.trim()) {
      setFormError('Le nom de la salle est requis');
      return;
    }
    if (roomRows < 1 || roomRows > 10) {
      setFormError('Le nombre de rangees doit etre entre 1 et 10');
      return;
    }
    if (roomColumns < 1 || roomColumns > 12) {
      setFormError('Le nombre de colonnes doit etre entre 1 et 12');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const disabledCellsArray = Array.from(disabledCells);

    if (editingRoom) {
      const { error } = await supabase
        .from('rooms')
        .update({
          name: roomName.trim(),
          grid_rows: roomRows,
          grid_cols: roomColumns,
          disabled_cells: disabledCellsArray,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingRoom.id);

      if (error) {
        setFormError('Erreur lors de la modification');
        setIsSubmitting(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('rooms')
        .insert({
          name: roomName.trim(),
          grid_rows: roomRows,
          grid_cols: roomColumns,
          disabled_cells: disabledCellsArray,
          user_id: user!.id,
        });

      if (error) {
        setFormError('Erreur lors de la creation');
        setIsSubmitting(false);
        return;
      }
    }

    setShowModal(false);
    setIsSubmitting(false);
    loadRooms();
  };

  const handleOpenDeleteModal = (room: Room) => {
    setDeleteTarget(room);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);

    await supabase.from('rooms').delete().eq('id', deleteTarget.id);

    setShowDeleteModal(false);
    setDeleteTarget(null);
    setIsSubmitting(false);
    loadRooms();
  };

  // Computed values for the form
  const totalCells = roomRows * roomColumns;
  const activePlaces = totalCells - disabledCells.size;

  // Check if a cell is disabled in a room (for preview)
  const isCellDisabled = (room: Room, row: number, col: number) => {
    return room.disabled_cells?.includes(`${row},${col}`);
  };

  // Count active places for a room
  const getActivePlaces = (room: Room) => {
    const total = room.grid_rows * room.grid_cols;
    const disabled = room.disabled_cells?.length || 0;
    return total - disabled;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-[var(--color-text-secondary)]">Chargement...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Error banner */}
      {loadError && (
        <div
          className="bg-[var(--color-error-soft)] text-[var(--color-error)] p-4 mb-4 flex items-center justify-between"
          style={{ borderRadius: 'var(--radius-lg)' }}
        >
          <span>{loadError}</span>
          <button
            onClick={() => setLoadError(null)}
            className="text-[var(--color-error)] hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Page title */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Salles</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              {rooms.length} salle{rooms.length > 1 ? 's' : ''} configuree{rooms.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span>+</span> Nouvelle salle
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="bg-[var(--color-surface)] rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">🏫</div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">
              Aucune salle
            </h2>
            <p className="text-[var(--color-text-tertiary)] mt-2">
              Configurez vos salles de classe pour les plans de classe
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="group relative backdrop-blur-xl bg-white/70 dark:bg-white/10 border border-white/20 rounded-2xl p-5 shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 overflow-hidden"
              >
                {/* Gradient accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-80" />

                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur flex items-center justify-center border border-white/30">
                      <span className="text-2xl">🏫</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-[var(--color-text)]">
                        {room.name}
                      </h3>
                      <p className="text-sm text-[var(--color-text-tertiary)]">
                        {room.grid_rows} × {room.grid_cols}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => handleOpenModal(room)}
                      className="p-2.5 bg-white/50 hover:bg-white/80 text-blue-600 rounded-xl backdrop-blur-sm border border-white/30 transition-all hover:scale-110"
                      title="Modifier"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleOpenDeleteModal(room)}
                      className="p-2.5 bg-white/50 hover:bg-red-50 text-red-500 rounded-xl backdrop-blur-sm border border-white/30 transition-all hover:scale-110"
                      title="Supprimer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Mini grid preview with disabled cells */}
                <div
                  className="grid gap-1.5 bg-gradient-to-br from-slate-100/80 to-slate-200/50 dark:from-slate-800/50 dark:to-slate-700/30 p-3 rounded-xl backdrop-blur-sm border border-white/20"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(room.grid_cols, 8)}, 1fr)`,
                  }}
                >
                  {Array.from({ length: Math.min(room.grid_rows * room.grid_cols, 24) }).map((_, i) => {
                    const row = Math.floor(i / room.grid_cols);
                    const col = i % room.grid_cols;
                    const isDisabled = isCellDisabled(room, row, col);

                    return (
                      <div
                        key={i}
                        className={`aspect-square rounded-md shadow-sm border ${
                          isDisabled
                            ? 'bg-slate-300/50 dark:bg-slate-600/50 border-slate-400/30'
                            : 'bg-gradient-to-br from-white/80 to-white/40 dark:from-white/20 dark:to-white/5 border-white/40'
                        }`}
                        style={isDisabled ? {
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)'
                        } : undefined}
                      />
                    );
                  })}
                </div>

                {/* Capacity badge */}
                <div className="mt-4 flex justify-between items-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full backdrop-blur-sm border border-blue-200/30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {getActivePlaces(room)} places
                  </span>
                  {(room.disabled_cells?.length || 0) > 0 && (
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {room.disabled_cells.length} allee{room.disabled_cells.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Room Modal with Grid Editor */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
                {editingRoom ? 'Modifier la salle' : 'Nouvelle salle'}
              </h3>

              <div className="space-y-4 mb-4">
                {/* Room name */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                    Nom de la salle
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Ex: Salle 204"
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)]"
                    autoFocus
                  />
                </div>

                {/* Grid size controls */}
                <div className="flex gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Rangees
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRowsChange(-1)}
                        disabled={roomRows <= 1}
                        className="w-10 h-10 flex items-center justify-center bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-primary)] hover:text-white disabled:opacity-50 disabled:hover:bg-[var(--color-background)] disabled:hover:text-[var(--color-text)] transition-colors"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-semibold text-[var(--color-text)]">{roomRows}</span>
                      <button
                        onClick={() => handleRowsChange(1)}
                        disabled={roomRows >= 10}
                        className="w-10 h-10 flex items-center justify-center bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-primary)] hover:text-white disabled:opacity-50 disabled:hover:bg-[var(--color-background)] disabled:hover:text-[var(--color-text)] transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Colonnes
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleColumnsChange(-1)}
                        disabled={roomColumns <= 1}
                        className="w-10 h-10 flex items-center justify-center bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-primary)] hover:text-white disabled:opacity-50 disabled:hover:bg-[var(--color-background)] disabled:hover:text-[var(--color-text)] transition-colors"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-semibold text-[var(--color-text)]">{roomColumns}</span>
                      <button
                        onClick={() => handleColumnsChange(1)}
                        disabled={roomColumns >= 12}
                        className="w-10 h-10 flex items-center justify-center bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-primary)] hover:text-white disabled:opacity-50 disabled:hover:bg-[var(--color-background)] disabled:hover:text-[var(--color-text)] transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Cliquez sur une cellule pour creer une allee (espace vide)
                </p>

                {/* Interactive grid editor */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                  <div className="flex-1 min-w-0">
                    <div
                      className="grid gap-1.5 sm:gap-2 bg-slate-100 dark:bg-slate-800 p-3 sm:p-4 rounded-xl"
                      style={{
                        gridTemplateColumns: `repeat(${roomColumns}, 1fr)`,
                      }}
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
                            className={`aspect-square rounded-md sm:rounded-lg border-2 transition-all duration-150 active:scale-95 sm:hover:scale-105 ${
                              isDisabled
                                ? 'bg-slate-400 dark:bg-slate-600 border-slate-500 dark:border-slate-500'
                                : 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-600 sm:hover:bg-blue-200'
                            }`}
                            style={isDisabled ? {
                              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 6px)'
                            } : undefined}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Legend and stats */}
                  <div className="flex sm:flex-col gap-4 sm:w-32">
                    <div className="text-sm text-[var(--color-text)]">
                      <p className="font-medium mb-2">Legende</p>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-600 rounded" />
                        <span className="text-[var(--color-text-tertiary)]">Place</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 bg-slate-400 dark:bg-slate-600 border border-slate-500 rounded"
                          style={{
                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)'
                          }}
                        />
                        <span className="text-[var(--color-text-tertiary)]">Allee</span>
                      </div>
                    </div>

                    <div className="p-3 bg-[var(--color-background)] rounded-lg flex-1 sm:flex-none">
                      <div className="text-2xl font-bold text-[var(--color-primary)]">
                        {activePlaces}
                      </div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        place{activePlaces > 1 ? 's' : ''} disponible{activePlaces > 1 ? 's' : ''}
                      </div>
                      {disabledCells.size > 0 && (
                        <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
                          ({disabledCells.size} allee{disabledCells.size > 1 ? 's' : ''})
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {formError && (
                <p className="text-red-500 text-sm mb-4">{formError}</p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveRoom}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'En cours...' : editingRoom ? 'Modifier' : 'Creer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deleteTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
                Confirmer la suppression
              </h3>
              <p className="text-[var(--color-text-secondary)] mb-6">
                Voulez-vous vraiment supprimer la salle "{deleteTarget.name}" ?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
