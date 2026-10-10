import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Search, Trash2 } from 'lucide-react';
import {
  REWARD_EMOJI_CHOICES,
  REWARD_ICON_GROUPS,
  REWARD_ICON_MAX_BYTES,
  lucideRef,
  parseIconRef,
  searchRewardIcons,
  uploadRewardIcon,
  validateIconFile,
} from '../../lib/rewardIcons';
import { CategoryIcon } from './CategoryIcon';

/**
 * Choix de l'icône d'une catégorie de tampon : bibliothèque Lucide (recherche en français, par thème),
 * emoji, ou image importée (PNG, JPEG, WebP, SVG, GIF ≤ 512 Ko, envoyée dans le bucket public `reward-icons`).
 *
 * La valeur se compose de l'emoji de repli (`icon`, toujours renseigné) et de l'icône riche (`iconRef`,
 * `lucide:<Nom>` ou URL). Choisir une icône de bibliothèque ou une image conserve l'emoji actuel comme repli.
 */

export interface IconValue {
  icon: string;
  iconRef: string | null;
}

type Tab = 'library' | 'emoji' | 'import';

export function IconPicker({
  value, color, userId, onChange,
}: {
  value: IconValue;
  /** Couleur de la catégorie : colore l'aperçu et la sélection. */
  color: string;
  userId: string;
  onChange: (next: IconValue) => void;
}) {
  const parsed = parseIconRef(value.iconRef);
  const [tab, setTab] = useState<Tab>(parsed?.kind === 'image' ? 'import' : parsed?.kind === 'lucide' ? 'library' : 'emoji');
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchRewardIcons(query), [query]);
  const grouped = useMemo(
    () => REWARD_ICON_GROUPS.map((g) => ({ group: g, icons: results.filter((d) => d.group === g) })).filter((g) => g.icons.length > 0),
    [results],
  );

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateIconFile(file);
    if (problem) { setUploadError(problem); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadRewardIcon(userId, file);
      onChange({ icon: value.icon || '⭐', iconRef: url });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'library', label: 'Bibliothèque' },
    { id: 'emoji', label: 'Emoji' },
    { id: 'import', label: 'Importer' },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
      {/* Onglets */}
      <div className="flex border-b border-[var(--border)] bg-[var(--surface-3)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
              tab === t.id ? 'bg-[var(--surface)] text-[var(--text)] shadow-[inset_0_-2px_0_var(--indigo)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {tab === 'library' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus-within:border-[var(--indigo)]">
              <Search size={14} className="text-[var(--text-muted)] shrink-0" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher : étoile, livre, entraide…"
                className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                autoFocus
              />
            </label>
            <div className="max-h-56 overflow-y-auto pr-1 space-y-3">
              {grouped.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">Aucune icône ne correspond. Essaie un autre mot, ou l'onglet Emoji.</p>
              )}
              {grouped.map(({ group, icons }) => (
                <div key={group}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{group}</p>
                  <div className="grid grid-cols-8 gap-1.5">
                    {icons.map((d) => {
                      const selected = parsed?.kind === 'lucide' && parsed.name === d.name;
                      return (
                        <button
                          key={d.name}
                          type="button"
                          title={`${d.name} · ${d.keywords[0]}`}
                          onClick={() => onChange({ icon: value.icon || '⭐', iconRef: lucideRef(d.name) })}
                          className={`aspect-square rounded-lg flex items-center justify-center border transition-all ${
                            selected ? 'border-transparent shadow-sm' : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-3)]'
                          }`}
                          style={selected ? { backgroundColor: `${color}22`, boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
                        >
                          <d.Icon size={20} color={selected ? color : 'var(--text)'} strokeWidth={2.2} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'emoji' && (
          <div className="space-y-3">
            <div className="grid grid-cols-9 gap-1.5">
              {REWARD_EMOJI_CHOICES.map((e) => {
                const selected = !value.iconRef && value.icon === e;
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => onChange({ icon: e, iconRef: null })}
                    className="aspect-square rounded-lg flex items-center justify-center text-xl border border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-3)] transition-all"
                    style={selected ? { backgroundColor: `${color}22`, boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="shrink-0">Ou saisir un emoji :</span>
              <input
                type="text"
                value={value.iconRef ? '' : value.icon}
                onChange={(e) => onChange({ icon: e.target.value, iconRef: null })}
                placeholder="⭐"
                maxLength={4}
                className="w-16 px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-center text-lg text-[var(--text)]"
              />
            </label>
          </div>
        )}

        {tab === 'import' && (
          <div className="space-y-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              className="hidden"
              onChange={(e) => { void pickFile(e.target.files?.[0]); }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void pickFile(e.dataTransfer.files?.[0]); }}
              className="w-full rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--indigo)] hover:bg-[var(--surface-3)] transition-colors p-5 flex flex-col items-center gap-2 text-center disabled:opacity-60"
            >
              {parsed?.kind === 'image' ? (
                <img src={parsed.url} alt="" className="w-14 h-14 object-contain rounded-lg" />
              ) : (
                <ImagePlus size={28} className="text-[var(--text-muted)]" />
              )}
              <span className="text-sm font-medium text-[var(--text)]">
                {uploading ? 'Envoi en cours…' : parsed?.kind === 'image' ? 'Remplacer l’image' : 'Choisir une image'}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                PNG, JPEG, WebP, SVG ou GIF · {Math.round(REWARD_ICON_MAX_BYTES / 1024)} Ko max · idéalement carrée, fond transparent
              </span>
            </button>
            {uploadError && <p className="text-xs text-[var(--neg)]">{uploadError}</p>}
            {parsed?.kind === 'image' && (
              <button
                type="button"
                onClick={() => onChange({ icon: value.icon || '⭐', iconRef: null })}
                className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--neg)]"
              >
                <Trash2 size={12} /> Retirer l’image et revenir à l’emoji
              </button>
            )}
          </div>
        )}
      </div>

      {/* Aperçu */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-t border-[var(--border)] bg-[var(--surface-3)]">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22`, color }}>
          <CategoryIcon icon={value.icon} iconRef={value.iconRef} size={22} color={color} />
        </span>
        <div className="min-w-0 text-xs text-[var(--text-muted)] leading-snug">
          {parsed?.kind === 'lucide' && <>Icône <b className="text-[var(--text)]">{parsed.name}</b> de la bibliothèque.</>}
          {parsed?.kind === 'image' && <>Image importée.</>}
          {!parsed && <>Emoji <b className="text-[var(--text)]">{value.icon || '⭐'}</b>.</>}
          {parsed && <> Sur l’ancienne version de l’app mobile, l’emoji <b className="text-[var(--text)]">{value.icon || '⭐'}</b> s’affiche à la place.</>}
        </div>
      </div>
    </div>
  );
}
