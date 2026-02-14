export type RbContext = {
  age?: number;
  depth_role?: "feature" | "lead_committee" | "committee" | "handcuff" | "backup";
  workload_tier?: "elite" | "solid" | "light" | "unknown";
  injury_risk?: "low" | "medium" | "high";
  contract_security?: "high" | "medium" | "low";
};

export function rbAdjustmentPoints(ctx: RbContext): number {
  let adj = 0;

  if (ctx.age != null) {
    if (ctx.age <= 22) adj += 250;
    else if (ctx.age <= 24) adj += 150;
    else if (ctx.age <= 25) adj += 0;
    else if (ctx.age === 26) adj -= 300;
    else if (ctx.age === 27) adj -= 650;
    else if (ctx.age >= 28) adj -= 1100;
  }

  if (ctx.depth_role === "feature") adj += 500;
  if (ctx.depth_role === "lead_committee") adj += 200;
  if (ctx.depth_role === "committee") adj -= 250;
  if (ctx.depth_role === "handcuff") adj -= 450;
  if (ctx.depth_role === "backup") adj -= 700;

  if (ctx.workload_tier === "elite") adj += 350;
  if (ctx.workload_tier === "solid") adj += 150;
  if (ctx.workload_tier === "light") adj -= 250;

  if (ctx.injury_risk === "medium") adj -= 150;
  if (ctx.injury_risk === "high") adj -= 450;

  if (ctx.contract_security === "high") adj += 200;
  if (ctx.contract_security === "low") adj -= 250;

  return adj;
}

export function getRbAdjustmentBreakdown(ctx: RbContext): Array<{ factor: string; points: number; description: string }> {
  const breakdown: Array<{ factor: string; points: number; description: string }> = [];

  if (ctx.age != null) {
    let points = 0;
    let desc = '';
    if (ctx.age <= 22) {
      points = 250;
      desc = 'Young elite prospect';
    } else if (ctx.age <= 24) {
      points = 150;
      desc = 'Prime youth advantage';
    } else if (ctx.age <= 25) {
      points = 0;
      desc = 'Prime age window';
    } else if (ctx.age === 26) {
      points = -300;
      desc = 'Beginning age decline';
    } else if (ctx.age === 27) {
      points = -650;
      desc = 'Significant age concern';
    } else if (ctx.age >= 28) {
      points = -1100;
      desc = 'High age risk';
    }
    if (points !== 0) {
      breakdown.push({ factor: `Age ${ctx.age}`, points, description: desc });
    }
  }

  if (ctx.depth_role === "feature") {
    breakdown.push({ factor: 'Feature Back', points: 500, description: 'Workhorse role, 70%+ snaps' });
  } else if (ctx.depth_role === "lead_committee") {
    breakdown.push({ factor: 'Lead Committee', points: 200, description: 'Lead back in committee (50-60%)' });
  } else if (ctx.depth_role === "committee") {
    breakdown.push({ factor: 'Committee', points: -250, description: 'Split backfield (30-50%)' });
  } else if (ctx.depth_role === "handcuff") {
    breakdown.push({ factor: 'Handcuff', points: -450, description: 'Backup with upside if starter injured' });
  } else if (ctx.depth_role === "backup") {
    breakdown.push({ factor: 'Backup', points: -700, description: 'Third-string or deeper' });
  }

  if (ctx.workload_tier === "elite") {
    breakdown.push({ factor: 'Elite Workload', points: 350, description: '250+ touches expected' });
  } else if (ctx.workload_tier === "solid") {
    breakdown.push({ factor: 'Solid Workload', points: 150, description: '175-250 touches expected' });
  } else if (ctx.workload_tier === "light") {
    breakdown.push({ factor: 'Light Workload', points: -250, description: 'Under 150 touches expected' });
  }

  if (ctx.injury_risk === "medium") {
    breakdown.push({ factor: 'Injury Risk', points: -150, description: 'Moderate injury history' });
  } else if (ctx.injury_risk === "high") {
    breakdown.push({ factor: 'High Injury Risk', points: -450, description: 'Significant injury concerns' });
  }

  if (ctx.contract_security === "high") {
    breakdown.push({ factor: 'Contract Security', points: 200, description: 'Multi-year deal, featured role' });
  } else if (ctx.contract_security === "low") {
    breakdown.push({ factor: 'Contract Insecurity', points: -250, description: 'Contract year or backup role' });
  }

  return breakdown;
}
