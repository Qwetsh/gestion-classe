/**
 * Ruban de l'éditeur de cours, organisé comme Word / LibreOffice : onglets, groupes étiquetés,
 * grandes icônes pour les actions fréquentes. Onglets contextuels « Tableau » et « Image »
 * quand le curseur est dans un tableau ou sur une image.
 *
 * Les boutons ne prennent jamais le focus (mousedown annulé) : la sélection du texte reste en
 * place, comme dans un traitement de texte.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { Icon, type IconName } from './courseIcons';
import { CALLOUT_LABELS, type CalloutKind } from './courseExtensions';
import { COL_W, FONT_FAMILIES, FONT_SIZES_PT } from '../../lib/course/coursePage';

export type RibbonTab = 'fichier' | 'accueil' | 'insertion' | 'affichage' | 'tableau' | 'image';

interface Props {
  editor: Editor;
  onPrint: () => void;
  onExportPdf: () => void;
  onRename: () => void;
  onInsertImage: () => void;
  onInsertLink: () => void;
  onPaste: () => void;
  zoom: number;
  onZoom: (z: number) => void;
  onFitWidth: () => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  onSoon: (what: string) => void;
}

const TEXT_COLORS = [
  { c: '#111827', n: 'Noir' }, { c: '#DC2626', n: 'Rouge' }, { c: '#2563EB', n: 'Bleu' },
  { c: '#16A34A', n: 'Vert' }, { c: '#9333EA', n: 'Violet' }, { c: '#EA580C', n: 'Orange' },
];
const HIGHLIGHTS = [
  { c: '#FEF08A', n: 'Jaune' }, { c: '#BBF7D0', n: 'Vert' }, { c: '#BFDBFE', n: 'Bleu' }, { c: '#FBCFE8', n: 'Rose' },
];

function Big({ icon, label, title, onClick, on, disabled }: { icon: IconName; label: string; title?: string; onClick: () => void; on?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={`ce-big ${on ? 'is-on' : ''}`} title={title ?? label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={28} />
      <span>{label}</span>
    </button>
  );
}

function Sm({ icon, label, title, onClick, on, disabled, children }: { icon?: IconName; label?: string; title: string; onClick: () => void; on?: boolean; disabled?: boolean; children?: ReactNode }) {
  return (
    <button type="button" className={`ce-sm ${on ? 'is-on' : ''}`} title={title} aria-label={title} onClick={onClick} disabled={disabled} aria-pressed={on}>
      {icon && <Icon name={icon} size={16} />}
      {children}
      {label && <span>{label}</span>}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ce-group">
      <div className="ce-group__body">{children}</div>
      <div className="ce-group__label">{label}</div>
    </div>
  );
}

export function CourseRibbon({ editor, onPrint, onExportPdf, onRename, onInsertImage, onInsertLink, onPaste, zoom, onZoom, onFitWidth, showRuler, onToggleRuler, onSoon }: Props) {
  const [tab, setTab] = useState<RibbonTab>('accueil');

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes('textStyle') as { fontFamily?: string; fontSize?: string; color?: string };
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        bullet: e.isActive('bulletList'),
        ordered: e.isActive('orderedList'),
        listItem: e.isActive('listItem'),
        alignLeft: e.isActive({ textAlign: 'left' }),
        alignCenter: e.isActive({ textAlign: 'center' }),
        alignRight: e.isActive({ textAlign: 'right' }),
        alignJustify: e.isActive({ textAlign: 'justify' }),
        h1: e.isActive('heading', { level: 1 }),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        paragraph: e.isActive('paragraph') && !e.isActive('callout'),
        callout: (['definition', 'retenir', 'consigne', 'exemple'] as CalloutKind[]).find((k) => e.isActive('callout', { kind: k })) ?? null,
        fontFamily: ts.fontFamily ?? '',
        fontSize: ts.fontSize ?? '',
        color: ts.color ?? '',
        link: e.isActive('link'),
        inTable: e.isActive('table'),
        onImage: e.isActive('image'),
        imageAlign: (e.getAttributes('image') as { align?: string }).align ?? 'center',
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  // Onglets contextuels : on y bascule quand ils apparaissent, on en sort quand ils disparaissent
  useEffect(() => {
    if (s.onImage) setTab('image');
    else if (tab === 'image') setTab('accueil');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.onImage]);
  useEffect(() => {
    if (!s.inTable && tab === 'tableau') setTab('accueil');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.inTable]);

  const c = () => editor.chain().focus();
  const sizePt = s.fontSize.endsWith('pt') ? s.fontSize.slice(0, -2) : '';

  const tabs: { id: RibbonTab; label: string; contextual?: boolean }[] = [
    { id: 'fichier', label: 'Fichier' },
    { id: 'accueil', label: 'Accueil' },
    { id: 'insertion', label: 'Insertion' },
    { id: 'affichage', label: 'Affichage' },
    ...(s.inTable ? [{ id: 'tableau' as const, label: 'Tableau', contextual: true }] : []),
    ...(s.onImage ? [{ id: 'image' as const, label: 'Image', contextual: true }] : []),
  ];

  return (
    <div className="ce-ribbonwrap" onMouseDown={(e) => { const t = e.target as HTMLElement; if (t.closest('button')) e.preventDefault(); }}>
      <nav className="ce-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`ce-tab ${t.id === 'fichier' ? 'ce-tab--file' : ''} ${t.contextual ? 'ce-tab--ctx' : ''} ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="ce-ribbon" role="toolbar" aria-label="Ruban">
        {tab === 'fichier' && (
          <>
            <Group label="Imprimer">
              <Big icon="print" label="Imprimer" title="Imprimer le cours (Ctrl+P)" onClick={onPrint} />
              <Big icon="pdf" label="Exporter en PDF" title="Exporter en PDF : choisir « Enregistrer au format PDF » dans la fenêtre d'impression" onClick={onExportPdf} />
            </Group>
            <Group label="Cours">
              <Big icon="rename" label="Renommer" onClick={onRename} />
            </Group>
          </>
        )}

        {tab === 'accueil' && (
          <>
            <Group label="Presse-papiers">
              <Big icon="paste" label="Coller" title="Coller (Ctrl+V)" onClick={onPaste} />
              <div className="ce-stack">
                <Sm icon="cut" label="Couper" title="Couper (Ctrl+X)" onClick={() => { editor.commands.focus(); document.execCommand('cut'); }} />
                <Sm icon="copy" label="Copier" title="Copier (Ctrl+C)" onClick={() => { editor.commands.focus(); document.execCommand('copy'); }} />
                <Sm icon="clear" label="Effacer la mise en forme" title="Effacer la mise en forme" onClick={() => c().unsetAllMarks().unsetTextAlign().run()} />
              </div>
            </Group>

            <Group label="Police">
              <div className="ce-stack">
                <div className="ce-row">
                  <select
                    className="ce-select ce-select--font"
                    value={s.fontFamily}
                    onChange={(e) => { const v = e.target.value; if (v) c().setFontFamily(v).run(); else c().unsetFontFamily().run(); }}
                    title="Police"
                    aria-label="Police"
                  >
                    {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value ?? ''}>{f.label}</option>)}
                  </select>
                  <select
                    className="ce-select"
                    value={sizePt || (s.fontSize ? '' : '12')}
                    onChange={(e) => { const v = e.target.value; if (v === '12') c().unsetFontSize().run(); else c().setFontSize(`${v}pt`).run(); }}
                    title="Taille de police"
                    aria-label="Taille de police"
                  >
                    {!sizePt && s.fontSize && <option value="">—</option>}
                    {FONT_SIZES_PT.map((p) => <option key={p} value={String(p)}>{p}</option>)}
                  </select>
                </div>
                <div className="ce-row">
                  <Sm title="Gras (Ctrl+B)" on={s.bold} onClick={() => c().toggleBold().run()}><b className="ce-glyph">G</b></Sm>
                  <Sm title="Italique (Ctrl+I)" on={s.italic} onClick={() => c().toggleItalic().run()}><i className="ce-glyph">I</i></Sm>
                  <Sm title="Souligné (Ctrl+U)" on={s.underline} onClick={() => c().toggleUnderline().run()}><u className="ce-glyph">S</u></Sm>
                  <Sm title="Barré" on={s.strike} onClick={() => c().toggleStrike().run()}><s className="ce-glyph">ab</s></Sm>
                  <span className="ce-sep" />
                  {TEXT_COLORS.map((t) => (
                    <button
                      key={t.c}
                      type="button"
                      className={`ce-swatch ${s.color.toLowerCase() === t.c.toLowerCase() || (!s.color && t.c === '#111827') ? 'is-on' : ''}`}
                      style={{ background: t.c }}
                      title={`Couleur du texte : ${t.n}`}
                      aria-label={`Couleur du texte : ${t.n}`}
                      onClick={() => (t.c === '#111827' ? c().unsetColor().run() : c().setColor(t.c).run())}
                    />
                  ))}
                </div>
                <div className="ce-row">
                  <span className="ce-minilabel"><Icon name="marker" size={15} /> Surligner</span>
                  {HIGHLIGHTS.map((h) => (
                    <button
                      key={h.c}
                      type="button"
                      className={`ce-swatch ${editor.isActive('highlight', { color: h.c }) ? 'is-on' : ''}`}
                      style={{ background: h.c }}
                      title={`Surligner en ${h.n.toLowerCase()}`}
                      aria-label={`Surligner en ${h.n.toLowerCase()}`}
                      onClick={() => c().toggleHighlight({ color: h.c }).run()}
                    />
                  ))}
                  <Sm title="Retirer le surlignage" onClick={() => c().unsetHighlight().run()}><span className="ce-glyph ce-glyph--sm">Aucun</span></Sm>
                </div>
              </div>
            </Group>

            <Group label="Paragraphe">
              <div className="ce-stack">
                <div className="ce-row">
                  <Sm icon="ul" title="Liste à puces" on={s.bullet} onClick={() => c().toggleBulletList().run()} />
                  <Sm icon="ol" title="Liste numérotée" on={s.ordered} onClick={() => c().toggleOrderedList().run()} />
                  <Sm icon="outdent" title="Diminuer le retrait (Maj+Tab)" disabled={!s.listItem} onClick={() => c().liftListItem('listItem').run()} />
                  <Sm icon="indent" title="Augmenter le retrait (Tab)" disabled={!s.listItem} onClick={() => c().sinkListItem('listItem').run()} />
                </div>
                <div className="ce-row">
                  <Sm icon="left" title="Aligner à gauche (Ctrl+Maj+L)" on={s.alignLeft} onClick={() => c().setTextAlign('left').run()} />
                  <Sm icon="center" title="Centrer (Ctrl+Maj+E)" on={s.alignCenter} onClick={() => c().setTextAlign('center').run()} />
                  <Sm icon="right" title="Aligner à droite (Ctrl+Maj+R)" on={s.alignRight} onClick={() => c().setTextAlign('right').run()} />
                  <Sm icon="justify" title="Justifier (Ctrl+Maj+J)" on={s.alignJustify} onClick={() => c().setTextAlign('justify').run()} />
                </div>
              </div>
            </Group>

            <Group label="Styles">
              <div className="ce-styles">
                <button type="button" className={`ce-style ${s.paragraph && !s.h1 && !s.h2 && !s.h3 ? 'is-on' : ''}`} onClick={() => c().setParagraph().run()} title="Texte du cours (Ctrl+Alt+0)">
                  <span className="ce-style__p">Texte du cours</span><small>Normal</small>
                </button>
                <button type="button" className={`ce-style ${s.h1 ? 'is-on' : ''}`} onClick={() => c().toggleHeading({ level: 1 }).run()} title="Titre 1 (Ctrl+Alt+1)">
                  <span className="ce-style__h1">Chapitre</span><small>Titre 1</small>
                </button>
                <button type="button" className={`ce-style ${s.h2 ? 'is-on' : ''}`} onClick={() => c().toggleHeading({ level: 2 }).run()} title="Titre 2 (Ctrl+Alt+2)">
                  <span className="ce-style__h2">1. Partie</span><small>Titre 2</small>
                </button>
                <button type="button" className={`ce-style ${s.h3 ? 'is-on' : ''}`} onClick={() => c().toggleHeading({ level: 3 }).run()} title="Titre 3 (Ctrl+Alt+3)">
                  <span className="ce-style__h3">a. Sous-partie</span><small>Titre 3</small>
                </button>
                {(Object.keys(CALLOUT_LABELS) as CalloutKind[]).map((k) => (
                  <button key={k} type="button" className={`ce-style ${s.callout === k ? 'is-on' : ''}`} onClick={() => c().toggleCallout(k).run()} title={`Encadré « ${CALLOUT_LABELS[k]} » (cliquer à nouveau pour le retirer)`}>
                    <span className={`ce-style__box ce-style__box--${k}`}>{CALLOUT_LABELS[k]}</span><small>Encadré</small>
                  </button>
                ))}
              </div>
            </Group>
          </>
        )}

        {tab === 'insertion' && (
          <>
            <Group label="Illustrations">
              <Big icon="image" label="Image" title="Image depuis l'ordinateur (ou collez / glissez une image dans le cours)" onClick={onInsertImage} />
              <Big icon="table" label="Tableau" title="Tableau de 3 × 3" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
            </Group>
            <Group label="Spécial cours">
              <Big icon="encart" label="Encart tableau" title="Bientôt : un bloc 16:9 de la largeur du texte, exactement un écran en classe" onClick={() => onSoon('Les encarts tableau arrivent à la prochaine étape.')} />
              <Big icon="zone" label="Zone d'écriture" title="Bientôt : lignes Seyès ou carreaux imprimées vides, où l'on écrit au stylet en classe" onClick={() => onSoon('Les zones d’écriture arrivent à la prochaine étape.')} />
            </Group>
            <Group label="Texte">
              <Big icon="link" label="Lien" title="Lien vers une page web" on={s.link} onClick={onInsertLink} />
              <Big icon="hr" label="Trait" title="Trait de séparation" onClick={() => c().setHorizontalRule().run()} />
            </Group>
            <Group label="Pages">
              <Big icon="pagebreak" label="Saut de page" title="Saut de page (Ctrl+Entrée) : seulement sur papier" onClick={() => c().setPageBreak().run()} />
            </Group>
          </>
        )}

        {tab === 'affichage' && (
          <>
            <Group label="Mode">
              <Big icon="doc" label="Texte" on onClick={() => undefined} />
              <Big icon="board" label="Tableau" title="Bientôt : dessiner par-dessus le cours" onClick={() => onSoon('Le mode Tableau arrive à l’étape 3.')} />
              <Big icon="play" label="En classe" title="Bientôt : le cours projeté en classe" onClick={() => onSoon('Le mode En classe arrive à l’étape 4.')} />
            </Group>
            <Group label="Zoom">
              <Big icon="zoomin" label={`${Math.round(zoom * 100)} %`} title="Revenir à 100 %" onClick={() => onZoom(1)} />
              <Big icon="fitwidth" label="Largeur de page" onClick={onFitWidth} />
            </Group>
            <Group label="Repères">
              <Big icon="ruler" label="Règle" on={showRuler} onClick={onToggleRuler} />
            </Group>
          </>
        )}

        {tab === 'tableau' && (
          <>
            <Group label="Lignes et colonnes">
              <div className="ce-stack">
                <Sm icon="rowAbove" label="Ligne au-dessus" title="Insérer une ligne au-dessus" onClick={() => c().addRowBefore().run()} />
                <Sm icon="rowBelow" label="Ligne en dessous" title="Insérer une ligne en dessous" onClick={() => c().addRowAfter().run()} />
                <Sm icon="delRow" label="Supprimer la ligne" title="Supprimer la ligne" onClick={() => c().deleteRow().run()} />
              </div>
              <div className="ce-stack">
                <Sm icon="colLeft" label="Colonne à gauche" title="Insérer une colonne à gauche" onClick={() => c().addColumnBefore().run()} />
                <Sm icon="colRight" label="Colonne à droite" title="Insérer une colonne à droite" onClick={() => c().addColumnAfter().run()} />
                <Sm icon="delCol" label="Supprimer la colonne" title="Supprimer la colonne" onClick={() => c().deleteColumn().run()} />
              </div>
            </Group>
            <Group label="Cellules">
              <Big icon="merge" label="Fusionner / scinder" onClick={() => c().mergeOrSplit().run()} />
              <Big icon="header" label="Ligne d'en-tête" onClick={() => c().toggleHeaderRow().run()} />
            </Group>
            <Group label="Tableau">
              <Big icon="trash" label="Supprimer le tableau" onClick={() => c().deleteTable().run()} />
            </Group>
          </>
        )}

        {tab === 'image' && (
          <>
            <Group label="Position">
              <Big icon="alignImgLeft" label="À gauche" on={s.imageAlign === 'left'} onClick={() => c().updateAttributes('image', { align: 'left' }).run()} />
              <Big icon="alignImgCenter" label="Centrée" on={s.imageAlign === 'center'} onClick={() => c().updateAttributes('image', { align: 'center' }).run()} />
              <Big icon="alignImgRight" label="À droite" on={s.imageAlign === 'right'} onClick={() => c().updateAttributes('image', { align: 'right' }).run()} />
            </Group>
            <Group label="Taille">
              <div className="ce-stack">
                {[25, 50, 75, 100].map((p) => (
                  <Sm key={p} label={`${p} % de la largeur`} title={`${p} % de la largeur du texte`} onClick={() => c().updateAttributes('image', { width: Math.round((COL_W * p) / 100) }).run()} />
                ))}
              </div>
            </Group>
            <Group label="Image">
              <Big icon="trash" label="Supprimer l'image" onClick={() => c().deleteSelection().run()} />
            </Group>
          </>
        )}
      </div>
    </div>
  );
}
