import { supabase } from './supabase';

const BUCKET = 'student-photos';

export interface TpTemplatePhoto {
  id: string;
  template_id: string;
  file_path: string;
  caption: string;
  display_order: number;
  created_at: string;
}

export async function fetchTemplatePhotos(templateId: string): Promise<TpTemplatePhoto[]> {
  const { data, error } = await supabase
    .from('tp_template_photos')
    .select('*')
    .eq('template_id', templateId)
    .order('display_order')
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function uploadTemplatePhoto(
  userId: string,
  templateId: string,
  file: File,
  caption: string = '',
): Promise<TpTemplatePhoto> {
  const photoId = crypto.randomUUID();
  const filePath = `${userId}/tp-templates/${templateId}/${photoId}.jpg`;

  const resized = await resizeImage(file, 1200, 0.88);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, resized, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  // Get current max order
  const { data: existing } = await supabase
    .from('tp_template_photos')
    .select('display_order')
    .eq('template_id', templateId)
    .order('display_order', { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('tp_template_photos')
    .insert({ template_id: templateId, file_path: filePath, caption, display_order: nextOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTemplatePhoto(photo: TpTemplatePhoto): Promise<void> {
  await supabase.storage.from(BUCKET).remove([photo.file_path]);
  const { error } = await supabase
    .from('tp_template_photos')
    .delete()
    .eq('id', photo.id);
  if (error) throw error;
}

export async function updatePhotoCaption(photoId: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from('tp_template_photos')
    .update({ caption })
    .eq('id', photoId);
  if (error) throw error;
}

export async function getPhotoUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

function resizeImage(file: File, maxSize: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
