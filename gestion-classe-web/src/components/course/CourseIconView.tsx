/**
 * Icône dans le texte (lot T16a) : un dessin Lucide de la taille et de la couleur du texte qui
 * l'entoure (la couleur appliquée au texte s'applique à l'icône). Le jeu d'icônes est chargé à
 * la première icône affichée.
 */
import { useEffect, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import type { LucideIcon } from 'lucide-react';

let iconSet: Promise<Map<string, LucideIcon>> | null = null;
const loadIconSet = () => (iconSet ??= import('./courseIconSet').then((m) => m.COURSE_ICON_BY_NAME));

export function CourseIconView({ node, selected }: NodeViewProps) {
  const name = String(node.attrs.name ?? '');
  const [Icon, setIcon] = useState<LucideIcon | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadIconSet().then((set) => { if (!cancelled) setIcon(() => set.get(name) ?? null); });
    return () => { cancelled = true; };
  }, [name]);

  return (
    <NodeViewWrapper as="span" className={`ce-icon ${selected ? 'is-selected' : ''}`} data-icon={name} title={name}>
      {Icon ? <Icon size="1.15em" strokeWidth={2.1} aria-hidden /> : <span className="ce-icon__wait">·</span>}
    </NodeViewWrapper>
  );
}
