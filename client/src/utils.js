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
};

export const AVATARS = ['😎','🤠','🧙','🦸','🥷','🧛','👻','🤡','🦊','🐺','🦁','🐯','🎭','🃏','⚔️','🗡️'];
