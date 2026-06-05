import { useGameStore } from '../store';
import { useT, CARD_INFO } from '../utils';
import { motion } from 'framer-motion';
import { useState } from 'react';

function Confetti() {
  const [particles] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: ['#f6c247', '#ef3948', '#22d6b5', '#5b9df7', '#8d65ff', '#ff9f43'][Math.floor(Math.random() * 6)],
      size: Math.random() * 6 + 4,
      delay: Math.random() * 2,
      duration: Math.random() * 2 + 2,
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      rotate: Math.random() * 720 - 360,
    }))
  );

  return (
    <div className="confetti-container" aria-hidden="true">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 1.5,
            backgroundColor: p.color,
            borderRadius: p.borderRadius,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: '100vh', opacity: 0, rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn', repeat: Infinity, repeatDelay: p.delay }}
        />
      ))}
    </div>
  );
}

export default function ResultsScreen({ result, onNavigate }) {
  const { language, clearRoom, room, playerId, returnToLobby } = useGameStore();
  const t = useT(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  // Return to lobby automatically if the host triggered it
  useEffect(() => {
    if (room?.phase === 'lobby') {
      onNavigate('lobby');
    }
  }, [room?.phase, onNavigate]);

  if (!result) return null;

  const isMafiaWin = result.winner === 'mafia';
  const isHost = room?.players?.find(p => p.id === playerId)?.isHost;

  const handleLeaveRoom = () => {
    clearRoom();
    onNavigate('home');
  };

  return (
    <div className="page page-center results-shell" dir={dir}>
      <Confetti />

      <motion.div
        className={`winner-banner ${isMafiaWin ? 'mafia-win' : 'citizen-win'}`}
        initial={{ opacity: 0, scale: 0.8, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <motion.div
          className="winner-icon"
          aria-hidden="true"
          animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {isMafiaWin ? '🔴' : '✅'}
        </motion.div>
        <motion.h1
          className="font-black text-xl mb-1"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {isMafiaWin ? t('mafiaWins') : t('citizensWin')}
        </motion.h1>
        <motion.p
          className="text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {t('gameOver')}
        </motion.p>
      </motion.div>

      <motion.div
        className="glass-card w-full mb-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="form-label mb-2">🃏 {t('revealCards')}</div>
        <div className="reveal-list">
          {result.players?.map((p, i) => {
            const ci = CARD_INFO[p.card] || {};
            return (
              <motion.div
                key={p.id}
                className={`player-chip ${!p.isAlive ? 'dead' : ''}`}
                style={{ borderColor: p.isAlive ? `${ci.color}66` : undefined }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08, type: 'spring', stiffness: 300 }}
                whileHover={{ borderColor: ci.color, x: 4 }}
              >
                <span className="player-avatar">{p.avatar || '👤'}</span>
                <span className="player-name">{p.username}</span>
                <motion.span
                  className="role-pill"
                  style={{ color: ci.color }}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                >
                  <span aria-hidden="true">{ci.emoji}</span>
                  <span>{t(p.card)}</span>
                </motion.span>
                {!p.isAlive && <span className="player-badge badge-dead">💀</span>}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        className="flex flex-col gap-2 w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        {isHost ? (
          <motion.button
            className="btn btn-primary btn-lg btn-full"
            onClick={returnToLobby}
            whileHover={{ scale: 1.02, boxShadow: '0 16px 48px rgba(239, 57, 72, 0.35)' }}
            whileTap={{ scale: 0.98 }}
          >
            🔄 {language === 'ar' ? 'العودة للوبي (نفس الغرفة)' : 'Return to Lobby'}
          </motion.button>
        ) : (
          <p className="text-center text-muted mb-2 text-sm">
            {language === 'ar' ? 'في انتظار المضيف لإعادة اللعب...' : 'Waiting for host to play again...'}
          </p>
        )}
        <motion.button
          className="btn btn-ghost btn-full"
          onClick={handleLeaveRoom}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          🏠 {t('backHome')}
        </motion.button>
      </motion.div>
    </div>
  );
}
