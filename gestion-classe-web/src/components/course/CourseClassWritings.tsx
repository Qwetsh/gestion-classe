/**
 * Fenêtre « Écrit en classe » d'un cours : les tableaux blancs (versos) écrits pendant les séances
 * parties de ce cours ou de ses copies placées sur l'emploi du temps, séance par séance. Pour
 * chaque page jouée : la page à gauche, ce qui a été écrit à côté à droite. Un clic agrandit.
 */
import { useState } from 'react';
import { PageImage } from '../classroom/BoardVerso';
import { groupBySession, versoLabel, type ClassVerso } from '../../lib/boardVersos';

interface Props {
  entries: ClassVerso[];
  onClose: () => void;
}

export function CourseClassWritings({ entries, onClose }: Props) {
  const groups = groupBySession(entries);
  const [shown, setShown] = useState<ClassVerso | null>(null);

  return (
    <div className="ce-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ce-dialog ce-written" role="dialog" aria-label="Écrit en classe" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); if (shown) setShown(null); else onClose(); } }}>
        <h3 className="ce-dialog__title">Écrit en classe</h3>
        {shown ? (
          <div className="ce-written__big">
            <div className="ce-written__big-head">
              <b>{versoLabel(shown)}</b>
              <span className="ce-spacer-flex" />
              <button type="button" className="ce-btn" onClick={() => setShown(null)}>Retour à la liste</button>
            </div>
            <div className="ce-written__pair ce-written__pair--big">
              {shown.page && <figure><PageImage page={shown.page} width={1200} className="ce-written__img" /><figcaption>La page</figcaption></figure>}
              <figure><PageImage page={shown.verso} width={1200} className="ce-written__img" /><figcaption>Le tableau blanc</figcaption></figure>
            </div>
          </div>
        ) : (
          <div className="ce-written__list">
            {groups.map((g) => (
              <section key={g.session.sessionId} className="ce-written__group">
                <h4>{versoLabel(g.session)}</h4>
                {g.versos.map((v) => (
                  <button key={v.pageId} type="button" className="ce-written__pair" onClick={() => setShown(v)} title="Agrandir">
                    {v.page
                      ? <figure><PageImage page={v.page} width={480} className="ce-written__img" /></figure>
                      : <figure className="ce-written__nopage">Page ajoutée en classe</figure>}
                    <figure><PageImage page={v.verso} width={480} className="ce-written__img" /></figure>
                  </button>
                ))}
              </section>
            ))}
          </div>
        )}
        <div className="ce-dialog__foot">
          <span className="ce-written__hint">À gauche la page, à droite son tableau blanc.</span>
          <span className="ce-spacer-flex" />
          <button type="button" className="ce-btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
