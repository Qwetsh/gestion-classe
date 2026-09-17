/**
 * Vue « Répartition » des groupes de classe (demi-groupes durables) — modale plein écran.
 *
 * Gestes :
 *  - glisser-déposer une pastille d'une colonne à l'autre (un geste = un transvasement)
 *  - clic sur une pastille : sélection ; barre d'action « Déplacer vers… » / « Échanger »
 *  - annulation après chaque geste
 * Distinct des groupes de TP (GroupSetup / GroupSessionContext).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import {
  fetchClassGroups,
  fetchGroupMembers,
  createClassGroup,
  updateClassGroup,
  deleteClassGroup,
  moveStudent,
  swapStudents,
  replaceMembers,
  applyAutoSplit,
  createGroupFromRoomPlan,
  fetchRoomPlanStudentIds,
  type ClassGroupInfo,
  type ClassGroupMemberInfo,
} from '../../lib/classGroupQueries';
import { autoSplit, sortClassGroups, type AutoSplitMode } from '../../lib/sessionRoster';
import { CLASS_GROUP_COLORS, classGroupColor, nextClassGroupColorKey } from '../../lib/classGroupColors';

interface StudentLike {
  id: string;
  pseudo: string;
}

interface RoomLike {
  id: string;
  name: string;
}

interface GroupSplitterProps {
  userId: string;
  classId: string;
  className: string;
  students: StudentLike[];
  rooms: RoomLike[];
  onClose: () => void;
}

interface UndoState {
  label: string;
  run: () => Promise<void>;
}

type Panel =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; group: ClassGroupInfo }
  | { kind: 'autosplit' }
  | { kind: 'fromRoom'; groupId: string | null };

export function GroupSplitter({ userId, classId, className, students, rooms, onClose }: GroupSplitterProps) {
  const { toast, confirm } = useUIFeedback();
  const [groups, setGroups] = useState<ClassGroupInfo[]>([]);
  const [members, setMembers] = useState<ClassGroupMemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState(CLASS_GROUP_COLORS[0].key);

  const reload = useCallback(async () => {
    const [g, m] = await Promise.all([fetchClassGroups(classId), fetchGroupMembers(classId)]);
    setGroups(sortClassGroups(g));
    setMembers(m);
  }, [classId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload()
      .catch(err => toast(`Groupes : ${err instanceof Error ? err.message : 'erreur'}`, 'error'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload, toast]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  // Échap ferme la modale
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const groupsOfStudent = useMemo(() => {
    const map = new Map<string, string[]>();
    const known = new Set(groups.map(g => g.id));
    for (const m of members) {
      if (!known.has(m.group_id)) continue;
      const list = map.get(m.student_id) ?? [];
      list.push(m.group_id);
      map.set(m.student_id, list);
    }
    return map;
  }, [members, groups]);

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr')),
    [students]
  );

  const columns = useMemo(() => {
    const byGroup = new Map<string, StudentLike[]>();
    for (const g of groups) byGroup.set(g.id, []);
    const unassigned: StudentLike[] = [];
    for (const s of sortedStudents) {
      const gids = groupsOfStudent.get(s.id) ?? [];
      if (gids.length === 0) unassigned.push(s);
      for (const gid of gids) byGroup.get(gid)?.push(s);
    }
    return { byGroup, unassigned };
  }, [groups, sortedStudents, groupsOfStudent]);

  const hasConflicts = useMemo(() => [...groupsOfStudent.values()].some(g => g.length > 1), [groupsOfStudent]);

  const groupName = useCallback(
    (gid: string | null) => (gid ? groups.find(g => g.id === gid)?.name ?? '?' : 'Non affecté'),
    [groups]
  );
  const pseudoOf = (sid: string) => students.find(s => s.id === sid)?.pseudo ?? '?';

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const run = useCallback(
    async (action: () => Promise<void>, undoState?: UndoState) => {
      setBusy(true);
      try {
        await action();
        await reload();
        setUndo(undoState ?? null);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Erreur', 'error');
      } finally {
        setBusy(false);
      }
    },
    [reload, toast]
  );

  const doMove = useCallback(
    async (studentIds: string[], toGroupId: string | null) => {
      const ids = studentIds.filter(sid => (groupsOfStudent.get(sid) ?? [null])[0] !== toGroupId || (groupsOfStudent.get(sid)?.length ?? 0) > 1);
      if (ids.length === 0) return;
      const previous = ids.map(sid => ({ sid, from: (groupsOfStudent.get(sid) ?? [null])[0] ?? null }));
      const label = ids.length === 1 ? `${pseudoOf(ids[0])} → ${groupName(toGroupId)}` : `${ids.length} élèves → ${groupName(toGroupId)}`;
      await run(
        async () => { for (const sid of ids) await moveStudent(classId, sid, toGroupId); },
        { label, run: async () => { for (const p of previous) await moveStudent(classId, p.sid, p.from); } }
      );
      setSelected(new Set());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classId, groupsOfStudent, groupName, run]
  );

  const handleUndo = async () => {
    const u = undo;
    setUndo(null);
    if (!u) return;
    await run(u.run);
    setUndo(null);
  };

  const toggleSelect = (sid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  const selectedList = [...selected];
  const canSwap = selectedList.length === 2 &&
    ((groupsOfStudent.get(selectedList[0]) ?? [null])[0] ?? null) !== ((groupsOfStudent.get(selectedList[1]) ?? [null])[0] ?? null);

  const handleSwap = async () => {
    if (!canSwap) return;
    const [a, b] = selectedList;
    const ga = (groupsOfStudent.get(a) ?? [null])[0] ?? null;
    const gb = (groupsOfStudent.get(b) ?? [null])[0] ?? null;
    await run(
      () => swapStudents(classId, a, ga, b, gb),
      { label: `${pseudoOf(a)} ⇄ ${pseudoOf(b)}`, run: () => swapStudents(classId, a, gb, b, ga) }
    );
    setSelected(new Set());
  };

  // Drag & drop natif (comme le plan de classe)
  const handleDragStart = (e: React.DragEvent, sid: string) => {
    const ids = selected.has(sid) ? selectedList : [sid];
    e.dataTransfer.setData('text/plain', ids.join(','));
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDrop = (e: React.DragEvent, toGroupId: string | null) => {
    e.preventDefault();
    setDragOver(null);
    const ids = e.dataTransfer.getData('text/plain').split(',').filter(Boolean);
    if (ids.length > 0) doMove(ids, toGroupId);
  };

  const openCreate = () => {
    setDraftName(`Groupe ${groups.length + 1}`);
    setDraftColor(nextClassGroupColorKey(groups.map(g => g.color)));
    setPanel({ kind: 'create' });
  };

  const handleCreate = async () => {
    if (!draftName.trim()) return;
    await run(async () => { await createClassGroup(userId, classId, draftName, { color: draftColor }); });
    setPanel({ kind: 'none' });
  };

  const openEdit = (group: ClassGroupInfo) => {
    setDraftName(group.name);
    setDraftColor(group.color ?? classGroupColor(null, groups.indexOf(group)).key);
    setPanel({ kind: 'edit', group });
  };

  const handleSaveEdit = async () => {
    if (panel.kind !== 'edit') return;
    const updates: { name?: string; color?: string } = {};
    if (draftName.trim() && draftName.trim() !== panel.group.name) updates.name = draftName;
    if (draftColor !== panel.group.color) updates.color = draftColor;
    if (Object.keys(updates).length > 0) {
      await run(() => updateClassGroup(panel.group.id, updates));
    }
    setPanel({ kind: 'none' });
  };

  const handleDelete = async (group: ClassGroupInfo) => {
    const count = columns.byGroup.get(group.id)?.length ?? 0;
    const ok = await confirm({
      title: `Supprimer « ${group.name} » ?`,
      message: `${count} élève(s) redeviendront non affectés.`,
      details: 'Les séances passées de ce groupe redeviendront « classe entière » et ses plans de classe seront supprimés.',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    await run(() => deleteClassGroup(group.id));
    setPanel({ kind: 'none' });
  };

  const handleCreateDefaultPair = async () => {
    await run(async () => {
      const g1 = await createClassGroup(userId, classId, 'Groupe 1', { color: 'indigo', sortOrder: 0 });
      const g2 = await createClassGroup(userId, classId, 'Groupe 2', { color: 'emerald', sortOrder: 1 });
      const [b1, b2] = autoSplit(students, 2, 'alphabetical');
      await replaceMembers(g1.id, b1);
      await replaceMembers(g2.id, b2);
    });
    toast('Demi-groupes créés (répartition alphabétique)', 'success');
  };

  const handleAutoSplit = async (mode: AutoSplitMode) => {
    await run(() => applyAutoSplit(groups, students, mode));
    setPanel({ kind: 'none' });
    setUndo(null);
  };

  const handleBalance = async () => {
    if (groups.length === 0 || columns.unassigned.length === 0) return;
    const counts = new Map(groups.map(g => [g.id, columns.byGroup.get(g.id)?.length ?? 0]));
    const moves: { sid: string; to: string }[] = [];
    for (const s of columns.unassigned) {
      let target = groups[0].id;
      for (const g of groups) if ((counts.get(g.id) ?? 0) < (counts.get(target) ?? 0)) target = g.id;
      moves.push({ sid: s.id, to: target });
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
    await run(
      async () => { for (const m of moves) await moveStudent(classId, m.sid, m.to); },
      { label: `${moves.length} élève(s) répartis`, run: async () => { for (const m of moves) await moveStudent(classId, m.sid, null); } }
    );
  };

  const handleFromRoom = async (roomId: string) => {
    if (panel.kind !== 'fromRoom') return;
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const targetGroupId = panel.groupId;
    await run(async () => {
      if (targetGroupId) {
        // Remplir un groupe existant : exclusif, ces élèves quittent leurs autres groupes
        const ids = await fetchRoomPlanStudentIds(classId, roomId);
        for (const sid of ids) await moveStudent(classId, sid, targetGroupId);
      } else {
        await createGroupFromRoomPlan(userId, classId, roomId, room.name);
      }
    });
    toast(`Élèves du plan « ${room.name} » importés`, 'success');
    setPanel({ kind: 'none' });
    setUndo(null);
  };

  // ------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------

  const renderPill = (s: StudentLike, groupId: string | null, main: string) => {
    const isSel = selected.has(s.id);
    const conflict = (groupsOfStudent.get(s.id) ?? []).length > 1;
    return (
      <div
        key={`${groupId ?? 'u'}:${s.id}`}
        draggable={!busy}
        onDragStart={e => handleDragStart(e, s.id)}
        onClick={() => (conflict && groupId ? doMove([s.id], groupId) : toggleSelect(s.id))}
        title={conflict ? 'Dans plusieurs groupes : cliquez pour garder celui-ci' : 'Cliquer pour sélectionner, glisser pour déplacer'}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 10px 6px 8px', borderRadius: 999,
          background: isSel ? 'var(--indigo-soft)' : 'var(--surface)',
          border: `1px solid ${isSel ? 'var(--indigo)' : 'var(--border)'}`,
          boxShadow: isSel ? 'none' : '0 1px 2px rgba(20,25,40,0.06)',
          cursor: busy ? 'wait' : 'grab', userSelect: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
          maxWidth: '100%',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: groupId ? main : 'var(--text-dim)', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.pseudo}</span>
        {conflict && <span style={{ color: 'var(--warn)', fontWeight: 800 }}>!</span>}
      </div>
    );
  };

  const renderColumn = (title: string, groupId: string | null, list: StudentLike[], index: number, group?: ClassGroupInfo) => {
    const color = groupId ? classGroupColor(group?.color, index) : null;
    const main = color?.main ?? 'var(--text-dim)';
    const isOver = dragOver === (groupId ?? 'u');
    return (
      <div
        key={groupId ?? 'u'}
        onDragOver={e => { e.preventDefault(); if (!isOver) setDragOver(groupId ?? 'u'); }}
        onDragLeave={() => setDragOver(null)}
        onDrop={e => handleDrop(e, groupId)}
        style={{
          flex: '1 1 220px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 10,
          background: isOver ? (color?.soft ?? 'var(--surface-3)') : 'var(--surface-2)',
          border: `1px ${groupId ? 'solid' : 'dashed'} ${isOver ? main : 'var(--border)'}`,
          borderLeft: `4px solid ${main}`, borderRadius: 12, padding: 12, transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: main, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: color?.soft ?? 'var(--surface-3)', color: groupId ? main : 'var(--text-muted)' }}>{list.length}</span>
          </div>
          {group ? (
            <button className="btn btn--ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => openEdit(group)} title="Renommer, couleur, supprimer">⋯</button>
          ) : list.length > 0 && groups.length > 0 ? (
            <button className="btn btn--ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={handleBalance} disabled={busy} title="Envoie chaque non-affecté vers le groupe le moins nombreux">⚖ Équilibrer</button>
          ) : null}
        </div>
        {list.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '10px 4px' }}>
            {groupId ? 'Glissez des élèves ici.' : 'Tous les élèves sont affectés.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{list.map(s => renderPill(s, groupId, main))}</div>
        )}
      </div>
    );
  };

  const renderGroupForm = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        autoFocus
        value={draftName}
        onChange={e => setDraftName(e.target.value)}
        onKeyDown={e => {
          if (e.key !== 'Enter') return;
          if (panel.kind === 'create') handleCreate();
          else handleSaveEdit();
        }}
        placeholder="Nom du groupe"
        maxLength={40}
        style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CLASS_GROUP_COLORS.map(c => (
          <button
            key={c.key}
            onClick={() => setDraftColor(c.key)}
            title={c.label}
            style={{ width: 26, height: 26, borderRadius: 13, background: c.main, border: `3px solid ${draftColor === c.key ? 'var(--text)' : 'transparent'}`, cursor: 'pointer' }}
          />
        ))}
      </div>
      {panel.kind === 'edit' && rooms.length > 0 && (
        <button className="btn btn--ghost" style={{ justifyContent: 'flex-start', fontSize: 12 }} onClick={() => setPanel({ kind: 'fromRoom', groupId: panel.group.id })}>
          Remplir depuis un plan de salle…
        </button>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        {panel.kind === 'edit' ? (
          <button className="btn btn--ghost" style={{ color: 'var(--neg)', fontSize: 12 }} onClick={() => handleDelete(panel.group)} disabled={busy}>Supprimer</button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setPanel({ kind: 'none' })}>Annuler</button>
          <button className="btn btn--accent" style={{ fontSize: 12 }} onClick={panel.kind === 'create' ? handleCreate : handleSaveEdit} disabled={busy || !draftName.trim()}>
            {panel.kind === 'create' ? 'Créer' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPanel = () => {
    if (panel.kind === 'none') return null;
    let title = '';
    let body: React.ReactNode = null;
    if (panel.kind === 'create') { title = 'Nouveau groupe'; body = renderGroupForm(); }
    if (panel.kind === 'edit') { title = 'Modifier le groupe'; body = renderGroupForm(); }
    if (panel.kind === 'autosplit') {
      title = 'Répartir automatiquement';
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
            Remplace la répartition actuelle des {groups.length} groupe(s) avec les {students.length} élèves de la classe.
          </p>
          {([['alphabetical', 'Moitié alphabétique', 'A–L / M–Z'], ['alternate', 'Alternée', `1 sur ${groups.length}`], ['random', 'Aléatoire', '']] as [AutoSplitMode, string, string][]).map(([mode, label, hint]) => (
            <button key={mode} className="btn btn--ghost" style={{ justifyContent: 'space-between' }} onClick={() => handleAutoSplit(mode)} disabled={busy}>
              <span>{label}</span><span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{hint}</span>
            </button>
          ))}
          <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setPanel({ kind: 'none' })}>Annuler</button>
        </div>
      );
    }
    if (panel.kind === 'fromRoom') {
      title = 'Depuis quel plan de salle ?';
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
            Les élèves placés dans le plan de cette classe pour la salle choisie rejoignent
            {panel.groupId ? ` « ${groupName(panel.groupId)} »` : ' un nouveau groupe au nom de la salle'}.
          </p>
          <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rooms.map(r => (
              <button key={r.id} className="btn btn--ghost" style={{ justifyContent: 'flex-start' }} onClick={() => handleFromRoom(r.id)} disabled={busy}>{r.name}</button>
            ))}
          </div>
          <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setPanel({ kind: 'none' })}>Annuler</button>
        </div>
      );
    }
    return (
      <div onClick={() => setPanel({ kind: 'none' })} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, padding: 18, width: 360, maxWidth: '92%', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>{title}</div>
          {body}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50" style={{ background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', background: 'var(--bg)', borderRadius: 16, width: 'min(1100px, 96vw)', height: 'min(760px, 92vh)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: 'var(--text)' }}>Groupes de classe · {className}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Glissez un élève d'une colonne à l'autre. Cliquez pour sélectionner plusieurs élèves.
            </div>
          </div>
          {groups.length > 0 && (
            <>
              <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setPanel({ kind: 'autosplit' })} disabled={busy}>🔀 Répartir</button>
              {rooms.length > 0 && (
                <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setPanel({ kind: 'fromRoom', groupId: null })} disabled={busy}>Depuis une salle</button>
              )}
            </>
          )}
          <button className="btn btn--accent" style={{ fontSize: 12 }} onClick={openCreate} disabled={busy}>+ Groupe</button>
          <button onClick={onClose} className="p-2 rounded" style={{ color: 'var(--text-dim)' }} title="Fermer (Échap)">
            <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Corps */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div>
          ) : groups.length === 0 ? (
            <div style={{ maxWidth: 460, margin: '40px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 36 }}>👥</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: 'var(--text)' }}>Aucun groupe</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Des groupes durables pour cette classe : demi-classe une semaine sur deux, latinistes, groupe de besoin…
                Ce ne sont pas les groupes de TP d'une séance.
              </p>
              <button className="btn btn--accent" onClick={handleCreateDefaultPair} disabled={busy || students.length === 0}>Créer des demi-groupes (G1 / G2)</button>
              <button className="btn btn--ghost" onClick={openCreate} disabled={busy}>Créer un groupe vide</button>
              {rooms.length > 0 && (
                <button className="btn btn--ghost" onClick={() => setPanel({ kind: 'fromRoom', groupId: null })} disabled={busy}>Créer depuis un plan de salle</button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {hasConflicts && (
                <div style={{ background: 'var(--warn-soft)', color: 'var(--warn)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>
                  Certains élèves (marqués « ! ») sont dans plusieurs groupes après une synchronisation. Cliquez-les dans la colonne à garder.
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {groups.map((g, i) => renderColumn(g.name, g.id, columns.byGroup.get(g.id) ?? [], i, g))}
                {renderColumn('Non affecté', null, columns.unassigned, groups.length)}
              </div>
            </div>
          )}
        </div>

        {/* Barre d'action : sélection / annulation */}
        {(selected.size > 0 || undo) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexWrap: 'wrap' }}>
            {undo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)' }}>
                <span>✓ {undo.label}</span>
                <button className="btn btn--ghost" style={{ fontSize: 12, padding: '2px 8px' }} onClick={handleUndo} disabled={busy}>Annuler</button>
              </div>
            )}
            <div style={{ flex: 1 }} />
            {selected.size > 0 && (
              <>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{selected.size} sélectionné(s) · déplacer vers</span>
                {groups.map((g, i) => (
                  <button key={g.id} className="btn btn--ghost" style={{ fontSize: 12, borderColor: classGroupColor(g.color, i).main }} onClick={() => doMove(selectedList, g.id)} disabled={busy}>{g.name}</button>
                ))}
                <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => doMove(selectedList, null)} disabled={busy}>Non affecté</button>
                {canSwap && (
                  <button className="btn btn--primary" style={{ fontSize: 12 }} onClick={handleSwap} disabled={busy}>⇄ Échanger</button>
                )}
                <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setSelected(new Set())}>Désélectionner</button>
              </>
            )}
          </div>
        )}

        {renderPanel()}
      </div>
    </div>
  );
}
