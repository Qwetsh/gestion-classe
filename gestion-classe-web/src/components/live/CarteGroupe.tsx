import { ecrirePoints } from '../../lib/liveQueries';
import { libelleLieu, libelleMode } from '../../lib/liveCarnet';
import { BandeCases } from './BandeCases';
import { etatVu, nomsDuGroupe, type ActionsGroupe, type GroupeAffiche } from './commun';
import { IconeMessage, IconeSuivant } from './Icones';

/** La carte d'un groupe (téléphone) : état, patient et lieu, bande de cases, dernière question à Morel, actions. */
export function CarteGroupe({ a, maintenant, actions }: { a: GroupeAffiche; maintenant: number; actions: ActionsGroupe }) {
  const { g } = a;
  const d = g.w.direct;
  const vu = etatVu(g.maj, maintenant);
  const noms = nomsDuGroupe(g);
  const envoye = !!d?.envoye || g.statut !== 'draft';
  const derniere = d?.morel?.length ? d.morel[d.morel.length - 1] : null;
  return (
    <article className={`ed-carte${a.raison ? ' ed-carte--alerte' : ''}`}>
      <div className="ed-carte-tete">
        <span className={`ed-point ed-point--${vu.cle}`} aria-hidden />
        <button className="ed-noms" onClick={() => actions.ouvrir(a)}>{noms}</button>
        {a.points !== 0 && (
          <span className={`ed-pastille ed-pastille--points ed-pastille--${a.points < 0 ? 'moins' : 'plus'}`}>{ecrirePoints(a.points)}</span>
        )}
        <span className={`ed-vu ed-vu--${vu.cle}`}>{vu.texte}</span>
      </div>
      {a.raison && <div className="ed-alerte">{a.raison}</div>}
      <div className="ed-pastilles">
        <span className="ed-pastille ed-pastille--patient">{g.patient}</span>
        {envoye ? <span className="ed-pastille ed-pastille--envoye">Carnet envoyé</span> : d?.lieu && <span className="ed-pastille">{libelleLieu(d.lieu)}</span>}
        {d?.mode && <span className="ed-mode">{libelleMode(d.mode)}</span>}
      </div>
      {d ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {a.cases ? (
            <BandeCases cases={a.cases} />
          ) : d.sur ? (
            <div className="ed-barre" aria-hidden><span style={{ width: `${Math.round((100 * (d.reponses ?? 0)) / d.sur)}%` }} /></div>
          ) : null}
          <span className="ed-legende-carnet">{a.legende}</span>
        </div>
      ) : (
        <span className="ed-legende-carnet">Fiche {envoye ? 'envoyée' : 'en cours'} (version du jeu sans suivi en direct).</span>
      )}
      {derniere && !a.raison && (
        <div className="ed-morel">
          <small>Morel</small>
          <span>{derniere.q}</span>
          <span className={`ed-tag${derniere.compris ? '' : ' ed-tag--neg'}`}>{derniere.compris ? `indice ${derniere.niveau}` : 'pas compris'}</span>
        </div>
      )}
      <div className="ed-actions">
        <button className="ed-bouton" onClick={() => actions.ecrire(a)} aria-label={`Envoyer un message à ${noms}`}>
          <IconeMessage /> Message
        </button>
        <button className="ed-bouton ed-bouton--point ed-bouton--moins" onClick={() => actions.ecrire(a, -1)} aria-label={`Retirer un point à ${noms}`}>−1</button>
        <button className="ed-bouton ed-bouton--point ed-bouton--plus" onClick={() => actions.ecrire(a, 1)} aria-label={`Donner un point à ${noms}`}>+1</button>
        <button className="ed-lien" onClick={() => actions.ouvrir(a)}>Carnet <IconeSuivant /></button>
      </div>
    </article>
  );
}
