import { useGameStore } from '../store';
import { useT, CARD_INFO } from '../utils';

export default function ResultsScreen({ result, onNavigate }) {
  const { language, clearRoom } = useGameStore();
  const t = useT(language);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  if (!result) return null;

  const isMafiaWin = result.winner === 'mafia';

  const handlePlayAgain = () => {
    clearRoom();
    onNavigate('home');
  };

  return (
    <div className="page page-center" dir={dir}>
      {/* Winner Banner */}
      <div style={{
        textAlign: 'center', padding: '32px 24px', marginBottom: 24,
        background: isMafiaWin
          ? 'linear-gradient(135deg,rgba(230,57,70,0.15),rgba(150,10,20,0.2))'
          : 'linear-gradient(135deg,rgba(15,244,198,0.1),rgba(72,149,239,0.15))',
        border: `1px solid ${isMafiaWin ? 'rgba(230,57,70,0.4)' : 'rgba(15,244,198,0.4)'}`,
        borderRadius: 24,
        boxShadow: isMafiaWin ? '0 0 60px rgba(230,57,70,0.2)' : '0 0 60px rgba(15,244,198,0.15)',
        animation: 'fadeIn 0.6s ease',
      }}>
        <div style={{ fontSize: '5rem', marginBottom: 12 }}>
          {isMafiaWin ? '🔴' : '✅'}
        </div>
        <h1 className="font-black" style={{ fontSize: '2rem', marginBottom: 8 }}>
          {isMafiaWin ? t('mafiaWins') : t('citizensWin')}
        </h1>
        <p className="text-muted">{t('gameOver')}</p>
      </div>

      {/* Players reveal */}
      <div className="glass-card" style={{ marginBottom: 20, width: '100%' }}>
        <div className="form-label mb-2">🃏 {t('revealCards')}</div>
        <div className="flex flex-col gap-1">
          {result.players?.map(p => {
            const ci = CARD_INFO[p.card] || {};
            return (
              <div key={p.id} className={`player-chip ${!p.isAlive ? 'dead' : ''}`}
                style={{ borderColor: p.isAlive ? ci.color + '44' : 'transparent' }}>
                <span className="player-avatar">{p.avatar || '👤'}</span>
                <span className="player-name">{p.username}</span>
                <span style={{ fontSize: '1.2rem' }}>{ci.emoji}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: ci.color }}>{t(p.card)}</span>
                {!p.isAlive && <span className="player-badge badge-dead">💀</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <button className="btn btn-primary btn-lg btn-full" onClick={handlePlayAgain}>
          🔄 {t('playAgain')}
        </button>
        <button className="btn btn-ghost btn-full" onClick={handlePlayAgain}>
          🏠 {t('backHome')}
        </button>
      </div>
    </div>
  );
}
