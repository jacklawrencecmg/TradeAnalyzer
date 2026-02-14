export type InferredRbContext = {
  depth_role: "feature" | "lead_committee" | "committee" | "handcuff" | "backup";
  workload_tier: "elite" | "solid" | "light";
  contract_security: "high" | "medium" | "low";
  confidence: number;
};

interface RbTeamData {
  player_id: string;
  player_name: string;
  age?: number;
  team: string | null;
  ktc_value: number;
  position_rank: number;
}

export function inferRbContext(
  rb: RbTeamData,
  teamRBs: RbTeamData[]
): InferredRbContext {
  const sortedTeamRBs = [...teamRBs].sort((a, b) => b.ktc_value - a.ktc_value);
  const rbRank = sortedTeamRBs.findIndex(r => r.player_id === rb.player_id) + 1;

  let confidence = 0.5;

  const depthRole = inferDepthRole(rb, sortedTeamRBs, rbRank);
  const workloadTier = inferWorkloadTier(rb, depthRole, rbRank);
  const contractSecurity = inferContractSecurity(rb, depthRole);

  confidence = calculateConfidence(rb, sortedTeamRBs, rbRank, depthRole);

  return {
    depth_role: depthRole,
    workload_tier: workloadTier,
    contract_security: contractSecurity,
    confidence,
  };
}

function inferDepthRole(
  rb: RbTeamData,
  sortedTeamRBs: RbTeamData[],
  rbRank: number
): "feature" | "lead_committee" | "committee" | "handcuff" | "backup" {
  if (!rb.team) {
    return "backup";
  }

  if (sortedTeamRBs.length === 1) {
    return "feature";
  }

  if (rbRank === 1) {
    const rb2 = sortedTeamRBs[1];
    const valueGap = rb.ktc_value - (rb2?.ktc_value || 0);
    const gapRatio = rb2 ? valueGap / rb2.ktc_value : 1;

    if (gapRatio > 0.5) {
      return "feature";
    } else if (gapRatio > 0.2) {
      return "lead_committee";
    } else {
      return "committee";
    }
  }

  if (rbRank === 2) {
    const rb1 = sortedTeamRBs[0];
    const valueGap = rb1.ktc_value - rb.ktc_value;
    const gapRatio = valueGap / rb.ktc_value;

    if (gapRatio > 1.0) {
      return "handcuff";
    } else if (gapRatio > 0.3) {
      return "committee";
    } else {
      return "committee";
    }
  }

  if (rbRank === 3) {
    const rb1 = sortedTeamRBs[0];
    if (rb1.ktc_value > 5000) {
      return "handcuff";
    }
    return "backup";
  }

  return "backup";
}

function inferWorkloadTier(
  rb: RbTeamData,
  depthRole: string,
  rbRank: number
): "elite" | "solid" | "light" {
  if (depthRole === "feature") {
    if (rb.ktc_value > 7000) {
      return "elite";
    }
    return "solid";
  }

  if (depthRole === "lead_committee") {
    if (rb.ktc_value > 6000) {
      return "elite";
    }
    return "solid";
  }

  if (depthRole === "committee") {
    if (rb.ktc_value > 4000) {
      return "solid";
    }
    return "light";
  }

  return "light";
}

function inferContractSecurity(
  rb: RbTeamData,
  depthRole: string
): "high" | "medium" | "low" {
  if (rb.age && rb.age <= 23) {
    return "high";
  }

  if (depthRole === "feature" || depthRole === "lead_committee") {
    if (rb.ktc_value > 6000) {
      return "high";
    }
    return "medium";
  }

  if (rb.age && rb.age >= 28) {
    return "low";
  }

  if (depthRole === "backup") {
    return "low";
  }

  return "medium";
}

function calculateConfidence(
  rb: RbTeamData,
  sortedTeamRBs: RbTeamData[],
  rbRank: number,
  depthRole: string
): number {
  let confidence = 0.5;

  if (!rb.team) {
    return 0.3;
  }

  if (sortedTeamRBs.length === 1) {
    confidence = 0.9;
  }

  if (rbRank === 1) {
    const rb2 = sortedTeamRBs[1];
    if (rb2) {
      const valueGap = rb.ktc_value - rb2.ktc_value;
      const gapRatio = valueGap / rb2.ktc_value;

      if (gapRatio > 0.5) {
        confidence = 0.95;
      } else if (gapRatio > 0.2) {
        confidence = 0.85;
      } else {
        confidence = 0.75;
      }
    } else {
      confidence = 0.9;
    }
  }

  if (rbRank === 2) {
    confidence = 0.8;
  }

  if (rbRank >= 3) {
    confidence = 0.7;
  }

  if (rb.ktc_value > 8000) {
    confidence = Math.min(1.0, confidence + 0.1);
  }

  if (rb.ktc_value < 1000) {
    confidence = Math.max(0.3, confidence - 0.2);
  }

  if (rb.age) {
    if (rb.age <= 23 || rb.age >= 28) {
      confidence = Math.min(1.0, confidence + 0.05);
    }
  }

  return Math.round(confidence * 100) / 100;
}

export function inferAllRbContexts(rbs: RbTeamData[]): Map<string, InferredRbContext> {
  const rbsByTeam = new Map<string, RbTeamData[]>();

  for (const rb of rbs) {
    const team = rb.team || 'FA';
    if (!rbsByTeam.has(team)) {
      rbsByTeam.set(team, []);
    }
    rbsByTeam.get(team)!.push(rb);
  }

  const inferences = new Map<string, InferredRbContext>();

  for (const [team, teamRBs] of rbsByTeam) {
    for (const rb of teamRBs) {
      const inference = inferRbContext(rb, teamRBs);
      inferences.set(rb.player_id, inference);
    }
  }

  return inferences;
}

export function shouldAutoApply(confidence: number, minConfidence: number = 0.9): boolean {
  return confidence >= minConfidence;
}

export function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

export function getContextSource(
  hasManualData: boolean,
  suggestedConfidence?: number
): "manual" | "auto-detected" | "default" {
  if (hasManualData) return "manual";
  if (suggestedConfidence && suggestedConfidence >= 0.75) return "auto-detected";
  return "default";
}
