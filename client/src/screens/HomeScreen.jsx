import { useState } from 'react';
import { useGameStore } from '../store';
import { useT, AVATARS } from '../utils';

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
    <div className="page page-center" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="text-center animate-fade mb-4">
        <div style={{ fontSize: '5rem', marginBottom: 8 }}>🎭</div>
        <h1 className="font-black text-xl" style={{ fontSize: '2.4rem', background: 'linear-gradient(135deg,#e63946,#ffd60a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {t('appTitle')}
        </h1>
        <p className="text-muted mt-1">Arabic Mafia Game · لعبة المافيا</p>
      </div>

      {/* Language Toggle */}
      <div className="flex justify-center gap-1 mb-3">
        <button className={`btn btn-sm ${language==='ar'?'btn-primary':'btn-ghost'}`} onClick={() => setLanguage('ar')}>العربية</button>
        <button className={`btn btn-sm ${language==='en'?'btn-primary':'btn-ghost'}`} onClick={() => setLanguage('en')}>English</button>
      </div>

      {/* Username Input */}
      <div className="glass-card animate-fade mb-3">
        {/* Avatar Picker */}
        <div className="flex justify-center mb-3">
          <button
            onClick={() => setShowAvatars(!showAvatars)}
            style={{ fontSize: '3.5rem', background: 'none', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 80, height: 80, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {selectedAvatar}
          </button>
        </div>
        {showAvatars && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
            {AVATARS.map(av => (
              <button key={av} onClick={() => { setSelectedAvatar(av); setShowAvatars(false); }}
                style={{ fontSize: '1.8rem', background: av===selectedAvatar?'rgba(230,57,70,0.2)':'none', border: `2px solid ${av===selectedAvatar?'#e63946':'transparent'}`, borderRadius: 10, width: 48, height: 48, cursor: 'pointer', transition: 'all 0.2s' }}>
                {av}
              </button>
            ))}
          </div>
        )}
        <div className="form-group">
          <label className="form-label">{t('enterUsername')}</label>
          <input
            className="input"
            placeholder={t('enterUsername')}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePlay('create')}
            maxLength={20}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 animate-fade">
        <button className="btn btn-primary btn-lg btn-full" onClick={() => handlePlay('create')}>
          🏠 {t('createRoom')}
        </button>
        <button className="btn btn-gold btn-lg btn-full" onClick={() => handlePlay('join')}>
          🔑 {t('joinWithCode')}
        </button>
        <button className="btn btn-ghost btn-lg btn-full" onClick={() => handlePlay('random')}>
          🎲 {t('randomGame')}
        </button>
      </div>

      <p className="text-center text-muted text-sm mt-3" style={{ opacity: 0.5 }}>v1.0 · {connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
    </div>
  );
}
