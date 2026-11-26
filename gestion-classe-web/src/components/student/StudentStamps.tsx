import { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { getCardTier } from '../../lib/rewardsQueries';
import { CategoryIcon } from '../rewards/CategoryIcon';

/** Ce que rend la RPC `get_student_stamps`. */
export interface StampData {
  student_id: string;
  active_card: {
    id: string;
    card_number: number;
    status: string;
    created_at: string;
    stamps: {
      id: string;
      slot_number: number;
      category_label: string;
      category_icon: string;
      category_icon_ref?: string | null;
      category_color: string;
      awarded_at: string;
    }[];
    stamp_count: number;
  } | null;
  completed_cards: {
    id: string;
    card_number: number;
    completed_at: string;
    bonus_label: string | null;
    bonus_used: boolean;
    selected_at: string | null;
    used_at: string | null;
  }[];
  categories: { label: string; icon: string; icon_ref?: string | null; color: string }[];
  available_bonuses: { id: string; label: string }[];
}

type Stamp = NonNullable<StampData['active_card']>['stamps'][number];

const shortDate = (iso: string): string => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const longDate = (iso: string): string => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

interface Props {
  stampData: StampData | null;
  loading: boolean;
  error: string | null;
  /** Le bonus vient d'être enregistré : on le dit quelques secondes. */
  bonusSaved: boolean;
  /** Enregistre le bonus choisi ; rend `false` si le serveur a refusé. */
  onSelectBonus: (bonusId: string) => Promise<boolean>;
}

/**
 * Onglet « Tampons » : la carte en cours, le choix du bonus quand elle est pleine, puis ce qu'il
 * faut savoir (comment gagner un tampon, bonus possibles, cartes terminées).
 */
export function StudentStamps({ stampData, loading, error, bonusSaved, onSelectBonus }: Props) {
  const [detail, setDetail] = useState<Stamp | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState(false);

  const card = stampData?.active_card ?? null;
  const cardNumber = card?.card_number ?? 1;
  const tier = getCardTier(cardNumber);

  const head = (
    <div className="el-head__titles">
      <span className="el-kicker">Carte n° {cardNumber} · {tier.name}</span>
      <h1 className="el-h1">Carte à tampons</h1>
    </div>
  );

  if (loading) return <>{head}<p className="el-note">Chargement…</p></>;
  if (error) return <>{head}<p className="el-error">{error}</p></>;
  if (!stampData) return <>{head}<p className="el-note">Aucune donnée pour l’instant.</p></>;

  const stamps = card?.stamps ?? [];
  const count = card?.stamp_count ?? 0;
  const complete = count >= 10;
  const left = Math.max(0, 10 - count);
  const latest = [...stamps].sort((a, b) => b.awarded_at.localeCompare(a.awarded_at)).slice(0, 3);
  const categories = stampData.categories.filter((c, i, all) => all.findIndex((x) => x.label === c.label) === i);
  const bonuses = stampData.available_bonuses;

  const validate = async () => {
    if (!choice || saving) return;
    setSaving(true);
    setRefused(false);
    const ok = await onSelectBonus(choice);
    setSaving(false);
    if (ok) setChoice(null);
    else setRefused(true);
  };

  return (
    <>
      {head}

      {bonusSaved && (
        <div className="el-banner" role="status">
          <Check size={20} aria-hidden /> Bonus enregistré. Ton professeur le prendra en compte.
        </div>
      )}

      <div className="el-card el-card--stack">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span className="el-mid">{count}<span className="el-unit" style={{ fontSize: 14 }}> tampon{count > 1 ? 's' : ''} sur 10</span></span>
          {complete
            ? <span className="el-chip el-chip--pos">Carte pleine</span>
            : <span className="el-label" style={{ fontSize: 14 }}>Encore {left}</span>}
        </div>
        <div className="el-stamps">
          {Array.from({ length: 10 }, (_, i) => {
            const stamp = stamps.find((s) => s.slot_number === i + 1);
            if (!stamp) return <span key={i} className="el-stamp el-stamp--empty" aria-label={`Case ${i + 1}, vide`}>{i + 1}</span>;
            return (
              <button key={i} type="button" className="el-stamp" onClick={() => setDetail(stamp)} aria-label={`${stamp.category_label}, voir le détail`}>
                <CategoryIcon icon={stamp.category_icon} iconRef={stamp.category_icon_ref} size={26} strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
        {!complete && <p className="el-note" style={{ fontSize: 14 }}>Quand la carte est pleine, tu choisis un bonus.</p>}
      </div>

      {complete && bonuses.length > 0 && (
        <section className="el-section">
          <h2 style={{ margin: 0, fontSize: 18, lineHeight: '24px', fontWeight: 700 }}>Choisis ton bonus</h2>
          <div role="radiogroup" aria-label="Bonus possibles" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bonuses.map((b) => (
              <button key={b.id} type="button" role="radio" aria-checked={choice === b.id} className="el-choice" onClick={() => setChoice(b.id)}>
                {b.label}
              </button>
            ))}
          </div>
          {refused && <p className="el-error">Le bonus n’a pas pu être enregistré. Réessaie.</p>}
          <button type="button" className="el-btn el-btn--primary el-btn--tall el-btn--block" disabled={!choice || saving} onClick={() => { void validate(); }}>
            {saving ? 'Enregistrement…' : 'Valider ce bonus'}
          </button>
        </section>
      )}

      {latest.length > 0 && (
        <section className="el-section">
          <h2 className="el-h2">Derniers tampons</h2>
          <div className="el-card">
            {latest.map((s) => (
              <div key={s.id} className="el-row">
                <span className="el-icon-box el-icon-box--round">
                  <CategoryIcon icon={s.category_icon} iconRef={s.category_icon_ref} size={18} strokeWidth={1.8} />
                </span>
                <span className="el-row__body"><span className="el-row__title el-row__title--plain">{s.category_label}</span></span>
                <span className="el-row__meta" style={{ whiteSpace: 'nowrap' }}>{shortDate(s.awarded_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(categories.length > 0 || bonuses.length > 0 || stampData.completed_cards.length > 0) && (
        <section className="el-section">
          <h2 className="el-h2">À savoir</h2>
          <div className="el-card">
            {categories.length > 0 && (
              <details className="el-fold">
                <summary className="el-row">
                  <span className="el-row__body"><span className="el-row__title el-row__title--plain">Comment gagner un tampon ?</span></span>
                  <ChevronRight size={20} className="el-row__chev" aria-hidden />
                </summary>
                <div className="el-fold__body el-cats">
                  {categories.map((c) => (
                    <div key={c.label}>
                      <CategoryIcon icon={c.icon} iconRef={c.icon_ref} size={18} strokeWidth={1.8} />
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {bonuses.length > 0 && !complete && (
              <details className="el-fold">
                <summary className="el-row">
                  <span className="el-row__body"><span className="el-row__title el-row__title--plain">Les bonus possibles</span></span>
                  <span className="el-row__end el-label">{bonuses.length}</span>
                  <ChevronRight size={20} className="el-row__chev" aria-hidden />
                </summary>
                <ul className="el-fold__body" style={{ margin: 0, paddingLeft: 34, fontSize: 14, lineHeight: '22px' }}>
                  {bonuses.map((b) => <li key={b.id}>{b.label}</li>)}
                </ul>
              </details>
            )}
            {stampData.completed_cards.length > 0 && (
              <details className="el-fold">
                <summary className="el-row">
                  <span className="el-row__body"><span className="el-row__title el-row__title--plain">Mes cartes terminées</span></span>
                  <span className="el-row__end el-label">{stampData.completed_cards.length}</span>
                  <ChevronRight size={20} className="el-row__chev" aria-hidden />
                </summary>
                <div className="el-fold__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stampData.completed_cards.map((c) => (
                    <div key={c.id || `card-${c.card_number}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>
                        Carte n° {c.card_number} · {getCardTier(c.card_number).name}
                        {c.completed_at && <span className="el-row__meta" style={{ fontWeight: 400 }}> · {shortDate(c.completed_at)}</span>}
                      </span>
                      {c.bonus_label ? (
                        <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 8px', fontSize: 14 }}>
                          {c.bonus_label}
                          <span className={c.bonus_used ? 'el-chip el-chip--pos' : 'el-chip el-chip--warn'}>{c.bonus_used ? 'Utilisé' : 'À utiliser'}</span>
                        </span>
                      ) : (
                        <span className="el-row__meta">Pas de bonus choisi</span>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </section>
      )}

      {detail && (
        <div className="el-veil" onClick={() => setDetail(null)}>
          <div className="el-card el-dialog" role="dialog" aria-modal="true" aria-label={detail.category_label} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--el-indigo-ink)' }}>
              <CategoryIcon icon={detail.category_icon} iconRef={detail.category_icon_ref} size={44} strokeWidth={1.6} />
            </div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{detail.category_label}</p>
            <p className="el-note" style={{ margin: '6px 0 16px' }}>Reçu le {longDate(detail.awarded_at)}</p>
            <button type="button" className="el-btn el-btn--block" onClick={() => setDetail(null)}>Fermer</button>
          </div>
        </div>
      )}
    </>
  );
}
