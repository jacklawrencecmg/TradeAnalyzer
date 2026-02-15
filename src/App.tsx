import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';
import TradeAnalyzer from './components/TradeAnalyzer';
import SharedTradePage from './components/SharedTradePage';
import PublicLeagueRankings from './components/PublicLeagueRankings';
import DoctorAdmin from './components/DoctorAdmin';
import Top1000Rankings from './components/Top1000Rankings';
import SafeModeBanner from './components/SafeModeBanner';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import Footer from './components/Footer';
import { FAQ } from './components/FAQ';
import { Help } from './components/Help';
import { LogIn } from 'lucide-react';

type Page = 'home' | 'faq' | 'help' | 'top1000';

function AppContent() {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [tradeSlug, setTradeSlug] = useState<string | null>(null);
  const [leagueSlug, setLeagueSlug] = useState<string | null>(null);
  const [showDoctorAdmin, setShowDoctorAdmin] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;

    if (path === '/admin/doctor') {
      setShowDoctorAdmin(true);
      return;
    }

    if (path === '/top1000' || path === '/rankings/top1000') {
      setCurrentPage('top1000');
      return;
    }

    const tradeMatch = path.match(/^\/trade\/([a-z0-9]+)$/);
    if (tradeMatch) {
      setTradeSlug(tradeMatch[1]);
      return;
    }

    const leagueMatch = path.match(/^\/league\/public\/([a-z0-9-]+)$/);
    if (leagueMatch) {
      setLeagueSlug(leagueMatch[1]);
      return;
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0">
        <div className="text-fdp-text-1 text-xl">Loading...</div>
      </div>
    );
  }

  if (showDoctorAdmin) {
    return <DoctorAdmin />;
  }

  if (tradeSlug) {
    return (
      <>
        <SafeModeBanner />
        <SharedTradePage slug={tradeSlug} />
      </>
    );
  }

  if (leagueSlug) {
    return (
      <>
        <SafeModeBanner />
        <PublicLeagueRankings slug={leagueSlug} />
      </>
    );
  }

  if (currentPage === 'top1000') {
    return (
      <>
        <SafeModeBanner />
        <Top1000Rankings />
        <Footer />
      </>
    );
  }

  if (user) {
    if (currentPage === 'faq') {
      return (
        <>
          <SafeModeBanner />
          <FAQ onClose={() => setCurrentPage('home')} />
        </>
      );
    }
    if (currentPage === 'help') {
      return (
        <>
          <SafeModeBanner />
          <Help onClose={() => setCurrentPage('home')} />
        </>
      );
    }
    return (
      <>
        <SafeModeBanner />
        <Dashboard onNavigate={setCurrentPage} />
      </>
    );
  }

  if (currentPage === 'faq') {
    return (
      <>
        <SafeModeBanner />
        <FAQ onClose={() => setCurrentPage('home')} />
      </>
    );
  }

  if (currentPage === 'help') {
    return (
      <>
        <SafeModeBanner />
        <Help onClose={() => setCurrentPage('home')} />
      </>
    );
  }

  if (showAuth) {
    return (
      <div>
        <SafeModeBanner />
        <button
          onClick={() => setShowAuth(false)}
          className="absolute top-4 left-4 text-fdp-text-2 hover:text-fdp-text-1 transition-colors"
        >
          ← Back to Trade Analyzer
        </button>
        <AuthForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 flex flex-col">
      <SafeModeBanner />
      {/* Header */}
      <div className="bg-gradient-to-r from-fdp-surface-1 to-fdp-bg-1 border-b border-fdp-border-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/FDP2.png"
                alt="Fantasy Draft Pros Logo"
                className="h-12 w-auto object-contain drop-shadow-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <h1 className="text-2xl font-bold text-fdp-text-1">
                  Fantasy Draft Pros
                </h1>
                <p className="text-fdp-text-3 text-sm">Free Trade Analyzer</p>
              </div>
            </div>
            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-0.5"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        {/* Info Banner */}
        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-4 mb-6">
          <p className="text-fdp-text-2 text-center">
            <span className="font-semibold text-fdp-accent-1">Sign in</span> to unlock Power Rankings, Playoff Odds, and Trade History for your leagues
          </p>
        </div>

        {/* Trade Analyzer */}
        <TradeAnalyzer />
      </div>

      <Footer onNavigate={setCurrentPage} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
