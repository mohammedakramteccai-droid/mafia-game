import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from './store';
import HomeScreen from './screens/HomeScreen';
import CreateRoomScreen from './screens/CreateRoomScreen';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import ResultsScreen from './screens/ResultsScreen';
import './index.css';

const pageVariants = {
  initial: { opacity: 0, scale: 0.97, filter: 'blur(6px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, scale: 1.02, filter: 'blur(4px)', transition: { duration: 0.3, ease: 'easeIn' } },
};

function FloatingParticles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 6,
    duration: Math.random() * 8 + 10,
  }));

  return (
    <div className="floating-particles" aria-hidden="true">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.7, 0.2],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const { notification, language, connect, setRoom } = useGameStore();
  const [screen, setScreen] = useState('home');
  const [gameResult, setGameResult] = useState(null);

  useEffect(() => { connect(); }, [connect]);

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
      <div className="app-atmosphere" aria-hidden="true" />
      <FloatingParticles />

      <AnimatePresence>
        {notification && (
          <motion.div
            className={`toast toast-${notification.type}`}
            initial={{ opacity: 0, y: -30, x: '-50%', scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: -20, x: '-50%', scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {screen === 'home' && (
          <motion.div key="home" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <HomeScreen onNavigate={nav} />
          </motion.div>
        )}
        {screen === 'create' && (
          <motion.div key="create" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <CreateRoomScreen onNavigate={nav} onRoomCreated={handleRoomCreated} />
          </motion.div>
        )}
        {screen === 'join' && (
          <motion.div key="join" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <JoinScreen onNavigate={nav} onRoomJoined={handleRoomJoined} />
          </motion.div>
        )}
        {screen === 'lobby' && (
          <motion.div key="lobby" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <LobbyScreen onNavigate={nav} onGameStarted={handleGameStarted} />
          </motion.div>
        )}
        {screen === 'game' && (
          <motion.div key="game" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <GameScreen onGameOver={handleGameOver} />
          </motion.div>
        )}
        {screen === 'results' && (
          <motion.div key="results" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <ResultsScreen result={gameResult} onNavigate={nav} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
