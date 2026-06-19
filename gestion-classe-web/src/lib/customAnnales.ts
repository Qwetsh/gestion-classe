import { supabase } from './supabase';
import type { Brevet, Matiere } from './brevets';

// Bucket public partage avec les annales statiques (cf. brevets.ts)
const BUCKET = 'brevets';

// Ligne brute de la table custom_annales
interface CustomAnnaleRow {
  id: string;
  matiere: Matiere;
  annee: number;
  centre: string | null;
  theme: string;
  points: number | null;
  code: string | null;
  file_path: string;
  url: string;
  created_at: string;
}

// Brevet enrichi : un sujet affiche peut etre statique (brevets.ts) ou ajoute
// manuellement (id present → bouton suppression cote prof).
export type BrevetItem = Brevet & {
  id?: string;
  isCustom?: boolean;
  file_path?: string;
};

// Saisie du formulaire d'ajout
export interface NewAnnaleInput {
  matiere: Matiere;
  annee: number;
  centre: string;
  theme: string;
  points: number;
  code: string;
}

function rowToBrevet(r: CustomAnnaleRow): BrevetItem {
  return {
    id: r.id,
    isCustom: true,
    file_path: r.file_path,
    code: r.code ?? '',
    annee: r.annee,
    centre: r.centre ?? '',
    theme: r.theme,
    points: r.points ?? 0,
    url: r.url,
    tailleKo: 0,
    matiere: r.matiere,
  };
}

/** Recupere les sujets ajoutes manuellement (lecture publique, eleves inclus). */
export async function fetchCustomAnnales(): Promise<BrevetItem[]> {
  const { data, error } = await supabase
    .from('custom_annales')
    .select('*')
    .order('annee', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToBrevet);
}

/** Uploade le PDF dans le bucket puis insere la ligne. Reserve au prof connecte. */
export async function addCustomAnnale(input: NewAnnaleInput, file: File): Promise<BrevetItem> {
  const id = crypto.randomUUID();
  const filePath = `custom/${id}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { contentType: 'application/pdf', upsert: true });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  const { data, error } = await supabase
    .from('custom_annales')
    .insert({
      matiere: input.matiere,
      annee: input.annee,
      centre: input.centre.trim() || null,
      theme: input.theme.trim(),
      points: input.points || 0,
      code: input.code.trim() || null,
      file_path: filePath,
      url: pub.publicUrl,
    })
    .select()
    .single();

  if (error) {
    // Rollback du fichier uploade si l'insertion echoue
    await supabase.storage.from(BUCKET).remove([filePath]);
    throw error;
  }
  return rowToBrevet(data);
}

/** Supprime un sujet ajoute manuellement (fichier + ligne). Reserve au prof connecte. */
export async function deleteCustomAnnale(item: BrevetItem): Promise<void> {
  if (!item.id) return;
  if (item.file_path) {
    await supabase.storage.from(BUCKET).remove([item.file_path]);
  }
  const { error } = await supabase.from('custom_annales').delete().eq('id', item.id);
  if (error) throw error;
}
