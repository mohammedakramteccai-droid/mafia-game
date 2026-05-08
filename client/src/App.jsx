import { useState, useEffect } from 'react';
import { useGameStore } from './store';
import HomeScreen from './screens/HomeScreen';
import CreateRoomScreen from './screens/CreateRoomScreen';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import ResultsScreen from './screens/ResultsScreen';
import './index.css';

export default function App() {
  const { notification, language, connect, connected, socket, setRoom } = useGameStore();
  const [screen, setScreen] = useState('home');
  const [gameResult, setGameResult] = useState(null);

  useEffect(() => { connect(); }, []);

  const nav = (s) => setScreen(s);

  const handleRoomCreated = (res) => {
    if (res?.room) setRoom(res.room); // حفظ الغرفة فوراً من الـ callback
    setScreen('lobby');
  };

  const handleRoomJoined = (res) => {
    if (res?.room) setRoom(res.room);
    setScreen('lobby');
  };

  const handleGameStarted = () => setScreen('game');
  const handleGameOver = (result) => { setGameResult(result); setScreen('results'); };

  return (
    <div className="app-root" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {notification && (
        <div className={`toast toast-${notification.type}`}>{notification.msg}</div>
      )}
      {screen === 'home'    && <HomeScreen onNavigate={nav} />}
      {screen === 'create'  && <CreateRoomScreen onNavigate={nav} onRoomCreated={handleRoomCreated} />}
      {screen === 'join'    && <JoinScreen onNavigate={nav} onRoomJoined={handleRoomJoined} />}
      {screen === 'lobby'   && <LobbyScreen onNavigate={nav} onGameStarted={handleGameStarted} />}
      {screen === 'game'    && <GameScreen onGameOver={handleGameOver} />}
      {screen === 'results' && <ResultsScreen result={gameResult} onNavigate={nav} />}
    </div>
  );
}
