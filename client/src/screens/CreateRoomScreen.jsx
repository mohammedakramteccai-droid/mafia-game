import { useState } from 'react';
import { useGameStore } from '../store';
import { useT } from '../utils';

const DEFAULT_SETTINGS = {
  roomName: '',
  accessType: 'public',
  hostType: 'bot',
  maxPlayers: 8,
  mafiaCount: 2,
  discussionTime: 180,
  enabledCards: { vigilante: false, silencer: false, mayor: false, goodBoy: false },
};

const OPTIONAL_CARDS = [
  { key: 'vigilante', emoji: '🔫', nameAr: 'القناص', nameEn: 'Vigilante' },
  { key: 'silencer',  emoji: '🤐', nameAr: 'القاتل الصامت', nameEn: 'Silencer' },
  { key: 'mayor',     emoji: '👑', nameAr: 'العمدة', nameEn: 'Mayor' },
  { key: 'goodBoy',   emoji: '😇', nameAr: 'الولد الصالح', nameEn: 'Good Boy' },
];

export default function CreateRoomScreen({ onNavigate, onRoomCreated }) {
  const { username, avatar, language, socket, createRoom } = useGameStore();
  const t = useT(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, roomName: `غرفة ${username}` });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));
  const toggleCard = (key) => setSettings(s => ({
    ...s, enabledCards: { ...s.enabledCards, [key]: !s.enabledCards[key] }
  }));

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
    <div className="page" dir={dir} style={{ paddingTop: 16 }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('home')}>←</button>
        <h2 className="font-black text-lg">{t('createRoom')}</h2>
      </div>

      <div className="flex flex-col gap-2" style={{ overflowY: 'auto', paddingBottom: 80 }}>
        {/* Room Name */}
        <div className="glass-card">
          <div className="form-group">
            <label className="form-label">{t('roomName')}</label>
            <input className="input" value={settings.roomName} onChange={e => set('roomName', e.target.value)} maxLength={30} />
          </div>
        </div>

        {/* Access & Host Type */}
        <div className="glass-card">
          <div className="grid-2">
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
        </div>

        {/* Player counts */}
        <div className="glass-card">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{t('maxPlayers')} ({settings.maxPlayers})</label>
              <input type="range" min={4} max={15} value={settings.maxPlayers}
                onChange={e => set('maxPlayers', +e.target.value)}
                style={{ width: '100%', accentColor: '#e63946' }} />
              <div className="flex justify-between text-sm text-muted"><span>4</span><span>15</span></div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('mafiaCount')} ({settings.mafiaCount})</label>
              <input type="range" min={1} max={Math.max(1, Math.floor(settings.maxPlayers / 3))}
                value={settings.mafiaCount}
                onChange={e => set('mafiaCount', +e.target.value)}
                style={{ width: '100%', accentColor: '#e63946' }} />
              <div className="flex justify-between text-sm text-muted"><span>1</span><span>{Math.floor(settings.maxPlayers/3)}</span></div>
            </div>
          </div>
          <div className="form-group mt-2">
            <label className="form-label">{t('discussionTime')} ({settings.discussionTime}s)</label>
            <input type="range" min={60} max={600} step={30} value={settings.discussionTime}
              onChange={e => set('discussionTime', +e.target.value)}
              style={{ width: '100%', accentColor: '#ffd60a' }} />
            <div className="flex justify-between text-sm text-muted"><span>1m</span><span>10m</span></div>
          </div>
        </div>

        {/* Optional Cards */}
        <div className="glass-card">
          <div className="form-label mb-2">{t('extraCards')}</div>
          <div className="flex flex-col gap-1">
            {OPTIONAL_CARDS.map(card => (
              <div key={card.key} className="toggle-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.3rem' }}>{card.emoji}</span>
                  <span className="font-bold">{language === 'ar' ? card.nameAr : card.nameEn}</span>
                </span>
                <button
                  className={`toggle ${settings.enabledCards[card.key] ? 'on' : ''}`}
                  onClick={() => toggleCard(card.key)}
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-red text-center text-sm">{error}</p>}

        <button className="btn btn-primary btn-lg btn-full mt-2" onClick={handleCreate} disabled={loading}>
          {loading ? '⏳' : '🚀'} {t('create')}
        </button>
      </div>
    </div>
  );
}
