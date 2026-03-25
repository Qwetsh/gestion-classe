import { useState } from 'react';

const RATIOS = [
  { label: '16:9', w: 16, h: 9, maxW: '' },
  { label: '4:3', w: 4, h: 3, maxW: '' },
  { label: '1:1', w: 1, h: 1, maxW: '' },
  { label: '📱 Téléphone', w: 9, h: 19.5, maxW: '375px' },
  { label: 'Plein', w: 0, h: 0, maxW: '' },
];

export default function IframeGenerator() {
  const [url, setUrl] = useState('');
  const [ratioIdx, setRatioIdx] = useState(0);
  const [height, setHeight] = useState(500);
  const [borderless, setBorderless] = useState(true);
  const [allowFullscreen, setAllowFullscreen] = useState(true);
  const [copied, setCopied] = useState(false);

  const ratio = RATIOS[ratioIdx];
  const styleparts: string[] = [];
  if (ratio.w > 0) styleparts.push(`aspect-ratio: ${ratio.w}/${ratio.h}`);
  if (ratio.maxW) styleparts.push(`max-width: ${ratio.maxW}`);

  const iframeCode = url.trim()
    ? `<iframe src="${url.trim()}" width="100%" ${
        ratio.w > 0
          ? `style="${styleparts.join('; ')}"`
          : `height="${height}"`
      }${borderless ? ' frameborder="0"' : ''}${
        allowFullscreen ? ' allowfullscreen' : ''
      } loading="lazy"></iframe>`
    : '';

  function copy() {
    navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const previewUrl = url.trim();

  return (
    <div className="space-y-6">
      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Lien à intégrer
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

      {/* Options */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Ratio */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Ratio</label>
          <div className="flex gap-1">
            {RATIOS.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRatioIdx(i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  ratioIdx === i
                    ? 'text-white'
                    : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border)]'
                }`}
                style={ratioIdx === i ? { background: 'var(--gradient-primary)' } : undefined}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Height (only for "Plein") */}
        {ratio.w === 0 && (
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1">
              Hauteur (px)
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              min={100}
              max={2000}
              step={50}
              className="w-24 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
            />
          </div>
        )}

        {/* Toggles */}
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={borderless}
            onChange={(e) => setBorderless(e.target.checked)}
            className="rounded"
          />
          Sans bordure
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={allowFullscreen}
            onChange={(e) => setAllowFullscreen(e.target.checked)}
            className="rounded"
          />
          Plein écran
        </label>
      </div>

      {/* Generated code */}
      {iframeCode && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-[var(--color-text-tertiary)]">Code HTML</label>
            <button
              onClick={copy}
              className="px-3 py-1 rounded-lg text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-soft)] hover:bg-[var(--color-primary)] hover:text-white transition-all"
            >
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text)] overflow-x-auto whitespace-pre-wrap break-all select-all">
            {iframeCode}
          </pre>
        </div>
      )}

      {/* Live preview */}
      {previewUrl && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-2">Aperçu</label>
          <div
            className="rounded-2xl overflow-hidden border border-[var(--color-border)]"
            style={{ boxShadow: 'var(--shadow-md)' }}
          >
            <iframe
              src={previewUrl}
              width="100%"
              style={
                ratio.w > 0
                  ? { aspectRatio: `${ratio.w}/${ratio.h}`, maxWidth: ratio.maxW || undefined }
                  : { height }
              }
              frameBorder={borderless ? '0' : undefined}
              allowFullScreen={allowFullscreen}
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}
