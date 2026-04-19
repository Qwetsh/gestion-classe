import { useState, useRef, useCallback, useEffect } from 'react';
import jsQR from 'jsqr';

export default function QrCodeReader() {
  const [result, setResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  const stopCamera = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsScanning(true);
      scanFrame();
    } catch {
      setError('Impossible d\'acceder a la camera. Verifiez les permissions.');
    }
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      setResult(code.data);
      stopCamera();
      return;
    }

    animRef.current = requestAnimationFrame(scanFrame);
  }, [stopCamera]);

  // Also allow reading from image file
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        setResult(code.data);
      } else {
        setError('Aucun QR code detecte dans cette image.');
      }
    };
    img.src = URL.createObjectURL(file);
  }, []);

  const copyToClipboard = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result);
    }
  }, [result]);

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* Camera view */}
      {isScanning && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-2/3 h-2/3 border-2 border-white/50 rounded-xl" />
          </div>
          <button
            onClick={stopCamera}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur text-white text-sm hover:bg-black/70 transition-colors"
          >
            Fermer
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Actions */}
      {!isScanning && (
        <div className="flex flex-col gap-3">
          <button
            onClick={startCamera}
            className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Scanner avec la camera
          </button>

          <label className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium text-center cursor-pointer hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors">
            Ou importer une image
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-[var(--color-error-soft)] text-[var(--color-error)] text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)]">
            <p className="text-xs font-medium text-[var(--color-text-tertiary)] mb-2 uppercase tracking-wide">Resultat</p>
            <p className="text-[var(--color-text)] break-all font-mono text-sm whitespace-pre-wrap">
              {result}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-medium hover:opacity-90 transition-opacity text-sm"
            >
              Copier
            </button>
            <button
              onClick={() => { setResult(null); startCamera(); }}
              className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-surface-hover)] transition-colors text-sm"
            >
              Scanner un autre
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
