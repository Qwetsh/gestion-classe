/**
 * Onglet TP de l'espace élève (PLAN_tp_groupes.md, lot 3 ; migration 088, fonction Edge tp-eleve).
 * L'élève n'a pas de compte : tout passe par son code à 6 chiffres. La liste et le détail viennent
 * des fonctions de la base ; photos et cours, de la fonction Edge, qui signe les adresses.
 */
import { supabase } from './supabase';
import { seedSignedUrls } from './boardMedia';
import type { CourseDoc } from './course/courseDoc';

export interface StudentTpItem {
  session_id: string;
  name: string;
  activity: string | null;
  level: string | null;
  status: 'active' | 'completed' | string;
  started_at: string;
  ended_at: string | null;
  group_name: string;
  group_order: number;
  mates: string[];
  photo_count: number;
  corrected: boolean;
}

export type StudentTpDocKind = 'fiche' | 'protocole' | 'documents';

export interface StudentTpDoc {
  kind: StudentTpDocKind;
  board_id: string;
  title: string;
  updated_at: string;
}

export interface StudentTpPhoto {
  id: string;
  created_at: string;
  caption: string | null;
  whole_class: boolean;
  author: string;
}

export interface StudentTpDetail {
  session_id: string;
  status: string;
  name: string;
  started_at: string;
  corrected: boolean;
  absent: boolean;
  group: {
    id: string;
    name: string;
    order: number;
    comment: string | null;
    members: { pseudo: string; me: boolean }[];
  };
  template: {
    name: string;
    level: string | null;
    chapter: string | null;
    activity: string | null;
    problem: string | null;
    materials: string[];
    protocol: string[];
    safety: string[];
  } | null;
  docs: StudentTpDoc[];
  photos: StudentTpPhoto[];
}

export class StudentTpError extends Error {
  kind: 'forbidden' | 'not_found' | 'network' | 'server';
  constructor(kind: StudentTpError['kind']) {
    super(kind);
    this.kind = kind;
  }
}

/** TP en groupes de l'élève, du plus récent au plus ancien ; liste vide si le code ne répond pas. */
export async function fetchStudentTps(code: string): Promise<StudentTpItem[]> {
  const { data, error } = await supabase.rpc('get_student_tps', { p_code: code });
  if (error) throw new StudentTpError('server');
  const res = data as { error?: string; tps?: StudentTpItem[] } | null;
  if (!res || res.error) return [];
  return res.tps ?? [];
}

export async function fetchStudentTp(code: string, sessionId: string): Promise<StudentTpDetail> {
  const { data, error } = await supabase.rpc('get_student_tp', { p_code: code, p_session_id: sessionId });
  if (error) throw new StudentTpError('server');
  const res = data as (StudentTpDetail & { error?: string }) | null;
  if (!res || res.error) throw new StudentTpError(res?.error === 'not_found' ? 'not_found' : 'forbidden');
  return res;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('tp-eleve', { body });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    throw new StudentTpError(status === 403 ? 'forbidden' : status === 404 ? 'not_found' : status ? 'server' : 'network');
  }
  if (!data) throw new StudentTpError('server');
  return data;
}

/** Adresses signées des photos visibles par l'élève (son groupe et toute la classe), par photo. */
export async function fetchStudentTpPhotoUrls(code: string, sessionId: string): Promise<Record<string, string>> {
  const res = await call<{ urls?: Record<string, string> }>({ action: 'photos', code, sessionId });
  return res.urls ?? {};
}

/**
 * Lecteur des cours d'un TP : chaque cours est demandé au serveur une fois, et les adresses de ses
 * images, signées par le serveur, sont posées là où le rendu des cours les cherche.
 */
export function studentTpDocLoader(code: string, sessionId: string): (doc: StudentTpDoc) => Promise<CourseDoc | null> {
  const cache = new Map<string, Promise<CourseDoc | null>>();
  return (d) => {
    const id = `${d.board_id}|${d.updated_at}`;
    let pending = cache.get(id);
    if (!pending) {
      pending = call<{ doc?: CourseDoc; images?: Record<string, string> }>({ action: 'doc', code, sessionId, boardId: d.board_id }).then((res) => {
        if (res.images && typeof res.images === 'object') seedSignedUrls(res.images);
        return res.doc && typeof res.doc === 'object' ? res.doc : null;
      });
      pending.catch(() => cache.delete(id));
      cache.set(id, pending);
    }
    return pending;
  };
}
