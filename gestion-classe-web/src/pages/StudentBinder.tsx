/**
 * Classeur des élèves (PLAN_classeur_eleves.md, lot 2) : page publique `/classeur/c/<jeton>`, celle
 * du lien posé dans Pronote. Sans compte ni code : le jeton désigne une classe, et le serveur ne
 * rend que ce que le professeur lui a ouvert (components/binder/StudentBinderView.tsx).
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StudentBinderView } from '../components/binder/StudentBinderView';

export function StudentBinder() {
  const { token = '' } = useParams();
  const binderKey = useMemo(() => ({ token }), [token]);
  const [className, setClassName] = useState('');

  // L'adresse porte le jeton : ni indexation, ni adresse transmise aux sites ouverts depuis une fiche
  useEffect(() => {
    const metas = [['robots', 'noindex, nofollow'], ['referrer', 'no-referrer']].map(([name, content]) => {
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
      return meta;
    });
    return () => { for (const meta of metas) meta.remove(); };
  }, []);
  useEffect(() => {
    const before = document.title;
    document.title = className ? `Classeur de SVT — ${className}` : 'Classeur de SVT';
    return () => { document.title = before; };
  }, [className]);

  return <StudentBinderView binderKey={binderKey} onClassName={setClassName} />;
}
