/**
 * Onglet TP de l'espace élève (PLAN_tp_groupes.md, lot 3 ; maquettes A1, A2 et A3b du canevas
 * « TP en groupes — élève et bureau », style « Vivante » choisi par Thomas). En plein écran
 * par-dessus l'espace élève, comme le classeur.
 *  - Liste : le TP en cours en tête, puis les TP déjà faits.
 *  - Un TP : fiche d'activité, protocole, documents, photos du groupe. Jamais la correction ni la
 *    note : elles arrivent dans Évals quand le professeur publie.
 * Un absent voit tout ce que son groupe a fait et garde la note du groupe (règle de Thomas).
 * Le dépôt de photos par l'élève viendra au lot 4.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { blobToBase64, DepositPhotoError, formatBytes, prepareDepositPhoto } from '../lib/depositPhoto';
import { setSeededUrlsOnly } from '../lib/boardMedia';
import type { CourseDoc } from '../lib/course/courseDoc';
import {
  fetchStudentTp,
  fetchStudentTpPhotoUrls,
  fetchStudentTps,
  deleteStudentTpPhoto,
  StudentTpError,
  studentTpDocLoader,
  uploadStudentTpPhoto,
  type StudentTpDetail,
  type StudentTpDoc,
  type StudentTpItem,
  type StudentTpPhoto,
} from '../lib/studentTp';
import { tpGroupColor } from '../lib/tpGroupSheet';
import { CourseReadOnly } from './student/CourseReadOnly';

const V = {
  bg: '#F4F5FB',
  band: '#4F46E5',
  bandSoft: '#C7D2FE',
  card: '#FFFFFF',
  line: '#E4E6F0',
  text: '#18181B',
  muted: '#71717A',
  mid: '#52525B',
  indigo: '#4F46E5',
  indigoSoft: '#EEF0FF',
  indigoText: '#3730A3',
  tpSoft: '#FFF1E8',
  tpText: '#9A3412',
  okSoft: '#E3F4E8',
  ok: '#15803D',
  shadow: '0 8px 24px rgba(55,48,163,0.12)',
};

type Part = 'fiche' | 'protocole' | 'documents' | 'photos';

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Aujourd'hui · ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function GroupChip({ name, order }: { name: string; order: number }) {
  const c = tpGroupColor(order);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: c.soft, color: c.text, border: `1px solid ${c.border}` }}>{name}</span>
  );
}

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
);

export function StudentTp({ code, pseudo, className, onClose }: { code: string; pseudo: string; className: string; onClose: () => void }) {
  const [items, setItems] = useState<StudentTpItem[] | null>(null);
  const [listError, setListError] = useState(false);
  const [opened, setOpened] = useState<{ id: string; part?: Part } | null>(null);

  // Comme le classeur : seules les adresses d'images signées par le serveur servent ici, et la page
  // du dessous ne défile pas
  useEffect(() => {
    setSeededUrlsOnly(true);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { setSeededUrlsOnly(false); document.body.style.overflow = before; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchStudentTps(code)
      .then((list) => { if (alive) setItems(list); })
      .catch(() => { if (alive) setListError(true); });
    return () => { alive = false; };
  }, [code]);

  return (
    <div role="dialog" aria-modal="true" aria-label="TP" style={{ position: 'fixed', inset: 0, zIndex: 200, background: V.bg, overflowY: 'auto', fontFamily: 'Inter, system-ui, sans-serif', color: V.text }}>
      <div style={{ maxWidth: 520, margin: '0 auto', minHeight: '100%', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
        {opened ? (
          <TpDetail key={opened.id} code={code} sessionId={opened.id} initialPart={opened.part} onBack={() => setOpened(null)} />
        ) : (
          <TpList pseudo={pseudo} className={className} items={items} failed={listError} onOpen={(id, part) => setOpened({ id, part })} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function TpList({ pseudo, className, items, failed, onOpen, onClose }: {
  pseudo: string; className: string; items: StudentTpItem[] | null; failed: boolean; onOpen: (id: string, part?: Part) => void; onClose: () => void;
}) {
  // En cours : le TP lancé, ou un TP fini dont le professeur a rouvert le dépôt
  const isCurrent = (t: StudentTpItem) => t.status === 'active' || t.deposit_open === true;
  const current = (items ?? []).filter(isCurrent);
  const done = (items ?? []).filter((t) => !isCurrent(t));
  const initials = pseudo.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();

  return (
    <>
      <div style={{ background: V.band, padding: '16px 16px 64px', paddingTop: 'calc(16px + env(safe-area-inset-top))', borderRadius: '0 0 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden style={{ width: 44, height: 44, borderRadius: 22, background: 'rgba(255,255,255,0.18)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>{initials}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>{pseudo}</div>
            <div style={{ fontSize: 13, color: V.bandSoft, marginTop: 1 }}>{className}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Revenir à mon espace" style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', color: '#FFFFFF' }}>TP</div>
      </div>

      <div style={{ margin: '-48px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items === null && !failed && <Card><div style={{ padding: 16, color: V.muted, fontSize: 14 }}>Chargement…</div></Card>}
        {failed && <Card><div style={{ padding: 16, color: V.muted, fontSize: 14 }}>Tes TP ne répondent pas. Réessaie dans un moment.</div></Card>}
        {items !== null && items.length === 0 && (
          <Card><div style={{ padding: 16, color: V.muted, fontSize: 14 }}>Pas encore de TP en groupe.</div></Card>
        )}

        {current.map((t) => (
          <div key={t.session_id} style={{ background: V.card, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: V.shadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <Pill bg={V.tpSoft} fg={V.tpText}>TP{t.activity ? ` · Activité ${t.activity}` : ''}</Pill>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{t.name}</div>
                <div style={{ fontSize: 13, color: V.muted, marginTop: 2 }}>{dayLabel(t.started_at)}</div>
              </div>
              {t.deposit_open
                ? <Pill bg={V.okSoft} fg={V.ok}><span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: V.ok }} />Dépôt ouvert</Pill>
                : <Pill bg={V.indigoSoft} fg={V.indigoText}>En cours</Pill>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: V.mid, flexWrap: 'wrap' }}>
              <GroupChip name={t.group_name} order={t.group_order} />
              <span>{t.mates.length ? `avec ${t.mates.join(', ')}` : 'seul(e) dans ton groupe'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {t.deposit_open && (
                <button type="button" onClick={() => onOpen(t.session_id, 'photos')} style={{ flex: 1, height: 48, borderRadius: 12, border: 'none', background: V.indigo, color: '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <CameraIcon />Déposer
                </button>
              )}
              <button type="button" onClick={() => onOpen(t.session_id)} style={{ flex: 1, height: 48, borderRadius: 12, border: t.deposit_open ? `1px solid ${V.line}` : 'none', background: t.deposit_open ? V.card : V.indigo, color: t.deposit_open ? V.text : '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Ouvrir le TP ▶
              </button>
            </div>
            {(t.photo_count > 0 || t.deposit_open) && (
              <div style={{ fontSize: 12, color: V.muted }}>
                {t.photo_count} photo{t.photo_count > 1 ? 's' : ''} du groupe{t.deposit_open && t.deposit_closes_at ? ` · se ferme à ${fmtTime(t.deposit_closes_at)}` : ''}
              </div>
            )}
          </div>
        ))}

        {done.length > 0 && (
          <Card>
            <div style={{ padding: '12px 14px 8px', fontSize: 12, fontWeight: 600, color: V.muted }}>Déjà faits</div>
            {done.map((t) => (
              <button
                key={t.session_id}
                type="button"
                onClick={() => onOpen(t.session_id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 64, padding: '10px 14px', border: 'none', borderTop: `1px solid ${V.line}`, background: 'transparent', color: V.text, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: V.muted }}>
                    <GroupChip name={t.group_name} order={t.group_order} />{dayLabel(t.started_at)}
                  </div>
                </div>
                {t.corrected
                  ? <Pill bg={V.indigoSoft} fg={V.indigoText}>Corrigé · Évals</Pill>
                  : <span style={{ fontSize: 12, color: V.muted }}>correction à venir</span>}
                <span style={{ color: V.muted, display: 'flex' }}><Chevron dir="right" /></span>
              </button>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}

function TpDetail({ code, sessionId, initialPart, onBack }: { code: string; sessionId: string; initialPart?: Part; onBack: () => void }) {
  const [detail, setDetail] = useState<StudentTpDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [part, setPart] = useState<Part>(initialPart ?? 'fiche');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<StudentTpPhoto | null>(null);
  const loadDoc = useMemo(() => studentTpDocLoader(code, sessionId), [code, sessionId]);

  useEffect(() => {
    let alive = true;
    fetchStudentTp(code, sessionId)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        // La première partie qui a quelque chose à montrer
        const has = (k: Part) => (k === 'photos' ? d.photos.length > 0 : k === 'protocole' ? d.docs.some((x) => x.kind === k) || (d.template?.protocol.length ?? 0) > 0 : d.docs.some((x) => x.kind === k));
        if (!initialPart) setPart((['fiche', 'protocole', 'documents', 'photos'] as Part[]).find(has) ?? 'fiche');
        if (d.photos.length > 0) {
          fetchStudentTpPhotoUrls(code, sessionId).then((u) => { if (alive) setUrls(u); }).catch(() => { /* les vignettes restent grises */ });
        }
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [code, sessionId, initialPart]);

  const depositOpen = detail?.deposit?.open === true;
  const onDeposited = useCallback((photo: { id: string; created_at: string; caption: string | null; url: string | null }) => {
    setDetail((d) => (d ? { ...d, photos: [...d.photos, { id: photo.id, created_at: photo.created_at, caption: photo.caption, whole_class: false, author: 'Toi', mine: true }] } : d));
    if (photo.url) setUrls((u) => ({ ...u, [photo.id]: photo.url as string }));
  }, []);
  const onClosed = useCallback(() => {
    setDetail((d) => (d ? { ...d, deposit: { open: false, closes_at: null, mode: 'closed' } } : d));
  }, []);
  const removeMine = async (ph: StudentTpPhoto) => {
    if (!window.confirm('Retirer cette photo ? Ton groupe ne la verra plus.')) return;
    try {
      await deleteStudentTpPhoto(code, sessionId, ph.id);
      setDetail((d) => (d ? { ...d, photos: d.photos.filter((x) => x.id !== ph.id) } : d));
    } catch (e) {
      if (e instanceof StudentTpError && e.kind === 'closed') { onClosed(); window.alert('Le dépôt est fermé : la photo reste.'); }
      else window.alert('La photo n’a pas pu être retirée. Réessaie.');
    }
  };

  const docOf = (k: StudentTpDoc['kind']) => detail?.docs.find((d) => d.kind === k) ?? null;
  const parts: { key: Part; label: string; badge?: number }[] = detail ? [
    { key: 'fiche', label: 'Fiche d’activité' },
    { key: 'protocole', label: 'Protocole' },
    ...(docOf('documents') ? [{ key: 'documents' as Part, label: 'Documents' }] : []),
    { key: 'photos', label: 'Perso', badge: detail.photos.length || undefined },
  ] : [];

  return (
    <>
      <div style={{ background: V.band, padding: '16px 16px 44px', paddingTop: 'calc(16px + env(safe-area-inset-top))', borderRadius: '0 0 24px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onBack} aria-label="Retour à mes TP" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Chevron dir="left" />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#FFFFFF' }}>{detail?.name ?? 'TP'}</div>
          {detail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: V.bandSoft, flexWrap: 'wrap' }}>
              <GroupChip name={detail.group.name} order={detail.group.order} />
              {dayLabel(detail.started_at)}{detail.template?.activity ? ` · TP · Activité ${detail.template.activity}` : ''}
            </div>
          )}
        </div>
      </div>

      {failed && <div style={{ margin: '-28px 16px 0' }}><Card><div style={{ padding: 16, color: V.muted, fontSize: 14 }}>Ce TP n’est plus disponible.</div></Card></div>}
      {!detail && !failed && <div style={{ margin: '-28px 16px 0' }}><Card><div style={{ padding: 16, color: V.muted, fontSize: 14 }}>Chargement…</div></Card></div>}

      {detail && (
        <>
          <nav aria-label="Parties du TP" style={{ margin: '-28px 16px 0', padding: 5, display: 'flex', gap: 4, background: V.card, borderRadius: 16, boxShadow: V.shadow }}>
            {parts.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPart(p.key)}
                aria-current={part === p.key ? 'page' : undefined}
                style={{ flex: 1, minHeight: 44, borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 2, lineHeight: '15px', cursor: 'pointer', fontFamily: 'inherit', background: part === p.key ? V.indigo : 'transparent', color: part === p.key ? '#FFFFFF' : V.mid }}
              >
                {p.label}
                {p.badge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: V.tpSoft, color: V.tpText, fontSize: 11, fontWeight: 700 }}>{p.badge}</span> : null}
              </button>
            ))}
          </nav>

          <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {detail.absent && (
              <Info>Tu n’étais pas là ce jour-là. Tu vois tout ce que ton groupe a fait : la fiche, le protocole, les documents et les photos. Tu auras la même note que ton groupe.</Info>
            )}

            {part === 'fiche' && <DocPart doc={docOf('fiche')} loadDoc={loadDoc} empty="Ton professeur n’a pas encore mis la fiche de ce TP." />}
            {part === 'documents' && <DocPart doc={docOf('documents')} loadDoc={loadDoc} empty="Pas de documents pour ce TP." />}
            {part === 'protocole' && (docOf('protocole')
              ? <DocPart doc={docOf('protocole')} loadDoc={loadDoc} empty="" />
              : <ProtocolCard template={detail.template} />)}
            {part === 'photos' && (
              <>
                <DepositPanel code={code} sessionId={sessionId} deposit={detail.deposit} onDeposited={onDeposited} onClosed={onClosed} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: V.muted }}>Photos du groupe {detail.group.name}</span>
                  <span style={{ fontSize: 12, color: V.muted }}>{detail.group.members.map((m) => (m.me ? 'toi' : m.pseudo)).join(', ')}</span>
                </div>
                {detail.photos.length === 0 ? (
                  <Card><div style={{ padding: 16, color: V.muted, fontSize: 14 }}>Pas encore de photo.</div></Card>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    {detail.photos.map((ph) => (
                      <div key={ph.id} style={{ position: 'relative', height: 150, borderRadius: 12, background: '#3B4152', overflow: 'hidden' }}>
                        <button type="button" onClick={() => urls[ph.id] && setZoom(ph)} aria-label={`Photo de ${ph.mine ? 'toi' : ph.author}, ${fmtTime(ph.created_at)}`} style={{ position: 'absolute', inset: 0, border: 'none', padding: 0, background: 'transparent', cursor: urls[ph.id] ? 'zoom-in' : 'default' }}>
                          {urls[ph.id] && <img src={urls[ph.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                        </button>
                        <span style={{ position: 'absolute', left: 6, bottom: 6, height: 22, padding: '0 7px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', background: ph.author === 'Prof' ? V.indigo : 'rgba(24,24,27,0.82)', color: '#FFFFFF', pointerEvents: 'none' }}>{ph.whole_class ? 'Classe' : ph.mine ? 'Toi' : ph.author}</span>
                        <span style={{ position: 'absolute', right: 6, bottom: 6, fontSize: 11, fontWeight: 600, color: '#FFFFFF', background: 'rgba(24,24,27,0.6)', padding: '2px 6px', borderRadius: 5, pointerEvents: 'none' }}>{fmtTime(ph.created_at)}</span>
                        {ph.mine && depositOpen && (
                          <button type="button" onClick={() => { void removeMine(ph); }} aria-label="Retirer ma photo" style={{ position: 'absolute', right: 4, top: 4, width: 36, height: 36, border: 0, borderRadius: 10, background: 'rgba(24,24,27,0.82)', color: '#FFFFFF', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {detail.group.comment && (
              <Card>
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: V.muted, marginBottom: 4 }}>Le mot du professeur à ton groupe</div>
                  <div style={{ fontSize: 14, lineHeight: '20px', whiteSpace: 'pre-wrap' }}>{detail.group.comment}</div>
                </div>
              </Card>
            )}
            <div style={{ fontSize: 12, lineHeight: '17px', color: V.muted, padding: '0 4px' }}>
              {detail.corrected
                ? 'La correction et ta note sont dans Évals.'
                : 'La correction n’est pas ici. Elle arrivera dans Évals quand ton professeur la publiera.'}
            </div>
          </div>
        </>
      )}

      {zoom && urls[zoom.id] && (
        <div role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(10,10,15,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10 }}>
          <img src={urls[zoom.id]} alt={zoom.caption ?? `Photo de ${zoom.author}`} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{zoom.author} · {fmtTime(zoom.created_at)}{zoom.caption ? ` · ${zoom.caption}` : ''}</div>
          <button type="button" onClick={() => setZoom(null)} style={{ height: 44, padding: '0 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
        </div>
      )}
    </>
  );
}

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
);

interface Upload {
  key: string;
  preview: string;
  before: number;
  after: number | null;
  /** réduction, envoi, réseau absent (on réessaie), refus */
  state: 'preparing' | 'sending' | 'waiting' | 'failed';
  message?: string;
  blob?: Blob;
}

/**
 * Dépôt de photos (lot 4, maquette A3) : « Prendre une photo » ouvre l'appareil, « Galerie » les
 * photos du téléphone. Chaque photo est réduite ici sous 1 Mo, puis envoyée l'une après l'autre ;
 * sans réseau, elle attend et repart d'elle-même quand le réseau revient (tant que la page est ouverte).
 */
function DepositPanel({ code, sessionId, deposit, onDeposited, onClosed }: {
  code: string;
  sessionId: string;
  deposit: StudentTpDetail['deposit'];
  onDeposited: (photo: { id: string; created_at: string; caption: string | null; url: string | null }) => void;
  onClosed: () => void;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const queue = useRef<Upload[]>([]);

  const patch = useCallback((key: string, p: Partial<Upload>) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...p } : u))), []);
  const drop = useCallback((key: string) => {
    setUploads((list) => {
      const gone = list.find((u) => u.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((u) => u.key !== key);
    });
  }, []);

  const pump = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      while (queue.current.length > 0) {
        const item = queue.current[0];
        if (!item.blob) { queue.current.shift(); continue; }
        patch(item.key, { state: 'sending', message: undefined });
        try {
          const photo = await uploadStudentTpPhoto(code, sessionId, await blobToBase64(item.blob));
          queue.current.shift();
          drop(item.key);
          onDeposited(photo);
        } catch (e) {
          const kind = e instanceof StudentTpError ? e.kind : 'server';
          if (kind === 'network') {
            // Pas de réseau : la photo attend ici, et repart quand il revient
            patch(item.key, { state: 'waiting' });
            break;
          }
          queue.current.shift();
          if (kind === 'closed') {
            patch(item.key, { state: 'failed', message: 'Dépôt fermé : la photo n’est pas partie.' });
            onClosed();
          } else {
            patch(item.key, { state: 'failed', message: kind === 'too_many' ? 'Tu as déjà déposé beaucoup de photos pour ce TP.' : kind === 'too_large' ? 'Photo trop lourde, même réduite.' : 'Envoi impossible. Réessaie.' });
          }
        }
      }
    } finally {
      busy.current = false;
    }
  }, [code, sessionId, onDeposited, onClosed, patch, drop]);

  useEffect(() => {
    const onOnline = () => { void pump(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [pump]);

  // Les aperçus sont libérés quand on quitte le TP
  const live = useRef(uploads);
  useEffect(() => { live.current = uploads; }, [uploads]);
  useEffect(() => () => { for (const u of live.current) URL.revokeObjectURL(u.preview); }, []);

  const add = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const preview = URL.createObjectURL(file);
      setUploads((list) => [...list, { key, preview, before: file.size, after: null, state: 'preparing' }]);
      try {
        const ready = await prepareDepositPhoto(file);
        const item: Upload = { key, preview, before: ready.before, after: ready.after, state: 'sending', blob: ready.blob };
        patch(key, { after: ready.after, blob: ready.blob });
        queue.current.push(item);
        void pump();
      } catch (e) {
        const kind = e instanceof DepositPhotoError ? e.kind : 'unreadable';
        patch(key, { state: 'failed', message: kind === 'not_image' ? 'Ce fichier n’est pas une photo.' : kind === 'too_big' ? 'Photo trop lourde.' : 'Photo illisible sur ce téléphone.' });
      }
    }
  };

  const retry = (u: Upload) => {
    if (!u.blob) { drop(u.key); return; }
    if (!queue.current.some((q) => q.key === u.key)) queue.current.push(u);
    patch(u.key, { state: 'sending', message: undefined });
    void pump();
  };

  if (!deposit) return null;
  const closes = deposit.closes_at ? fmtTime(deposit.closes_at) : null;

  if (!deposit.open) {
    return (
      <>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
            <span aria-hidden style={{ width: 40, height: 40, borderRadius: 20, background: '#EEF0F7', color: V.mid, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{deposit.mode === 'closed' ? 'Dépôt fermé par ton professeur' : 'Dépôt fermé à la fin de l’heure'}</div>
              <div style={{ fontSize: 12, color: V.muted, marginTop: 2 }}>Plus d’envoi possible. Les photos restent visibles.</div>
            </div>
          </div>
        </Card>
        {uploads.length > 0 && <UploadList uploads={uploads} onRetry={retry} onDrop={drop} />}
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '6px 12px', borderRadius: 12, background: V.okSoft, color: V.ok, fontSize: 13, fontWeight: 600 }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: V.ok, flexShrink: 0 }} />
        <span>Dépôt ouvert{closes ? ` · se ferme à ${closes}${deposit.mode === 'auto' ? ', fin de l’heure' : ''}` : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => cameraRef.current?.click()} style={{ flex: 1, height: 52, borderRadius: 12, border: 0, background: V.indigo, color: '#FFFFFF', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
          <CameraIcon />Prendre une photo
        </button>
        <button type="button" onClick={() => galleryRef.current?.click()} style={{ flex: 1, height: 52, borderRadius: 12, border: `1px solid ${V.line}`, background: V.card, color: V.text, fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>Galerie
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
        <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
      </div>
      <div style={{ fontSize: 12, color: V.muted, marginTop: -4, padding: '0 2px' }}>Une photo lourde est réduite toute seule avant l’envoi. Tu peux retirer tes photos tant que le dépôt est ouvert.</div>
      {uploads.length > 0 && <UploadList uploads={uploads} onRetry={retry} onDrop={drop} />}
    </>
  );
}

function UploadList({ uploads, onRetry, onDrop }: { uploads: Upload[]; onRetry: (u: Upload) => void; onDrop: (key: string) => void }) {
  return (
    <Card>
      <div style={{ padding: '4px 12px' }}>
        {uploads.map((u, i) => (
          <div key={u.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? `1px solid ${V.line}` : 'none' }}>
            <img src={u.preview} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: '#3B4152', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: u.state === 'failed' ? '#B91C1C' : u.state === 'waiting' ? '#B45309' : V.text }}>
                {u.state === 'preparing' ? 'Réduction de la photo…' : u.state === 'sending' ? 'Envoi en cours…' : u.state === 'waiting' ? 'En attente du réseau' : u.message ?? 'Envoi impossible'}
              </div>
              <div style={{ fontSize: 12, color: V.muted }}>
                {u.state === 'waiting'
                  ? 'Garde cette page ouverte : l’envoi repart dès que le réseau revient.'
                  : u.after !== null ? (u.after < u.before ? `Réduite : ${formatBytes(u.before)} → ${formatBytes(u.after)}` : formatBytes(u.after)) : formatBytes(u.before)}
              </div>
            </div>
            {(u.state === 'failed' || u.state === 'waiting') && u.blob && (
              <button type="button" onClick={() => onRetry(u)} style={{ height: 36, padding: '0 10px', border: `1px solid ${V.line}`, borderRadius: 8, background: 'transparent', color: V.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Réessayer</button>
            )}
            {u.state === 'failed' && (
              <button type="button" onClick={() => onDrop(u.key)} aria-label="Enlever de la liste" style={{ width: 36, height: 36, border: 0, borderRadius: 8, background: 'transparent', color: V.muted, fontSize: 18, cursor: 'pointer' }}>×</button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function DocPart({ doc, loadDoc, empty }: { doc: StudentTpDoc | null; loadDoc: (d: StudentTpDoc) => Promise<CourseDoc | null>; empty: string }) {
  /** Résultat d'une lecture, avec son cours et son essai : il ne vaut que pour eux. */
  const [state, setState] = useState<{ key: string; doc: CourseDoc | null } | { key: string; failed: true } | null>(null);
  const [round, setRound] = useState(0);
  const key = doc ? `${doc.board_id}|${round}` : '';
  useEffect(() => {
    if (!doc) return;
    let alive = true;
    loadDoc(doc)
      .then((d) => { if (alive) setState({ key, doc: d }); })
      .catch(() => { if (alive) setState({ key, failed: true }); });
    return () => { alive = false; };
  }, [doc, loadDoc, key]);
  const load = () => setRound((r) => r + 1);

  if (!doc) return <Card><div style={{ padding: 16, color: V.muted, fontSize: 14 }}>{empty}</div></Card>;
  const mine = state && state.key === key ? state : null;
  return (
    <Card>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, color: V.muted }}>{doc.title}</div>
        {!mine && <div style={{ padding: 16, color: V.muted, fontSize: 14 }}>Chargement…</div>}
        {mine && 'failed' in mine && (
          <div style={{ padding: 8, color: V.muted, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            Cette page ne s’ouvre pas.
            <button type="button" onClick={load} style={{ height: 36, padding: '0 12px', borderRadius: 10, border: `1px solid ${V.line}`, background: V.card, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Réessayer</button>
          </div>
        )}
        {mine && 'doc' in mine && (mine.doc
          ? <div style={{ borderRadius: 8, border: `1px solid ${V.line}`, overflow: 'hidden', background: '#FFFFFF' }}><CourseReadOnly key={doc.board_id} boardId={doc.board_id} title={doc.title} doc={mine.doc} /></div>
          : <div style={{ padding: 8, color: V.muted, fontSize: 14 }}>Cette page n’a pas de feuille à lire.</div>)}
      </div>
    </Card>
  );
}

function ProtocolCard({ template }: { template: StudentTpDetail['template'] }) {
  if (!template || (template.protocol.length === 0 && template.materials.length === 0)) {
    return <Card><div style={{ padding: 16, color: V.muted, fontSize: 14 }}>Pas de protocole pour ce TP.</div></Card>;
  }
  return (
    <Card>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {template.problem && <div style={{ fontSize: 14, lineHeight: '20px', padding: '8px 10px', background: '#F3F4F7', borderRadius: 8 }}>{template.problem}</div>}
        {template.materials.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: V.muted, marginBottom: 6 }}>Matériel</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: '21px' }}>{template.materials.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}
        {template.protocol.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: V.muted, marginBottom: 6 }}>Étapes</div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: '21px', display: 'flex', flexDirection: 'column', gap: 4 }}>{template.protocol.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
        )}
        {template.safety.length > 0 && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: V.tpSoft, color: V.tpText, fontSize: 13, lineHeight: '19px' }}>
            <b>Sécurité</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{template.safety.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 16, overflow: 'hidden' }}>{children}</div>;
}

function Pill({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 9px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', background: bg, color: fg }}>{children}</span>;
}

function Info({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 12, background: V.indigoSoft, color: V.indigoText, fontSize: 13, lineHeight: '18px' }}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></svg>
      <span>{children}</span>
    </div>
  );
}
