import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from './Modal';
import {
  canvasToPreparedDraft,
  createDepotToken,
  depotUrl,
  draftId,
  filesToDrafts,
  movePage,
  draftToUpload,
  revokeDepotToken,
  saveCopyInfo,
  uploadPagesAsTeacher,
  type DepotToken,
  type DraftPage,
} from '../lib/copyUpload';
import { fetchAssessmentCopies, type AssessmentRow } from '../lib/evaluationQueries';

type Tab = 'import' | 'webcam' | 'qr';

interface AddCopyDialogProps {
  assessment: AssessmentRow;
  student: { id: string; pseudo: string };
  /** Pages déjà rangées pour cet élève (pour « remplacer » et le décompte). */
  existingPages: number;
  /** L'élève a déjà une note : des pages ajoutées appellent une recorrection. */
  graded: boolean;
  subjectVersion: string | null;
  isAdapted: boolean;
  /** Versions du sujet déjà vues dans la classe (scan mobile, Correcteur). */
  knownVersions: string[];
  onClose: (changed: boolean) => void;
  onError: (message: string) => void;
}

/**
 * « Ajouter une copie » (migration 058) : importer des images ou un PDF, photographier à la
 * webcam, ou afficher un QR code que le téléphone scanne pour envoyer les pages (page /depot).
 * Les pages s'ajoutent après celles de l'élève, ou les remplacent sur confirmation.
 */
export function AddCopyDialog({
  assessment,
  student,
  existingPages,
  graded,
  subjectVersion,
  isAdapted,
  knownVersions,
  onClose,
  onError,
}: AddCopyDialogProps) {
  const [tab, setTab] = useState<Tab>('import');
  const [drafts, setDrafts] = useState<DraftPage[]>([]);
  const [replace, setReplace] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [changed, setChanged] = useState(false);
  const [done, setDone] = useState(false);
  const [version, setVersion] = useState(subjectVersion ?? '');
  const [adapted, setAdapted] = useState(isAdapted);
  const [hasCamera, setHasCamera] = useState(false);
  // Plusieurs versions du sujet : la version de la copie décide du barème (bouton « Corriger »).
  const versionRequired = knownVersions.length >= 2 && !version.trim();

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((devices) => setHasCamera(devices.some((d) => d.kind === 'videoinput')))
      .catch(() => setHasCamera(false));
  }, []);

  // Libère les vignettes à la fermeture.
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  useEffect(() => () => draftsRef.current.forEach((d) => URL.revokeObjectURL(d.preview)), []);

  const addDrafts = (more: DraftPage[]) => setDrafts((prev) => [...prev, ...more]);
  const removeDraft = (id: string) =>
    setDrafts((prev) => {
      const gone = prev.find((d) => d.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((d) => d.id !== id);
    });
  const rotateDraft = (id: string) => setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, turns: d.turns + 1 } : d)));
  const moveDraft = (i: number, delta: number) => setDrafts((prev) => movePage(prev, i, i + delta));

  const saveInfoIfChanged = useCallback(async () => {
    const v = version.trim() || null;
    if (v === (subjectVersion ?? null) && adapted === isAdapted) return;
    await saveCopyInfo({
      userId: assessment.user_id,
      assessmentId: assessment.id,
      studentId: student.id,
      subjectVersion: v,
      isAdapted: adapted,
    });
    setChanged(true);
  }, [version, adapted, subjectVersion, isAdapted, assessment, student.id]);

  const handleSend = async () => {
    if (drafts.length === 0) return;
    if (
      replace &&
      existingPages > 0 &&
      !window.confirm(`Supprimer les ${existingPages} page(s) déjà rangées pour ${student.pseudo} et les remplacer par ces ${drafts.length} page(s) ?`)
    ) {
      return;
    }
    setSending(0);
    try {
      const pages: Blob[] = [];
      for (const d of drafts) pages.push(await draftToUpload(d));
      await uploadPagesAsTeacher({
        userId: assessment.user_id,
        assessmentId: assessment.id,
        studentId: student.id,
        pages,
        replace: replace && existingPages > 0,
        onProgress: setSending,
      });
      await saveInfoIfChanged();
      drafts.forEach((d) => URL.revokeObjectURL(d.preview));
      setDrafts([]);
      setChanged(true);
      setDone(true);
    } catch (e) {
      onError(e instanceof Error ? `Envoi impossible : ${e.message}` : 'Envoi impossible');
    } finally {
      setSending(null);
    }
  };

  const close = async () => {
    try {
      await saveInfoIfChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Version du sujet non enregistrée');
    }
    onClose(changed);
  };

  const tabs: [Tab, string][] = [
    ['import', 'Importer'],
    ...(hasCamera ? ([['webcam', 'Webcam']] as [Tab, string][]) : []),
    ['qr', 'QR code (téléphone)'],
  ];

  return (
    <Modal isOpen onClose={close} title={`Ajouter une copie · ${student.pseudo}`} size="2xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{ ...chip, background: tab === id ? 'var(--text)' : 'var(--surface-3)', color: tab === id ? 'var(--surface)' : 'var(--text-muted)' }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'import' && <ImportTab onAdd={addDrafts} onError={onError} />}
        {tab === 'webcam' && <WebcamTab onAdd={addDrafts} onError={onError} />}
        {tab === 'qr' && versionRequired && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--warn)', border: '1px dashed var(--border)', borderRadius: 10 }}>
            Indique d’abord la version du sujet (plus bas) : le QR code s’affiche ensuite.
          </div>
        )}
        {tab === 'qr' && !versionRequired && (
          <QrTab
            assessment={assessment}
            studentId={student.id}
            initialPages={existingPages}
            onReceived={() => setChanged(true)}
            onError={onError}
          />
        )}

        {tab !== 'qr' && drafts.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
              {drafts.length} page(s) à envoyer, dans cet ordre
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {drafts.map((d, i) => (
                <div key={d.id} style={{ width: 96, textAlign: 'center' }}>
                  <div style={{ width: 96, height: 128, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'var(--surface-3)' }}>
                    <img src={d.preview} alt={`page ${i + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', transform: `rotate(${d.turns * 90}deg)` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 4 }}>
                    <button onClick={() => moveDraft(i, -1)} disabled={i === 0} style={mini} title="Avant">←</button>
                    <button onClick={() => rotateDraft(d.id)} style={mini} title="Tourner d'un quart de tour">⟳</button>
                    <button onClick={() => removeDraft(d.id)} style={mini} title="Retirer">✕</button>
                    <button onClick={() => moveDraft(i, 1)} disabled={i === drafts.length - 1} style={mini} title="Après">→</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            Version du sujet
            <input
              list="add-copy-versions"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="—"
              style={{
                width: 70, padding: '3px 6px', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)',
                border: `1px solid ${versionRequired ? 'var(--neg)' : 'var(--border)'}`,
              }}
            />
            <datalist id="add-copy-versions">
              {knownVersions.map((v) => <option key={v} value={v} />)}
            </datalist>
            {versionRequired && (
              <span style={{ color: 'var(--neg)', fontWeight: 600 }}>obligatoire ({knownVersions.join(', ')})</span>
            )}
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={adapted} onChange={(e) => setAdapted(e.target.checked)} />
            Copie adaptée
          </label>
          {tab !== 'qr' && existingPages > 0 && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              Remplacer les {existingPages} page(s) existante(s)
            </label>
          )}
        </div>

        {done && (
          <div style={{ fontSize: 13, padding: '8px 10px', borderRadius: 8, background: 'var(--pos-soft)', color: 'var(--pos)' }}>
            Pages ajoutées.
            {graded && ' La copie était déjà corrigée : pense à « Recorriger ».'}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={close} style={btn}>{changed ? 'Terminer' : 'Fermer'}</button>
          {tab !== 'qr' && (
            <button
              onClick={handleSend}
              disabled={drafts.length === 0 || sending !== null || versionRequired}
              title={versionRequired ? 'Indique d’abord la version du sujet' : undefined}
              style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)', opacity: drafts.length === 0 || sending !== null || versionRequired ? 0.55 : 1 }}
            >
              {sending !== null ? `Envoi… ${sending}/${drafts.length}` : `Envoyer ${drafts.length || ''} page(s)`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function ImportTab({
  onAdd,
  onError,
  convert = filesToDrafts,
  label = 'Glisse ici les photos ou le PDF de la copie, ou clique pour les choisir.',
  hint = 'Un PDF donne une page par page. Réduites à 2000 px avant l’envoi.',
  compact = false,
}: {
  onAdd: (d: DraftPage[]) => void;
  onError: (m: string) => void;
  /** Fichiers → pages (le paquet d'une classe passe par filesToCompactDrafts). */
  convert?: (files: File[], onProgress?: (pages: number) => void) => Promise<DraftPage[]>;
  label?: string;
  hint?: string;
  /** Zone basse, quand des pages sont déjà là. */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState(0);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const take = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setRead(0);
    try {
      const drafts = await convert(Array.from(files), setRead);
      if (drafts.length === 0) onError('Aucune image ni PDF dans ce choix.');
      onAdd(drafts);
    } catch (e) {
      onError(e instanceof Error ? `Fichier illisible : ${e.message}` : 'Fichier illisible');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      onClick={() => input.current?.click()}
      style={{
        border: `2px dashed ${over ? 'var(--indigo)' : 'var(--border)'}`, borderRadius: 10, padding: compact ? 12 : 28,
        textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13,
        background: over ? 'var(--indigo-soft)' : 'transparent',
      }}
    >
      {busy ? `Lecture des fichiers…${read > 0 ? ` ${read} page(s)` : ''}` : label}
      {!compact && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{hint}</div>}
      <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

export function WebcamTab({
  onAdd,
  onError,
  compact = false,
  disabled = false,
  children,
}: {
  onAdd: (d: DraftPage[]) => void;
  onError: (m: string) => void;
  /** Page mise au profil d'envoi dès la prise (beaucoup de pages : la classe entière). */
  compact?: boolean;
  disabled?: boolean;
  /** Boutons en plus, à côté de « Prendre la page ». */
  children?: React.ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 2560 }, height: { ideal: 1440 } } })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().then(() => setReady(true)).catch(() => setReady(true));
        }
      })
      .catch(() => onErrorRef.current('Webcam inaccessible (autorisation refusée ou caméra occupée).'));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    if (compact) {
      canvasToPreparedDraft(canvas)
        .then((d) => onAdd([d]))
        .catch(() => onError('Photo impossible à préparer.'));
      return;
    }
    canvas.toBlob((b) => {
      if (b) onAdd([{ id: draftId(), source: canvas, turns: 0, preview: URL.createObjectURL(b) }]);
    }, 'image/jpeg', 0.6);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <video ref={video} muted playsInline style={{ width: '100%', maxHeight: 360, background: '#000', borderRadius: 10 }} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <button
          onClick={capture}
          disabled={!ready || disabled}
          style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)', opacity: !ready || disabled ? 0.55 : 1 }}
        >
          Prendre la page
        </button>
        {children}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Une photo par page ; recommence pour les suivantes.</div>
    </div>
  );
}

function QrTab({
  assessment,
  studentId,
  initialPages,
  onReceived,
  onError,
}: {
  assessment: AssessmentRow;
  studentId: string;
  initialPages: number;
  onReceived: () => void;
  onError: (m: string) => void;
}) {
  const [token, setToken] = useState<DepotToken | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [received, setReceived] = useState(0);
  const [now, setNow] = useState(Date.now());
  // Rappels du parent par ref : un nouveau rendu du parent ne doit pas recréer le jeton.
  const onErrorRef = useRef(onError);
  const onReceivedRef = useRef(onReceived);
  onErrorRef.current = onError;
  onReceivedRef.current = onReceived;

  // Un jeton par ouverture de l'onglet ; révoqué en le quittant (fermeture, autre onglet).
  useEffect(() => {
    let current: DepotToken | null = null;
    let cancelled = false;
    createDepotToken(assessment.id, studentId)
      .then(async (t) => {
        if (cancelled) {
          revokeDepotToken(t.token).catch(() => undefined);
          return;
        }
        current = t;
        setToken(t);
        setQr(await QRCode.toDataURL(depotUrl(t.token), { width: 320, margin: 1, errorCorrectionLevel: 'M' }));
      })
      .catch((e) => onErrorRef.current(e instanceof Error ? `QR code indisponible (${e.message})` : 'QR code indisponible'));
    return () => {
      cancelled = true;
      if (current) revokeDepotToken(current.token).catch(() => undefined);
    };
  }, [assessment.id, studentId]);

  // Les pages qui arrivent du téléphone.
  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(async () => {
      setNow(Date.now());
      try {
        const pages = await fetchAssessmentCopies(assessment.id);
        const count = pages.filter((p) => p.student_id === studentId).length - initialPages;
        if (count > 0) onReceivedRef.current();
        setReceived((prev) => Math.max(prev, count));
      } catch {
        // réseau : prochain tour
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [token, assessment.id, studentId, initialPages]);

  const left = token ? Math.max(0, Math.round((new Date(token.expires_at).getTime() - now) / 60000)) : null;
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 240, height: 240, display: 'grid', placeItems: 'center', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
        {qr ? <img src={qr} alt="QR code d'envoi" style={{ width: 228, height: 228 }} /> : <span style={{ color: '#666', fontSize: 12 }}>Création du QR code…</span>}
      </div>
      <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: 'var(--text)' }}>
        <ol style={{ margin: '0 0 10px', paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Scanne ce QR code avec l’appareil photo du téléphone.</li>
          <li>Photographie chaque page, puis touche « Envoyer ».</li>
          <li>Les pages arrivent ici ; ferme la fenêtre quand c’est fini.</li>
        </ol>
        <div style={{ fontWeight: 700, color: received > 0 ? 'var(--pos)' : 'var(--text-muted)' }}>
          {received > 0 ? `${received} page(s) reçue(s)` : 'En attente des pages…'}
        </div>
        {token && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            Valable encore {left} min, {token.max_pages} pages au plus, pour cet élève seulement. Fermer la fenêtre désactive le QR code.
          </div>
        )}
      </div>
    </div>
  );
}

const chip: React.CSSProperties = {
  border: 'none', borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const btn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontFamily: 'inherit',
};
const mini: React.CSSProperties = {
  padding: '1px 5px', borderRadius: 5, fontSize: 11, cursor: 'pointer', border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit',
};
