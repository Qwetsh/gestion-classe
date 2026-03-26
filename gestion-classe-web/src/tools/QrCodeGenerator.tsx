import { useState, useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';

const EXPORT_SIZE = 1024;
const COLORS = [
  { label: 'Noir', dark: '#000000', light: '#ffffff' },
  { label: 'Bleu', dark: '#1a56db', light: '#ffffff' },
  { label: 'Rouge', dark: '#c81e1e', light: '#ffffff' },
  { label: 'Vert', dark: '#057a55', light: '#ffffff' },
];

export default function QrCodeGenerator() {
  const [url, setUrl] = useState('');
  const [colorIdx, setColorIdx] = useState(0);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  const [logoReady, setLogoReady] = useState(false);

  // Load logo image when source changes
  useEffect(() => {
    if (!logoSrc) {
      logoRef.current = null;
      setLogoReady(false);
      return;
    }
    setLogoReady(false);
    const img = new Image();
    img.onload = () => {
      logoRef.current = img;
      setLogoReady(true);
    };
    img.src = logoSrc;
  }, [logoSrc]);

  const drawLogo = useCallback((canvas: HTMLCanvasElement) => {
    const logo = logoRef.current;
    if (!logo || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = canvas.width;
    // Logo = 20% of QR code size
    const logoSize = Math.round(canvasSize * 0.2);
    const padding = Math.round(logoSize * 0.15);
    const bgSize = logoSize + padding * 2;
    const x = Math.round((canvasSize - bgSize) / 2);
    const y = Math.round((canvasSize - bgSize) / 2);

    // White rounded background
    const radius = Math.round(bgSize * 0.15);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + bgSize - radius, y);
    ctx.quadraticCurveTo(x + bgSize, y, x + bgSize, y + radius);
    ctx.lineTo(x + bgSize, y + bgSize - radius);
    ctx.quadraticCurveTo(x + bgSize, y + bgSize, x + bgSize - radius, y + bgSize);
    ctx.lineTo(x + radius, y + bgSize);
    ctx.quadraticCurveTo(x, y + bgSize, x, y + bgSize - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    // Draw logo centered
    ctx.drawImage(logo, x + padding, y + padding, logoSize, logoSize);
  }, []);

  useEffect(() => {
    if (!url.trim()) {
      setDataUrl(null);
      setError('');
      return;
    }

    const color = COLORS[colorIdx];
    // Use H (high) error correction when logo is present, M otherwise
    const errorCorrectionLevel = logoSrc ? 'H' : 'M';

    QRCode.toCanvas(canvasRef.current, url, {
      width: EXPORT_SIZE,
      margin: 2,
      color: { dark: color.dark, light: color.light },
      errorCorrectionLevel,
    })
      .then(() => {
        if (logoSrc && logoRef.current) {
          drawLogo(canvasRef.current!);
        }
        setDataUrl(canvasRef.current?.toDataURL('image/png') ?? null);
        setError('');
      })
      .catch(() => setError('Impossible de générer le QR code'));
  }, [url, colorIdx, logoSrc, logoReady, drawLogo]);

  function handleLogoUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoSrc(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setLogoSrc(null);
  }

  function download() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qrcode-${EXPORT_SIZE}px.png`;
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
      <div className="flex flex-wrap gap-4 items-end">
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

        {/* Logo */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Logo central</label>
          {logoSrc ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg border border-[var(--color-border)] overflow-hidden bg-white">
                <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <button
                onClick={removeLogo}
                className="px-2 py-1.5 rounded-lg text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-error-soft)] transition-all"
              >
                Retirer
              </button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border)] transition-all cursor-pointer">
              Ajouter
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
      </div>

      {/* QR Code display */}
      <div className="flex flex-col items-center gap-4">
        <div
          className={`rounded-2xl p-4 bg-white ${url.trim() ? '' : 'opacity-30'}`}
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          <canvas ref={canvasRef} style={{ width: 300, height: 300 }} />
        </div>

        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

        {logoSrc && dataUrl && (
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Correction d'erreur haute (H) activee pour compenser le logo
          </p>
        )}

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
