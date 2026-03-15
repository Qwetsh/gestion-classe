import { useState, useRef, useEffect } from 'react';

interface RemarqueInputProps {
  studentPseudo: string;
  onSubmit: (note: string, photo?: File | null) => void;
  onCancel: () => void;
}

export function RemarqueInput({ studentPseudo, onSubmit, onCancel }: RemarqueInputProps) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (trimmed || photo) onSubmit(trimmed || '(photo)', photo);
  };

  const canSubmit = text.trim() || photo;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg bg-[var(--color-surface)] p-5 space-y-3"
        style={{
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[var(--color-text)]">
            Remarque — {studentPseudo}
          </h3>
          <button
            onClick={onCancel}
            className="text-[var(--color-text-tertiary)] text-lg"
          >
            ✕
          </button>
        </div>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Saisir la remarque..."
          rows={3}
          className="w-full p-3 border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface-secondary)] resize-none"
          style={{ borderRadius: 'var(--radius-lg)', fontSize: '16px' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        {/* Photo preview */}
        {preview && (
          <div className="relative inline-block">
            <img
              src={preview}
              alt="Photo jointe"
              className="h-20 w-20 object-cover"
              style={{ borderRadius: 'var(--radius-lg)' }}
            />
            <button
              onClick={removePhoto}
              className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--color-error)] text-white rounded-full text-xs font-bold flex items-center justify-center"
              style={{ border: '2px solid var(--color-surface)' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex gap-3">
          {/* Photo button */}
          <button
            onClick={() => fileRef.current?.click()}
            className="py-3 px-4 font-medium text-[var(--color-primary)] bg-[var(--color-primary-soft)] flex items-center justify-center gap-1.5"
            style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}
            title="Prendre ou choisir une photo"
          >
            <span className="text-lg">📷</span>
          </button>

          <button
            onClick={onCancel}
            className="flex-1 py-3 font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)]"
            style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-3 font-bold text-white disabled:opacity-50"
            style={{
              background: 'var(--color-remarque)',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
