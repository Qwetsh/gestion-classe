import { supabase } from './supabase';

const BUCKET = 'student-photos';

export interface GroupSessionPhoto {
  id: string;
  session_id: string;
  file_path: string;
  caption: string;
  display_order: number;
  created_at: string;
}

export async function fetchSessionPhotos(sessionId: string): Promise<GroupSessionPhoto[]> {
  const { data, error } = await supabase
    .from('group_session_photos')
    .select('*')
    .eq('session_id', sessionId)
    .order('display_order')
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function uploadSessionPhoto(
  userId: string,
  sessionId: string,
  file: File,
  caption: string = '',
): Promise<GroupSessionPhoto> {
  const photoId = crypto.randomUUID();
  const filePath = `${userId}/tp/${sessionId}/${photoId}.jpg`;

  // Resize to max 1200px (higher res than event photos — these are reference images)
  const resized = await resizeImage(file, 1200, 0.88);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, resized, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  // Get current max order
  const { data: existing } = await supabase
    .from('group_session_photos')
    .select('display_order')
    .eq('session_id', sessionId)
    .order('display_order', { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('group_session_photos')
    .insert({ session_id: sessionId, file_path: filePath, caption, display_order: nextOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSessionPhoto(photo: GroupSessionPhoto): Promise<void> {
  // Delete from storage
  await supabase.storage.from(BUCKET).remove([photo.file_path]);
  // Delete DB record
  const { error } = await supabase
    .from('group_session_photos')
    .delete()
    .eq('id', photo.id);
  if (error) throw error;
}

export async function updatePhotoCaption(photoId: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from('group_session_photos')
    .update({ caption })
    .eq('id', photoId);
  if (error) throw error;
}

export async function getPhotoUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600); // 1h
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
