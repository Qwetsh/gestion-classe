/**
 * Formulaire d'un TP : rangement (niveau, séquence, thème), fiche (problématique, durée,
 * organisation, matériel, protocole, sécurité), barème et photos. Les listes se saisissent
 * une ligne par élément : on peut y coller une liste venue d'une fiche Word.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../Modal';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { PROGRAMME_THEMES, TP_LEVELS, formatPoints, totalPoints, tpChaptersOfLevel } from '../../lib/tpLibrary';
import type { Tp, TpCriterion, TpDraft } from '../../lib/tpQueries';
import { deleteTemplatePhoto, fetchTemplatePhotos, getPhotoUrl, uploadTemplatePhoto, type TpTemplatePhoto } from '../../lib/tpTemplatePhotos';

const MODALITIES = ['Individuel', 'Binôme', 'Groupe de 3-4'];

interface Props {
  userId: string;
  /** TP modifié, ou null pour un nouveau. */
  tp: Tp | null;
  /** Tous les TP : leurs séquences sont proposées à la saisie. */
  all: Tp[];
  onSave: (draft: TpDraft) => Promise<void>;
  onClose: () => void;
}

const lines = (text: string) => text.split('\n').map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean);

export function TpForm({ userId, tp, all, onSave, onClose }: Props) {
  const { toast } = useUIFeedback();
  const chaptersId = useId();
  const themesId = useId();
  const modalitiesId = useId();
  const [name, setName] = useState(tp?.name ?? '');
  const [level, setLevel] = useState(tp?.level ?? '');
  const [chapter, setChapter] = useState(tp?.chapter ?? '');
  const [theme, setTheme] = useState(tp?.theme ?? '');
  const [problem, setProblem] = useState(tp?.problem ?? '');
  const [duration, setDuration] = useState(tp?.duration_min ? String(tp.duration_min) : '');
  const [modality, setModality] = useState(tp?.modality ?? '');
  const [materials, setMaterials] = useState((tp?.materials ?? []).join('\n'));
  const [protocol, setProtocol] = useState((tp?.protocol ?? []).join('\n'));
  const [safety, setSafety] = useState((tp?.safety ?? []).join('\n'));
  const [criteria, setCriteria] = useState<TpCriterion[]>(tp?.criteria.length ? tp.criteria.map((c) => ({ ...c })) : [{ label: '', max_points: 2, hint: null }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Photos : seulement pour un TP déjà enregistré (elles sont rangées sous son identifiant)
  const [photos, setPhotos] = useState<{ photo: TpTemplatePhoto; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!tp) return;
    let cancelled = false;
    void fetchTemplatePhotos(tp.id)
      .then(async (list) => {
        const withUrls = await Promise.all(list.map(async (photo) => ({ photo, url: (await getPhotoUrl(photo.file_path)) ?? '' })));
        if (!cancelled) setPhotos(withUrls);
      })
      .catch(() => { /* pas de photos */ });
    return () => { cancelled = true; };
  }, [tp]);

  const addPhoto = async (file: File) => {
    if (!tp) return;
    setUploading(true);
    try {
      const photo = await uploadTemplatePhoto(userId, tp.id, file, '');
      const url = (await getPhotoUrl(photo.file_path)) ?? '';
      setPhotos((prev) => [...prev, { photo, url }]);
    } catch {
      toast('La photo n’a pas pu être envoyée.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (photo: TpTemplatePhoto) => {
    try {
      await deleteTemplatePhoto(photo);
      setPhotos((prev) => prev.filter((p) => p.photo.id !== photo.id));
    } catch {
      toast('La photo n’a pas pu être supprimée.');
    }
  };

  const setCriterion = (i: number, patch: Partial<TpCriterion>) =>
    setCriteria((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const total = totalPoints(criteria.filter((c) => c.label.trim()));
  const chapters = tpChaptersOfLevel(all, level || null);

  const submit = async () => {
    if (!name.trim()) { setError('Donne un nom au TP.'); return; }
    if (!criteria.some((c) => c.label.trim())) { setError('Ajoute au moins un critère au barème.'); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name, color: tp?.color ?? 'green', theme: theme || null, level: level || null, chapter: chapter || null,
        problem: problem || null, duration_min: duration ? Number(duration) : null, modality: modality || null,
        materials: lines(materials), protocol: lines(protocol), safety: lines(safety), criteria,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={tp ? 'Modifier le TP' : 'Nouveau TP'}
      size="2xl"
      zIndex={60}
      footer={(
        <div className="flex items-center justify-end gap-2">
          {error && <span className="tp-form__error" role="alert">{error}</span>}
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}
    >
      <div className="tp-form">
        <label className="tp-field">
          <span>Nom</span>
          <input className="tp-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!tp} placeholder="Dissection de la sardine : les branchies" />
        </label>

        <div className="tp-form__row">
          <label className="tp-field tp-field--level">
            <span>Niveau</span>
            <select className="tp-input" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Sans niveau</option>
              {TP_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="tp-field">
            <span>Séquence</span>
            <input className="tp-input" value={chapter} onChange={(e) => setChapter(e.target.value)} list={chaptersId} placeholder="Séquence 4 — La nutrition des animaux" />
            <datalist id={chaptersId}>{chapters.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
        </div>

        <label className="tp-field">
          <span>Thème du programme</span>
          <input className="tp-input" value={theme} onChange={(e) => setTheme(e.target.value)} list={themesId} />
          <datalist id={themesId}>{PROGRAMME_THEMES.map((t) => <option key={t} value={t} />)}</datalist>
        </label>

        <label className="tp-field">
          <span>Problématique</span>
          <textarea className="tp-input tp-input--area" rows={2} value={problem} onChange={(e) => setProblem(e.target.value)} />
        </label>

        <div className="tp-form__row">
          <label className="tp-field tp-field--level">
            <span>Durée (min)</span>
            <input className="tp-input" type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label className="tp-field">
            <span>Organisation</span>
            <input className="tp-input" value={modality} onChange={(e) => setModality(e.target.value)} list={modalitiesId} />
            <datalist id={modalitiesId}>{MODALITIES.map((m) => <option key={m} value={m} />)}</datalist>
          </label>
        </div>

        <div className="tp-form__row">
          <label className="tp-field">
            <span>Matériel par poste <em>une ligne par objet</em></span>
            <textarea className="tp-input tp-input--area" rows={6} value={materials} onChange={(e) => setMaterials(e.target.value)} />
          </label>
          <label className="tp-field">
            <span>Protocole <em>une ligne par étape</em></span>
            <textarea className="tp-input tp-input--area" rows={6} value={protocol} onChange={(e) => setProtocol(e.target.value)} />
          </label>
        </div>

        <label className="tp-field">
          <span>Sécurité <em>une ligne par consigne</em></span>
          <textarea className="tp-input tp-input--area" rows={2} value={safety} onChange={(e) => setSafety(e.target.value)} />
        </label>

        <div className="tp-field">
          <span className="tp-form__crit-head">Barème <strong>{formatPoints(total)} pts</strong></span>
          <ul className="tp-form__crits">
            {criteria.map((c, i) => (
              <li key={i} className="tp-form__crit">
                <div className="tp-form__crit-main">
                  <input className="tp-input" value={c.label} onChange={(e) => setCriterion(i, { label: e.target.value })} placeholder="Critère" aria-label={`Critère ${i + 1}`} />
                  <input
                    className="tp-input tp-input--pts"
                    type="number"
                    min={0}
                    step={0.5}
                    value={c.max_points}
                    onChange={(e) => setCriterion(i, { max_points: Number(e.target.value) })}
                    aria-label={`Points du critère ${i + 1}`}
                  />
                  <button type="button" className="tp-icon-btn" onClick={() => setCriteria((prev) => prev.filter((_, j) => j !== i))} disabled={criteria.length === 1} aria-label={`Retirer le critère ${i + 1}`}>
                    <X size={15} aria-hidden />
                  </button>
                </div>
                <input className="tp-input tp-input--hint" value={c.hint ?? ''} onChange={(e) => setCriterion(i, { hint: e.target.value })} placeholder="Ce qu’on attend pour avoir les points" aria-label={`Attendu du critère ${i + 1}`} />
              </li>
            ))}
          </ul>
          <button type="button" className="tp-add" onClick={() => setCriteria((prev) => [...prev, { label: '', max_points: 1, hint: null }])}>
            <Plus size={14} aria-hidden /> Critère
          </button>
        </div>

        {tp && (
          <div className="tp-field">
            <span>Photos</span>
            <div className="tp-photos">
              {photos.map(({ photo, url }) => (
                <div key={photo.id} className="tp-photo">
                  {url && <img src={url} alt="" />}
                  <button type="button" className="tp-photo__del" onClick={() => void removePhoto(photo)} aria-label="Supprimer la photo"><X size={14} aria-hidden /></button>
                </div>
              ))}
              <button type="button" className="tp-photo tp-photo--add" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Envoi…' : '+ Photo'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addPhoto(f); }} />
          </div>
        )}
      </div>
    </Modal>
  );
}
