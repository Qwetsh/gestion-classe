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
import { useEffect, useMemo, useState } from 'react';
import { setSeededUrlsOnly } from '../lib/boardMedia';
import type { CourseDoc } from '../lib/course/courseDoc';
import {
  fetchStudentTp,
  fetchStudentTpPhotoUrls,
  fetchStudentTps,
  studentTpDocLoader,
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
  const [openId, setOpenId] = useState<string | null>(null);

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
        {openId ? (
          <TpDetail code={code} sessionId={openId} onBack={() => setOpenId(null)} />
        ) : (
          <TpList pseudo={pseudo} className={className} items={items} failed={listError} onOpen={setOpenId} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function TpList({ pseudo, className, items, failed, onOpen, onClose }: {
  pseudo: string; className: string; items: StudentTpItem[] | null; failed: boolean; onOpen: (id: string) => void; onClose: () => void;
}) {
  const current = (items ?? []).filter((t) => t.status === 'active');
  const done = (items ?? []).filter((t) => t.status !== 'active');
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
              <Pill bg={V.okSoft} fg={V.ok}><span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: V.ok }} />En cours</Pill>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: V.mid, flexWrap: 'wrap' }}>
              <GroupChip name={t.group_name} order={t.group_order} />
              <span>{t.mates.length ? `avec ${t.mates.join(', ')}` : 'seul(e) dans ton groupe'}</span>
            </div>
            <button type="button" onClick={() => onOpen(t.session_id)} style={{ height: 48, borderRadius: 12, border: 'none', background: V.indigo, color: '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Ouvrir le TP ▶
            </button>
            {t.photo_count > 0 && <div style={{ fontSize: 12, color: V.muted }}>{t.photo_count} photo{t.photo_count > 1 ? 's' : ''} du groupe</div>}
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

function TpDetail({ code, sessionId, onBack }: { code: string; sessionId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<StudentTpDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [part, setPart] = useState<Part>('fiche');
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
        setPart((['fiche', 'protocole', 'documents', 'photos'] as Part[]).find(has) ?? 'fiche');
        if (d.photos.length > 0) {
          fetchStudentTpPhotoUrls(code, sessionId).then((u) => { if (alive) setUrls(u); }).catch(() => { /* les vignettes restent grises */ });
        }
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [code, sessionId]);

  const docOf = (k: StudentTpDoc['kind']) => detail?.docs.find((d) => d.kind === k) ?? null;
  const parts: { key: Part; label: string; badge?: number }[] = detail ? [
    { key: 'fiche', label: 'Fiche d’activité' },
    { key: 'protocole', label: 'Protocole' },
    ...(docOf('documents') ? [{ key: 'documents' as Part, label: 'Documents' }] : []),
    { key: 'photos', label: 'Photos', badge: detail.photos.length || undefined },
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: V.muted }}>Photos du groupe {detail.group.name}</span>
                  <span style={{ fontSize: 12, color: V.muted }}>{detail.group.members.map((m) => (m.me ? 'toi' : m.pseudo)).join(', ')}</span>
                </div>
                {detail.photos.length === 0 ? (
                  <Card><div style={{ padding: 16, color: V.muted, fontSize: 14 }}>Pas encore de photo.</div></Card>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    {detail.photos.map((ph) => (
                      <button key={ph.id} type="button" onClick={() => urls[ph.id] && setZoom(ph)} aria-label={`Photo de ${ph.author}, ${fmtTime(ph.created_at)}`} style={{ position: 'relative', height: 150, borderRadius: 12, border: 'none', padding: 0, background: '#3B4152', overflow: 'hidden', cursor: urls[ph.id] ? 'zoom-in' : 'default' }}>
                        {urls[ph.id] && <img src={urls[ph.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                        <span style={{ position: 'absolute', left: 6, bottom: 6, height: 22, padding: '0 7px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', background: ph.author === 'Prof' ? V.indigo : 'rgba(24,24,27,0.82)', color: '#FFFFFF' }}>{ph.whole_class ? 'Classe' : ph.author}</span>
                        <span style={{ position: 'absolute', right: 6, bottom: 6, fontSize: 11, fontWeight: 600, color: '#FFFFFF', background: 'rgba(24,24,27,0.6)', padding: '2px 6px', borderRadius: 5 }}>{fmtTime(ph.created_at)}</span>
                      </button>
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
