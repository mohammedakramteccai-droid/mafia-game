import { useState, useEffect } from 'react';
import { useGameStore } from '../store';
import { useT } from '../utils';

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

  // إذا لم تكن الغرفة محملة بعد - spinner
  if (!room) {
    return (
      <div className="page page-center" dir={dir}>
        <div className="text-center animate-pulse">
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>⏳</div>
          <p className="text-muted">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page" dir={dir} style={{ paddingTop: 16 }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('home')}>←</button>
          <h2 className="font-black text-lg">{room.roomName}</h2>
        </div>
        <span style={{
          background: 'rgba(255,214,10,0.15)', border: '1px solid rgba(255,214,10,0.3)',
          borderRadius: 20, padding: '4px 12px', fontWeight: 700, fontSize: '0.9rem', color: '#ffd60a'
        }}>
          {room.players.length} / {room.maxPlayers}
        </span>
      </div>

      {/* Room Code — يظهر دائماً */}
      <div className="glass-card mb-2 text-center" style={{ borderColor: 'rgba(255,214,10,0.2)' }}>
        <p className="form-label mb-1">{t('roomCode')}</p>
        <div className="room-code" onClick={copyCode} title="انقر للنسخ">
          {room.roomCode}
        </div>
        <button className="btn btn-ghost btn-sm mt-2" onClick={copyCode}>
          {copied ? `✅ ${t('copied')}` : `📋 ${t('copyCode')}`}
        </button>
        <p className="text-muted text-sm mt-1" style={{ fontSize: '0.75rem' }}>
          {room.accessType === 'public' ? `🌐 ${t('public')}` : `🔒 ${t('private')}`}
        </p>
      </div>

      {/* Progress bar للاعبين */}
      <div className="glass-card mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="form-label">{t('players')}</span>
          <span className="text-sm text-muted">{room.players.length}/{room.maxPlayers}</span>
        </div>
        <div className="vote-bar mb-2">
          <div className="vote-bar-fill" style={{ width: `${(room.players.length / room.maxPlayers) * 100}%` }} />
        </div>
        {!canStart && (
          <p className="text-center text-sm" style={{ color: '#ffd60a' }}>
            ⏳ {language === 'ar' ? `تحتاج ${needed} لاعب${needed > 1 ? 'ين' : ''} أكثر` : `Need ${needed} more player${needed > 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* Room Settings */}
      <div className="glass-card mb-2">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat icon="👥" label={t('maxPlayers')} value={room.maxPlayers} />
          <Stat icon="🔴" label={t('mafia')} value={room.mafiaCount} />
          <Stat icon="🤖" label={t('hostType')} value={room.hostType === 'bot' ? t('botHost') : t('playerHost')} />
          <Stat icon="⏱️" label={t('discussionTime')} value={`${room.discussionTime}s`} />
        </div>
        {/* Enabled Cards */}
        <div className="flex gap-1 mt-2" style={{ flexWrap: 'wrap' }}>
          {room.enabledCards?.vigilante && <CardBadge emoji="🔫" label={t('vigilante')} />}
          {room.enabledCards?.silencer  && <CardBadge emoji="🤐" label={t('silencer')} />}
          {room.enabledCards?.mayor     && <CardBadge emoji="👑" label={t('mayor')} />}
          {room.enabledCards?.goodBoy   && <CardBadge emoji="😇" label={t('goodBoy')} />}
        </div>
      </div>

      {/* Players List */}
      <div className="glass-card" style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
        <div className="form-label mb-2">{t('players')} ({room.players.length})</div>
        <div className="flex flex-col gap-1">
          {room.players.map((p, i) => (
            <div key={p.id} className="player-chip" style={{ animationDelay: `${i * 50}ms` }}>
              <span className="player-avatar">{p.avatar || '👤'}</span>
              <span className="player-name">{p.username}</span>
              {p.isHost && <span className="player-badge badge-host">👑 {t('host')}</span>}
              {p.username === username && !p.isHost && <span className="player-badge badge-you">{t('you')}</span>}
            </div>
          ))}
          {/* Placeholders للأماكن الفارغة */}
          {Array.from({ length: Math.max(0, minPlayers - room.players.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="player-chip" style={{ opacity: 0.25, border: '1px dashed rgba(255,255,255,0.1)' }}>
              <span className="player-avatar">👤</span>
              <span className="player-name text-muted" style={{ fontSize: '0.85rem' }}>
                {language === 'ar' ? 'في انتظار لاعب...' : 'Waiting for player...'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Start button (host) */}
      {isHost && (
        <button
          className={`btn btn-lg btn-full ${canStart ? 'btn-primary animate-glow' : 'btn-ghost'}`}
          onClick={handleStart}
          disabled={starting || !canStart}
        >
          {starting ? '⏳' : '▶'} {t('startGame')}
        </button>
      )}

      {/* Waiting (non-host) */}
      {!isHost && (
        <div className="glass-card text-center animate-pulse">
          <p className="text-muted">⏳ {t('waitingPlayers')}...</p>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ fontSize: '0.75rem', color: '#8888aa' }}>{icon} {label}</div>
      <div style={{ fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function CardBadge({ emoji, label }) {
  return (
    <span style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '4px 10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
      {emoji} {label && <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{label}</span>}
    </span>
  );
}
