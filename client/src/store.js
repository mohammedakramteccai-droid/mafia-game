import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';

let _socket = null; // Singleton socket outside store

function getOrCreateSocket(set, get) {
  if (_socket && _socket.connected) return _socket;
  if (_socket) return _socket; // connecting

  _socket = io(SOCKET_URL, { transports: ['websocket'] });

  _socket.on('connect', () => set({ connected: true }));
  _socket.on('disconnect', () => set({ connected: false }));

  _socket.on('room:update', (room) => set({ room }));
  _socket.on('room:player_joined', ({ username }) => {
    get().showNotification(`${username} انضم! 🎉`, 'success');
  });
  _socket.on('room:player_left', () => {
    get().showNotification('لاعب غادر الغرفة', 'warning');
  });
  _socket.on('game:card_assigned', ({ card, mafiaTeam, validTargets }) => {
    set({ myCard: card, mafiaTeam, validTargets: validTargets || [] });
  });
  _socket.on('game:valid_targets_update', ({ validTargets }) => {
    set({ validTargets: validTargets || [] });
  });
  // yourTurn (from mafia_game_dev_plan.md) - تحديث الأهداف كل ليلة
  _socket.on('game:your_turn', ({ targets }) => {
    set({ validTargets: targets || [] });
  });
  _socket.on('game:investigation_result', (data) => {
    set({ investigationResult: data });
  });
  _socket.on('game:goodboy_choice', () => set({ goodBoyMode: false }));
  _socket.on('game:goodboy_pick', () => set({ goodBoyMode: true }));

  set({ socket: _socket });
  return _socket;
}

export const useGameStore = create((set, get) => ({
  // Connection
  socket: null,
  connected: false,

  // Player
  username: localStorage.getItem('mafia_username') || '',
  avatar: localStorage.getItem('mafia_avatar') || '🎭',
  language: localStorage.getItem('mafia_lang') || 'ar',

  // Room & Game
  room: null,
  myCard: null,
  mafiaTeam: null,
  validTargets: [],   // الأهداف الصالحة للاعب الحالي
  investigationResult: null,
  goodBoyMode: false,

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
    set({ socket: null, connected: false, room: null, myCard: null, mafiaTeam: null });
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

  startGame: () => new Promise((res) => {
    _socket?.emit('game:start', {}, res);
  }),

  sendNightAction: (actionType, targetId) => {
    _socket?.emit('game:night_action', { actionType, targetId });
  },
  sendVote: (targetId) => {
    _socket?.emit('game:vote', { targetId });
  },
  startVoting: () => {
    _socket?.emit('game:start_voting');
  },
  skipVote: () => {
    _socket?.emit('game:skip_vote');
  },
  revealMayor: () => {
    _socket?.emit('game:mayor_reveal');
  },
  sendGoodBoyPick: (targetId) => {
    _socket?.emit('game:goodboy_pick', { targetId });
  },
  setRoom: (room) => set({ room }),
  clearRoom: () => set({ room: null, myCard: null, mafiaTeam: null, investigationResult: null, goodBoyMode: false, validTargets: [] }),
}));
