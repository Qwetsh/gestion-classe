import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type Format = 'mp3' | 'mp4';

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/;
const MP3_MONTHLY_LIMIT = 500;
const MP4_MONTHLY_LIMIT = 10;
const NOTIFY_THRESHOLD = 100;
const NTFY_TOPIC = 'classit-yt-downloads';

const RAPIDAPI_KEY = '1fb03c8ff1msh06089b15f0946bdp18c0d0jsn018a1f508aa7';
const RAPIDAPI_HOST_MP3 = 'youtube-mp36.p.rapidapi.com';
const RAPIDAPI_HOST_MP4 = 'youtube-mp4-downloader.p.rapidapi.com';
const RAPIDAPI_USER_MD5 = 'd7126324c7b7c35bcb8455c4b84bb832';

// Users allowed to use MP4 (limited resource)
const MP4_ALLOWED_EMAILS = [
  'tomicharles@gmail.com',
  'auralimar.marchand57@gmail.com',
];

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/shorts\/)([^?\s]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function getMonthlyCount(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count } = await supabase
    .from('yt_download_log')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth);
  return count ?? 0;
}

async function logDownload() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('yt_download_log').insert({ user_id: user.id });
}

async function notifyIfThreshold(count: number) {
  if (count === NOTIFY_THRESHOLD) {
    try {
      await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: NTFY_TOPIC,
          title: "Class'it - Alerte téléchargements YouTube",
          message: `${count} téléchargements ce mois-ci. Surveillez l'usage.`,
          priority: 4,
          tags: ['warning'],
        }),
      });
    } catch { /* notification best-effort */ }
  }
}

async function fetchMp3(videoId: string): Promise<{ status: string; link?: string; title?: string; msg?: string }> {
  const res = await fetch(
    `https://${RAPIDAPI_HOST_MP3}/dl?id=${encodeURIComponent(videoId)}`,
    {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST_MP3,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    }
  );
  return res.json();
}

async function fetchMp4(videoUrl: string): Promise<{ success: boolean; title?: string; download?: string; error?: string }> {
  const res = await fetch(
    `https://${RAPIDAPI_HOST_MP4}/mp4?url=${encodeURIComponent(videoUrl)}`,
    {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST_MP4,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    }
  );
  return res.json();
}

export default function YouTubeConverter() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<Format>('mp3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    getMonthlyCount().then(setMonthlyCount);
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  const mp4Allowed = userEmail ? MP4_ALLOWED_EMAILS.includes(userEmail) : false;

  const isValidUrl = YOUTUBE_REGEX.test(url.trim());

  async function handleConvert() {
    if (!isValidUrl) return;

    if (monthlyCount >= MP3_MONTHLY_LIMIT) {
      setError(`Limite mensuelle atteinte. Réessayez le mois prochain.`);
      return;
    }

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      setError('Impossible d\'extraire l\'ID de la vidéo.');
      return;
    }

    setLoading(true);
    setError('');
    setDownloadUrl(null);

    try {
      if (format === 'mp3') {
        let data = await fetchMp3(videoId);

        // Handle "processing" status with retry
        if (data.status === 'processing') {
          await new Promise(r => setTimeout(r, 1500));
          data = await fetchMp3(videoId);
        }
        if (data.status === 'processing') {
          await new Promise(r => setTimeout(r, 2000));
          data = await fetchMp3(videoId);
        }

        if (data.status === 'ok' && data.link) {
          await logDownload();
          const newCount = monthlyCount + 1;
          setMonthlyCount(newCount);
          await notifyIfThreshold(newCount);
          setDownloadUrl(data.link);
          setTitle(data.title || 'audio');
        } else {
          setError(data.msg || 'Erreur lors de la conversion. Réessayez.');
        }
      } else {
        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const data = await fetchMp4(ytUrl);

        if (data.success && data.download) {
          await logDownload();
          const newCount = monthlyCount + 1;
          setMonthlyCount(newCount);
          await notifyIfThreshold(newCount);
          setDownloadUrl(data.download);
          setTitle(data.title || 'video');
        } else {
          setError(data.error || 'Erreur lors de la conversion MP4. Réessayez.');
        }
      }
    } catch {
      setError('Impossible de contacter le service de conversion.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!downloadUrl) return;

    if (format === 'mp4') {
      // MP4 links are direct downloads
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${title}.mp4`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      return;
    }

    // MP3 needs x-run header
    try {
      setLoading(true);
      const res = await fetch(downloadUrl, {
        headers: { 'x-run': RAPIDAPI_USER_MD5 },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${title}.mp3`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(downloadUrl, '_blank');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setDownloadUrl(null);
    setError('');
  }

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
          Lien YouTube
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); reset(); }}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-lg focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-transparent"
          autoFocus
        />
        {url.trim() && !isValidUrl && (
          <p className="mt-1 text-xs text-[var(--neg)]">Lien YouTube invalide</p>
        )}
      </div>

      {/* Format selection */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-dim)] mb-2">Format</label>
        <div className="flex gap-2">
          <button
            onClick={() => { setFormat('mp3'); reset(); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              format === 'mp3'
                ? 'text-white shadow-sm'
                : 'text-[var(--text-muted)] bg-[var(--surface-3)] border border-[var(--border)] hover:bg-[var(--border)]'
            }`}
            style={format === 'mp3' ? { background: 'var(--gradient-primary)' } : undefined}
          >
            🎵 MP3 (Audio)
          </button>
          <button
            onClick={() => { if (mp4Allowed) { setFormat('mp4'); reset(); } }}
            disabled={!mp4Allowed}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              format === 'mp4'
                ? 'text-white shadow-sm'
                : !mp4Allowed
                  ? 'text-[var(--text-dim)] bg-[var(--surface-3)] border border-[var(--border)] opacity-50 cursor-not-allowed'
                  : 'text-[var(--text-muted)] bg-[var(--surface-3)] border border-[var(--border)] hover:bg-[var(--border)]'
            }`}
            style={format === 'mp4' ? { background: 'var(--gradient-primary)' } : undefined}
          >
            🎬 MP4 (Vidéo)
          </button>
        </div>
        {!mp4Allowed && (
          <p className="mt-2 text-xs text-[var(--text-dim)]">
            MP4 : accès restreint. Contactez l'administrateur pour l'activer.
          </p>
        )}
        {format === 'mp4' && mp4Allowed && (
          <p className="mt-2 text-xs text-[var(--text-dim)]">
            MP4 : limité à {MP4_MONTHLY_LIMIT}/mois
          </p>
        )}
      </div>

      {/* Convert button */}
      <div className="flex flex-col items-center gap-4">
        {!downloadUrl ? (
          <button
            onClick={handleConvert}
            disabled={!isValidUrl || loading || monthlyCount >= MP3_MONTHLY_LIMIT}
            className="px-8 py-3 rounded-xl text-white font-medium text-base transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-sm)' }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Conversion en cours…
              </span>
            ) : (
              `Convertir en ${format.toUpperCase()}`
            )}
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--pos-soft)] text-[var(--pos)]">
              <span className="text-lg">✓</span>
              <span className="text-sm font-medium">Fichier prêt !</span>
            </div>
            <button
              onClick={handleDownload}
              className="px-8 py-3 rounded-xl text-white font-medium text-base transition-all hover:scale-105"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-sm)' }}
            >
              {loading ? 'Téléchargement…' : `Télécharger ${format.toUpperCase()}`}
            </button>
            <p className="text-xs text-[var(--text-dim)] text-center max-w-sm truncate">{title}.{format}</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--neg)] text-center max-w-md">{error}</p>
        )}
      </div>

      {/* Info + usage */}
      <div className="mt-4 p-4 rounded-xl bg-[var(--surface-3)] border border-[var(--border)] space-y-2">
        <p className="text-xs text-[var(--text-dim)] leading-relaxed">
          Convertit les vidéos YouTube en MP3 (128 kbps) ou MP4.
          Fonctionne avec les liens classiques et les Shorts.
        </p>
        <p className="text-xs text-[var(--text-dim)]">
          Limites : {MP3_MONTHLY_LIMIT} MP3/mois • {MP4_MONTHLY_LIMIT} MP4/mois
        </p>
      </div>
    </div>
  );
}
