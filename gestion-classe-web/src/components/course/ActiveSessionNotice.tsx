/**
 * Bandeau du mode essai : « une séance est en cours sur le téléphone ».
 *
 * Le mode essai d'un cours (« Essayer » dans le calendrier, l'éditeur ou « Mes cours ») n'est relié
 * à rien : ni séance, ni télécommande du téléphone, ni plan de classe, et ce qu'on y écrit est
 * perdu en quittant. Le 16/11/2026, un cours a été projeté ainsi en classe, séance lancée sur le
 * téléphone : la télécommande ne répondait pas. Ce bandeau le dit dès qu'une séance tourne, et
 * mène à l'écran de classe (`/classe`), qui est le seul à écouter le téléphone.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { classroomUrl, fetchActiveSession } from '../../lib/activeSession';
import { supabase } from '../../lib/supabase';

interface Props {
  /** Cours en essai : l'écran de classe l'affichera pour cette séance. */
  boardId: string;
}

/** La séance peut démarrer après l'ouverture de l'essai : on regarde de temps en temps. */
const POLL_MS = 15_000;

export function ActiveSessionNotice({ boardId }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const navigate = useNavigate();
  const [session, setSession] = useState<{ id: string; className: string | null } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const knownRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const look = async () => {
      try {
        const active = await fetchActiveSession(userId);
        if (cancelled) return;
        if (!active) { knownRef.current = null; setSession(null); return; }
        // Même séance qu'au tour précédent : rien à relire
        if (knownRef.current === active.id) return;
        const { data } = await supabase.from('classes').select('name').eq('id', active.class_id).maybeSingle();
        if (cancelled) return;
        knownRef.current = active.id;
        setSession({ id: active.id, className: (data as { name?: string } | null)?.name ?? null });
      } catch {
        /* hors ligne : pas de bandeau, l'essai continue */
      }
    };
    void look();
    const t = window.setInterval(() => { void look(); }, POLL_MS);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [userId]);

  if (!session || dismissed === session.id) return null;
  return createPortal(
    <div className="ce-seance" role="status">
      <span className="ce-seance__dot" aria-hidden />
      <span className="ce-seance__text">
        <b>Séance en cours sur le téléphone{session.className ? ` (${session.className})` : ''}.</b>{' '}
        Cet essai n'y est pas relié : ni télécommande, ni plan de classe, et rien n'est gardé.
      </span>
      <button type="button" className="ce-seance__go" onClick={() => navigate(classroomUrl(boardId))}>Ouvrir l'écran de classe</button>
      <button type="button" className="ce-seance__close" onClick={() => setDismissed(session.id)} title="Continuer l'essai" aria-label="Fermer ce message">✕</button>
      <style>{CSS}</style>
    </div>,
    document.body,
  );
}

const CSS = `
.ce-seance { position: fixed; left: 50%; top: 52px; transform: translateX(-50%); z-index: 400; max-width: min(920px, calc(100vw - 32px)); display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 16px; border: 1px solid #F59E0B; border-radius: 12px; background: #FFFBEB; color: #78350F; font: 400 14px/1.35 Inter, system-ui, sans-serif; box-shadow: 0 10px 30px rgba(15,23,42,.22); }
.ce-seance__dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: #DC2626; box-shadow: 0 0 0 4px rgba(220,38,38,.18); }
.ce-seance__text { min-width: 0; }
.ce-seance__go { flex: none; height: 36px; padding: 0 14px; border: 0; border-radius: 8px; background: #4F46E5; color: #FFFFFF; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; white-space: nowrap; }
.ce-seance__close { flex: none; width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: #92400E; font-size: 15px; cursor: pointer; }
.ce-seance__close:hover { background: #FEF3C7; }
@media (max-width: 720px) { .ce-seance { flex-wrap: wrap; } }
`;
