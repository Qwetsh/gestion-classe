/**
 * Fenêtre « QR code » : fabrique un QR code à partir d'une adresse (vidéo, exercice en ligne,
 * page du manuel…) et l'insère comme une image dans le cours.
 */
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  /** Reçoit l'image (PNG) et sa largeur d'insertion en cm. */
  onInsert: (file: File, widthCm: number) => void;
  onClose: () => void;
}

const SIZES_CM = [2.5, 3, 4, 5];

function normalize(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
}

export function CourseQrDialog({ onInsert, onClose }: Props) {
  const [raw, setRaw] = useState('');
  const [size, setSize] = useState(3);
  const [preview, setPreview] = useState<{ url: string; data: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const url = normalize(raw);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then((data) => { if (!cancelled) setPreview({ url, data }); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [url]);

  const shown = preview && preview.url === url ? preview.data : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || busy) return;
    setBusy(true);
    try {
      // Grand et sans perte de contraste : il doit rester lisible une fois imprimé
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, url, { width: 720, margin: 2, errorCorrectionLevel: 'M' });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) onInsert(new File([blob], 'qrcode.png', { type: 'image/png' }), size);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ce-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="ce-dialog" onSubmit={(e) => void submit(e)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }} role="dialog" aria-label="QR code">
        <h3 className="ce-dialog__title">Insérer un QR code</h3>
        <label className="ce-field">
          <span>Adresse à ouvrir quand on scanne le code</span>
          <input ref={inputRef} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="https://…" inputMode="url" spellCheck={false} />
        </label>
        <div className="ce-qr">
          <div className="ce-qr__preview">{shown ? <img src={shown} alt="Aperçu du QR code" /> : <span>Aperçu</span>}</div>
          <label className="ce-field">
            <span>Taille sur la feuille</span>
            <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {SIZES_CM.map((s) => <option key={s} value={s}>{String(s).replace('.', ',')} cm</option>)}
            </select>
          </label>
        </div>
        <div className="ce-dialog__foot">
          <span className="ce-spacer-flex" />
          <button type="button" className="ce-btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="ce-btn ce-btn--primary" disabled={!url || busy}>{busy ? 'Création…' : 'Insérer'}</button>
        </div>
      </form>
    </div>
  );
}
