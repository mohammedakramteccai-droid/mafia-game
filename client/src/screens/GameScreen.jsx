import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store';
import { useT, CARD_INFO } from '../utils';

export default function GameScreen({ onGameOver }) {
  const { room, myCard, mafiaTeam, validTargets, investigationResult, goodBoyMode, username,
          language, socket, sendNightAction, sendVote, startVoting, skipVote, revealMayor, sendGoodBoyPick } = useGameStore();
  const t = useT(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  // الأهداف الصالحة من السيرفر (getValidTargets)
  // إذا كانت فارغة نستخدم الفلترة المحلية كاحتياط
  const fallbackTargets = room?.players.filter(p => p.isAlive && p.username !== username) || [];
  const nightTargets = validTargets.length > 0 ? validTargets : fallbackTargets;
  const voteTargets = room?.players.filter(p => p.isAlive && p.username !== username) || [];
  const aliveAll = room?.players.filter(p => p.isAlive) || [];

  const [selectedTarget, setSelectedTarget] = useState(null);
  const [actionSent, setActionSent] = useState(false);
  const [voteCount, setVoteCount] = useState({ voted: 0, total: 0 });
  const [dayInfo, setDayInfo] = useState(null);       // {deaths, silencedPlayer}
  const [tieInfo, setTieInfo] = useState(null);       // {tiedPlayers}
  const [elimInfo, setElimInfo] = useState(null);     // {playerId,username,card}
  const [botStep, setBotStep] = useState('sleep');    // bot phase steps
  const [timer, setTimer] = useState(0);
  const [votedOut, setVotedOut] = useState(null);
  const timerRef = useRef(null);

  const me = room?.players.find(p => p.username === username);
  const myId = me?.id;
  const isMuted = room?.players.find(p => p.id === myId)?.isMuted;
  const cardInfo = CARD_INFO[myCard] || {};
  const cardDesc = myCard ? t(cardInfo.descKey || myCard) : '';
  const isBotHost = room?.hostType === 'bot';
  const isHost = me?.isHost;
  const phase = room?.phase;

  // Discussion timer
  useEffect(() => {
    if (phase === 'day') {
      setTimer(room?.discussionTime || 180);
      timerRef.current = setInterval(() => {
        setTimer(t => {
          if (t <= 1) { clearInterval(timerRef.current); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  useEffect(() => {
    if (!socket) return;
    socket.on('game:day_start', (data) => {
      setDayInfo(data);
      setActionSent(false);
      setSelectedTarget(null);
      setBotStep('announce');
      setElimInfo(null);
      setTieInfo(null);
    });
    socket.on('game:night_start', () => {
      setActionSent(false);
      setSelectedTarget(null);
      setBotStep('sleep');
      setDayInfo(null);
      setElimInfo(null);
      setTieInfo(null);
    });
    socket.on('game:vote_update', setVoteCount);
    socket.on('game:vote_tie', (data) => setTieInfo(data));
    socket.on('game:player_eliminated', (data) => setElimInfo(data));
    socket.on('game:vote_skipped', () => setElimInfo({ skipped: true }));
    socket.on('game:over', onGameOver);
    return () => {
      socket.off('game:day_start'); socket.off('game:night_start');
      socket.off('game:vote_update'); socket.off('game:vote_tie');
      socket.off('game:player_eliminated'); socket.off('game:vote_skipped');
      socket.off('game:over');
    };
  }, [socket]);

  const handleNightAction = () => {
    if (!selectedTarget || actionSent) return;
    const actionType = myCard === 'mafia' ? 'mafia'
      : myCard === 'doctor' ? 'doctor'
      : myCard === 'detective' ? 'detective'
      : myCard === 'vigilante' ? 'vigilante'
      : myCard === 'silencer' ? 'silencer' : null;
    if (!actionType) return;
    sendNightAction(actionType, selectedTarget);
    setActionSent(true);
  };

  const handleVote = () => {
    if (!selectedTarget) return;
    sendVote(selectedTarget);
    setActionSent(true);
  };

  const handleSkip = () => {
    skipVote();
    setActionSent(true);
  };

  const handleGoodBoyPick = () => {
    if (!selectedTarget) return;
    sendGoodBoyPick(selectedTarget);
    setActionSent(true);
  };

  // ── Bot Night Phase steps ────────────────────────────────
  const nightRoles = [
    myCard === 'mafia' && { card: 'mafia', label: t('mafiaChoose') },
    myCard === 'detective' && { card: 'detective', label: t('detectiveChoose') },
    myCard === 'doctor' && { card: 'doctor', label: t('doctorChoose') },
    myCard === 'vigilante' && room?.enabledCards?.vigilante && { card: 'vigilante', label: t('vigilanteChoose') },
    myCard === 'silencer' && room?.enabledCards?.silencer && { card: 'silencer', label: t('silencerChoose') },
  ].filter(Boolean);

  const hasNightAction = nightRoles.length > 0;
  const villagerNight = myCard === 'villager' || (!hasNightAction && phase === 'night');

  return (
    <div dir={dir} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Phase Banner */}
      <div style={{ padding: '12px 16px' }}>
        <div className={`phase-banner ${phase === 'night' ? 'phase-night' : phase === 'voting' ? 'phase-voting' : 'phase-day'}`}>
          {phase === 'night' ? '🌙' : phase === 'voting' ? '🗳️' : '☀️'}
          {phase === 'night' ? t('nightPhase') : phase === 'voting' ? t('votingPhase') : t('dayPhase')}
          <span style={{ opacity: 0.6, fontSize: '0.85rem' }}> · {t('round')} {room?.round}</span>
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* My Card - with description from code examples */}
        <div className={`role-card ${myCard}`} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div style={{ fontSize: '2.2rem' }}>{cardInfo.emoji}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="form-label">{t('yourCard')}</div>
            <div className="font-black text-lg">{t(myCard || 'villager')}</div>
            {cardDesc && cardDesc !== myCard && (
              <div style={{ fontSize: '0.78rem', color: cardInfo.color || '#888', marginTop: 2, opacity: 0.85 }}>{cardDesc}</div>
            )}
          </div>
          {myCard === 'mayor' && !me?.mayorRevealed && (
            <button className="btn btn-gold btn-sm" onClick={revealMayor}>
              {t('revealMayor')}
            </button>
          )}
        </div>

        {/* Mafia Team */}
        {myCard === 'mafia' && mafiaTeam && mafiaTeam.length > 1 && (
          <div className="glass-card" style={{ borderColor: 'rgba(230,57,70,0.4)' }}>
            <div className="form-label mb-1">{t('mafiaTeam')}</div>
            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
              {mafiaTeam.map(m => (
                <span key={m.id} style={{ background: 'rgba(230,57,70,0.15)', border: '1px solid rgba(230,57,70,0.4)', borderRadius: 8, padding: '4px 10px', fontSize: '0.9rem', fontWeight: 700 }}>
                  🔴 {m.username}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Investigation Result */}
        {investigationResult && myCard === 'detective' && (
          <div className="glass-card text-center" style={{ borderColor: investigationResult.result === 'mafia' ? '#e63946' : '#0ff4c6' }}>
            <p style={{ fontWeight: 700, color: investigationResult.result === 'mafia' ? '#e63946' : '#0ff4c6' }}>
              {investigationResult.result === 'mafia' ? t('investigationMafia') : t('investigationCitizen')}
            </p>
          </div>
        )}

        {/* ── NIGHT PHASE ── */}
        {phase === 'night' && (
          <>
            {isBotHost && botStep === 'sleep' && (
              <div className="night-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,2,0.97)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <div className="stars" />
                <div style={{ fontSize: '5rem' }}>🌙</div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#c9b3ff' }}>{t('closeEyes')}</h2>
                {hasNightAction && (
                  <button className="btn btn-primary btn-lg mt-3" onClick={() => setBotStep('action')}>
                    {cardInfo.emoji} {t('chooseTarget')}
                  </button>
                )}
                {villagerNight && (
                  <p className="text-muted" style={{ marginTop: 16 }}>{t('waitingForAction')}</p>
                )}
              </div>
            )}

            {(!isBotHost || botStep === 'action') && hasNightAction && (
              <div className="glass-card animate-fade">
                <div className="form-label mb-2">
                  {nightRoles[0]?.label}
                </div>
                <PlayerSelector
                  players={nightTargets}
                  selected={selectedTarget}
                  onSelect={setSelectedTarget}
                  disabled={actionSent}
                />
                {!actionSent ? (
                  <button className="btn btn-primary btn-full mt-2" onClick={handleNightAction} disabled={!selectedTarget}>
                    ✅ {t('confirm')}
                  </button>
                ) : (
                  <p className="text-teal text-center mt-2">✅ {t('waitingForAction')}</p>
                )}
              </div>
            )}

            {villagerNight && !isBotHost && (
              <div className="glass-card text-center animate-pulse">
                <div style={{ fontSize: '3rem', marginBottom: 8 }}>😴</div>
                <p className="text-muted">{t('closeEyes')}</p>
              </div>
            )}
          </>
        )}

        {/* ── DAY PHASE ── */}
        {phase === 'day' && dayInfo && (
          <div className="glass-card animate-fade" style={{ borderColor: 'rgba(255,214,10,0.3)' }}>
            <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 8 }}>☀️</div>
            <h3 className="font-black text-center mb-2">{t('goodMorning')}</h3>
            {dayInfo.deaths?.length > 0 ? (
              dayInfo.deaths.map((d, i) => (
                <div key={i} className="text-center mt-1">
                  <p style={{ color: '#e63946', fontWeight: 700 }}>💀 {d.username} {t('playerDied')}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-teal">{t('noDeath')}</p>
            )}
            {dayInfo.silencedPlayer && (
              <p className="text-center mt-1 text-muted text-sm">🤐 {room?.players.find(p=>p.id===dayInfo.silencedPlayer)?.username} {t('isMuted')}</p>
            )}
            {/* Timer */}
            {timer > 0 && (
              <div className="text-center mt-2">
                <div className="timer-display">{Math.floor(timer/60)}:{String(timer%60).padStart(2,'0')}</div>
              </div>
            )}
          </div>
        )}

        {/* ── Alive Players ── */}
        {(phase === 'day' || phase === 'voting') && (
          <div className="glass-card">
            <div className="form-label mb-2">{t('players')}</div>
            <div className="flex flex-col gap-1">
              {room?.players.map(p => (
                <div key={p.id} className={`player-chip ${!p.isAlive ? 'dead' : ''} ${p.isMuted ? 'muted' : ''}`}>
                  <span className="player-avatar">{p.avatar || '👤'}</span>
                  <span className="player-name">{p.username}</span>
                  {!p.isAlive && <span className="player-badge badge-dead">💀</span>}
                  {p.mayorRevealed && <span style={{ fontSize: '0.9rem' }}>👑</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── VOTING PHASE ── */}
        {phase === 'voting' && (
          <div className="glass-card animate-fade">
            {tieInfo ? (
              <>
                <h3 className="text-center font-black mb-2" style={{ color: '#ffd60a' }}>⚖️ {t('tie')}</h3>
                <PlayerSelector
                  players={room?.players.filter(p => tieInfo.tiedPlayers.includes(p.id))}
                  selected={selectedTarget} onSelect={setSelectedTarget} disabled={actionSent}
                />
                {!actionSent && (
                  <button className="btn btn-danger btn-full mt-2" onClick={handleVote} disabled={!selectedTarget}>
                    🗳️ {t('retie')}
                  </button>
                )}
              </>
            ) : elimInfo ? (
              <div className="text-center">
                {elimInfo.skipped ? (
                  <p className="text-muted">{t('skip')}</p>
                ) : (
                  <>
                    <div style={{ fontSize: '3rem' }}>🪦</div>
                    <p style={{ color: '#e63946', fontWeight: 700, fontSize: '1.1rem' }}>
                      💀 {elimInfo.username} {t('eliminated')}
                    </p>
                    <p className="text-muted text-sm mt-1">({t(elimInfo.card)})</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2">
                  <div className="form-label">{t('voteToEliminate')}</div>
                  <span className="text-sm text-muted">{voteCount.voted}/{voteCount.total} {t('voted')}</span>
                </div>
                <div className="vote-bar mb-3">
                  <div className="vote-bar-fill" style={{ width: voteCount.total ? `${(voteCount.voted/voteCount.total)*100}%` : '0%' }} />
                </div>
                {!actionSent ? (
                  <>
                    <PlayerSelector
                      players={voteTargets}
                      selected={selectedTarget} onSelect={setSelectedTarget} disabled={false}
                    />
                    <div className="flex gap-2 mt-2">
                      <button className="btn btn-danger btn-full" onClick={handleVote} disabled={!selectedTarget}>
                        🗳️ {t('votes')}
                      </button>
                      <button className="btn btn-ghost" onClick={handleSkip}>{t('skip')}</button>
                    </div>
                  </>
                ) : (
                  <p className="text-teal text-center">✅ {t('waitingForAction')}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Good Boy Mode ── */}
        {goodBoyMode && (
          <div className="glass-card animate-fade" style={{ borderColor: '#90e0ef' }}>
            <h3 className="font-black text-center mb-2" style={{ color: '#90e0ef' }}>😇 {t('goodBoyChoose')}</h3>
            <PlayerSelector players={aliveAll} selected={selectedTarget} onSelect={setSelectedTarget} disabled={actionSent} />
            {!actionSent && (
              <button className="btn btn-teal btn-full mt-2" onClick={handleGoodBoyPick} disabled={!selectedTarget}>
                ✅ {t('confirm')}
              </button>
            )}
          </div>
        )}

        {/* Start Voting button (host only during day) */}
        {phase === 'day' && isHost && (
          <button className="btn btn-gold btn-full btn-lg" onClick={() => { startVoting(); }}>
            🗳️ {t('startVoting')}
          </button>
        )}

      </div>
    </div>
  );
}

function PlayerSelector({ players, selected, onSelect, disabled }) {
  return (
    <div className="flex flex-col gap-1">
      {players?.map(p => (
        <button
          key={p.id}
          disabled={disabled || !p.isAlive}
          onClick={() => !disabled && onSelect(p.id)}
          className={`player-chip selectable-player ${selected === p.id ? 'selected' : ''} ${!p.isAlive ? 'dead' : ''}`}
          style={{ cursor: disabled || !p.isAlive ? 'not-allowed' : 'pointer' }}
        >
          <span className="player-avatar">{p.avatar || '👤'}</span>
          <span className="player-name">{p.username}</span>
          {!p.isAlive && <span className="player-badge badge-dead">💀</span>}
        </button>
      ))}
    </div>
  );
}
