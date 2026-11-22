import { useState } from 'react';
import { Modal } from '../Modal';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import {
  copyJournalEntry, deleteJournalEntry, journalWhen, normalizeJournalText, saveJournalEntry, setJournalCopied,
  type JournalEntry, type JournalLesson,
} from '../../lib/timetable/lessonJournalQueries';

const SOURCE_LABEL: Record<JournalEntry['source'], string> = {
  claude: 'préparée par Claude',
  manual: 'écrite dans l’application',
  import: 'reprise des fichiers',
};

/**
 * Fenêtre d'une entrée de cahier de texte : lire, retoucher, copier pour Pronote, supprimer.
 * `onChange` reçoit l'entrée enregistrée (ou null si elle a été supprimée). Le brouillon part de
 * l'entrée reçue à l'ouverture : la fenêtre se monte une fois par cours.
 */
export function JournalEntryDialog({
  userId, lesson, title, entry, onChange, onClose,
}: {
  userId: string;
  lesson: JournalLesson;
  /** Classe du cours (« 4B », « 4B · groupe 1 ») */
  title: string;
  entry: JournalEntry | null;
  onChange: (entry: JournalEntry | null) => void;
  onClose: () => void;
}) {
  const { toast, confirm } = useUIFeedback();
  const [draft, setDraft] = useState(entry?.content ?? '');
  const [busy, setBusy] = useState(false);

  const dirty = normalizeJournalText(draft) !== (entry?.content ?? '');
  const empty = !normalizeJournalText(draft);

  const save = async (): Promise<JournalEntry | null> => {
    const saved = await saveJournalEntry(userId, lesson, draft, entry);
    onChange(saved);
    setDraft(saved.content);
    return saved;
  };

  const run = async (fn: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      toast(failure);
    } finally {
      setBusy(false);
    }
  };

  const onSave = () => run(async () => {
    await save();
    toast('Entrée enregistrée.', 'success');
  }, 'Impossible d’enregistrer l’entrée.');

  const onCopy = () => run(async () => {
    const saved = dirty || !entry ? await save() : entry;
    if (!saved) return;
    onChange(await copyJournalEntry(saved));
    toast('Entrée copiée : à coller dans Pronote.', 'success');
  }, 'Impossible de copier l’entrée.');

  const onToggleCopied = () => entry && run(async () => {
    onChange(await setJournalCopied(entry, !entry.copiedAt));
  }, 'Impossible de mettre à jour l’entrée.');

  const onDelete = async () => {
    if (!entry) return;
    const ok = await confirm({
      title: 'Supprimer cette entrée ?',
      message: 'Le texte de cahier de texte de ce cours sera supprimé de l’application (pas de Pronote).',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    await run(async () => {
      await deleteJournalEntry(entry.id);
      onChange(null);
      onClose();
    }, 'Impossible de supprimer l’entrée.');
  };

  const close = async () => {
    if (dirty && !empty) {
      const ok = await confirm({
        title: 'Abandonner les modifications ?',
        message: 'Le texte modifié n’est pas enregistré.',
        confirmLabel: 'Abandonner',
        variant: 'danger',
      });
      if (!ok) return;
    }
    onClose();
  };

  const when = journalWhen(lesson.start);

  return (
    <Modal
      isOpen
      onClose={close}
      title={`Cahier de texte · ${title}`}
      size="2xl"
      zIndex={60}
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          {entry && (
            <button type="button" className="btn btn--danger" onClick={onDelete} disabled={busy}>Supprimer</button>
          )}
          <span className="flex-1" />
          <button type="button" className="btn btn--ghost" onClick={close} disabled={busy}>Fermer</button>
          <button type="button" className="btn btn--ghost" onClick={onSave} disabled={busy || empty || (!dirty && !!entry)}>
            Enregistrer
          </button>
          <button type="button" className="btn btn--primary" onClick={onCopy} disabled={busy || empty} title="Copie le texte pour le coller dans Pronote">
            Copier pour Pronote
          </button>
        </div>
      }
    >
      <div className="journal-dialog">
        <div className="journal-dialog__meta">
          <span style={{ textTransform: 'capitalize' }}>{when}</span>
          {entry && <span>· {SOURCE_LABEL[entry.source]}</span>}
          {entry && (
            entry.copiedAt ? (
              <button type="button" className="journal-chip journal-chip--done" onClick={onToggleCopied} disabled={busy} title="Remettre « à recopier »">
                ✓ Copiée le {entry.copiedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </button>
            ) : (
              <button type="button" className="journal-chip" onClick={onToggleCopied} disabled={busy} title="Marquer comme recopiée dans Pronote, sans copier">
                À recopier
              </button>
            )
          )}
        </div>
        <textarea
          className="journal-dialog__text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={'Thème — séquence, séance n : titre\n\nTRAVAIL EFFECTUÉ EN CLASSE\n…\n\nCOMPÉTENCES TRAVAILLÉES\n- …'}
          rows={18}
          spellCheck
          autoFocus={!entry}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && dirty && !empty) void onSave(); }}
        />
      </div>
    </Modal>
  );
}
