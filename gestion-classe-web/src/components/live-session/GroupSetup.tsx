import { useState } from 'react';
import { useGroupSession } from '../../contexts/GroupSessionContext';

export function GroupSetup() {
  const {
    selectedClass, students, templates, sessionName, tempCriteria, tempGroups,
    academyMode, academyCoefficient, epreuveIntent,
    loading, error,
    setSessionName, applyTemplate, addCriteria, removeCriteria,
    addGroup, removeGroup, toggleMember, randomizeGroups,
    setAcademyCoefficient,
    startGrading, goBack, cancelFlow,
  } = useGroupSession();

  const [newLabel, setNewLabel] = useState('');
  const [newPoints, setNewPoints] = useState('');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [randomCount, setRandomCount] = useState('3');
  const [showRandom, setShowRandom] = useState(false);

  const assignedIds = new Set(tempGroups.flatMap(g => g.memberIds));
  const unassigned = students.filter(s => !assignedIds.has(s.id));
  const maxPoints = tempCriteria.reduce((sum, c) => sum + c.max_points, 0);

  const canStart = sessionName.trim() && tempCriteria.length > 0 && tempGroups.length > 0
    && tempGroups.every(g => g.memberIds.length > 0);

  const handleAddCriteria = () => {
    const pts = parseFloat(newPoints);
    if (newLabel.trim() && pts > 0) {
      addCriteria(newLabel.trim(), pts);
      setNewLabel('');
      setNewPoints('');
    }
  };

  const handleRandomize = () => {
    const n = parseInt(randomCount);
    if (n > 0) {
      randomizeGroups(n);
      setShowRandom(false);
    }
  };

  // Theme
  const hp = epreuveIntent || academyMode;
  const bgMain = hp ? '#1a1410' : 'var(--bg)';
  const bgCard = hp ? '#251c15' : 'var(--surface)';
  const bgMuted = hp ? '#1e1712' : 'var(--surface-3)';
  const bgCardBorder = hp ? '#3a2e22' : 'var(--border)';
  const textMain = hp ? '#e8dcc8' : 'var(--text)';
  const textDim = hp ? '#8a7a66' : 'var(--text-dim)';
  const textMuted = hp ? '#6a5c4e' : 'var(--text-muted)';
  const goldAccent = '#d4a843';
  const accentColor = hp ? goldAccent : 'var(--pos)';
  const accentSoft = hp ? '#2e1a08' : 'var(--pos-soft)';
  const indigoColor = hp ? goldAccent : 'var(--indigo)';
  const indigoSoft = hp ? '#2a2018' : 'var(--indigo-soft)';
  const fontDisplay = hp ? "'Cormorant Garamond', Georgia, serif" : 'inherit';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bgMain }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        color: '#fff',
        background: hp ? 'linear-gradient(135deg, #2a1f14, #1a1410)' : 'var(--gradient-success)',
        borderBottom: hp ? '1px solid #3a2e22' : 'none',
      }}>
        <button onClick={goBack} style={{
          color: hp ? goldAccent : 'rgba(255,255,255,0.8)',
          fontSize: 14, fontWeight: 500,
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: fontDisplay,
        }}>← Retour</button>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontWeight: 700, fontSize: 17, margin: 0, fontFamily: fontDisplay, color: hp ? '#e8dcc8' : '#fff' }}>
            {hp ? '⚙ Configuration' : 'Configuration'}
          </h1>
          <p style={{ color: hp ? '#8a7a66' : 'rgba(255,255,255,0.7)', fontSize: 11, margin: '2px 0 0', fontFamily: fontDisplay }}>
            {selectedClass?.name}
          </p>
        </div>
        <button onClick={cancelFlow} style={{
          color: hp ? '#6a5c4e' : 'rgba(255,255,255,0.8)',
          fontSize: 14, fontWeight: 500,
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: fontDisplay,
        }}>Annuler</button>
      </div>

      {error && (
        <div style={{
          margin: '8px 16px 0', padding: 8,
          background: hp ? '#3a1515' : 'var(--neg-soft)',
          color: hp ? '#f87171' : 'var(--neg)',
          borderRadius: 8, fontSize: 12,
        }}>{error}</div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Session name */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: textMain, display: 'block', marginBottom: 4, fontFamily: fontDisplay }}>
            Nom de la séance
          </label>
          <input
            value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            placeholder={hp ? 'Ex: Épreuve de potions' : 'Ex: Dissection sardine'}
            style={{
              width: '100%', padding: 12,
              border: `1px solid ${bgCardBorder}`,
              background: bgCard, color: textMain,
              borderRadius: 10, fontSize: 16,
              fontFamily: fontDisplay,
            }}
          />
        </div>

        {/* Criteria */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: textMain, fontFamily: fontDisplay }}>Critères de notation</label>
            <span style={{ fontSize: 12, fontWeight: 700, color: accentColor, fontFamily: fontDisplay }}>Total: {maxPoints} pts</span>
          </div>

          {/* Templates */}
          {templates.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  style={{
                    flexShrink: 0, padding: '6px 12px', fontSize: 12, fontWeight: 500,
                    background: accentSoft, color: accentColor,
                    borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: fontDisplay,
                  }}
                >
                  {t.name} ({t.criteria.reduce((s, c) => s + c.max_points, 0)}pts)
                </button>
              ))}
            </div>
          )}

          {/* Criteria list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {tempCriteria.map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: 8,
                background: bgMuted, borderRadius: 8,
                border: hp ? `1px solid ${bgCardBorder}` : 'none',
              }}>
                <span style={{ flex: 1, fontSize: 13, color: textMain, fontFamily: fontDisplay }}>{c.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: accentColor, fontFamily: fontDisplay }}>{c.max_points}pts</span>
                <button onClick={() => removeCriteria(i)} style={{
                  color: '#dc2626', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
                }}>✕</button>
              </div>
            ))}
          </div>

          {/* Add criteria */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Critère..."
              style={{
                flex: 1, padding: 8,
                border: `1px solid ${bgCardBorder}`,
                background: bgCard, color: textMain,
                borderRadius: 8, fontSize: 13, fontFamily: fontDisplay,
              }}
              onKeyDown={e => e.key === 'Enter' && handleAddCriteria()}
            />
            <input
              value={newPoints}
              onChange={e => setNewPoints(e.target.value)}
              placeholder="Pts"
              type="number" step="0.5" min="0"
              style={{
                width: 56, padding: 8, textAlign: 'center',
                border: `1px solid ${bgCardBorder}`,
                background: bgCard, color: textMain,
                borderRadius: 8, fontSize: 13,
              }}
              onKeyDown={e => e.key === 'Enter' && handleAddCriteria()}
            />
            <button
              onClick={handleAddCriteria}
              disabled={!newLabel.trim() || !newPoints}
              style={{
                padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 14,
                background: accentColor, borderRadius: 8, border: 'none', cursor: 'pointer',
                opacity: (!newLabel.trim() || !newPoints) ? 0.4 : 1,
              }}
            >+</button>
          </div>
        </div>

        {/* Academy coefficient */}
        {academyMode && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: textMain, display: 'block', marginBottom: 4, fontFamily: fontDisplay }}>
              Coefficient Académie
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12,
              background: bgMuted, borderRadius: 10,
              border: hp ? `1px solid ${bgCardBorder}` : 'none',
            }}>
              <span style={{ fontSize: 12, color: textDim, fontFamily: fontDisplay }}>🏰 Maisons créées automatiquement</span>
              <span style={{ fontSize: 12, color: textMuted, marginLeft: 'auto' }}>×</span>
              <input
                type="number" min="0" max="5" step="0.5"
                value={academyCoefficient}
                onChange={e => setAcademyCoefficient(parseFloat(e.target.value) || 1)}
                style={{
                  width: 56, padding: 6, textAlign: 'center',
                  border: `1px solid ${bgCardBorder}`,
                  background: bgCard, color: textMain,
                  borderRadius: 8, fontSize: 13, fontWeight: 700,
                }}
              />
            </div>
          </div>
        )}

        {/* Groups */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: textMain, fontFamily: fontDisplay }}>
              {academyMode ? 'Maisons' : 'Groupes'} ({tempGroups.length})
            </label>
            {!academyMode && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowRandom(true)}
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 500,
                    background: indigoSoft, color: indigoColor,
                    borderRadius: 20, border: 'none', cursor: 'pointer',
                  }}
                >Aléatoire</button>
                <button
                  onClick={() => addGroup(`Groupe ${tempGroups.length + 1}`)}
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 500,
                    background: accentSoft, color: accentColor,
                    borderRadius: 20, border: 'none', cursor: 'pointer',
                  }}
                >+ Groupe</button>
              </div>
            )}
          </div>

          {/* Random modal */}
          {showRandom && (
            <div style={{
              marginBottom: 12, padding: 12,
              background: indigoSoft, borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 13, color: textMain }}>Élèves par groupe:</span>
              <input
                value={randomCount}
                onChange={e => setRandomCount(e.target.value)}
                type="number" min="1"
                style={{
                  width: 48, padding: 6, textAlign: 'center',
                  border: `1px solid ${bgCardBorder}`,
                  background: bgCard, color: textMain,
                  borderRadius: 8, fontSize: 13,
                }}
              />
              <button onClick={handleRandomize} style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#fff',
                background: indigoColor, borderRadius: 8, border: 'none', cursor: 'pointer',
              }}>OK</button>
              <button onClick={() => setShowRandom(false)} style={{
                fontSize: 12, color: textDim, border: 'none', background: 'none', cursor: 'pointer',
              }}>✕</button>
            </div>
          )}

          {/* Group tabs */}
          {tempGroups.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
              {tempGroups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupId(g.id === activeGroupId ? null : g.id)}
                  style={{
                    flexShrink: 0, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                    background: g.id === activeGroupId ? indigoColor : bgMuted,
                    color: g.id === activeGroupId ? '#fff' : textMuted,
                    borderRadius: 20,
                    border: hp && g.id !== activeGroupId ? `1px solid ${bgCardBorder}` : 'none',
                    cursor: 'pointer',
                    fontFamily: fontDisplay,
                  }}
                >
                  {g.name} ({g.memberIds.length})
                </button>
              ))}
            </div>
          )}

          {/* Active group members + unassigned */}
          {activeGroupId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: 8, background: indigoSoft, borderRadius: 10, border: hp ? `1px solid ${bgCardBorder}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: indigoColor, fontFamily: fontDisplay }}>
                    {tempGroups.find(g => g.id === activeGroupId)?.name}
                  </span>
                  {!academyMode && (
                    <button
                      onClick={() => { removeGroup(activeGroupId); setActiveGroupId(null); }}
                      style={{ fontSize: 12, color: '#dc2626', border: 'none', background: 'none', cursor: 'pointer' }}
                    >Supprimer</button>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {tempGroups.find(g => g.id === activeGroupId)?.memberIds.map(sid => {
                    const s = students.find(st => st.id === sid);
                    return s ? (
                      <button
                        key={sid}
                        onClick={() => toggleMember('__remove__', sid)}
                        style={{
                          padding: '4px 8px', fontSize: 12, fontWeight: 500,
                          background: indigoColor, color: '#fff',
                          borderRadius: 20, border: 'none', cursor: 'pointer',
                        }}
                      >
                        {s.pseudo} ✕
                      </button>
                    ) : null;
                  })}
                  {(tempGroups.find(g => g.id === activeGroupId)?.memberIds.length || 0) === 0 && (
                    <span style={{ fontSize: 12, color: textDim, padding: 4 }}>Tapez un élève ci-dessous</span>
                  )}
                </div>
              </div>

              <div style={{ padding: 8, background: bgMuted, borderRadius: 10, border: hp ? `1px solid ${bgCardBorder}` : 'none' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: textDim, display: 'block', marginBottom: 4 }}>
                  Non assignés ({unassigned.length})
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {unassigned.map(s => (
                    <button
                      key={s.id}
                      onClick={() => toggleMember(activeGroupId, s.id)}
                      style={{
                        padding: '4px 8px', fontSize: 12, fontWeight: 500,
                        background: bgCard, color: textMain,
                        borderRadius: 20, border: hp ? `1px solid ${bgCardBorder}` : 'none',
                        cursor: 'pointer', boxShadow: hp ? 'none' : 'var(--shadow-xs)',
                      }}
                    >
                      {s.pseudo}
                    </button>
                  ))}
                  {unassigned.length === 0 && (
                    <span style={{ fontSize: 12, color: textDim, padding: 4 }}>Tous les élèves sont assignés</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Start button */}
      <div style={{ padding: '16px 16px 24px', flexShrink: 0 }}>
        <button
          onClick={startGrading}
          disabled={!canStart || loading}
          style={{
            width: '100%', padding: 16,
            color: hp ? '#1a1410' : '#fff',
            fontWeight: 700, fontSize: 17,
            fontFamily: fontDisplay,
            background: hp
              ? `linear-gradient(135deg, ${goldAccent}, #b8860b)`
              : 'var(--gradient-success)',
            borderRadius: 12, border: 'none', cursor: 'pointer',
            opacity: (!canStart || loading) ? 0.5 : 1,
            boxShadow: hp ? '0 4px 16px rgba(180,130,50,0.3)' : 'none',
          }}
        >
          {loading ? 'Création...' : hp ? '⚔ Lancer l\'épreuve' : 'Commencer la notation'}
        </button>
        {!canStart && (
          <p style={{ textAlign: 'center', fontSize: 12, color: textDim, marginTop: 8 }}>
            {!sessionName.trim() ? 'Nom requis' : tempCriteria.length === 0 ? 'Ajoutez des critères' : tempGroups.length === 0 ? 'Créez des groupes' : 'Chaque groupe doit avoir au moins 1 élève'}
          </p>
        )}
      </div>
    </div>
  );
}
