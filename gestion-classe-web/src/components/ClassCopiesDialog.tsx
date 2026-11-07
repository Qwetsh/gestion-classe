import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from './Modal';
import { ImportTab, WebcamTab } from './AddCopyDialog';
import {
  createDepotToken,
  depotUrl,
  draftToUpload,
  fetchUnnamedCopies,
  filesToCompactDrafts,
  revokeDepotToken,
  saveCopyInfo,
  uploadPagesAsTeacher,
  uploadUnnamedAsTeacher,
  type DepotToken,
  type DraftPage,
} from '../lib/copyUpload';
import { fetchAssessmentCopies, saveGrade, type AssessmentRow, type GradeRow } from '../lib/evaluationQueries';
import {
  addPagesToStudent,
  assignBundle,
  bundleId,
  assignInOrder,
  checkBeforeSend,
  mergeWithNext,
  nextStudentWithout,
  reassignFrom,
  shiftEdgePage,
  splitBundle,
  splitIntoBundles,
  suggestPagesPerCopy,
  updatePages,
  UNNAMED,
  type Bundle,
} from '../lib/classCopies';

export interface ClassCopyStudent {
  id: string;
  pseudo: string;
  /** Pages déjà rangées (scan mobile, « Ajouter une copie ») : l'élève n'entre pas dans l'ordre. */
  existingPages: number;
  grade: GradeRow | null;
  /** Absent, dispensé ou non rendu dans le carnet. */
  absent: boolean;
}

interface ClassCopiesDialogProps {
  assessment: AssessmentRow;
  /** Élèves attendus, dans l'ordre de la liste (alphabétique). */
  students: ClassCopyStudent[];
  knownVersions: string[];
  onClose: (changed: boolean) => void;
  onError: (message: string) => void;
}

type Tab = 'import' | 'webcam' | 'qr';
type Page = DraftPage;
/** Webcam : l'élève en cours, ou une copie « Pas de nom » (créée à la première page). */
type WebTarget = { kind: 'student'; id: string } | { kind: 'unnamed'; bundleId: string | null };

/**
 * « Ajouter les copies de la classe » : le paquet entier (PDF du photocopieur, dossier de
 * photos, ou webcam élève par élève), découpé en copies de N pages et attribué dans l'ordre
 * de la liste. On corrige à la main (glisser une copie sur un élève, couper, fusionner,
 * tourner, marquer un absent, « Pas de nom ») ; rien ne part avant « Envoyer ».
 * Les pages arrivent comme celles du scan mobile (assessment_copy_pages), élève par élève ; une
 * copie « Pas de nom » va dans assessment_unnamed_pages (migration 062), à identifier ensuite.
 * QR code : un seul jeton pour l'éval, le téléphone enchaîne les élèves (page /depot) et les
 * pages arrivent directement en base.
 */
export function ClassCopiesDialog({ assessment, students, knownVersions, onClose, onError }: ClassCopiesDialogProps) {
  const [tab, setTab] = useState<Tab>('import');
  const [bundles, setBundles] = useState<Bundle<Page>[]>([]);
  const [perCopy, setPerCopy] = useState(() => suggestPagesPerCopy(students.map((s) => s.existingPages)));
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [recordAbsents, setRecordAbsents] = useState(true);
  const [versions, setVersions] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.grade?.subject_version ?? ''])),
  );
  const [adapted, setAdapted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(students.map((s) => [s.id, !!s.grade?.is_adapted])),
  );
  const [webTarget, setWebTarget] = useState<WebTarget | null>(null);
  // QR code : monté à la première ouverture de l'onglet et gardé (un jeton par fenêtre).
  const [qrOpened, setQrOpened] = useState(false);
  const [arrivals, setArrivals] = useState<Record<string, number>>({});
  const [hasCamera, setHasCamera] = useState(false);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [report, setReport] = useState<{ sent: number; failed: string[] } | null>(null);
  const [changed, setChanged] = useState(false);
  const [bulkVersion, setBulkVersion] = useState('');

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((devices) => setHasCamera(devices.some((d) => d.kind === 'videoinput')))
      .catch(() => setHasCamera(false));
  }, []);

  // Libère les vignettes à la fermeture.
  const bundlesRef = useRef(bundles);
  bundlesRef.current = bundles;
  useEffect(() => () => bundlesRef.current.forEach((b) => b.pages.forEach((p) => URL.revokeObjectURL(p.preview))), []);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const pseudo = (id: string | null) => (id === UNNAMED ? 'Pas de nom' : id ? byId.get(id)?.pseudo ?? '?' : '');
  // L'ordre de la liste, sans les absents ni ceux qui ont déjà une copie.
  const order = useMemo(
    () => students.filter((s) => !s.absent && !marked.has(s.id) && s.existingPages === 0).map((s) => s.id),
    [students, marked],
  );
  const bundleOf = useMemo(() => {
    const m = new Map<string, number>();
    bundles.forEach((b, i) => b.studentId && b.studentId !== UNNAMED && m.set(b.studentId, i));
    return m;
  }, [bundles]);

  // Webcam : l'élève en cours, par défaut le premier de la liste sans copie.
  useEffect(() => {
    if (tab !== 'webcam' || webTarget !== null) return;
    const first = nextStudentWithout(bundles, order, null);
    if (first) setWebTarget({ kind: 'student', id: first });
  }, [tab, webTarget, bundles, order]);
  const currentStudent = webTarget?.kind === 'student' ? webTarget.id : null;

  const pageCount = bundles.reduce((n, b) => n + b.pages.length, 0);

  const addImported = (drafts: Page[]) => {
    if (drafts.length === 0) return;
    setReport(null);
    setBundles((prev) => {
      const taken = new Set(prev.map((b) => b.studentId));
      const free = order.filter((id) => !taken.has(id));
      return [...prev, ...assignInOrder(splitIntoBundles(drafts, perCopy), free)];
    });
  };

  const resplit = () => {
    if (bundles.length === 0) return;
    if (!window.confirm(`Redécouper tout le paquet (${pageCount} pages) en copies de ${perCopy} page(s), attribuées dans l’ordre de la liste ? Les retouches faites à la main seront perdues.`)) return;
    setBundles((prev) => assignInOrder(splitIntoBundles(prev.flatMap((b) => b.pages), perCopy), order));
  };

  const toggleAbsent = (id: string) => {
    const nextMarked = new Set(marked);
    const becomesAbsent = !nextMarked.has(id);
    if (becomesAbsent) nextMarked.add(id);
    else nextMarked.delete(id);
    setMarked(nextMarked);
    // Un absent dans un paquet trié : sa copie était celle du suivant, toute la suite glisse d'un cran.
    const k = bundleOf.get(id);
    if (becomesAbsent && k !== undefined) {
      const nextOrder = order.filter((s) => s !== id);
      setBundles((prev) => reassignFrom(prev, k, nextOrder));
    }
  };

  const dropBundle = (bundleId: string, studentId: string) => {
    setBundles((prev) => assignBundle(prev, bundleId, studentId));
    if (marked.has(studentId)) toggleAbsent(studentId);
  };

  const removePage = (bundleId: string, pageId: string) => {
    const page = bundles.find((b) => b.id === bundleId)?.pages.find((p) => p.id === pageId);
    if (page) URL.revokeObjectURL(page.preview);
    setBundles((prev) => updatePages(prev, bundleId, (pages) => pages.filter((p) => p.id !== pageId)));
  };
  const rotatePage = (bundleId: string, pageId: string) =>
    setBundles((prev) => updatePages(prev, bundleId, (pages) => pages.map((p) => (p.id === pageId ? { ...p, turns: p.turns + 1 } : p))));
  const removeBundle = (bundleId: string) => {
    bundles.find((b) => b.id === bundleId)?.pages.forEach((p) => URL.revokeObjectURL(p.preview));
    setBundles((prev) => prev.filter((b) => b.id !== bundleId));
  };

  const capture = (drafts: Page[]) => {
    if (!webTarget) return;
    setReport(null);
    if (webTarget.kind === 'student') {
      setBundles((prev) => addPagesToStudent(prev, webTarget.id, drafts));
      return;
    }
    const existing = webTarget.bundleId && bundles.some((b) => b.id === webTarget.bundleId) ? webTarget.bundleId : null;
    if (existing) {
      setBundles((prev) => updatePages(prev, existing, (pages) => [...pages, ...drafts]));
    } else {
      const id = bundleId();
      setBundles((prev) => [...prev, { id, pages: drafts, studentId: UNNAMED }]);
      setWebTarget({ kind: 'unnamed', bundleId: id });
    }
  };
  const webUnnamedPages =
    webTarget?.kind === 'unnamed' && webTarget.bundleId
      ? bundles.find((b) => b.id === webTarget.bundleId)?.pages.length ?? 0
      : 0;

  /* ---------- envoi ---------- */

  const infoChanges = students.filter(
    (s) => (versions[s.id] ?? '').trim() !== (s.grade?.subject_version ?? '') || adapted[s.id] !== !!s.grade?.is_adapted,
  );
  // Seuls les élèves sans note passent « absent » : on n'écrase jamais une note.
  const absentsToSave = recordAbsents
    ? students.filter((s) => marked.has(s.id) && !s.absent && !bundleOf.has(s.id) && s.grade?.grade == null)
    : [];
  const check = checkBeforeSend(bundles, (id) => versions[id] ?? '', knownVersions);
  const nothingToDo = check.ready === 0 && absentsToSave.length === 0 && infoChanges.length === 0;

  const saveInfo = async (s: ClassCopyStudent) => {
    await saveCopyInfo({
      userId: assessment.user_id,
      assessmentId: assessment.id,
      studentId: s.id,
      subjectVersion: (versions[s.id] ?? '').trim() || null,
      isAdapted: !!adapted[s.id],
    });
  };

  const handleSend = async () => {
    if (check.missingVersion.length > 0) {
      onError(`Version du sujet à indiquer (${knownVersions.join(', ')}) pour : ${check.missingVersion.map(pseudo).join(', ')}`);
      return;
    }
    const appended = bundles.filter((b) => b.studentId && (byId.get(b.studentId)?.existingPages ?? 0) > 0);
    const unnamedCount = bundles.filter((b) => b.studentId === UNNAMED).length;
    const lines = [
      check.ready > 0 &&
        `${check.ready} copie(s) vont partir, ${bundles.filter((b) => b.studentId).reduce((n, b) => n + b.pages.length, 0)} pages` +
          (unnamedCount > 0 ? `, dont ${unnamedCount} « Pas de nom » à identifier ensuite.` : '.'),
      check.unassigned > 0 && `${check.unassigned} copie(s) sans élève resteront ici.`,
      appended.length > 0 && `Pages ajoutées après celles déjà rangées pour : ${appended.map((b) => pseudo(b.studentId)).join(', ')}.`,
      absentsToSave.length > 0 && `${absentsToSave.length} élève(s) noté(s) absent(s) dans le carnet : ${absentsToSave.map((s) => s.pseudo).join(', ')}.`,
    ].filter(Boolean);
    if (!window.confirm(`${lines.join('\n')}\n\nEnvoyer ?`)) return;

    const failed: string[] = [];
    const sentIds = new Set<string>();
    const ready = bundles.filter((b) => b.studentId);
    // Trois échecs de suite : réseau ou session en cause, inutile d'insister sur toute la classe.
    let inARow = 0;
    for (let i = 0; i < ready.length && inARow < 3; i++) {
      const b = ready[i];
      const name = pseudo(b.studentId);
      try {
        setSending(`Copie ${i + 1}/${ready.length} · ${name} · préparation`);
        const pages: Blob[] = [];
        for (const p of b.pages) pages.push(await draftToUpload(p));
        const onProgress = (n: number) => setSending(`Copie ${i + 1}/${ready.length} · ${name} · page ${n}/${pages.length}`);
        if (b.studentId === UNNAMED) {
          await uploadUnnamedAsTeacher({ userId: assessment.user_id, assessmentId: assessment.id, pages, onProgress });
        } else {
          await uploadPagesAsTeacher({
            userId: assessment.user_id,
            assessmentId: assessment.id,
            studentId: b.studentId!,
            pages,
            replace: false,
            onProgress,
          });
        }
        sentIds.add(b.id);
        setChanged(true);
        inARow = 0;
      } catch (e) {
        failed.push(`${name} (${errorText(e)})`);
        inARow += 1;
      }
    }
    if (inARow >= 3) {
      bundles.filter((b) => sentIds.has(b.id)).forEach((b) => b.pages.forEach((p) => URL.revokeObjectURL(p.preview)));
      setBundles((prev) => prev.filter((b) => !sentIds.has(b.id)));
      setSending(null);
      setReport({ sent: sentIds.size, failed: [...failed, 'envoi arrêté après 3 échecs de suite : vérifie la connexion, puis renvoie'] });
      return;
    }
    setSending('Version du sujet, copies adaptées, absents…');
    for (const s of infoChanges) {
      try {
        await saveInfo(s);
        setChanged(true);
      } catch (e) {
        failed.push(`${s.pseudo} : version non enregistrée (${errorText(e)})`);
      }
    }
    for (const s of absentsToSave) {
      try {
        await saveGrade({ userId: assessment.user_id, assessmentId: assessment.id, studentId: s.id, raw: null, grade: null, status: 'absent' });
        setChanged(true);
      } catch (e) {
        failed.push(`${s.pseudo} : absence non enregistrée (${errorText(e)})`);
      }
    }
    bundles.filter((b) => sentIds.has(b.id)).forEach((b) => b.pages.forEach((p) => URL.revokeObjectURL(p.preview)));
    setBundles((prev) => prev.filter((b) => !sentIds.has(b.id)));
    setSending(null);
    setReport({ sent: sentIds.size, failed });
    // Tout est parti : on ferme. Sinon la fenêtre garde les copies en échec, à renvoyer.
    if (failed.length === 0) onClose(true);
  };

  const close = async () => {
    if (sending) return;
    if (bundles.length > 0 && !window.confirm(`${bundles.length} copie(s) pas encore envoyée(s). Fermer quand même ? Elles seront perdues.`)) return;
    onClose(changed);
  };

  /* ---------- rendu ---------- */

  const tabs: [Tab, string][] = [
    ['import', 'Importer le paquet'],
    ...(hasCamera ? ([['webcam', 'Webcam, élève par élève']] as [Tab, string][]) : []),
    ['qr', 'QR code (téléphone)'],
  ];
  const versionRequired = knownVersions.length >= 2;

  return (
    <Modal isOpen onClose={close} title="Ajouter les copies de la classe" size="6xl">
      <div style={{ display: 'grid', gridTemplateColumns: '330px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        {/* ---- Élèves ---- */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            Glisse une copie sur un élève pour la lui donner.{versionRequired && ` Version du sujet obligatoire (${knownVersions.join(', ')}).`}
          </div>
          {versionRequired && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <select value={bulkVersion} onChange={(e) => setBulkVersion(e.target.value)} style={input}>
                <option value="">version…</option>
                {knownVersions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <button
                style={mini}
                disabled={!bulkVersion}
                onClick={() =>
                  setVersions((prev) => {
                    const next = { ...prev };
                    for (const b of bundles) if (b.studentId && b.studentId !== UNNAMED && !(next[b.studentId] ?? '').trim()) next[b.studentId] = bulkVersion;
                    for (const id of Object.keys(arrivals)) if (!(next[id] ?? '').trim()) next[id] = bulkVersion;
                    return next;
                  })
                }
              >
                à ceux qui reçoivent une copie sans version
              </button>
            </div>
          )}
          <datalist id="class-copy-versions">
            {knownVersions.map((v) => <option key={v} value={v} />)}
          </datalist>
          <div style={{ maxHeight: '62vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            {students.map((s) => {
              const k = bundleOf.get(s.id);
              const isMarked = marked.has(s.id);
              const isCurrent = tab === 'webcam' && currentStudent === s.id;
              const missingVersion = versionRequired && (k !== undefined || !!arrivals[s.id]) && !(versions[s.id] ?? '').trim();
              return (
                <div
                  key={s.id}
                  onDragOver={(e) => { e.preventDefault(); setDropOn(s.id); }}
                  onDragLeave={() => setDropOn((d) => (d === s.id ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropOn(null);
                    const id = e.dataTransfer.getData('text/x-bundle');
                    if (id) dropBundle(id, s.id);
                  }}
                  onClick={() => {
                    if (tab === 'webcam') setWebTarget({ kind: 'student', id: s.id });
                    else if (k !== undefined) document.getElementById(`class-copy-${bundles[k].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderBottom: '1px solid var(--border)',
                    background: dropOn === s.id ? 'var(--indigo-soft)' : isCurrent ? 'var(--warn-soft)' : 'transparent', cursor: 'pointer',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: s.absent || isMarked ? 'var(--text-dim)' : 'var(--text)' }}>
                    {s.pseudo}
                  </span>
                  {arrivals[s.id] > 0 && <Badge tone="ok">reçu {arrivals[s.id]} p.</Badge>}
                  {k !== undefined ? (
                    <Badge tone="ok">copie {k + 1} · {bundles[k].pages.length} p.</Badge>
                  ) : s.existingPages > 0 ? (
                    <Badge>déjà {s.existingPages} p.</Badge>
                  ) : s.absent ? (
                    <Badge tone="neg">absent</Badge>
                  ) : null}
                  {!s.absent && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleAbsent(s.id); }}
                      title={isMarked ? 'Plus absent' : 'Absent : sorti de l’ordre de la liste'}
                      style={{ ...mini, background: isMarked ? 'var(--neg-soft)' : 'var(--surface)', color: isMarked ? 'var(--neg)' : 'var(--text-muted)' }}
                    >
                      abs.
                    </button>
                  )}
                  <input
                    list="class-copy-versions"
                    value={versions[s.id] ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setVersions((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    placeholder="v."
                    title="Version du sujet"
                    style={{ ...input, width: 44, borderColor: missingVersion ? 'var(--neg)' : 'var(--border)' }}
                  />
                  <input
                    type="checkbox"
                    checked={!!adapted[s.id]}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setAdapted((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                    title="Copie adaptée"
                  />
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
            abs. : absent (sa place dans l’ordre passe au suivant) · v. : version du sujet · case : copie adaptée
          </div>
          {marked.size > 0 && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              <input type="checkbox" checked={recordAbsents} onChange={(e) => setRecordAbsents(e.target.checked)} />
              Noter les absents dans le carnet (élèves sans note seulement)
            </label>
          )}
        </div>

        {/* ---- Paquet ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tabs.map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  if (id === 'qr') setQrOpened(true);
                }}
                style={{ ...chip, background: tab === id ? 'var(--text)' : 'var(--surface-3)', color: tab === id ? 'var(--surface)' : 'var(--text-muted)' }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'import' && (
            <ImportTab
              onAdd={addImported}
              onError={onError}
              convert={filesToCompactDrafts}
              compact={bundles.length > 0}
              label={bundles.length > 0 ? 'Ajouter d’autres pages (à la suite)' : 'Glisse ici le PDF du paquet ou les photos des copies, ou clique pour les choisir.'}
              hint="Pages prises dans l’ordre (fichiers par nom), découpées en copies et attribuées dans l’ordre de la liste. Réduites à 2000 px."
            />
          )}
          {tab === 'webcam' && (
            <WebcamTab onAdd={capture} onError={onError} compact disabled={!webTarget}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {webTarget?.kind === 'unnamed'
                  ? `Pas de nom${webUnnamedPages ? ` · ${webUnnamedPages} p.` : ''}`
                  : currentStudent
                    ? `${pseudo(currentStudent)}${bundleOf.has(currentStudent) ? ` · ${bundles[bundleOf.get(currentStudent)!].pages.length} p.` : ''}`
                    : 'Choisis un élève à gauche'}
              </span>
              <button
                style={btn}
                onClick={() => {
                  const next = nextStudentWithout(bundles, order, currentStudent);
                  setWebTarget(next ? { kind: 'student', id: next } : null);
                }}
              >
                Élève suivant →
              </button>
              <button
                style={btn}
                onClick={() => setWebTarget({ kind: 'unnamed', bundleId: null })}
                title="Nouvelle copie sans nom lisible, à identifier plus tard"
              >
                Pas de nom
              </button>
            </WebcamTab>
          )}
          {qrOpened && (
            <div style={{ display: tab === 'qr' ? 'block' : 'none' }}>
              <ClassQrTab
                assessment={assessment}
                students={students}
                versionRequired={versionRequired}
                onArrivals={(next) => {
                  setArrivals(next);
                  if (Object.keys(next).length > 0) setChanged(true);
                }}
                onUnnamedArrived={() => setChanged(true)}
                onError={onError}
              />
            </div>
          )}

          {tab === 'import' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                Pages par copie
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={perCopy}
                  onChange={(e) => setPerCopy(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  style={{ ...input, width: 52 }}
                />
              </label>
              {bundles.length > 0 && (
                <>
                  <button style={btn} onClick={resplit}>Redécouper</button>
                  <button style={btn} onClick={() => setBundles((prev) => assignInOrder(prev, order))}>Réattribuer dans l’ordre</button>
                </>
              )}
            </div>
          )}

          {bundles.length > 0 && (
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
              {bundles.length} copie(s), {pageCount} pages{check.unassigned > 0 && <span style={{ color: 'var(--warn)' }}> · {check.unassigned} sans élève</span>}
            </div>
          )}
          <div style={{ maxHeight: '52vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bundles.map((b, i) => (
              <div
                key={b.id}
                id={`class-copy-${b.id}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/x-bundle', b.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                style={{
                  border: `1px ${b.studentId === UNNAMED ? 'dashed' : 'solid'} ${b.studentId ? 'var(--border)' : 'var(--warn)'}`, borderRadius: 10, padding: 8,
                  background: b.studentId === UNNAMED ? 'var(--surface-3)' : b.studentId ? 'var(--surface)' : 'var(--warn-soft)', cursor: 'grab',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Copie {i + 1}</span>
                  <select
                    value={b.studentId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      if (id) dropBundle(b.id, id);
                      else setBundles((prev) => assignBundle(prev, b.id, null));
                    }}
                    style={{ ...input, fontWeight: 600, maxWidth: 220 }}
                  >
                    <option value="">— à attribuer —</option>
                    <option value={UNNAMED}>Pas de nom (à identifier plus tard)</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.pseudo}
                        {s.absent || marked.has(s.id) ? ' (absent)' : s.existingPages > 0 ? ` (déjà ${s.existingPages} p.)` : ''}
                      </option>
                    ))}
                  </select>
                  <span style={{ flex: 1 }} />
                  <button style={mini} onClick={() => setBundles((prev) => reassignFrom(prev, i, order))} title="Cette copie et les suivantes reprennent l’ordre de la liste">
                    réattribuer d’ici
                  </button>
                  {i < bundles.length - 1 && (
                    <button style={mini} onClick={() => setBundles((prev) => mergeWithNext(prev, b.id))} title="Ajouter les pages de la copie suivante">
                      fusionner avec la suivante
                    </button>
                  )}
                  <button style={mini} onClick={() => removeBundle(b.id)} title="Retirer cette copie du paquet">✕</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {b.pages.map((p, j) => (
                    <div key={p.id} style={{ width: 84, textAlign: 'center' }}>
                      <div style={{ width: 84, height: 112, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'var(--surface-3)' }}>
                        <img
                          src={p.preview}
                          alt={`copie ${i + 1}, page ${j + 1}`}
                          loading="lazy"
                          draggable={false}
                          style={{ maxWidth: '100%', maxHeight: '100%', transform: `rotate(${p.turns * 90}deg)` }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 3 }}>
                        {j === 0 && i > 0 && (
                          <button style={mini} onClick={() => setBundles((prev) => shiftEdgePage(prev, b.id, -1))} title="Passer cette page dans la copie précédente">⇠</button>
                        )}
                        {j > 0 && (
                          <button style={mini} onClick={() => setBundles((prev) => splitBundle(prev, b.id, j))} title="Couper ici : une nouvelle copie commence à cette page">✂</button>
                        )}
                        <button style={mini} onClick={() => rotatePage(b.id, p.id)} title="Tourner d’un quart de tour">⟳</button>
                        <button style={mini} onClick={() => removePage(b.id, p.id)} title="Retirer la page">✕</button>
                        {j === b.pages.length - 1 && i < bundles.length - 1 && (
                          <button style={mini} onClick={() => setBundles((prev) => shiftEdgePage(prev, b.id, 1))} title="Passer cette page dans la copie suivante">⇢</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {report && (
            <div style={{ fontSize: 13, padding: '8px 10px', borderRadius: 8, background: report.failed.length ? 'var(--neg-soft)' : 'var(--pos-soft)', color: report.failed.length ? 'var(--neg)' : 'var(--pos)' }}>
              {report.sent} copie(s) envoyée(s).
              {report.failed.length > 0 && <> Échecs, à renvoyer : {report.failed.join(' ; ')}.</>}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            {sending && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sending}</span>}
            <button onClick={close} disabled={!!sending} style={btn}>{changed ? 'Terminer' : 'Fermer'}</button>
            <button
              onClick={handleSend}
              disabled={nothingToDo || !!sending}
              title={check.missingVersion.length ? `Version du sujet à indiquer pour ${check.missingVersion.length} élève(s)` : undefined}
              style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)', opacity: nothingToDo || sending ? 0.55 : 1 }}
            >
              {sending ? 'Envoi…' : check.ready > 0 ? `Envoyer ${check.ready} copie(s)` : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * QR code pour toute l'éval (migration 062) : le téléphone ouvre /depot, choisit l'élève (ou
 * « Pas de nom »), photographie, « Élève suivant ». Les pages arrivent directement en base ;
 * on suit les arrivées toutes les 3 s. Le jeton est révoqué à la fermeture de la fenêtre.
 */
function ClassQrTab({
  assessment,
  students,
  versionRequired,
  onArrivals,
  onUnnamedArrived,
  onError,
}: {
  assessment: AssessmentRow;
  students: ClassCopyStudent[];
  versionRequired: boolean;
  onArrivals: (arrivals: Record<string, number>) => void;
  onUnnamedArrived: () => void;
  onError: (m: string) => void;
}) {
  const [token, setToken] = useState<DepotToken | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [received, setReceived] = useState<Record<string, number>>({});
  const [unnamedNew, setUnnamedNew] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const callbacks = useRef({ onArrivals, onUnnamedArrived, onError });
  useEffect(() => {
    callbacks.current = { onArrivals, onUnnamedArrived, onError };
  });

  // Un jeton par fenêtre ; révoqué en la fermant.
  useEffect(() => {
    let current: DepotToken | null = null;
    let cancelled = false;
    createDepotToken(assessment.id, null)
      .then(async (t) => {
        if (cancelled) {
          revokeDepotToken(t.token).catch(() => undefined);
          return;
        }
        current = t;
        setToken(t);
        setQr(await QRCode.toDataURL(depotUrl(t.token), { width: 320, margin: 1, errorCorrectionLevel: 'M' }));
      })
      .catch((e) => callbacks.current.onError(e instanceof Error ? `QR code indisponible (${e.message})` : 'QR code indisponible'));
    return () => {
      cancelled = true;
      if (current) revokeDepotToken(current.token).catch(() => undefined);
    };
  }, [assessment.id]);

  // Les copies qui arrivent du téléphone, comparées à l'ouverture.
  const initialUnnamed = useRef<number | null>(null);
  useEffect(() => {
    if (!token) return;
    const before = new Map(students.map((s) => [s.id, s.existingPages]));
    let stop = false;
    const tick = async () => {
      setNow(Date.now());
      try {
        const [pages, unnamed] = await Promise.all([fetchAssessmentCopies(assessment.id), fetchUnnamedCopies(assessment.id)]);
        if (stop) return;
        const count = new Map<string, number>();
        for (const p of pages) count.set(p.student_id, (count.get(p.student_id) ?? 0) + 1);
        const next: Record<string, number> = {};
        for (const [id, n] of count) {
          const extra = n - (before.get(id) ?? 0);
          if (extra > 0 && before.has(id)) next[id] = extra;
        }
        setReceived(next);
        callbacks.current.onArrivals(next);
        if (initialUnnamed.current === null) initialUnnamed.current = unnamed.length;
        const extraUnnamed = Math.max(0, unnamed.length - initialUnnamed.current);
        setUnnamedNew(extraUnnamed);
        if (extraUnnamed > 0) callbacks.current.onUnnamedArrived();
      } catch {
        // réseau : prochain tour
      }
    };
    tick();
    const timer = window.setInterval(tick, 3000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [token, assessment.id, students]);

  const left = token ? Math.max(0, Math.round((new Date(token.expires_at).getTime() - now) / 60000)) : null;
  const names = new Map(students.map((s) => [s.id, s.pseudo]));
  const got = Object.entries(received);
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ width: 240, height: 240, display: 'grid', placeItems: 'center', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
        {qr ? <img src={qr} alt="QR code d'envoi de la classe" style={{ width: 228, height: 228 }} /> : <span style={{ color: '#666', fontSize: 12 }}>Création du QR code…</span>}
      </div>
      <div style={{ flex: 1, minWidth: 240, fontSize: 13, color: 'var(--text)' }}>
        <ol style={{ margin: '0 0 10px', paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Scanne ce QR code avec l’appareil photo du téléphone.</li>
          <li>Choisis l’élève (ceux sans copie sont en haut), photographie ses pages, « Envoyer », puis « Élève suivant ».</li>
          <li>Copie sans nom lisible : « Pas de nom », à identifier ensuite dans « Voir les copies ».</li>
        </ol>
        <div style={{ fontWeight: 700, color: got.length || unnamedNew ? 'var(--pos)' : 'var(--text-muted)' }}>
          {got.length || unnamedNew
            ? `Reçu : ${got.length} élève(s)${unnamedNew ? `, ${unnamedNew} page(s) sans nom` : ''}`
            : 'En attente des copies…'}
        </div>
        {got.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {got.map(([id, n]) => `${names.get(id) ?? '?'} (${n} p.)`).join(' · ')}
          </div>
        )}
        {versionRequired && got.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 6 }}>
            Indique la version du sujet de ces élèves dans la liste, puis « Enregistrer ».
          </div>
        )}
        {token && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
            Valable encore {left} min, {token.max_pages} pages au plus pour la classe. Fermer la fenêtre désactive le QR code.
          </div>
        )}
      </div>
    </div>
  );
}

/** Message d'une erreur Supabase (objet simple, pas toujours une Error). */
function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m ? m : 'erreur';
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'neg' }) {
  const colors = {
    neutral: ['var(--surface-3)', 'var(--text-muted)'],
    ok: ['var(--pos-soft)', 'var(--pos)'],
    neg: ['var(--neg-soft)', 'var(--neg)'],
  }[tone];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: colors[0], color: colors[1], whiteSpace: 'nowrap' }}>
      {children}
    </span>
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
const input: React.CSSProperties = {
  padding: '2px 5px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
};
