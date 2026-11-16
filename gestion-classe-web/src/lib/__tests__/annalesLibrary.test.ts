import { describe, expect, it } from 'vitest';
import { brevets, type Brevet } from '../brevets';
import { annaleLabel, filterAnnales, groupAnnales, guessProgramme, matiereOf, programmeOf, type AnnaleItem } from '../annalesLibrary';

const b = (over: Partial<AnnaleItem>): AnnaleItem => ({
  code: '', annee: 2024, centre: 'Métropole', theme: 'Sujet', points: 25, url: `u-${Math.random()}`, tailleKo: 0, matiere: 'SVT', ...over,
});

describe('annalesLibrary', () => {
  it('classe chaque sujet SVT du catalogue dans un thème du programme', () => {
    const svt = brevets.filter((x) => matiereOf(x) === 'SVT');
    expect(svt.length).toBeGreaterThan(0);
    expect(svt.filter((x) => programmeOf(x) === null).map((x) => x.code)).toEqual([]);
  });

  it('le thème choisi à l’ajout passe avant la devinette du titre', () => {
    expect(programmeOf(b({ theme: 'Un séisme au Japon' }))).toBe('planete');
    expect(programmeOf(b({ theme: 'Un séisme au Japon', programme: 'corps' }))).toBe('corps');
    expect(guessProgramme('Les moyens de prévention des IST')).toBe('corps');
    expect(guessProgramme('En quête de fraîcheur')).toBeNull();
  });

  it('range par thème (ordre du programme, « À classer » en dernier) et par session', () => {
    const items = [
      b({ theme: 'Volcans', annee: 2022 }),
      b({ theme: 'Génétique et espèce', annee: 2025 }),
      b({ theme: 'Tsunami', annee: 2025 }),
      b({ theme: 'Mystère' }),
    ];
    const byTheme = groupAnnales(items, 'programme');
    expect(byTheme.map((s) => s.key)).toEqual(['planete', 'vivant', 'autre']);
    expect(byTheme[0].items.map((x) => x.theme)).toEqual(['Tsunami', 'Volcans']);
    expect(groupAnnales(items, 'session').map((s) => s.label)).toEqual(['Session 2025', 'Session 2024', 'Session 2022']);
  });

  it('prend le centre pour titre quand le catalogue n’a qu’un intitulé de matière', () => {
    const maths: Brevet = { ...b({}), matiere: 'Maths', centre: 'Asie', theme: 'Mathématiques · juin' };
    expect(annaleLabel(maths)).toEqual({ title: 'Asie', detail: 'juin' });
    const fr: Brevet = { ...b({}), matiere: 'Français', centre: 'Asie', theme: 'Français grammaire & compréhension · juin' };
    expect(annaleLabel(fr)).toEqual({ title: 'Asie', detail: 'grammaire & compréhension · juin' });
    expect(annaleLabel(b({ theme: 'La coccinelle asiatique', centre: 'Asie' }))).toEqual({ title: 'La coccinelle asiatique', detail: 'Asie' });
  });

  it('cherche sans accents, tous les mots, année comprise', () => {
    const items = [b({ theme: 'Le Chili, une région sismique', annee: 2023 }), b({ theme: 'Séisme en Méditerranée', annee: 2021 })];
    expect(filterAnnales(items, 'seisme').map((x) => x.annee)).toEqual([2021]);
    expect(filterAnnales(items, 'region 2023')).toHaveLength(1);
    expect(filterAnnales(items, '  ')).toHaveLength(2);
  });
});
