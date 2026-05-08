// ======================================
// MAFIA GAME - Core Game Logic Engine
// ======================================

const CARDS = {
  mafia: { id: 'mafia', team: 'mafia', emoji: '🔴', required: true },
  detective: { id: 'detective', team: 'citizens', emoji: '🔍', required: true },
  doctor: { id: 'doctor', team: 'citizens', emoji: '💊', required: true },
  villager: { id: 'villager', team: 'citizens', emoji: '👤', required: true },
  vigilante: { id: 'vigilante', team: 'citizens', emoji: '🔫', required: false },
  silencer: { id: 'silencer', team: 'mafia', emoji: '🤐', required: false },
  mayor: { id: 'mayor', team: 'citizens', emoji: '👑', required: false },
  goodBoy: { id: 'goodBoy', team: 'citizens', emoji: '😇', required: false },
};

function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateRoomId() {
  return Math.random().toString(36).substr(2, 9);
}

// Fisher-Yates shuffle (from mafia_game_code_examples.md)
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function assignCards(players, settings) {
  const { mafiaCount, enabledCards } = settings;
  const playerCount = players.length;

  const cardPool = [];

  // البطاقات الإلزامية:
  // القاتل الصامت يُحسب ضمن عدد القتلة (mafiaCount).
  // إذا كان مفعّلاً: ورقة واحدة silencer + (mafiaCount - 1) ورقة mafia عادية.
  if (enabledCards.silencer && mafiaCount >= 1) {
    cardPool.push('silencer');                           // 1 قاتل صامت
    for (let i = 0; i < mafiaCount - 1; i++) cardPool.push('mafia'); // الباقي مافيا عادية
  } else {
    for (let i = 0; i < mafiaCount; i++) cardPool.push('mafia');     // كل القتلة مافيا عادية
  }
  cardPool.push('detective');
  cardPool.push('doctor');

  // البطاقات الاختيارية (باستثناء silencer الذي عولج أعلاه)
  if (enabledCards.vigilante) cardPool.push('vigilante');
  if (enabledCards.mayor)     cardPool.push('mayor');
  if (enabledCards.goodBoy)   cardPool.push('goodBoy');

  // ملء البقية بـ villager
  const remaining = playerCount - cardPool.length;
  for (let i = 0; i < remaining; i++) cardPool.push('villager');

  // خلط Fisher-Yates
  const shuffled = shuffleArray(cardPool);

  const assigned = {};
  players.forEach((player, i) => { assigned[player.id] = shuffled[i]; });
  return assigned;
}

// الأهداف الصالحة لكل دور (المافيا لا تختار من فريقها)
function getValidTargets(player, players) {
  const aliveOthers = players.filter(p => p.isAlive && p.id !== player.id);
  // المافيا والقاتل الصامت لا يستهدفان أحداً من فريق المافيا
  if (player.card === 'mafia' || player.card === 'silencer') {
    return aliveOthers.filter(p => CARDS[p.card]?.team !== 'mafia');
  }
  return aliveOthers;
}


function checkWinCondition(players) {
  const alive = players.filter(p => p.isAlive);
  const mafiaAlive = alive.filter(p => CARDS[p.card]?.team === 'mafia').length;
  const citizensAlive = alive.filter(p => CARDS[p.card]?.team === 'citizens').length;

  if (mafiaAlive === 0) return { winner: 'citizens', reason: 'all_mafia_dead' };
  if (mafiaAlive >= citizensAlive) return { winner: 'mafia', reason: 'mafia_outnumber' };
  return null;
}

function calculateVotes(votes, players) {
  // votes = { voterId: targetId }
  const voteCounts = {};

  players.forEach(p => { if (p.isAlive) voteCounts[p.id] = 0; });

  Object.entries(votes).forEach(([voterId, targetId]) => {
    if (!targetId || !voteCounts.hasOwnProperty(targetId)) return;
    const voter = players.find(p => p.id === voterId);
    if (!voter) return;
    const weight = voter.card === 'mayor' && voter.mayorRevealed ? 3 : 1;
    voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
  });

  // Find max
  let maxVotes = 0;
  let topVoters = [];

  Object.entries(voteCounts).forEach(([playerId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      topVoters = [playerId];
    } else if (count === maxVotes && count > 0) {
      topVoters.push(playerId);
    }
  });

  if (maxVotes === 0) return { eliminated: null, isTie: false, voteCounts };
  if (topVoters.length > 1) return { eliminated: null, isTie: true, tiedPlayers: topVoters, voteCounts };
  return { eliminated: topVoters[0], isTie: false, voteCounts };
}

function processNightActions(nightActions, players, settings) {
  const results = {
    killed: null,
    saved: false,
    investigated: null,
    investigationResult: null,
    silenced: null,
    vigilanteKilled: null,
    vigilanteDied: false,
    messages: []
  };

  const { mafiaTarget, doctorTarget, detectiveTarget, vigilanteTarget, silencerTarget } = nightActions;

  // Mafia kill
  if (mafiaTarget) {
    results.killed = mafiaTarget;
  }

  // Doctor save
  if (doctorTarget && doctorTarget === mafiaTarget) {
    results.saved = true;
    results.killed = null;
    results.messages.push({ type: 'saved', playerId: doctorTarget });
  }

  // Detective investigate
  if (detectiveTarget) {
    const target = players.find(p => p.id === detectiveTarget);
    if (target) {
      results.investigated = detectiveTarget;
      results.investigationResult = CARDS[target.card]?.team === 'mafia' ? 'mafia' : 'citizen';
    }
  }

  // Silencer
  if (silencerTarget && settings.enabledCards.silencer) {
    results.silenced = silencerTarget;
  }

  // Vigilante
  if (vigilanteTarget && settings.enabledCards.vigilante) {
    const target = players.find(p => p.id === vigilanteTarget);
    if (target) {
      if (CARDS[target.card]?.team === 'mafia') {
        results.vigilanteKilled = vigilanteTarget;
      } else {
        // Killed a citizen - both die
        results.vigilanteKilled = vigilanteTarget;
        results.vigilanteDied = true;
      }
    }
  }

  return results;
}

module.exports = {
  CARDS,
  generateRoomCode,
  generateRoomId,
  assignCards,
  checkWinCondition,
  calculateVotes,
  processNightActions,
  getValidTargets,
};
