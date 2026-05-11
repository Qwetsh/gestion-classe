import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadLogoPNG, formatDate,
  buildCaptationPDF, buildSortiePDF, buildDemandePDF,
  type CaptationData, type SortieData, type DemandeData,
  type Eleve, type ClasseRow, type AccompRow, type BudgetData,
} from './doc-pdf-builders';

// ── Styling consts ──
const inputCls = "w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)]/30";
const labelCls = "block text-xs font-medium text-[var(--text-muted)] mb-1";
const cardCls = "p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3";
const cardTitle = "font-semibold text-sm text-[var(--indigo)]";
const btnPrimary = "px-5 py-2.5 rounded-xl text-white font-medium text-sm transition-all hover:scale-105";
const btnSmall = "px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--indigo)] bg-[var(--indigo-soft)] hover:bg-[var(--indigo)]/20 transition-all";
const btnRemove = "px-2 py-1 rounded-lg text-xs font-medium text-[var(--neg)] hover:bg-[var(--neg-soft)] transition-all";

// ── Input helper component (outside to preserve focus) ──
function Field({ label, value, onChange, type = 'text', placeholder = '', className = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={className || 'flex-1'}>
      <label className={labelCls}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </div>
  );
}

type Tab = 'captation' | 'sortie' | 'demande';

// ── History ──
const HISTORY_KEY = 'doc-generator-history';

interface HistoryEntry {
  id: string;
  tab: Tab;
  date: string;
  label: string;
  capt?: typeof INITIAL_CAPT;
  supports?: FormSupport[];
  sortie?: typeof INITIAL_SORTIE;
  dem?: typeof INITIAL_DEM;
  demDomaines?: string[];
  classes?: ClasseRow[];
  accomps?: AccompRow[];
  eleves?: Eleve[];
  budget?: BudgetData;
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 50)));
}

// ── Support item for captation form ──
interface FormSupport {
  id: string;
  label: string;
  fixedDetail: string;
  hasPrecision: boolean;
  precision: string;
  checked: boolean;
}

const INITIAL_SUPPORTS: FormSupport[] = [
  { id: 'classe', label: 'Usage collectif en classe', fixedDetail: 'Personnel admin, equipe peda, vie scolaire, eleves', hasPrecision: false, precision: '', checked: true },
  { id: 'ent', label: 'En ligne (acces reserve : ENT, plateforme, extranet)', fixedDetail: '', hasPrecision: true, precision: '', checked: false },
  { id: 'internet', label: 'En ligne - Internet (monde entier)', fixedDetail: '', hasPrecision: true, precision: '', checked: false },
  { id: 'stockage', label: 'Support de stockage amovible', fixedDetail: '', hasPrecision: true, precision: '', checked: false },
  { id: 'projection', label: 'Projection collective', fixedDetail: '', hasPrecision: false, precision: '', checked: true },
  { id: 'collectif', label: 'Usage collectif dans les classes', fixedDetail: '', hasPrecision: false, precision: '', checked: true },
  { id: 'institutionnel', label: 'Autres usages institutionnels', fixedDetail: '', hasPrecision: false, precision: '', checked: false },
  { id: 'communication', label: 'Communication externe', fixedDetail: '', hasPrecision: false, precision: '', checked: false },
  { id: 'autre', label: 'Autre', fixedDetail: '', hasPrecision: true, precision: '', checked: false },
];

const DOMAINES = ['Arts / Culture', 'Orientation', 'Scientifique', 'Linguistique', 'Technique / Technologique', 'Sportif', 'Appariement', 'Autre'];

const INITIAL_CAPT = {
  etablissement: 'College Pierre Mendes France', tel: '03 87 54 36 40',
  codepostal: '57140 WOIPPY', annee: '2026', classe: '',
  finalites: '', projet: '', titreOeuvre: '', dateDebut: '', dateFin: '', lieu: '',
};

const INITIAL_SORTIE = {
  organisateur: '', fonction: '', date: '', classe: '', lieu: '',
  heureDepart: '', heureRetour: '', matiere: '', objectifs: '',
  transport: 'Bus', dateRetourCoupon: '', lieuDepart: 'Clg P. Mendes France WOIPPY', lieuArrivee: 'Clg P. Mendes France WOIPPY',
};

const INITIAL_DEM = {
  pays: 'france', departement: '', adresse: '',
  nature: 'obligatoire', type: 'sortie', reciprocite: 'sans', hebergement: '',
  transport: 'Bus', transportPrecision: '',
  responsable: '', qualite: '', telUrgence: '', telChef: '03 87 54 36 40',
  dateDepart: '', heureDepart: '', dateRetour: '', heureRetour: '',
  lieuDepart: 'Clg P. Mendes France WOIPPY', lieuRetour: 'Clg P. Mendes France WOIPPY',
  nbJournees: '1', disciplines: '', objectifs: '', liens: '', activites: '',
  travauxPrepa: '', restitution: '', nonParticipants: '', datePrepa: '', dateBilan: '',
  elevesClasse: '', incidences: '',
};

const EMPTY_BUDGET: BudgetData = {
  nbFamilles: 0, montantFamille: 0, etablissement: 0, dons: 0,
  subCommune: 0, subDept: 0, subRegion: 0, subEtat: 0, subAutres: 0,
  depBus: 0, depTrain: 0, depAvion: 0, depTransportAutre: 0,
  depHebergement: 0, depRepas: 0, depActivites: 0, depMateriel: 0, depDivers: 0,
};

export default function DocumentGenerator() {
  const [tab, setTab] = useState<Tab>('captation');
  const [logoPNG, setLogoPNG] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Splitter state ──
  const [leftPct, setLeftPct] = useState(38);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onSplitterDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.max(25, Math.min(70, pct)));
    };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // ── Captation state ──
  const [capt, setCapt] = useState(INITIAL_CAPT);
  const [supports, setSupports] = useState<FormSupport[]>(INITIAL_SUPPORTS);

  // ── Sortie state ──
  const [sortie, setSortie] = useState(INITIAL_SORTIE);

  // ── Demande state ──
  const [dem, setDem] = useState(INITIAL_DEM);
  const [demDomaines, setDemDomaines] = useState<string[]>([]);
  const [classes, setClasses] = useState<ClasseRow[]>([{ nom: '', effectif: '', participants: '' }]);
  const [accomps, setAccomps] = useState<AccompRow[]>([{ nom: '', qualite: '', tel: '' }]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [budget, setBudget] = useState<BudgetData>(EMPTY_BUDGET);
  const csvRef = useRef<HTMLInputElement>(null);

  // ── History state ──
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  const saveToHistory = useCallback(() => {
    const TAB_LABELS: Record<Tab, string> = { captation: 'Captation', sortie: 'Sortie', demande: 'Demande' };
    let label = TAB_LABELS[tab];
    if (tab === 'captation') label += ` - ${capt.classe || capt.projet || 'sans titre'}`;
    else if (tab === 'sortie') label += ` - ${sortie.classe || sortie.lieu || 'sans titre'}`;
    else label += ` - ${dem.disciplines || dem.responsable || 'sans titre'}`;

    const entry: HistoryEntry = {
      id: Date.now().toString(),
      tab,
      date: new Date().toLocaleString('fr-FR'),
      label,
      ...(tab === 'captation' && { capt, supports }),
      ...(tab === 'sortie' && { sortie }),
      ...(tab === 'demande' && { dem, demDomaines, classes, accomps, eleves, budget }),
    };
    const updated = [entry, ...history];
    setHistory(updated);
    saveHistory(updated);
  }, [tab, capt, supports, sortie, dem, demDomaines, classes, accomps, eleves, budget, history]);

  const restoreEntry = (entry: HistoryEntry) => {
    setTab(entry.tab);
    if (entry.tab === 'captation' && entry.capt) {
      setCapt(entry.capt);
      if (entry.supports) setSupports(entry.supports);
    } else if (entry.tab === 'sortie' && entry.sortie) {
      setSortie(entry.sortie);
    } else if (entry.tab === 'demande' && entry.dem) {
      setDem(entry.dem);
      if (entry.demDomaines) setDemDomaines(entry.demDomaines);
      if (entry.classes) setClasses(entry.classes);
      if (entry.accomps) setAccomps(entry.accomps);
      if (entry.eleves) setEleves(entry.eleves);
      if (entry.budget) setBudget(entry.budget);
    }
    setShowHistory(false);
  };

  const deleteEntry = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  // ── Load logo ──
  useEffect(() => { loadLogoPNG().then(setLogoPNG); }, []);

  // ── Budget totals ──
  const totalRecettes = budget.nbFamilles * budget.montantFamille + budget.etablissement + budget.dons + budget.subCommune + budget.subDept + budget.subRegion + budget.subEtat + budget.subAutres;
  const totalDepenses = budget.depBus + budget.depTrain + budget.depAvion + budget.depTransportAutre + budget.depHebergement + budget.depRepas + budget.depActivites + budget.depMateriel + budget.depDivers;

  // ── Helpers ──
  const updateCapt = (f: string, v: string) => setCapt(p => ({ ...p, [f]: v }));
  const updateSortie = (f: string, v: string) => setSortie(p => ({ ...p, [f]: v }));
  const updateDem = (f: string, v: string) => setDem(p => ({ ...p, [f]: v }));
  const updateBudget = (f: string, v: number) => setBudget(p => ({ ...p, [f]: v }));

  const updateSupport = (id: string, field: string, value: boolean | string) => {
    setSupports(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const updateClasseRow = (idx: number, field: keyof ClasseRow, val: string) => {
    setClasses(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };
  const updateAccompRow = (idx: number, field: keyof AccompRow, val: string) => {
    setAccomps(prev => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  };
  const updateEleve = (idx: number, field: keyof Eleve, val: string) => {
    setEleves(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
  };

  // ── CSV import ──
  const handleCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const header = lines[0].split(';').map(h => h.replace(/"/g, '').trim());
      const colNom = header.indexOf('Élèves') !== -1 ? header.indexOf('Élèves') : 0;
      const colSexe = header.indexOf('Sexe') !== -1 ? header.indexOf('Sexe') : 3;
      const parsed: Eleve[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';').map(c => c.replace(/"/g, '').trim());
        if (!cols[colNom]) continue;
        const parts = cols[colNom].split(' ');
        const nom: string[] = [], prenom: string[] = [];
        for (const p of parts) {
          if (p === p.toUpperCase() && p.length > 1) nom.push(p);
          else prenom.push(p);
        }
        let sexe = cols[colSexe] || '';
        if (sexe === 'Féminin' || sexe === 'F\u00e9minin') sexe = 'F';
        else if (sexe === 'Masculin') sexe = 'M';
        parsed.push({ nom: nom.join(' ') || cols[colNom], prenom: prenom.join(' ') || '', sexe, tel: '' });
      }
      setEleves(parsed);
    };
    reader.readAsText(file, 'utf-8');
  };

  // ── PDF generation ──
  const generatePDF = useCallback((download: boolean) => {
    let doc;
    let filename = 'document.pdf';

    if (tab === 'captation') {
      const data: CaptationData = {
        ...capt,
        dateDebut: formatDate(capt.dateDebut),
        dateFin: formatDate(capt.dateFin),
        supports: supports.filter(s => s.checked).map(s => ({
          label: s.label,
          detail: s.fixedDetail || s.precision,
        })),
      };
      doc = buildCaptationPDF(data, logoPNG);
      filename = `Autorisation_captation_${capt.classe || 'classe'}_${capt.projet || 'projet'}.pdf`;
    } else if (tab === 'sortie') {
      const data: SortieData = {
        ...sortie,
        date: formatDate(sortie.date),
        dateRetourCoupon: formatDate(sortie.dateRetourCoupon),
      };
      doc = buildSortiePDF(data, logoPNG);
      filename = `Sortie_scolaire_${sortie.classe || 'classe'}_${sortie.date || 'date'}.pdf`;
    } else {
      const data: DemandeData = {
        ...dem,
        dateDepart: formatDate(dem.dateDepart),
        dateRetour: formatDate(dem.dateRetour),
        datePrepa: formatDate(dem.datePrepa),
        dateBilan: formatDate(dem.dateBilan),
        domaines: demDomaines,
        classes: classes.filter(c => c.nom),
        accompagnateurs: accomps.filter(a => a.nom),
        eleves: eleves.filter(e => e.nom),
        budget,
      };
      doc = buildDemandePDF(data, logoPNG);
      filename = `Demande_sortie_${classes.map(c => c.nom).filter(Boolean).join('-') || 'classes'}.pdf`;
    }

    if (download) {
      doc.save(filename.replace(/\s+/g, '_'));
      saveToHistory();
    } else {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    }
  }, [tab, capt, supports, sortie, dem, demDomaines, classes, accomps, eleves, budget, logoPNG, saveToHistory]);

  // ── Auto-preview with debounce ──
  useEffect(() => {
    const timer = setTimeout(() => generatePDF(false), 400);
    return () => clearTimeout(timer);
  }, [generatePDF]);

  // ── Tab buttons ──
  const tabs: { id: Tab; label: string }[] = [
    { id: 'captation', label: 'Captation Image/Son' },
    { id: 'sortie', label: 'Sortie Obligatoire' },
    { id: 'demande', label: 'Demande Sortie/Sejour' },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setPreviewUrl(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-[var(--indigo)] text-white'
                : 'bg-[var(--surface-3)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--border)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="flex items-start" style={{ userSelect: dragging.current ? 'none' : 'auto' }}>
      {/* ── LEFT: Form ── */}
      <div className="min-w-0 space-y-4 overflow-y-auto pr-2" style={{ width: `${leftPct}%` }}>

      {/* ═══ CAPTATION FORM ═══ */}
      {tab === 'captation' && (
        <div className="space-y-4">
          <div className={cardCls}>
            <h3 className={cardTitle}>Etablissement</h3>
            <Field label="Ecole ou etablissement" value={capt.etablissement} onChange={v => updateCapt('etablissement', v)} />
            <div className="flex gap-3">
              <Field label="Telephone" value={capt.tel} onChange={v => updateCapt('tel', v)} />
              <Field label="Code postal / Commune" value={capt.codepostal} onChange={v => updateCapt('codepostal', v)} />
            </div>
            <div className="flex gap-3">
              <Field label="Annee scolaire" value={capt.annee} onChange={v => updateCapt('annee', v)} />
              <Field label="Classe de" value={capt.classe} onChange={v => updateCapt('classe', v)} placeholder="Ex: Cinquieme" />
            </div>
          </div>

          <div className={cardCls}>
            <h3 className={cardTitle}>1 - Finalites envisagees</h3>
            <div>
              <label className={labelCls}>Description des finalites</label>
              <textarea value={capt.finalites} onChange={e => updateCapt('finalites', e.target.value)} rows={3} className={inputCls} placeholder="Detaillez les finalites envisagees..." />
            </div>
          </div>

          <div className={cardCls}>
            <h3 className={cardTitle}>2 - Designation du projet audio-visuel</h3>
            <div className="flex gap-3">
              <Field label="Nom du projet" value={capt.projet} onChange={v => updateCapt('projet', v)} placeholder="Ex: La meteo du futur" />
              <Field label="Titre de l'oeuvre (si applicable)" value={capt.titreOeuvre} onChange={v => updateCapt('titreOeuvre', v)} />
            </div>
            <div className="flex gap-3">
              <Field label="Date debut" value={capt.dateDebut} onChange={v => updateCapt('dateDebut', v)} type="date" />
              <Field label="Date fin" value={capt.dateFin} onChange={v => updateCapt('dateFin', v)} type="date" />
            </div>
            <Field label="Lieu(x) d'enregistrement" value={capt.lieu} onChange={v => updateCapt('lieu', v)} />
          </div>

          <div className={cardCls}>
            <h3 className={cardTitle}>3 - Supports envisages</h3>
            <p className="text-xs text-[var(--text-dim)]">Cochez les supports prevus. Les parents pourront autoriser ou refuser chaque support.</p>
            <div className="space-y-2">
              {supports.map(s => (
                <div key={s.id} className="p-2 rounded-lg bg-[var(--surface-3)]">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={s.checked} onChange={e => updateSupport(s.id, 'checked', e.target.checked)} className="accent-[var(--indigo)]" />
                    <span className="font-medium text-[var(--text)]">{s.label}</span>
                  </label>
                  {s.fixedDetail && <p className="text-xs text-[var(--text-dim)] ml-6">{s.fixedDetail}</p>}
                  {s.hasPrecision && (
                    <input type="text" value={s.precision} onChange={e => updateSupport(s.id, 'precision', e.target.value)} placeholder="Precisez..." className={`${inputCls} mt-1 ml-6`} style={{ width: 'calc(100% - 1.5rem)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SORTIE FORM ═══ */}
      {tab === 'sortie' && (
        <div className="space-y-4">
          <div className={cardCls}>
            <h3 className={cardTitle}>Organisateur</h3>
            <div className="flex gap-3">
              <Field label="Nom Prenom" value={sortie.organisateur} onChange={v => updateSortie('organisateur', v)} placeholder="Ex: DUPONT Jean" />
              <Field label="Fonction" value={sortie.fonction} onChange={v => updateSortie('fonction', v)} placeholder="Professeur de SVT" />
            </div>
          </div>

          <div className={cardCls}>
            <h3 className={cardTitle}>Details de la sortie</h3>
            <div className="flex gap-3">
              <Field label="Date" value={sortie.date} onChange={v => updateSortie('date', v)} type="date" />
              <Field label="Classe(s)" value={sortie.classe} onChange={v => updateSortie('classe', v)} placeholder="5e3, 5e4" />
            </div>
            <Field label="Lieu" value={sortie.lieu} onChange={v => updateSortie('lieu', v)} placeholder="Musee, parc..." />
            <div className="flex gap-3">
              <Field label="Heure depart" value={sortie.heureDepart} onChange={v => updateSortie('heureDepart', v)} type="time" />
              <Field label="Heure retour" value={sortie.heureRetour} onChange={v => updateSortie('heureRetour', v)} type="time" />
            </div>
            <Field label="Matiere(s)" value={sortie.matiere} onChange={v => updateSortie('matiere', v)} />
            <div>
              <label className={labelCls}>Objectifs</label>
              <textarea value={sortie.objectifs} onChange={e => updateSortie('objectifs', e.target.value)} rows={3} className={inputCls} />
            </div>
          </div>

          <div className={cardCls}>
            <h3 className={cardTitle}>Transport & Retour</h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>Mode de transport</label>
                <select value={sortie.transport} onChange={e => updateSortie('transport', e.target.value)} className={inputCls}>
                  {['Bus', 'A pied', 'Transports en commun', 'Train', 'Vehicules personnels'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <Field label="Date retour coupon" value={sortie.dateRetourCoupon} onChange={v => updateSortie('dateRetourCoupon', v)} type="date" />
            </div>
            <div className="flex gap-3">
              <Field label="Lieu depart" value={sortie.lieuDepart} onChange={v => updateSortie('lieuDepart', v)} />
              <Field label="Lieu arrivee" value={sortie.lieuArrivee} onChange={v => updateSortie('lieuArrivee', v)} />
            </div>
          </div>
        </div>
      )}

      {/* ═══ DEMANDE FORM ═══ */}
      {tab === 'demande' && (
        <div className="space-y-4">
          {/* Destination */}
          <div className={cardCls}>
            <h3 className={cardTitle}>Destination</h3>
            <div className="flex gap-4 items-center text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={dem.pays === 'france'} onChange={() => updateDem('pays', 'france')} className="accent-[var(--indigo)]" /> France
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={dem.pays === 'etranger'} onChange={() => updateDem('pays', 'etranger')} className="accent-[var(--indigo)]" /> Etranger
              </label>
              <div className="flex-1">
                <Field label="Departement / Pays" value={dem.departement} onChange={v => updateDem('departement', v)} placeholder="Ex: Moselle" />
              </div>
            </div>
            <Field label="Adresse du lieu" value={dem.adresse} onChange={v => updateDem('adresse', v)} placeholder="Adresse complete" />
          </div>

          {/* Type deplacement */}
          <div className={cardCls}>
            <h3 className={cardTitle}>Type de deplacement</h3>
            <div className="flex gap-6 text-sm flex-wrap">
              <div>
                <span className="text-xs font-medium text-[var(--text-dim)]">Nature</span>
                <div className="flex gap-3 mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={dem.nature === 'obligatoire'} onChange={() => updateDem('nature', 'obligatoire')} className="accent-[var(--indigo)]" /> Obligatoire</label>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={dem.nature === 'facultatif'} onChange={() => updateDem('nature', 'facultatif')} className="accent-[var(--indigo)]" /> Facultatif</label>
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-[var(--text-dim)]">Type</span>
                <div className="flex gap-3 mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={dem.type === 'sortie'} onChange={() => updateDem('type', 'sortie')} className="accent-[var(--indigo)]" /> Sortie (sans nuitee)</label>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={dem.type === 'sejour'} onChange={() => updateDem('type', 'sejour')} className="accent-[var(--indigo)]" /> Sejour avec nuitee</label>
                </div>
              </div>
            </div>
            {dem.type === 'sejour' && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <span className="text-xs font-medium text-[var(--text-dim)]">Reciprocite</span>
                  <div className="flex gap-3 mt-1 text-sm">
                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={dem.reciprocite === 'sans'} onChange={() => updateDem('reciprocite', 'sans')} className="accent-[var(--indigo)]" /> Sans</label>
                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={dem.reciprocite === 'avec'} onChange={() => updateDem('reciprocite', 'avec')} className="accent-[var(--indigo)]" /> Avec</label>
                  </div>
                </div>
                <Field label="Hebergement / Etablissement partenaire" value={dem.hebergement} onChange={v => updateDem('hebergement', v)} />
              </div>
            )}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>Transport</label>
                <select value={dem.transport} onChange={e => updateDem('transport', e.target.value)} className={inputCls}>
                  {['Bus', 'A pied', 'Transports en commun', 'Train', 'Avion', 'Vehicules personnels', 'Autre'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <Field label="Compagnie / precision" value={dem.transportPrecision} onChange={v => updateDem('transportPrecision', v)} placeholder="Ex: compagnie, commune..." />
            </div>
          </div>

          {/* Responsable */}
          <div className={cardCls}>
            <h3 className={cardTitle}>Responsable de la sortie</h3>
            <div className="flex gap-3">
              <Field label="Nom Prenom" value={dem.responsable} onChange={v => updateDem('responsable', v)} placeholder="Ex: DUPONT Jean" />
              <Field label="Qualite" value={dem.qualite} onChange={v => updateDem('qualite', v)} placeholder="Professeur de SVT" />
            </div>
            <div className="flex gap-3">
              <Field label="Tel. urgence" value={dem.telUrgence} onChange={v => updateDem('telUrgence', v)} placeholder="06 ..." />
              <Field label="Tel. chef etablissement" value={dem.telChef} onChange={v => updateDem('telChef', v)} />
            </div>
          </div>

          {/* Deplacement */}
          <div className={cardCls}>
            <h3 className={cardTitle}>Renseignements du deplacement</h3>
            <div className="flex gap-3">
              <Field label="Date depart" value={dem.dateDepart} onChange={v => updateDem('dateDepart', v)} type="date" />
              <Field label="Heure depart" value={dem.heureDepart} onChange={v => updateDem('heureDepart', v)} type="time" />
            </div>
            <div className="flex gap-3">
              <Field label="Date retour" value={dem.dateRetour} onChange={v => updateDem('dateRetour', v)} type="date" />
              <Field label="Heure retour" value={dem.heureRetour} onChange={v => updateDem('heureRetour', v)} type="time" />
            </div>
            <div className="flex gap-3">
              <Field label="Lieu depart" value={dem.lieuDepart} onChange={v => updateDem('lieuDepart', v)} />
              <Field label="Lieu retour" value={dem.lieuRetour} onChange={v => updateDem('lieuRetour', v)} />
            </div>
            <Field label="Nb demi-journees sur temps scolaire (max 10)" value={dem.nbJournees} onChange={v => updateDem('nbJournees', v)} type="number" />
          </div>

          {/* Composition du groupe */}
          <div className={cardCls}>
            <h3 className={cardTitle}>Composition du groupe</h3>
            {classes.map((c, i) => (
              <div key={i} className="flex gap-2 items-end">
                <Field label={i === 0 ? 'Classe' : ''} value={c.nom} onChange={v => updateClasseRow(i, 'nom', v)} placeholder="Ex: 5e3" />
                <Field label={i === 0 ? 'Effectif' : ''} value={c.effectif} onChange={v => updateClasseRow(i, 'effectif', v)} type="number" placeholder="30" />
                <Field label={i === 0 ? 'Participants' : ''} value={c.participants} onChange={v => updateClasseRow(i, 'participants', v)} type="number" placeholder="28" />
                {classes.length > 1 && <button onClick={() => setClasses(prev => prev.filter((_, j) => j !== i))} className={btnRemove}>✕</button>}
              </div>
            ))}
            <button onClick={() => setClasses(p => [...p, { nom: '', effectif: '', participants: '' }])} className={btnSmall}>+ Ajouter une classe</button>
          </div>

          {/* Contenu pedagogique */}
          <div className={cardCls}>
            <h3 className={cardTitle}>Contenu pedagogique</h3>
            <div>
              <label className={labelCls}>Domaines</label>
              <div className="flex flex-wrap gap-2">
                {DOMAINES.map(d => (
                  <label key={d} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={demDomaines.includes(d)} onChange={e => {
                      if (e.target.checked) setDemDomaines(p => [...p, d]);
                      else setDemDomaines(p => p.filter(x => x !== d));
                    }} className="accent-[var(--indigo)]" />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Disciplines concernees" value={dem.disciplines} onChange={v => updateDem('disciplines', v)} placeholder="SVT, Physique-Chimie..." />
            <div><label className={labelCls}>Objectifs</label><textarea value={dem.objectifs} onChange={e => updateDem('objectifs', e.target.value)} rows={2} className={inputCls} /></div>
            <div><label className={labelCls}>Liens projet etablissement</label><textarea value={dem.liens} onChange={e => updateDem('liens', e.target.value)} rows={2} className={inputCls} /></div>
            <div><label className={labelCls}>Description des activites</label><textarea value={dem.activites} onChange={e => updateDem('activites', e.target.value)} rows={2} className={inputCls} /></div>
            <div><label className={labelCls}>Travaux preparatoires</label><textarea value={dem.travauxPrepa} onChange={e => updateDem('travauxPrepa', e.target.value)} rows={2} className={inputCls} /></div>
            <div><label className={labelCls}>Restitution / evaluation</label><textarea value={dem.restitution} onChange={e => updateDem('restitution', e.target.value)} rows={2} className={inputCls} /></div>
            <div><label className={labelCls}>Dispositions eleves non-participants</label><textarea value={dem.nonParticipants} onChange={e => updateDem('nonParticipants', e.target.value)} rows={2} className={inputCls} /></div>
            <div className="flex gap-3">
              <Field label="Date prepa pedagogique" value={dem.datePrepa} onChange={v => updateDem('datePrepa', v)} type="date" />
              <Field label="Date bilan pedagogique" value={dem.dateBilan} onChange={v => updateDem('dateBilan', v)} type="date" />
            </div>
          </div>

          {/* Budget */}
          <div className={cardCls}>
            <h3 className={cardTitle}>Budget previsionnel</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase">Recettes</h4>
                <div className="flex gap-2">
                  <Field label="Nb familles" value={budget.nbFamilles + '' || ''} onChange={v => updateBudget('nbFamilles', +v || 0)} type="number" />
                  <Field label="x Montant" value={budget.montantFamille + '' || ''} onChange={v => updateBudget('montantFamille', +v || 0)} type="number" />
                </div>
                <Field label="Etablissement" value={budget.etablissement + '' || ''} onChange={v => updateBudget('etablissement', +v || 0)} type="number" />
                <Field label="Dons (FSE, MDL)" value={budget.dons + '' || ''} onChange={v => updateBudget('dons', +v || 0)} type="number" />
                <Field label="Commune" value={budget.subCommune + '' || ''} onChange={v => updateBudget('subCommune', +v || 0)} type="number" />
                <Field label="Conseil Departemental" value={budget.subDept + '' || ''} onChange={v => updateBudget('subDept', +v || 0)} type="number" />
                <Field label="Conseil Regional" value={budget.subRegion + '' || ''} onChange={v => updateBudget('subRegion', +v || 0)} type="number" />
                <Field label="Etat" value={budget.subEtat + '' || ''} onChange={v => updateBudget('subEtat', +v || 0)} type="number" />
                <Field label="Autres subventions" value={budget.subAutres + '' || ''} onChange={v => updateBudget('subAutres', +v || 0)} type="number" />
                <div className="p-2 rounded-lg bg-[var(--indigo-soft)] text-center text-sm font-semibold text-[var(--indigo)]">
                  Total Recettes : {totalRecettes.toFixed(2)} EUR
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase">Depenses</h4>
                <Field label="Bus" value={budget.depBus + '' || ''} onChange={v => updateBudget('depBus', +v || 0)} type="number" />
                <Field label="Train" value={budget.depTrain + '' || ''} onChange={v => updateBudget('depTrain', +v || 0)} type="number" />
                <Field label="Avion" value={budget.depAvion + '' || ''} onChange={v => updateBudget('depAvion', +v || 0)} type="number" />
                <Field label="Autres transport" value={budget.depTransportAutre + '' || ''} onChange={v => updateBudget('depTransportAutre', +v || 0)} type="number" />
                <Field label="Hebergement" value={budget.depHebergement + '' || ''} onChange={v => updateBudget('depHebergement', +v || 0)} type="number" />
                <Field label="Repas" value={budget.depRepas + '' || ''} onChange={v => updateBudget('depRepas', +v || 0)} type="number" />
                <Field label="Activites / Visites" value={budget.depActivites + '' || ''} onChange={v => updateBudget('depActivites', +v || 0)} type="number" />
                <Field label="Materiel pedagogique" value={budget.depMateriel + '' || ''} onChange={v => updateBudget('depMateriel', +v || 0)} type="number" />
                <Field label="Divers" value={budget.depDivers + '' || ''} onChange={v => updateBudget('depDivers', +v || 0)} type="number" />
                <div className="p-2 rounded-lg bg-[var(--indigo-soft)] text-center text-sm font-semibold text-[var(--indigo)]">
                  Total Depenses : {totalDepenses.toFixed(2)} EUR
                </div>
              </div>
            </div>
            <div className={`p-2 rounded-lg text-center text-sm font-bold ${totalRecettes - totalDepenses >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              Solde : {(totalRecettes - totalDepenses).toFixed(2)} EUR
            </div>
          </div>

          {/* Accompagnateurs */}
          <div className={cardCls}>
            <h3 className={cardTitle}>Accompagnateurs</h3>
            {accomps.map((a, i) => (
              <div key={i} className="flex gap-2 items-end">
                <Field label={i === 0 ? 'Nom Prenom' : ''} value={a.nom} onChange={v => updateAccompRow(i, 'nom', v)} placeholder="Nom Prenom" />
                <Field label={i === 0 ? 'Qualite' : ''} value={a.qualite} onChange={v => updateAccompRow(i, 'qualite', v)} placeholder="Enseignant, parent..." />
                <Field label={i === 0 ? 'Telephone' : ''} value={a.tel} onChange={v => updateAccompRow(i, 'tel', v)} placeholder="06 ..." />
                {accomps.length > 1 && <button onClick={() => setAccomps(prev => prev.filter((_, j) => j !== i))} className={btnRemove}>✕</button>}
              </div>
            ))}
            <button onClick={() => setAccomps(p => [...p, { nom: '', qualite: '', tel: '' }])} className={btnSmall}>+ Ajouter un accompagnateur</button>
          </div>

          {/* Eleves */}
          <div className={cardCls}>
            <h3 className={cardTitle}>Liste des eleves</h3>
            <p className="text-xs text-[var(--text-dim)]">Importez un CSV ou ajoutez manuellement. La colonne Tel. urgence est optionnelle (si vide, un espace sera reserve sur le PDF).</p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className={labelCls}>Importer un CSV</label>
                <input ref={csvRef} type="file" accept=".csv" onChange={e => { const f = e.target.files?.[0]; if (f) handleCSV(f); }} className="text-sm text-[var(--text-muted)]" />
              </div>
              <Field label="Classe(s)" value={dem.elevesClasse} onChange={v => updateDem('elevesClasse', v)} placeholder="Ex: 5e3" />
            </div>
            {eleves.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{eleves.length} eleves</p>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--indigo-soft)]">
                        <th className="px-2 py-1 text-left text-[var(--indigo)] w-8">#</th>
                        <th className="px-2 py-1 text-left text-[var(--indigo)]">Nom</th>
                        <th className="px-2 py-1 text-left text-[var(--indigo)]">Prenom</th>
                        <th className="px-2 py-1 text-left text-[var(--indigo)] w-14">Sexe</th>
                        <th className="px-2 py-1 text-left text-[var(--indigo)]">Tel. urgence</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {eleves.map((el, i) => (
                        <tr key={i} className={i % 2 === 0 ? '' : 'bg-[var(--surface-3)]'}>
                          <td className="px-2 py-1 font-medium text-[var(--text-dim)]">{i + 1}</td>
                          <td className="px-1 py-0.5"><input type="text" value={el.nom} onChange={e => updateEleve(i, 'nom', e.target.value)} className="w-full px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs" /></td>
                          <td className="px-1 py-0.5"><input type="text" value={el.prenom} onChange={e => updateEleve(i, 'prenom', e.target.value)} className="w-full px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs" /></td>
                          <td className="px-1 py-0.5">
                            <select value={el.sexe} onChange={e => updateEleve(i, 'sexe', e.target.value)} className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs">
                              <option value="M">M</option><option value="F">F</option>
                            </select>
                          </td>
                          <td className="px-1 py-0.5"><input type="tel" value={el.tel} onChange={e => updateEleve(i, 'tel', e.target.value)} placeholder="06 ..." className="w-full px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs" /></td>
                          <td className="px-1 py-0.5"><button onClick={() => setEleves(p => p.filter((_, j) => j !== i))} className={btnRemove}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <button onClick={() => setEleves(p => [...p, { nom: '', prenom: '', sexe: 'M', tel: '' }])} className={btnSmall}>+ Ajouter un eleve</button>
          </div>

          {/* Incidences */}
          <div className={cardCls}>
            <h3 className={cardTitle}>Incidences sur l'emploi du temps</h3>
            <textarea value={dem.incidences} onChange={e => updateDem('incidences', e.target.value)} rows={3} className={inputCls} placeholder="Classes et accompagnateurs impactes..." />
          </div>
        </div>
      )}

      {/* ═══ ACTIONS ═══ */}
      <div className="flex gap-3">
        <button onClick={() => generatePDF(true)} className={btnPrimary} style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-sm)' }}>
          Telecharger PDF
        </button>
        <button onClick={() => setShowHistory(true)} className="px-5 py-2.5 rounded-xl font-medium text-sm text-[var(--text-muted)] bg-[var(--surface-3)] border border-[var(--border)] transition-all hover:bg-[var(--border)]">
          Historique ({history.length})
        </button>
      </div>
      </div>{/* end left column */}

      {/* ── SPLITTER ── */}
      <div
        onMouseDown={onSplitterDown}
        className="shrink-0 w-2 cursor-col-resize flex items-center justify-center group self-stretch"
      >
        <div className="w-0.5 h-full min-h-[400px] rounded-full bg-[var(--border)] group-hover:bg-[var(--indigo)] transition-colors" />
      </div>

      {/* ── RIGHT: PDF Preview ── */}
      <div className="min-w-0 sticky top-4 self-start pl-2" style={{ width: `${100 - leftPct}%` }}>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="font-semibold text-sm text-[var(--indigo)] mb-2">Apercu</h3>
          {previewUrl ? (
            <iframe ref={iframeRef} src={previewUrl} className="w-full border border-[var(--border)] rounded-lg" style={{ height: 800 }} />
          ) : (
            <div className="w-full border border-dashed border-[var(--border)] rounded-lg bg-[var(--surface-3)] flex items-center justify-center" style={{ height: 800 }}>
              <p className="text-sm text-[var(--text-dim)]">Chargement...</p>
            </div>
          )}
        </div>
      </div>
      </div>{/* end splitter row */}

      {/* ═══ HISTORY MODAL ═══ */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowHistory(false)}>
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--text)]">Historique des documents</h2>
              <button onClick={() => setShowHistory(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg px-2">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {history.length === 0 ? (
                <p className="text-sm text-[var(--text-dim)] text-center py-8">Aucun document dans l'historique</p>
              ) : (
                <div className="space-y-1">
                  {history.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--surface-3)] cursor-pointer transition-colors group"
                      onClick={() => restoreEntry(entry)}
                    >
                      <div className={`shrink-0 w-2 h-2 rounded-full ${
                        entry.tab === 'captation' ? 'bg-blue-500' : entry.tab === 'sortie' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text)] truncate">{entry.label}</p>
                        <p className="text-xs text-[var(--text-dim)]">{entry.date}</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteEntry(entry.id); }}
                        className="opacity-0 group-hover:opacity-100 text-xs text-[var(--neg)] hover:bg-[var(--neg-soft)] px-2 py-1 rounded-lg transition-all"
                      >
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
