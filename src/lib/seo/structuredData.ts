export interface PlayerStructuredData {
  full_name: string;
  position: string;
  team?: string;
  fdp_value?: number;
  dynasty_rank?: number;
  tier?: string;
  age?: number;
  value_epoch?: string;
}

export function generatePlayerStructuredData(player: PlayerStructuredData, slug: string) {
  const url = `https://www.fantasydraftpros.com/dynasty-value/${slug}`;

  const sportsPerson = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': url,
    name: player.full_name,
    jobTitle: `Professional Football Player - ${player.position}`,
    memberOf: player.team ? {
      '@type': 'SportsTeam',
      name: player.team,
      sport: 'American Football'
    } : undefined,
    description: `${player.full_name} is a ${player.position} ${player.team ? `for the ${player.team}` : ''} with a dynasty fantasy football value of ${player.fdp_value || 'N/A'} and ranking of ${player.dynasty_rank ? `#${player.dynasty_rank}` : 'unranked'}.`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url
    },
    url: url,
    dateModified: player.value_epoch || new Date().toISOString()
  };

  const faqItems = generateFAQItems(player);

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems
  };

  return { sportsPerson, faqPage };
}

function generateFAQItems(player: PlayerStructuredData) {
  const questions = [
    {
      question: `What is ${player.full_name}'s dynasty value?`,
      answer: `${player.full_name} currently has a dynasty value of ${player.fdp_value || 'N/A'} points and is ranked ${player.dynasty_rank ? `#${player.dynasty_rank}` : 'unranked'} overall in dynasty fantasy football. This value is calculated using our proprietary FDP algorithm that factors in age, production, situation, and market consensus.`
    },
    {
      question: `Is ${player.full_name} a buy low or sell high?`,
      answer: `Based on ${player.full_name}'s current value trends and market position, our analysis provides real-time trade advice. Check the value history chart and trade suggestions on this page for the latest recommendations on whether to buy, hold, or sell ${player.full_name}.`
    },
    {
      question: `Who is similar to ${player.full_name} in dynasty rankings?`,
      answer: `Players with similar dynasty values to ${player.full_name} are listed in the "Similar Players" section below. These players can serve as trade targets or comparables when evaluating ${player.full_name}'s value in your league.`
    },
    {
      question: `What tier is ${player.full_name} in?`,
      answer: `${player.full_name} is currently in ${player.tier || 'the mid-tier'} for dynasty fantasy football. Players in the same tier typically have similar trade values and can often be swapped in trades.`
    },
    {
      question: `How has ${player.full_name}'s dynasty value changed?`,
      answer: `${player.full_name}'s dynasty value history is tracked on this page with detailed explanations for major changes. Our value explanation engine identifies the key factors driving value movements, including performance, injuries, team changes, and market sentiment.`
    }
  ];

  return questions.map(q => ({
    '@type': 'Question',
    name: q.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: q.answer
    }
  }));
}

export function generateRankingsStructuredData(type: string) {
  const url = type === 'dynasty'
    ? 'https://www.fantasydraftpros.com/dynasty-rankings'
    : `https://www.fantasydraftpros.com/dynasty-${type}-rankings`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Dynasty Rankings`,
    description: `Complete ${type} dynasty fantasy football rankings with player values and trade analysis.`,
    url: url,
    dateModified: new Date().toISOString(),
    mainEntity: {
      '@type': 'ItemList',
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Player Rankings`,
      description: 'Ranked list of fantasy football players by dynasty value'
    }
  };
}

export function injectStructuredData(data: any, id: string = 'structured-data') {
  let script = document.getElementById(id) as HTMLScriptElement;

  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
}

export function injectMultipleStructuredData(dataArray: any[]) {
  dataArray.forEach((data, index) => {
    injectStructuredData(data, `structured-data-${index}`);
  });
}
