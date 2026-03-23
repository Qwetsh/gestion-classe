import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface Announcement {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success';
}

const typeStyles = {
  info: { bg: 'var(--color-primary)', icon: 'ℹ️' },
  warning: { bg: '#d97706', icon: '⚠️' },
  success: { bg: 'var(--color-success,#2E7D32)', icon: '✅' },
};

const AUTO_DISMISS_MS = 5000;
const SWIPE_THRESHOLD = 80;

function AnnouncementToast({ announcement, onDismiss }: { announcement: Announcement; onDismiss: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(onDismiss, 300);
  }, [onDismiss, isExiting]);

  // Auto-dismiss after 5s
  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));

    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [dismiss]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
    // Pause auto-dismiss while dragging
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - startXRef.current;
    setTranslateX(dx);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (Math.abs(translateX) > SWIPE_THRESHOLD) {
      // Swipe far enough — dismiss with swipe direction
      setTranslateX(translateX > 0 ? 400 : -400);
      setTimeout(onDismiss, 200);
    } else {
      // Snap back
      setTranslateX(0);
      // Resume auto-dismiss
      timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    }
  };

  // Mouse handlers for swipe (desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    setIsDragging(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startXRef.current;
    setTranslateX(dx);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(translateX) > SWIPE_THRESHOLD) {
      setTranslateX(translateX > 0 ? 400 : -400);
      setTimeout(onDismiss, 200);
    } else {
      setTranslateX(0);
      timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleMouseUp();
    }
  };

  const style = typeStyles[announcement.type];
  const opacity = isDragging ? Math.max(0, 1 - Math.abs(translateX) / 300) : undefined;

  return (
    <div
      ref={elRef}
      className="select-none cursor-grab active:cursor-grabbing"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `translateX(${translateX}px) translateY(${isVisible && !isExiting ? '0' : '-20px'})`,
        opacity: opacity ?? (isVisible && !isExiting ? 1 : 0),
        transition: isDragging ? 'none' : 'all 0.3s ease',
      }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3.5 text-white text-sm font-medium shadow-lg"
        style={{
          background: style.bg,
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <span className="text-lg shrink-0">{style.icon}</span>
        <span className="flex-1">{announcement.message}</span>
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-xs"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from('announcements')
      .select('id, message, type')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setAnnouncements(data);
      });
  }, []);

  const visible = announcements.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 space-y-2">
      {visible.map(a => (
        <AnnouncementToast
          key={a.id}
          announcement={a}
          onDismiss={() => setDismissed(prev => new Set(prev).add(a.id))}
        />
      ))}
    </div>
  );
}
