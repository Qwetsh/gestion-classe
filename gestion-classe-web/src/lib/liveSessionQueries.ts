import { supabase } from './supabase';

export interface ClassInfo {
  id: string;
  name: string;
}

export interface RoomInfo {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
  disabled_cells: string[];
}

export interface StudentInfo {
  id: string;
  pseudo: string;
  gender: string;
}

export interface SessionEvent {
  id: string;
  student_id: string;
  type: string;
  subtype: string | null;
  note: string | null;
  photo_path: string | null;
  timestamp: string;
}

export async function fetchClassesForUser(userId: string): Promise<ClassInfo[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchRoomsForUser(userId: string): Promise<RoomInfo[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, grid_rows, grid_cols, disabled_cells')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchStudentsForClass(classId: string): Promise<StudentInfo[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, pseudo, gender')
    .eq('class_id', classId)
    .order('pseudo');
  if (error) throw error;
  return data || [];
}

export async function fetchSeatingPlan(
  classId: string,
  roomId: string
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('class_room_plans')
    .select('positions')
    .eq('class_id', classId)
    .eq('room_id', roomId)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return (data?.positions as Record<string, string>) || {};
}

export async function createSession(
  userId: string,
  classId: string,
  roomId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      class_id: classId,
      room_id: roomId,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function insertEvent(
  sessionId: string,
  studentId: string,
  type: string,
  subtype?: string | null,
  note?: string | null,
  photoPath?: string | null
): Promise<SessionEvent> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      session_id: sessionId,
      student_id: studentId,
      type,
      subtype: subtype || null,
      note: note || null,
      photo_path: photoPath || null,
      timestamp: new Date().toISOString(),
    })
    .select('id, student_id, type, subtype, note, photo_path, timestamp')
    .single();
  if (error) throw error;
  return data;
}

const PHOTO_BUCKET = 'student-photos';

export async function uploadEventPhoto(
  userId: string,
  eventId: string,
  file: File
): Promise<string> {
  const filePath = `${userId}/events/${eventId}.jpg`;

  // Resize via canvas before upload
  const resized = await resizeImage(file, 600, 0.85);

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(filePath, resized, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) throw error;
  return data.path;
}

export async function updateEventPhotoPath(eventId: string, photoPath: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ photo_path: photoPath })
    .eq('id', eventId);
  if (error) throw error;
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
        quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export async function endSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  if (error) throw error;
}

export async function updateSessionNotes(sessionId: string, notes: string | null): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ notes })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function cancelSession(sessionId: string): Promise<void> {
  // Delete all events first, then delete the session
  const { error: eventsError } = await supabase
    .from('events')
    .delete()
    .eq('session_id', sessionId);
  if (eventsError) throw eventsError;

  const { error: sessionError } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);
  if (sessionError) throw sessionError;
}

export async function fetchEventsForSession(sessionId: string): Promise<SessionEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, student_id, type, subtype, note, photo_path, timestamp')
    .eq('session_id', sessionId)
    .order('timestamp');
  if (error) throw error;
  return data || [];
}

// Oral evaluation queries
export interface OralEvaluation {
  id: string;
  student_id: string;
  class_id: string;
  grade: number;
  trimester: number;
  school_year: string;
  created_at: string;
}

function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  // School year starts in September
  if (month >= 9) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function getCurrentTrimester(): number {
  const month = new Date().getMonth() + 1;
  if (month >= 9 || month <= 12) return 1; // Sep-Dec
  if (month >= 1 && month <= 3) return 2;  // Jan-Mar
  return 3; // Apr-Jun/Jul
}

export async function fetchOralEvaluations(
  userId: string,
  classId: string
): Promise<OralEvaluation[]> {
  const schoolYear = getCurrentSchoolYear();
  const trimester = getCurrentTrimester();
  const { data, error } = await supabase
    .from('oral_evaluations')
    .select('id, student_id, class_id, grade, trimester, school_year, created_at')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .eq('school_year', schoolYear)
    .eq('trimester', trimester);
  if (error) throw error;
  return data || [];
}

export async function insertOralEvaluation(
  userId: string,
  studentId: string,
  classId: string,
  grade: number
): Promise<OralEvaluation> {
  const { data, error } = await supabase
    .from('oral_evaluations')
    .insert({
      user_id: userId,
      student_id: studentId,
      class_id: classId,
      grade,
      trimester: getCurrentTrimester(),
      school_year: getCurrentSchoolYear(),
    })
    .select('id, student_id, class_id, grade, trimester, school_year, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOralEvaluationsForClass(
  userId: string,
  classId: string
): Promise<void> {
  const { error } = await supabase
    .from('oral_evaluations')
    .delete()
    .eq('user_id', userId)
    .eq('class_id', classId)
    .eq('school_year', getCurrentSchoolYear())
    .eq('trimester', getCurrentTrimester());
  if (error) throw error;
}
