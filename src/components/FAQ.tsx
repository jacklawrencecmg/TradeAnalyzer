import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, X } from 'lucide-react';

interface FAQItemProps {
  question: string;
  answer: string | JSX.Element;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
  return (
    <div className="border border-fdp-border-1 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-fdp-surface-1 hover:bg-fdp-surface-2 transition-colors text-left"
      >
        <span className="font-semibold text-fdp-text-1">{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-fdp-accent-1 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-fdp-text-3 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 bg-fdp-surface-2 border-t border-fdp-border-1">
          <div className="text-fdp-text-2 space-y-2">{answer}</div>
        </div>
      )}
    </div>
  );
}

interface FAQProps {
  onClose: () => void;
}

export function FAQ({ onClose }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      category: 'Getting Started',
      questions: [
        {
          question: 'What is Fantasy Draft Pros?',
          answer: (
            <>
              <p>
                Fantasy Draft Pros is a comprehensive fantasy football platform designed to help you make smarter decisions in your dynasty and redraft leagues. We provide:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Advanced trade analysis with real-time player valuations</li>
                <li>Power rankings and team strength evaluations</li>
                <li>Playoff probability simulations</li>
                <li>Draft assistance and keeper calculators</li>
                <li>Waiver wire recommendations</li>
                <li>And much more!</li>
              </ul>
            </>
          ),
        },
        {
          question: 'Which fantasy platforms are supported?',
          answer: (
            <>
              <p>We currently support:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Sleeper</strong> - Full support, no authentication required</li>
                <li><strong>ESPN Fantasy</strong> - Full support with cookie authentication</li>
                <li><strong>Yahoo Fantasy</strong> - Coming soon (OAuth integration in progress)</li>
                <li><strong>NFL.com</strong> - Planned for future release</li>
              </ul>
              <p className="mt-2">
                See our <strong>Multi-Platform Support</strong> documentation for detailed setup instructions.
              </p>
            </>
          ),
        },
        {
          question: 'Is Fantasy Draft Pros free to use?',
          answer: 'Yes! The core features including the Trade Analyzer are completely free. Sign in with your email to unlock additional features like Power Rankings, Playoff Simulator, Trade History, and more. No credit card required.',
        },
        {
          question: 'Do I need to create an account?',
          answer: 'You can use the basic Trade Analyzer without an account. However, creating a free account unlocks all premium features, saves your league data, tracks trade history, and provides personalized insights. Sign up takes less than 30 seconds!',
        },
      ],
    },
    {
      category: 'League Setup',
      questions: [
        {
          question: 'How do I add my Sleeper league?',
          answer: (
            <>
              <p>Adding a Sleeper league is easy:</p>
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>Sign in to Fantasy Draft Pros</li>
                <li>Click "Add League" button</li>
                <li>Select "Sleeper" as your platform</li>
                <li>Go to your league on Sleeper.com</li>
                <li>Copy the League ID from the URL (e.g., sleeper.com/leagues/123456789)</li>
                <li>Paste it into Fantasy Draft Pros</li>
                <li>Done! No authentication needed</li>
              </ol>
            </>
          ),
        },
        {
          question: 'How do I add my ESPN league?',
          answer: (
            <>
              <p>ESPN leagues require authentication cookies:</p>
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>Open ESPN Fantasy Football in your browser and log in</li>
                <li>Press F12 to open Developer Tools</li>
                <li>Go to "Application" (Chrome) or "Storage" (Firefox) tab</li>
                <li>Click "Cookies" in the left sidebar</li>
                <li>Find and copy these two values:
                  <ul className="list-disc pl-5 mt-1">
                    <li><code className="bg-fdp-surface-1 px-1 rounded">espn_s2</code> (long string)</li>
                    <li><code className="bg-fdp-surface-1 px-1 rounded">SWID</code> (format: {'{'}XXXX-XXXX-XXXX{'}'})</li>
                  </ul>
                </li>
                <li>In Fantasy Draft Pros, click "Add League"</li>
                <li>Select "ESPN" platform</li>
                <li>Enter your League ID and paste both cookie values</li>
                <li>Save!</li>
              </ol>
              <p className="mt-2 text-sm text-fdp-text-3">
                Note: ESPN cookies expire periodically. If your league stops loading, you'll need to update your cookies.
              </p>
            </>
          ),
        },
        {
          question: 'Can I add multiple leagues?',
          answer: 'Absolutely! You can add as many leagues as you want from any supported platform. Easily switch between them using the league dropdown in the dashboard.',
        },
        {
          question: 'What if my league is private?',
          answer: (
            <>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Sleeper:</strong> All leagues work, public or private</li>
                <li><strong>ESPN:</strong> Private leagues require authentication (espn_s2 and SWID cookies)</li>
                <li><strong>Yahoo:</strong> Full OAuth support coming soon</li>
              </ul>
            </>
          ),
        },
        {
          question: 'How do I mark my league as Superflex?',
          answer: 'When adding a league, check the "Superflex League?" box. This ensures player valuations account for the increased QB value in Superflex formats. You can also edit existing leagues to update this setting.',
        },
      ],
    },
    {
      category: 'Trade Analyzer',
      questions: [
        {
          question: 'How does the Trade Analyzer work?',
          answer: (
            <>
              <p>Our Trade Analyzer uses real-time player values from multiple sources including:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>KeepTradeCut dynasty rankings</li>
                <li>SportsData.io projections and statistics</li>
                <li>Our proprietary algorithms adjusting for age, injury, and league settings</li>
              </ul>
              <p className="mt-2">
                We calculate the total value of assets on each side (players, picks, FAAB) and provide a fairness assessment. Trades within 10% value difference are considered "fair."
              </p>
            </>
          ),
        },
        {
          question: 'Can I analyze trades with draft picks?',
          answer: 'Yes! Add draft picks to any trade. We value picks based on year, round, league format (Superflex/1QB), and whether IDP is used. Pick values depreciate for future years and appreciate for current year picks.',
        },
        {
          question: 'What about FAAB in trades?',
          answer: 'You can include FAAB (waiver budget) in trades. FAAB is valued as a percentage of your total budget. For example, $50 out of $100 budget = 50 value points.',
        },
        {
          question: 'Does it account for my league settings?',
          answer: (
            <>
              <p>Yes! Player values automatically adjust for:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Superflex:</strong> QB values increase significantly</li>
                <li><strong>TE Premium:</strong> TE values increase by 15%</li>
                <li><strong>IDP:</strong> Defensive player values adjust accordingly</li>
                <li><strong>League format:</strong> Dynasty vs. Redraft valuations</li>
                <li><strong>Scoring:</strong> PPR, Half-PPR, or Standard</li>
              </ul>
            </>
          ),
        },
        {
          question: 'Can I use the Trade Analyzer without an account?',
          answer: 'Yes! The Trade Analyzer is available to all users without signing in. However, signing in allows you to save trade history, analyze trades specific to your leagues, and unlock additional features.',
        },
        {
          question: 'How accurate are the player values?',
          answer: 'Player values are aggregated from industry-leading sources and updated regularly. However, remember that value is subjective! Use our analysis as a guide, but always consider your team needs, league dynamics, and personal player evaluations.',
        },
      ],
    },
    {
      category: 'Power Rankings & Playoffs',
      questions: [
        {
          question: 'How are Power Rankings calculated?',
          answer: (
            <>
              <p>Power Rankings evaluate total team value by summing:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>All rostered players (adjusted for age, injury, status)</li>
                <li>Owned draft picks for the next 3 years</li>
                <li>Remaining FAAB budget</li>
              </ul>
              <p className="mt-2">
                Teams are ranked by total value, giving you a true measure of dynasty team strength beyond just win-loss record.
              </p>
            </>
          ),
        },
        {
          question: 'What is the Playoff Simulator?',
          answer: (
            <>
              <p>
                The Playoff Simulator runs Monte Carlo simulations (10,000+ iterations by default) to calculate each team's probability of:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Making the playoffs</li>
                <li>Earning a first-round bye</li>
                <li>Winning the championship</li>
                <li>Finishing at each seed position</li>
              </ul>
              <p className="mt-2">
                Simulations account for current records, points scored/against, remaining schedule, and team strength to project final standings.
              </p>
            </>
          ),
        },
        {
          question: 'How often are rankings updated?',
          answer: 'Player values are cached for 24 hours and refreshed automatically. League data (rosters, records) is cached for 30 minutes. You can manually refresh at any time by switching between features or reloading the page.',
        },
      ],
    },
    {
      category: 'Features & Tools',
      questions: [
        {
          question: 'What is the Trade Finder?',
          answer: 'Trade Finder analyzes your roster against all league teams to identify mutually beneficial trades. It suggests deals where both sides gain value based on positional needs and roster construction.',
        },
        {
          question: 'How does the Waiver Assistant work?',
          answer: 'The Waiver Assistant compares available free agents to your current roster, recommending adds based on value upgrades, positional needs, and immediate impact potential.',
        },
        {
          question: 'What is the Lineup Optimizer?',
          answer: 'The Lineup Optimizer analyzes your roster and suggests the highest-value starting lineup based on player values, projections, and positional requirements.',
        },
        {
          question: 'Can I export my analysis?',
          answer: 'Yes! Use the Export & Share feature to generate shareable reports of your trade analysis, power rankings, or playoff odds. Great for league discussion!',
        },
        {
          question: 'What does the Championship Calculator do?',
          answer: 'The Championship Calculator projects your championship odds based on current roster strength, upcoming matchups, and playoff bracket scenarios.',
        },
      ],
    },
    {
      category: 'Data & Privacy',
      questions: [
        {
          question: 'Is my data secure?',
          answer: (
            <>
              <p>Yes! We take security seriously:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>All data is encrypted in transit and at rest</li>
                <li>Authentication credentials stored with Row Level Security</li>
                <li>Only you can access your leagues and trade history</li>
                <li>ESPN cookies are stored securely and never shared</li>
                <li>We never ask for passwords</li>
              </ul>
            </>
          ),
        },
        {
          question: 'What data do you collect?',
          answer: 'We only collect data necessary to provide our services: your email (for authentication), league IDs, trade history, and optional platform credentials (ESPN cookies). We never sell your data or share it with third parties.',
        },
        {
          question: 'Can I delete my account?',
          answer: 'Yes. Contact us at contact@fantasydraftpros.com and we will permanently delete your account and all associated data within 30 days.',
        },
      ],
    },
    {
      category: 'Troubleshooting',
      questions: [
        {
          question: 'My league is not loading',
          answer: (
            <>
              <p>Try these steps:</p>
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>Verify your League ID is correct</li>
                <li>For ESPN: Check if your cookies have expired and update them</li>
                <li>Try refreshing the page</li>
                <li>Clear your browser cache</li>
                <li>Check if your league platform (Sleeper/ESPN) is experiencing issues</li>
              </ol>
              <p className="mt-2">
                Still having issues? Contact us with your League ID and platform.
              </p>
            </>
          ),
        },
        {
          question: 'Player values seem wrong',
          answer: (
            <>
              <p>A few things to check:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Confirm your league is marked as Superflex (if applicable)</li>
                <li>Values are for dynasty format by default - redraft values differ</li>
                <li>Injured players have reduced values automatically</li>
                <li>Rookie values may be volatile early in the season</li>
              </ul>
              <p className="mt-2">
                Remember: values are guidelines! Your league may value players differently.
              </p>
            </>
          ),
        },
        {
          question: 'ESPN authentication keeps failing',
          answer: (
            <>
              <p>ESPN cookies expire periodically. To fix:</p>
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>Log out of ESPN completely</li>
                <li>Clear ESPN cookies from your browser</li>
                <li>Log back into ESPN Fantasy</li>
                <li>Get fresh espn_s2 and SWID cookies</li>
                <li>Update your league settings in Fantasy Draft Pros</li>
              </ol>
              <p className="mt-2 text-sm text-fdp-text-3">
                Tip: Save your cookies in a secure note so you can easily update them when needed.
              </p>
            </>
          ),
        },
        {
          question: 'Features are slow or not responding',
          answer: 'First-time loads may take a few seconds as we fetch player data. Subsequent loads are much faster due to caching. If issues persist, try refreshing the page or clearing your browser cache.',
        },
      ],
    },
    {
      category: 'Account & Billing',
      questions: [
        {
          question: 'How do I change my email?',
          answer: 'Currently, email changes require manual intervention. Contact us at contact@fantasydraftpros.com with your current and new email address.',
        },
        {
          question: 'I forgot my password',
          answer: 'Click "Sign In" and then "Forgot Password?" to receive a password reset link via email. Make sure to check your spam folder if you don\'t see it within a few minutes.',
        },
        {
          question: 'Will Fantasy Draft Pros stay free?',
          answer: 'Core features will always be free! We may introduce premium tiers in the future with advanced analytics and additional features, but the current feature set will remain accessible.',
        },
      ],
    },
  ];

  const allQuestions = faqs.flatMap((category, categoryIndex) =>
    category.questions.map((q, qIndex) => ({
      ...q,
      index: categoryIndex * 100 + qIndex,
      category: category.category,
    }))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-8 h-8 text-fdp-accent-1" />
            <div>
              <h1 className="text-3xl font-bold text-fdp-text-1">
                Frequently Asked Questions
              </h1>
              <p className="text-fdp-text-3 mt-1">
                Find answers to common questions about Fantasy Draft Pros
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-fdp-text-3 hover:text-fdp-text-1 transition-colors"
            aria-label="Close FAQ"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-8">
          {faqs.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h2 className="text-xl font-bold text-fdp-text-1 mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-fdp-accent-1 to-fdp-accent-2 rounded-full"></span>
                {category.category}
              </h2>
              <div className="space-y-3">
                {category.questions.map((q, qIndex) => {
                  const questionIndex = categoryIndex * 100 + qIndex;
                  return (
                    <FAQItem
                      key={questionIndex}
                      question={q.question}
                      answer={q.answer}
                      isOpen={openIndex === questionIndex}
                      onToggle={() =>
                        setOpenIndex(openIndex === questionIndex ? null : questionIndex)
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-2">
            Still have questions?
          </h3>
          <p className="text-fdp-text-2 mb-4">
            Can't find what you're looking for? Check out our comprehensive Help page or contact our support team.
          </p>
          <div className="flex gap-4">
            <a
              href="mailto:contact@fantasydraftpros.com"
              className="px-4 py-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-0.5 font-semibold"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
