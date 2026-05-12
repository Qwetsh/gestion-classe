import { useState, useRef, useCallback, type CSSProperties } from 'react';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, PageBreak, HeadingLevel } from 'docx';

// ─── Types ──────────────────────────────────────────────────

type ConversionMode = 'convert' | 'resize' | 'pdf' | 'effects' | 'pdfToWord';
type ImageFormat = 'png' | 'jpeg' | 'webp';
type ImageEffect = 'none' | 'grayscale' | 'sepia' | 'invert' | 'blur' | 'sharpen';
type CropPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:4' | '9:16';

interface FileItem {
  id: string;
  file: File;
  preview: string;
  width: number;
  height: number;
}

let counter = 0;
function uid() { return `file_${Date.now()}_${counter++}`; }

// ─── Helpers ────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// Apply pixel-level effects via ImageData
function applyEffect(ctx: CanvasRenderingContext2D, w: number, h: number, effect: ImageEffect) {
  if (effect === 'none') return;

  if (effect === 'blur') {
    // Use CSS filter for blur
    ctx.filter = 'blur(2px)';
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(ctx.canvas, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.filter = 'blur(2px)';
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none';
    return;
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];

    if (effect === 'grayscale') {
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      data[i] = data[i + 1] = data[i + 2] = gray;
    } else if (effect === 'sepia') {
      data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    } else if (effect === 'invert') {
      data[i] = 255 - r;
      data[i + 1] = 255 - g;
      data[i + 2] = 255 - b;
    } else if (effect === 'sharpen') {
      // Simple contrast boost as approximation
      const factor = 1.3;
      data[i] = Math.min(255, Math.max(0, factor * (r - 128) + 128));
      data[i + 1] = Math.min(255, Math.max(0, factor * (g - 128) + 128));
      data[i + 2] = Math.min(255, Math.max(0, factor * (b - 128) + 128));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function addWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, opacity: number) {
  if (!text) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#000';
  const fontSize = Math.max(16, Math.min(w, h) / 15);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';

  // Diagonal repeated watermark
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);

  const stepX = fontSize * 8;
  const stepY = fontSize * 3;
  const diag = Math.sqrt(w * w + h * h);

  for (let y = -diag; y < diag; y += stepY) {
    for (let x = -diag; x < diag; x += stepX) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

interface ProcessOptions {
  format: ImageFormat;
  quality: number;
  maxWidth?: number;
  maxHeight?: number;
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  effect: ImageEffect;
  watermark: string;
  watermarkOpacity: number;
  cropPreset: CropPreset;
}

async function processImage(
  src: string,
  opts: ProcessOptions,
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(src);
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  // Crop
  let sx = 0, sy = 0, sw = w, sh = h;
  if (opts.cropPreset !== 'free') {
    const ratios: Record<string, [number, number]> = {
      '1:1': [1, 1], '4:3': [4, 3], '16:9': [16, 9], '3:4': [3, 4], '9:16': [9, 16],
    };
    const [rw, rh] = ratios[opts.cropPreset];
    const targetRatio = rw / rh;
    const currentRatio = w / h;
    if (currentRatio > targetRatio) {
      sw = Math.round(h * targetRatio);
      sx = Math.round((w - sw) / 2);
    } else {
      sh = Math.round(w / targetRatio);
      sy = Math.round((h - sh) / 2);
    }
    w = sw;
    h = sh;
  }

  // Resize
  if (opts.maxWidth && w > opts.maxWidth) {
    h = Math.round(h * (opts.maxWidth / w));
    w = opts.maxWidth;
  }
  if (opts.maxHeight && h > opts.maxHeight) {
    w = Math.round(w * (opts.maxHeight / h));
    h = opts.maxHeight;
  }

  // Handle rotation (swap dimensions for 90/270)
  const isRotated = opts.rotation === 90 || opts.rotation === 270;
  const canvasW = isRotated ? h : w;
  const canvasH = isRotated ? w : h;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  // Apply transforms
  ctx.save();
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.rotate((opts.rotation * Math.PI) / 180);
  if (opts.flipH) ctx.scale(-1, 1);
  if (opts.flipV) ctx.scale(1, -1);
  ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  ctx.restore();

  // Apply effect
  applyEffect(ctx, canvasW, canvasH, opts.effect);

  // Watermark
  addWatermark(ctx, canvasW, canvasH, opts.watermark, opts.watermarkOpacity);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve({ blob, width: canvasW, height: canvasH });
        else reject(new Error('Conversion failed'));
      },
      `image/${opts.format}`,
      opts.quality / 100,
    );
  });
}

// ─── PDF to Word helpers ────────────────────────────────────

let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null;

function getPdfjs() {
  if (!pdfjsReady) {
    pdfjsReady = import('pdfjs-dist').then(lib => {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      return lib;
    });
  }
  return pdfjsReady;
}

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string[]> {
  const pdfjsLib = await getPdfjs();
  const doc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round((item as { transform: number[] }).transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push('\n');
      }
      lines.push(item.str);
      lastY = y;
    }

    pageTexts.push(lines.join('').trim());
  }

  doc.destroy();
  return pageTexts;
}

async function createDocxFromPages(pageTexts: string[], title: string): Promise<Blob> {
  const children: Paragraph[] = [];

  pageTexts.forEach((text, i) => {
    if (i > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: `Page ${i + 1}`, bold: true })],
    }));

    const lines = text.split('\n');
    for (const line of lines) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line, size: 24 })],
        spacing: { after: 120 },
      }));
    }
  });

  const doc = new Document({
    title,
    sections: [{ children }],
  });

  return await Packer.toBlob(doc);
}

// ─── Component ──────────────────────────────────────────────

export default function FileConverter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [mode, setMode] = useState<ConversionMode>('convert');
  const [dragOver, setDragOver] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [results, setResults] = useState<{ name: string; url: string; size: number; width: number; height: number }[]>([]);

  // Convert options
  const [format, setFormat] = useState<ImageFormat>('jpeg');
  const [quality, setQuality] = useState(85);

  // Resize options
  const [maxWidth, setMaxWidth] = useState('');
  const [maxHeight, setMaxHeight] = useState('');
  const [keepRatio, setKeepRatio] = useState(true);
  const [cropPreset, setCropPreset] = useState<CropPreset>('free');

  // Effects options
  const [effect, setEffect] = useState<ImageEffect>('none');
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [watermark, setWatermark] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.15);

  // PDF options
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pdfMargin, setPdfMargin] = useState(10);
  const [pdfFit, setPdfFit] = useState<'fit' | 'fill' | 'stretch'>('fit');

  // PDF to Word
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<{ name: string; size: number; buffer: ArrayBuffer } | null>(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);

  // ─── File handling ──────────

  const addFiles = useCallback(async (fileList: FileList) => {
    const imageFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    const items: FileItem[] = [];
    for (const file of imageFiles) {
      const preview = await readFileAsDataURL(file);
      const img = await loadImage(preview);
      items.push({ id: uid(), file, preview, width: img.naturalWidth, height: img.naturalHeight });
    }
    setFiles(prev => [...prev, ...items]);
    setResults([]);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  }, [addFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setResults([]);
  }, []);

  const clearAll = useCallback(() => { setFiles([]); setResults([]); }, []);

  // ─── Process ──────────

  const processAll = useCallback(async () => {
    if (files.length === 0) return;
    setIsConverting(true);
    setResults([]);

    try {
      const opts: ProcessOptions = {
        format,
        quality,
        maxWidth: (mode === 'resize' && maxWidth) ? parseInt(maxWidth) : undefined,
        maxHeight: (mode === 'resize' && maxHeight) ? parseInt(maxHeight) : undefined,
        rotation: mode === 'effects' ? rotation : 0,
        flipH: mode === 'effects' ? flipH : false,
        flipV: mode === 'effects' ? flipV : false,
        effect: mode === 'effects' ? effect : 'none',
        watermark: mode === 'effects' ? watermark : '',
        watermarkOpacity,
        cropPreset: mode === 'resize' ? cropPreset : 'free',
      };

      const newResults = [];
      for (const item of files) {
        const { blob, width, height } = await processImage(item.preview, opts);
        const ext = format === 'jpeg' ? 'jpg' : format;
        const baseName = item.file.name.replace(/\.[^.]+$/, '');
        const suffix = mode === 'resize' ? '_resized' : mode === 'effects' ? `_${effect}` : '';
        newResults.push({
          name: `${baseName}${suffix}.${ext}`,
          url: URL.createObjectURL(blob),
          size: blob.size,
          width,
          height,
        });
      }
      setResults(newResults);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la conversion');
    } finally {
      setIsConverting(false);
    }
  }, [files, format, quality, maxWidth, maxHeight, mode, rotation, flipH, flipV, effect, watermark, watermarkOpacity, cropPreset]);

  // ─── PDF ──────────

  const createPdf = useCallback(async () => {
    if (files.length === 0) return;
    setIsConverting(true);
    setResults([]);

    try {
      const pdf = new jsPDF({ orientation: pdfOrientation, unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = pdfMargin;
      const contentW = pageW - margin * 2;
      const contentH = pageH - margin * 2;

      for (let i = 0; i < files.length; i++) {
        if (i > 0) pdf.addPage();

        const img = await loadImage(files[i].preview);
        let w: number, h: number, x: number, y: number;

        if (pdfFit === 'stretch') {
          w = contentW;
          h = contentH;
          x = margin;
          y = margin;
        } else if (pdfFit === 'fill') {
          const ratio = Math.max(contentW / img.naturalWidth, contentH / img.naturalHeight);
          w = img.naturalWidth * ratio;
          h = img.naturalHeight * ratio;
          x = margin + (contentW - w) / 2;
          y = margin + (contentH - h) / 2;
        } else {
          const ratio = Math.min(contentW / img.naturalWidth, contentH / img.naturalHeight);
          w = img.naturalWidth * ratio;
          h = img.naturalHeight * ratio;
          x = margin + (contentW - w) / 2;
          y = margin + (contentH - h) / 2;
        }

        pdf.addImage(files[i].preview, 'JPEG', x, y, w, h);
      }

      const blob = pdf.output('blob');
      setResults([{
        name: `images_${files.length}p.pdf`,
        url: URL.createObjectURL(blob),
        size: blob.size,
        width: 0,
        height: 0,
      }]);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la creation du PDF');
    } finally {
      setIsConverting(false);
    }
  }, [files, pdfOrientation, pdfMargin, pdfFit]);

  // ─── PDF to Word ──────────

  const loadPdfFile = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    setPdfFile({ name: file.name, size: file.size, buffer });
    setResults([]);
  }, []);

  const handlePdfInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') loadPdfFile(file);
    e.target.value = '';
  }, [loadPdfFile]);

  const handlePdfDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setPdfDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') loadPdfFile(file);
  }, [loadPdfFile]);

  const convertPdfToWord = useCallback(async () => {
    if (!pdfFile) return;
    setIsConverting(true);
    setResults([]);

    try {
      const pageTexts = await extractTextFromPdf(pdfFile.buffer);
      const baseName = pdfFile.name.replace(/\.pdf$/i, '');
      const blob = await createDocxFromPages(pageTexts, baseName);

      setResults([{
        name: `${baseName}.docx`,
        url: URL.createObjectURL(blob),
        size: blob.size,
        width: 0,
        height: 0,
      }]);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la conversion en Word');
    } finally {
      setIsConverting(false);
    }
  }, [pdfFile]);

  // ─── Download ──────────

  const download = useCallback((url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  }, []);

  const downloadAll = useCallback(() => {
    for (const r of results) download(r.url, r.name);
  }, [results, download]);

  // ─── Action label ──────────

  const actionLabel = () => {
    const n = files.length;
    const s = n > 1 ? 's' : '';
    if (mode === 'pdf') return `Assembler en PDF (${n} image${s})`;
    if (mode === 'resize') return `Redimensionner (${n} image${s})`;
    if (mode === 'effects') return `Appliquer (${n} image${s})`;
    return `Convertir en ${format === 'jpeg' ? 'JPG' : format.toUpperCase()} (${n})`;
  };

  // ─── Render ──────────

  return (
    <div style={styles.container}>
      {/* Mode selector */}
      <div style={styles.modeBar}>
        {([
          ['convert', 'Convertir'],
          ['resize', 'Redimensionner'],
          ['effects', 'Effets'],
          ['pdf', 'Images \u2192 PDF'],
          ['pdfToWord', 'PDF \u2192 Word'],
        ] as [ConversionMode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => { setMode(m); setResults([]); }}
            style={{ ...styles.modeBtn, ...(mode === m ? styles.modeBtnActive : {}) }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      {mode === 'pdfToWord' ? (
        <>
          <div
            onDragOver={e => { e.preventDefault(); setPdfDragOver(true); }}
            onDragLeave={() => setPdfDragOver(false)}
            onDrop={handlePdfDrop}
            onClick={() => pdfInputRef.current?.click()}
            style={{
              ...styles.dropZone,
              borderColor: pdfDragOver ? '#3B82F6' : '#D1D5DB',
              backgroundColor: pdfDragOver ? '#EFF6FF' : '#FAFAFA',
            }}
          >
            <div style={{ fontSize: 32, color: '#9CA3AF' }}>+</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
              Glisser un fichier PDF ici ou cliquer pour parcourir
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>PDF uniquement</div>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={handlePdfInput}
            />
          </div>

          {pdfFile && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{pdfFile.name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{formatBytes(pdfFile.size)}</div>
                </div>
                <button onClick={() => { setPdfFile(null); setResults([]); }} style={styles.clearBtn}>Retirer</button>
              </div>

              <button
                onClick={convertPdfToWord}
                disabled={isConverting}
                style={{ ...styles.actionBtn, opacity: isConverting ? 0.6 : 1 }}
              >
                {isConverting ? 'Conversion en cours...' : 'Convertir en Word (.docx)'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            ...styles.dropZone,
            borderColor: dragOver ? '#3B82F6' : '#D1D5DB',
            backgroundColor: dragOver ? '#EFF6FF' : '#FAFAFA',
          }}
        >
          <div style={{ fontSize: 32, color: '#9CA3AF' }}>+</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
            Glisser des images ici ou cliquer pour parcourir
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>
            PNG, JPG, WebP, GIF, SVG, BMP
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* File list */}
      {files.length > 0 && mode !== 'pdfToWord' && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionLabel}>
              {files.length} image{files.length > 1 ? 's' : ''}
            </span>
            <button onClick={clearAll} style={styles.clearBtn}>Tout retirer</button>
          </div>
          <div style={styles.list}>
            {files.map(item => (
              <div key={item.id} style={styles.fileCard}>
                <img src={item.preview} alt="" style={styles.fileThumb} />
                <div style={styles.fileInfo}>
                  <div style={styles.fileName}>{item.file.name}</div>
                  <div style={styles.fileMeta}>
                    {item.width}x{item.height} · {formatBytes(item.file.size)}
                  </div>
                </div>
                <button onClick={() => removeFile(item.id)} style={styles.removeBtn}>x</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Options */}
      {files.length > 0 && mode !== 'pdfToWord' && (
        <div style={styles.section}>
          {/* Format + Quality (all modes except pdf) */}
          {mode !== 'pdf' && (
            <>
              <div style={styles.optRow}>
                <label style={styles.optLabel}>Format de sortie</label>
                <div style={styles.btnRow}>
                  {(['png', 'jpeg', 'webp'] as ImageFormat[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      style={{ ...styles.toggleBtn, ...(format === f ? styles.toggleBtnActive : {}) }}
                    >
                      {f === 'jpeg' ? 'JPG' : f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {format !== 'png' && (
                <div style={styles.optRow}>
                  <label style={styles.optLabel}>
                    Qualite : {quality}%
                    <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: 8 }}>
                      {quality >= 90 ? '(haute)' : quality >= 60 ? '(moyenne)' : '(basse)'}
                    </span>
                  </label>
                  <input
                    type="range" min={10} max={100} step={5}
                    value={quality} onChange={e => setQuality(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </>
          )}

          {/* Resize options */}
          {mode === 'resize' && (
            <>
              <div style={styles.optRow}>
                <label style={styles.optLabel}>Recadrage</label>
                <div style={styles.btnRow}>
                  {(['free', '1:1', '4:3', '16:9', '3:4', '9:16'] as CropPreset[]).map(c => (
                    <button
                      key={c}
                      onClick={() => setCropPreset(c)}
                      style={{ ...styles.toggleBtn, ...(cropPreset === c ? styles.toggleBtnActive : {}), padding: '5px 8px' }}
                    >
                      {c === 'free' ? 'Libre' : c}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.optRow}>
                <label style={styles.optLabel}>Dimensions max (px)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    style={styles.input} type="number" placeholder="Largeur"
                    value={maxWidth}
                    onChange={e => {
                      setMaxWidth(e.target.value);
                      if (keepRatio && files[0] && e.target.value) {
                        setMaxHeight(String(Math.round(Number(e.target.value) * files[0].height / files[0].width)));
                      }
                    }}
                  />
                  <span style={{ color: '#9CA3AF', fontSize: 13 }}>x</span>
                  <input
                    style={styles.input} type="number" placeholder="Hauteur"
                    value={maxHeight}
                    onChange={e => {
                      setMaxHeight(e.target.value);
                      if (keepRatio && files[0] && e.target.value) {
                        setMaxWidth(String(Math.round(Number(e.target.value) * files[0].width / files[0].height)));
                      }
                    }}
                  />
                </div>
                <label style={styles.checkLabel}>
                  <input type="checkbox" checked={keepRatio} onChange={e => setKeepRatio(e.target.checked)} />
                  Garder les proportions
                </label>
                {files[0] && (
                  <div style={styles.btnRow}>
                    {[
                      { label: '50%', w: Math.round(files[0].width / 2), h: Math.round(files[0].height / 2) },
                      { label: '25%', w: Math.round(files[0].width / 4), h: Math.round(files[0].height / 4) },
                      { label: '800px', w: 800, h: Math.round(800 * files[0].height / files[0].width) },
                      { label: '1920px', w: 1920, h: Math.round(1920 * files[0].height / files[0].width) },
                    ].map(p => (
                      <button
                        key={p.label}
                        style={{ ...styles.toggleBtn, padding: '4px 8px', fontSize: 11 }}
                        onClick={() => { setMaxWidth(String(p.w)); setMaxHeight(String(p.h)); }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Effects options */}
          {mode === 'effects' && (
            <>
              <div style={styles.optRow}>
                <label style={styles.optLabel}>Filtre</label>
                <div style={styles.btnRow}>
                  {([
                    ['none', 'Aucun'],
                    ['grayscale', 'Noir & Blanc'],
                    ['sepia', 'Sepia'],
                    ['invert', 'Inverser'],
                    ['sharpen', 'Contraste+'],
                    ['blur', 'Flou'],
                  ] as [ImageEffect, string][]).map(([e, label]) => (
                    <button
                      key={e}
                      onClick={() => setEffect(e)}
                      style={{ ...styles.toggleBtn, ...(effect === e ? styles.toggleBtnActive : {}), padding: '5px 8px' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.optRow}>
                <label style={styles.optLabel}>Rotation</label>
                <div style={styles.btnRow}>
                  {[0, 90, 180, 270].map(r => (
                    <button
                      key={r}
                      onClick={() => setRotation(r)}
                      style={{ ...styles.toggleBtn, ...(rotation === r ? styles.toggleBtnActive : {}) }}
                    >
                      {r === 0 ? 'Normal' : `${r}°`}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.optRow}>
                <label style={styles.optLabel}>Miroir</label>
                <div style={styles.btnRow}>
                  <button
                    onClick={() => setFlipH(!flipH)}
                    style={{ ...styles.toggleBtn, ...(flipH ? styles.toggleBtnActive : {}) }}
                  >Horizontal</button>
                  <button
                    onClick={() => setFlipV(!flipV)}
                    style={{ ...styles.toggleBtn, ...(flipV ? styles.toggleBtnActive : {}) }}
                  >Vertical</button>
                </div>
              </div>

              <div style={styles.optRow}>
                <label style={styles.optLabel}>Filigrane (watermark)</label>
                <input
                  style={{ ...styles.input, width: '100%' }}
                  value={watermark}
                  onChange={e => setWatermark(e.target.value)}
                  placeholder="Ex: BROUILLON, NE PAS DIFFUSER..."
                />
                {watermark && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <label style={{ fontSize: 11, color: '#6B7280' }}>Opacite: {Math.round(watermarkOpacity * 100)}%</label>
                    <input
                      type="range" min={0.05} max={0.5} step={0.05}
                      value={watermarkOpacity}
                      onChange={e => setWatermarkOpacity(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* PDF options */}
          {mode === 'pdf' && (
            <>
              <div style={styles.optRow}>
                <label style={styles.optLabel}>Orientation</label>
                <div style={styles.btnRow}>
                  <button
                    onClick={() => setPdfOrientation('portrait')}
                    style={{ ...styles.toggleBtn, ...(pdfOrientation === 'portrait' ? styles.toggleBtnActive : {}) }}
                  >Portrait</button>
                  <button
                    onClick={() => setPdfOrientation('landscape')}
                    style={{ ...styles.toggleBtn, ...(pdfOrientation === 'landscape' ? styles.toggleBtnActive : {}) }}
                  >Paysage</button>
                </div>
              </div>
              <div style={styles.optRow}>
                <label style={styles.optLabel}>Ajustement</label>
                <div style={styles.btnRow}>
                  {([
                    ['fit', 'Ajuster (contenir)'],
                    ['fill', 'Remplir (rogner)'],
                    ['stretch', 'Etirer'],
                  ] as [typeof pdfFit, string][]).map(([f, label]) => (
                    <button
                      key={f}
                      onClick={() => setPdfFit(f)}
                      style={{ ...styles.toggleBtn, ...(pdfFit === f ? styles.toggleBtnActive : {}), padding: '5px 8px' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.optRow}>
                <label style={styles.optLabel}>Marge : {pdfMargin} mm</label>
                <input
                  type="range" min={0} max={30} step={1}
                  value={pdfMargin} onChange={e => setPdfMargin(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}

          {/* Action button */}
          <button
            onClick={mode === 'pdf' ? createPdf : processAll}
            disabled={isConverting}
            style={{ ...styles.actionBtn, opacity: isConverting ? 0.6 : 1 }}
          >
            {isConverting ? 'Conversion en cours...' : actionLabel()}
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div style={styles.resultsSection}>
          <div style={styles.sectionHeader}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#065F46' }}>
              Conversion terminee !
            </span>
            {results.length > 1 && (
              <button onClick={downloadAll} style={styles.downloadAllBtn}>Tout telecharger</button>
            )}
          </div>
          <div style={styles.list}>
            {results.map((r, i) => {
              const original = files[i];
              const saved = original ? original.file.size - r.size : 0;
              return (
                <div key={i} style={{ ...styles.fileCard, borderColor: '#A7F3D0' }}>
                  {r.width > 0 ? (
                    <img src={r.url} alt="" style={styles.fileThumb} />
                  ) : (
                    <div style={{
                      ...styles.fileThumb, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: r.name.endsWith('.docx') ? 11 : 20, fontWeight: 700,
                      backgroundColor: r.name.endsWith('.docx') ? '#DBEAFE' : '#FEE2E2',
                      color: r.name.endsWith('.docx') ? '#2563EB' : '#DC2626',
                    }}>
                      {r.name.endsWith('.docx') ? 'DOCX' : 'PDF'}
                    </div>
                  )}
                  <div style={styles.fileInfo}>
                    <div style={styles.fileName}>{r.name}</div>
                    <div style={styles.fileMeta}>
                      {r.width > 0 ? `${r.width}x${r.height} · ` : ''}{formatBytes(r.size)}
                      {saved > 0 && (
                        <span style={{ color: '#10B981', fontWeight: 600, marginLeft: 6 }}>
                          -{Math.round((saved / (original?.file.size || 1)) * 100)}%
                        </span>
                      )}
                      {saved < 0 && (
                        <span style={{ color: '#F59E0B', fontWeight: 600, marginLeft: 6 }}>
                          +{Math.round((Math.abs(saved) / (original?.file.size || 1)) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => download(r.url, r.name)} style={styles.dlBtn}>
                    Telecharger
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 },
  modeBar: { display: 'flex', gap: 4, padding: 4, backgroundColor: '#F3F4F6', borderRadius: 8 },
  modeBtn: {
    flex: 1, padding: '8px 4px', borderRadius: 6, border: 'none',
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    backgroundColor: 'transparent', color: '#6B7280', transition: 'all 0.15s',
  },
  modeBtnActive: { backgroundColor: '#FFF', color: '#111', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  dropZone: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 28, border: '2px dashed #D1D5DB', borderRadius: 12,
    cursor: 'pointer', transition: 'all 0.15s',
  },
  section: {
    padding: 14, backgroundColor: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB',
    display: 'flex', flexDirection: 'column' as const, gap: 12,
  },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: 13, fontWeight: 700, color: '#374151' },
  list: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  fileCard: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 8,
    backgroundColor: '#FFF', borderRadius: 8, border: '1px solid #E5E7EB',
  },
  fileThumb: {
    width: 48, height: 48, objectFit: 'cover' as const, borderRadius: 6, flexShrink: 0,
    backgroundColor: '#F3F4F6',
  },
  fileInfo: { flex: 1, minWidth: 0 },
  fileName: { fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  fileMeta: { fontSize: 10, color: '#9CA3AF' },
  removeBtn: {
    width: 24, height: 24, borderRadius: 12, border: 'none',
    backgroundColor: '#FEE2E2', color: '#DC2626', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  clearBtn: {
    padding: '4px 10px', borderRadius: 6, border: '1px solid #D1D5DB',
    backgroundColor: '#FFF', fontSize: 11, color: '#6B7280', cursor: 'pointer',
  },
  optRow: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  optLabel: { fontSize: 12, fontWeight: 600, color: '#374151' },
  btnRow: { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  input: {
    padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB',
    fontSize: 13, width: 100, boxSizing: 'border-box' as const,
  },
  toggleBtn: {
    padding: '5px 14px', borderRadius: 6, border: '1px solid #D1D5DB',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, backgroundColor: '#FFF',
    transition: 'all 0.1s',
  },
  toggleBtnActive: { backgroundColor: '#3B82F6', color: '#FFF', borderColor: '#3B82F6' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' },
  actionBtn: {
    padding: '12px 0', borderRadius: 8, border: 'none',
    backgroundColor: '#3B82F6', color: '#FFF', fontSize: 14,
    fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.15s',
  },
  resultsSection: {
    padding: 14, backgroundColor: '#F0FDF4', borderRadius: 8, border: '1px solid #A7F3D0',
    display: 'flex', flexDirection: 'column' as const, gap: 10,
  },
  downloadAllBtn: {
    padding: '5px 12px', borderRadius: 6, border: 'none',
    backgroundColor: '#10B981', color: '#FFF', fontSize: 12,
    fontWeight: 600, cursor: 'pointer',
  },
  dlBtn: {
    padding: '6px 12px', borderRadius: 6, border: 'none',
    backgroundColor: '#10B981', color: '#FFF', fontSize: 11,
    fontWeight: 700, cursor: 'pointer', flexShrink: 0,
  },
};
