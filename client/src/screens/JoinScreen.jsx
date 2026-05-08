import { useState } from 'react';
import { useGameStore } from '../store';
import { useT } from '../utils';

export default function JoinScreen({ onNavigate, onRoomJoined, mode }) {
  const { username, avatar, language, joinRoom, socket } = useGameStore();
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
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginBottom: 16 }}
        onClick={() => onNavigate('home')}>← {language==='ar'?'رجوع':'Back'}</button>

      <div className="glass-card text-center animate-fade" style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>🔑</div>
        <h2 className="font-black text-lg mb-3">{t('joinRoom')}</h2>

        <div className="form-group mb-3">
          <label className="form-label">{t('enterRoomCode')}</label>
          <input
            className="input text-center"
            style={{ fontSize: '1.8rem', letterSpacing: '0.3em', fontFamily: 'monospace', fontWeight: 900, color: '#ffd60a' }}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={6}
            inputMode="numeric"
          />
        </div>

        {error && <p className="text-red text-sm mb-2">{error}</p>}

        <button className="btn btn-gold btn-full btn-lg" onClick={handleJoin} disabled={loading || code.length !== 6}>
          {loading ? '⏳' : '🚀'} {t('join')}
        </button>
      </div>
    </div>
  );
}
