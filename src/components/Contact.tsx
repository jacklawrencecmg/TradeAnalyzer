import { Mail, MessageCircle, HelpCircle } from 'lucide-react';

export function Contact() {
  const email = 'FantasyDraftProsHelp@gmail.com';

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700 p-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#00d4ff] to-[#0099cc] rounded-2xl mb-4">
          <Mail className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Get in Touch</h2>
        <p className="text-gray-400">We're here to help with any questions or feedback</p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-[#00d4ff]/50 transition-all duration-300">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#00d4ff]/20 to-[#0099cc]/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-[#00d4ff]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Email Support</h3>
              <p className="text-gray-400 text-sm mb-3">
                Send us an email and we'll get back to you as soon as possible
              </p>
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-2 text-[#00d4ff] hover:text-[#3de0ff] font-medium transition-colors"
              >
                <Mail className="w-4 h-4" />
                {email}
              </a>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#00d4ff]/20 to-[#0099cc]/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-6 h-6 text-[#00d4ff]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Common Topics</h3>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>• Trade analysis and recommendations</li>
                <li>• Platform integration issues</li>
                <li>• Feature requests and suggestions</li>
                <li>• Account and authentication help</li>
                <li>• Bug reports and technical issues</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00d4ff] to-[#0099cc] text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-[#00d4ff]/50 transition-all duration-300 hover:scale-105"
        >
          <Mail className="w-5 h-5" />
          Send Us an Email
        </a>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-700 text-center text-sm text-gray-500">
        <p>We typically respond within 24-48 hours during business days</p>
      </div>
    </div>
  );
}
