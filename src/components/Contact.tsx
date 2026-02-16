import { useState } from 'react';
import { Mail, MessageCircle, HelpCircle, Send, CheckCircle } from 'lucide-react';

export function Contact() {
  const email = 'fantasydraftproshelp@gmail.com';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Configuration error');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/send-contact-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again or email us directly.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (success) {
    return (
      <div className="bg-fdp-surface-1 rounded-2xl border border-fdp-border-1 p-8 max-w-2xl mx-auto">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-fdp-pos bg-opacity-20 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-fdp-pos" />
          </div>
          <h2 className="text-3xl font-bold text-fdp-text-1 mb-2">Message Sent!</h2>
          <p className="text-fdp-text-3 mb-6">
            Thank you for contacting us. We'll get back to you within 24-48 hours.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            Send Another Message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-fdp-surface-1 rounded-2xl border border-fdp-border-1 p-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-fdp-accent-1 to-fdp-accent-2 rounded-2xl mb-4">
          <Mail className="w-8 h-8 text-fdp-bg-0" />
        </div>
        <h2 className="text-3xl font-bold text-fdp-text-1 mb-2">Get in Touch</h2>
        <p className="text-fdp-text-3">We're here to help with any questions or feedback</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-fdp-text-2 mb-1">
            Your Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            disabled={loading}
            className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all disabled:opacity-50"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-fdp-text-2 mb-1">
            Your Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={loading}
            className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all disabled:opacity-50"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-fdp-text-2 mb-1">
            Subject
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            required
            disabled={loading}
            className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all disabled:opacity-50"
            placeholder="How can we help?"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-fdp-text-2 mb-1">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            disabled={loading}
            rows={6}
            className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all disabled:opacity-50 resize-none"
            placeholder="Tell us what you need help with..."
          />
        </div>

        {error && (
          <div className="bg-fdp-neg bg-opacity-10 border border-fdp-neg text-fdp-neg px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-fdp-bg-0 border-t-transparent rounded-full animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send Message
            </>
          )}
        </button>
      </form>

      <div className="space-y-4">
        <div className="bg-fdp-surface-2 rounded-xl p-6 border border-fdp-border-1">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-fdp-accent-1/20 to-fdp-accent-2/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-fdp-accent-1" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-fdp-text-1 mb-2">Email Support</h3>
              <p className="text-fdp-text-3 text-sm mb-3">
                Prefer to email directly? Reach out to us at:
              </p>
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-2 text-fdp-accent-1 hover:text-fdp-accent-2 font-medium transition-colors"
              >
                <Mail className="w-4 h-4" />
                {email}
              </a>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-2 rounded-xl p-6 border border-fdp-border-1">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-fdp-accent-1/20 to-fdp-accent-2/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-6 h-6 text-fdp-accent-1" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-fdp-text-1 mb-2">Common Topics</h3>
              <ul className="text-fdp-text-3 text-sm space-y-2">
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

      <div className="mt-8 pt-6 border-t border-fdp-border-1 text-center text-sm text-fdp-text-3">
        <p>We typically respond within 24-48 hours during business days</p>
      </div>
    </div>
  );
}
