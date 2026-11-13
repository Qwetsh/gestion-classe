/** Petite fenêtre « nommer » de l'éditeur de cours (version, copie, modèle). */
import { useEffect, useState } from 'react';

interface Props {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  hint?: string;
  confirmLabel: string;
  /** Nom facultatif (version) ; sinon le bouton reste grisé tant que le champ est vide. */
  optional?: boolean;
  onConfirm: (name: string) => void | Promise<void>;
  onClose: () => void;
}

export function CourseNameDialog({ title, label, initial = '', placeholder, hint, confirmLabel, optional, onConfirm, onClose }: Props) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!optional && !name.trim()) return;
    setBusy(true);
    try { await onConfirm(name.trim()); }
    finally { setBusy(false); }
  };

  return (
    <div className="ce-modal" onMouseDown={onClose}>
      <form className="ce-dialog" onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <h3 className="ce-dialog__title">{title}</h3>
        <label className="ce-field">
          <span>{label}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} autoFocus onFocus={(e) => e.target.select()} />
        </label>
        {hint && <p className="ce-dialog__hint">{hint}</p>}
        <div className="ce-dialog__foot">
          <span className="ce-spacer-flex" />
          <button type="button" className="ce-btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="ce-btn ce-btn--primary" disabled={busy || (!optional && !name.trim())}>{busy ? '…' : confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}
