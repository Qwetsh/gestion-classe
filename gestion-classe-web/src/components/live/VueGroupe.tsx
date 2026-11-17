import { useEffect, useState } from 'react';
import { etapesDuGroupe, compteCarnet, libelleExamen, libelleMode, messagesDuGroupe, texteLectures, titreSansMention } from '../../lib/liveCarnet';
import { ecrirePoints, fetchReponsesCarnet, type LiveMessage } from '../../lib/liveQueries';
import { etatVu, heure, nomsDuGroupe, type ActionsGroupe, type GroupeAffiche } from './commun';
import { IconeCoche, IconeFermer, IconeMessage, IconeOrdonnance, IconePrecedent } from './Icones';

/**
 * Un groupe : où il en est, son carnet complet (lu à l'ouverture sur sa fiche la plus récente), ses examens,
 * ses questions à Morel et les messages du service. Plein écran sur téléphone, panneau latéral sur ordinateur.
 */
export function VueGroupe({ a, retour, maintenant, messages, actions, fermer }: {
  a: GroupeAffiche;
  /** « La 3C » : le lien de retour. */
  retour: string;
  maintenant: number;
  messages: LiveMessage[];
  actions: ActionsGroupe;
  fermer: () => void;
}) {
  const { g, questions } = a;
  const d = g.w.direct;
  const vu = etatVu(g.maj, maintenant);
  const noms = nomsDuGroupe(g);
  const [carnet, setCarnet] = useState<{ cle: string; reponses: Record<string, string>; ordonnance: string } | { cle: string; erreur: string } | null>(null);
  const cleCarnet = `${g.w.id}:${g.w.updated_at}`;

  // relu quand le groupe sauvegarde (updated_at change), pas à chaque rafraîchissement de la page
  useEffect(() => {
    if (!questions.length) return;
    let annule = false;
    fetchReponsesCarnet(g.w.id, questions)
      .then((r) => { if (!annule) setCarnet({ cle: `${g.w.id}:${g.w.updated_at}`, ...r }); })
      .catch((e) => { if (!annule) setCarnet({ cle: `${g.w.id}:${g.w.updated_at}`, erreur: (e as Error).message }); });
    return () => { annule = true; };
  }, [g.w.id, g.w.updated_at, questions]);
  const lu = carnet && carnet.cle === cleCarnet ? carnet : null;

  useEffect(() => {
    const surEchap = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer(); };
    window.addEventListener('keydown', surEchap);
    return () => window.removeEventListener('keydown', surEchap);
  }, [fermer]);

  const etapes = d ? etapesDuGroupe(d, questions, heure) : [];
  const { faites, sur } = compteCarnet(questions, d);
  const duGroupe = messagesDuGroupe(messages, g);

  return (
    <>
      <div className="ed-groupe-fond" onClick={fermer} aria-hidden />
      <div className="ed-groupe" role="dialog" aria-modal="true" aria-label={`Groupe ${noms}`}>
        <header>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="ed-lien ed-retour" onClick={fermer}><IconePrecedent /> {retour}</button>
            <button className="ed-bouton ed-bouton--carre" onClick={fermer} aria-label="Fermer"><IconeFermer /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`ed-point ed-point--${vu.cle}`} aria-hidden />
            <h1>{noms}</h1>
            {a.points !== 0 && (
              <span className={`ed-pastille ed-pastille--points ed-pastille--${a.points < 0 ? 'moins' : 'plus'}`}>{ecrirePoints(a.points)}</span>
            )}
          </div>
          <div className="ed-pastilles">
            <span className="ed-pastille ed-pastille--patient">{g.patient}</span>
            <span className="ed-mode">{[libelleMode(d?.mode), vu.texte, `dernier brouillon à ${heure(g.maj)}`].filter(Boolean).join(' · ')}</span>
          </div>
          {a.raison && <div className="ed-alerte">{a.raison}</div>}
          <div className="ed-actions">
            <button className="ed-bouton" onClick={() => actions.ecrire(a)}><IconeMessage /> Message</button>
            <button className="ed-bouton ed-bouton--point ed-bouton--moins" onClick={() => actions.ecrire(a, -1)} aria-label={`Retirer un point à ${noms}`}>−1</button>
            <button className="ed-bouton ed-bouton--point ed-bouton--plus" onClick={() => actions.ecrire(a, 1)} aria-label={`Donner un point à ${noms}`}>+1</button>
          </div>
        </header>

        <main>
          {d && (
            <section>
              <h2>Où ils en sont</h2>
              <ol className="ed-etapes">
                {etapes.map((e) => (
                  <li key={e.titre} className={`ed-etape--${e.etat}`}>
                    <div className="ed-rail">
                      <span className="ed-rond" aria-hidden>{e.etat === 'fait' && <IconeCoche />}</span>
                      <span className="ed-trait" aria-hidden />
                    </div>
                    <div className="ed-texte">
                      <b>{e.titre}</b>
                      {e.detail && <span>{e.detail}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {questions.length > 0 && (
            <section style={{ gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <h2>Carnet · {faites} / {sur}</h2>
                <span className="ed-heure">lu au dernier brouillon</span>
              </div>
              {!lu && <p className="ed-vide">Lecture du carnet…</p>}
              {lu && 'erreur' in lu && <p className="ed-vide" style={{ color: 'var(--neg)' }}>{lu.erreur}</p>}
              {lu && 'reponses' in lu && (
                <>
                  {questions.map((q) => {
                    const r = lu.reponses[q.id];
                    return (
                      <div key={q.id} className="ed-reponse">
                        <span className={`ed-case${r ? ' ed-case--faite' : ''}${q.bonus ? ' ed-case--bonus' : ''}`}>{q.num}</span>
                        <div>
                          <small>{q.bonus ? `${titreSansMention(q.titre)} (bonus)` : q.titre}</small>
                          {r ? <p>{r}</p> : <span className="ed-pas-encore">pas encore répondu</span>}
                        </div>
                      </div>
                    );
                  })}
                  <div className="ed-reponse">
                    <span className="ed-ordonnance"><IconeOrdonnance /></span>
                    <div>
                      <small>Ordonnance : examens prescrits et pourquoi</small>
                      {lu.ordonnance ? <p>{lu.ordonnance}</p> : <span className="ed-pas-encore">rien de prescrit</span>}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {d && (
            <section>
              <h2>Examens faits · {d.examens?.length ?? 0}</h2>
              {d.examens?.length ? (
                <div className="ed-examens">{d.examens.map((x) => <span key={x}>{libelleExamen(x)}</span>)}</div>
              ) : (
                <p className="ed-vide">Aucun examen pour l'instant.</p>
              )}
            </section>
          )}

          {!!d?.morel?.length && (
            <section>
              <h2>Questions au Docteur Morel · {d.morel.length}</h2>
              <ul className="ed-liste">
                {[...d.morel].reverse().map((m, i) => (
                  <li key={i} className="ed-morel" style={{ fontSize: 14 }}>
                    <span className="ed-heure" style={{ width: 40, flex: 'none' }}>{heure(m.t)}</span>
                    <span>{m.q}</span>
                    <span className={`ed-tag${m.compris ? '' : ' ed-tag--neg'}`}>{m.compris ? `indice ${m.niveau}` : 'pas compris'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2>Messages du service</h2>
            {duGroupe.length === 0 && <p className="ed-vide">Aucun message ni point pour ce groupe.</p>}
            {duGroupe.map((m) => {
              const lecture = texteLectures({ lus: d?.messagesLus?.includes(m.id) ? 1 : 0, sur: 1, suivi: Array.isArray(d?.messagesLus) });
              return (
                <div key={m.id} className={`ed-message ed-message--${m.style}`}>
                  <div>
                    <span className="ed-heure" style={{ width: 40, flex: 'none' }}>{heure(Date.parse(m.created_at))}</span>
                    <span>
                      {m.points ? <strong style={{ color: Number(m.points) < 0 ? 'var(--neg)' : 'var(--pos)' }}>{ecrirePoints(Number(m.points))} · </strong> : null}
                      {m.texte} <span style={{ color: 'var(--text-muted)' }}>— {m.signe}</span>
                    </span>
                  </div>
                  {lecture && <span className={`ed-lu${lecture === 'lu' ? ' ed-lu--oui' : ''}`}>{lecture === 'lu' ? 'Lu par le groupe' : 'Pas encore lu par le groupe'}</span>}
                </div>
              );
            })}
          </section>
        </main>
      </div>
    </>
  );
}
