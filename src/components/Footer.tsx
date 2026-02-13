import React from 'react';
import { Facebook, Instagram } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-r from-fdp-surface-1 to-fdp-bg-1 border-t border-fdp-border-1 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-fdp-text-2 text-sm">
            © {currentYear} Fantasy Draft Pros. All rights reserved.
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://www.facebook.com/FantasyDraftPros"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fdp-text-2 hover:text-fdp-accent-1 transition-colors"
              aria-label="Facebook"
            >
              <Facebook className="w-5 h-5" />
            </a>
            <a
              href="https://www.instagram.com/fantasydraftpros"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fdp-text-2 hover:text-fdp-accent-1 transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://www.tiktok.com/@fantasydraftpros"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fdp-text-2 hover:text-fdp-accent-1 transition-colors"
              aria-label="TikTok"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
