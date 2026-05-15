import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { useT, AVATARS } from '../utils';
import GameRulesPanel from './GameRulesPanel';
import heroArt from '../assets/hero.png';

const stagger = {
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export default function HomeScreen({ onNavigate }) {
  const { username, avatar, language, setUsername, setAvatar, setLanguage, connect, connected } = useGameStore();
  const t = useT(language);
  const [name, setName] = useState(username);
  const [selectedAvatar, setSelectedAvatar] = useState(avatar || '🎭');
  const [showAvatars, setShowAvatars] = useState(false);

  const handlePlay = (mode) => {
    if (!name.trim()) return;
    setUsername(name.trim());
    setAvatar(selectedAvatar);
    if (!connected) connect();
    onNavigate(mode);
  };

  return (
    <div className="page page-center home-screen" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="home-hero">
        <motion.section
          className="home-brand"
          variants={stagger}
          initial="initial"
          animate="animate"
        >
          <motion.div className="brand-mark" variants={fadeUp} whileHover={{ rotate: [0, -8, 8, 0], transition: { duration: 0.5 } }}>
            🎭
          </motion.div>
          <motion.h1 className="home-title" variants={fadeUp}>
            <span>{t('appTitle')}</span>
          </motion.h1>
          <motion.p className="home-copy" variants={fadeUp}>
            Arabic Mafia Game · لعبة المافيا
          </motion.p>
        </motion.section>

        <motion.section
          className="home-visual"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        >
          <div className="hero-art-panel">
            <motion.img
              className="hero-art"
              src={heroArt}
              alt=""
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.05, rotate: 2 }}
            />
          </div>
        </motion.section>

        <motion.section
          className="home-panel"
          variants={stagger}
          initial="initial"
          animate="animate"
        >
          <motion.div className="language-toggle" variants={fadeUp} aria-label={t('language')}>
            <motion.button
              className={`btn btn-sm ${language === 'ar' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setLanguage('ar')}
              aria-pressed={language === 'ar'}
              whileTap={{ scale: 0.95 }}
              whileHover={{ y: -1 }}
            >
              العربية
            </motion.button>
            <motion.button
              className={`btn btn-sm ${language === 'en' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
              whileTap={{ scale: 0.95 }}
              whileHover={{ y: -1 }}
            >
              English
            </motion.button>
          </motion.div>

          <motion.div className="glass-card identity-panel" variants={scaleIn}>
            <div className="avatar-stage">
              <motion.button
                className="avatar-button"
                onClick={() => setShowAvatars(!showAvatars)}
                aria-label={language === 'ar' ? 'اختيار الصورة الرمزية' : 'Choose avatar'}
                aria-expanded={showAvatars}
                whileHover={{ scale: 1.08, boxShadow: '0 18px 56px rgba(246, 194, 71, 0.25)' }}
                whileTap={{ scale: 0.95 }}
                animate={{ borderColor: showAvatars ? 'rgba(246, 194, 71, 0.8)' : 'rgba(246, 194, 71, 0.32)' }}
              >
                <motion.span
                  key={selectedAvatar}
                  initial={{ scale: 0.5, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  {selectedAvatar}
                </motion.span>
              </motion.button>
            </div>

            <AnimatePresence>
              {showAvatars && (
                <motion.div
                  className="avatar-grid"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  {AVATARS.map((av, i) => (
                    <motion.button
                      key={av}
                      className={`avatar-option ${av === selectedAvatar ? 'active' : ''}`}
                      onClick={() => { setSelectedAvatar(av); setShowAvatars(false); }}
                      aria-label={av}
                      aria-pressed={av === selectedAvatar}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03, duration: 0.25, ease: 'backOut' }}
                      whileHover={{ scale: 1.15, y: -3 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {av}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="form-group">
              <label className="form-label">{t('enterUsername')}</label>
              <motion.input
                className="input"
                placeholder={t('enterUsername')}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePlay('create')}
                maxLength={20}
                whileFocus={{ boxShadow: '0 0 0 4px rgba(246, 194, 71, 0.18), 0 8px 32px rgba(246, 194, 71, 0.08)' }}
              />
            </div>
          </motion.div>

          <motion.div className="choice-grid" variants={stagger}>
            {[
              { mode: 'create', cls: 'btn-primary', icon: '🏠', label: t('createRoom') },
              { mode: 'join', cls: 'btn-gold', icon: '🔑', label: t('joinWithCode') },
              { mode: 'random', cls: 'btn-ghost', icon: '🎲', label: t('randomGame') },
            ].map((item, i) => (
              <motion.button
                key={item.mode}
                className={`btn ${item.cls} btn-lg btn-full choice-card`}
                onClick={() => handlePlay(item.mode)}
                variants={fadeUp}
                whileHover={{ scale: 1.02, y: -3 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.span
                  className="choice-icon"
                  aria-hidden="true"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
                >
                  {item.icon}
                </motion.span>
                <span>{item.label}</span>
              </motion.button>
            ))}
          </motion.div>

          <motion.p
            className="connection-pill"
            variants={fadeUp}
          >
            <motion.span
              className={`connection-dot ${connected ? 'on' : ''}`}
              aria-hidden="true"
              animate={connected ? { scale: [1, 1.3, 1] } : { opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span>v1.0 · {connected ? 'Connected' : 'Disconnected'}</span>
          </motion.p>
        </motion.section>
      </div>

      {/* ── Game Rules Guide ── */}
      <GameRulesPanel language={language} />
    </div>
  );
}
