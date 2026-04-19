import { useState, useCallback, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { pronoteFetcher } from '../lib/pronoteFetcher';
import type { SessionHandle, TimetableClassLesson, Timetable } from 'pawnote';

// Lazy-load pawnote to catch import errors
let pawnote: typeof import('pawnote') | null = null;
const loadPawnote = async () => {
  if (!pawnote) {
    pawnote = await import('pawnote');
  }
  return pawnote;
};

// ============================================
// Types
// ============================================

interface PronoteLesson {
  id: string;
  startDate: Date;
  endDate: Date;
  subject?: string;
  teacherNames: string[];
  classrooms: string[];
  groupNames: string[];
  canceled: boolean;
  status?: string;
  backgroundColor?: string;
}

// ============================================
// Helpers
// ============================================

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7h - 18h
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function parseLessons(timetable: Timetable): PronoteLesson[] {
  return timetable.classes
    .filter((c): c is TimetableClassLesson => c.is === 'lesson')
    .map(lesson => ({
      id: lesson.id,
      startDate: new Date(lesson.startDate),
      endDate: new Date(lesson.endDate),
      subject: lesson.subject?.name,
      teacherNames: lesson.teacherNames || [],
      classrooms: lesson.classrooms || [],
      groupNames: lesson.groupNames || [],
      canceled: lesson.canceled,
      status: lesson.status,
      backgroundColor: lesson.backgroundColor,
    }));
}

// ============================================
// Components
// ============================================

function LessonCard({ lesson }: { lesson: PronoteLesson }) {
  const bgColor = lesson.canceled
    ? 'var(--color-absence-soft)'
    : lesson.backgroundColor || 'var(--color-primary-soft)';
  const borderColor = lesson.canceled ? 'var(--color-absence)' : lesson.backgroundColor || 'var(--color-primary)';

  return (
    <div
      className={`p-2 text-xs leading-tight overflow-hidden ${lesson.canceled ? 'opacity-60' : ''}`}
      style={{
        background: bgColor,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div className="font-semibold text-[var(--color-text)] truncate">
        {lesson.subject || 'Sans matiere'}
        {lesson.canceled && ' (Annule)'}
      </div>
      {lesson.groupNames.length > 0 && (
        <div className="text-[var(--color-primary)] font-medium truncate">
          {lesson.groupNames.join(', ')}
        </div>
      )}
      {lesson.classrooms.length > 0 && (
        <div className="text-[var(--color-text-tertiary)] truncate">
          {lesson.classrooms.join(', ')}
        </div>
      )}
      <div className="text-[var(--color-text-tertiary)]">
        {formatTime(lesson.startDate)} - {formatTime(lesson.endDate)}
      </div>
    </div>
  );
}

// ============================================
// Main page
// ============================================

export function Pronote() {
  const { toast } = useUIFeedback();

  // Module loading state
  const [moduleReady, setModuleReady] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);

  useEffect(() => {
    loadPawnote()
      .then(() => setModuleReady(true))
      .catch(err => {
        console.error('Failed to load pawnote:', err);
        setModuleError(err?.message || 'Erreur de chargement du module Pronote');
      });
  }, []);

  // Auth state
  const [loginMode, setLoginMode] = useState<'qr' | 'credentials'>('qr');
  const [pronoteUrl, setPronoteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // QR Code state
  const [qrData, setQrData] = useState('');
  const [qrPin, setQrPin] = useState('');

  // Session state
  const [session, setSession] = useState<SessionHandle | null>(null);
  const [userName, setUserName] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');

  // Timetable state
  const [lessons, setLessons] = useState<PronoteLesson[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));
  const [isLoadingTimetable, setIsLoadingTimetable] = useState(false);

  // Extracted classes
  const [detectedClasses, setDetectedClasses] = useState<string[]>([]);

  // ---- Auth via QR Code ----

  const handleConnectQr = useCallback(async () => {
    if (!qrData || !qrPin) {
      toast('Remplissez les donnees QR et le code PIN', 'warning');
      return;
    }

    if (qrPin.length !== 4 || !/^\d{4}$/.test(qrPin)) {
      toast('Le code PIN doit etre 4 chiffres', 'warning');
      return;
    }

    setIsConnecting(true);
    try {
      const pw = await loadPawnote();
      const sess = pw.createSessionHandle(pronoteFetcher);

      // Parse QR data (JSON object from Pronote QR code)
      let qrParsed: { url: string; jeton: string; login: string };
      try {
        qrParsed = JSON.parse(qrData.trim());
      } catch {
        toast('Donnees QR invalides. Copiez le contenu JSON du QR code.');
        setIsConnecting(false);
        return;
      }

      await pw.loginQrCode(sess, {
        deviceUUID: 'gestion-classe-web-' + Date.now(),
        pin: qrPin,
        qr: qrParsed,
      });

      setSession(sess);
      setUserName(sess.user?.resources?.[0]?.name || sess.userResource?.name || 'Enseignant');
      setEstablishmentName(sess.userResource?.establishmentName || '');

      toast('Connecte a Pronote !', 'success');

      // Auto-load current week
      await loadTimetable(sess, getMonday(new Date()));
    } catch (err: unknown) {
      console.error('Pronote QR login error:', err);
      const msg = err instanceof Error ? err.message : 'Erreur de connexion';
      if (msg.includes('credentials') || msg.includes('Credentials') || msg.includes('challenge')) {
        toast('Code PIN incorrect ou QR code expire');
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        toast('Impossible de joindre le serveur Pronote.');
      } else {
        toast(`Erreur : ${msg}`);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [qrData, qrPin, toast]);

  // ---- Auth via credentials (direct, sans ENT) ----

  const handleConnect = useCallback(async () => {
    if (!pronoteUrl || !username || !password) {
      toast('Remplissez tous les champs', 'warning');
      return;
    }

    setIsConnecting(true);
    try {
      const pw = await loadPawnote();
      const sess = pw.createSessionHandle(pronoteFetcher);

      await pw.loginCredentials(sess, {
        url: pronoteUrl.trim(),
        kind: pw.AccountKind.TEACHER,
        username: username.trim(),
        password,
        deviceUUID: 'gestion-classe-web-' + Date.now(),
      });

      setSession(sess);
      setUserName(sess.user?.resources?.[0]?.name || sess.userResource?.name || 'Enseignant');
      setEstablishmentName(sess.userResource?.establishmentName || '');

      toast('Connecte a Pronote !', 'success');

      // Auto-load current week
      await loadTimetable(sess, getMonday(new Date()));
    } catch (err: unknown) {
      console.error('Pronote login error:', err);
      const msg = err instanceof Error ? err.message : 'Erreur de connexion';
      if (msg.includes('credentials') || msg.includes('Credentials')) {
        toast('Identifiants incorrects');
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        toast('Impossible de joindre le serveur Pronote. Verifiez l\'URL.');
      } else {
        toast(`Erreur : ${msg}`);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [pronoteUrl, username, password, toast]);

  // ---- Timetable ----

  const loadTimetable = useCallback(async (sess: SessionHandle, weekStart: Date) => {
    setIsLoadingTimetable(true);
    setCurrentWeekStart(weekStart);

    try {
      const pw = await loadPawnote();
      const startDay = sess.instance?.firstMonday || sess.instance?.firstDate;
      if (!startDay) {
        toast('Impossible de determiner le debut de l\'annee scolaire');
        return;
      }

      const weekNum = pw.translateToWeekNumber(weekStart, new Date(startDay));
      const timetable = await pw.timetableFromWeek(sess, weekNum);
      const parsed = parseLessons(timetable);
      setLessons(parsed);

      // Extract unique class/group names
      const classSet = new Set<string>();
      parsed.forEach(l => l.groupNames.forEach(g => classSet.add(g)));
      setDetectedClasses(Array.from(classSet).sort());
    } catch (err: unknown) {
      console.error('Timetable error:', err);
      toast('Erreur lors du chargement de l\'emploi du temps');
    } finally {
      setIsLoadingTimetable(false);
    }
  }, [toast]);

  const goToWeek = useCallback((offset: number) => {
    if (!session) return;
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + offset * 7);
    loadTimetable(session, newStart);
  }, [session, currentWeekStart, loadTimetable]);

  const goToToday = useCallback(() => {
    if (!session) return;
    loadTimetable(session, getMonday(new Date()));
  }, [session, loadTimetable]);

  // ---- Render helpers ----

  const getLessonsForDayAndHour = (dayIndex: number, hour: number): PronoteLesson[] => {
    const dayDate = new Date(currentWeekStart);
    dayDate.setDate(dayDate.getDate() + dayIndex);

    return lessons.filter(l => {
      const lessonDay = l.startDate.getDay() - 1; // 0=Monday
      if (lessonDay !== dayIndex) return false;
      return l.startDate.getHours() === hour;
    });
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Pronote</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Emploi du temps et import de classes
          </p>
        </div>

        {moduleError && (
          <div
            className="bg-[var(--color-error-soft)] text-[var(--color-error)] p-4"
            style={{ borderRadius: 'var(--radius-lg)' }}
          >
            Erreur de chargement du module Pronote : {moduleError}
          </div>
        )}

        {!moduleReady && !moduleError && (
          <div className="flex justify-center items-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="text-[var(--color-text-secondary)]">Chargement du module Pronote...</span>
            </div>
          </div>
        )}

        {moduleReady && !session ? (
          /* ---- Login form ---- */
          <div
            className="bg-[var(--color-surface)] p-6 max-w-lg mx-auto"
            style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-12 h-12 flex items-center justify-center text-2xl"
                style={{ background: 'var(--color-primary-soft)', borderRadius: 'var(--radius-lg)' }}
              >
                🔗
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Connexion Pronote</h2>
                <p className="text-sm text-[var(--color-text-tertiary)]">Compte enseignant</p>
              </div>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-1 p-1 mb-5 bg-[var(--color-surface-secondary)]" style={{ borderRadius: 'var(--radius-lg)' }}>
              <button
                onClick={() => setLoginMode('qr')}
                className={`flex-1 py-2 px-3 text-sm font-medium transition-all ${
                  loginMode === 'qr'
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                }`}
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                QR Code (ENT/MBN)
              </button>
              <button
                onClick={() => setLoginMode('credentials')}
                className={`flex-1 py-2 px-3 text-sm font-medium transition-all ${
                  loginMode === 'credentials'
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                }`}
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                Identifiants directs
              </button>
            </div>

            {loginMode === 'qr' ? (
              <div className="space-y-4">
                <div
                  className="p-3 text-sm text-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  <strong>Comment faire :</strong>
                  <ol className="mt-2 ml-4 list-decimal space-y-1 text-[var(--color-text-secondary)]">
                    <li>Ouvrez l'app <strong>Pronote</strong> sur votre telephone</li>
                    <li>Allez dans les parametres (roue dentee)</li>
                    <li>Appuyez sur <strong>"Generer un QR code"</strong></li>
                    <li>Choisissez un code PIN a 4 chiffres</li>
                    <li>Scannez le QR code avec une app de scan, copiez le contenu JSON ici</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Contenu du QR code (JSON)
                  </label>
                  <textarea
                    value={qrData}
                    onChange={e => setQrData(e.target.value)}
                    placeholder='{"url":"https://0572582x.index-education.net/pronote","jeton":"...","login":"..."}'
                    rows={3}
                    className="w-full px-4 py-3 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-mono text-xs"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Code PIN (4 chiffres)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={qrPin}
                    onChange={e => setQrPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="1234"
                    className="w-full px-4 py-3 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-center text-2xl tracking-[0.5em] font-mono"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                    onKeyDown={e => e.key === 'Enter' && handleConnectQr()}
                  />
                </div>

                <button
                  onClick={handleConnectQr}
                  disabled={isConnecting || !qrData || qrPin.length !== 4}
                  className="w-full py-3 text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)' }}
                >
                  {isConnecting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Connexion...
                    </span>
                  ) : (
                    'Se connecter via QR Code'
                  )}
                </button>

                <div
                  className="p-3 text-xs text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)]"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  Compatible ENT (MonBureauNumerique, etc.). Vos donnees ne sont pas stockees.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  className="p-3 text-xs text-[var(--color-warning)] bg-[var(--color-warning-soft)]"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  Ce mode ne fonctionne que si votre etablissement autorise la connexion directe (sans ENT). Si vous passez par un ENT (MBN, etc.), utilisez le mode QR Code.
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    URL Pronote de votre etablissement
                  </label>
                  <input
                    type="url"
                    value={pronoteUrl}
                    onChange={e => setPronoteUrl(e.target.value)}
                    placeholder="https://0123456A.index-education.net/pronote/"
                    className="w-full px-4 py-3 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Identifiant
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="votre.identifiant"
                    className="w-full px-4 py-3 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                    onKeyDown={e => e.key === 'Enter' && handleConnect()}
                  />
                </div>

                <button
                  onClick={handleConnect}
                  disabled={isConnecting || !pronoteUrl || !username || !password}
                  className="w-full py-3 text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)' }}
                >
                  {isConnecting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Connexion...
                    </span>
                  ) : (
                    'Se connecter'
                  )}
                </button>

                <div
                  className="p-3 text-xs text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)]"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  Vos identifiants ne sont pas stockes. La connexion est temporaire et directe avec votre serveur Pronote.
                </div>
              </div>
            )}
          </div>
        ) : null}

        {moduleReady && session && (
          /* ---- Connected view ---- */
          <>
            {/* User info bar */}
            <div
              className="bg-[var(--color-surface)] p-4 flex items-center justify-between"
              style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 flex items-center justify-center text-white font-bold"
                  style={{ background: 'var(--gradient-success)', borderRadius: 'var(--radius-lg)' }}
                >
                  {userName.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-[var(--color-text)]">{userName}</div>
                  <div className="text-sm text-[var(--color-text-tertiary)]">{establishmentName}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSession(null);
                  setLessons([]);
                  setDetectedClasses([]);
                  setPassword('');
                }}
                className="px-4 py-2 text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error-soft)] transition-colors"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                Deconnecter
              </button>
            </div>

            {/* Detected classes */}
            {detectedClasses.length > 0 && (
              <div
                className="bg-[var(--color-surface)] p-4"
                style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
              >
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
                  Classes detectees cette semaine
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detectedClasses.map(cls => (
                    <span
                      key={cls}
                      className="px-3 py-1.5 text-sm font-medium bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                      style={{ borderRadius: 'var(--radius-full)' }}
                    >
                      {cls}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Timetable */}
            <div
              className="bg-[var(--color-surface)] overflow-hidden"
              style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
            >
              {/* Week navigation */}
              <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
                <button
                  onClick={() => goToWeek(-1)}
                  className="p-2 hover:bg-[var(--color-surface-hover)] transition-colors"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  ←
                </button>
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-[var(--color-text)]">
                    Semaine du {formatDateShort(currentWeekStart)}
                  </h3>
                  <button
                    onClick={goToToday}
                    className="px-3 py-1 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-soft)] hover:opacity-80 transition-opacity"
                    style={{ borderRadius: 'var(--radius-full)' }}
                  >
                    Aujourd'hui
                  </button>
                </div>
                <button
                  onClick={() => goToWeek(1)}
                  className="p-2 hover:bg-[var(--color-surface-hover)] transition-colors"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  →
                </button>
              </div>

              {isLoadingTimetable ? (
                <div className="flex justify-center items-center h-64">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[var(--color-text-secondary)]">Chargement...</span>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[700px]">
                    {/* Day headers */}
                    <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-[var(--color-border)]">
                      <div className="p-2" />
                      {DAYS.map((day, i) => {
                        const dayDate = new Date(currentWeekStart);
                        dayDate.setDate(dayDate.getDate() + i);
                        const isToday = new Date().toDateString() === dayDate.toDateString();
                        return (
                          <div
                            key={day}
                            className={`p-2 text-center text-sm font-medium border-l border-[var(--color-border)] ${
                              isToday ? 'text-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'text-[var(--color-text-secondary)]'
                            }`}
                          >
                            <div>{day}</div>
                            <div className="text-xs">{formatDateShort(dayDate)}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Time grid */}
                    {HOURS.map(hour => (
                      <div
                        key={hour}
                        className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-[var(--color-border-light)]"
                        style={{ minHeight: '60px' }}
                      >
                        <div className="p-1 text-xs text-[var(--color-text-tertiary)] text-right pr-2 pt-1">
                          {hour}:00
                        </div>
                        {DAYS.map((_, dayIndex) => {
                          const dayLessons = getLessonsForDayAndHour(dayIndex, hour);
                          return (
                            <div
                              key={dayIndex}
                              className="border-l border-[var(--color-border-light)] p-0.5"
                            >
                              {dayLessons.map(lesson => (
                                <LessonCard key={lesson.id} lesson={lesson} />
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!isLoadingTimetable && lessons.length === 0 && (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
                    <span className="text-3xl">📅</span>
                  </div>
                  <p className="text-[var(--color-text-tertiary)]">
                    Aucun cours cette semaine
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
