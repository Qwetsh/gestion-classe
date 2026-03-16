import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Announcement {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success';
}

const typeStyles = {
  info: { bg: 'var(--color-primary-soft)', color: 'var(--color-primary)', icon: 'ℹ️' },
  warning: { bg: '#fef3c7', color: '#d97706', icon: '⚠️' },
  success: { bg: 'var(--color-success-soft)', color: 'var(--color-success)', icon: '✅' },
};

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
    <div className="space-y-0">
      {visible.map(a => {
        const style = typeStyles[a.type];
        return (
          <div
            key={a.id}
            className="flex items-center justify-between px-4 py-2.5 text-sm font-medium"
            style={{ background: style.bg, color: style.color }}
          >
            <span>{style.icon} {a.message}</span>
            <button
              onClick={() => setDismissed(prev => new Set(prev).add(a.id))}
              className="ml-4 hover:opacity-70 transition-opacity"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
