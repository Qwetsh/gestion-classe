/**
 * Panneau « Activité » du tableau blanc : la fiche donnée aux élèves, ses documents et sa
 * correction, à portée de main sans quitter le tableau, et de quoi en prélever un morceau
 * (paragraphe, question, image, tableau) pour le poser en direct sur la page.
 *
 * L'activité d'un tableau est retrouvée par son titre et sa séquence (le tableau improvisé depuis
 * l'emploi du temps porte ceux de l'activité choisie) ; à défaut, on la choisit dans la liste du
 * niveau et ce choix est gardé pour ce tableau.
 *
 * Sélection : un toucher choisit le plus petit bloc utile, chaque nouveau toucher dessus l'élargit
 * (voir lib/activityBlocks.ts). On insère en texte modifiable ou en image fidèle à la mise en page.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { fetchBoard, listBoards } from '../../lib/boardsQueries';
import { fetchCourseDoc, type CourseDoc } from '../../lib/course/courseDoc';
import { variantLabel, type ActivityGroup, type CourseVariant } from '../../lib/courseLibrary';
import { findActivityGroup, pickableActivities, searchActivities, type PickableSequence } from '../../lib/activitySuggest';
import { extendRange, pickLevels, pickedContent, type PickRange, type PickedImage } from '../../lib/activityBlocks';
import { captureRange } from '../../lib/activityCapture';
import { signedUrl } from '../../lib/boardMedia';
import { sanitizeBoardHtml } from '../../lib/boardText';
import { ActivityReader, type ReaderTouch } from './ActivityReader';

interface Props {
  userId: string;
  /** Où mémoriser le choix de l'activité : l'identifiant du tableau, ou de la séance. */
  anchorKey: string;
  /** Tableau préparé ouvert : son titre et sa séquence désignent l'activité. */
  boardId?: string;
  /** Niveau de la classe (4e…), pour la liste des activités quand rien n'est encore choisi. */
  level: string | null;
  onClose: () => void;
  onInsertText: (html: string) => void;
  onInsertTable: (cells: string[][], header: boolean) => void;
  onInsertImageBlob: (blob: Blob) => Promise<void> | void;
}

const STORE = 'classroom-board-activity:';
const SIDE_KEY = 'classroom-activity-side';

interface Choice { title: string; chapter: string | null }

function readChoice(anchorKey: string): Choice | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE + anchorKey) || 'null') as Choice | null;
    return raw && typeof raw.title === 'string' ? raw : null;
  } catch { return null; }
}

/** Sélection en cours : les niveaux possibles du toucher, celui qui est choisi, et les blocs ajoutés à la suite. */
interface Pick { levels: PickRange[]; level: number; extra: number }

const contains = (r: PickRange, pos: number) => pos >= r.from && pos <= r.to;

export function BoardActivityPanel({ userId, anchorKey, boardId, level, onClose, onInsertText, onInsertTable, onInsertImageBlob }: Props) {
  const [sequences, setSequences] = useState<PickableSequence[] | null>(null);
  const [choice, setChoice] = useState<Choice | null>(() => readChoice(anchorKey));
  const [boardMeta, setBoardMeta] = useState<Choice | null | undefined>(boardId ? undefined : null);
  const [variant, setVariant] = useState<CourseVariant | null>(null);
  const [docs, setDocs] = useState<Map<string, CourseDoc | null>>(new Map());
  const [failed, setFailed] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>(() => { try { return localStorage.getItem(SIDE_KEY) === 'left' ? 'left' : 'right'; } catch { return 'right'; } });
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Bibliothèque du niveau + titre et séquence du tableau
  useEffect(() => {
    let cancelled = false;
    listBoards(userId).then((boards) => {
      if (cancelled) return;
      // Sans niveau de classe, le niveau du tableau compte : on lit d'abord ses métadonnées
      setSequences(pickableActivities(boards, level));
    }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [userId, level]);
  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    fetchBoard(boardId).then((b) => { if (!cancelled) setBoardMeta(b ? { title: b.title, chapter: b.chapter } : null); }, () => { if (!cancelled) setBoardMeta(null); });
    return () => { cancelled = true; };
  }, [boardId]);

  const found = useMemo(() => {
    if (!sequences || boardMeta === undefined) return null;
    const candidates = [choice, boardMeta].filter((c): c is Choice => !!c);
    for (const c of candidates) {
      const hit = findActivityGroup(sequences, c.title, c.chapter);
      if (hit) return hit;
    }
    return null;
  }, [sequences, choice, boardMeta]);
  const group: ActivityGroup | null = found?.group ?? null;

  const variants = useMemo(() => (group ? group.members.filter((m) => m.variant !== 'copie') : []), [group]);
  const shownVariant = variant && variants.some((m) => m.variant === variant) ? variant : variants[0]?.variant ?? null;
  const shown = variants.find((m) => m.variant === shownVariant)?.board ?? null;

  // Le document de l'onglet montré, lu à la demande
  useEffect(() => {
    if (!shown || docs.has(shown.id)) return;
    let cancelled = false;
    fetchCourseDoc(shown.id).then(
      (d) => { if (!cancelled) setDocs((prev) => new Map(prev).set(shown.id, d)); },
      () => { if (!cancelled) setDocs((prev) => new Map(prev).set(shown.id, null)); },
    );
    return () => { cancelled = true; };
  }, [shown, docs]);
  const doc = shown ? docs.get(shown.id) : undefined;

  // Changer d'onglet ou d'activité efface la sélection
  const [selectionFor, setSelectionFor] = useState<string | null>(null);
  if (selectionFor !== (shown?.id ?? null)) { setSelectionFor(shown?.id ?? null); setPick(null); setNotice(null); }

  const chooseActivity = (g: ActivityGroup, chapter: string) => {
    const next = { title: g.title, chapter };
    setChoice(next);
    setVariant(null);
    try { localStorage.setItem(STORE + anchorKey, JSON.stringify(next)); } catch { /* stockage indisponible */ }
  };

  const range = useMemo<PickRange | null>(() => {
    if (!pick || !editor || editor.isDestroyed) return null;
    return extendRange(editor.state.doc, pick.levels[pick.level], pick.extra);
  }, [pick, editor]);

  const onTouch = useCallback((t: ReaderTouch) => {
    if (!editor || editor.isDestroyed) return;
    const levels = pickLevels(editor.state.doc, t.pos, t.inside);
    setNotice(null);
    if (levels.length === 0) { setPick(null); return; }
    setPick((prev) => {
      if (prev) {
        const cur = prev.levels[prev.level];
        // Toucher la sélection en cours : on l'élargit d'un cran (puis on repart du plus petit)
        const at = t.inside >= 0 ? t.inside : t.pos;
        if (contains(cur, at)) return { levels: prev.levels, level: (prev.level + 1) % prev.levels.length, extra: 0 };
      }
      return { levels, level: 0, extra: 0 };
    });
  }, [editor]);

  const grow = (delta: 1 | -1) => setPick((p) => (p ? { ...p, level: Math.max(0, Math.min(p.levels.length - 1, p.level + delta)), extra: 0 } : p));
  const addNext = () => setPick((p) => (p ? { ...p, extra: p.extra + 1 } : p));

  const imageBlob = async (img: PickedImage): Promise<Blob | null> => {
    const url = img.path ? await signedUrl(img.path) : img.src;
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? res.blob() : null;
  };

  const insertText = async () => {
    if (!editor || !range || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const content = pickedContent(editor.state.doc, range);
      if (content.table) onInsertTable(content.table.cells.map((row) => row.map((c) => sanitizeBoardHtml(c))), content.table.header);
      else if (content.html) onInsertText(sanitizeBoardHtml(content.html));
      let missed = 0;
      for (const img of content.images) {
        const blob = await imageBlob(img).catch(() => null);
        if (blob) await onInsertImageBlob(blob); else missed++;
      }
      setNotice(missed > 0 ? `Posé sur le tableau (${missed} image${missed > 1 ? 's' : ''} n’a pas pu être lue${missed > 1 ? 's' : ''}).` : 'Posé sur le tableau.');
    } catch (err) {
      console.error('[activité] insertion en texte :', err);
      setNotice('Insertion impossible.');
    } finally {
      setBusy(false);
    }
  };

  const insertImage = async () => {
    if (!editor || !range || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await onInsertImageBlob(await captureRange(editor.view, range));
      setNotice('Image posée sur le tableau.');
    } catch (err) {
      console.error('[activité] insertion en image :', err);
      setNotice('Image impossible : essayez « Texte ».');
    } finally {
      setBusy(false);
    }
  };

  const flip = () => {
    const next = side === 'right' ? 'left' : 'right';
    setSide(next);
    try { localStorage.setItem(SIDE_KEY, next); } catch { /* stockage indisponible */ }
  };

  const readerWidth = Math.min(Math.round(window.innerWidth * 0.46), 560) - 20;
  const chooser = !found && sequences ? searchActivities(sequences, query) : [];

  return (
    <aside className={`ab ab--${side}`} style={{ width: readerWidth + 20 }} aria-label="Activité">
      <header className="ab__head">
        <b className="ab__title" title={group?.title}>{group ? group.title : 'Quelle activité ?'}</b>
        {group && <button type="button" className="ab__ico" onClick={() => { setChoice(null); setBoardMeta(null); setVariant(null); try { localStorage.removeItem(STORE + anchorKey); } catch { /* */ } }} title="Choisir une autre activité">⇆</button>}
        <button type="button" className="ab__ico" onClick={flip} title={side === 'right' ? 'Passer à gauche' : 'Passer à droite'}>↔</button>
        <button type="button" className="ab__ico" onClick={onClose} title="Fermer">✕</button>
      </header>

      {failed && <p className="ab__msg">Bibliothèque illisible.</p>}
      {!sequences && !failed && <p className="ab__msg">Lecture de la bibliothèque…</p>}

      {sequences && !found && boardMeta !== undefined && (
        <div className="ab__choose">
          <p className="ab__msg">{boardMeta === undefined ? '' : 'Ce tableau n’est pas rattaché à une activité. Choisissez-la :'}</p>
          <input className="ab__search" type="search" placeholder="Chercher une activité…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          <div className="ab__list">
            {chooser.map((s) => (
              <div key={s.chapter}>
                <div className="ab__chapter">{s.chapter}</div>
                {s.groups.map((g) => (
                  <button key={g.key} type="button" className="ab__row" onClick={() => chooseActivity(g, s.chapter)}>{g.title}</button>
                ))}
              </div>
            ))}
            {chooser.length === 0 && <p className="ab__msg">Aucune activité{level ? ` en ${level}` : ''}.</p>}
          </div>
        </div>
      )}

      {found && (
        <>
          <nav className="ab__tabs" role="tablist">
            {variants.map((m) => (
              <button key={m.variant} type="button" role="tab" aria-selected={m.variant === shownVariant} className={m.variant === shownVariant ? 'is-on' : ''} onClick={() => setVariant(m.variant)}>
                {variantLabel(m.variant, group?.evaluation)}
              </button>
            ))}
          </nav>
          <div className="ab__scroll">
            {doc === undefined && <p className="ab__msg">Ouverture…</p>}
            {doc === null && <p className="ab__msg">Ce document n’a pas de feuille à montrer (tableau blanc).</p>}
            {doc && shown && (
              <ActivityReader key={shown.id} doc={doc} boardId={shown.id} title={shown.title} width={readerWidth} pick={range} onTouch={onTouch} onEditor={setEditor} />
            )}
          </div>
          <footer className="ab__bar">
            {!range && <span className="ab__hint">Touchez un paragraphe, une question, une image ou un tableau ; touchez encore pour élargir.</span>}
            {range && (
              <>
                <span className="ab__sel"><b>{range.label}</b>{pick && pick.extra > 0 ? ` + ${pick.extra}` : ''}</span>
                <div className="ab__acts">
                  <button type="button" className="ab__go" onClick={() => void insertText()} disabled={busy} title="Poser le texte, modifiable, sur la page">Texte</button>
                  <button type="button" className="ab__go" onClick={() => void insertImage()} disabled={busy} title="Poser une image fidèle à la mise en page">Image</button>
                  <button type="button" className="ab__sm" onClick={() => grow(1)} disabled={!pick || pick.level >= pick.levels.length - 1} title="Élargir la sélection">▲</button>
                  <button type="button" className="ab__sm" onClick={() => grow(-1)} disabled={!pick || (pick.level === 0 && pick.extra === 0)} title="Réduire la sélection">▼</button>
                  <button type="button" className="ab__sm" onClick={addNext} title="Ajouter le bloc suivant">＋</button>
                  <button type="button" className="ab__sm" onClick={() => setPick(null)} title="Effacer la sélection">✕</button>
                </div>
              </>
            )}
            {notice && <span className="ab__notice">{notice}</span>}
          </footer>
        </>
      )}
      <style>{CSS}</style>
    </aside>
  );
}

const CSS = `
.ab { position: fixed; top: 48px; bottom: 0; z-index: 25; display: flex; flex-direction: column; background: #111827; color: #F3F4F6; box-shadow: 0 0 40px rgba(0,0,0,0.45); font: 400 14px/1.4 Inter, system-ui, sans-serif; }
.ab--right { right: 0; border-radius: 14px 0 0 0; }
.ab--left { left: 0; border-radius: 0 14px 0 0; }
.ab__head { display: flex; align-items: center; gap: 6px; padding: 8px 10px; }
.ab__title { flex: 1; min-width: 0; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ab__ico { width: 36px; height: 36px; border: 0; border-radius: 10px; background: #1F2937; color: #E5E7EB; font-size: 16px; cursor: pointer; }
.ab__ico:hover { background: #374151; }
.ab__tabs { display: flex; gap: 6px; padding: 0 10px 8px; }
.ab__tabs button { height: 36px; padding: 0 14px; border: 0; border-radius: 10px; background: #1F2937; color: #E5E7EB; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.ab__tabs button.is-on { background: #4F46E5; color: #FFF; }
.ab__scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 0 10px 10px; background: #1F2937; }
.ab__msg { margin: 10px 4px; color: #9CA3AF; font-size: 13px; }
.ab__choose { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 0 10px 10px; }
.ab__search { height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid #374151; background: #1F2937; color: #F9FAFB; font: 500 15px/1 Inter, system-ui, sans-serif; }
.ab__list { flex: 1; overflow-y: auto; margin-top: 8px; }
.ab__chapter { margin: 10px 2px 4px; font-size: 11px; font-weight: 600; letter-spacing: .04em; color: #9CA3AF; }
.ab__row { display: block; width: 100%; text-align: left; padding: 9px 10px; border: 0; border-radius: 8px; background: none; color: #F3F4F6; font: 500 14px/1.3 Inter, system-ui, sans-serif; cursor: pointer; }
.ab__row:hover { background: #1F2937; }
.ab__bar { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px; min-height: 60px; border-top: 1px solid #374151; background: #111827; }
.ab__hint { color: #9CA3AF; font-size: 13px; }
.ab__sel { font-size: 13px; }
.ab__acts { display: flex; gap: 6px; margin-left: auto; }
.ab__go { height: 40px; padding: 0 16px; border: 0; border-radius: 10px; background: #4F46E5; color: #FFF; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.ab__go:disabled { opacity: .6; cursor: default; }
.ab__sm { width: 40px; height: 40px; border: 0; border-radius: 10px; background: #374151; color: #E5E7EB; font-size: 16px; cursor: pointer; }
.ab__sm:disabled { opacity: .4; cursor: default; }
.ab__notice { position: absolute; left: 10px; right: 10px; bottom: calc(100% + 6px); padding: 7px 10px; border-radius: 8px; background: rgba(17,24,39,.94); color: #FCD34D; font-size: 13px; pointer-events: none; }
/* Lecteur : le document réduit à la largeur du panneau, sur fond clair */
.ab-reader { position: relative; margin: 0 auto; }
.ab-reader__sheets { position: absolute; left: 0; top: 0; transform-origin: 0 0; cursor: pointer; background: #fff; }
.ab-reader .ab-picked { outline: 4px solid #4F46E5; outline-offset: 3px; background: rgba(79,70,229,.10); border-radius: 4px; }
.ab-reader .ce-doc { user-select: none; }
`;
