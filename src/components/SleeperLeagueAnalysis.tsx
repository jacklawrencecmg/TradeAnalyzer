import React, { useState } from 'react';
import SleeperImport from './SleeperImport';
import LeagueDashboard from './LeagueDashboard';

export default function SleeperLeagueAnalysis() {
  const [selectedLeague, setSelectedLeague] = useState<{
    leagueId: string;
    leagueName: string;
  } | null>(null);

  const handleLeagueSelected = (leagueId: string, leagueName: string) => {
    setSelectedLeague({ leagueId, leagueName });
  };

  const handleBack = () => {
    setSelectedLeague(null);
  };

  if (selectedLeague) {
    return (
      <LeagueDashboard
        leagueId={selectedLeague.leagueId}
        leagueName={selectedLeague.leagueName}
        onBack={handleBack}
      />
    );
  }

  return <SleeperImport onLeagueSelected={handleLeagueSelected} />;
}
