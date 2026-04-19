import { useState } from 'react';

type Format = 'mp3' | 'mp4';
type Quality = '320' | '256' | '128' | '64';
type VideoQuality = '1080' | '720' | '480' | '360';

const COBALT_API = 'https://cobalt-classit.fly.dev/';
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/;

const MONTHLY_LIMIT = 50;
const RATE_KEY = 'yt-converter-usage';

function getMonthlyUsage(): { month: string; count: number } {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
  try {
    const raw = localStorage.getItem(RATE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.month === currentMonth) return data;
    }
  } catch { /* ignore */ }
  return { month: currentMonth, count: 0 };
}

function incrementUsage() {
  const usage = getMonthlyUsage();
  usage.count++;
  localStorage.setItem(RATE_KEY, JSON.stringify(usage));
}

export default function YouTubeConverter() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<Format>('mp3');
  const [audioQuality, setAudioQuality] = useState<Quality>('128');
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('720');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState('');

  const usage = getMonthlyUsage();
  const remaining = MONTHLY_LIMIT - usage.count;

  const isValidUrl = YOUTUBE_REGEX.test(url.trim());

  async function handleConvert() {
    if (!isValidUrl) return;

    if (remaining <= 0) {
      setError(`Limite mensuelle atteinte (${MONTHLY_LIMIT} conversions/mois). Réessayez le mois prochain.`);
      return;
    }

    setLoading(true);
    setError('');
    setDownloadUrl(null);

    try {
      const body: Record<string, string> = {
        url: url.trim(),
      };

      if (format === 'mp3') {
        body.downloadMode = 'audio';
        body.audioFormat = 'mp3';
        body.audioBitrate = audioQuality;
      } else {
        body.downloadMode = 'auto';
        body.videoQuality = videoQuality;
      }

      const res = await fetch(COBALT_API, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.status === 'tunnel' || data.status === 'redirect') {
        incrementUsage();
        setDownloadUrl(data.url);
        setFilename(data.filename || `youtube-${format === 'mp3' ? 'audio' : 'video'}.${format}`);
      } else if (data.status === 'picker') {
        const pick = data.picker?.[0];
        if (pick?.url) {
          incrementUsage();
          setDownloadUrl(pick.url);
          setFilename(`youtube-${format === 'mp3' ? 'audio' : 'video'}.${format}`);
        } else {
          setError('Aucun résultat trouvé pour cette vidéo.');
        }
      } else if (data.status === 'error') {
        const msg = data.error?.code || 'Erreur inconnue';
        setError(`Erreur : ${msg}`);
      } else {
        setError('Réponse inattendue du serveur.');
      }
    } catch {
      setError('Impossible de contacter le service de conversion.');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }

  function reset() {
    setDownloadUrl(null);
    setError('');
  }

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Lien YouTube
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); reset(); }}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
          autoFocus
        />
        {url.trim() && !isValidUrl && (
          <p className="mt-1 text-xs text-[var(--color-error)]">Lien YouTube invalide</p>
        )}
      </div>

      {/* Format selection */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-2">Format</label>
        <div className="flex gap-2">
          <button
            onClick={() => { setFormat('mp3'); reset(); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              format === 'mp3'
                ? 'text-white shadow-sm'
                : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border)]'
            }`}
            style={format === 'mp3' ? { background: 'var(--gradient-primary)' } : undefined}
          >
            🎵 MP3 (Audio)
          </button>
          <button
            onClick={() => { setFormat('mp4'); reset(); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              format === 'mp4'
                ? 'text-white shadow-sm'
                : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border)]'
            }`}
            style={format === 'mp4' ? { background: 'var(--gradient-primary)' } : undefined}
          >
            🎬 MP4 (Vidéo)
          </button>
        </div>
      </div>

      {/* Quality selection */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-2">
          Qualité {format === 'mp3' ? 'audio' : 'vidéo'}
        </label>
        {format === 'mp3' ? (
          <div className="flex flex-wrap gap-2">
            {([['320', '320 kbps (Haute)'], ['256', '256 kbps'], ['128', '128 kbps (Standard)'], ['64', '64 kbps (Légère)']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => { setAudioQuality(val); reset(); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  audioQuality === val
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {([['1080', '1080p (Full HD)'], ['720', '720p (HD)'], ['480', '480p'], ['360', '360p (Légère)']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => { setVideoQuality(val); reset(); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  videoQuality === val
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Convert button */}
      <div className="flex flex-col items-center gap-4">
        {!downloadUrl ? (
          <button
            onClick={handleConvert}
            disabled={!isValidUrl || loading}
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
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-success-soft)] text-[var(--color-success)]">
              <span className="text-lg">✓</span>
              <span className="text-sm font-medium">Fichier prêt !</span>
            </div>
            <button
              onClick={handleDownload}
              className="px-8 py-3 rounded-xl text-white font-medium text-base transition-all hover:scale-105"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-sm)' }}
            >
              Télécharger {format.toUpperCase()}
            </button>
            <p className="text-xs text-[var(--color-text-tertiary)]">{filename}</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--color-error)] text-center max-w-md">{error}</p>
        )}
      </div>

      {/* Info + usage */}
      <div className="mt-4 p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] space-y-2">
        <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
          Utilise le service open-source <strong>cobalt.tools</strong> pour la conversion.
          Fonctionne avec les liens YouTube classiques et les Shorts.
          Aucune donnée n'est stockée.
        </p>
        <p className={`text-xs font-medium ${remaining <= 5 ? 'text-[var(--color-error)]' : 'text-[var(--color-text-tertiary)]'}`}>
          {remaining > 0
            ? `${remaining} conversion${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} ce mois-ci`
            : 'Limite mensuelle atteinte'}
        </p>
      </div>
    </div>
  );
}
