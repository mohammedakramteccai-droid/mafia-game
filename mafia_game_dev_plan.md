# 🎮 خطة التطوير الشاملة - لعبة المافيا العربية
## Comprehensive Development Plan - Mafia Game Arabic Edition

---

## 📐 البنية المعمارية (Architecture)

```
┌─────────────────────────────────────────┐
│         Frontend (React.js)             │
│  ┌─────────────────────────────────────┤
│  │ Components | Pages | Hooks | Utils   │
│  │ Socket.io Client | i18n Setup       │
│  └─────────────────────────────────────┤
└────────────┬──────────────────────────┘
             │ Socket.io / REST API
┌────────────▼──────────────────────────┐
│      Backend (Node.js + Express)      │
│  ┌─────────────────────────────────────┤
│  │ Game Logic | Player Management      │
│  │ Room Management | Card Distribution │
│  │ Socket.io Server | Authentication   │
│  └─────────────────────────────────────┤
└────────────┬──────────────────────────┘
             │
┌────────────▼──────────────────────────┐
│       Database (MongoDB)              │
│  • Users • Rooms • Games • Stats      │
└─────────────────────────────────────┘
```

---

## 🗂️ هيكل المشروع

```
mafia-game-arabic/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/
│   │   │   ├── Home/
│   │   │   ├── CreateRoom/
│   │   │   ├── RoomLobby/
│   │   │   ├── GameScreen/
│   │   │   ├── Results/
│   │   │   └── shared/
│   │   ├── pages/
│   │   ├── hooks/
│   │   │   ├── useGame.js
│   │   │   ├── useSocket.js
│   │   │   └── useAuth.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── socket.js
│   │   ├── store/ (Redux or Context)
│   │   ├── locales/ (i18n)
│   │   │   ├── ar.json
│   │   │   └── en.json
│   │   ├── styles/
│   │   ├── utils/
│   │   └── App.js
│   ├── package.json
│   └── .env
│
├── backend/
│   ├── src/
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Room.js
│   │   │   ├── Game.js
│   │   │   └── Stats.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── rooms.js
│   │   │   └── games.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── roomController.js
│   │   │   └── gameController.js
│   │   ├── services/
│   │   │   ├── gameLogic.js
│   │   │   ├── roomManager.js
│   │   │   ├── cardDistribution.js
│   │   │   └── scoreCalculator.js
│   │   ├── socket/
│   │   │   ├── handlers.js
│   │   │   └── events.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── validation.js
│   │   ├── config/
│   │   │   └── db.js
│   │   └── app.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
└── docs/
    ├── API.md
    ├── GAME_LOGIC.md
    └── DEPLOYMENT.md
```

---

## 🔌 Socket.io Events (الأحداث)

### من الكلاينت إلى السيرفر:

```javascript
// إدارة الروم
'createRoom' → { roomName, accessType, hostType, maxPlayers, ... }
'joinRoom' → { roomCode or roomId }
'leaveRoom' → {}
'startGame' → {} (من صاحب الروم فقط)

// اللعبة الليلية
'selectVictim' → { playerId } (المافيا)
'detectPlayer' → { playerId } (المختار)
'protectPlayer' → { playerId } (الطبيب)
'killPlayer' → { playerId } (القناص)
'mutePlayer' → { playerId } (القاتل الصامت)
'selectGoodBoyTarget' → { playerId } (الولد الصالح)

// مرحلة النهار
'vote' → { playerId }
'revote' → {} (في حالة التعادل)

// الدردشة
'sendMessage' → { message, type } (type: 'chat' or 'action')
```

### من السيرفر إلى الكلاينت:

```javascript
// تحديثات الروم
'roomUpdated' → { room }
'playerJoined' → { player, count }
'playerLeft' → { player, count }
'gameStarting' → {}
'gameStarted' → { players, cards, gamePhase }

// تحديثات اللعبة
'nightPhase' → { phase: 'night', round }
'dayPhase' → { phase: 'day', round, deadPlayer }
'votingPhase' → { phase: 'voting', remainingPlayers }
'yourTurn' → { action: 'select', role, targets }
'gameEnded' → { winners, losers, stats }

// الإشعارات
'notification' → { message, type, duration }
'playerEliminated' → { player, reason }
'playerMuted' → { player, duration }

// الأخطاء
'error' → { message, code }
```

---

## 🎯 منطق توزيع البطاقات (Card Distribution)

### الخوارزمية:

```javascript
function distributeCards(players, roomSettings) {
  const cards = [];
  
  // البطاقات الإلزامية
  cards.push('mafia'); // مافيا × roomSettings.mafiaCount
  for (let i = 1; i < roomSettings.mafiaCount; i++) {
    cards.push('mafia');
  }
  
  cards.push('detective'); // المختار
  cards.push('doctor');    // الطبيب
  
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
  const remaining = players.length - cards.length;
  for (let i = 0; i < remaining; i++) {
    cards.push('villager');
  }
  
  // خلط عشوائي
  return shuffle(cards);
}

function shuffle(array) {
  // Fisher-Yates shuffle
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

---

## 🎮 حالات اللعبة (Game States)

```javascript
const GameStates = {
  WAITING: 'waiting',           // انتظار بدء اللعبة
  NIGHT_PHASE: 'nightPhase',    // مرحلة الليل
  DAY_PHASE: 'dayPhase',        // مرحلة النهار / المناقشة
  VOTING_PHASE: 'votingPhase',  // مرحلة التصويت
  ELIMINATION: 'elimination',   // إعلان من تم إقصاؤه
  GOODBOY_CHOICE: 'goodBoyChoice', // اختيار الولد الصالح
  GAME_OVER: 'gameOver'         // نهاية اللعبة
};

const PlayerStates = {
  ALIVE: 'alive',
  DEAD: 'dead',
  ELIMINATED: 'eliminated',
  MUTED: 'muted'
};
```

---

## 📊 منطق فحص نهاية اللعبة

### دالة checkGameEnd():

```javascript
function checkGameEnd(players) {
  const aliveMafia = players.filter(p => 
    p.card === 'mafia' && p.isAlive
  );
  
  const aliveVillagers = players.filter(p => 
    p.card !== 'mafia' && p.isAlive
  );
  
  // حالة الفوز 1: جميع المافيا قُتلوا
  if (aliveMafia.length === 0) {
    return {
      gameEnded: true,
      winners: aliveVillagers.map(p => p.id),
      winType: 'villager_victory'
    };
  }
  
  // حالة الفوز 2: المافيا تساوي أو تفوق المواطنين
  if (aliveMafia.length >= aliveVillagers.length) {
    return {
      gameEnded: true,
      winners: aliveMafia.map(p => p.id),
      winType: 'mafia_victory'
    };
  }
  
  // اللعبة مستمرة
  return { gameEnded: false };
}
```

---

## 🔐 نظام الحماية من الغش (Anti-Cheat)

```javascript
// 1. التحقق من صحة الإجراءات
function validateAction(action, player, gameState) {
  const validActions = getValidActionsForCard(player.card, gameState);
  if (!validActions.includes(action)) {
    throw new Error('Invalid action');
  }
}

// 2. التحقق من التوقيت
function validateTiming(action, currentPhase) {
  const phaseActions = {
    'nightPhase': ['selectVictim', 'detectPlayer', 'protectPlayer'],
    'votingPhase': ['vote'],
    // ...
  };
  
  if (!phaseActions[currentPhase].includes(action)) {
    throw new Error('Wrong phase for this action');
  }
}

// 3. التحقق من وجود الهدف
function validateTarget(targetId, validTargets) {
  if (!validTargets.includes(targetId)) {
    throw new Error('Invalid target');
  }
}

// 4. تسجيل جميع الإجراءات
function logAction(action, player, gameId, timestamp) {
  // حفظ في قاعدة البيانات لتحليل الغش
  ActionLog.create({
    gameId,
    playerId: player.id,
    action,
    timestamp,
    ipAddress: player.ipAddress // لاكتشاف حسابات متعددة
  });
}
```

---

## 🌍 نظام اللغات (i18n Implementation)

### ملف ar.json:

```json
{
  "common": {
    "create": "إنشاء",
    "join": "الانضمام",
    "start": "بدء",
    "cancel": "إلغاء"
  },
  "home": {
    "title": "لعبة المافيا",
    "createRoom": "إنشاء روم جديد",
    "joinWithCode": "الانضمام برمز",
    "randomGame": "لعبة عشوائية"
  },
  "roles": {
    "mafia": "المافيا",
    "detective": "المختار",
    "doctor": "الطبيب",
    "vigilante": "القناص",
    "silencer": "القاتل الصامت",
    "mayor": "العمدة",
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
    "selectYourVictim": "اختاروا فريستكم",
    "playerEliminated": "{playerName} تم إقصاؤه من اللعبة",
    "mafiasVictory": "انتصرت المافيا!",
    "villagersVictory": "انتصر المواطنون!"
  }
}
```

---

## 📈 نظام الإحصائيات والتصنيف

### Model الإحصائيات:

```javascript
{
  userId: String,
  
  // أرقام عامة
  totalGames: Number,
  wins: Number,
  losses: Number,
  winRate: Number, // (wins / totalGames) * 100
  
  // إحصائيات حسب الدور
  roleStats: {
    mafia: {
      gamesPlayed: Number,
      wins: Number,
      kills: Number
    },
    detective: {
      gamesPlayed: Number,
      wins: Number,
      correctDetections: Number
    },
    doctor: {
      gamesPlayed: Number,
      wins: Number,
      successfulSaves: Number
    },
    // ... باقي الأدوار
  },
  
  // إحصائيات أخرى
  averageGameDuration: Number,
  longestWinStreak: Number,
  currentWinStreak: Number,
  
  // الإنجازات
  achievements: [String],
  
  // الترتيب
  rating: Number, // Elo rating
  rank: String    // 'bronze', 'silver', 'gold', ...
}
```

---

## 🎯 الوظائف الأساسية الحرجة (Core Functions)

### 1. دالة بدء الليل:

```javascript
async function startNightPhase(gameId) {
  const game = await Game.findById(gameId);
  game.currentPhase = 'nightPhase';
  game.round++;
  
  // إرسال إشعارات للبوت أو الهوست
  if (game.hostType === 'bot') {
    io.to(gameId).emit('nightPhase', {
      round: game.round,
      instruction: "أغمضوا عينكم / Close your eyes"
    });
    
    // تنتظر 3 ثواني قبل استدعاء الأدوار
    await delay(3000);
    
    // استدعاء المافيا أولاً
    const mafiaPlayers = game.players.filter(p => p.card === 'mafia');
    for (const player of mafiaPlayers) {
      io.to(player.socketId).emit('yourTurn', {
        action: 'selectVictim',
        targets: game.players
          .filter(p => p.isAlive && p.id !== player.id)
          .map(p => ({ id: p.id, name: p.username }))
      });
    }
  }
  
  await game.save();
}
```

### 2. دالة معالجة التصويت:

```javascript
async function handleVote(gameId, voterId, targetId) {
  const game = await Game.findById(gameId);
  
  // تسجيل الصوت
  game.votes.push({
    voter: voterId,
    target: targetId,
    timestamp: new Date()
  });
  
  // إرسال تحديث للجميع (بدون الكشف عن التفاصيل)
  io.to(gameId).emit('voteRegistered', {
    totalVotes: game.votes.length,
    remainingVotes: game.alivePlayersCount - game.votes.length
  });
  
  // إذا صوّت الجميع، احسب النتائج
  if (game.votes.length === game.alivePlayersCount) {
    await tallyVotes(gameId);
  }
}

async function tallyVotes(gameId) {
  const game = await Game.findById(gameId);
  
  // عد الأصوات
  const voteCount = {};
  game.votes.forEach(vote => {
    const key = vote.target.toString();
    voteCount[key] = (voteCount[key] || 0) + 
      (isMayorVote(game, vote.voter) ? 3 : 1);
  });
  
  // جد الأعلى
  const maxVotes = Math.max(...Object.values(voteCount));
  const votedOut = Object.keys(voteCount)
    .filter(k => voteCount[k] === maxVotes)
    .map(k => mongoose.Types.ObjectId(k));
  
  // إذا كان هناك تعادل
  if (votedOut.length > 1) {
    io.to(gameId).emit('tie', { players: votedOut });
    // لعبة جديدة من هؤلاء فقط
    return revote(gameId, votedOut);
  }
  
  // إقصاء اللاعب
  await eliminatePlayer(gameId, votedOut[0]);
}
```

### 3. دالة إقصاء اللاعب:

```javascript
async function eliminatePlayer(gameId, playerId) {
  const game = await Game.findById(gameId);
  const player = game.players.find(p => p.id == playerId);
  
  player.isAlive = false;
  player.eliminatedAt = new Date();
  
  // إعلان الإقصاء
  io.to(gameId).emit('playerEliminated', {
    playerName: player.username,
    card: player.card,
    round: game.round
  });
  
  // إذا كان لديه ميزة "الولد الصالح"
  if (player.card === 'goodBoy') {
    io.to(gameId).emit('goodBoyChoice', {
      playerName: player.username,
      targets: game.players
        .filter(p => p.isAlive && p.id !== playerId)
        .map(p => ({ id: p.id, name: p.username }))
    });
    
    // انتظر اختياره (30 ثانية max)
    const choice = await waitForGoodBoyChoice(playerId, 30000);
    if (choice) {
      const target = game.players.find(p => p.id == choice.targetId);
      target.isAlive = false;
      target.eliminatedAt = new Date();
      
      io.to(gameId).emit('playerEliminated', {
        playerName: target.username,
        card: target.card,
        reason: 'goodBoy'
      });
    }
  }
  
  // فحص نهاية اللعبة
  const endCheck = checkGameEnd(game.players);
  if (endCheck.gameEnded) {
    await endGame(gameId, endCheck);
  } else {
    // الانتقال لمرحلة الليل
    setTimeout(() => startNightPhase(gameId), 5000);
  }
}
```

---

## 🔒 معايير الأمان (Security)

### Authentication:
```javascript
// JWT tokens
const token = jwt.sign(
  { userId: user._id, username: user.username },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

// Refresh tokens
const refreshToken = jwt.sign(
  { userId: user._id },
  process.env.REFRESH_TOKEN_SECRET,
  { expiresIn: '30d' }
);
```

### Validation:
```javascript
// Input validation
const createRoomSchema = Joi.object({
  roomName: Joi.string().min(3).max(50).required(),
  maxPlayers: Joi.number().min(4).max(15).required(),
  mafiaCount: Joi.number().min(1).max(5).required(),
  accessType: Joi.string().valid('public', 'private').required()
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100, // 100 طلب
  message: 'تم تجاوز حد الطلبات'
});
```

### Database Security:
```javascript
// Mongoose injection prevention
db.collection.findOne({ username: username }); // ✗ خطر
db.collection.findOne({ username: sanitize(username) }); // ✓ آمن
```

---

## 🚀 خطوات التطوير بالترتيب

### Sprint 1 (الأسبوع 1-2): البنية الأساسية
- [ ] إعداد المشروع (React + Node.js)
- [ ] إعداد قاعدة البيانات
- [ ] نظام المصادقة
- [ ] اتصال Socket.io

### Sprint 2 (الأسبوع 3-4): إدارة الروم
- [ ] إنشاء الروم
- [ ] الانضمام للروم
- [ ] إدارة الروم (حذف، تحديث، إغلاق)
- [ ] قائمة الروم العامة

### Sprint 3 (الأسبوع 5-6): نظام اللعبة الأساسي
- [ ] توزيع البطاقات
- [ ] مراحل اللعبة (ليل/نهار)
- [ ] نظام القتل والحماية
- [ ] نظام التصويت

### Sprint 4 (الأسبوع 7-8): البطاقات الإضافية
- [ ] القناص
- [ ] القاتل الصامت
- [ ] العمدة
- [ ] الولد الصالح

### Sprint 5 (الأسبوع 9-10): الميزات الإضافية
- [ ] نظام الإحصائيات
- [ ] نظام التصنيف
- [ ] نظام الإنجازات
- [ ] دعم اللغات

### Sprint 6 (الأسبوع 11-12): الاختبار والتحسين
- [ ] اختبار شامل
- [ ] تحسين الأداء
- [ ] إصلاح الأخطاء
- [ ] التحضير للإطلاق

---

## 📦 المتطلبات الخارجية

### Frontend Dependencies:
```json
{
  "react": "^18.0.0",
  "socket.io-client": "^4.5.0",
  "react-i18next": "^11.0.0",
  "tailwindcss": "^3.0.0",
  "axios": "^1.0.0",
  "zustand": "^4.0.0",
  "@heroicons/react": "^2.0.0"
}
```

### Backend Dependencies:
```json
{
  "express": "^4.18.0",
  "socket.io": "^4.5.0",
  "mongoose": "^6.0.0",
  "jsonwebtoken": "^9.0.0",
  "bcryptjs": "^2.4.0",
  "joi": "^17.0.0",
  "dotenv": "^16.0.0",
  "cors": "^2.8.0",
  "express-rate-limit": "^6.0.0"
}
```

---

**هذه الخطة شاملة وجاهزة للتنفيذ الفوري!**
