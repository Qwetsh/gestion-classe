import { useState, useRef, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
import { DB } from './directionB';
import { MobileSheet, SheetTitle, SheetButton, SheetGhostButton } from './MobileSheet';

const MAX_LENGTH = 500;

interface RemarqueInputProps {
  studentPseudo: string;
  onSubmit: (note: string, photo?: File | null) => void;
  onCancel: () => void;
}

/** Sheet remarque Direction B : texte + photo. */
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

  const canSubmit = !!(text.trim() || photo);

  return (
    <MobileSheet onClose={onCancel}>
      <SheetTitle>Remarque — {studentPseudo}</SheetTitle>
      <p style={{ fontSize: 13, color: DB.textSecondary, margin: '0 0 12px' }}>
        Texte et/ou photo, visible dans l'historique de l'élève.
      </p>

      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Saisir la remarque…"
        rows={3}
        maxLength={MAX_LENGTH}
        className="w-full resize-none"
        style={{
          padding: 14,
          fontSize: 16,
          background: DB.background,
          color: DB.text,
          border: `1px solid ${DB.border}`,
          borderRadius: 12,
          outline: 'none',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <p className="text-right" style={{ fontSize: 11.5, color: DB.textTertiary, margin: '4px 0 12px' }}>
        {text.length}/{MAX_LENGTH}
      </p>

      {/* Photo preview */}
      {preview && (
        <div className="relative inline-block mb-3">
          <img
            src={preview}
            alt="Photo jointe"
            className="h-20 w-20 object-cover"
            style={{ borderRadius: 12 }}
          />
          <button
            onClick={removePhoto}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: DB.error, border: `2px solid ${DB.surface}` }}
          >
            <X size={12} color="#fff" strokeWidth={3} />
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
          className="flex items-center justify-center active:scale-[0.97] transition-transform"
          style={{
            width: 52,
            borderRadius: 12,
            border: `1px solid ${DB.border}`,
            background: DB.surface,
          }}
          title="Prendre ou choisir une photo"
        >
          <Camera size={19} color={DB.textSecondary} strokeWidth={1.8} />
        </button>

        <SheetGhostButton onClick={onCancel}>Annuler</SheetGhostButton>
        <SheetButton onClick={handleSubmit} disabled={!canSubmit}>
          Enregistrer
        </SheetButton>
      </div>
    </MobileSheet>
  );
}
