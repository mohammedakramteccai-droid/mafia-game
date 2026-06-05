import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import { useT, CARD_INFO } from '../utils';

export default function GameScreen({ onGameOver }) {
  const { room, myCard, mafiaTeam, currentTurn, investigationHistory, username,
          actionSubmitted, language, socket, sendReady, sendNightAction, sendVote, startVoting, showNotification } = useGameStore();
  const t = useT(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const me = room?.players.find(p => p.id === socket?.id) || room?.players.find(p => p.username === username);
  const voteTargets = room?.players.filter(p => p.isAlive && p.id !== me?.id) || [];
  const aliveAll = room?.players.filter(p => p.isAlive) || [];

  const [selectedTarget, setSelectedTarget] = useState(null);
  const [actionSent, setActionSent] = useState(false);
  const [voteCount, setVoteCount] = useState({ voted: 0, total: 0 });
  const [dayInfo, setDayInfo] = useState(null);
  const [tieInfo, setTieInfo] = useState(null);
  const [elimInfo, setElimInfo] = useState(null);
  const [botStep, setBotStep] = useState('sleep');
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  const cardInfo = CARD_INFO[myCard] || {};
  const cardDesc = myCard ? t(cardInfo.descKey || myCard) : '';
  const isBotHost = room?.hostType === 'bot';
  const phase = room?.phase;
  const discussionTime = room?.discussionTime || 180;
  const tiedIds = tieInfo?.tiedPlayers?.map(p => typeof p === 'string' ? p : p.id) || [];
  const isCardReveal = phase === 'card_reveal';

  useEffect(() => {
    if (phase === 'day') {
      timerRef.current = setInterval(() => {
        setTimer(t => {
          if (t <= 1) { clearInterval(timerRef.current); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase, room?.discussionTime]);

  useEffect(() => {
    if (!socket) return;
    const handleDayStart = (data) => {
      setDayInfo(data); setTimer(discussionTime); setActionSent(false);
      setSelectedTarget(null); setBotStep('announce'); setElimInfo(null); setTieInfo(null);
    };
    const handleNightStart = () => {
      setActionSent(false); setSelectedTarget(null); setBotStep('sleep');
      setDayInfo(null); setElimInfo(null); setTieInfo(null);
    };
    const handleNightStage = () => {
      setActionSent(false); setSelectedTarget(null); setBotStep('sleep');
    };
    const handleMafiaConsensusFailed = () => {
      setActionSent(false); setSelectedTarget(null);
      showNotification(t('mafiaConsensusFailed'), 'warning', 4000);
    };
    const handleGameError = (data) => {
      showNotification(data?.code === 'NOT_YOUR_TURN' ? t('notYourTurn') : (data?.message || t('error')), 'error');
    };
    const handleVoteUpdate = (data) => setVoteCount(data);
    const handleVotingStart = (data) => {
      setActionSent(false);
      setSelectedTarget(null);
      setTieInfo(null);
      setElimInfo(null);
      setVoteCount({ voted: 0, total: data?.players?.length || aliveAll.length });
    };
    const handleVoteTie = (data) => {
      setTieInfo(data);
      setActionSent(false);
      setSelectedTarget(null);
      setVoteCount({ voted: 0, total: data?.total || aliveAll.length });
    };
    const handlePlayerEliminated = (data) => setElimInfo(data);
    const handleVoteSkipped = () => setElimInfo({ skipped: true });

    socket.on('game:day_start', handleDayStart);
    socket.on('game:night_start', handleNightStart);
    socket.on('game:night_stage', handleNightStage);
    socket.on('game:mafia_consensus_failed', handleMafiaConsensusFailed);
    socket.on('game:error', handleGameError);
    socket.on('game:voting_start', handleVotingStart);
    socket.on('game:vote_update', handleVoteUpdate);
    socket.on('game:vote_tie', handleVoteTie);
    socket.on('game:player_eliminated', handlePlayerEliminated);
    socket.on('game:vote_skipped', handleVoteSkipped);
    socket.on('game:over', onGameOver);
    return () => {
      socket.off('game:day_start', handleDayStart);
      socket.off('game:night_start', handleNightStart);
      socket.off('game:night_stage', handleNightStage);
      socket.off('game:mafia_consensus_failed', handleMafiaConsensusFailed);
      socket.off('game:error', handleGameError);
      socket.off('game:voting_start', handleVotingStart);
      socket.off('game:vote_update', handleVoteUpdate);
      socket.off('game:vote_tie', handleVoteTie);
      socket.off('game:player_eliminated', handlePlayerEliminated);
      socket.off('game:vote_skipped', handleVoteSkipped);
      socket.off('game:over', onGameOver);
    };
  }, [socket, onGameOver, discussionTime, showNotification, t, aliveAll.length]);

  const handleVote = () => { if (!selectedTarget) return; sendVote(selectedTarget); setActionSent(true); };
  const handleSkip = () => { sendVote(null); setActionSent(true); };

  const nightStageLabels = {
    mafia: t('mafiaChoose'),
    doctor: t('doctorChoose'),
    detective: t('detectiveChoose'),
  };
  const nightRoles = currentTurn ? [{ card: currentTurn.stage, label: nightStageLabels[currentTurn.stage] || t('chooseTarget') }] : [];

  const hasNightAction = nightRoles.length > 0;
  const villagerNight = phase === 'night' && !hasNightAction;
  const phaseKind = isCardReveal ? 'day' : (phase || 'day');
  const phaseClass = phase === 'night' ? 'phase-night' : phase === 'voting' || phase === 'goodboy' ? 'phase-voting' : 'phase-day';
  const phaseIcon = isCardReveal ? '🎴' : phase === 'night' ? '🌙' : phase === 'voting' ? '🗳️' : '☀️';
  const phaseTitle = isCardReveal ? t('cardRevealPhase') : phase === 'night' ? t('nightPhase') : phase === 'voting' ? t('votingPhase') : t('dayPhase');
  const phaseSubtitle = isCardReveal
    ? `${room?.readyCount || 0}/${room?.players.length || 0} ${t('readyPlayers')}`
    : `${t('round')} ${room?.round || 0}`;

  return (
    <div className={`game-shell phase-${phaseKind}`} dir={dir}>
      <div className="game-stage">
        <motion.header
          className={`phase-banner ${phaseClass}`}
          key={phase}
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="phase-left">
            <motion.div
              className="phase-icon"
              aria-hidden="true"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              {phaseIcon}
            </motion.div>
            <div>
              <div className="phase-title">{phaseTitle}</div>
              <div className="phase-subtitle">{phaseSubtitle}</div>
            </div>
          </div>
          <motion.span
            className="count-pill"
            key={aliveAll.length}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
          >
            {aliveAll.length}/{room?.players.length || 0} {t('alive')}
          </motion.span>
        </motion.header>

        <div className="game-content">
          <aside className="game-side">
            <motion.div
              className={`role-card ${myCard || 'villager'}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              whileHover={{ y: -3 }}
            >
              <div className="role-card-inner">
                <motion.div
                  className="role-emoji"
                  aria-hidden="true"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  {cardInfo.emoji || '🎭'}
                </motion.div>
                <div className="role-identity">
                  <div className="form-label">{t('yourCard')}</div>
                  <div className="role-name">{t(myCard || 'villager')}</div>
                  {cardDesc && cardDesc !== myCard && (
                    <div className="role-desc" style={{ color: cardInfo.color || undefined }}>{cardDesc}</div>
                  )}
                </div>

              </div>
            </motion.div>

            {CARD_INFO[myCard]?.team === 'mafia' && mafiaTeam && mafiaTeam.length > 1 && (
              <motion.div className="glass-card team-strip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <div className="form-label mb-2">{t('mafiaTeam')}</div>
                <div className="team-members">
                  {mafiaTeam.map(m => (
                    <motion.span key={m.id} className="team-member" whileHover={{ scale: 1.05 }}>🔴 {m.username}</motion.span>
                  ))}
                </div>
              </motion.div>
            )}

            {myCard === 'detective' && (
              <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <div className="section-title" style={{ marginBottom: '8px' }}>🔍 {t('investigationLog')}</div>
                <div className="player-roster">
                  {room?.players.filter(p => p.id !== me?.id).map(p => {
                    const inv = investigationHistory?.find(i => i.targetId === p.id);
                    return (
                      <motion.div
                        key={p.id}
                        className={`player-chip ${!p.isAlive ? 'dead' : ''}`}
                        style={inv ? {
                          borderColor: inv.result === 'mafia' ? 'rgba(239,57,72,0.6)' : 'rgba(15,244,198,0.6)',
                          background: inv.result === 'mafia' ? 'rgba(239,57,72,0.12)' : 'rgba(15,244,198,0.12)',
                        } : { borderColor: 'rgba(255,255,255,0.08)' }}
                        layout
                      >
                        <span className="player-avatar">{inv ? (inv.result === 'mafia' ? '🔴' : '✅') : '❓'}</span>
                        <span className="player-name">{p.username}</span>
                        {!p.isAlive && <span className="player-badge badge-dead">💀</span>}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {myCard === 'doctor' && (
              <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <div className="section-title" style={{ marginBottom: '4px' }}>💊 {t('doctor')}</div>
                <p style={{ color: 'var(--text-muted, #8888aa)', fontSize: '0.85rem', margin: 0 }}>{t('doctorPanelInfo')}</p>
              </motion.div>
            )}



            {(isCardReveal || phase === 'day' || phase === 'voting' || phase === 'night') && (
              <div className="glass-card">
                <div className="flex justify-between items-center mb-2">
                  <div className="section-title mb-0">{t('players')}</div>
                  <span className="text-sm text-muted">{aliveAll.length} {t('alive')}</span>
                </div>
                <div className="player-roster">
                  {room?.players.map(p => (
                    <motion.div
                      key={p.id}
                      className={`player-chip ${!p.isAlive ? 'dead' : ''} ${p.isMuted ? 'muted' : ''}`}
                      layout
                      whileHover={p.isAlive ? { borderColor: 'rgba(246,194,71,0.4)' } : {}}
                    >
                      <span className="player-avatar">{p.avatar || '👤'}</span>
                      <span className="player-name">{p.username}</span>
                      {isCardReveal && p.isReady && <span className="player-badge badge-you">{t('ready')}</span>}
                      {!p.isAlive && <span className="player-badge badge-dead">💀</span>}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <main className="game-main">
            {isCardReveal && (
              <motion.div className="scene-card accent-gold text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="scene-icon" aria-hidden="true">🎴</div>
                <h3 className="font-black mb-2">{t('cardRevealPhase')}</h3>
                <p className="text-muted mb-2">{t('cardRevealPrompt')}</p>
                <motion.button
                  className={`btn btn-full btn-lg ${me?.isReady ? 'btn-ghost' : 'btn-gold'}`}
                  onClick={sendReady}
                  disabled={me?.isReady}
                  whileTap={!me?.isReady ? { scale: 0.97 } : {}}
                >
                  {me?.isReady ? `✅ ${t('readyWaiting')}` : `✅ ${t('ready')}`}
                </motion.button>
              </motion.div>
            )}

            {phase === 'night' && (
              <>
                {isBotHost && botStep === 'sleep' && (
                  <motion.div
                    className="night-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                  >
                    <div className="stars" />
                    <motion.div className="sleep-scene" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ delay: 0.3, type: 'spring' }}>
                      <motion.div
                        className="moon-core"
                        aria-hidden="true"
                        animate={{ boxShadow: ['0 0 60px rgba(141,101,255,0.22)', '0 0 90px rgba(141,101,255,0.35)', '0 0 60px rgba(141,101,255,0.22)'] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        🌙
                      </motion.div>
                      <h2 className="font-black text-xl text-center">{t('closeEyes')}</h2>
                      {hasNightAction && (
                        <motion.button
                          className="btn btn-primary btn-lg mt-3"
                          onClick={() => setBotStep('action')}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          animate={{ boxShadow: ['0 12px 36px rgba(239,57,72,0.28)', '0 18px 52px rgba(239,57,72,0.4)', '0 12px 36px rgba(239,57,72,0.28)'] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          {cardInfo.emoji} {t('chooseTarget')}
                        </motion.button>
                      )}
                      {villagerNight && <p className="text-muted mt-2">{t('waitingForAction')}</p>}
                    </motion.div>
                  </motion.div>
                )}

                {phase === 'night' && me?.isAlive && (
                  <motion.div className="scene-card accent-blue" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <div className="scene-icon">🌙</div>
                    <h3 className="font-black mb-2">{t('nightPhase')}</h3>
                    <p className="text-muted">{t('nightPrompt')}</p>
                    {actionSubmitted && (
                      <motion.div className="mt-4 p-4 rounded-lg bg-blue-900/40 text-blue-300 border border-blue-500/30"
                                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <p className="font-bold">✅ تم تسجيل اختيارك.</p>
                        <p className="text-sm opacity-80 mt-1">بانتظار بقية اللاعبين لإنهاء الليل...</p>
                      </motion.div>
                    )}
                    {!actionSubmitted && currentTurn && (
                      <motion.div className="mt-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <h4 className="font-bold mb-3">{currentTurn.actionType === 'mafia' ? t('chooseVictim') : t('chooseTarget')}</h4>
                        <div className="target-grid">
                          {currentTurn.targets.map(target => (
                            <motion.button
                              key={target.id}
                              className="btn btn-outline"
                              onClick={() => sendNightAction(target.id)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              {target.avatar || '👤'} {target.username}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {phase === 'night' && !me?.isAlive && (
                  <motion.div className="scene-card accent-gray" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="scene-icon">👻</div>
                    <h3 className="font-black mb-2">أنت ميت</h3>
                    <p className="text-muted mb-2">القرية نائمة الآن... وأنت أيضاً.</p>
                  </motion.div>
                )}

                {villagerNight && !isBotHost && (
                  <motion.div className="scene-card text-center" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
                    <div className="scene-icon" aria-hidden="true">😴</div>
                    <p className="text-muted mt-4 font-bold">{t('waitingForVotes')}</p>
                  </motion.div>
                )}
              </>
            )}

            {phase === 'day' && dayInfo && (
              <motion.div className="scene-card accent-gold day-report" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }}>
                <motion.div className="scene-icon" aria-hidden="true" animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 3, repeat: Infinity }}>☀️</motion.div>
                <h3 className="font-black mb-2">{t('goodMorning')}</h3>
                {dayInfo.deaths?.length > 0 ? (
                  <div className="stack">
                    {dayInfo.deaths.map((d, i) => (
                      <motion.div key={i} className="event-row text-red" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.2 }}>
                        💀 {d.username} {t('playerDied')}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <motion.p className="text-teal font-bold" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>{t('noDeath')}</motion.p>
                )}
                {dayInfo.wasSaved && (
                  <motion.div className="event-row text-teal mt-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    💊 {t('someoneSaved')}
                  </motion.div>
                )}

                {timer > 0 && (
                  <motion.div className="timer-card" animate={{ borderColor: timer < 30 ? ['rgba(239,57,72,0.5)', 'rgba(239,57,72,0.2)'] : 'rgba(246,194,71,0.28)' }} transition={timer < 30 ? { duration: 1, repeat: Infinity } : {}}>
                    <div className="timer-display">{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {phase === 'voting' && !me?.isAlive && (
              <motion.div className="scene-card accent-gray" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="scene-icon">👻</div>
                <h3 className="font-black mb-2">أنت ميت</h3>
                <p className="text-muted mb-2">القرية تصوت الآن... يمكنك المراقبة بصمت.</p>
              </motion.div>
            )}

            {phase === 'voting' && me?.isAlive && (
              <motion.div className="scene-card accent-teal" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                {tieInfo ? (
                  <>
                    <h3 className="text-center font-black mb-2 text-gold">⚖️ {t('tie')}</h3>
                    <PlayerSelector players={room?.players.filter(p => tiedIds.includes(p.id))} selected={selectedTarget} onSelect={setSelectedTarget} disabled={actionSent} />
                    {!actionSent && (
                      <motion.button className="btn btn-danger btn-full mt-2" onClick={handleVote} disabled={!selectedTarget} whileTap={{ scale: 0.97 }}>
                        🗳️ {t('retie')}
                      </motion.button>
                    )}
                  </>
                ) : elimInfo ? (
                  <motion.div className="text-center" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                    {elimInfo.skipped ? (
                      <p className="text-muted">{t('skip')}</p>
                    ) : (
                      <>
                        <div className="scene-icon" aria-hidden="true">🪦</div>
                        <p className="text-red font-black text-lg">💀 {elimInfo.username} {t('eliminated')}</p>
                        <p className="text-muted text-sm mt-1">({t(elimInfo.card)})</p>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <div className="section-title mb-0">{t('voteToEliminate')}</div>
                      <span className="text-sm text-muted">{voteCount.voted}/{voteCount.total} {t('voted')}</span>
                    </div>
                    <div className="vote-bar mb-3">
                      <motion.div className="vote-bar-fill" animate={{ width: voteCount.total ? `${(voteCount.voted / voteCount.total) * 100}%` : '0%' }} transition={{ duration: 0.5 }} />
                    </div>
                    {!actionSent ? (
                      <>
                        <PlayerSelector players={voteTargets} selected={selectedTarget} onSelect={setSelectedTarget} disabled={false} />
                        <div className="action-row">
                          <motion.button className="btn btn-danger btn-full" onClick={handleVote} disabled={!selectedTarget} whileTap={{ scale: 0.97 }}>
                            🗳️ {t('votes')}
                          </motion.button>
                          <motion.button className="btn btn-ghost" onClick={handleSkip} whileTap={{ scale: 0.95 }}>{t('skip')}</motion.button>
                        </div>
                      </>
                    ) : (
                      <motion.p className="text-teal text-center font-bold" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                        ✅ {t('waitingForAction')}
                      </motion.p>
                    )}
                  </>
                )}
              </motion.div>
            )}



            {phase === 'day' && me?.isAlive && (
              <motion.button
                className="btn btn-gold btn-full btn-lg"
                onClick={() => { startVoting(); }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={{ boxShadow: ['0 12px 36px rgba(246,194,71,0.22)', '0 18px 48px rgba(246,194,71,0.35)', '0 12px 36px rgba(246,194,71,0.22)'] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🗳️ {t('startVoting')}
              </motion.button>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function PlayerSelector({ players, selected, onSelect, disabled }) {
  if (!players?.length) {
    return <div className="empty-state">لا توجد أهداف متاحة</div>;
  }

  return (
    <div className="player-selector">
      {players.map((p, i) => {
        const unavailable = p.isAlive === false;
        return (
          <motion.button
            key={p.id}
            disabled={disabled || unavailable}
            onClick={() => !disabled && !unavailable && onSelect(p.id)}
            className={`player-chip selector-button ${selected === p.id ? 'selected' : ''} ${unavailable ? 'dead' : ''}`}
            aria-pressed={selected === p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={!disabled && !unavailable ? { scale: 1.03, y: -2 } : {}}
            whileTap={!disabled && !unavailable ? { scale: 0.97 } : {}}
          >
            <motion.span className="player-avatar" animate={selected === p.id ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.3 }}>
              {p.avatar || '👤'}
            </motion.span>
            <span className="player-name">{p.username}</span>
            {unavailable && <span className="player-badge badge-dead">💀</span>}
            <motion.span className="selector-mark" animate={selected === p.id ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0.3 }}>✓</motion.span>
          </motion.button>
        );
      })}
    </div>
  );
}
