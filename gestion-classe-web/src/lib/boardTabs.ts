/**
 * Onglets de l'espace de travail du tableau blanc (BoardWorkspace) : un onglet = ce qu'il faut
 * pour monter un `Whiteboard` (séance, tableau préparé, brouillon local).
 */
import { FREE_BOARD_ID, type Board } from './boardsQueries';

export interface BoardTab {
  key: string;
  kind: 'session' | 'board' | 'draft';
  sessionId: string;
  boardId?: string;
  title: string;
  remote: boolean;
}

/** Onglet d'un tableau préparé (`boards.id`). */
export const boardTab = (b: Pick<Board, 'id' | 'title'>): BoardTab => ({ key: `board:${b.id}`, kind: 'board', sessionId: `board:${b.id}`, boardId: b.id, title: b.title, remote: true });
/** Onglet du brouillon local (gardé sur cet appareil). */
export const draftTab = (): BoardTab => ({ key: 'draft', kind: 'draft', sessionId: FREE_BOARD_ID, title: 'Brouillon', remote: false });
/** Onglet du tableau d'une séance (suivi par le téléphone en classe). */
export const sessionTab = (sessionId: string, title: string): BoardTab => ({ key: `session:${sessionId}`, kind: 'session', sessionId, title, remote: true });

export const MAX_TABS = 6;
