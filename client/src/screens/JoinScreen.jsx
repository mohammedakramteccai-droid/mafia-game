import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import { useT } from '../utils';

export default function JoinScreen({ onNavigate, onRoomJoined }) {
  const { username, avatar, language, joinRoom } = useGameStore();
  const t = useT(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (code.length !== 6) return setError('الرمز يجب أن يكون 6 أرقام');
    setLoading(true);
    setError('');
    try {
      const res = await joinRoom({ roomCode: code, username, avatar, language });
      if (res.success) {
        onRoomJoined(res);
      } else {
        const errMap = {
          room_not_found: 'الغرفة غير موجودة',
          game_started: 'اللعبة بدأت بالفعل',
          room_full: 'الغرفة ممتلئة',
        };
        setError(errMap[res.error] || t('error'));
      }
    } catch {
      setError(t('error'));
    }
    setLoading(false);
  };

  return (
    <div className="page page-center" dir={dir}>
      <motion.button
        className="btn btn-ghost btn-sm back-inline"
        onClick={() => onNavigate('home')}
        initial={{ opacity: 0, x: language === 'ar' ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        ← {language === 'ar' ? 'رجوع' : 'Back'}
      </motion.button>

      <motion.div
        className="glass-card join-card"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="join-icon"
          aria-hidden="true"
          initial={{ rotate: -15 }}
          animate={{ rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.5 } }}
        >
          🔑
        </motion.div>
        <motion.h2
          className="font-black text-lg mb-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {t('joinRoom')}
        </motion.h2>

        <motion.div
          className="form-group mb-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <label className="form-label">{t('enterRoomCode')}</label>
          <motion.input
            className="input code-input"
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={6}
            inputMode="numeric"
            whileFocus={{ borderColor: 'rgba(246, 194, 71, 0.8)', boxShadow: '0 0 0 4px rgba(246, 194, 71, 0.2), 0 0 40px rgba(246, 194, 71, 0.06)' }}
          />

          {/* Code digits visualization */}
          <div className="code-dots">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                className={`code-dot ${i < code.length ? 'filled' : ''}`}
                animate={i < code.length ? { scale: [1, 1.3, 1], backgroundColor: 'rgba(246, 194, 71, 0.8)' } : { scale: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                transition={{ duration: 0.2 }}
              />
            ))}
          </div>
        </motion.div>

        {error && (
          <motion.p
            className="error-text mb-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {error}
          </motion.p>
        )}

        <motion.button
          className="btn btn-gold btn-full btn-lg"
          onClick={handleJoin}
          disabled={loading || code.length !== 6}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.02, boxShadow: '0 16px 48px rgba(246, 194, 71, 0.3)' }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? (
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⏳</motion.span>
          ) : '🚀'} {t('join')}
        </motion.button>
      </motion.div>
    </div>
  );
}
