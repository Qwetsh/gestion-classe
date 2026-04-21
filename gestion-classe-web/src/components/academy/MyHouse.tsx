import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { calculateHousePoints, type HousePoints, type HouseId } from '../../lib/academyQueries';
import { BokehField, Ornament, GoldParticles, RollingNumber } from './Atmosphere';
import { HouseCrest } from './HouseCrest';
import { HOUSE_DATA } from './houses';
import './tokens.css';

interface MyHouseProps {
  houseId: HouseId;
  classId: string;
}

export function MyHouse({ houseId, classId }: MyHouseProps) {
  const [housePoints, setHousePoints] = useState<HousePoints[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [housemates, setHousemates] = useState<string[]>([]);

  const myHouse = HOUSE_DATA[houseId];

  const loadPoints = useCallback(async () => {
    const pts = await calculateHousePoints(classId);
    setHousePoints(pts);
  }, [classId]);

  // Load housemates
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('academy_assignments')
        .select('student_id, students!inner(pseudo)')
        .eq('class_id', classId)
        .eq('house', houseId);
      if (data) {
        setHousemates(data.map((d: any) => (d.students as any).pseudo));
      }
    })();
  }, [classId, houseId]);

  // Initial load + reveal animation
  useEffect(() => {
    loadPoints();
    const t = setTimeout(() => {
      setRevealed(true);
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 2500);
    }, 400);
    return () => clearTimeout(t);
  }, [loadPoints]);

  // Supabase Realtime — listen for bonus reveals
  useEffect(() => {
    const channel = supabase
      .channel('academy-bonus-realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'academy_house_bonuses',
      }, (payload) => {
        // When a bonus becomes visible, reload points
        if (payload.new?.visible === true && payload.old?.visible === false) {
          loadPoints();
        }
      })
      .subscribe();

    // Polling fallback every 15s
    const poll = setInterval(loadPoints, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [loadPoints]);

  const leaderboard = useMemo(() =>
    [...housePoints].sort((a, b) => b.total_points - a.total_points),
    [housePoints]);

  const myPoints = housePoints.find(h => h.house === houseId)?.total_points ?? 0;
  const myRank = leaderboard.findIndex(h => h.house === houseId) + 1 || 1;
  const others = leaderboard.filter(h => h.house !== houseId);

  return (
    <div className="academy-root" style={{
      width: '100%', minHeight: 500,
      background: `radial-gradient(ellipse at 50% 0%, oklch(0.18 0.06 ${getHue(houseId)}) 0%, oklch(0.06 0.01 50) 75%)`,
      position: 'relative', overflow: 'hidden',
      fontFamily: 'var(--font-body)', color: 'var(--parchment)',
    }}>
      <BokehField density={50} houseColor={myHouse.c1} houseColorLight={myHouse.cInkLight} />

      <div style={{ position: 'relative', zIndex: 2, padding: '40px 20px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Header */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.3em', color: 'var(--gold-deep)', textTransform: 'uppercase', textAlign: 'center' }}>
          Le Choixpeau a parlé
        </div>
        <Ornament variant="diamond" color="var(--gold-shadow)" width={160} />

        <h1 style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 500,
          fontSize: 20, margin: '8px 0 4px', textAlign: 'center',
          opacity: revealed ? 1 : 0, transition: 'opacity 0.8s ease 0.2s',
        }}>
          Ta Maison est la
        </h1>

        {/* Crest reveal */}
        <div style={{
          position: 'relative', marginTop: 8,
          transform: revealed ? 'scale(1) rotate(0)' : 'scale(0.2) rotate(-30deg)',
          opacity: revealed ? 1 : 0,
          transition: 'transform 1.4s cubic-bezier(0.22, 0.8, 0.25, 1) 0.3s, opacity 0.8s ease 0.3s',
        }}>
          <HouseCrest house={myHouse} size={180} glow />
          <GoldParticles active={showParticles} count={40} />
        </div>

        {/* House name */}
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 42, fontStyle: 'italic', fontWeight: 500,
          margin: '4px 0 0', lineHeight: 1,
          background: `linear-gradient(180deg, var(--gold-bright) 0%, ${myHouse.c1} 100%)`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.9s cubic-bezier(0.22, 0.8, 0.25, 1) 0.8s',
        }}>
          {myHouse.name}
        </h2>

        {/* Motto */}
        <div style={{
          fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 14,
          color: 'var(--parchment-dark)', marginTop: 6,
          opacity: revealed ? 1 : 0, transition: 'opacity 0.8s ease 1.2s',
        }}>
          « {myHouse.mottoFr} » · {myHouse.virtue}
        </div>

        {/* Points card */}
        <div style={{
          marginTop: 28, padding: '16px 24px',
          background: 'oklch(0 0 0 / 0.35)', border: '1px solid var(--gold-shadow)',
          textAlign: 'center', width: '100%', maxWidth: 300,
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.8s ease 1.4s',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--gold-deep)', textTransform: 'uppercase' }}>
            Points de ta Maison
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 64, fontStyle: 'italic', fontWeight: 500,
            lineHeight: 1, color: 'var(--gold-bright)',
            marginTop: 4, textShadow: '0 0 30px oklch(0.78 0.12 85 / 0.5)',
          }}>
            <RollingNumber value={myPoints} duration={2500} />
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16,
            color: 'var(--gold-bright)', marginTop: 6,
          }}>
            {['Ier', 'IIe', 'IIIe', 'IVe'][myRank - 1]} rang sur IV
          </div>
        </div>

        {/* Other houses */}
        <div style={{
          marginTop: 24, width: '100%', maxWidth: 360,
          opacity: revealed ? 1 : 0, transition: 'opacity 0.8s ease 1.8s',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--gold-deep)', textAlign: 'center', textTransform: 'uppercase', marginBottom: 10 }}>
            Les trois autres Maisons
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: 6 }}>
            {others.map(hp => {
              const house = HOUSE_DATA[hp.house];
              const delta = myPoints - hp.total_points;
              const rank = leaderboard.findIndex(x => x.house === hp.house) + 1;
              return (
                <div key={hp.house} style={{
                  flex: 1, textAlign: 'center', padding: '10px 4px',
                  background: 'oklch(0 0 0 / 0.35)',
                  border: '1px solid oklch(0.35 0.04 60 / 0.6)',
                }}>
                  <div style={{ transform: 'scale(0.5)', margin: '-18px auto', display: 'inline-block' }}>
                    <HouseCrest house={house} size={60} ornate={false} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13, marginTop: 4, lineHeight: 1 }}>
                    {house.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic', color: 'var(--gold)', lineHeight: 1, marginTop: 4 }}>
                    <RollingNumber value={hp.total_points} />
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    color: delta >= 0 ? 'oklch(0.70 0.10 140)' : 'oklch(0.62 0.14 30)',
                    letterSpacing: '0.1em', marginTop: 3,
                  }}>
                    {delta >= 0 ? `+${delta}` : delta} · {['Ier', 'IIe', 'IIIe', 'IVe'][rank - 1]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Housemates */}
        {housemates.length > 0 && (
          <div style={{
            marginTop: 24, width: '100%', maxWidth: 360,
            opacity: revealed ? 1 : 0, transition: 'opacity 0.8s ease 2s',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--gold-deep)', textAlign: 'center', textTransform: 'uppercase', marginBottom: 10 }}>
              Tes camarades de Maison ({housemates.length})
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
              padding: '12px 14px', background: 'oklch(0 0 0 / 0.3)',
              border: '1px solid oklch(0.35 0.04 60 / 0.4)',
            }}>
              {housemates.map(name => (
                <div key={name} style={{
                  padding: '5px 10px',
                  background: 'oklch(0.15 0.03 50 / 0.8)',
                  border: `1px solid ${myHouse.c1}`,
                  fontFamily: 'var(--font-display)', fontStyle: 'italic',
                  fontSize: 13, color: 'var(--parchment)',
                }}>
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live indicator */}
        <div style={{
          marginTop: 18, display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.25em',
          color: 'var(--gold-deep)', textTransform: 'uppercase',
          opacity: revealed ? 1 : 0, transition: 'opacity 0.8s ease 2.2s',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'oklch(0.70 0.15 140)',
            boxShadow: '0 0 6px oklch(0.70 0.15 140)',
            animation: 'academy-pulse 2s ease-in-out infinite',
          }} />
          Mise à jour en direct
        </div>
      </div>
    </div>
  );
}

function getHue(houseId: HouseId): number {
  switch (houseId) {
    case 'gryffondor': return 28;
    case 'serpentard': return 165;
    case 'serdaigle': return 245;
    case 'poufsouffle': return 85;
  }
}
