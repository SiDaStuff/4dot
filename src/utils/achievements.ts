export interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: string;
  earnedAt?: number;
}

const ACHIEVEMENT_DEFS: Achievement[] = [
  { id: 'first_win', label: 'First Win', description: 'Win your first game', icon: 'emoji_events' },
  { id: 'first_game', label: 'First Game', description: 'Play your first game', icon: 'sports_esports' },
  { id: 'ten_wins', label: '10 Wins', description: 'Win 10 games', icon: 'military_tech' },
  { id: 'fifty_games', label: '50 Games', description: 'Play 50 games', icon: 'grid_view' },
  { id: 'hundred_games', label: '100 Games', description: 'Play 100 games', icon: 'numbers' },
  { id: 'win_streak_3', label: '3 Win Streak', description: 'Win 3 games in a row', icon: 'local_fire_department' },
  { id: 'win_streak_5', label: '5 Win Streak', description: 'Win 5 games in a row', icon: 'whatshot' },
  { id: 'win_streak_10', label: '10 Win Streak', description: 'Win 10 games in a row', icon: 'bolt' },
  { id: 'beat_hard_bot', label: 'Beat Hard Bot', description: 'Win against Hard bot', icon: 'smart_toy' },
  { id: 'beat_max_bot', label: 'Beat MAX Bot', description: 'Win against Stockfish/MAX bot', icon: 'psychology' },
  { id: 'rating_1600', label: '1600 Rating', description: 'Reach 1600 rating', icon: 'trending_up' },
  { id: 'rating_1800', label: '1800 Rating', description: 'Reach 1800 rating', icon: 'star' },
  { id: 'rating_2000', label: '2000 Rating', description: 'Reach 2000 rating', icon: 'workspace_premium' },
  { id: 'five_draws', label: '5 Draws', description: 'Draw 5 games', icon: 'handshake' },
  { id: 'comeback_king', label: 'Comeback King', description: 'Win after being behind in placement', icon: 'refresh' },
];

const STORAGE_KEY = '4dot_achievements';
const NOTIFIED_KEY = '4dot_achievements_notified';

function loadAchievements(): Record<string, number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function saveAchievements(earned: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(earned));
  } catch {}
}

function loadNotified(): Set<string> {
  try {
    const stored = localStorage.getItem(NOTIFIED_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

function saveNotified(notified: Set<string>) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified]));
  } catch {}
}

export function getAchievementDefs(): Achievement[] {
  return ACHIEVEMENT_DEFS;
}

export function getEarnedAchievements(): Record<string, number> {
  return loadAchievements();
}

export function getAchievementsWithStatus(): Achievement[] {
  const earned = loadAchievements();
  return ACHIEVEMENT_DEFS.map(a => ({
    ...a,
    earnedAt: earned[a.id],
  }));
}

export function checkAndAwardAchievements(
  stats: { wins: number; losses: number; draws: number; gamesPlayed: number; rating: number },
  recentResults: ('win' | 'loss' | 'draw')[],
  botWins: { hard: boolean; max: boolean }
): Achievement[] {
  const earned = loadAchievements();
  const notified = loadNotified();
  const newlyEarned: Achievement[] = [];

  const check = (id: string, condition: boolean) => {
    if (condition && !earned[id]) {
      earned[id] = Date.now();
      newlyEarned.push(ACHIEVEMENT_DEFS.find(a => a.id === id)!);
    }
  };

  check('first_game', stats.gamesPlayed >= 1);
  check('first_win', stats.wins >= 1);
  check('ten_wins', stats.wins >= 10);
  check('fifty_games', stats.gamesPlayed >= 50);
  check('hundred_games', stats.gamesPlayed >= 100);
  check('five_draws', stats.draws >= 5);
  check('rating_1600', stats.rating >= 1600);
  check('rating_1800', stats.rating >= 1800);
  check('rating_2000', stats.rating >= 2000);
  check('beat_hard_bot', botWins.hard);
  check('beat_max_bot', botWins.max);

  let streak = 0;
  let maxStreak = 0;
  for (const r of recentResults) {
    if (r === 'win') { streak++; maxStreak = Math.max(maxStreak, streak); }
    else streak = 0;
  }
  check('win_streak_3', maxStreak >= 3);
  check('win_streak_5', maxStreak >= 5);
  check('win_streak_10', maxStreak >= 10);

  saveAchievements(earned);

  const unnotified = newlyEarned.filter(a => !notified.has(a.id));
  unnotified.forEach(a => notified.add(a.id));
  saveNotified(notified);

  return unnotified;
}

export function awardBotWinAchievement(strength: string) {
  const earned = loadAchievements();
  if (strength === 'hard' && !earned['beat_hard_bot']) {
    earned['beat_hard_bot'] = Date.now();
    saveAchievements(earned);
  }
  if ((strength === 'stockfish' || strength === 'max') && !earned['beat_max_bot']) {
    earned['beat_max_bot'] = Date.now();
    saveAchievements(earned);
  }
}
