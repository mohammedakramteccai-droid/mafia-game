const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const {
  CARDS, generateRoomCode, generateRoomId,
  assignCards, checkWinCondition, calculateVotes, processNightActions, getValidTargets
} = require('./gameLogic');

const app = express();
app.use(cors());
app.use(express.json());

// Serve client build in production
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// In-memory store
const rooms = {};   // roomId -> room object
const players = {}; // socketId -> player info

const NIGHT_STAGE_ORDER = ['mafia', 'doctor', 'detective'];
const NIGHT_STAGE_CONFIG = {
  mafia: { action: 'selectVictim', actionType: 'mafia' },
  doctor: { action: 'protectPlayer', actionType: 'doctor' },
  detective: { action: 'detectPlayer', actionType: 'detective' },
};

// ── helpers ────────────────────────────────────────────────
function getRoomByCode(code) {
  return Object.values(rooms).find(r => r.roomCode === code);
}
function getPublicRooms() {
  return Object.values(rooms).filter(
    r => r.accessType === 'public' && r.status === 'waiting'
       && r.players.length < r.maxPlayers
  );
}
function sanitizeRoom(room) {
  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    roomName: room.roomName,
    accessType: room.accessType,
    hostType: room.hostType,
    maxPlayers: room.maxPlayers,
    mafiaCount: room.mafiaCount,
    status: room.status,
    language: room.language,
    discussionTime: room.discussionTime,
    players: room.players.map(p => ({
      id: p.id,
      username: p.username,
      isAlive: p.isAlive,
      isHost: p.isHost,
      isReady: Boolean(room.readyPlayers?.[p.id]),
      avatar: p.avatar,
    })),
    phase: room.phase,
    nightStage: room.nightStage || null,
    readyCount: room.readyPlayers ? Object.keys(room.readyPlayers).length : 0,
    round: room.round,
  };
}
function broadcastRoom(room) {
  io.to(room.roomId).emit('room:update', sanitizeRoom(room));
}
function emitToPlayer(socketId, event, data) {
  io.to(socketId).emit(event, data);
}

// ── Socket handlers ─────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('connected:', socket.id);

  // Create room
  socket.on('room:create', (data, cb) => {
    const roomId = generateRoomId();
    const roomCode = generateRoomCode();
    const room = {
      roomId,
      roomCode,
      roomName: data.roomName || 'Mafia Room',
      accessType: data.accessType || 'public',
      hostType: data.hostType || 'bot',
      maxPlayers: data.maxPlayers || 8,
      mafiaCount: data.mafiaCount || 2,
      enabledCards: {},
      language: data.language || 'ar',
      discussionTime: data.discussionTime || 180,
      status: 'waiting',
      phase: 'lobby',
      round: 0,
      players: [],
      nightActions: {},
      readyPlayers: {},
      nightStage: null,
      nightStageIndex: -1,
      votes: {},
      voteRound: 0,
      log: [],
      tiedPlayers: [],
      detectiveInvestigated: [],
      doctorLastProtected: null,
    };

    const player = {
      id: socket.id,
      socketId: socket.id,
      username: data.username || 'Host',
      isHost: true,
      isAlive: true,
      card: null,
      isMuted: false,
      mayorRevealed: false,
      avatar: data.avatar || '👤',
    };

    room.players.push(player);
    rooms[roomId] = room;
    players[socket.id] = { roomId, playerId: socket.id };

    socket.join(roomId);
    broadcastRoom(room); // يُرسل room:update للمنشئ
    cb({ success: true, roomId, roomCode, room: sanitizeRoom(room) });
  });

  // Join room by code
  socket.on('room:join', (data, cb) => {
    const { roomCode, username, avatar } = data;
    let room = data.roomId ? rooms[data.roomId] : getRoomByCode(roomCode);

    if (!room) return cb({ success: false, error: 'room_not_found' });
    if (room.status !== 'waiting') return cb({ success: false, error: 'game_started' });
    if (room.players.length >= room.maxPlayers) return cb({ success: false, error: 'room_full' });

    const player = {
      id: socket.id, socketId: socket.id,
      username: username || 'Player',
      isHost: false, isAlive: true, card: null,
      isMuted: false, mayorRevealed: false,
      avatar: avatar || '👤',
    };

    room.players.push(player);
    players[socket.id] = { roomId: room.roomId, playerId: socket.id };
    socket.join(room.roomId);

    broadcastRoom(room);
    io.to(room.roomId).emit('room:player_joined', { username: player.username });
    cb({ success: true, roomId: room.roomId, room: sanitizeRoom(room) });
  });

  // Random join
  socket.on('room:random_join', (data, cb) => {
    const { username, avatar, playerCount } = data;
    const available = getPublicRooms().filter(r =>
      !playerCount || r.maxPlayers === playerCount
    );
    if (!available.length) return cb({ success: false, error: 'no_rooms' });
    const room = available[0];
    socket.emit('room:join', { roomId: room.roomId, username, avatar }, cb);
    // Delegate to join handler
    socket.emit('_internal_join', { roomId: room.roomId, username, avatar }, cb);
  });

  // Get public rooms list
  socket.on('rooms:list', (data, cb) => {
    cb({ rooms: getPublicRooms().map(sanitizeRoom) });
  });

  // ── Start game ──────────────────────────────────────────
  socket.on('game:start', (data, cb) => {
    const info = players[socket.id];
    if (!info) return cb && cb({ success: false });
    const room = rooms[info.roomId];
    if (!room) return cb && cb({ success: false });
    const host = room.players.find(p => p.id === socket.id);
    if (!host?.isHost) return cb && cb({ success: false, error: 'not_host' });
    if (room.players.length < 4) return cb && cb({ success: false, error: 'not_enough_players' });

    const cardMap = assignCards(room.players, room);
    room.players.forEach(p => {
      p.card = cardMap[p.id];
      p.isAlive = true;
    });
    room.status = 'playing';
    room.phase = 'card_reveal';
    room.round = 0;
    room.nightActions = {};
    room.readyPlayers = {};
    room.expectedNightActions = {};
    room.log = [];
    room.detectiveInvestigated = [];
    room.doctorLastProtected = null;

    room.players.forEach(p => {
      const mafiaTeam = room.players
        .filter(m => CARDS[m.card]?.team === 'mafia')
        .map(m => ({ id: m.id, username: m.username, card: m.card }));
      const isMafiaTeam = CARDS[p.card]?.team === 'mafia';
      emitToPlayer(p.socketId, 'game:card_assigned', {
        card: p.card,
        cardInfo: CARDS[p.card],
        mafiaTeam: isMafiaTeam ? mafiaTeam : null,
        validTargets: [],
      });
    });

    broadcastRoom(room);
    io.to(room.roomId).emit('game:started', { phase: 'card_reveal', round: 0 });
    if (cb) cb({ success: true });
  });

  socket.on('game:player_ready', () => {
    const info = players[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room || room.phase !== 'card_reveal') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    room.readyPlayers[player.id] = true;
    broadcastRoom(room);
    io.to(room.roomId).emit('game:ready_update', {
      readyCount: Object.keys(room.readyPlayers).length,
      total: room.players.length,
    });

    if (room.players.every(p => room.readyPlayers[p.id])) {
      startNightPhase(room);
    }
  });

  function publicTarget(p) {
    return { id: p.id, username: p.username, avatar: p.avatar };
  }

  function getNightActors(room, stage) {
    const alive = room.players.filter(p => p.isAlive);
    if (stage === 'mafia') return alive.filter(p => p.card === 'mafia');
    if (stage === 'doctor') return alive.filter(p => p.card === 'doctor');
    if (stage === 'detective') return alive.filter(p => p.card === 'detective');
    return [];
  }

  function getNightTargets(room, player, stage) {
    const alive = room.players.filter(p => p.isAlive);
    if (stage === 'mafia') {
      return alive.filter(p => CARDS[p.card]?.team !== 'mafia');
    }
    if (stage === 'detective') {
      // المختار لا يمكنه التحقق من نفس الشخص مرتين
      const investigated = room.detectiveInvestigated || [];
      return alive.filter(p => p.id !== player.id && !investigated.includes(p.id));
    }
    if (stage === 'doctor') {
      // الطبيب لا يمكنه حماية نفس الشخص في ليلتين متتاليتين
      const lastProtected = room.doctorLastProtected;
      return alive.filter(p => p.id !== lastProtected);
    }
    return getValidTargets(player, room.players);
  }

  function emitNightTurn(room, player, stage) {
    const config = NIGHT_STAGE_CONFIG[stage];
    const targets = getNightTargets(room, player, stage).map(publicTarget);
    emitToPlayer(player.socketId, 'game:your_turn', {
      action: config.action,
      actionType: config.actionType,
      stage,
      targets,
      round: room.round,
    });
  }

  function canUseNightAction(room, player, actionType) {
    const expected = room.expectedNightActions[player.id];
    return expected && expected.includes(actionType);
  }

  function handleDetectiveResult(room, detective, targetId) {
    const target = room.players.find(p => p.id === targetId);
    if (!target) return;
    emitToPlayer(detective.socketId, 'game:investigation_result', {
      targetId,
      targetUsername: target.username,
      result: CARDS[target.card]?.team === 'mafia' ? 'mafia' : 'citizen',
    });
  }

  // ── Night action ─────────────────────────────────────────
  socket.on('game:night_action', (data) => {
    const info = players[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room || room.phase !== 'night') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive) return;

    const { actionType, targetId } = data;

    if (!canUseNightAction(room, player, actionType)) {
      return emitToPlayer(socket.id, 'game:error', { message: 'Not your turn', code: 'NOT_YOUR_TURN' });
    }
    if (!targetId) {
      return emitToPlayer(socket.id, 'game:error', { message: 'Invalid target', code: 'INVALID_TARGET' });
    }

    // ── Anti-cheat: validateTarget ──
    // Find the stage for this actionType
    const stage = Object.keys(NIGHT_STAGE_CONFIG).find(k => NIGHT_STAGE_CONFIG[k].actionType === actionType);
    if (stage) {
      const validTargets = getNightTargets(room, player, stage);
      const validIds = validTargets.map(p => p.id);
      if (targetId && !validIds.includes(targetId)) {
        return emitToPlayer(socket.id, 'game:error', { message: 'Invalid target', code: 'INVALID_TARGET' });
      }
    }

    // actionType: 'mafia', 'doctor', 'detective', 'vigilante', 'silencer'
    if (!room.nightActions[actionType]) room.nightActions[actionType] = {};
    room.nightActions[actionType][socket.id] = targetId;

    emitToPlayer(socket.id, 'game:action_registered', { actionType });

    // Mark action as completed
    room.expectedNightActions[player.id] = room.expectedNightActions[player.id].filter(a => a !== actionType);
    if (room.expectedNightActions[player.id].length === 0) {
      delete room.expectedNightActions[player.id];
    }

    if (actionType === 'detective') {
      handleDetectiveResult(room, player, targetId);
    }

    // Check if everyone has submitted their expected actions
    if (Object.keys(room.expectedNightActions).length === 0) {
      // For mafia, we check if consensus is met. If not, we just set mafiaTarget to null.
      const mafiaVotes = Object.values(room.nightActions.mafia || {});
      if (mafiaVotes.length > 0) {
        const uniqueTargets = new Set(mafiaVotes);
        if (uniqueTargets.size > 1) {
          // Mafia failed to agree, no one dies.
          room.nightActions.mafia = {};
        }
      }
      resolveNight(room);
    }
  });

  function resolveNight(room) {
    const na = room.nightActions;
    const mafiaTarget = Object.values(na.mafia || {})[0] || null;
    const doctorTarget = Object.values(na.doctor || {})[0] || null;
    const detectiveTarget = Object.values(na.detective || {})[0] || null;

    const result = processNightActions(
      { mafiaTarget, doctorTarget, detectiveTarget },
      room.players, room
    );

    // Apply results
    if (result.killed) {
      const victim = room.players.find(p => p.id === result.killed);
      if (victim) {
        victim.isAlive = false;
        room.log.push({ round: room.round, type: 'night_kill', playerId: victim.id, username: victim.username });
      }
    }

    // تحديث سجل التحقيقات للمختار
    if (detectiveTarget) {
      if (!room.detectiveInvestigated) room.detectiveInvestigated = [];
      if (!room.detectiveInvestigated.includes(detectiveTarget)) {
        room.detectiveInvestigated.push(detectiveTarget);
      }
    }

    // تحديث آخر شخص حماه الطبيب
    room.doctorLastProtected = doctorTarget || null;

    // Move to day
    room.phase = 'day';
    room.nightActions = {};
    room.expectedNightActions = {};

    const winCheck = checkWinCondition(room.players);
    if (winCheck) return endGame(room, winCheck);

    const deaths = room.log.filter(l => l.round === room.round && l.type === 'night_kill');

    // تحديث الأهداف الصالحة لكل لاعب بعد الليل
    room.players.filter(p => p.isAlive).forEach(p => {
      const validTargets = getValidTargets(p, room.players).map(t => ({ id: t.id, username: t.username, avatar: t.avatar }));
      emitToPlayer(p.socketId, 'game:valid_targets_update', { validTargets });
    });
    broadcastRoom(room);
    io.to(room.roomId).emit('game:day_start', {
      round: room.round,
      deaths,
      wasSaved: result.saved || false,
    });
  }

  // ── Vote ─────────────────────────────────────────────────
  socket.on('game:vote', (data) => {
    const info = players[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room || room.phase !== 'voting') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive) return;

    room.votes[socket.id] = data.targetId || null; // null = skip

    const alive = room.players.filter(p => p.isAlive);
    const voted = alive.filter(p => room.votes.hasOwnProperty(p.id)).length;
    io.to(room.roomId).emit('game:vote_update', { voted, total: alive.length });

    if (voted >= alive.length) resolveVote(room);
  });

  function resolveVote(room) {
    const alive = room.players.filter(p => p.isAlive);
    const result = calculateVotes(room.votes, room.players);

    if (result.isTie) {
      room.tiedPlayers = result.tiedPlayers;
      room.votes = {};
      room.voteRound++;
      io.to(room.roomId).emit('game:vote_tie', {
        tiedPlayers: result.tiedPlayers.map(id => {
          const p = room.players.find(x => x.id === id);
          return { id, username: p?.username };
        }),
        voteCounts: result.voteCounts,
      });
      return;
    }

    if (!result.eliminated) {
      // Skip - nobody eliminated
      io.to(room.roomId).emit('game:vote_skipped', { voteCounts: result.voteCounts });
      startNightPhase(room);
      return;
    }

    const eliminated = room.players.find(p => p.id === result.eliminated);
    if (eliminated) eliminated.isAlive = false;

    io.to(room.roomId).emit('game:player_eliminated', {
      playerId: result.eliminated,
      username: eliminated?.username,
      card: eliminated?.card,
      voteCounts: result.voteCounts,
    });

    const winCheck = checkWinCondition(room.players);
    if (winCheck) return endGame(room, winCheck);

    startNightPhase(room);
  }



  // Start voting phase (host or bot triggers)
  socket.on('game:start_voting', () => {
    const info = players[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room || room.phase !== 'day') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive) return;
    room.phase = 'voting';
    room.votes = {};
    room.tiedPlayers = [];
    broadcastRoom(room);
    io.to(room.roomId).emit('game:voting_start', {
      players: room.players.filter(p => p.isAlive).map(p => ({ id: p.id, username: p.username }))
    });
  });

  // Skip vote
  socket.on('game:skip_vote', () => {
    const info = players[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room || room.phase !== 'voting') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive) return;

    room.votes[socket.id] = null;
    const alive = room.players.filter(p => p.isAlive);
    const voted = alive.filter(p => room.votes.hasOwnProperty(p.id)).length;
    io.to(room.roomId).emit('game:vote_update', { voted, total: alive.length });

    if (voted >= alive.length) resolveVote(room);
  });



  function startNightPhase(room) {
    room.round++;
    room.phase = 'night';
    room.nightActions = {};
    room.expectedNightActions = {};
    room.votes = {};

    broadcastRoom(room);
    io.to(room.roomId).emit('game:night_start', { round: room.round });

    let hasActions = false;
    NIGHT_STAGE_ORDER.forEach(stage => {
      const actors = getNightActors(room, stage);
      actors.forEach(p => {
        hasActions = true;
        if (!room.expectedNightActions[p.id]) room.expectedNightActions[p.id] = [];
        room.expectedNightActions[p.id].push(NIGHT_STAGE_CONFIG[stage].actionType);
        emitNightTurn(room, p, stage);
      });
    });

    if (!hasActions) {
      resolveNight(room);
    }
  }

  function endGame(room, winResult) {
    room.status = 'finished';
    room.phase = 'results';
    broadcastRoom(room);
    io.to(room.roomId).emit('game:over', {
      winner: winResult.winner,
      reason: winResult.reason,
      players: room.players.map(p => ({ id: p.id, username: p.username, card: p.card, isAlive: p.isAlive, avatar: p.avatar })),
    });
  }

  // ── Disconnect ─────────────────────────────────────────
  socket.on('disconnect', () => {
    const info = players[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[info.roomId];
      } else {
        if (!room.players.find(p => p.isHost) && room.players.length > 0) {
          room.players[0].isHost = true;
        }
        broadcastRoom(room);
        io.to(room.roomId).emit('room:player_left', { socketId: socket.id });
      }
    }
    delete players[socket.id];
  });
});

// REST: get public rooms
app.get('/api/rooms', (req, res) => {
  res.json({ rooms: getPublicRooms().map(sanitizeRoom) });
});

// SPA catch-all: serve client for any non-API route
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => console.log(`🎮 Mafia Server running on port ${PORT}`));
