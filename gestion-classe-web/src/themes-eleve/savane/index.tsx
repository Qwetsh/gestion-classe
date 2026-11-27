import type { CSSProperties } from 'react';
import { vars } from '../shared';
import './theme.css';

/**
 * Thème « Savane » : la fin d'après-midi dans la savane, en ombres chinoises sur un ciel doré.
 * Plans, du fond vers l'avant : ciel, soleil, oiseaux, collines, acacias et animaux posés sur le
 * sol (deux girafes, une éléphante et son petit), herbes en deux rangs.
 * Mouvement : les girafes balancent lentement le cou, les éléphants remuent l'oreille et la queue,
 * des oiseaux traversent le ciel, les herbes ondulent. Au toucher : un éléphant lève la trompe et
 * barrit (sa mère ou son petit l'imite), une girafe baisse la tête pour saluer. Au défilement, la scène s'en va par le haut,
 * les plans proches plus vite que les plans lointains ; chaque plan porte donc son propre sol, qui
 * recouvre les plans situés derrière lui.
 */

function Giraffe({ style, delay = '0s' }: { style: CSSProperties; delay?: string }) {
  return (
    <svg viewBox="0 0 124 200" className="sa-animal" style={style} data-tap="salut" data-tap-ms="3800">
      <path d="M94 112L96 197H102L102 114ZM103 114L108 197H114L111 112ZM60 112L58 197H64L67 114ZM70 114L72 197H78L77 112Z" />
      <path d="M56 100Q58 89 72 91L104 97Q115 100 113 112Q110 123 98 123L66 123Q53 120 56 100Z" />
      <g className="sa-tail" style={vars({ '--delay': delay })}>
        <path d="M111 103Q121 116 117 138" fill="none" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M117 136L113 150 121 146Z" />
      </g>
      <g className="sa-neck" style={vars({ '--delay': delay })}>
        <path d="M56 106L33 35 44 28 73 97Z" />
        <path d="M44 29Q41 18 30 20L11 31Q7 35 14 37L34 37Q43 37 44 29Z" />
        <path d="M42 23L53 18 47 28Z" />
        <path d="M35 21L34 11M41 19L42 9" fill="none" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="34" cy="10" r="2" /><circle cx="42" cy="8" r="2" />
      </g>
    </svg>
  );
}

/** Un éléphant de profil, tourné vers la droite : dos rond, grande oreille, trompe recourbée. */
function Elephant({ style, delay = '0s' }: { style: CSSProperties; delay?: string }) {
  return (
    <svg viewBox="0 0 180 120" className="sa-animal" style={style} data-tap="barrit" data-tap-ms="2800">
      {/* Pattes du côté opposé, un peu en retrait */}
      <path className="sa-far" d="M64 78H80L79 114H65ZM92 80H108L106 114H92Z" />
      <g className="sa-etail" style={vars({ '--delay': delay })}>
        <path d="M29 46C20 56 19 68 23 80" fill="none" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M23 78L19 91 27 88Z" />
      </g>
      <path d="M28 44C36 26 70 20 96 24C108 15 128 13 140 23C150 30 155 42 153 54L140 62L133 65C129 71 124 74 119 75L121 114H104L102 84C90 90 70 90 58 84L58 114H40L36 80C28 72 24 58 28 44Z" />
      {/* La trompe, à part : elle se balance, et se lève pour barrir */}
      <path className="sa-trunk" style={vars({ '--delay': delay })} d="M138 24C151 31 158 52 160 76C161 88 158 96 154 100C151 104 158 107 164 103L167 109C158 117 143 112 145 98C147 84 146 71 140 62C136 52 134 36 138 24Z" />
      <g className="sa-toot" transform="translate(174 -26) rotate(-62)" fill="none" strokeWidth="2.6" strokeLinecap="round">
        <path d="M0 -7q5 7 0 14" /><path d="M7 -12q8 12 0 24" /><path d="M14 -17q11 17 0 34" />
      </g>
      <path className="sa-ear" style={vars({ '--delay': delay })} d="M112 25C98 25 91 40 95 56C98 69 110 73 118 62C125 52 123 35 112 25Z" />
      <path className="sa-tusk" d="M139 63C144 73 153 74 158 67" fill="none" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

function Acacia({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 220 160" className="sa-tree" style={style}>
      <g fill="none" strokeLinecap="round">
        <path d="M104 160Q109 122 96 92" strokeWidth="8" />
        <path d="M106 130Q124 104 144 88M99 106Q84 92 68 84M100 100Q104 78 112 60" strokeWidth="4.5" />
      </g>
      <ellipse cx="64" cy="72" rx="52" ry="13" /><ellipse cx="130" cy="60" rx="64" ry="16" />
      <ellipse cx="178" cy="76" rx="36" ry="11" /><ellipse cx="108" cy="47" rx="46" ry="12" /><ellipse cx="154" cy="45" rx="30" ry="9" />
    </svg>
  );
}

const BIRDS = [
  { x: 0, y: 14, s: 1 }, { x: 26, y: 0, s: 0.8 }, { x: 44, y: 22, s: 0.9 }, { x: 70, y: 8, s: 0.7 }, { x: 88, y: 26, s: 0.75 },
];

export default function SavaneScene() {
  return (
    <>
      <div className="el-layer sa-sky" style={vars({ top: '0px', '--k': 0.3 })} />

      <div className="el-layer sa-sunlayer" style={vars({ top: '0px', '--k': 0.34, '--kx': 3 })}>
        <div className="el-stage"><div className="sa-sun" /></div>
      </div>

      <div className="el-layer sa-birds" style={vars({ top: '0px', '--k': 0.38, '--kx': 4 })}>
        <div className="sa-flock">
          {BIRDS.map((b, i) => (
            <svg key={i} viewBox="0 0 22 10" className="sa-bird" style={vars({ left: `${b.x}px`, top: `${b.y}px`, width: `${22 * b.s}px`, '--i': i })}>
              <path d="M1 8Q6 1 11 7Q16 1 21 8" />
            </svg>
          ))}
        </div>
      </div>

      <div className="el-layer sa-hills" style={vars({ top: '138px', '--k': 0.5, '--kx': 5 })}>
        <svg viewBox="0 0 400 44" preserveAspectRatio="none" width="100%" height="44">
          <path d="M0 44V26Q60 6 120 20T250 14T400 22V44Z" fill="#F2A75F" />
          <path d="M0 44V34Q80 18 160 30T320 26T400 32V44Z" fill="#E08A42" />
        </svg>
      </div>

      <div className="el-layer sa-life" style={vars({ top: '0px', '--k': 0.7, '--kx': 9 })}>
        <div className="sa-ground" />
        <div className="el-stage">
          <Acacia style={{ left: -48, top: 34, width: 204 }} />
          <Acacia style={{ right: -22, top: 112, width: 96 }} />
          <Elephant style={{ left: 138, top: 122, width: 92 }} />
          <Elephant style={{ left: 104, top: 152, width: 44 }} delay="-2s" />
          <Giraffe style={{ right: 56, top: 56, width: 76 }} />
          <Giraffe style={{ right: 6, top: 98, width: 50 }} delay="-3s" />
        </div>
      </div>

      <div className="el-layer sa-grass sa-grass--back" style={vars({ top: '158px', '--k': 0.8, '--kx': 13 })} />
      <div className="el-layer sa-grass sa-grass--front" style={vars({ top: '166px', '--k': 0.92, '--kx': 20 })} />
    </>
  );
}
