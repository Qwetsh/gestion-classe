import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { KindIcon } from './KindIcon';
import { useIsMobile } from '../hooks/useIsMobile';
import { useGroupSession } from '../contexts/GroupSessionContext';
import {
  fetchActivities,
  fetchClassActivityLinks,
  linkActivityToClass,
  type ActivityRow,
} from '../lib/productionsQueries';

/**
 * « + Évaluation » par type (hub Évaluations, phase 6) :
 * - une éval classique (copie, DM, oral, TP noté à la main) : le formulaire habituel ;
 * - une production numérique : on choisit une activité existante (elles sont créées par l'app
 *   élève), l'éval du carnet est créée et reçoit les notes déjà corrigées ;
 * - un TP de groupe : la séance se note au téléphone ; à la fin, l'éval arrive dans le carnet.
 */
export function NewAssessmentChooser({
  userId,
  classId,
  className,
  onClassic,
  onClose,
}: {
  userId: string;
  classId: string;
  className: string;
  onClassic: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { startFlow } = useGroupSession();
  const [step, setStep] = useState<'type' | 'production' | 'groupe'>('type');
  const [activities, setActivities] = useState<ActivityRow[] | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 'production' || activities) return;
    Promise.all([fetchActivities(), fetchClassActivityLinks(classId)])
      .then(([acts, l]) => { setActivities(acts); setLinks(l); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Activités introuvables'));
  }, [step, activities, classId]);

  const pickActivity = async (a: ActivityRow) => {
    const existing = links[a.id];
    if (existing) { navigate(`/evaluations/${existing}`); return; }
    setBusy(a.id);
    setError(null);
    try {
      const r = await linkActivityToClass({ userId, activity: a, classId });
      navigate(`/evaluations/${r.assessmentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible');
      setBusy(null);
    }
  };

  const startGroup = () => {
    onClose();
    void startFlow();
  };

  return (
    <Modal isOpen onClose={onClose} title={`Nouvelle évaluation · ${className}`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        {step === 'type' && (
          <>
            <Choice kind="ecrit" title="Évaluation" text="Écrit, devoir maison, oral, TP noté à la main : nom, barème, coefficient. Les copies se scannent ensuite." onClick={onClassic} />
            <Choice kind="tp" title="Production numérique" text="Une activité faite dans l’application élève : ses envois, leur correction et la note au carnet, au même endroit." onClick={() => setStep('production')} />
            <Choice kind="groupe" title="TP de groupe" text="Une séance notée par groupe et sur critères. Elle arrive dans le carnet à la fin de la séance." onClick={() => (isMobile ? startGroup() : setStep('groupe'))} />
          </>
        )}

        {step === 'production' && (
          <>
            <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
              Choisis l’activité. Les activités se créent dans l’application élève ; elles apparaissent ici dès le premier envoi.
            </div>
            {!activities && !error && <div style={{ color: 'var(--text-dim)' }}>Chargement…</div>}
            {activities && activities.length === 0 && (
              <div style={{ color: 'var(--text-dim)' }}>Aucune activité reçue pour l’instant.</div>
            )}
            {activities?.map((a) => (
              <button key={a.id} onClick={() => { void pickActivity(a); }} disabled={!!busy} style={row}>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <strong>{a.title}</strong>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[a.level, a.sequence].filter(Boolean).join(' · ')} · /{a.bareme_total}
                  </span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--indigo)' }}>
                  {busy === a.id ? 'Création…' : links[a.id] ? 'Ouvrir sa fiche' : 'Créer l’éval'}
                </span>
              </button>
            ))}
            {error && <div style={{ color: 'var(--neg)', fontSize: 12.5 }}>{error}</div>}
            <div><button onClick={() => setStep('type')} style={btn}>← Retour</button></div>
          </>
        )}

        {step === 'groupe' && (
          <>
            <div style={{ lineHeight: 1.55 }}>
              Une séance de groupe se note en classe, sur le téléphone : ouvre Gestion Classe sur ton téléphone,
              puis <strong>Accueil → Travail de groupe</strong> (ou l’app mobile).
              Critères, groupes, notation en direct : à la fin de la séance, le TP arrive tout seul dans ce carnet, hors moyenne.
            </div>
            <div><button onClick={() => setStep('type')} style={btn}>← Retour</button></div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Choice({ kind, title, text, onClick }: { kind: 'ecrit' | 'tp' | 'groupe'; title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={row}>
      <span style={{ color: 'var(--indigo)', display: 'flex' }}><KindIcon kind={kind} size={20} /></span>
      <span style={{ flex: 1, textAlign: 'left' }}>
        <strong>{title}</strong>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 }}>{text}</span>
      </span>
    </button>
  );
}

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 13,
};
const btn: React.CSSProperties = {
  padding: '6px 11px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontFamily: 'inherit',
};
