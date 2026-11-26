import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { SECTION_LABEL, type SheetRole } from '../../lib/binder';
import { pagesFromReleased } from '../../lib/binderRelease';
import { fetchStudentToc, type StudentToc } from '../../lib/studentBinder';

/** Ce qui distingue deux pages d'une même activité dans le sommaire. */
const ROLE_NOTE: Partial<Record<SheetRole, string>> = {
  documents: 'Documents',
  correction: 'Correction',
};

type Line = { head: string } | { key: string; label: string; note?: string };
interface Group { title: string | null; lines: Line[] }

interface Props {
  /** Code de l'élève : le serveur ne rend que ce que le professeur a ouvert à sa classe. */
  code: string;
  /** Ouvre le classeur, sur une page donnée (sa clé) ou au début. */
  onOpen: (pageKey?: string) => void;
}

/**
 * Sommaire du classeur dans « Cours » : l'élève voit ce que contient son classeur et l'ouvre
 * directement à la bonne page, sans passer par le bouton Sommaire du classeur lui-même.
 *
 * Mêmes pages et même ordre que le classeur (`pagesFromReleased`). Si le sommaire ne répond pas,
 * il reste une ligne qui ouvre le classeur au début.
 */
export function StudentBinderToc({ code, onOpen }: Props) {
  /** Sommaire lu pour un code ; il ne vaut que pour lui. */
  const [loaded, setLoaded] = useState<{ code: string; toc: StudentToc | null } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchStudentToc({ code }).then(
      (toc) => { if (alive) setLoaded({ code, toc }); },
      () => { if (alive) setLoaded({ code, toc: null }); },
    );
    return () => { alive = false; };
  }, [code]);

  const mine = loaded?.code === code ? loaded : null;
  const groups = useMemo<Group[]>(() => {
    const toc = mine?.toc;
    if (!toc) return [];
    const { pages } = pagesFromReleased(toc.entries, (id) => toc.boards.get(id));
    const out: Group[] = [];
    let group: Group | null = null;
    let chapter: string | null = null;
    for (const p of pages) {
      if (p.kind === 'divider') {
        group = { title: SECTION_LABEL[p.section], lines: [] };
        out.push(group);
        chapter = null;
        continue;
      }
      if (p.kind !== 'sheet') continue;
      if (!group) { group = { title: null, lines: [] }; out.push(group); }
      if (p.chapter && p.chapter !== chapter) {
        chapter = p.chapter;
        group.lines.push({ head: p.chapter });
      }
      // L'intitulé court dit souvent déjà « documents » : l'étiquette ne le répète pas
      const note = ROLE_NOTE[p.role];
      group.lines.push({ key: p.key, label: p.label, note: note && !p.label.toLowerCase().includes(note.toLowerCase()) ? note : undefined });
    }
    return out.filter((g) => g.lines.length > 0);
  }, [mine]);

  return (
    <section className="el-section">
      <h2 className="el-h2">Mon classeur</h2>

      {!mine && <p className="el-note">Ouverture du sommaire…</p>}

      {mine && groups.length === 0 && (
        <button type="button" className="el-tile" onClick={() => onOpen()}>
          <span className="el-icon-box"><BookOpen size={22} strokeWidth={1.8} aria-hidden /></span>
          <span className="el-row__body">
            <span className="el-row__title">Ouvrir mon classeur</span>
            {mine.toc && <span className="el-row__meta">Les activités y arrivent au fil des cours</span>}
          </span>
          <ChevronRight size={20} className="el-row__chev" aria-hidden />
        </button>
      )}

      {groups.map((g, gi) => (
        <div key={gi} className="el-card">
          {g.title && <div className="el-subhead">{g.title}</div>}
          {g.lines.map((line, li) => ('head' in line ? (
            <div key={`h${li}`} className="el-rowhead">{line.head}</div>
          ) : (
            <button key={line.key} type="button" className="el-row" onClick={() => onOpen(line.key)}>
              <span className="el-row__body"><span className="el-row__title el-row__title--plain">{line.label}</span></span>
              {line.note && <span className="el-chip el-chip--plain">{line.note}</span>}
              <ChevronRight size={20} className="el-row__chev" aria-hidden />
            </button>
          )))}
        </div>
      ))}
    </section>
  );
}
