import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import { useT } from '../utils';

const DEFAULT_SETTINGS = {
  roomName: '',
  accessType: 'public',
  hostType: 'bot',
  maxPlayers: 8,
  mafiaCount: 2,
  discussionTime: 180,
};



const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

export default function CreateRoomScreen({ onNavigate, onRoomCreated }) {
  const { username, avatar, language, createRoom } = useGameStore();
  const t = useT(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, roomName: `غرفة ${username}` });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  const handleCreate = async () => {
    if (!settings.roomName.trim()) return setError('أدخل اسم الغرفة');
    setLoading(true);
    setError('');
    try {
      const res = await createRoom({ ...settings, username, avatar, language });
      if (res.success) {
        onRoomCreated(res);
      } else {
        setError(res.error || t('error'));
      }
    } catch {
      setError(t('error'));
    }
    setLoading(false);
  };

  return (
    <div className="page page-wide" dir={dir}>
      <motion.div
        className="screen-topbar"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="cluster">
          <motion.button
            className="btn btn-ghost btn-sm icon-btn"
            onClick={() => onNavigate('home')}
            aria-label={language === 'ar' ? 'رجوع' : 'Back'}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            ←
          </motion.button>
          <div className="topbar-title">
            <div className="screen-kicker">{t('settings')}</div>
            <h2 className="screen-title">{t('createRoom')}</h2>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="settings-stack"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        <motion.div className="settings-card" variants={fadeUp} transition={{ duration: 0.4 }}>
          <div className="form-group">
            <label className="form-label">{t('roomName')}</label>
            <motion.input
              className="input"
              value={settings.roomName}
              onChange={e => set('roomName', e.target.value)}
              maxLength={30}
              whileFocus={{ boxShadow: '0 0 0 4px rgba(246, 194, 71, 0.18)' }}
            />
          </div>
        </motion.div>

        <motion.div className="settings-card" variants={fadeUp} transition={{ duration: 0.4 }}>
          <div className="field-grid">
            <div className="form-group">
              <label className="form-label">{t('accessType')}</label>
              <select className="select" value={settings.accessType} onChange={e => set('accessType', e.target.value)}>
                <option value="public">{t('public')}</option>
                <option value="private">{t('private')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('hostType')}</label>
              <select className="select" value={settings.hostType} onChange={e => set('hostType', e.target.value)}>
                <option value="bot">{t('botHost')}</option>
                <option value="player">{t('playerHost')}</option>
              </select>
            </div>
          </div>
        </motion.div>

        <motion.div className="settings-card" variants={fadeUp} transition={{ duration: 0.4 }}>
          <div className="field-grid">
            <div className="range-control">
              <label className="form-label">{t('maxPlayers')}</label>
              <input type="range" min={4} max={15} value={settings.maxPlayers}
                onChange={e => set('maxPlayers', +e.target.value)}
              />
              <div className="range-meta">
                <span>4</span>
                <motion.span
                  className="range-value"
                  key={settings.maxPlayers}
                  initial={{ scale: 1.4, color: '#fff' }}
                  animate={{ scale: 1, color: '#f6c247' }}
                  transition={{ duration: 0.25 }}
                >
                  {settings.maxPlayers}
                </motion.span>
                <span>15</span>
              </div>
            </div>
            <div className="range-control">
              <label className="form-label">{t('mafiaCount')}</label>
              <input type="range" min={1} max={Math.max(1, Math.floor(settings.maxPlayers / 3))}
                value={settings.mafiaCount}
                onChange={e => set('mafiaCount', +e.target.value)}
              />
              <div className="range-meta">
                <span>1</span>
                <motion.span
                  className="range-value"
                  key={settings.mafiaCount}
                  initial={{ scale: 1.4, color: '#fff' }}
                  animate={{ scale: 1, color: '#f6c247' }}
                  transition={{ duration: 0.25 }}
                >
                  {settings.mafiaCount}
                </motion.span>
                <span>{Math.floor(settings.maxPlayers/3)}</span>
              </div>
            </div>
          </div>
          <div className="range-control mt-2">
            <label className="form-label">{t('discussionTime')}</label>
            <input type="range" min={60} max={600} step={30} value={settings.discussionTime}
              onChange={e => set('discussionTime', +e.target.value)}
            />
            <div className="range-meta">
              <span>1m</span>
              <motion.span
                className="range-value"
                key={settings.discussionTime}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
              >
                {settings.discussionTime}s
              </motion.span>
              <span>10m</span>
            </div>
          </div>
        </motion.div>



        {error && (
          <motion.p
            className="error-text"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            {error}
          </motion.p>
        )}

        <motion.div
          className="sticky-action"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.button
            className="btn btn-primary btn-lg btn-full"
            onClick={handleCreate}
            disabled={loading}
            whileHover={{ scale: 1.02, boxShadow: '0 16px 48px rgba(239, 57, 72, 0.35)' }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⏳</motion.span>
            ) : '🚀'} {t('create')}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
