import { useState, useRef, useCallback, useEffect } from 'react';
import { Archive, BookOpen, Box, ChevronLeft, FlaskConical } from 'lucide-react';
import { supabase } from '../lib/supabaseUntyped';
import { studentBinderOpen } from '../lib/studentBinder';
import { StudentBinderView } from '../components/binder/StudentBinderView';
import { fetchStudentTps, type StudentTpItem } from '../lib/studentTp';
import { StudentTp, type Part as TpPart } from '../components/StudentTp';
import { AcademyQuiz } from '../components/academy/AcademyQuiz';
import { MyHouse } from '../components/academy/MyHouse';
import { StudentAnnales } from '../components/StudentAnnales';
import { StudentAr } from '../components/StudentAr';
import { StudentGrades } from '../components/StudentGrades';
import { StudentBinderToc } from '../components/student/StudentBinderToc';
import { StudentHome } from '../components/student/StudentHome';
import { StudentImplication } from '../components/student/StudentImplication';
import type { DashboardData } from '../lib/studentDashboard';
import { StudentNav, type StudentView } from '../components/student/StudentNav';
import { StudentStamps, type StampData } from '../components/student/StudentStamps';
import { fetchStudentGrades, type StudentAssessment } from '../lib/studentGrades';
import type { HouseId } from '../lib/academyQueries';
import hpMusicUrl from '../Musique/Musique Générique - HARRY POTTER.mp3';
import '../styles/eleve.css';

/**
 * Espace élève (/eleve), direction A « Carnet » (26/11/2026) : une barre en bas à cinq entrées au
 * plus (Accueil, Notes, Cours, Tampons, Maison), la même famille visuelle que l'app du professeur.
 *
 * L'onglet Maison (Académie) garde son décor, son en-tête et sa musique : seul ce qui l'entoure a
 * changé (la barre du bas, dans ses teintes sombres).
 */

// Teintes de l'en-tête de l'onglet Maison (l'ancien thème de l'espace, que l'Académie garde)
const ACADEMY_FONT = "'Cormorant Garamond', Georgia, serif";

/** Sous-écrans de « Cours » : le sommaire, puis les annales ou la réalité augmentée dans la page. */
type CoursPart = 'hub' | 'annales' | 'ar';

export function StudentDashboard() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [view, setView] = useState<StudentView>('home');
  const [notesPart, setNotesPart] = useState<'marks' | 'implication'>('marks');
  const [coursPart, setCoursPart] = useState<CoursPart>('hub');
  // Notes d'évaluation : ouvertes par la classe (class_student_tabs.show_grades), résolu
  // par la RPC elle-même pour ne pas avoir à toucher get_student_dashboard.
  const [showMarks, setShowMarks] = useState(false);
  /** Les évaluations de l'élève, pour la dernière note de l'accueil. */
  const [marks, setMarks] = useState<StudentAssessment[]>([]);
  // Classeur : ouvert par la classe (class_binders.tab_enabled) ; le serveur du classeur
  // le dit lui-même. Il s'ouvre en plein écran, par-dessus l'espace élève.
  /** Code de l'élève dont la classe a le classeur ouvert (null : pas de classeur). */
  const [binderCode, setBinderCode] = useState<string | null>(null);
  const showBinder = binderCode !== null;
  const [binderOpen, setBinderOpen] = useState(false);
  /** Page sur laquelle le classeur s'ouvre (clé donnée par le sommaire de « Cours ») ; null : au début. */
  const [binderStart, setBinderStart] = useState<string | null>(null);
  // Le retour du téléphone referme le classeur au lieu de quitter l'espace (et de faire ressaisir le code)
  const openBinder = useCallback((pageKey?: string) => {
    setBinderStart(pageKey ?? null);
    window.history.pushState({ ...(window.history.state as object | null), gcBinder: true }, '');
    setBinderOpen(true);
  }, []);
  /** Un retour est déjà demandé : un second appui ne doit pas faire quitter l'espace. */
  const closingBinder = useRef(false);
  const closeBinder = useCallback(() => {
    if (closingBinder.current) return;
    if ((window.history.state as { gcBinder?: boolean } | null)?.gcBinder) { closingBinder.current = true; window.history.back(); }
    else setBinderOpen(false);
  }, []);
  useEffect(() => {
    const onPop = () => { closingBinder.current = false; setBinderOpen(false); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // TP en groupes (PLAN_tp_groupes.md, lot 3) : visible dès que l'élève a fait partie d'un groupe,
  // sans réglage de classe. Plein écran par-dessus l'espace, comme le classeur (même retour du téléphone).
  /** Code de l'élève qui a au moins un TP (null : pas d'entrée). */
  const [tpCode, setTpCode] = useState<string | null>(null);
  /** Le TP en cours de l'élève, pour l'accueil. */
  const [activeTp, setActiveTp] = useState<StudentTpItem | null>(null);
  const [tpOpen, setTpOpen] = useState(false);
  /** TP sur lequel l'écran des TP s'ouvre directement (depuis l'accueil) ; null : la liste. */
  const [tpStart, setTpStart] = useState<{ id: string; part?: TpPart } | null>(null);
  const closingTp = useRef(false);
  const openTp = useCallback((start?: { id: string; part?: TpPart }) => {
    setTpStart(start ?? null);
    window.history.pushState({ ...(window.history.state as object | null), gcTp: true }, '');
    setTpOpen(true);
  }, []);
  const closeTp = useCallback(() => {
    if (closingTp.current) return;
    if ((window.history.state as { gcTp?: boolean } | null)?.gcTp) { closingTp.current = true; window.history.back(); }
    else setTpOpen(false);
  }, []);
  useEffect(() => {
    const onPop = () => { closingTp.current = false; setTpOpen(false); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // Visibilité des entrées : pilotée par la classe (RPC get_student_dashboard).
  // Un élève témoin voit tout (aperçu en conditions réelles).
  const isWitness = !!data?.is_witness;
  const showStamps = isWitness || !!data?.tabs?.stamps;
  const showAnnales = isWitness || !!data?.tabs?.annales;
  const [stampData, setStampData] = useState<StampData | null>(null);
  const [academyData, setAcademyData] = useState<{ enabled: boolean; house: HouseId | null; test_completed: boolean; classId: string | null } | null>(null);
  const [stampLoading, setStampLoading] = useState(false);
  const [stampError, setStampError] = useState<string | null>(null);
  const [bonusSaved, setBonusSaved] = useState(false);
  const currentCodeRef = useRef('');
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /** Entrées de la barre ouvertes à cet élève. */
  const available: StudentView[] = ['home', 'notes', 'cours', ...(showStamps ? ['stamps' as const] : []), ...(academyData?.enabled ? ['academy' as const] : [])];
  /** L'entrée affichée : une entrée refermée entre-temps ramène à l'accueil. */
  const current: StudentView = available.includes(view) ? view : 'home';

  // Musique de l'Académie : le thème joue tant que l'onglet Maison est affiché
  // (le classeur ouvert par-dessus coupe la musique)
  const isAcademyActive = current === 'academy' && !!academyData?.enabled && !binderOpen;
  useEffect(() => {
    if (isAcademyActive && !muted) {
      if (!audioRef.current) {
        audioRef.current = new Audio(hpMusicUrl);
        audioRef.current.loop = true;
        audioRef.current.volume = 0.3;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [isAcademyActive, muted]);

  const bonusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (bonusTimerRef.current) clearTimeout(bonusTimerRef.current);
    };
  }, []);

  // Connexion automatique depuis un QR code personnel (?code=123456), puis nettoyage de l'URL
  const autoLoginDone = useRef(false);
  useEffect(() => {
    if (autoLoginDone.current) return;
    autoLoginDone.current = true;
    const params = new URLSearchParams(window.location.search);
    const urlCode = (params.get('code') || '').replace(/\D/g, '').slice(0, 6);
    if (urlCode.length !== 6) return;
    setCode(urlCode.split(''));
    params.delete('code');
    const rest = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
    void handleSubmit(urlCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDigitChange = useCallback((index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    setCode(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    if (pasted.length < 6) {
      inputRefs.current[pasted.length]?.focus();
    }
  }, [code]);

  const handleSubmit = async (override?: string) => {
    const fullCode = override ?? code.join('');
    if (fullCode.length !== 6) return;
    setIsLoading(true);
    setError(null);
    currentCodeRef.current = fullCode;

    try {
      const { data: result, error: rpcError } = await supabase.rpc('get_student_dashboard', { p_code: fullCode });
      if (rpcError) throw rpcError;
      if (result?.error) {
        setError(result.error === 'not_found' ? 'Code incorrect. Vérifie et réessaie.' : 'Erreur inconnue');
        setIsLoading(false);
        return;
      }
      // La RPC get_student_dashboard renvoie « bavardages » (nom historique du type d'événement) ;
      // l'interface parle de « malus » depuis le renommage des libellés.
      setData({ ...result, malus: Number(result.malus ?? result.bavardages ?? 0) });

      // Tampons
      setStampLoading(true);
      setStampError(null);
      try {
        const { data: sData, error: sErr } = await supabase.rpc('get_student_stamps', { p_code: fullCode });
        if (!sErr && sData) setStampData(sData);
        else setStampError('Impossible de charger les tampons');
      } catch {
        setStampError('Erreur de chargement des tampons');
      }
      setStampLoading(false);

      // Notes d'évaluation : la RPC dit elle-même si elles sont ouvertes à la classe.
      try {
        const grades = await fetchStudentGrades(fullCode);
        setShowMarks(grades.enabled);
        setMarks(grades.enabled ? grades.assessments : []);
      } catch {
        setShowMarks(false);
        setMarks([]);
      }

      // Classeur : le serveur dit s'il est ouvert à la classe (rien d'autre n'est lu ici).
      void studentBinderOpen({ code: fullCode }).then((open) => { if (currentCodeRef.current === fullCode) setBinderCode(open ? fullCode : null); });

      // TP en groupes : l'entrée n'apparaît que si l'élève en a fait au moins un
      void fetchStudentTps(fullCode)
        .then((tps) => {
          if (currentCodeRef.current !== fullCode) return;
          setTpCode(tps.length > 0 ? fullCode : null);
          setActiveTp(tps.find((t) => t.status === 'active') ?? null);
        })
        .catch(() => { /* sans la migration 088, pas d'entrée */ });

      // Académie
      try {
        const { data: aData } = await supabase.rpc('get_student_academy', { p_code: fullCode });
        if (aData && !aData.error) {
          setAcademyData({
            enabled: aData.enabled ?? false,
            house: aData.house ?? null,
            test_completed: aData.test_completed ?? false,
            classId: aData.class_id ?? null,
          });
        }
      } catch { /* ignore */ }
    } catch {
      setError('Erreur de connexion. Réessaie.');
    }
    setIsLoading(false);
  };

  // Pendant que l'onglet Tampons est ouvert : rafraîchir toutes les 30 s et au retour
  // sur l'onglet (un tampon donné en classe apparaît sans recharger la page).
  useEffect(() => {
    if (current !== 'stamps' || !showStamps || !currentCodeRef.current) return;
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || !currentCodeRef.current) return;
      const { data: sData } = await supabase.rpc('get_student_stamps', { p_code: currentCodeRef.current });
      if (sData && !sData.error) setStampData(sData);
    };
    const interval = setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [current, showStamps]);

  const handleSelectBonus = async (bonusId: string): Promise<boolean> => {
    if (!stampData?.active_card || !currentCodeRef.current) return false;
    try {
      const { error: err } = await supabase.rpc('select_student_bonus', { p_code: currentCodeRef.current, p_bonus_id: bonusId });
      if (err) throw err;
      setBonusSaved(true);
      if (bonusTimerRef.current) clearTimeout(bonusTimerRef.current);
      bonusTimerRef.current = setTimeout(() => setBonusSaved(false), 6000);
      const { data: sData } = await supabase.rpc('get_student_stamps', { p_code: currentCodeRef.current });
      if (sData) setStampData(sData);
      return true;
    } catch {
      return false;
    }
  };

  const handleLogout = () => {
    setData(null);
    setStampData(null);
    setAcademyData(null);
    setCode(['', '', '', '', '', '']);
    setError(null);
    setView('home');
    setNotesPart('marks');
    setCoursPart('hub');
    setShowMarks(false);
    setMarks([]);
    setBinderCode(null);
    setBinderOpen(false);
    setTpCode(null);
    setActiveTp(null);
    setTpOpen(false);
    setBonusSaved(false);
    currentCodeRef.current = '';
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  /** Change d'entrée : on arrive en haut de la page, sur le premier écran de l'entrée. */
  const goTo = (next: StudentView) => {
    if (next === 'cours') setCoursPart('hub');
    setView(next);
    window.scrollTo(0, 0);
  };

  // ============================================
  // SAISIE DU CODE
  // ============================================
  if (!data) {
    const complete = code.join('').length === 6;
    return (
      <div className="el">
        <div className="el-login">
          <form className="el-card el-login__card" onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span className="el-icon-box" style={{ width: 48, height: 48 }}><BookOpen size={26} strokeWidth={1.8} aria-hidden /></span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h1 className="el-h1" style={{ fontSize: 28, lineHeight: '34px' }}>Mon espace</h1>
                <p className="el-login__text">Entre ton code personnel à 6 chiffres pour voir tes résultats.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="el-field-label" id="el-code-label">Code personnel</span>
              <div className="el-code" role="group" aria-labelledby="el-code-label">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={1}
                    value={digit}
                    aria-label={`Chiffre ${i + 1}`}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                  />
                ))}
              </div>
              {error && <p className="el-error" role="alert">{error}</p>}
            </div>

            <button type="submit" className="el-btn el-btn--primary el-btn--tall el-btn--block" disabled={isLoading || !complete}>
              {isLoading ? 'Chargement…' : 'Voir mes résultats'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================
  // ONGLET MAISON (ACADÉMIE) : contenu, en-tête et décor inchangés
  // ============================================
  if (current === 'academy' && academyData?.enabled) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        padding: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative',
      }}>
        <div style={{ maxWidth: 'none', margin: '0 auto' }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 0,
            padding: '10px 16px',
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
            background: 'oklch(0.08 0.01 50 / 0.7)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          }}>
            <div>
              <h1 style={{
                color: 'oklch(0.85 0.04 60)',
                fontFamily: ACADEMY_FONT, fontWeight: 600,
                fontSize: 20, letterSpacing: '-0.02em', fontStyle: 'italic', margin: 0,
              }}>
                {data.pseudo}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setMuted(m => !m)}
                style={{
                  padding: '8px 12px', borderRadius: '8px',
                  border: '1px solid oklch(0.35 0.04 60 / 0.4)',
                  background: 'transparent',
                  color: 'oklch(0.60 0.03 60)',
                  fontSize: '16px', cursor: 'pointer',
                }}
                title={muted ? 'Activer la musique' : 'Couper la musique'}
              >
                {muted ? '🔇' : '🔊'}
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '8px 14px', borderRadius: '8px',
                  border: '1px solid oklch(0.35 0.04 60 / 0.4)',
                  background: 'transparent',
                  color: 'oklch(0.60 0.03 60)',
                  fontSize: '13px', cursor: 'pointer',
                }}
              >
                Quitter
              </button>
            </div>
          </div>

          {academyData.house && academyData.classId ? (
            <>
              <div style={{ overflow: 'hidden', minHeight: '100vh' }}>
                <MyHouse houseId={academyData.house} classId={academyData.classId} />
              </div>
              {/* La barre du bas est un peu plus haute que l'ancienne : cette marge garde lisible la dernière ligne de la Maison */}
              <div aria-hidden style={{ height: 24, background: 'oklch(0.06 0.01 50)' }} />
            </>
          ) : academyData.test_completed ? (
            <div className="academy-root" style={{
              width: '100%', minHeight: '100vh',
              background: 'radial-gradient(ellipse at 50% 0%, oklch(0.15 0.02 55) 0%, oklch(0.06 0.01 50) 80%)',
              position: 'relative', overflow: 'hidden',
              fontFamily: "var(--font-body, 'Cormorant Garamond', Georgia, serif)",
              color: 'var(--parchment, #e8dcc8)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: 40,
            }}>
              <div style={{
                width: 120, height: 120, borderRadius: '50%',
                background: 'radial-gradient(circle, oklch(0.35 0.12 25) 0%, oklch(0.25 0.08 20) 70%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 30px oklch(0.35 0.12 25 / 0.4)',
                fontSize: 48,
              }}>Q</div>
              <h2 style={{
                fontFamily: "var(--font-display, 'Cormorant Garamond', Georgia, serif)",
                fontSize: 28, fontStyle: 'italic', fontWeight: 500,
                margin: '20px 0 8px',
              }}>
                Sceau apposé
              </h2>
              <p style={{
                fontStyle: 'italic', fontSize: 15,
                color: 'oklch(0.65 0.03 60)', maxWidth: 300, lineHeight: 1.55,
              }}>
                Tes réponses sont parvenues au Choixpeau.<br />
                Ta Maison te sera révélée lors de la prochaine cérémonie,
                par la voix de ta professeur·e.
              </p>
              <div style={{
                marginTop: 18, padding: '8px 14px',
                border: '1px solid oklch(0.30 0.05 60)',
                fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.25em',
                color: 'oklch(0.50 0.06 60)', textTransform: 'uppercase',
              }}>
                En attente de la cérémonie
              </div>
            </div>
          ) : (
            <div style={{ overflow: 'hidden', minHeight: '100vh' }}>
              <AcademyQuiz
                studentCode={currentCodeRef.current}
                onComplete={() => {
                  setAcademyData(prev => prev ? { ...prev, test_completed: true } : prev);
                }}
              />
            </div>
          )}
        </div>
        <StudentNav active="academy" available={available} onChange={goTo} academy />
      </div>
    );
  }

  // ============================================
  // ACCUEIL, NOTES, COURS, TAMPONS
  // ============================================
  const notesShown = showMarks ? notesPart : 'implication';
  const lastGrade = [...marks]
    .filter((a) => a.status === 'noted' && a.grade !== null && !!a.date)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0] ?? null;
  const stampCount = showStamps && stampData ? (stampData.active_card?.stamp_count ?? 0) : null;
  const bonusToPick = showStamps && (stampData?.active_card?.stamp_count ?? 0) >= 10 && (stampData?.available_bonuses.length ?? 0) > 0;

  return (
    <div className="el">
      <main className="el-main">
        {current === 'home' && (
          <StudentHome
            data={data}
            activeTp={tpCode ? activeTp : null}
            onOpenTp={() => openTp(activeTp ? { id: activeTp.session_id, part: activeTp.deposit_open ? 'photos' : undefined } : undefined)}
            lastGrade={lastGrade}
            stampCount={stampCount}
            bonusToPick={bonusToPick}
            onOpenMarks={() => { setNotesPart('marks'); goTo('notes'); }}
            onOpenImplication={() => { setNotesPart('implication'); goTo('notes'); }}
            onOpenStamps={() => goTo('stamps')}
            onLogout={handleLogout}
          />
        )}

        {current === 'notes' && (
          <>
            <div className="el-head__titles">
              <span className="el-kicker">Trimestre {data.trimester} · {data.school_year}</span>
              <h1 className="el-h1">Notes</h1>
            </div>
            {showMarks && (
              <div className="el-seg" role="tablist" aria-label="Type de note">
                <button type="button" role="tab" aria-selected={notesShown === 'marks'} onClick={() => setNotesPart('marks')}>Évaluations</button>
                <button type="button" role="tab" aria-selected={notesShown === 'implication'} onClick={() => setNotesPart('implication')}>Implication</button>
              </div>
            )}
            {notesShown === 'marks'
              ? <StudentGrades code={currentCodeRef.current} />
              : <StudentImplication data={data} />}
          </>
        )}

        {current === 'cours' && coursPart === 'hub' && (
          <>
            <div className="el-head__titles">
              <span className="el-kicker">{data.class_name}</span>
              <h1 className="el-h1">Cours</h1>
            </div>
            <div className="el-tiles">
              {tpCode && (
                <button type="button" className="el-tilebox" onClick={() => openTp()}>
                  <FlaskConical size={24} strokeWidth={1.8} aria-hidden />
                  <span className="el-tilebox__text">
                    <span className="el-tilebox__title">Mes TP</span>
                    {activeTp
                      ? <span className="el-tilebox__note el-tilebox__note--on">1 en cours</span>
                      : <span className="el-tilebox__note">Fiches et photos</span>}
                  </span>
                </button>
              )}
              {showAnnales && (
                <button type="button" className="el-tilebox" onClick={() => { setCoursPart('annales'); window.scrollTo(0, 0); }}>
                  <Archive size={24} strokeWidth={1.8} aria-hidden />
                  <span className="el-tilebox__text">
                    <span className="el-tilebox__title">Annales</span>
                    <span className="el-tilebox__note">Brevet</span>
                  </span>
                </button>
              )}
              <button type="button" className="el-tilebox" onClick={() => { setCoursPart('ar'); window.scrollTo(0, 0); }}>
                <Box size={24} strokeWidth={1.8} aria-hidden />
                <span className="el-tilebox__text">
                  <span className="el-tilebox__title">En 3D</span>
                  <span className="el-tilebox__note">Avec la caméra</span>
                </span>
              </button>
            </div>
            {showBinder && binderCode && <StudentBinderToc code={binderCode} onOpen={openBinder} />}
          </>
        )}

        {current === 'cours' && coursPart !== 'hub' && (
          <>
            <button type="button" className="el-back" onClick={() => { setCoursPart('hub'); window.scrollTo(0, 0); }}>
              <ChevronLeft size={22} aria-hidden /> Cours
            </button>
            {coursPart === 'annales' && showAnnales ? <StudentAnnales /> : <StudentAr />}
          </>
        )}

        {current === 'stamps' && (
          <StudentStamps
            stampData={stampData}
            loading={stampLoading}
            error={stampError}
            bonusSaved={bonusSaved}
            onSelectBonus={handleSelectBonus}
          />
        )}
      </main>

      <StudentNav active={current} available={available} onChange={goTo} />

      {/* Le classeur de la classe, en plein écran par-dessus l'espace élève */}
      {binderOpen && binderCode && <StudentBinderView binderKey={{ code: binderCode }} onClose={closeBinder} startKey={binderStart} />}
      {/* Les TP en groupes de l'élève, en plein écran */}
      {tpOpen && tpCode && <StudentTp code={tpCode} className={data.class_name} onClose={closeTp} start={tpStart} />}
    </div>
  );
}
