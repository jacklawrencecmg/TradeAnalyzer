import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;

    ctx.clearRect(0, 0, width, height);

    const total = strengths.reduce((sum, s) => sum + s.value, 0);
    let currentAngle = -Math.PI / 2;

    strengths.forEach((strength, index) => {
      const sliceAngle = (strength.value / total) * 2 * Math.PI;
      const isHovered = hoveredSegment === index;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(
        centerX,
        centerY,
        isHovered ? radius + 10 : radius,
        currentAngle,
        currentAngle + sliceAngle
      );
      ctx.closePath();

      ctx.fillStyle = strength.color;
      ctx.fill();

      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.stroke();

      const labelAngle = currentAngle + sliceAngle / 2;
      const labelRadius = radius * 0.7;
      const labelX = centerX + Math.cos(labelAngle) * labelRadius;
      const labelY = centerY + Math.sin(labelAngle) * labelRadius;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const percentage = ((strength.value / total) * 100).toFixed(1);
      ctx.fillText(`${percentage}%`, labelX, labelY);

      currentAngle += sliceAngle;
    });
  }, [isOpen, strengths, hoveredSegment]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 40;

    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= radius + 10) {
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;

      const total = strengths.reduce((sum, s) => sum + s.value, 0);
      let currentAngle = 0;

      for (let i = 0; i < strengths.length; i++) {
        const sliceAngle = (strengths[i].value / total) * 2 * Math.PI;
        if (angle >= currentAngle && angle < currentAngle + sliceAngle) {
          setHoveredSegment(i);
          return;
        }
        currentAngle += sliceAngle;
      }
    }

    setHoveredSegment(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-fdp-surface-1 rounded-lg border border-fdp-border-1 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-fdp-border-1">
          <h2 className="text-2xl font-bold text-fdp-text-1">{teamName} - Team Strengths</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-fdp-surface-2 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-fdp-text-3" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-8 items-center">
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="cursor-pointer"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredSegment(null)}
            />

            <div className="flex-1 w-full space-y-3">
              {strengths.map((strength, index) => {
                const total = strengths.reduce((sum, s) => sum + s.value, 0);
                const percentage = ((strength.value / total) * 100).toFixed(1);
                const isHovered = hoveredSegment === index;

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-all ${
                      isHovered
                        ? 'border-fdp-accent-1 bg-fdp-surface-2 scale-105'
                        : 'border-fdp-border-1 bg-fdp-surface-2'
                    }`}
                    onMouseEnter={() => setHoveredSegment(index)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: strength.color }}
                        />
                        <span className="text-fdp-text-1 font-medium">{strength.category}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-fdp-text-1 font-bold text-lg">{percentage}%</div>
                        <div className="text-fdp-text-3 text-sm">{strength.value.toFixed(0)} pts</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 p-4 bg-fdp-surface-2 border border-fdp-border-1 rounded-lg">
            <h3 className="text-fdp-text-1 font-semibold mb-2">About Team Strengths</h3>
            <p className="text-fdp-text-3 text-sm">
              Team strengths are calculated based on positional value distribution across your roster.
              A balanced team typically has strength across all positions, while specialized teams may
              excel in specific areas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
