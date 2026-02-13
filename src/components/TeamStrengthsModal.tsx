import { X } from 'lucide-react';
import { useState } from 'react';
import { RadarChart } from './RadarChart';
import { ProgressBar } from './ProgressBar';

interface TeamStrength {
  category: string;
  value: number;
  color: string;
}

interface TeamStrengthsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  strengths: TeamStrength[];
}

export function TeamStrengthsModal({ isOpen, onClose, teamName, strengths }: TeamStrengthsModalProps) {
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);

  if (!isOpen) return null;

  const maxValue = Math.max(...strengths.map(s => s.value));
  const total = strengths.reduce((sum, s) => sum + s.value, 0);

  const radarData = strengths.map(s => ({
    label: s.category,
    value: s.value,
    max: maxValue * 1.2
  }));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">{teamName}</h2>
            <p className="text-gray-400 text-sm mt-1">Team Strengths Analysis</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-8 items-center mb-8">
            <div className="flex-shrink-0">
              <RadarChart data={radarData} size={350} color="#00d4ff" />
            </div>

            <div className="flex-1 w-full space-y-3">
              <h3 className="text-lg font-bold text-white mb-4">Positional Breakdown</h3>
              {strengths.map((strength, index) => {
                const percentage = ((strength.value / total) * 100).toFixed(1);
                const isHovered = hoveredSegment === index;

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border transition-all duration-300 ${
                      isHovered
                        ? 'border-[#00d4ff] bg-gray-800 scale-105 shadow-lg shadow-[#00d4ff]/20'
                        : 'border-gray-700 bg-gray-800/50'
                    }`}
                    onMouseEnter={() => setHoveredSegment(index)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full ring-2 ring-white/20"
                          style={{ backgroundColor: strength.color }}
                        />
                        <span className="text-white font-semibold">{strength.category}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold text-xl">{percentage}%</div>
                        <div className="text-gray-400 text-sm">{strength.value.toFixed(0)} pts</div>
                      </div>
                    </div>
                    <ProgressBar
                      value={parseFloat(percentage)}
                      max={100}
                      color="blue"
                      size="sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-[#00d4ff] rounded-full"></div>
                Total Value
              </h3>
              <p className="text-3xl font-bold text-[#00d4ff]">{total.toFixed(0)}</p>
              <p className="text-gray-400 text-sm mt-1">Combined positional strength</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                Strongest Position
              </h3>
              <p className="text-3xl font-bold text-emerald-500">
                {strengths.reduce((max, s) => s.value > max.value ? s : max, strengths[0]).category}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {((strengths.reduce((max, s) => s.value > max.value ? s : max, strengths[0]).value / total) * 100).toFixed(1)}% of total value
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
            <h3 className="text-white font-semibold mb-2">About Team Strengths</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Team strengths are calculated based on positional value distribution across your roster.
              A balanced team typically has strength across all positions, while specialized teams may
              excel in specific areas. The radar chart provides a visual representation of your team's
              positional balance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
