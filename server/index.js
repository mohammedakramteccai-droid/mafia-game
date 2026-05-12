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
    enabledCards: room.enabledCards,
    status: room.status,
    language: room.language,
    discussionTime: room.discussionTime,
    players: room.players.map(p => ({
      id: p.id,
      username: p.username,
      isAlive: p.isAlive,
      isHost: p.isHost,
      isMuted: p.isMuted || false,
      mayorRevealed: p.mayorRevealed || false,
      avatar: p.avatar,
    })),
    phase: room.phase,
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
      enabledCards: data.enabledCards || { vigilante:false, silencer:false, mayor:false, goodBoy:false },
      language: data.language || 'ar',
      discussionTime: data.discussionTime || 180,
      status: 'waiting',
      phase: 'lobby',
      round: 0,
      players: [],
      nightActions: {},
      votes: {},
      voteRound: 0,
      log: [],
      tiedPlayers: [],
      silencedPlayer: null,
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

    // Assign cards
    const cardMap = assignCards(room.players, room);
    room.players.forEach(p => { p.card = cardMap[p.id]; p.isAlive = true; });
    room.status = 'playing';
    room.phase = 'night';
    room.round = 1;
    room.nightActions = {};
    room.silencedPlayer = null;
    room.log = [];

    // إرسال البطاقة الخاصة لكل لاعب + الأهداف الصالحة
    room.players.forEach(p => {
      // فريق المافيا = المافيا العادية + القاتل الصامت
      const mafiaTeam = room.players
        .filter(m => CARDS[m.card]?.team === 'mafia')
        .map(m => ({ id: m.id, username: m.username, card: m.card }));
      const validTargets = getValidTargets(p, room.players).map(t => ({ id: t.id, username: t.username, avatar: t.avatar }));
      const isMafiaTeam = CARDS[p.card]?.team === 'mafia';
      emitToPlayer(p.socketId, 'game:card_assigned', {
        card: p.card,
        cardInfo: CARDS[p.card],
        mafiaTeam: isMafiaTeam ? mafiaTeam : null, // القاتل الصامت يرى فريق المافيا كاملاً
        validTargets,
      });
    });

    // إرسال yourTurn لكل لاعب بدوره (from mafia_game_dev_plan.md)
    // القاتل الصامت يأخذ دورَين: selectVictim (مع المافيا) + mutePlayer (مستقل)
    room.players.filter(p => p.isAlive).forEach(p => {
      const targets = getValidTargets(p, room.players).map(t => ({ id: t.id, username: t.username, avatar: t.avatar }));
      const roleActions = { mafia: 'selectVictim', detective: 'detectPlayer', doctor: 'protectPlayer', vigilante: 'killPlayer', silencer: 'selectVictim' };
      const action = roleActions[p.card];
      if (action) {
        emitToPlayer(p.socketId, 'game:your_turn', { action, targets, round: room.round });
      }
    });

    broadcastRoom(room);
    io.to(room.roomId).emit('game:started', { phase: 'night', round: 1 });
    if (cb) cb({ success: true });
  });

  // ── Night action ─────────────────────────────────────────
  socket.on('game:night_action', (data) => {
    const info = players[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room || room.phase !== 'night') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive) return;

    const { actionType, targetId } = data;

    // ── Anti-cheat: validateTarget (from mafia_game_dev_plan.md) ──
    const validTargets = getValidTargets(player, room.players);
    const validIds = validTargets.map(p => p.id);
    if (targetId && !validIds.includes(targetId)) {
      return emitToPlayer(socket.id, 'game:error', { message: 'Invalid target', code: 'INVALID_TARGET' });
    }

    // actionType: 'mafia', 'doctor', 'detective', 'vigilante', 'silencer'
    if (!room.nightActions[actionType]) room.nightActions[actionType] = {};
    room.nightActions[actionType][socket.id] = targetId;

    emitToPlayer(socket.id, 'game:action_registered', { actionType });
    resolveNightIfReady(room);
  });

  function resolveNightIfReady(room) {
    const alive = room.players.filter(p => p.isAlive);
    // فريق القتلة = المافيا العادية + القاتل الصامت (كلاهما يصوتان على الضحية)
    const killersAlive = alive.filter(p => CARDS[p.card]?.team === 'mafia');
    const doctorAlive = alive.find(p => p.card === 'doctor');
    const detectiveAlive = alive.find(p => p.card === 'detective');
    const vigilanteAlive = room.enabledCards?.vigilante ? alive.find(p => p.card === 'vigilante') : null;
    const silencerAlive = room.enabledCards?.silencer ? alive.find(p => p.card === 'silencer') : null;

    const na = room.nightActions;

    // انتظار تصويت كل القتلة (مافيا + قاتل صامت) على الضحية
    const mafiaVotes = na.mafia || {};
    const mafiaVotedCount = Object.keys(mafiaVotes).length;
    if (killersAlive.length > 0 && mafiaVotedCount < killersAlive.length) return;

    // Find mafia consensus target
    const mafiaVoteCounts = {};
    Object.values(mafiaVotes).forEach(t => { mafiaVoteCounts[t] = (mafiaVoteCounts[t]||0)+1; });
    const mafiaTarget = Object.entries(mafiaVoteCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];

    // Doctor
    const doctorTarget = doctorAlive ? (na.doctor?.[doctorAlive.id] || null) : null;
    if (doctorAlive && !doctorTarget) return;

    // Detective
    const detectiveTarget = detectiveAlive ? (na.detective?.[detectiveAlive.id] || null) : null;
    if (detectiveAlive && !detectiveTarget) return;

    // Vigilante (optional)
    const vigilanteTarget = vigilanteAlive ? (na.vigilante?.[vigilanteAlive.id] || null) : null;
    if (vigilanteAlive && !vigilanteTarget) return;

    // Silencer (optional)
    const silencerTarget = silencerAlive ? (na.silencer?.[silencerAlive.id] || null) : null;
    if (silencerAlive && !silencerTarget) return;

    // All actions collected - process
    const result = processNightActions(
      { mafiaTarget, doctorTarget, detectiveTarget, vigilanteTarget, silencerTarget },
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
    if (result.vigilanteKilled) {
      const victim = room.players.find(p => p.id === result.vigilanteKilled);
      if (victim && victim.isAlive) {
        victim.isAlive = false;
        room.log.push({ round: room.round, type: 'vigilante_kill', playerId: victim.id, username: victim.username });
      }
    }
    if (result.vigilanteDied) {
      const vig = alive.find(p => p.card === 'vigilante');
      if (vig) { vig.isAlive = false; room.log.push({ round: room.round, type: 'vigilante_selfdestruct', playerId: vig.id, username: vig.username }); }
    }
    if (result.silenced) {
      room.silencedPlayer = result.silenced;
    }

    // Send detective result privately
    if (detectiveAlive && result.investigated) {
      emitToPlayer(detectiveAlive.socketId, 'game:investigation_result', {
        targetId: result.investigated,
        result: result.investigationResult,
      });
    }

    // Move to day
    room.phase = 'day';
    room.nightActions = {};

    const winCheck = checkWinCondition(room.players);
    if (winCheck) return endGame(room, winCheck);

    const deaths = room.log.filter(l => l.round === room.round && ['night_kill','vigilante_kill','vigilante_selfdestruct'].includes(l.type));
    // تحديث الأهداف الصالحة لكل لاعب بعد الليل
    room.players.filter(p => p.isAlive).forEach(p => {
      const validTargets = getValidTargets(p, room.players).map(t => ({ id: t.id, username: t.username, avatar: t.avatar }));
      emitToPlayer(p.socketId, 'game:valid_targets_update', { validTargets });
    });
    broadcastRoom(room);
    io.to(room.roomId).emit('game:day_start', {
      round: room.round,
      deaths,
      silencedPlayer: room.silencedPlayer,
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

    // Good Boy check
    if (eliminated?.card === 'goodBoy') {
      room.phase = 'goodboy';
      room.goodBoyPlayerId = result.eliminated;
      broadcastRoom(room);
      io.to(room.roomId).emit('game:goodboy_choice', { playerId: result.eliminated, username: eliminated.username });
      emitToPlayer(eliminated.socketId, 'game:goodboy_pick', {});
      return;
    }

    const winCheck = checkWinCondition(room.players);
    if (winCheck) return endGame(room, winCheck);

    startNightPhase(room);
  }

  // Good Boy picks someone to drag out
  socket.on('game:goodboy_pick', (data) => {
    const info = players[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room || room.phase !== 'goodboy') return;
    const { targetId } = data;
    const target = room.players.find(p => p.id === targetId);
    if (target) {
      target.isAlive = false;
      io.to(room.roomId).emit('game:goodboy_result', {
        targetId, targetUsername: target.username, targetCard: target.card
      });
    }
    const winCheck = checkWinCondition(room.players);
    if (winCheck) return endGame(room, winCheck);
    startNightPhase(room);
  });

  // Start voting phase (host or bot triggers)
  socket.on('game:start_voting', () => {
    const info = players[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room || room.phase !== 'day') return;
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
    io.to(room.roomId).emit('game:vote_skipped', {});
    startNightPhase(room);
  });

  // Mayor reveal
  socket.on('game:mayor_reveal', () => {
    const info = players[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.card !== 'mayor') return;
    player.mayorRevealed = true;
    broadcastRoom(room);
    io.to(room.roomId).emit('game:mayor_revealed', { playerId: socket.id, username: player.username });
  });

  function startNightPhase(room) {
    room.round++;
    room.phase = 'night';
    room.nightActions = {};
    room.votes = {};
    room.silencedPlayer = null;

    // yourTurn لكل لاعب له دور ليلي (from mafia_game_dev_plan.md)
    // القاتل الصامت: selectVictim (يصوت مع المافيا على الضحية) + mutePlayer (إسكات مستقل)
    room.players.filter(p => p.isAlive).forEach(p => {
      const targets = getValidTargets(p, room.players).map(t => ({ id: t.id, username: t.username, avatar: t.avatar }));
      const roleActions = { mafia: 'selectVictim', detective: 'detectPlayer', doctor: 'protectPlayer', vigilante: 'killPlayer', silencer: 'selectVictim' };
      const action = roleActions[p.card];
      if (action) {
        emitToPlayer(p.socketId, 'game:your_turn', { action, targets, round: room.round });
      }
    });

    broadcastRoom(room);
    io.to(room.roomId).emit('game:night_start', { round: room.round });
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
