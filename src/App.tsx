import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RouterProvider } from './lib/seo/router';
import SafeModeBanner from './components/SafeModeBanner';
import { FeedbackButton } from './components/FeedbackButton';
import { LogIn } from 'lucide-react';

const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const SubscriptionGate = lazy(() => import('./components/SubscriptionGate').then(m => ({ default: m.SubscriptionGate })));
const SharedTradePage = lazy(() => import('./components/SharedTradePage'));
const PublicLeagueRankings = lazy(() => import('./components/PublicLeagueRankings'));
const DoctorAdmin = lazy(() => import('./components/DoctorAdmin'));
const Top1000Rankings = lazy(() => import('./components/Top1000Rankings'));
const PlayerValuePage = lazy(() => import('./components/PlayerValuePage').then(m => ({ default: m.PlayerValuePage })));
const DynastyRankingsPage = lazy(() => import('./components/DynastyRankingsPage').then(m => ({ default: m.DynastyRankingsPage })));
const PlayerComparisonPage = lazy(() => import('./components/PlayerComparisonPage').then(m => ({ default: m.PlayerComparisonPage })));
const NewsArticlePage = lazy(() => import('./components/NewsArticlePage').then(m => ({ default: m.NewsArticlePage })));
const NewsIndexPage = lazy(() => import('./components/NewsIndexPage').then(m => ({ default: m.NewsIndexPage })));
const QuestionPageComponent = lazy(() => import('./components/QuestionPage').then(m => ({ default: m.QuestionPageComponent })));
const QuestionsIndexPage = lazy(() => import('./components/QuestionsIndexPage').then(m => ({ default: m.QuestionsIndexPage })));
const SEOAdmin = lazy(() => import('./components/SEOAdmin').then(m => ({ default: m.SEOAdmin })));
const Footer = lazy(() => import('./components/Footer'));
const FAQ = lazy(() => import('./components/FAQ').then(m => ({ default: m.FAQ })));
const Help = lazy(() => import('./components/Help').then(m => ({ default: m.Help })));
const Contact = lazy(() => import('./components/Contact').then(m => ({ default: m.Contact })));

type Page = 'home' | 'faq' | 'help' | 'contact' | 'top1000' | 'dynasty-rankings' | 'player-value' | 'player-comparison' | 'news-index' | 'news-article' | 'questions-index' | 'question-page';

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0">
      <div className="text-fdp-text-1 text-xl">Loading...</div>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [tradeSlug, setTradeSlug] = useState<string | null>(null);
  const [leagueSlug, setLeagueSlug] = useState<string | null>(null);
  const [playerSlug, setPlayerSlug] = useState<string | null>(null);
  const [comparisonSlug, setComparisonSlug] = useState<string | null>(null);
  const [newsSlug, setNewsSlug] = useState<string | null>(null);
  const [questionSlug, setQuestionSlug] = useState<string | null>(null);
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

    if (path === '/questions') {
      setCurrentPage('questions-index');
      return;
    }

    const questionMatch = path.match(/^\/questions\/([a-z0-9-]+)$/);
    if (questionMatch) {
      setQuestionSlug(questionMatch[1]);
      setCurrentPage('question-page');
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
    return <PageLoader />;
  }

  if (showDoctorAdmin) {
    return (
      <Suspense fallback={<PageLoader />}>
        <DoctorAdmin />
        <FeedbackButton context={{ page: 'admin/doctor' }} />
      </Suspense>
    );
  }

  if (showSEOAdmin) {
    return (
      <Suspense fallback={<PageLoader />}>
        <SEOAdmin />
        <FeedbackButton context={{ page: 'admin/seo' }} />
      </Suspense>
    );
  }

  if (tradeSlug) {
    return (
      <Suspense fallback={<PageLoader />}>
        <SafeModeBanner />
        <SharedTradePage slug={tradeSlug} />
        <FeedbackButton context={{ page: `trade/${tradeSlug}` }} />
      </Suspense>
    );
  }

  if (leagueSlug) {
    return (
      <Suspense fallback={<PageLoader />}>
        <SafeModeBanner />
        <PublicLeagueRankings slug={leagueSlug} />
        <FeedbackButton context={{ page: `league/${leagueSlug}` }} />
      </Suspense>
    );
  }

  if (currentPage === 'news-index') {
    return (
      <Suspense fallback={<PageLoader />}>
        <SafeModeBanner />
        <NewsIndexPage />
        <Footer onNavigate={setCurrentPage} />
        <FeedbackButton context={{ page: 'news' }} />
      </Suspense>
    );
  }

  if (currentPage === 'news-article' && newsSlug) {
    return (
      <RouterProvider params={{ slug: newsSlug }}>
        <Suspense fallback={<PageLoader />}>
          <SafeModeBanner />
          <NewsArticlePage />
          <Footer onNavigate={setCurrentPage} />
          <FeedbackButton context={{ page: `news/${newsSlug}` }} />
        </Suspense>
      </RouterProvider>
    );
  }

  if (currentPage === 'questions-index') {
    return (
      <Suspense fallback={<PageLoader />}>
        <SafeModeBanner />
        <QuestionsIndexPage />
        <Footer onNavigate={setCurrentPage} />
        <FeedbackButton context={{ page: 'questions' }} />
      </Suspense>
    );
  }

  if (currentPage === 'question-page' && questionSlug) {
    return (
      <RouterProvider params={{ slug: questionSlug }}>
        <Suspense fallback={<PageLoader />}>
          <SafeModeBanner />
          <QuestionPageComponent />
          <Footer onNavigate={setCurrentPage} />
          <FeedbackButton context={{ page: `questions/${questionSlug}` }} />
        </Suspense>
      </RouterProvider>
    );
  }

  if (currentPage === 'dynasty-rankings') {
    return (
      <Suspense fallback={<PageLoader />}>
        <SafeModeBanner />
        <DynastyRankingsPage />
        <Footer onNavigate={setCurrentPage} />
        <FeedbackButton context={{ page: 'dynasty-rankings' }} />
      </Suspense>
    );
  }

  if (currentPage === 'player-value' && playerSlug) {
    return (
      <RouterProvider params={{ slug: playerSlug }}>
        <Suspense fallback={<PageLoader />}>
          <SafeModeBanner />
          <PlayerValuePage />
          <Footer onNavigate={setCurrentPage} />
          <FeedbackButton context={{ page: `player-value/${playerSlug}` }} />
        </Suspense>
      </RouterProvider>
    );
  }

  if (currentPage === 'player-comparison' && comparisonSlug) {
    return (
      <RouterProvider params={{ slug: comparisonSlug }}>
        <Suspense fallback={<PageLoader />}>
          <SafeModeBanner />
          <PlayerComparisonPage />
          <Footer onNavigate={setCurrentPage} />
          <FeedbackButton context={{ page: `comparison/${comparisonSlug}` }} />
        </Suspense>
      </RouterProvider>
    );
  }

  if (currentPage === 'top1000') {
    return (
      <Suspense fallback={<PageLoader />}>
        <SafeModeBanner />
        <Top1000Rankings />
        <Footer onNavigate={setCurrentPage} />
        <FeedbackButton context={{ page: 'top1000' }} />
      </Suspense>
    );
  }

  if (currentPage === 'faq') {
    return (
      <Suspense fallback={<PageLoader />}>
        <SafeModeBanner />
        <FAQ onClose={() => setCurrentPage('home')} />
        <Footer onNavigate={setCurrentPage} />
        <FeedbackButton context={{ page: 'faq' }} />
      </Suspense>
    );
  }

  if (currentPage === 'help') {
    return (
      <Suspense fallback={<PageLoader />}>
        <SafeModeBanner />
        <Help onClose={() => setCurrentPage('home')} />
        <Footer onNavigate={setCurrentPage} />
        <FeedbackButton context={{ page: 'help' }} />
      </Suspense>
    );
  }

  if (currentPage === 'contact') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 py-12 px-4">
        <Suspense fallback={<PageLoader />}>
          <SafeModeBanner />
          <button
            onClick={() => setCurrentPage('home')}
            className="mb-6 text-fdp-text-2 hover:text-fdp-text-1 transition-colors"
          >
            ← Back
          </button>
          <Contact />
          <Footer onNavigate={setCurrentPage} />
          <FeedbackButton context={{ page: 'contact' }} />
        </Suspense>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <SafeModeBanner />
        <LandingPage />
        <Footer onNavigate={setCurrentPage} />
        <FeedbackButton context={{ page: 'landing' }} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <SubscriptionGate>
        <>
          <SafeModeBanner />
          <Dashboard onNavigate={setCurrentPage} />
          <FeedbackButton context={{ page: 'dashboard' }} />
        </>
      </SubscriptionGate>
    </Suspense>
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
