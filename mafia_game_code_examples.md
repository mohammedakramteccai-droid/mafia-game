# 💻 أمثلة الكود الفعلية - Mafia Game

---

## 🔧 Backend - Game Logic (Node.js)

### 1. Model الغرفة (Room Model)

```javascript
// models/Room.js
const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      unique: true,
      required: true,
      length: 6
    },
    roomName: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 50
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    accessType: {
      type: String,
      enum: ['public', 'private'],
      default: 'private'
    },
    hostType: {
      type: String,
      enum: ['player', 'bot'],
      default: 'bot'
    },
    maxPlayers: {
      type: Number,
      min: 4,
      max: 15,
      default: 8
    },
    mafiaCount: {
      type: Number,
      min: 1,
      max: 5,
      default: 2
    },
    language: {
      type: String,
      enum: ['ar', 'en'],
      default: 'ar'
    },
    enabledCards: {
      vigilante: { type: Boolean, default: false },
      silencer: { type: Boolean, default: false },
      mayor: { type: Boolean, default: false },
      goodBoy: { type: Boolean, default: false }
    },
    players: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    status: {
      type: String,
      enum: ['waiting', 'in_progress', 'finished'],
      default: 'waiting'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    gameStartedAt: Date,
    gameEndedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
```

### 2. Service منطق اللعبة (Game Logic Service)

```javascript
// services/gameLogic.js
class GameLogicService {
  
  // توزيع البطاقات
  static distributeCards(playerCount, roomSettings) {
    const cards = [];
    
    // البطاقات الإلزامية
    for (let i = 0; i < roomSettings.mafiaCount; i++) {
      cards.push('mafia');
    }
    cards.push('detective');
    cards.push('doctor');
    
    // البطاقات الاختيارية
    if (roomSettings.enabledCards.vigilante) {
      cards.push('vigilante');
    }
    if (roomSettings.enabledCards.silencer) {
      cards.push('silencer');
    }
    if (roomSettings.enabledCards.mayor) {
      cards.push('mayor');
    }
    if (roomSettings.enabledCards.goodBoy) {
      cards.push('goodBoy');
    }
    
    // ملء البقية بـ villager
    const remaining = playerCount - cards.length;
    for (let i = 0; i < remaining; i++) {
      cards.push('villager');
    }
    
    // خلط عشوائي
    return this.shuffle(cards);
  }
  
  // خوارزمية Fisher-Yates للخلط
  static shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  
  // فحص نهاية اللعبة
  static checkGameEnd(players) {
    const aliveMafia = players.filter(p => 
      p.card === 'mafia' && p.isAlive
    );
    
    const aliveVillagers = players.filter(p => 
      p.card !== 'mafia' && p.isAlive
    );
    
    // جميع المافيا قُتلوا
    if (aliveMafia.length === 0) {
      return {
        gameEnded: true,
        winners: aliveVillagers.map(p => p.userId),
        winType: 'villager_victory'
      };
    }
    
    // المافيا تساوي أو تفوق المواطنين
    if (aliveMafia.length >= aliveVillagers.length) {
      return {
        gameEnded: true,
        winners: aliveMafia.map(p => p.userId),
        winType: 'mafia_victory'
      };
    }
    
    return { gameEnded: false };
  }
  
  // حساب الأصوات
  static tallyVotes(votes, players) {
    const voteCount = {};
    
    votes.forEach(vote => {
      const voter = players.find(p => p.userId === vote.voterId);
      const targetId = vote.targetId.toString();
      
      // العمدة لديه 3 أصوات
      const voteWeight = voter.card === 'mayor' ? 3 : 1;
      
      voteCount[targetId] = (voteCount[targetId] || 0) + voteWeight;
    });
    
    // جد الأعلى
    const maxVotes = Math.max(...Object.values(voteCount));
    const votedOut = Object.keys(voteCount)
      .filter(k => voteCount[k] === maxVotes)
      .map(k => k);
    
    return {
      voteCount,
      votedOut,
      isTie: votedOut.length > 1
    };
  }
  
  // الحصول على الأهداف الصالحة
  static getValidTargets(player, players, game) {
    const aliveOtherPlayers = players.filter(p =>
      p.isAlive && p.userId !== player.userId
    );
    
    // المافيا لا تستطيع قتل نفسها
    if (player.card === 'mafia') {
      return aliveOtherPlayers.filter(p => p.card !== 'mafia');
    }
    
    // باقي الأدوار يمكنها اختيار أي شخص حي
    return aliveOtherPlayers;
  }
}

module.exports = GameLogicService;
```

### 3. Socket.io Handlers (معالجات الأحداث)

```javascript
// socket/handlers.js
const GameLogicService = require('../services/gameLogic');
const Game = require('../models/Game');

class SocketHandlers {
  
  static setupHandlers(io) {
    io.on('connection', (socket) => {
      
      // الانضمام لروم
      socket.on('joinRoom', async (data) => {
        try {
          const { roomCode, userId } = data;
          const game = await Game.findOne({ roomCode });
          
          if (!game) {
            socket.emit('error', { message: 'Room not found' });
            return;
          }
          
          if (game.players.length >= game.maxPlayers) {
            socket.emit('error', { message: 'Room is full' });
            return;
          }
          
          // إضافة اللاعب
          game.players.push({
            userId,
            socketId: socket.id,
            isAlive: true,
            card: null
          });
          
          socket.join(game.roomCode);
          await game.save();
          
          io.to(game.roomCode).emit('playerJoined', {
            playerCount: game.players.length,
            maxPlayers: game.maxPlayers
          });
          
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });
      
      // بدء اللعبة
      socket.on('startGame', async (data) => {
        try {
          const { roomCode } = data;
          const game = await Game.findOne({ roomCode });
          
          if (game.players.length < 4) {
            socket.emit('error', { message: 'Need at least 4 players' });
            return;
          }
          
          // توزيع البطاقات
          const cards = GameLogicService.distributeCards(
            game.players.length,
            game.enabledCards
          );
          
          game.players.forEach((player, index) => {
            player.card = cards[index];
          });
          
          game.status = 'in_progress';
          game.currentPhase = 'night';
          game.round = 1;
          await game.save();
          
          // إرسال البطاقات الخاصة لكل لاعب
          game.players.forEach(player => {
            io.to(player.socketId).emit('gameStarted', {
              card: player.card,
              players: game.players.map(p => ({
                id: p.userId,
                username: p.username,
                isAlive: p.isAlive
              }))
            });
          });
          
          // بدء مرحلة الليل
          this.startNightPhase(io, game);
          
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });
      
      // المافيا تختار ضحية
      socket.on('selectVictim', async (data) => {
        try {
          const { roomCode, targetId } = data;
          const game = await Game.findOne({ roomCode });
          const player = game.players.find(p => p.socketId === socket.id);
          
          if (player.card !== 'mafia') {
            throw new Error('You are not mafia');
          }
          
          game.nightActions.push({
            action: 'kill',
            actor: player.userId,
            target: targetId,
            timestamp: new Date()
          });
          
          await game.save();
          socket.emit('actionRegistered', { action: 'victim_selected' });
          
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });
      
      // المختار يكتشف لاعب
      socket.on('detectPlayer', async (data) => {
        try {
          const { roomCode, targetId } = data;
          const game = await Game.findOne({ roomCode });
          const player = game.players.find(p => p.socketId === socket.id);
          
          if (player.card !== 'detective') {
            throw new Error('You are not detective');
          }
          
          const target = game.players.find(p => p.userId === targetId);
          
          socket.emit('detectionResult', {
            result: target.card === 'mafia' ? 'mafia' : 'villager'
          });
          
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });
      
      // التصويت
      socket.on('vote', async (data) => {
        try {
          const { roomCode, targetId } = data;
          const game = await Game.findOne({ roomCode });
          
          if (game.currentPhase !== 'voting') {
            throw new Error('Not voting phase');
          }
          
          const voter = game.players.find(p => p.socketId === socket.id);
          
          game.votes.push({
            voter: voter.userId,
            target: targetId,
            timestamp: new Date()
          });
          
          await game.save();
          
          // تحديث عدد الأصوات المسجلة
          io.to(roomCode).emit('voteRegistered', {
            votesReceived: game.votes.length,
            totalNeeded: game.players.filter(p => p.isAlive).length
          });
          
          // إذا صوّت الجميع
          if (game.votes.length === game.players.filter(p => p.isAlive).length) {
            this.processVotes(io, game);
          }
          
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });
      
      socket.on('disconnect', async () => {
        // معالجة فراغ من الروم
      });
    });
  }
  
  static startNightPhase(io, game) {
    io.to(game.roomCode).emit('nightPhase', {
      round: game.round,
      message: game.language === 'ar' 
        ? 'أغمضوا عينكم' 
        : 'Close your eyes'
    });
  }
  
  static processVotes(io, game) {
    const voteResult = GameLogicService.tallyVotes(
      game.votes,
      game.players
    );
    
    if (voteResult.isTie) {
      io.to(game.roomCode).emit('tie', {
        players: voteResult.votedOut
      });
      // لعبة إعادة تصويت
    } else {
      const eliminatedId = voteResult.votedOut[0];
      const eliminated = game.players.find(p => p.userId === eliminatedId);
      
      io.to(game.roomCode).emit('playerEliminated', {
        playerName: eliminated.username,
        card: eliminated.card
      });
    }
  }
}

module.exports = SocketHandlers;
```

---

## ⚛️ Frontend - React Components

### 1. Hook لإدارة اللعبة

```javascript
// hooks/useGame.js
import { useState, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';

const useGame = () => {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState({
    currentPhase: 'waiting',
    players: [],
    myCard: null,
    votes: 0,
    isAlive: true
  });
  
  const [room, setRoom] = useState({
    roomCode: null,
    roomName: null,
    maxPlayers: 8,
    mafiaCount: 2
  });
  
  // الاتصال بـ Socket.io
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_SERVER_URL);
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
    });
    
    newSocket.on('gameStarted', (data) => {
      setGameState(prev => ({
        ...prev,
        myCard: data.card,
        players: data.players
      }));
    });
    
    newSocket.on('nightPhase', (data) => {
      setGameState(prev => ({
        ...prev,
        currentPhase: 'night'
      }));
    });
    
    newSocket.on('dayPhase', (data) => {
      setGameState(prev => ({
        ...prev,
        currentPhase: 'day'
      }));
    });
    
    newSocket.on('votingPhase', () => {
      setGameState(prev => ({
        ...prev,
        currentPhase: 'voting'
      }));
    });
    
    newSocket.on('playerEliminated', (data) => {
      setGameState(prev => ({
        ...prev,
        players: prev.players.map(p =>
          p.id === data.playerId
            ? { ...p, isAlive: false }
            : p
        )
      }));
    });
    
    newSocket.on('gameEnded', (data) => {
      setGameState(prev => ({
        ...prev,
        currentPhase: 'ended',
        winners: data.winners
      }));
    });
    
    setSocket(newSocket);
    
    return () => newSocket.disconnect();
  }, []);
  
  // الانضمام للروم
  const joinRoom = useCallback((roomCode) => {
    socket?.emit('joinRoom', { roomCode });
  }, [socket]);
  
  // إنشاء روم
  const createRoom = useCallback((roomData) => {
    socket?.emit('createRoom', roomData);
  }, [socket]);
  
  // بدء اللعبة
  const startGame = useCallback(() => {
    socket?.emit('startGame', { roomCode: room.roomCode });
  }, [socket, room.roomCode]);
  
  // اختيار ضحية (المافيا)
  const selectVictim = useCallback((targetId) => {
    socket?.emit('selectVictim', {
      roomCode: room.roomCode,
      targetId
    });
  }, [socket, room.roomCode]);
  
  // كشف لاعب (المختار)
  const detectPlayer = useCallback((targetId) => {
    socket?.emit('detectPlayer', {
      roomCode: room.roomCode,
      targetId
    });
  }, [socket, room.roomCode]);
  
  // حماية لاعب (الطبيب)
  const protectPlayer = useCallback((targetId) => {
    socket?.emit('protectPlayer', {
      roomCode: room.roomCode,
      targetId
    });
  }, [socket, room.roomCode]);
  
  // التصويت
  const vote = useCallback((targetId) => {
    socket?.emit('vote', {
      roomCode: room.roomCode,
      targetId
    });
  }, [socket, room.roomCode]);
  
  return {
    gameState,
    room,
    setRoom,
    joinRoom,
    createRoom,
    startGame,
    selectVictim,
    detectPlayer,
    protectPlayer,
    vote,
    socket
  };
};

export default useGame;
```

### 2. مكون شاشة اللعبة

```javascript
// components/GameScreen/GameScreen.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useGame from '../../hooks/useGame';

const GameScreen = () => {
  const { t, i18n } = useTranslation();
  const { gameState, selectVictim, detectPlayer, protectPlayer, vote } = useGame();
  const [selectedTarget, setSelectedTarget] = useState(null);
  
  const getCardDescription = (card) => {
    const descriptions = {
      mafia: t('roles.mafia'),
      detective: t('roles.detective'),
      doctor: t('roles.doctor'),
      vigilante: t('roles.vigilante'),
      silencer: t('roles.silencer'),
      mayor: t('roles.mayor'),
      goodBoy: t('roles.goodBoy'),
      villager: t('roles.villager')
    };
    return descriptions[card];
  };
  
  const handleAction = () => {
    if (!selectedTarget) return;
    
    switch(gameState.myCard) {
      case 'mafia':
        selectVictim(selectedTarget);
        break;
      case 'detective':
        detectPlayer(selectedTarget);
        break;
      case 'doctor':
        protectPlayer(selectedTarget);
        break;
      case 'vigilante':
        selectVictim(selectedTarget);
        break;
      case 'silencer':
        // mutePlayer(selectedTarget);
        break;
      default:
        vote(selectedTarget);
    }
    
    setSelectedTarget(null);
  };
  
  if (gameState.currentPhase === 'waiting') {
    return <div>{t('messages.waitingForPlayers')}</div>;
  }
  
  if (!gameState.myCard) {
    return <div>{t('messages.loading')}</div>;
  }
  
  const isNightPhase = gameState.currentPhase === 'night';
  const isDayPhase = gameState.currentPhase === 'day';
  const isVotingPhase = gameState.currentPhase === 'voting';
  
  const getValidTargets = () => {
    return gameState.players.filter(p =>
      p.isAlive && p.id !== 'myId' // استبدل بـ user id
    );
  };
  
  return (
    <div className={`game-screen ${i18n.language}`} dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* عرض البطاقة */}
      <div className="card-display">
        <div className="my-card">
          <h2>{t('common.yourRole')}</h2>
          <div className="card-name">{getCardDescription(gameState.myCard)}</div>
        </div>
      </div>
      
      {/* المرحلة الحالية */}
      <div className="phase-info">
        {isNightPhase && (
          <div className="night-phase">
            <h3>{t('phases.nightPhase')}</h3>
            <p>{t('messages.closeYourEyes')}</p>
          </div>
        )}
        
        {isDayPhase && (
          <div className="day-phase">
            <h3>{t('phases.dayPhase')}</h3>
            <p>{t('messages.discussion')}</p>
          </div>
        )}
        
        {isVotingPhase && (
          <div className="voting-phase">
            <h3>{t('phases.votingPhase')}</h3>
            <p>{t('messages.selectWhoToEliminate')}</p>
          </div>
        )}
      </div>
      
      {/* قائمة اللاعبين */}
      <div className="players-list">
        <h3>{t('common.players')}</h3>
        <div className="players-grid">
          {getValidTargets().map(player => (
            <div
              key={player.id}
              className={`player-card ${!player.isAlive ? 'dead' : ''} ${
                selectedTarget === player.id ? 'selected' : ''
              }`}
              onClick={() => setSelectedTarget(player.id)}
            >
              <div className="player-name">{player.username}</div>
              <div className="player-status">
                {player.isAlive ? t('common.alive') : t('common.dead')}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* زر الإجراء */}
      {selectedTarget && (
        <button
          className="action-button"
          onClick={handleAction}
        >
          {isNightPhase && gameState.myCard === 'mafia' && t('messages.selectVictim')}
          {isNightPhase && gameState.myCard === 'detective' && t('messages.detect')}
          {isNightPhase && gameState.myCard === 'doctor' && t('messages.protect')}
          {isVotingPhase && t('messages.vote')}
        </button>
      )}
    </div>
  );
};

export default GameScreen;
```

### 3. مكون إنشاء الروم

```javascript
// components/CreateRoom/CreateRoom.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useGame from '../../hooks/useGame';

const CreateRoom = ({ onRoomCreated }) => {
  const { t, i18n } = useTranslation();
  const { createRoom } = useGame();
  
  const [formData, setFormData] = useState({
    roomName: '',
    accessType: 'private',
    hostType: 'bot',
    maxPlayers: 8,
    mafiaCount: 2,
    enabledCards: {
      vigilante: false,
      silencer: false,
      mayor: true,
      goodBoy: true
    }
  });
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('enabledCards.')) {
      const cardName = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        enabledCards: {
          ...prev.enabledCards,
          [cardName]: checked
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    createRoom(formData);
    onRoomCreated();
  };
  
  return (
    <div className="create-room" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <h2>{t('createRoom.title')}</h2>
      
      <form onSubmit={handleSubmit}>
        
        {/* اسم الروم */}
        <div className="form-group">
          <label>{t('createRoom.roomName')}</label>
          <input
            type="text"
            name="roomName"
            value={formData.roomName}
            onChange={handleChange}
            placeholder={t('createRoom.roomNamePlaceholder')}
            required
          />
        </div>
        
        {/* نمط الوصول */}
        <div className="form-group">
          <label>{t('createRoom.accessType')}</label>
          <select
            name="accessType"
            value={formData.accessType}
            onChange={handleChange}
          >
            <option value="private">{t('createRoom.private')}</option>
            <option value="public">{t('createRoom.public')}</option>
          </select>
        </div>
        
        {/* نوع الهوست */}
        <div className="form-group">
          <label>{t('createRoom.hostType')}</label>
          <select
            name="hostType"
            value={formData.hostType}
            onChange={handleChange}
          >
            <option value="bot">{t('createRoom.botHost')}</option>
            <option value="player">{t('createRoom.playerHost')}</option>
          </select>
        </div>
        
        {/* عدد اللاعبين */}
        <div className="form-group">
          <label>{t('createRoom.maxPlayers')}</label>
          <input
            type="number"
            name="maxPlayers"
            value={formData.maxPlayers}
            onChange={handleChange}
            min="4"
            max="15"
          />
        </div>
        
        {/* عدد المافيا */}
        <div className="form-group">
          <label>{t('createRoom.mafiaCount')}</label>
          <input
            type="number"
            name="mafiaCount"
            value={formData.mafiaCount}
            onChange={handleChange}
            min="1"
            max="5"
          />
        </div>
        
        {/* البطاقات الإضافية */}
        <div className="form-group">
          <label>{t('createRoom.enabledCards')}</label>
          
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                name="enabledCards.vigilante"
                checked={formData.enabledCards.vigilante}
                onChange={handleChange}
              />
              {t('roles.vigilante')}
            </label>
            
            <label>
              <input
                type="checkbox"
                name="enabledCards.silencer"
                checked={formData.enabledCards.silencer}
                onChange={handleChange}
              />
              {t('roles.silencer')}
            </label>
            
            <label>
              <input
                type="checkbox"
                name="enabledCards.mayor"
                checked={formData.enabledCards.mayor}
                onChange={handleChange}
              />
              {t('roles.mayor')}
            </label>
            
            <label>
              <input
                type="checkbox"
                name="enabledCards.goodBoy"
                checked={formData.enabledCards.goodBoy}
                onChange={handleChange}
              />
              {t('roles.goodBoy')}
            </label>
          </div>
        </div>
        
        <button type="submit" className="btn-primary">
          {t('common.create')}
        </button>
      </form>
    </div>
  );
};

export default CreateRoom;
```

---

## 🌍 ملف اللغات - i18n Configuration

```javascript
// locales/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';
import en from './en.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en }
    },
    lng: localStorage.getItem('language') || 'ar',
    fallbackLng: 'ar',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
```

---

## 📝 ملف اللغات العربية

```json
{
  "common": {
    "create": "إنشاء",
    "join": "الانضمام",
    "start": "بدء",
    "cancel": "إلغاء",
    "loading": "جاري التحميل...",
    "error": "خطأ",
    "success": "نجح",
    "yourRole": "دورك في اللعبة",
    "players": "اللاعبون",
    "alive": "حي",
    "dead": "متوفي"
  },
  "home": {
    "title": "لعبة المافيا العربية",
    "createRoom": "إنشاء روم جديد",
    "joinWithCode": "الانضمام برمز",
    "randomGame": "لعبة عشوائية"
  },
  "createRoom": {
    "title": "إنشاء غرفة جديدة",
    "roomName": "اسم الغرفة",
    "roomNamePlaceholder": "أدخل اسم الغرفة",
    "accessType": "نوع الوصول",
    "private": "خاص (Private)",
    "public": "عام (Public)",
    "hostType": "نوع المدير",
    "botHost": "بوت (آلي)",
    "playerHost": "لاعب",
    "maxPlayers": "الحد الأقصى للاعبين",
    "mafiaCount": "عدد المافيا",
    "enabledCards": "البطاقات المفعلة"
  },
  "roles": {
    "mafia": "المافيا",
    "detective": "المختار",
    "doctor": "الطبيب",
    "vigilante": "المواطن القناص",
    "silencer": "القاتل الصامت",
    "mayor": "عمدة المواطنين",
    "goodBoy": "الولد الصالح",
    "villager": "مواطن عادي"
  },
  "phases": {
    "nightPhase": "مرحلة الليل",
    "dayPhase": "مرحلة النهار",
    "votingPhase": "مرحلة التصويت"
  },
  "messages": {
    "closeYourEyes": "أغمضوا عينكم",
    "openYourEyes": "افتحوا عينكم",
    "selectVictim": "اختاروا فريستكم",
    "detect": "اكتشف",
    "protect": "احمِ",
    "vote": "صوّت",
    "waitingForPlayers": "جاري انتظار اللاعبين",
    "playerEliminated": "تم إقصاء {playerName}",
    "discussion": "فترة المناقشة الحرة",
    "selectWhoToEliminate": "اختر من تريد إقصاؤه"
  }
}
```

---

**هذه الأمثلة جاهزة للاستخدام الفوري والتطوير!**
