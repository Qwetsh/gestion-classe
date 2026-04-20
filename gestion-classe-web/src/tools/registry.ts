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
    tags: ['lien', 'partage', 'qr', 'générer'],
  },
  {
    id: 'qrreader',
    name: 'Lecteur QR Code',
    description: 'Scanner un QR code avec la caméra ou une image',
    icon: '📷',
    component: lazy(() => import('./QrCodeReader')),
    tags: ['qr', 'scanner', 'lire', 'caméra', 'image'],
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
    id: 'wordsearch',
    name: 'Mots mêlés',
    description: 'Générer des mots mêlés (libre ou vocabulaire collège)',
    icon: '🔍',
    component: lazy(() => import('./WordSearchGenerator')),
    tags: ['jeu', 'vocabulaire', 'grille', 'recherche'],
  },
  {
    id: 'iframe',
    name: 'Iframe',
    description: 'Générer un code iframe pour intégrer une page web',
    icon: '🖼️',
    component: lazy(() => import('./IframeGenerator')),
    tags: ['lien', 'intégration', 'embed'],
  },
  {
    id: 'youtube',
    name: 'YouTube → MP3 / MP4',
    description: 'Convertir une vidéo YouTube en fichier audio MP3 ou vidéo MP4',
    icon: '🎬',
    component: lazy(() => import('./YouTubeConverter')),
    tags: ['youtube', 'mp3', 'mp4', 'audio', 'vidéo', 'musique', 'convertir'],
  },
  {
    id: 'starwars',
    name: 'Star Wars Intro',
    description: 'Créer une intro Star Wars personnalisée avec texte défilant',
    icon: '⭐',
    component: lazy(() => import('./StarWarsIntro')),
    tags: ['star wars', 'intro', 'animation', 'vidéo', 'fun', 'présentation'],
  },
  {
    id: 'newspaper',
    name: 'Générateur de Journal',
    description: 'Créer une page de une de journal avec photos, articles et mise en page automatique',
    icon: '📰',
    component: lazy(() => import('./NewspaperGenerator')),
    tags: ['journal', 'une', 'article', 'presse', 'photo', 'mise en page', 'pdf', 'projet'],
  },
  {
    id: 'timeline',
    name: 'Frise Chronologique',
    description: 'Créer une frise chronologique avec événements, images et export PNG/PDF',
    icon: '📅',
    component: lazy(() => import('./TimelineGenerator')),
    tags: ['frise', 'chronologie', 'histoire', 'dates', 'événements', 'timeline', 'pdf'],
  },
];

export function getToolById(id: string): Tool | undefined {
  return tools.find((t) => t.id === id);
}
