import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';

interface Room {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
  created_at: string;
}

export function Rooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);

  // Form states
  const [roomName, setRoomName] = useState('');
  const [roomRows, setRoomRows] = useState(5);
  const [roomColumns, setRoomColumns] = useState(6);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRooms = async () => {
    if (!user) return;
    setIsLoading(true);

    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    setRooms(data || []);
    setIsLoading(false);
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
    } else {
      setEditingRoom(null);
      setRoomName('');
      setRoomRows(5);
      setRoomColumns(6);
    }
    setFormError('');
    setShowModal(true);
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

    if (editingRoom) {
      const { error } = await supabase
        .from('rooms')
        .update({
          name: roomName.trim(),
          grid_rows: roomRows,
          grid_cols: roomColumns,
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

                {/* Mini grid preview */}
                <div
                  className="grid gap-1.5 bg-gradient-to-br from-slate-100/80 to-slate-200/50 dark:from-slate-800/50 dark:to-slate-700/30 p-3 rounded-xl backdrop-blur-sm border border-white/20"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(room.grid_cols, 8)}, 1fr)`,
                  }}
                >
                  {Array.from({ length: Math.min(room.grid_rows * room.grid_cols, 24) }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square bg-gradient-to-br from-white/80 to-white/40 dark:from-white/20 dark:to-white/5 rounded-md shadow-sm border border-white/40"
                    />
                  ))}
                </div>

                {/* Capacity badge */}
                <div className="mt-4 flex justify-between items-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full backdrop-blur-sm border border-blue-200/30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {room.grid_rows * room.grid_cols} places
                  </span>
                  {room.grid_rows * room.grid_cols > 24 && (
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      +{room.grid_rows * room.grid_cols - 24} non affichees
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Room Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
                {editingRoom ? 'Modifier la salle' : 'Nouvelle salle'}
              </h3>
              <div className="space-y-4 mb-4">
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                      Rangees
                    </label>
                    <input
                      type="number"
                      value={roomRows}
                      onChange={(e) => setRoomRows(Number(e.target.value))}
                      min={1}
                      max={10}
                      className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                      Colonnes
                    </label>
                    <input
                      type="number"
                      value={roomColumns}
                      onChange={(e) => setRoomColumns(Number(e.target.value))}
                      min={1}
                      max={12}
                      className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)]"
                    />
                  </div>
                </div>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Capacite: {roomRows * roomColumns} places
                </p>
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
