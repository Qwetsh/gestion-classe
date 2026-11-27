import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, RotateCw, Search } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { classTone } from '../lib/classColors';
import {
  fetchPreviewClasses,
  filterPreviewClasses,
  studentSpaceUrl,
  type PreviewClass,
  type PreviewStudent,
} from '../lib/studentPreview';
import '../styles/vision-eleve.css';

/**
 * « Vision élève » : l'espace élève (/eleve) tel qu'il s'affiche sur un téléphone, dans un cadre à la
 * taille d'un écran de téléphone, avec à côté la liste des codes de toutes les classes. Un clic sur
 * un élève ouvre son espace, déjà connecté ; on peut aussi taper un code dans le téléphone.
 *
 * Le cadre charge la vraie page élève (même adresse, mêmes fonctions de la base) : ce qu'on y voit
 * est ce que voit l'élève. Le professeur étant connecté, sa visite n'est pas comptée comme une
 * connexion de l'élève (migration 100).
 */
export function StudentPreview() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<PreviewClass[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState<PreviewStudent | null>(null);
  /** Change à chaque ouverture : recharge le cadre même pour le même élève. */
  const [frameKey, setFrameKey] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchPreviewClasses(user.id)
      .then((list) => { if (!cancelled) setClasses(list); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [user]);

  const shown = useMemo(() => filterPreviewClasses(classes ?? [], query), [classes, query]);
  const searching = query.trim() !== '';
  const total = useMemo(() => (classes ?? []).reduce((n, c) => n + c.students.length, 0), [classes]);

  const base = import.meta.env.BASE_URL;
  const frameUrl = current ? studentSpaceUrl(base, current.code) : `${base.replace(/\/$/, '')}/eleve`;

  const open = (student: PreviewStudent) => {
    setCurrent(student);
    setFrameKey((k) => k + 1);
  };
  const reset = () => {
    setCurrent(null);
    setFrameKey((k) => k + 1);
  };
  const toggle = (classId: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(classId)) next.delete(classId); else next.add(classId);
    return next;
  });

  return (
    <Layout fluid>
      <div className="ve-page">
        <div className="ve-head">
          <div className="breadcrumb">
            <Link to="/" style={{ color: 'var(--text-muted)', fontSize: 12 }}>Accueil</Link>
            <span style={{ margin: '0 6px', color: 'var(--text-dim)' }}>›</span>
            <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 500 }}>Vision élève</span>
          </div>
          <h1 className="page-title">Vision élève</h1>
          <p className="ve-head__lead">
            L'espace élève tel que l'élève le voit sur son téléphone. Ce que vous y faites (bonus choisi, réponses) compte pour l'élève.
          </p>
        </div>

        <div className="ve-body">
          <aside className="ve-list" aria-label="Codes des élèves">
            <label className="ve-search">
              <Search size={14} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Élève, code ou classe"
                aria-label="Chercher un élève, un code ou une classe"
              />
            </label>

            {loadError && <p className="ve-empty">Impossible de charger les élèves. Rechargez la page.</p>}
            {!loadError && classes === null && <p className="ve-empty">Chargement…</p>}
            {classes !== null && total === 0 && <p className="ve-empty">Aucun élève avec un code de connexion.</p>}
            {classes !== null && total > 0 && shown.length === 0 && <p className="ve-empty">Aucun élève ne correspond.</p>}

            {shown.length > 0 && <div className="ve-classes">
              {shown.map((c) => {
                const tone = classTone(c.name);
                const isOpen = searching || !collapsed.has(c.id);
                return (
                  <section key={c.id} className="ve-class">
                    <button type="button" className="ve-class__head" onClick={() => toggle(c.id)} aria-expanded={isOpen}>
                      <span className="ve-class__chip" style={{ background: tone.soft, color: tone.ink }}>{c.name}</span>
                      <span className="ve-class__count">{c.students.length}</span>
                      <span className={`ve-class__chevron${isOpen ? ' is-open' : ''}`} aria-hidden>▶</span>
                    </button>
                    {isOpen && (
                      <ul className="ve-students">
                        {c.students.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              className={`ve-student${current?.id === s.id ? ' is-current' : ''}`}
                              onClick={() => open(s)}
                              aria-current={current?.id === s.id ? 'true' : undefined}
                            >
                              <span className="ve-student__name">{s.pseudo}</span>
                              {s.isWitness && <span className="ve-student__witness" title="Élève témoin : voit tout ce que la classe peut ouvrir">témoin</span>}
                              <span className="ve-student__code">{s.code}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>}
          </aside>

          <div className="ve-stage">
            <div className="ve-stage__bar">
              <span className="ve-stage__who">
                {current ? <><strong>{current.pseudo}</strong> <span className="ve-stage__code">{current.code}</span></> : 'Aucun élève choisi : tapez un code dans le téléphone'}
              </span>
              <span className="ve-stage__actions">
                {current && <button type="button" className="ve-btn" onClick={reset}>Autre code</button>}
                <button type="button" className="ve-btn" onClick={() => setFrameKey((k) => k + 1)} title="Recharger l'espace élève">
                  <RotateCw size={14} aria-hidden /> Recharger
                </button>
                <a className="ve-btn" href={frameUrl} target="_blank" rel="noopener noreferrer" title="Ouvrir l'espace élève dans un nouvel onglet">
                  <ExternalLink size={14} aria-hidden /> Onglet
                </a>
              </span>
            </div>

            <div className="ve-phone">
              <div className="ve-phone__notch" aria-hidden />
              <iframe
                key={frameKey}
                className="ve-phone__screen"
                src={frameUrl}
                title={current ? `Espace élève de ${current.pseudo}` : 'Espace élève'}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
