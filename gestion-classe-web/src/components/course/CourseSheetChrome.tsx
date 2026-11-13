/**
 * En-tête et pied de page d'une feuille (lot T9a), dans les marges haute et basse, hors du texte
 * du cours. Double-clic : ouvrir les réglages, comme dans Word.
 */
import type { CourseSettings, HeaderFooterLine } from '../../lib/course/courseDoc';
import { footerOf, isEmptyLine, renderFields, type FieldValues } from './courseHeaderFooter';

interface Props {
  /** Numéro de la feuille (1 pour la première). */
  page: number;
  pages: number;
  settings: CourseSettings;
  values: Omit<FieldValues, 'page' | 'pages'>;
  onEdit?: () => void;
}

function Line({ line, values, kind, onEdit }: { line: HeaderFooterLine; values: FieldValues; kind: 'header' | 'footer'; onEdit?: () => void }) {
  const cell = (text: string | undefined, pos: 'left' | 'center' | 'right') => (
    <span className={`ce-hf__cell ce-hf__cell--${pos}`}>
      {renderFields(text ?? '', values).map((p, i) => (
        p.missing
          ? <span key={i} className="ce-hf__missing" title="Pas de valeur : rattachez le cours à l’emploi du temps">({p.text})</span>
          : <span key={i}>{p.text}</span>
      ))}
    </span>
  );
  return (
    <div
      className={`ce-hf ce-hf--${kind}`}
      onDoubleClick={onEdit ? (e) => { e.preventDefault(); e.stopPropagation(); onEdit(); } : undefined}
      title={onEdit ? `Double-clic : modifier ${kind === 'header' ? 'l’en-tête' : 'le pied de page'}` : undefined}
    >
      {cell(line.left, 'left')}
      {cell(line.center, 'center')}
      {cell(line.right, 'right')}
    </div>
  );
}

export function CourseSheetChrome({ page, pages, settings, values, onEdit }: Props) {
  const all: FieldValues = { ...values, page, pages };
  const blank = page === 1 && !!settings.firstPageBlank;
  const header = settings.header;
  const footer = footerOf(settings);
  return (
    <>
      {/* Zones toujours présentes (même vides) : le double-clic y ouvre les réglages */}
      {blank || isEmptyLine(header)
        ? onEdit && <div className="ce-hf ce-hf--header ce-hf--empty" onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }} title="Double-clic : ajouter un en-tête" />
        : <Line line={header!} values={all} kind="header" onEdit={onEdit} />}
      {blank || isEmptyLine(footer)
        ? onEdit && <div className="ce-hf ce-hf--footer ce-hf--empty" onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }} title="Double-clic : ajouter un pied de page" />
        : <Line line={footer} values={all} kind="footer" onEdit={onEdit} />}
    </>
  );
}
