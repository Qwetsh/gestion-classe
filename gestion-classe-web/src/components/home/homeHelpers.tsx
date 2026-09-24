/**
 * Helpers partagés par les modules de l'accueil.
 * Extraits de l'ancien Dashboard.tsx (lot 0 de PLAN_accueil_modulaire.md).
 */

export const COLOR_PALETTE = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444','#14B8A6','#F97316','#06B6D4','#84CC16','#E879F9','#FB923C'];

export function getClassLabel(name: string): string {
  return name.replace(/ème groupe /i, 'G').replace(/ème /i, '').substring(0, 3);
}

export function getClassColor(className: string, allClassNames: string[]): string {
  const idx = allClassNames.indexOf(className);
  return COLOR_PALETTE[(idx >= 0 ? idx : 0) % COLOR_PALETTE.length];
}

/** Initiales d'un pseudo RGPD (« Laetitia DA. » -> « LD ») */
export function getInitials(pseudo: string): string {
  return pseudo
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

// ---- Temps ----

export function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'matin';
  if (h < 14) return 'midi';
  if (h < 18) return 'après-midi';
  return 'fin de journée';
}

export function formatDayFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const formatTime = (d: Date) =>
  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ---- Icones lineaires ----

export function QuickIcon({ name, size = 17 }: { name: string; size?: number }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'group': return <svg {...common}><circle cx="8" cy="9" r="2.8"/><circle cx="16.5" cy="9" r="2.3"/><path d="M3 19c.4-3 2.6-5 5-5s4.6 2 5 5M14.5 16c.6-1.3 1.9-2 3-2 1.8 0 3.2 1.4 3.5 3"/></svg>;
    case 'pen': return <svg {...common}><path d="M4 20l1-4.5L16.2 4.3a2 2 0 012.8 0l.7.7a2 2 0 010 2.8L8.5 19 4 20z"/></svg>;
    case 'wrench': return <svg {...common}><path d="M15.5 3.5a5 5 0 00-6.1 6.4l-6 6a2 2 0 102.8 2.8l6-6a5 5 0 006.4-6.1l-3 3-2.8-.3-.3-2.8 3-3z"/></svg>;
    case 'students': return <svg {...common}><circle cx="9" cy="8" r="3.5"/><path d="M2 21c.5-3.5 3.5-6 7-6s6.5 2.5 7 6"/><circle cx="17" cy="7" r="2.5"/><path d="M15 15c3-.5 6 1.5 7 5"/></svg>;
    case 'grid': return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/></svg>;
    case 'calendar': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case 'star': return <svg {...common}><path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85L12 3.5z"/></svg>;
    case 'chart': return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-6M22 19H2"/></svg>;
    case 'alert': return <svg {...common}><path d="M12 4l9 16H3l9-16z"/><path d="M12 10v4M12 17h.01"/></svg>;
    default: return null;
  }
}
