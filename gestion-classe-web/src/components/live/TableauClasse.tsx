import { ecrirePoints } from '../../lib/liveQueries';
import { libelleLieu, libelleMode } from '../../lib/liveCarnet';
import { BandeCases, LegendeCases } from './BandeCases';
import { etatVu, nomsDuGroupe, type ActionsGroupe, type GroupeAffiche } from './commun';

/** Ordinateur : la classe, question par question. Une ligne par groupe ; un clic ouvre le carnet du groupe. */
export function TableauClasse({ groupes, maintenant, actions }: { groupes: GroupeAffiche[]; maintenant: number; actions: ActionsGroupe }) {
  return (
    <section className="ed-tableau-boite">
      <header>
        <h2>La classe, question par question</h2>
        <span>une ligne par groupe · clic : le carnet du groupe</span>
      </header>
      <div className="ed-defile">
        <table className="ed-tableau">
          <thead>
            <tr>
              <th scope="col">Groupe</th>
              <th scope="col">Patient · lieu</th>
              <th scope="col">Carnet</th>
              <th scope="col" className="ed-nombre">Examens</th>
              <th scope="col" className="ed-nombre">Morel</th>
              <th scope="col" className="ed-nombre">Points</th>
              <th scope="col" className="ed-nombre">Vu</th>
            </tr>
          </thead>
          <tbody>
            {groupes.map((a) => {
              const { g } = a;
              const d = g.w.direct;
              const vu = etatVu(g.maj, maintenant);
              const envoye = !!d?.envoye || g.statut !== 'draft';
              return (
                <tr key={g.cle} className={a.raison ? 'ed-ligne--alerte' : undefined} onClick={() => actions.ouvrir(a)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`ed-point ed-point--petit ed-point--${vu.cle}`} aria-hidden />
                      <button className="ed-noms" onClick={(e) => { e.stopPropagation(); actions.ouvrir(a); }}>{nomsDuGroupe(g)}</button>
                    </div>
                    {a.raison && <div className="ed-alerte-ligne">{a.raison}</div>}
                  </td>
                  <td>
                    <div className="ed-patient">{g.patient}</div>
                    <div className="ed-lieu">{envoye ? 'Carnet envoyé' : libelleLieu(d?.lieu)}{d?.mode ? ` · ${libelleMode(d.mode)}` : ''}</div>
                  </td>
                  <td>
                    {a.cases ? <BandeCases cases={a.cases} fixes /> : <span className="ed-lieu">{d ? a.legende : 'version du jeu sans suivi en direct'}</span>}
                  </td>
                  <td className="ed-nombre">{d?.examens?.length ?? 0}</td>
                  <td className="ed-nombre">{d?.morel?.length ?? 0}</td>
                  <td className="ed-nombre" style={{ fontWeight: 700, color: a.points < 0 ? 'var(--neg)' : a.points > 0 ? 'var(--pos)' : 'var(--text-dim)' }}>
                    {a.points ? ecrirePoints(a.points).replace(/ pts?$/, '') : '—'}
                  </td>
                  <td className={`ed-nombre ed-vu ed-vu--${vu.cle}`}>{vu.texte}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer><LegendeCases suite="les numéros sont ceux du carnet de chaque patient" /></footer>
    </section>
  );
}
