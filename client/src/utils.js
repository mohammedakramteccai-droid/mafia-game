import { translations } from './translations';

export function useT(language) {
  const t = (key) => translations[language]?.[key] || translations['ar'][key] || key;
  return t;
}

export const CARD_INFO = {
  mafia:     { emoji: '🔴', color: '#e63946', team: 'mafia',    descKey: 'mafiaDesc' },
  detective: { emoji: '🔍', color: '#4895ef', team: 'citizens', descKey: 'detectiveDesc' },
  doctor:    { emoji: '💊', color: '#0ff4c6', team: 'citizens', descKey: 'doctorDesc' },
  villager:  { emoji: '👤', color: '#8888aa', team: 'citizens', descKey: 'villagerDesc' },
  vigilante: { emoji: '🔫', color: '#ff8c00', team: 'citizens', descKey: 'vigilanteDesc' },
  silencer:  { emoji: '🤐', color: '#7b2fff', team: 'mafia',    descKey: 'silencerDesc' },
  mayor:     { emoji: '👑', color: '#ffd60a', team: 'citizens', descKey: 'mayorDesc' },
  goodBoy:   { emoji: '😇', color: '#90e0ef', team: 'citizens', descKey: 'goodBoyDesc' },
};

export const AVATARS = ['😎','🤠','🧙','🦸','🥷','🧛','👻','🤡','🦊','🐺','🦁','🐯','🎭','🃏','⚔️','🗡️'];
