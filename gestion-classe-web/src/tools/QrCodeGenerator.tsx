import { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';

const SIZES = [256, 512, 1024];
const COLORS = [
  { label: 'Noir', dark: '#000000', light: '#ffffff' },
  { label: 'Bleu', dark: '#1a56db', light: '#ffffff' },
  { label: 'Rouge', dark: '#c81e1e', light: '#ffffff' },
  { label: 'Vert', dark: '#057a55', light: '#ffffff' },
];

export default function QrCodeGenerator() {
  const [url, setUrl] = useState('');
  const [size, setSize] = useState(512);
  const [colorIdx, setColorIdx] = useState(0);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!url.trim()) {
      setDataUrl(null);
      setError('');
      return;
    }

    const color = COLORS[colorIdx];
    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: { dark: color.dark, light: color.light },
      errorCorrectionLevel: 'M',
    })
      .then(() => {
        setDataUrl(canvasRef.current?.toDataURL('image/png') ?? null);
        setError('');
      })
      .catch(() => setError('Impossible de générer le QR code'));
  }, [url, size, colorIdx]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qrcode-${size}px.png`;
    a.click();
  }

  function copyToClipboard() {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    });
  }

  return (
    <div className="space-y-6">
      {/* Input URL */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Lien ou texte
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://exemple.com"
          className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
          autoFocus
        />
      </div>

      {/* Options row */}
      <div className="flex flex-wrap gap-4">
        {/* Size */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Taille</label>
          <div className="flex gap-1">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  size === s
                    ? 'text-white'
                    : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border)]'
                }`}
                style={size === s ? { background: 'var(--gradient-primary)' } : undefined}
              >
                {s}px
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Couleur</label>
          <div className="flex gap-1">
            {COLORS.map((c, i) => (
              <button
                key={c.label}
                onClick={() => setColorIdx(i)}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  colorIdx === i ? 'border-[var(--color-primary)] scale-110' : 'border-[var(--color-border)]'
                }`}
                style={{ backgroundColor: c.dark }}
                title={c.label}
              />
            ))}
          </div>
        </div>
      </div>

      {/* QR Code display */}
      <div className="flex flex-col items-center gap-4">
        <div
          className={`rounded-2xl p-4 bg-white ${url.trim() ? '' : 'opacity-30'}`}
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          <canvas ref={canvasRef} className="max-w-full h-auto" style={{ maxWidth: 300 }} />
        </div>

        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

        {/* Actions */}
        {dataUrl && (
          <div className="flex gap-3">
            <button
              onClick={download}
              className="px-5 py-2.5 rounded-xl text-white font-medium text-sm transition-all hover:scale-105"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-sm)' }}
            >
              Télécharger PNG
            </button>
            <button
              onClick={copyToClipboard}
              className="px-5 py-2.5 rounded-xl font-medium text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] border border-[var(--color-border)] transition-all hover:bg-[var(--color-border)]"
            >
              Copier
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
