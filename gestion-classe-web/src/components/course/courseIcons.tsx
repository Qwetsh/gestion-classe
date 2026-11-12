/**
 * Icônes du ruban de l'éditeur de cours (24 × 24, trait), reprises de la maquette validée
 * (public/_maquettes/editeur-cours.html).
 */
const PATHS = {
  paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="M9 11h6M9 15h4"/>',
  cut: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16 18 4M16 16 6 4"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M5 16V5a2 2 0 0 1 2-2h9"/>',
  clear: '<path d="M4 7V5h12v2M10 5l-3 14M5 19h6"/><path d="M15 13l6 6M21 13l-6 6"/>',
  ul: '<circle cx="5" cy="7" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="5" cy="17" r="1.2"/><path d="M9 7h11M9 12h11M9 17h11"/>',
  ol: '<path d="M4 6h2v4M4 10h3M4 14h3l-3 4h3"/><path d="M10 7h10M10 12h10M10 17h10"/>',
  left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  justify: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
  indent: '<path d="M4 6h16M10 10h10M10 14h10M4 18h16M4 10l3 2-3 2"/>',
  outdent: '<path d="M4 6h16M10 10h10M10 14h10M4 18h16M7 10l-3 2 3 2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M3 14h18M9 4v16M15 4v16"/>',
  encart: '<rect x="2.5" y="6" width="19" height="11" rx="1.5"/><path d="M6 13l3-3 3 2 4-4"/><path d="M5 20h14"/>',
  zone: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M6 9h12M6 13h12M6 17h12"/>',
  sigma: '<path d="M18 5H6l6 7-6 7h12"/>',
  pagebreak: '<path d="M6 3v6h12V3M6 21v-6h12v6"/><path d="M3 12h3M9 12h2M13 12h2M18 12h3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/>',
  hr: '<path d="M3 12h18"/><path d="M7 7h10M7 17h10" opacity=".4"/>',
  marker: '<path d="M5 19l3-1 10-10-2-2L6 16z"/><path d="M3 22h8" stroke-width="3"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h4"/>',
  rename: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  board: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/><path d="M7 12l3-3 2 2 4-4"/>',
  play: '<path d="M7 5v14l11-7z"/>',
  zoomin: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11h6M11 8v6"/>',
  fitwidth: '<path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/><path d="M3 4v16M21 4v16"/>',
  ruler: '<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  rowAbove: '<rect x="3" y="12" width="18" height="8" rx="1"/><path d="M12 3v6M9 6h6"/>',
  rowBelow: '<rect x="3" y="4" width="18" height="8" rx="1"/><path d="M12 15v6M9 18h6"/>',
  colLeft: '<rect x="12" y="3" width="8" height="18" rx="1"/><path d="M3 12h6M6 9v6"/>',
  colRight: '<rect x="4" y="3" width="8" height="18" rx="1"/><path d="M15 12h6M18 9v6"/>',
  delRow: '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M9 10l6 4M15 10l-6 4"/>',
  delCol: '<rect x="8" y="3" width="8" height="18" rx="1"/><path d="M10 9l4 6M14 9l-4 6"/>',
  merge: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M7 12h10M9 10l-2 2 2 2M15 10l2 2-2 2"/>',
  header: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18" stroke-width="3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  alignImgLeft: '<rect x="3" y="5" width="9" height="8" rx="1"/><path d="M15 6h6M15 10h6M3 17h18"/>',
  alignImgCenter: '<rect x="7" y="4" width="10" height="9" rx="1"/><path d="M3 17h18M6 20h12"/>',
  alignImgRight: '<rect x="12" y="5" width="9" height="8" rx="1"/><path d="M3 6h6M3 10h6M3 17h18"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
