import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { SubscriptionGate } from './components/SubscriptionGate';
import TradeAnalyzer from './components/TradeAnalyzer';
import SharedTradePage from './components/SharedTradePage';
import PublicLeagueRankings from './components/PublicLeagueRankings';
import DoctorAdmin from './components/DoctorAdmin';
import Top1000Rankings from './components/Top1000Rankings';
import { PlayerValuePage } from './components/PlayerValuePage';
import { DynastyRankingsPage } from './components/DynastyRankingsPage';
import { PlayerComparisonPage } from './components/PlayerComparisonPage';
import { NewsArticlePage } from './components/NewsArticlePage';
import { NewsIndexPage } from './components/NewsIndexPage';
import { SEOAdmin } from './components/SEOAdmin';
import { RouterProvider } from './lib/seo/router';
import SafeModeBanner from './components/SafeModeBanner';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import Footer from './components/Footer';
import { FAQ } from './components/FAQ';
import { Help } from './components/Help';
import { Contact } from './components/Contact';
import { FeedbackButton } from './components/FeedbackButton';
import { LogIn } from 'lucide-react';

type Page = 'home' | 'faq' | 'help' | 'contact' | 'top1000' | 'dynasty-rankings' | 'player-value' | 'player-comparison' | 'news-index' | 'news-article';

function AppContent() {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [tradeSlug, setTradeSlug] = useState<string | null>(null);
  const [leagueSlug, setLeagueSlug] = useState<string | null>(null);
  const [playerSlug, setPlayerSlug] = useState<string | null>(null);
  const [comparisonSlug, setComparisonSlug] = useState<string | null>(null);
  const [newsSlug, setNewsSlug] = useState<string | null>(null);
  const [showDoctorAdmin, setShowDoctorAdmin] = useState(false);
  const [showSEOAdmin, setShowSEOAdmin] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;

    if (path === '/admin/doctor') {
      setShowDoctorAdmin(true);
      return;
    }

    if (path === '/admin/seo') {
      setShowSEOAdmin(true);
      return;
    }

    if (path === '/trade-calculator') {
      window.location.href = '/';
      return;
    }

    if (path === '/news') {
      setCurrentPage('news-index');
      return;
    }

    const newsArticleMatch = path.match(/^\/news\/([a-z0-9-]+)$/);
    if (newsArticleMatch) {
      setNewsSlug(newsArticleMatch[1]);
      setCurrentPage('news-article');
      return;
    }

    if (path === '/dynasty-rankings' || path === '/dynasty-superflex-rankings' || path === '/dynasty-rookie-rankings' || path === '/dynasty-idp-rankings') {
      setCurrentPage('dynasty-rankings');
      return;
    }

    const playerValueMatch = path.match(/^\/dynasty-value\/([a-z0-9-]+)$/);
    if (playerValueMatch) {
      setPlayerSlug(playerValueMatch[1]);
      setCurrentPage('player-value');
      return;
    }

    const comparisonMatch = path.match(/^\/compare\/([a-z0-9-]+)-vs-([a-z0-9-]+)-dynasty$/);
    if (comparisonMatch) {
      setComparisonSlug(`${comparisonMatch[1]}-vs-${comparisonMatch[2]}-dynasty`);
      setCurrentPage('player-comparison');
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
    return (
      <>
        <DoctorAdmin />
        <FeedbackButton context={{ page: 'admin/doctor' }} />
      </>
    );
  }

  if (showSEOAdmin) {
    return (
      <>
        <SEOAdmin />
        <FeedbackButton context={{ page: 'admin/seo' }} />
      </>
    );
  }

  if (tradeSlug) {
    return (
      <>
        <SafeModeBanner />
        <SharedTradePage slug={tradeSlug} />
        <FeedbackButton context={{ page: `trade/${tradeSlug}` }} />
      </>
    );
  }

  if (leagueSlug) {
    return (
      <>
        <SafeModeBanner />
        <PublicLeagueRankings slug={leagueSlug} />
        <FeedbackButton context={{ page: `league/${leagueSlug}` }} />
      </>
    );
  }

  if (currentPage === 'news-index') {
    return (
      <>
        <SafeModeBanner />
        <NewsIndexPage />
        <Footer />
        <FeedbackButton context={{ page: 'news' }} />
      </>
    );
  }

  if (currentPage === 'news-article' && newsSlug) {
    return (
      <RouterProvider params={{ slug: newsSlug }}>
        <SafeModeBanner />
        <NewsArticlePage />
        <Footer />
        <FeedbackButton context={{ page: `news/${newsSlug}` }} />
      </RouterProvider>
    );
  }

  if (currentPage === 'dynasty-rankings') {
    return (
      <>
        <SafeModeBanner />
        <DynastyRankingsPage />
        <Footer />
        <FeedbackButton context={{ page: 'dynasty-rankings' }} />
      </>
    );
  }

  if (currentPage === 'player-value' && playerSlug) {
    return (
      <RouterProvider params={{ slug: playerSlug }}>
        <SafeModeBanner />
        <PlayerValuePage />
        <Footer />
        <FeedbackButton context={{ page: `player-value/${playerSlug}` }} />
      </RouterProvider>
    );
  }

  if (currentPage === 'player-comparison' && comparisonSlug) {
    return (
      <RouterProvider params={{ slug: comparisonSlug }}>
        <SafeModeBanner />
        <PlayerComparisonPage />
        <Footer />
        <FeedbackButton context={{ page: `comparison/${comparisonSlug}` }} />
      </RouterProvider>
    );
  }

  if (currentPage === 'top1000') {
    return (
      <>
        <SafeModeBanner />
        <Top1000Rankings />
        <Footer />
        <FeedbackButton context={{ page: 'top1000' }} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <SafeModeBanner />
        <LandingPage />
        <FeedbackButton context={{ page: 'landing' }} />
      </>
    );
  }

  return (
    <SubscriptionGate>
      {currentPage === 'faq' ? (
        <>
          <SafeModeBanner />
          <FAQ onClose={() => setCurrentPage('home')} />
          <FeedbackButton context={{ page: 'faq' }} />
        </>
      ) : currentPage === 'help' ? (
        <>
          <SafeModeBanner />
          <Help onClose={() => setCurrentPage('home')} />
          <FeedbackButton context={{ page: 'help' }} />
        </>
      ) : currentPage === 'contact' ? (
        <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 py-12 px-4">
          <SafeModeBanner />
          <button
            onClick={() => setCurrentPage('home')}
            className="mb-6 text-fdp-text-2 hover:text-fdp-text-1 transition-colors"
          >
            ← Back to Dashboard
          </button>
          <Contact />
          <FeedbackButton context={{ page: 'contact' }} />
        </div>
      ) : (
        <>
          <SafeModeBanner />
          <Dashboard onNavigate={setCurrentPage} />
          <FeedbackButton context={{ page: 'dashboard' }} />
        </>
      )}
    </SubscriptionGate>
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
