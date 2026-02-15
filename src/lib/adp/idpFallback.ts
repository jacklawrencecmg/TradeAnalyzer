interface IdpContext {
  position: string;
  age?: number;
  depth_role?: string;
  injury_risk?: string;
}

const IDP_BASE_VALUES: Record<string, number> = {
  LB: 4200,
  DL: 3900,
  DB: 3500,
  DE: 3900,
  DT: 3800,
  CB: 3600,
  S: 3400,
};

export function calculateIdpRedraftValue(context: IdpContext): number {
  const position = context.position?.toUpperCase();

  let baseValue = IDP_BASE_VALUES[position] || 0;

  if (baseValue === 0) {
    return 0;
  }

  if (context.depth_role === 'starter' || context.depth_role === '1') {
    baseValue += 600;
  }

  if (context.age && context.age <= 25) {
    baseValue += 250;
  } else if (context.age && context.age >= 30) {
    baseValue -= 400;
  }

  if (context.injury_risk === 'high') {
    baseValue -= 300;
  } else if (context.injury_risk === 'elevated') {
    baseValue -= 150;
  }

  return Math.max(0, Math.min(10000, baseValue));
}

export function isIdpPosition(position: string): boolean {
  const pos = position?.toUpperCase();
  return ['DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S'].includes(pos);
}

export function getIdpTier(value: number): {
  tier: string;
  description: string;
} {
  if (value >= 4500) {
    return { tier: 'elite', description: 'Top 5 IDP' };
  } else if (value >= 4000) {
    return { tier: 'idp1', description: 'High-End IDP1' };
  } else if (value >= 3500) {
    return { tier: 'idp2', description: 'Mid-Range IDP2' };
  } else if (value >= 3000) {
    return { tier: 'idp3', description: 'Flex IDP' };
  } else if (value >= 2000) {
    return { tier: 'depth', description: 'Deep League IDP' };
  } else {
    return { tier: 'waiver', description: 'Waiver Wire' };
  }
}
