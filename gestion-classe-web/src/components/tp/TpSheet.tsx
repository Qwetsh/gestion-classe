/**
 * Fiche d'un TP : ce dont on a besoin pour le préparer et le noter (problématique, matériel par
 * poste, protocole, sécurité, barème), puis les photos et les séances déjà faites.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Modal } from '../Modal';
import { activityLabel, formatPoints, totalPoints, type ActivityBoard } from '../../lib/tpLibrary';
import { courseHref } from '../../lib/courseLibrary';
import { fetchTpUsages, type Tp, type TpUsage } from '../../lib/tpQueries';
import { fetchTemplatePhotos, getPhotoUrl, type TpTemplatePhoto } from '../../lib/tpTemplatePhotos';

interface Props {
  tp: Tp;
  /** Activité de « Mes cours » qui fait faire ce TP, si elle y est. */
  activity: ActivityBoard | null;
  onClose: () => void;
  onEdit: () => void;
  onPrint: () => void;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export function TpSheet({ tp, activity, onClose, onEdit, onPrint }: Props) {
  const [photos, setPhotos] = useState<{ photo: TpTemplatePhoto; url: string }[]>([]);
  const [usages, setUsages] = useState<TpUsage[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchTemplatePhotos(tp.id)
      .then(async (list) => {
        const withUrls = await Promise.all(list.map(async (photo) => ({ photo, url: (await getPhotoUrl(photo.file_path)) ?? '' })));
        if (!cancelled) setPhotos(withUrls.filter((p) => p.url));
      })
      .catch(() => { /* pas de photos */ });
    if (tp.usage_count > 0) {
      void fetchTpUsages(tp.id).then((list) => { if (!cancelled) setUsages(list); }).catch(() => { /* séances indisponibles */ });
    }
    return () => { cancelled = true; };
  }, [tp.id, tp.usage_count]);

  const total = totalPoints(tp.criteria);
  const meta = [tp.level, tp.chapter, tp.modality, tp.duration_min ? `${tp.duration_min} min` : null].filter(Boolean).join(' · ');

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={tp.name}
      size="2xl"
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onPrint}>Imprimer</button>
          <button type="button" className="btn btn--primary" onClick={onEdit}>Modifier</button>
        </div>
      )}
    >
      <div className="tp-sheet">
        {(meta || tp.theme) && (
          <p className="tp-sheet__meta">
            {meta}
            {tp.theme && <span className="tp-sheet__theme">{tp.theme}</span>}
          </p>
        )}
        {activity ? (
          <Link to={courseHref(activity.id)} className="tp-sheet__activity" title="Ouvrir l’activité dans « Mes cours »">
            <BookOpen size={15} aria-hidden />
            <span>{activity.title}</span>
          </Link>
        ) : tp.activity ? (
          <p className="tp-sheet__activity tp-sheet__activity--missing">{activityLabel(tp.activity)}, pas encore dans « Mes cours »</p>
        ) : null}
        {tp.problem && <p className="tp-sheet__problem">{tp.problem}</p>}

        <div className="tp-sheet__cols">
          {tp.materials.length > 0 && (
            <section>
              <h3 className="tp-sheet__h">Matériel par poste</h3>
              <ul className="tp-sheet__list">{tp.materials.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </section>
          )}
          {tp.protocol.length > 0 && (
            <section>
              <h3 className="tp-sheet__h">Protocole</h3>
              <ol className="tp-sheet__list tp-sheet__list--steps">{tp.protocol.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </section>
          )}
        </div>

        {tp.safety.length > 0 && (
          <section className="tp-sheet__safety">
            <h3 className="tp-sheet__h">Sécurité</h3>
            <ul className="tp-sheet__list">{tp.safety.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
        )}

        {tp.criteria.length > 0 && (
          <section>
            <h3 className="tp-sheet__h">Barème <span className="tp-sheet__total">{formatPoints(total)} pts</span></h3>
            <ul className="tp-crit">
              {tp.criteria.map((c, i) => (
                <li key={c.id ?? i} className="tp-crit__row">
                  <span className="tp-crit__text">
                    <span className="tp-crit__label">{c.label}</span>
                    {c.hint && <span className="tp-crit__hint">{c.hint}</span>}
                  </span>
                  <span className="tp-crit__pts">{formatPoints(c.max_points)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {photos.length > 0 && (
          <section>
            <h3 className="tp-sheet__h">Photos</h3>
            <div className="tp-photos">
              {photos.map(({ photo, url }) => (
                <a key={photo.id} href={url} target="_blank" rel="noreferrer" className="tp-photo">
                  <img src={url} alt={photo.caption || 'Photo du TP'} />
                </a>
              ))}
            </div>
          </section>
        )}

        {usages.length > 0 && (
          <section>
            <h3 className="tp-sheet__h">Séances</h3>
            <ul className="tp-usages">
              {usages.map((u) => (
                <li key={u.session_id} className="tp-usage">
                  <span className="tp-usage__class">{u.class_name}</span>
                  <span className="tp-usage__name">{u.session_name}</span>
                  <span className="tp-usage__when">{u.completed_at ? formatDate(u.completed_at) : 'En cours'}</span>
                  {u.success_pct !== null && <span className="tp-usage__pct">{u.success_pct} %</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
