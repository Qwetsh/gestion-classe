import type { HouseData } from './houses';
import type { HouseId } from '../../lib/academyQueries';

const CREST_IMAGES: Record<HouseId, string> = {
  salamandre: '/gestion-classe/academy/gryffondor.png',
  vouivre: '/gestion-classe/academy/serpentard.png',
  zephyr: '/gestion-classe/academy/serdaigle.png',
  taisson: '/gestion-classe/academy/pouffesouffle.png',
};

export function HouseCrest({ house, size = 140, glow = false }: {
  house: HouseData;
  size?: number;
  ornate?: boolean;
  glow?: boolean;
}) {
  return (
    <div style={{
      width: size,
      height: size * 1.15,
      filter: glow ? `drop-shadow(0 0 18px ${house.c1}) drop-shadow(0 0 6px var(--gold))` : 'none',
    }}>
      <img
        src={CREST_IMAGES[house.id]}
        alt={`Blason ${house.name}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
