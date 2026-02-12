export function PlayerCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 card-enter">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 skeleton rounded-full"></div>
        <div className="flex-1">
          <div className="h-4 skeleton rounded w-3/4 mb-2"></div>
          <div className="h-3 skeleton rounded w-1/2"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 skeleton rounded w-full"></div>
        <div className="h-3 skeleton rounded w-5/6"></div>
      </div>
    </div>
  );
}

export function TradeCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 card-enter">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 skeleton rounded-full"></div>
          <div>
            <div className="h-5 skeleton rounded w-32 mb-2"></div>
            <div className="h-3 skeleton rounded w-24"></div>
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <div className="h-3 skeleton rounded w-20 mb-2"></div>
          <div className="h-6 skeleton rounded w-16"></div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <div className="h-3 skeleton rounded w-20 mb-2"></div>
          <div className="h-6 skeleton rounded w-16"></div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <div className="h-3 skeleton rounded w-20 mb-2"></div>
          <div className="h-6 skeleton rounded w-16"></div>
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-700 card-enter" style={{ animationDelay: `${i * 0.1}s` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 skeleton rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 skeleton rounded w-3/4 mb-2"></div>
              <div className="h-3 skeleton rounded w-1/2"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700 p-6 card-enter">
      <div className="h-4 skeleton rounded w-32 mb-3"></div>
      <div className="h-8 skeleton rounded w-20 mb-2"></div>
      <div className="h-3 skeleton rounded w-24"></div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`header-${i}`} className="h-4 skeleton rounded"></div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="grid gap-4 py-3 border-t border-gray-700 card-enter"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, animationDelay: `${rowIndex * 0.05}s` }}
        >
          {Array.from({ length: cols }).map((_, colIndex) => (
            <div key={`cell-${rowIndex}-${colIndex}`} className="h-3 skeleton rounded"></div>
          ))}
        </div>
      ))}
    </div>
  );
}
