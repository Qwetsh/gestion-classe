/**
 * Barre du mode édition de l'accueil : ajouter un module retiré, réinitialiser, terminer.
 */

import { useState } from 'react';
import { HOME_MODULES } from './homeModules';
import { QuickIcon } from './homeHelpers';
import { resetHomeLayout, setEditing, showModule } from './homeLayoutStore';
import type { HomeLayout } from './homeLayout';

export function HomeEditBar({ layout }: { layout: HomeLayout }) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const placedIds = new Set(layout.items.map(i => i.i));
  const available = HOME_MODULES.filter(m => layout.hidden.includes(m.id) || !placedIds.has(m.id));

  return (
    <div className="home-editbar">
      <div className="home-editbar__text">
        <strong>Mode édition</strong>
        <span>Glissez un module par son en-tête, tirez son bord ou son coin pour le redimensionner.</span>
      </div>

      <div className="home-editbar__actions">
        <button
          type="button"
          className="home-editbar__btn"
          onClick={() => setLibraryOpen(o => !o)}
        >
          + Ajouter un module{available.length > 0 ? ` (${available.length})` : ''}
        </button>

        <button
          type="button"
          className="home-editbar__btn"
          onClick={() => {
            if (!confirmReset) { setConfirmReset(true); return; }
            resetHomeLayout();
            setConfirmReset(false);
          }}
        >
          {confirmReset ? 'Confirmer la remise à zéro' : 'Réinitialiser'}
        </button>

        <button
          type="button"
          className="home-editbar__btn home-editbar__btn--primary"
          onClick={() => setEditing(false)}
        >
          Terminé
        </button>
      </div>

      {libraryOpen && (
        <div className="home-library">
          {available.length === 0 ? (
            <p className="home-library__empty">Tous les modules sont déjà sur la page.</p>
          ) : (
            available.map(m => (
              <button
                key={m.id}
                type="button"
                className="home-library__card"
                onClick={() => { showModule(m.id); setLibraryOpen(false); }}
              >
                <span className="dash__quick-ic dash__quick-ic--indigo"><QuickIcon name={m.icon} /></span>
                <span className="home-library__text">
                  <span className="home-library__title">{m.title}</span>
                  <span className="home-library__desc">{m.description}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
