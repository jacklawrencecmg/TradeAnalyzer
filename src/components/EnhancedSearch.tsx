import { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Clock, Star } from 'lucide-react';

interface SearchResult {
  id: string;
  name: string;
  team: string;
  position: string;
  value?: number;
  trend?: 'up' | 'down' | 'stable';
  avatar?: string;
}

interface EnhancedSearchProps {
  onSearch: (query: string) => SearchResult[];
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
  showRecent?: boolean;
}

export function EnhancedSearch({
  onSearch,
  onSelect,
  placeholder = 'Search players...',
  showRecent = true
}: EnhancedSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showRecent) {
      const stored = localStorage.getItem('recentSearches');
      if (stored) {
        setRecentSearches(JSON.parse(stored).slice(0, 5));
      }
    }
  }, [showRecent]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length > 0) {
      const searchResults = onSearch(query);
      setResults(searchResults);
      setIsOpen(true);
      setSelectedIndex(0);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, onSearch]);

  const handleSelect = (result: SearchResult) => {
    onSelect(result);
    setQuery('');
    setIsOpen(false);

    if (showRecent) {
      const updated = [result, ...recentSearches.filter(r => r.id !== result.id)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const displayList = query ? results : recentSearches;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, displayList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && displayList.length > 0) {
      e.preventDefault();
      handleSelect(displayList[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={index} className="bg-[#00d4ff]/30 text-[#00d4ff] font-semibold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const displayList = query ? results : (isOpen && showRecent ? recentSearches : []);

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00d4ff] focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {isOpen && displayList.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-gradient-to-b from-gray-900 to-gray-800 border border-gray-700 rounded-xl shadow-2xl max-h-96 overflow-y-auto z-50">
          {!query && showRecent && (
            <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400 font-medium">Recent Searches</span>
            </div>
          )}

          {displayList.map((result, index) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700/50 transition-colors ${
                index === selectedIndex ? 'bg-gray-700/50' : ''
              }`}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-[#00d4ff] to-[#0099cc] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg">
                {result.avatar ? (
                  <img src={result.avatar} alt={result.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  getInitials(result.name)
                )}
              </div>

              <div className="flex-1 text-left">
                <div className="font-semibold text-white text-sm">
                  {highlightMatch(result.name, query)}
                </div>
                <div className="text-xs text-gray-400">
                  {highlightMatch(`${result.team} • ${result.position}`, query)}
                </div>
              </div>

              {result.value && (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Value</div>
                    <div className="font-bold text-[#00d4ff]">{result.value}</div>
                  </div>
                  {result.trend === 'up' && (
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
              )}
            </button>
          ))}

          {query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400">
              <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <div className="font-medium">No players found</div>
              <div className="text-sm mt-1">Try a different search term</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
