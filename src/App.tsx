import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';
import { SubscriptionGate } from './components/SubscriptionGate';
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
import { FeedbackButton } from './components/FeedbackButton';
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
    return (
      <>
        <DoctorAdmin />
        <FeedbackButton context={{ page: 'admin/doctor' }} />
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
        <AuthForm />
        <FeedbackButton context={{ page: 'auth' }} />
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
