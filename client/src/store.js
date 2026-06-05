import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

let _socket = null; // Singleton socket outside store

function getOrCreateSocket(set, get) {
  if (_socket && _socket.connected) return _socket;
  if (_socket) return _socket; // connecting

  _socket = io(SOCKET_URL, { transports: ['websocket'] });

  _socket.on('connect', () => set({ connected: true, playerId: _socket.id }));
  _socket.on('disconnect', () => set({ connected: false, playerId: null }));
  _socket.on('connect_error', () => set({ connected: false }));

  _socket.on('room:update', (room) => set({ room }));
  _socket.on('room:player_joined', ({ username }) => {
    get().showNotification(`${username} انضم! 🎉`, 'success');
  });
  _socket.on('room:player_left', () => {
    get().showNotification('لاعب غادر الغرفة', 'warning');
  });
  _socket.on('game:card_assigned', ({ card, mafiaTeam, validTargets }) => {
    set({ myCard: card, mafiaTeam, validTargets: validTargets || [], currentTurn: null, investigationResult: null, investigationHistory: [] });
  });
  _socket.on('game:valid_targets_update', ({ validTargets }) => {
    set({ validTargets: validTargets || [] });
  });
  _socket.on('game:night_start', (data) => {
    set({ 
      currentTurn: null, 
      turnQueue: [],
      actionSubmitted: false,
      investigationResult: null, 
      room: { ...get().room, phase: 'night', round: data.round } 
    });
  });
  _socket.on('game:night_stage', () => {
    set({ currentTurn: null, validTargets: [] });
  });
  _socket.on('game:your_turn', (data) => {
    set(state => {
      const newQueue = [...state.turnQueue, data];
      return { 
        turnQueue: newQueue, 
        currentTurn: state.currentTurn || data,
        actionSubmitted: false
      };
    });
    get().showNotification('حان دورك للعب!', 'info');
  });
  _socket.on('game:investigation_result', (data) => {
    const history = get().investigationHistory;
    set({ 
      investigationResult: data,
      investigationHistory: [...history, data]
    });
    get().showNotification(
      data.result === 'mafia' ? `🔴 ${data.targetUsername}` : `✅ ${data.targetUsername}`,
      data.result === 'mafia' ? 'error' : 'success',
      5000
    );
  });


  set({ socket: _socket });
  return _socket;
}

export const useGameStore = create((set, get) => ({
  // Connection
  socket: null,
  connected: false,
  playerId: null,

  // Player
  username: localStorage.getItem('mafia_username') || '',
  avatar: localStorage.getItem('mafia_avatar') || '🎭',
  language: localStorage.getItem('mafia_lang') || 'ar',

  // Room & Game
  room: null,
  myCard: null,
  mafiaTeam: null,
  validTargets: [],   // الأهداف الصالحة للاعب الحالي
  currentTurn: null,
  turnQueue: [],
  actionSubmitted: false,
  investigationResult: null,

  investigationHistory: [],

  // Notifications
  notification: null,

  // ── Actions ──────────────────────────────────────────────
  setUsername: (name) => {
    localStorage.setItem('mafia_username', name);
    set({ username: name });
  },
  setAvatar: (av) => {
    localStorage.setItem('mafia_avatar', av);
    set({ avatar: av });
  },
  setLanguage: (lang) => {
    localStorage.setItem('mafia_lang', lang);
    set({ language: lang });
  },
  showNotification: (msg, type = 'info', duration = 3000) => {
    set({ notification: { msg, type } });
    setTimeout(() => set({ notification: null }), duration);
  },

  // Connect socket (called from App on mount)
  connect: () => {
    getOrCreateSocket(set, get);
  },

  disconnect: () => {
    if (_socket) { _socket.disconnect(); _socket = null; }
    set({ socket: null, connected: false, playerId: null, room: null, myCard: null, mafiaTeam: null, currentTurn: null, turnQueue: [], actionSubmitted: false });
  },

  // Room actions – auto-connect if needed
  createRoom: (data) => new Promise((res) => {
    const s = getOrCreateSocket(set, get);
    const doEmit = () => s.emit('room:create', data, res);
    if (s.connected) doEmit();
    else s.once('connect', doEmit);
  }),

  joinRoom: (data) => new Promise((res) => {
    const s = getOrCreateSocket(set, get);
    const doEmit = () => s.emit('room:join', data, res);
    if (s.connected) doEmit();
    else s.once('connect', doEmit);
  }),

  randomJoin: (data) => new Promise((res) => {
    const s = getOrCreateSocket(set, get);
    const doEmit = () => s.emit('room:random_join', data, res);
    if (s.connected) doEmit();
    else s.once('connect', doEmit);
  }),

  startGame: () => new Promise((res) => {
    const s = getOrCreateSocket(set, get);
    const doEmit = () => s.emit('game:start', {}, res);
    if (s.connected) doEmit();
    else s.once('connect', doEmit);
  }),

  sendReady: () => {
    getOrCreateSocket(set, get).emit('game:player_ready');
  },
  sendNightAction: (targetId, actionTypeOverride) => {
    const { socket, currentTurn, turnQueue } = get();
    if (!socket || !currentTurn) return;
    const actionType = actionTypeOverride || currentTurn.actionType;
    
    socket.emit('game:night_action', { actionType, targetId });
    
    const nextQueue = turnQueue.filter(t => t.actionType !== actionType);
    if (nextQueue.length > 0) {
      set({ turnQueue: nextQueue, currentTurn: nextQueue[0], actionSubmitted: false });
    } else {
      set({ turnQueue: [], currentTurn: null, actionSubmitted: true });
    }
  },
  sendVote: (targetId) => {
    getOrCreateSocket(set, get).emit('game:vote', { targetId });
  },
  startVoting: () => {
    getOrCreateSocket(set, get).emit('game:start_voting');
  },
  skipVote: () => {
    getOrCreateSocket(set, get).emit('game:skip_vote');
  },
  returnToLobby: () => {
    getOrCreateSocket(set, get).emit('game:return_to_lobby');
  },

  setRoom: (room) => set({ room }),
  clearRoom: () => set({ room: null, myCard: null, mafiaTeam: null, investigationResult: null, validTargets: [], currentTurn: null, investigationHistory: [] }),
}));
