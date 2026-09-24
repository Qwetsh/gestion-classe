/**
 * Rendu de l'accueil à partir d'une disposition {x, y, w, h}.
 *
 * Hors édition : grille CSS, aucun coût, aucune poignée.
 * En édition : react-grid-layout prend le relais (déplacement libre + redimensionnement
 * en largeur et en hauteur). Cf. PLAN_accueil_modulaire.md.
 */

import { useEffect, useRef, useState } from 'react';
import { GridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useHomeData } from './HomeDataContext';
import { getHomeModule } from './homeModules';
import { hideModule, setLayoutItems } from './homeLayoutStore';
import {
  HOME_COLUMNS, HOME_GAP, HOME_ROW_HEIGHT,
  compactLayout, readingOrder, itemPixelHeight,
  type HomeLayout, type HomeLayoutItem,
} from './homeLayout';

/** On ne conserve que les coordonnees : le reste (bornes, etats) est recalcule a chaque rendu. */
function toItem({ i, x, y, w, h }: HomeLayoutItem): HomeLayoutItem {
  return { i, x, y, w, h };
}

/** Sous cette largeur, la grille s'aplatit en une colonne (décision du 23/09/2026). */
const FLAT_BREAKPOINT = 1100;

function useIsFlat(): boolean {
  const [flat, setFlat] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < FLAT_BREAKPOINT);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${FLAT_BREAKPOINT - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => setFlat(e.matches);
    setFlat(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return flat;
}

/** Largeur disponible pour la grille (react-grid-layout la veut en pixels). */
function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

export function HomeGrid({ layout, editing }: { layout: HomeLayout; editing: boolean }) {
  const data = useHomeData();
  const isFlat = useIsFlat();
  const [ref, width] = useContainerWidth();

  // Un module sans donnée pertinente ne prend pas de place… sauf en édition, où il
  // doit rester manipulable (sinon on ne peut plus le placer quand il est vide).
  const visible = layout.items.filter(item => {
    const def = getHomeModule(item.i);
    if (!def) return false;
    if (layout.hidden.includes(item.i)) return false;
    if (editing) return true;
    return def.isAvailable ? def.isAvailable(data) : true;
  });

  const placed = compactLayout(visible);

  if (isFlat) {
    return (
      <div className="home-grid home-grid--flat" ref={ref}>
        {readingOrder(placed).map(item => {
          const def = getHomeModule(item.i)!;
          return (
            <div key={item.i} className="home-module home-module--flat">
              <def.Component />
            </div>
          );
        })}
      </div>
    );
  }

  if (!editing) {
    return (
      <div
        className="home-grid"
        ref={ref}
        style={{
          gridTemplateColumns: `repeat(${HOME_COLUMNS}, minmax(0, 1fr))`,
          gridAutoRows: `${HOME_ROW_HEIGHT}px`,
          gap: HOME_GAP,
        }}
      >
        {placed.map(item => {
          const def = getHomeModule(item.i)!;
          return (
            <div
              key={item.i}
              className="home-module"
              style={{
                gridColumn: `${item.x + 1} / span ${item.w}`,
                gridRow: `${item.y + 1} / span ${item.h}`,
                maxHeight: itemPixelHeight(item.h),
              }}
            >
              <def.Component />
            </div>
          );
        })}
      </div>
    );
  }

  // Les tailles minimales viennent du registre : un module ne doit pas pouvoir
  // etre reduit au point de tronquer son contenu.
  const constrained = placed.map(item => {
    const def = getHomeModule(item.i)!;
    return { ...item, minW: def.minW, minH: def.minH };
  });

  return (
    <div className="home-grid-edit" ref={ref}>
      {width > 0 && (
        <GridLayout
          className="home-rgl"
          width={width}
          gridConfig={{
            cols: HOME_COLUMNS,
            rowHeight: HOME_ROW_HEIGHT,
            margin: [HOME_GAP, HOME_GAP],
            containerPadding: [0, 0],
          }}
          dragConfig={{ handle: '.home-module__grip' }}
          resizeConfig={{ handles: ['se', 'e', 's'] }}
          layout={constrained}
          onDragStop={next => setLayoutItems(next.map(toItem))}
          onResizeStop={next => setLayoutItems(next.map(toItem))}
        >
          {placed.map(item => {
            const def = getHomeModule(item.i)!;
            return (
              <div
                key={item.i}
                className="home-module home-module--editing"
              >
                <div className="home-module__grip" title="Glisser pour déplacer">
                  <span className="home-module__grip-dots" aria-hidden="true">⠿</span>
                  <span className="home-module__grip-title">{def.title}</span>
                  <button
                    type="button"
                    className="home-module__remove"
                    title="Retirer de l'accueil"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => hideModule(item.i)}
                  >
                    ✕
                  </button>
                </div>
                <div className="home-module__preview">
                  {def.isAvailable && !def.isAvailable(data) ? (
                    <div className="home-module__empty">Rien à afficher pour l'instant</div>
                  ) : (
                    <def.Component />
                  )}
                </div>
              </div>
            );
          })}
        </GridLayout>
      )}
    </div>
  );
}
