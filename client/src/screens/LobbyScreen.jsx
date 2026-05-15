import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { useT } from '../utils';

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export default function LobbyScreen({ onNavigate, onGameStarted }) {
  const { room, username, language, socket, startGame, showNotification } = useGameStore();
  const t = useT(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  const me = room?.players.find(p => p.username === username);
  const isHost = me?.isHost;
  const minPlayers = 4;
  const canStart = room?.players.length >= minPlayers;
  const needed = minPlayers - (room?.players.length || 0);

  // Listen for game started
  useEffect(() => {
    if (!socket) return;
    socket.on('game:started', onGameStarted);
    return () => socket.off('game:started', onGameStarted);
  }, [socket, onGameStarted]);

  const copyCode = () => {
    navigator.clipboard.writeText(room?.roomCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showNotification(t('copied'), 'success', 1500);
  };

  const handleStart = async () => {
    if (!canStart) return showNotification(t('needMorePlayers'), 'warning');
    setStarting(true);
    const res = await startGame();
    if (!res?.success) {
      setStarting(false);
      showNotification(res?.error || t('error'), 'error');
    }
  };

  // Ø¥Ø°Ø§ Ù„Ù… ØªÙƒÙ† Ø§Ù„ØºØ±ÙØ© Ù…Ø­Ù…Ù„Ø© Ø¨Ø¹Ø¯ - spinner
  if (!room) {
    return (
      <div className="page page-center" dir={dir}>
        <motion.div
          className="text-center"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          <motion.div
            className="loading-icon"
            aria-hidden="true"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            â³
          </motion.div>
          <p className="text-muted">{t('loading')}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page page-wide" dir={dir}>
      <motion.div
        className="screen-topbar"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="cluster">
          <motion.button
            className="btn btn-ghost btn-sm icon-btn"
            onClick={() => onNavigate('home')}
            aria-label={language === 'ar' ? 'Ø±Ø¬ÙˆØ¹' : 'Back'}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            â†
          </motion.button>
          <div className="topbar-title">
            <div className="screen-kicker">{t('waitingPlayers')}</div>
            <h2 className="screen-title">{room.roomName}</h2>
          </div>
        </div>
        <motion.span
          className="count-pill"
          key={room.players.length}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          {room.players.length} / {room.maxPlayers}
        </motion.span>
      </motion.div>

      <div className="lobby-grid">
        <motion.section
          className="stack"
          initial={{ opacity: 0, x: language === 'ar' ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="glass-card room-code-card text-center"
            whileHover={{ borderColor: 'rgba(246, 194, 71, 0.5)' }}
          >
            <p className="form-label mb-1">{t('roomCode')}</p>
            <motion.button
              className="room-code"
              onClick={copyCode}
              title="Ø§Ù†Ù‚Ø± Ù„Ù„Ù†Ø³Ø®"
              whileHover={{ scale: 1.02, borderColor: 'rgba(246, 194, 71, 1)' }}
              whileTap={{ scale: 0.98 }}
            >
              {room.roomCode.split('').map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, type: 'spring', stiffness: 400 }}
                  style={{ display: 'inline-block' }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.button>
            <div className="cluster justify-center mt-2">
              <motion.button
                className="btn btn-ghost btn-sm"
                onClick={copyCode}
                whileTap={{ scale: 0.95 }}
              >
                {copied ? `âœ… ${t('copied')}` : `ðŸ“‹ ${t('copyCode')}`}
              </motion.button>
              <span className="room-meta-pill">
                {room.accessType === 'public' ? `ðŸŒ ${t('public')}` : `ðŸ”’ ${t('private')}`}
              </span>
            </div>
          </motion.div>

          <div className="glass-card progress-card">
            <div className="flex justify-between items-center mb-1">
              <span className="form-label">{t('players')}</span>
              <span className="text-sm text-muted">{room.players.length}/{room.maxPlayers}</span>
            </div>
            <div className="progress-track mb-2">
              <motion.div
                className="progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${(room.players.length / room.maxPlayers) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <AnimatePresence>
              {!canStart && (
                <motion.p
                  className="text-center text-sm text-gold"
                  {...fadeUp}
                  animate={{ ...fadeUp.animate, opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  â³ {language === 'ar' ? `ØªØ­ØªØ§Ø¬ ${needed} Ù„Ø§Ø¹Ø¨${needed > 1 ? 'ÙŠÙ†' : ''} Ø£ÙƒØ«Ø±` : `Need ${needed} more player${needed > 1 ? 's' : ''}`}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="glass-card">
            <div className="stat-grid">
              <Stat icon="ðŸ‘¥" label={t('maxPlayers')} value={room.maxPlayers} />
              <Stat icon="ðŸ”´" label={t('mafia')} value={room.mafiaCount} />
              <Stat icon="ðŸ¤–" label={t('hostType')} value={room.hostType === 'bot' ? t('botHost') : t('playerHost')} />
              <Stat icon="â±ï¸" label={t('discussionTime')} value={`${room.discussionTime}s`} />
            </div>
            <div className="enabled-card-row">
              {room.enabledCards?.vigilante && <CardBadge emoji="ðŸ”«" label={t('vigilante')} />}
              {room.enabledCards?.silencer  && <CardBadge emoji="ðŸ¤" label={t('silencer')} />}
              {room.enabledCards?.mayor     && <CardBadge emoji="ðŸ‘‘" label={t('mayor')} />}
              {room.enabledCards?.goodBoy   && <CardBadge emoji="ðŸ˜‡" label={t('goodBoy')} />}
            </div>
          </div>
        </motion.section>

        <motion.section
          className="players-panel"
          initial={{ opacity: 0, x: language === 'ar' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="section-title mb-0">{t('players')}</div>
            <span className="text-sm text-muted">{room.players.length}</span>
          </div>
          <div className="player-list">
            <AnimatePresence>
              {room.players.map((p, i) => (
                <motion.div
                  key={p.id}
                  className="player-chip"
                  initial={{ opacity: 0, x: 20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.9 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 300 }}
                  whileHover={{ borderColor: 'rgba(246, 194, 71, 0.4)', x: 4 }}
                  layout
                >
                  <motion.span
                    className="player-avatar"
                    whileHover={{ scale: 1.2, rotate: 10 }}
                  >
                    {p.avatar || 'ðŸ‘¤'}
                  </motion.span>
                  <span className="player-name">{p.username}</span>
                  {p.isHost && <span className="player-badge badge-host">ðŸ‘‘ {t('host')}</span>}
                  {p.username === username && !p.isHost && <span className="player-badge badge-you">{t('you')}</span>}
                </motion.div>
              ))}
            </AnimatePresence>
            {Array.from({ length: Math.max(0, minPlayers - room.players.length) }).map((_, i) => (
              <motion.div
                key={`empty-${i}`}
                className="player-chip empty-slot"
                animate={{ opacity: [0.3, 0.55, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
              >
                <span className="player-avatar">ðŸ‘¤</span>
                <span className="player-name text-muted">
                  {language === 'ar' ? 'ÙÙŠ Ø§Ù†ØªØ¸Ø§Ø± Ù„Ø§Ø¹Ø¨...' : 'Waiting for player...'}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>

      <motion.div
        className="lobby-actions"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {isHost && (
          <motion.button
            className={`btn btn-lg btn-full ${canStart ? 'btn-primary' : 'btn-ghost'}`}
            onClick={handleStart}
            disabled={starting || !canStart}
            whileHover={canStart ? { scale: 1.02, boxShadow: '0 20px 60px rgba(239, 57, 72, 0.3)' } : {}}
            whileTap={canStart ? { scale: 0.98 } : {}}
            animate={canStart ? { boxShadow: ['0 12px 36px rgba(239,57,72,0.28)', '0 18px 52px rgba(239,57,72,0.38)', '0 12px 36px rgba(239,57,72,0.28)'] } : {}}
            transition={canStart ? { duration: 2, repeat: Infinity } : {}}
          >
            {starting ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>â³</motion.span>
            ) : 'â–¶'} {t('startGame')}
          </motion.button>
        )}

        {!isHost && (
          <motion.div
            className="glass-card text-center"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <p className="text-muted">â³ {t('waitingPlayers')}...</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <motion.div
      className="stat-tile"
      whileHover={{ borderColor: 'rgba(246, 194, 71, 0.3)', y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div className="stat-label">{icon} {label}</div>
      <div className="stat-value">{value}</div>
    </motion.div>
  );
}

function CardBadge({ emoji, label }) {
  return (
    <motion.span
      className="card-badge"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.08 }}
    >
      <span aria-hidden="true">{emoji}</span>
      {label && <span>{label}</span>}
    </motion.span>
  );
}

