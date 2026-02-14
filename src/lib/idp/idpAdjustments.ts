import type { IDPPosition } from './idpMultipliers';

export interface IDPAdjustmentFactors {
  tacklevolume_bonus: number;
  sack_premium: number;
  coverage_value: number;
  big_play_potential: number;
  consistency_factor: number;
  age_adjustment: number;
  team_defense_quality: number;
  snap_share: number;
}

export interface IDPAdjustmentResult {
  total: number;
  breakdown: Array<{
    factor: string;
    adjustment: number;
    description: string;
  }>;
}

export function calculateIDPAdjustments(
  position: IDPPosition,
  subPosition?: string,
  age?: number,
  teamDefenseRank?: number,
  snapSharePercent?: number
): IDPAdjustmentResult {
  const breakdown: Array<{ factor: string; adjustment: number; description: string }> = [];
  let total = 0;

  if (position === 'LB') {
    const tackleVolumeBonus = 250;
    total += tackleVolumeBonus;
    breakdown.push({
      factor: 'Tackle Volume',
      adjustment: tackleVolumeBonus,
      description: 'LBs lead league in tackle opportunities',
    });

    if (subPosition === 'ILB' || subPosition === 'MLB') {
      const insideBonus = 150;
      total += insideBonus;
      breakdown.push({
        factor: 'Inside LB Premium',
        adjustment: insideBonus,
        description: 'Inside linebackers get more tackles',
      });
    }
  }

  if (position === 'DL') {
    const sackPremium = 200;
    total += sackPremium;
    breakdown.push({
      factor: 'Sack Potential',
      adjustment: sackPremium,
      description: 'Pass rush production adds big play value',
    });

    if (subPosition === 'EDGE') {
      const edgeBonus = 180;
      total += edgeBonus;
      breakdown.push({
        factor: 'Edge Rusher Premium',
        adjustment: edgeBonus,
        description: 'Elite pass rushers score at premium rates',
      });
    }
  }

  if (position === 'DB') {
    const volatilityPenalty = -150;
    total += volatilityPenalty;
    breakdown.push({
      factor: 'Volatility',
      adjustment: volatilityPenalty,
      description: 'DBs have more inconsistent scoring week-to-week',
    });

    if (subPosition === 'CB') {
      const coverageBonus = 80;
      total += coverageBonus;
      breakdown.push({
        factor: 'Coverage Specialist',
        adjustment: coverageBonus,
        description: 'Elite CBs limit targets but create big plays',
      });
    }

    if (subPosition === 'S') {
      const safetyBonus = 120;
      total += safetyBonus;
      breakdown.push({
        factor: 'Safety Versatility',
        adjustment: safetyBonus,
        description: 'Safeties contribute in multiple stat categories',
      });
    }
  }

  if (age !== undefined) {
    const ageAdjustment = calculateIDPAgeCurve(position, age);
    if (ageAdjustment !== 0) {
      total += ageAdjustment;
      breakdown.push({
        factor: 'Age Curve',
        adjustment: ageAdjustment,
        description: getAgeDescription(age, ageAdjustment),
      });
    }
  }

  if (teamDefenseRank !== undefined) {
    const teamAdjustment = calculateTeamDefenseAdjustment(position, teamDefenseRank);
    if (teamAdjustment !== 0) {
      total += teamAdjustment;
      breakdown.push({
        factor: 'Team Defense Quality',
        adjustment: teamAdjustment,
        description: getTeamDefenseDescription(teamDefenseRank, teamAdjustment),
      });
    }
  }

  if (snapSharePercent !== undefined) {
    const snapAdjustment = calculateSnapShareAdjustment(snapSharePercent);
    if (snapAdjustment !== 0) {
      total += snapAdjustment;
      breakdown.push({
        factor: 'Snap Share',
        adjustment: snapAdjustment,
        description: `${Math.round(snapSharePercent)}% snap share ${snapSharePercent >= 75 ? '(workhorse)' : snapSharePercent >= 50 ? '(starter)' : '(rotational)'}`,
      });
    }
  }

  return { total, breakdown };
}

function calculateIDPAgeCurve(position: IDPPosition, age: number): number {
  if (position === 'LB') {
    if (age <= 24) return 100;
    if (age <= 27) return 50;
    if (age <= 30) return 0;
    if (age <= 32) return -150;
    return -350;
  }

  if (position === 'DL') {
    if (age <= 25) return 80;
    if (age <= 28) return 40;
    if (age <= 31) return 0;
    if (age <= 33) return -120;
    return -300;
  }

  if (position === 'DB') {
    if (age <= 26) return 120;
    if (age <= 29) return 60;
    if (age <= 31) return 0;
    if (age <= 33) return -180;
    return -400;
  }

  return 0;
}

function getAgeDescription(age: number, adjustment: number): string {
  if (adjustment > 50) return `Prime age ${age} (ascending value)`;
  if (adjustment > 0) return `Good age ${age} (slight premium)`;
  if (adjustment === 0) return `Peak age ${age} (neutral)`;
  if (adjustment > -200) return `Aging ${age} (slight decline)`;
  return `Old ${age} (steep decline)`;
}

function calculateTeamDefenseAdjustment(position: IDPPosition, rank: number): number {
  if (rank <= 5) {
    if (position === 'DL') return 200;
    if (position === 'LB') return 180;
    if (position === 'DB') return 150;
  }

  if (rank <= 10) {
    if (position === 'DL') return 100;
    if (position === 'LB') return 90;
    if (position === 'DB') return 75;
  }

  if (rank >= 28) {
    if (position === 'DL') return -100;
    if (position === 'LB') return -80;
    if (position === 'DB') return -120;
  }

  if (rank >= 22) {
    return -50;
  }

  return 0;
}

function getTeamDefenseDescription(rank: number, adjustment: number): string {
  if (rank <= 5) return `Elite defense (rank ${rank}) - more opportunities`;
  if (rank <= 10) return `Strong defense (rank ${rank}) - good situation`;
  if (rank >= 28) return `Weak defense (rank ${rank}) - fewer impact plays`;
  if (rank >= 22) return `Below average defense (rank ${rank})`;
  return `Average defense (rank ${rank})`;
}

function calculateSnapShareAdjustment(snapSharePercent: number): number {
  if (snapSharePercent >= 90) return 300;
  if (snapSharePercent >= 80) return 200;
  if (snapSharePercent >= 70) return 100;
  if (snapSharePercent >= 60) return 50;
  if (snapSharePercent >= 50) return 0;
  if (snapSharePercent >= 40) return -100;
  if (snapSharePercent >= 30) return -250;
  return -400;
}

export function getIDPTierDescription(fdpValue: number, position: IDPPosition): string {
  if (position === 'LB') {
    if (fdpValue >= 4500) return 'Elite LB1';
    if (fdpValue >= 3500) return 'Strong LB1';
    if (fdpValue >= 2500) return 'Mid LB1/LB2';
    if (fdpValue >= 1500) return 'LB2/Flex';
    if (fdpValue >= 800) return 'Deep LB3';
    return 'Depth/Streamer';
  }

  if (position === 'DL') {
    if (fdpValue >= 4200) return 'Elite DL1';
    if (fdpValue >= 3200) return 'Strong DL1';
    if (fdpValue >= 2200) return 'Mid DL1/DL2';
    if (fdpValue >= 1200) return 'DL2/Flex';
    if (fdpValue >= 600) return 'Deep DL3';
    return 'Depth/Streamer';
  }

  if (position === 'DB') {
    if (fdpValue >= 3800) return 'Elite DB1';
    if (fdpValue >= 2800) return 'Strong DB1';
    if (fdpValue >= 1800) return 'Mid DB1/DB2';
    if (fdpValue >= 1000) return 'DB2/Flex';
    if (fdpValue >= 500) return 'Deep DB3';
    return 'Depth/Streamer';
  }

  return 'Unranked';
}

export function getIDPVolatilityScore(position: IDPPosition, subPosition?: string): number {
  if (position === 'LB') {
    if (subPosition === 'ILB' || subPosition === 'MLB') return 20;
    return 35;
  }

  if (position === 'DL') {
    if (subPosition === 'EDGE') return 50;
    return 40;
  }

  if (position === 'DB') {
    if (subPosition === 'S') return 55;
    if (subPosition === 'CB') return 70;
    return 65;
  }

  return 50;
}

export function formatIDPAdjustment(adjustment: number): string {
  if (adjustment > 0) return `+${adjustment}`;
  return `${adjustment}`;
}

export function clampIDPValue(value: number): number {
  return Math.max(0, Math.min(10000, Math.round(value)));
}
