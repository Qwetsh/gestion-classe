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
        className="w-full max-w-lg bg-[var(--surface)] p-5 space-y-3"
        style={{
          borderRadius: 'var(--radius) var(--radius) 0 0',
          boxShadow: 'var(--shadow-2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[var(--text)]">
            Remarque — {studentPseudo}
          </h3>
          <button
            onClick={onCancel}
            className="text-[var(--text-dim)] text-lg"
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
          className="w-full p-3 border border-[var(--border)] text-[var(--text)] bg-[var(--surface-3)] resize-none"
          style={{ borderRadius: 'var(--radius)', fontSize: '16px' }}
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
              style={{ borderRadius: 'var(--radius)' }}
            />
            <button
              onClick={removePhoto}
              className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--neg)] text-white rounded-full text-xs font-bold flex items-center justify-center"
              style={{ border: '2px solid var(--surface)' }}
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
            className="py-3 px-4 font-medium text-[var(--indigo)] bg-[var(--indigo-soft)] flex items-center justify-center gap-1.5"
            style={{ borderRadius: 'var(--radius)', border: 'none' }}
            title="Prendre ou choisir une photo"
          >
            <span className="text-lg">📷</span>
          </button>

          <button
            onClick={onCancel}
            className="flex-1 py-3 font-medium text-[var(--text-muted)] bg-[var(--surface-3)]"
            style={{ borderRadius: 'var(--radius)', border: 'none' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-3 font-bold text-white disabled:opacity-50"
            style={{
              background: 'var(--color-remarque)',
              borderRadius: 'var(--radius)',
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
