import { useState, useRef, useCallback, useEffect, type CSSProperties } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ─── Types ──────────────────────────────────────────────────

type TimelineStyle = 'classique' | 'moderne' | 'parchemin';

interface TimelineEvent {
  id: string;
  date: string;
  label: string;
  description: string;
  color: string;
  image?: string;
}

// Période colorée sur l'axe de la frise
interface TimelinePeriod {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
  color: string;
  description: string;
  opacity: number;
}

interface TimelineConfig {
  title: string;
  subtitle: string;
  startYear: string;
  endYear: string;
  style: TimelineStyle;
  events: TimelineEvent[];
  periods: TimelinePeriod[];
  orientation: 'horizontal' | 'vertical';
}

// ─── Style presets ──────────────────────────────────────────

const STYLE_PRESETS: Record<TimelineStyle, {
  label: string;
  bg: string;
  axisBg: string;
  axisColor: string;
  textColor: string;
  titleFont: string;
  bodyFont: string;
  cardBg: string;
  cardBorder: string;
  dotSize: number;
}> = {
  classique: {
    label: 'Classique',
    bg: '#FFFFFF',
    axisBg: '#1F2937',
    axisColor: '#F3F4F6',
    textColor: '#1F2937',
    titleFont: '"Libre Baskerville", Georgia, serif',
    bodyFont: '"Inter", Arial, sans-serif',
    cardBg: '#FFFFFF',
    cardBorder: '#E5E7EB',
    dotSize: 14,
  },
  moderne: {
    label: 'Moderne',
    bg: '#0F172A',
    axisBg: '#3B82F6',
    axisColor: '#93C5FD',
    textColor: '#F1F5F9',
    titleFont: '"Inter", Arial, sans-serif',
    bodyFont: '"Inter", Arial, sans-serif',
    cardBg: '#1E293B',
    cardBorder: '#334155',
    dotSize: 16,
  },
  parchemin: {
    label: 'Parchemin',
    bg: '#FDF6E3',
    axisBg: '#8B5E34',
    axisColor: '#D4A76A',
    textColor: '#3E2723',
    titleFont: '"Playfair Display", Georgia, serif',
    bodyFont: '"Libre Baskerville", Georgia, serif',
    cardBg: '#FAF0D7',
    cardBorder: '#D4A76A',
    dotSize: 14,
  },
};

// ─── Helpers ────────────────────────────────────────────────

const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Inter:wght@300;400;500;600;700&display=swap';
let fontsLoaded = false;
function loadFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_URL;
  document.head.appendChild(link);
}

let counter = 0;
function newId() { return `evt_${Date.now()}_${counter++}`; }

const EVENT_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

// Couleurs pastel pour les périodes
const PERIOD_COLORS = ['#93C5FD', '#FCA5A5', '#6EE7B7', '#FDE68A', '#C4B5FD', '#F9A8D4', '#67E8F9', '#FDBA74'];

function parseYear(s: string): number {
  const trimmed = s.trim().replace(/\s+/g, '');
  // Check for suffixes: Ga (billion), Ma (million), Ka (thousand)
  const match = trimmed.match(/^(-?[\d.]+)\s*(Ga|Ma|Ka)?$/i);
  if (!match) return parseInt(s) || 0;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return 0;
  const suffix = (match[2] || '').toLowerCase();
  if (suffix === 'ga') return num * 1_000_000_000;
  if (suffix === 'ma') return num * 1_000_000;
  if (suffix === 'ka') return num * 1_000;
  return num;
}

function formatAxisLabel(year: number): string {
  const abs = Math.abs(year);
  if (abs >= 1_000_000_000) return (year / 1_000_000_000).toFixed(1) + ' Ga';
  if (abs >= 1_000_000) return (year / 1_000_000).toFixed(0) + ' Ma';
  if (abs >= 10_000) return (year / 1_000).toFixed(0) + ' Ka';
  return year.toString();
}

// ─── Component ──────────────────────────────────────────────

export default function TimelineGenerator() {
  const previewRef = useRef<HTMLDivElement>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const [config, setConfig] = useState<TimelineConfig>({
    title: 'Ma frise chronologique',
    subtitle: '',
    startYear: '1789',
    endYear: '1799',
    style: 'classique',
    orientation: 'horizontal',
    events: [],
    periods: [],
  });

  const preset = STYLE_PRESETS[config.style];

  useEffect(() => { loadFonts(); }, []);

  // Auto-scale
  useEffect(() => {
    const updateScale = () => {
      if (!previewPaneRef.current || !previewRef.current) return;
      const paneW = previewPaneRef.current.clientWidth - 32;
      const paneH = previewPaneRef.current.clientHeight - 32;
      const contentW = previewRef.current.scrollWidth;
      const contentH = previewRef.current.scrollHeight;
      if (contentW === 0 || contentH === 0) return;
      const sx = paneW / contentW;
      const sy = paneH / contentH;
      setPreviewScale(Math.min(sx, sy, 1.2));
    };
    const t = setTimeout(updateScale, 150);
    window.addEventListener('resize', updateScale);
    return () => { clearTimeout(t); window.removeEventListener('resize', updateScale); };
  }, [config]);

  // ─── Config helpers ──────────

  const update = useCallback((patch: Partial<TimelineConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
  }, []);

  const addEvent = useCallback(() => {
    const evt: TimelineEvent = {
      id: newId(),
      date: '',
      label: '',
      description: '',
      color: EVENT_COLORS[config.events.length % EVENT_COLORS.length],
    };
    setConfig(prev => ({ ...prev, events: [...prev.events, evt] }));
    setTimeout(() => {
      editorRef.current?.scrollTo({ top: editorRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, [config.events.length]);

  const updateEvent = useCallback((id: string, patch: Partial<TimelineEvent>) => {
    setConfig(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === id ? { ...e, ...patch } : e),
    }));
  }, []);

  const removeEvent = useCallback((id: string) => {
    setConfig(prev => ({ ...prev, events: prev.events.filter(e => e.id !== id) }));
  }, []);

  const moveEvent = useCallback((id: string, dir: -1 | 1) => {
    setConfig(prev => {
      const idx = prev.events.findIndex(e => e.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.events.length) return prev;
      const events = [...prev.events];
      [events[idx], events[newIdx]] = [events[newIdx], events[idx]];
      return { ...prev, events };
    });
  }, []);

  // ─── Gestion des périodes ──────────

  const addPeriod = useCallback(() => {
    const period: TimelinePeriod = {
      id: newId(),
      startDate: '',
      endDate: '',
      label: '',
      color: PERIOD_COLORS[config.periods.length % PERIOD_COLORS.length],
      description: '',
      opacity: 0.5,
    };
    setConfig(prev => ({ ...prev, periods: [...prev.periods, period] }));
    setTimeout(() => {
      editorRef.current?.scrollTo({ top: editorRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, [config.periods.length]);

  const updatePeriod = useCallback((id: string, patch: Partial<TimelinePeriod>) => {
    setConfig(prev => ({
      ...prev,
      periods: prev.periods.map(p => p.id === id ? { ...p, ...patch } : p),
    }));
  }, []);

  const removePeriod = useCallback((id: string) => {
    setConfig(prev => ({ ...prev, periods: prev.periods.filter(p => p.id !== id) }));
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateEvent(uploadTargetId, { image: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setUploadTargetId(null);
  }, [uploadTargetId, updateEvent]);

  // Sort events by date for preview
  const sortedEvents = [...config.events]
    .filter(e => e.date.trim())
    .sort((a, b) => parseYear(a.date) - parseYear(b.date));

  const startY = parseYear(config.startYear);
  const endY = parseYear(config.endYear);
  const range = Math.max(endY - startY, 1);

  // ─── Export ──────────

  const exportAs = useCallback(async (format: 'png' | 'pdf') => {
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: preset.bg,
      });
      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `${config.title.replace(/\s+/g, '_')}_frise.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        const imgData = canvas.toDataURL('image/png');
        const ratio = canvas.height / canvas.width;
        const isLandscape = config.orientation === 'horizontal';
        const pdf = new jsPDF({
          orientation: isLandscape ? 'landscape' : 'portrait',
          unit: 'mm',
          format: 'a4',
        });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = isLandscape ? pdfW * ratio : pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, Math.min(pdfH, pdf.internal.pageSize.getHeight()));
        pdf.save(`${config.title.replace(/\s+/g, '_')}_frise.pdf`);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  }, [config.title, config.orientation, preset.bg]);

  // ─── Render: Editor ──────────

  const renderEditor = () => (
    <div style={editorS.container}>
      <h3 style={editorS.section}>Style</h3>
      <div style={editorS.styleGrid}>
        {(Object.entries(STYLE_PRESETS) as [TimelineStyle, typeof preset][]).map(([key, p]) => (
          <button
            key={key}
            onClick={() => update({ style: key })}
            style={{
              ...editorS.styleBtn,
              borderColor: config.style === key ? p.axisBg : '#ddd',
              backgroundColor: config.style === key ? p.bg : '#fff',
              color: config.style === key ? p.textColor : '#333',
            }}
          >{p.label}</button>
        ))}
      </div>

      <h3 style={editorS.section}>Informations</h3>
      <label style={editorS.label}>
        Titre
        <input style={editorS.input} value={config.title} onChange={e => update({ title: e.target.value })} />
      </label>
      <label style={editorS.label}>
        Sous-titre
        <input style={editorS.input} value={config.subtitle} onChange={e => update({ subtitle: e.target.value })} placeholder="Ex: Les grandes dates" />
      </label>
      <div style={editorS.row}>
        <label style={{ ...editorS.label, flex: 1 }}>
          Début
          <input style={editorS.input} value={config.startYear} onChange={e => update({ startYear: e.target.value })} placeholder="Ex: 1789" />
        </label>
        <label style={{ ...editorS.label, flex: 1 }}>
          Fin
          <input style={editorS.input} value={config.endYear} onChange={e => update({ endYear: e.target.value })} placeholder="Ex: 1799" />
        </label>
      </div>

      <div style={editorS.row}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Orientation :</span>
        <button
          style={{ ...editorS.toggleBtn, ...(config.orientation === 'horizontal' ? editorS.toggleActive : {}) }}
          onClick={() => update({ orientation: 'horizontal' })}
        >Horizontale</button>
        <button
          style={{ ...editorS.toggleBtn, ...(config.orientation === 'vertical' ? editorS.toggleActive : {}) }}
          onClick={() => update({ orientation: 'vertical' })}
        >Verticale</button>
      </div>

      <h3 style={editorS.section}>Événements ({config.events.length})</h3>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />

      <div style={editorS.eventList}>
        {config.events.map((evt, idx) => (
          <div key={evt.id} style={{ ...editorS.eventCard, borderLeft: `3px solid ${evt.color}` }}>
            <div style={editorS.eventHeader}>
              <input
                type="color"
                value={evt.color}
                onChange={e => updateEvent(evt.id, { color: e.target.value })}
                style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', padding: 0 }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', flex: 1 }}>Événement {idx + 1}</span>
              <button style={editorS.smallBtn} onClick={() => moveEvent(evt.id, -1)} disabled={idx === 0}>▲</button>
              <button style={editorS.smallBtn} onClick={() => moveEvent(evt.id, 1)} disabled={idx === config.events.length - 1}>▼</button>
              <button style={{ ...editorS.smallBtn, color: '#EF4444' }} onClick={() => removeEvent(evt.id)}>✕</button>
            </div>
            <div style={editorS.row}>
              <input style={{ ...editorS.input, width: 80 }} placeholder="Date" value={evt.date} onChange={e => updateEvent(evt.id, { date: e.target.value })} />
              <input style={{ ...editorS.input, flex: 1 }} placeholder="Titre" value={evt.label} onChange={e => updateEvent(evt.id, { label: e.target.value })} />
            </div>
            <textarea
              style={editorS.textarea}
              placeholder="Description (optionnel)"
              value={evt.description}
              onChange={e => updateEvent(evt.id, { description: e.target.value })}
              rows={2}
            />
            <div style={editorS.row}>
              <button
                style={editorS.imgBtn}
                onClick={() => { setUploadTargetId(evt.id); fileInputRef.current?.click(); }}
              >
                {evt.image ? 'Changer photo' : '+ Photo'}
              </button>
              {evt.image && (
                <>
                  <img src={evt.image} alt="" style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 4 }} />
                  <button style={{ ...editorS.smallBtn, color: '#EF4444' }} onClick={() => updateEvent(evt.id, { image: undefined })}>✕</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <button style={editorS.addBtn} onClick={addEvent}>+ Événement</button>

      <h3 style={editorS.section}>Périodes ({config.periods.length})</h3>
      <div style={editorS.eventList}>
        {config.periods.map((period, idx) => (
          <div key={period.id} style={{
            ...editorS.eventCard,
            borderLeft: `3px dashed ${period.color}`,
          }}>
            <div style={editorS.eventHeader}>
              <input
                type="color"
                value={period.color}
                onChange={e => updatePeriod(period.id, { color: e.target.value })}
                style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', padding: 0 }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', flex: 1 }}>Période {idx + 1}</span>
              <button style={{ ...editorS.smallBtn, color: '#EF4444' }} onClick={() => removePeriod(period.id)}>✕</button>
            </div>
            <div style={editorS.row}>
              <input style={{ ...editorS.input, width: 80 }} placeholder="Début" value={period.startDate} onChange={e => updatePeriod(period.id, { startDate: e.target.value })} />
              <input style={{ ...editorS.input, width: 80 }} placeholder="Fin" value={period.endDate} onChange={e => updatePeriod(period.id, { endDate: e.target.value })} />
              <input style={{ ...editorS.input, flex: 1 }} placeholder="Nom" value={period.label} onChange={e => updatePeriod(period.id, { label: e.target.value })} />
            </div>
            <textarea
              style={editorS.textarea}
              placeholder="Description (optionnel)"
              value={period.description}
              onChange={e => updatePeriod(period.id, { description: e.target.value })}
              rows={2}
            />
            <div style={{ ...editorS.row, gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap' }}>Opacité</span>
              <input
                type="range" min="0.1" max="1" step="0.05"
                value={period.opacity ?? 0.5}
                onChange={e => updatePeriod(period.id, { opacity: parseFloat(e.target.value) })}
                style={{ flex: 1, accentColor: period.color }}
              />
              <span style={{ fontSize: 11, color: '#6B7280', minWidth: 28 }}>{Math.round((period.opacity ?? 0.5) * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
      <button style={editorS.addBtn} onClick={addPeriod}>+ Période</button>

      <h3 style={editorS.section}>Exporter</h3>
      <div style={editorS.row}>
        <button style={{ ...editorS.exportBtn, backgroundColor: '#3B82F6' }} onClick={() => exportAs('png')} disabled={isExporting}>
          {isExporting ? 'Export...' : 'PNG'}
        </button>
        <button style={{ ...editorS.exportBtn, backgroundColor: '#EF4444' }} onClick={() => exportAs('pdf')} disabled={isExporting}>
          {isExporting ? 'Export...' : 'PDF'}
        </button>
      </div>
    </div>
  );

  // ─── Render: Horizontal preview ──────────

  const renderHorizontal = () => {
    const CARD_W = 160;
    const CARD_GAP = 12;
    const TIER_H = 130; // height per tier (card ~100px + spacing)
    const DOT_R = preset.dotSize / 2;
    const AXIS_PAD = 60; // left/right padding for axis

    // Compute pixel positions for all events
    const eventsWithPos = sortedEvents.map((evt, idx) => {
      const year = parseYear(evt.date);
      const frac = Math.max(0.02, Math.min(0.98, (year - startY) / range));
      return { evt, idx, frac, side: (idx % 2 === 0 ? 'top' : 'bottom') as 'top' | 'bottom', tier: 0 };
    });

    // We need a total width to compute px positions for overlap detection
    const baseW = Math.max(sortedEvents.length * (CARD_W + 20) + 120, 800);
    const axisW = baseW - AXIS_PAD * 2;

    // Assign tiers: greedy — for each event on a given side, find the lowest tier without overlap
    const placed: Array<{ px: number; side: string; tier: number }> = [];
    for (const ep of eventsWithPos) {
      const px = ep.frac * axisW;
      const sameSide = placed.filter(p => p.side === ep.side);
      let tier = 0;
      while (true) {
        const sameTier = sameSide.filter(p => p.tier === tier);
        const overlaps = sameTier.some(p => Math.abs(p.px - px) < CARD_W + CARD_GAP);
        if (!overlaps) break;
        tier++;
      }
      ep.tier = tier;
      placed.push({ px, side: ep.side, tier });
    }

    const maxTopTier = Math.max(0, ...eventsWithPos.filter(e => e.side === 'top').map(e => e.tier));
    const maxBotTier = Math.max(0, ...eventsWithPos.filter(e => e.side === 'bottom').map(e => e.tier));

    const AXIS_Y = 60 + (maxTopTier + 1) * TIER_H; // axis Y position
    const totalH = AXIS_Y + 30 + (maxBotTier + 1) * TIER_H + 20;
    const timelineW = baseW;

    return (
      <div style={{
        width: timelineW, height: totalH, padding: '20px 0',
        backgroundColor: preset.bg, fontFamily: preset.bodyFont, color: preset.textColor,
        position: 'relative',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 16, padding: '0 20px' }}>
          <h1 style={{ fontFamily: preset.titleFont, fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
            {config.title}
          </h1>
          {config.subtitle && (
            <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4, fontStyle: 'italic' }}>{config.subtitle}</div>
          )}
        </div>

        {/* Axis area */}
        <div style={{ position: 'relative', height: totalH - 80, marginTop: 10 }}>
          {/* Axe : soit un trait simple, soit des bandes de périodes entre des traits */}
          {(() => {
            const axisTopPos = AXIS_Y - 20;
            const AXIS_H = 28;
            const LABEL_H = 18;
            const hasPeriods = config.periods.some(p => p.startDate.trim() && p.endDate.trim());

            if (!hasPeriods) {
              // Axe simple (trait + graduations)
              return (
                <>
                  <div style={{
                    position: 'absolute', top: axisTopPos, left: AXIS_PAD - 10, right: AXIS_PAD - 10, height: 3,
                    backgroundColor: preset.axisBg, borderRadius: 2,
                  }} />
                  <div style={{
                    position: 'absolute', top: axisTopPos - 18, left: AXIS_PAD - 10,
                    fontSize: 11, fontWeight: 700, color: preset.axisBg,
                  }}>{formatAxisLabel(startY)}</div>
                  <div style={{
                    position: 'absolute', top: axisTopPos - 18, right: AXIS_PAD - 10,
                    fontSize: 11, fontWeight: 700, color: preset.axisBg, textAlign: 'right',
                  }}>{formatAxisLabel(endY)}</div>
                  {Array.from({ length: 6 }, (_, i) => {
                    const frac = i / 5;
                    const year = startY + frac * range;
                    return (
                      <div key={`tick-${i}`} style={{
                        position: 'absolute', left: AXIS_PAD + frac * axisW - 0.5,
                        top: axisTopPos - 4, width: 1, height: 10,
                        backgroundColor: preset.axisBg, opacity: 0.4,
                      }}>
                        <span style={{
                          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                          fontSize: 9, fontWeight: 600, color: preset.axisBg, opacity: 0.7, whiteSpace: 'nowrap',
                        }}>{formatAxisLabel(Math.round(year))}</span>
                      </div>
                    );
                  })}
                </>
              );
            }

            // Mode périodes : bandes colorées = l'axe, séparées par des traits noirs
            const periodBands = config.periods
              .filter(p => p.startDate.trim() && p.endDate.trim())
              .map(p => {
                const sY = parseYear(p.startDate);
                const eY = parseYear(p.endDate);
                const fracStart = Math.max(0, Math.min(1, (Math.min(sY, eY) - startY) / range));
                const fracEnd = Math.max(0, Math.min(1, (Math.max(sY, eY) - startY) / range));
                return { ...p, fracStart, fracEnd };
              })
              .sort((a, b) => a.fracStart - b.fracStart);

            // Assigner des tiers aux périodes qui se chevauchent (style frise géologique)
            const tieredBands = periodBands.map(pb => ({ ...pb, tier: 0 }));
            const placedPeriods: Array<{ fracStart: number; fracEnd: number; tier: number }> = [];
            for (const pb of tieredBands) {
              let t = 0;
              while (true) {
                const sameTier = placedPeriods.filter(pp => pp.tier === t);
                const overlaps = sameTier.some(pp => pb.fracStart < pp.fracEnd && pb.fracEnd > pp.fracStart);
                if (!overlaps) break;
                t++;
              }
              pb.tier = t;
              placedPeriods.push({ fracStart: pb.fracStart, fracEnd: pb.fracEnd, tier: t });
            }
            const maxTier = Math.max(0, ...tieredBands.map(pb => pb.tier));
            const ROW_H = AXIS_H + LABEL_H + 4;
            const totalAxisH = (maxTier + 1) * ROW_H;

            // Collecter toutes les frontières uniques pour les traits séparateurs
            const boundaries = new Set<number>();
            boundaries.add(0);
            boundaries.add(1);
            for (const pb of tieredBands) {
              boundaries.add(pb.fracStart);
              boundaries.add(pb.fracEnd);
            }
            const sortedBoundaries = [...boundaries].sort((a, b) => a - b);

            return (
              <>
                {/* Bandes de périodes empilées par tier */}
                {tieredBands.map(pb => {
                  const pLeft = AXIS_PAD + pb.fracStart * axisW;
                  const pWidth = (pb.fracEnd - pb.fracStart) * axisW;
                  const opacity = pb.opacity ?? 0.5;
                  const bandTop = axisTopPos - totalAxisH / 2 + pb.tier * ROW_H;
                  return (
                    <div key={pb.id} style={{ position: 'absolute', left: pLeft, top: bandTop, width: Math.max(pWidth, 2), zIndex: 0 }}>
                      {/* Bande colorée */}
                      <div style={{
                        width: '100%', height: AXIS_H,
                        backgroundColor: pb.color, opacity,
                      }} />
                      {/* Label en dessous */}
                      <div style={{
                        width: '100%', textAlign: 'center', marginTop: 2,
                        fontSize: 10, fontWeight: 700, color: pb.color,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        lineHeight: `${LABEL_H}px`,
                      }}>
                        {pb.label}
                        {pb.description && (
                          <span style={{ fontWeight: 400, fontSize: 8, opacity: 0.7, marginLeft: 4 }}>{pb.description}</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Traits noirs séparateurs aux frontières (sur toute la hauteur empilée) */}
                {sortedBoundaries.map((frac, i) => {
                  const xPos = AXIS_PAD + frac * axisW;
                  const year = startY + frac * range;
                  return (
                    <div key={`sep-${i}`} style={{ position: 'absolute', left: xPos - 1, top: axisTopPos - totalAxisH / 2 - 4, zIndex: 1 }}>
                      {/* Trait vertical */}
                      <div style={{
                        width: 2, height: totalAxisH + 8,
                        backgroundColor: preset.axisBg,
                      }} />
                      {/* Date au-dessus */}
                      <span style={{
                        position: 'absolute', bottom: totalAxisH + 12, left: '50%', transform: 'translateX(-50%)',
                        fontSize: 9, fontWeight: 700, color: preset.axisBg,
                        whiteSpace: 'nowrap',
                      }}>{formatAxisLabel(Math.round(year))}</span>
                    </div>
                  );
                })}
              </>
            );
          })()}

          {/* Events */}
          {eventsWithPos.map(({ evt, side, tier, frac }) => {
            const leftPx = AXIS_PAD + frac * axisW;
            const axisTop = AXIS_Y - 20; // axis line Y in this container
            const isTop = side === 'top';

            // Card Y position: tiers stack outward from axis
            const GAP_FROM_AXIS = 22; // space between axis and nearest card
            const cardTop = isTop
              ? axisTop - GAP_FROM_AXIS - (tier + 1) * TIER_H
              : axisTop + GAP_FROM_AXIS + tier * TIER_H;

            // Connector: always from axis to card edge
            // For top cards: from bottom of card area to axis
            // For bottom cards: from axis to top of card
            const connectorTop = isTop ? cardTop : axisTop + 2;
            const connectorH = isTop ? axisTop - cardTop : cardTop - axisTop;

            return (
              <div key={evt.id}>
                {/* Dot on axis */}
                <div style={{
                  position: 'absolute',
                  left: leftPx - DOT_R,
                  top: axisTop - DOT_R + 1,
                  width: preset.dotSize, height: preset.dotSize, borderRadius: '50%',
                  backgroundColor: evt.color, border: `3px solid ${preset.bg}`,
                  boxShadow: `0 0 0 2px ${evt.color}`,
                  zIndex: 3,
                }} />

                {/* Connector line — stretches from axis to card position */}
                <div style={{
                  position: 'absolute',
                  left: leftPx - 1,
                  top: connectorTop,
                  width: 2,
                  height: Math.max(0, connectorH),
                  backgroundColor: evt.color,
                  opacity: 0.5,
                  zIndex: 1,
                }} />

                {/* Card */}
                <div style={{
                  position: 'absolute',
                  left: leftPx - CARD_W / 2,
                  top: cardTop,
                  width: CARD_W,
                  zIndex: 2,
                }}>
                  <div style={{
                    backgroundColor: preset.cardBg,
                    border: `1px solid ${preset.cardBorder}`,
                    borderTop: `3px solid ${evt.color}`,
                    borderRadius: 8,
                    padding: 10,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: evt.color, marginBottom: 2 }}>
                      {evt.date}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, marginBottom: 3 }}>
                      {evt.label}
                    </div>
                    {evt.description && (
                      <div style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.4 }}>
                        {evt.description}
                      </div>
                    )}
                    {evt.image && (
                      <img src={evt.image} alt="" style={{
                        width: '100%', height: 80, objectFit: 'cover',
                        borderRadius: 4, marginTop: 8,
                      }} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── Render: Vertical preview ──────────

  const renderVertical = () => {
    const AXIS_X = 16; // center of the axis line
    const CONNECTOR_LEN = 30; // horizontal connector from dot to card
    const DOT_R = preset.dotSize / 2;

    return (
      <div style={{
        width: 600, minHeight: 400, padding: '40px 40px',
        backgroundColor: preset.bg, fontFamily: preset.bodyFont, color: preset.textColor,
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <h1 style={{ fontFamily: preset.titleFont, fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
            {config.title}
          </h1>
          {config.subtitle && (
            <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4, fontStyle: 'italic' }}>{config.subtitle}</div>
          )}
          <div style={{ fontSize: 12, opacity: 0.4, marginTop: 4 }}>
            {formatAxisLabel(startY)} — {formatAxisLabel(endY)}
          </div>
        </div>

        {/* Vertical timeline */}
        <div style={{ position: 'relative', paddingLeft: AXIS_X + CONNECTOR_LEN + 16 }}>
          {/* Axis line */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: AXIS_X - 1, width: 3,
            backgroundColor: preset.axisBg, borderRadius: 2,
          }} />

          {/* Start marker */}
          <div style={{
            position: 'absolute', top: -6, left: AXIS_X - 5, width: 13, height: 13,
            borderRadius: '50%', backgroundColor: preset.axisBg, zIndex: 2,
          }} />

          {/* Périodes — bandes colorées le long de l'axe vertical */}
          {(() => {
            const periodBands = config.periods
              .filter(p => p.startDate.trim() && p.endDate.trim())
              .map(p => {
                const sY = parseYear(p.startDate);
                const eY = parseYear(p.endDate);
                const fracStart = Math.max(0, Math.min(1, (sY - startY) / range));
                const fracEnd = Math.max(0, Math.min(1, (eY - startY) / range));
                return { ...p, fracStart, fracEnd, tier: 0 };
              });
            const placedPeriods: Array<{ fracStart: number; fracEnd: number; tier: number }> = [];
            for (const pb of periodBands) {
              let t = 0;
              // eslint-disable-next-line no-constant-condition
              while (true) {
                const sameTier = placedPeriods.filter(pp => pp.tier === t);
                const overlaps = sameTier.some(pp => pb.fracStart < pp.fracEnd && pb.fracEnd > pp.fracStart);
                if (!overlaps) break;
                t++;
              }
              pb.tier = t;
              placedPeriods.push({ fracStart: pb.fracStart, fracEnd: pb.fracEnd, tier: t });
            }
            const BAND_W = 22;
            const LABEL_W = 60;
            return periodBands.map(pb => {
              const opacity = pb.opacity ?? 0.5;
              const bandLeft = AXIS_X - BAND_W / 2 - pb.tier * (BAND_W + LABEL_W + 4);
              return (
                <div key={pb.id} style={{ position: 'absolute', left: bandLeft, top: `${pb.fracStart * 100}%`, height: `${Math.max((pb.fracEnd - pb.fracStart) * 100, 0.5)}%`, zIndex: 0, display: 'flex', flexDirection: 'row-reverse', alignItems: 'stretch' }}>
                  {/* Bande colorée */}
                  <div style={{
                    width: BAND_W, height: '100%', borderRadius: 4,
                    backgroundColor: pb.color, opacity,
                    border: `1.5px solid ${pb.color}`,
                  }} />
                  {/* Label à côté de la bande */}
                  <div style={{
                    width: LABEL_W, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    paddingRight: 4, textAlign: 'right',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: pb.color, lineHeight: 1.2 }}>{pb.label}</div>
                    {pb.description && (
                      <div style={{ fontSize: 8, color: pb.color, opacity: 0.7, lineHeight: 1.2 }}>{pb.description}</div>
                    )}
                  </div>
                </div>
              );
            });
          })()}

          {sortedEvents.map((evt) => (
            <div key={evt.id} style={{
              position: 'relative',
              marginBottom: 24,
            }}>
              {/* Dot on axis */}
              <div style={{
                position: 'absolute',
                left: -(CONNECTOR_LEN + 16) + AXIS_X - DOT_R + 1,
                top: 14 - DOT_R,
                width: preset.dotSize, height: preset.dotSize, borderRadius: '50%',
                backgroundColor: evt.color, border: `3px solid ${preset.bg}`,
                boxShadow: `0 0 0 2px ${evt.color}`,
                zIndex: 3,
              }} />

              {/* Horizontal connector line from dot to card */}
              <div style={{
                position: 'absolute',
                left: -(CONNECTOR_LEN + 16) + AXIS_X + DOT_R + 3,
                top: 13,
                width: CONNECTOR_LEN - DOT_R + 12,
                height: 2,
                backgroundColor: evt.color,
                opacity: 0.5,
                zIndex: 1,
              }} />

              {/* Card */}
              <div style={{
                backgroundColor: preset.cardBg,
                border: `1px solid ${preset.cardBorder}`,
                borderLeft: `3px solid ${evt.color}`,
                borderRadius: 8,
                padding: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: evt.color, marginBottom: 2 }}>
                      {evt.date}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>
                      {evt.label}
                    </div>
                    {evt.description && (
                      <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.5 }}>
                        {evt.description}
                      </div>
                    )}
                  </div>
                  {evt.image && (
                    <img src={evt.image} alt="" style={{
                      width: 100, height: 75, objectFit: 'cover', borderRadius: 6, flexShrink: 0,
                    }} />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* End marker */}
          {sortedEvents.length > 0 && (
            <div style={{
              position: 'absolute', bottom: -8, left: AXIS_X - 5, width: 13, height: 13,
              borderRadius: '50%', backgroundColor: preset.axisBg, zIndex: 2,
            }} />
          )}
        </div>
      </div>
    );
  };

  // ─── Main render ──────────

  return (
    <div style={rootS.container}>
      <div ref={editorRef} style={rootS.editor}>{renderEditor()}</div>
      <div ref={previewPaneRef} style={rootS.preview}>
        <div
          ref={previewRef}
          style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center' }}
        >
          {config.orientation === 'horizontal' ? renderHorizontal() : renderVertical()}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const rootS: Record<string, CSSProperties> = {
  container: { display: 'flex', gap: 24, height: 'calc(100vh - 200px)', minHeight: 500 },
  editor: { width: 360, minWidth: 320, flexShrink: 0, overflowY: 'auto', padding: '0 4px 20px 0' },
  preview: {
    flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    backgroundColor: '#E5E7EB', borderRadius: 8, overflow: 'auto', padding: 16, position: 'relative',
  },
};

const editorS: Record<string, CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 6 },
  section: { fontSize: 14, fontWeight: 700, margin: '14px 0 4px', color: '#374151', borderBottom: '1px solid #E5E7EB', paddingBottom: 4 },
  label: { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, fontWeight: 600, color: '#4B5563' },
  input: {
    padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  textarea: {
    padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
    resize: 'vertical', fontFamily: 'inherit',
  },
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  styleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 },
  styleBtn: {
    padding: '8px 10px', borderRadius: 6, border: '2px solid #ddd',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
  },
  toggleBtn: {
    padding: '5px 12px', borderRadius: 6, border: '1px solid #D1D5DB',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, backgroundColor: '#FFF',
  },
  toggleActive: { backgroundColor: '#3B82F6', color: '#FFF', borderColor: '#3B82F6' },
  addBtn: {
    width: '100%', padding: '8px 0', borderRadius: 6, border: '2px dashed #D1D5DB',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#6B7280', backgroundColor: '#F9FAFB',
  },
  eventList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  eventCard: {
    padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E7EB',
    backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 6,
  },
  eventHeader: { display: 'flex', alignItems: 'center', gap: 6 },
  smallBtn: {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
    color: '#9CA3AF', padding: '2px 4px', borderRadius: 4,
  },
  imgBtn: {
    padding: '4px 10px', borderRadius: 6, border: '1px dashed #D1D5DB',
    cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#6B7280', backgroundColor: '#F9FAFB',
  },
  exportBtn: {
    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#FFF',
  },
};
