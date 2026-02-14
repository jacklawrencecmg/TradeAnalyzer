export type SeasonPhase =
  | 'playoffs'
  | 'pre_draft_hype'
  | 'rookie_fever'
  | 'post_draft_correction'
  | 'camp_battles'
  | 'season'
  | 'trade_deadline_push';

export interface PhaseInfo {
  phase: SeasonPhase;
  label: string;
  description: string;
  monthRange: string;
}

export function getSeasonPhase(date: Date = new Date()): SeasonPhase {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (month === 1 || (month === 2 && day <= 15)) {
    return 'playoffs';
  }

  if (month === 2 || month === 3) {
    return 'pre_draft_hype';
  }

  if (month === 4 && day <= 30) {
    return 'rookie_fever';
  }

  if (month === 5 || month === 6) {
    return 'post_draft_correction';
  }

  if (month === 7 || month === 8) {
    return 'camp_battles';
  }

  if (month === 9 || month === 10) {
    return 'season';
  }

  return 'trade_deadline_push';
}

export function getPhaseInfo(phase: SeasonPhase): PhaseInfo {
  const phaseInfoMap: Record<SeasonPhase, PhaseInfo> = {
    playoffs: {
      phase: 'playoffs',
      label: 'Playoffs',
      description: 'Contenders value proven players; picks slightly discounted',
      monthRange: 'Jan - Mid Feb',
    },
    pre_draft_hype: {
      phase: 'pre_draft_hype',
      label: 'Pre-Draft Hype',
      description: 'Rising rookie buzz; pick values climbing as draft approaches',
      monthRange: 'Late Feb - Mar',
    },
    rookie_fever: {
      phase: 'rookie_fever',
      label: 'Rookie Fever',
      description: 'Peak draft hype; rookie picks at maximum value',
      monthRange: 'April',
    },
    post_draft_correction: {
      phase: 'post_draft_correction',
      label: 'Post-Draft Correction',
      description: 'Landing spots known; slight value adjustment as reality sets in',
      monthRange: 'May - Jun',
    },
    camp_battles: {
      phase: 'camp_battles',
      label: 'Camp Battles',
      description: 'Training camp news moves values; moderate pick inflation',
      monthRange: 'Jul - Aug',
    },
    season: {
      phase: 'season',
      label: 'Regular Season',
      description: 'Focus on winning now; pick values decline slightly',
      monthRange: 'Sep - Oct',
    },
    trade_deadline_push: {
      phase: 'trade_deadline_push',
      label: 'Trade Deadline Push',
      description: 'Contenders buying, rebuilders selling; picks near baseline value',
      monthRange: 'Nov - Dec',
    },
  };

  return phaseInfoMap[phase];
}

export function getCurrentPhaseInfo(): PhaseInfo {
  const currentPhase = getSeasonPhase();
  return getPhaseInfo(currentPhase);
}

export function getPhaseEmoji(phase: SeasonPhase): string {
  const emojiMap: Record<SeasonPhase, string> = {
    playoffs: '🏆',
    pre_draft_hype: '📈',
    rookie_fever: '🔥',
    post_draft_correction: '📊',
    camp_battles: '⚔️',
    season: '🏈',
    trade_deadline_push: '⏰',
  };

  return emojiMap[phase];
}

export function getNextPhaseDate(): Date {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  if (month === 1 || (month === 2 && today.getDate() <= 15)) {
    return new Date(year, 1, 16);
  }

  if (month === 2 || month === 3) {
    return new Date(year, 3, 1);
  }

  if (month === 4) {
    return new Date(year, 4, 1);
  }

  if (month === 5 || month === 6) {
    return new Date(year, 6, 1);
  }

  if (month === 7 || month === 8) {
    return new Date(year, 8, 1);
  }

  if (month === 9 || month === 10) {
    return new Date(year, 10, 1);
  }

  return new Date(year + 1, 0, 1);
}
