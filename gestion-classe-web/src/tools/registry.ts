import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  component: LazyExoticComponent<ComponentType>;
  tags?: string[];
}

export const tools: Tool[] = [
  {
    id: 'qrcode',
    name: 'QR Code',
    description: 'Générer un QR code à partir d\'un lien',
    icon: '📱',
    component: lazy(() => import('./QrCodeGenerator')),
    tags: ['lien', 'partage', 'qr'],
  },
  {
    id: 'crossword',
    name: 'Mots croisés',
    description: 'Générer des mots croisés (libre ou vocabulaire collège)',
    icon: '✏️',
    component: lazy(() => import('./CrosswordGenerator')),
    tags: ['jeu', 'vocabulaire', 'grille', 'svt', 'français', 'anglais', 'histoire', 'maths', 'allemand'],
  },
  {
    id: 'iframe',
    name: 'Iframe',
    description: 'Générer un code iframe pour intégrer une page web',
    icon: '🖼️',
    component: lazy(() => import('./IframeGenerator')),
    tags: ['lien', 'intégration', 'embed'],
  },
];

export function getToolById(id: string): Tool | undefined {
  return tools.find((t) => t.id === id);
}
