import { useState, useRef, useCallback, useEffect } from "react";

interface PatternLockGridProps {
  onComplete: (pattern: number[]) => void;
  disabled?: boolean;
  error?: boolean;
  size?: number;
}

const DOT_POSITIONS = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: 2 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
  { row: 2, col: 0 },
  { row: 2, col: 1 },
  { row: 2, col: 2 },
];

export default function PatternLockGrid({
  onComplete,
  disabled = false,
  error = false,
  size = 240,
}: PatternLockGridProps) {
  const [selectedDots, setSelectedDots] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const padding = size * 0.15;
  const cellSize = (size - padding * 2) / 2;
  const dotRadius = size * 0.04;
  const activeDotRadius = size * 0.06;

  const getDotCenter = useCallback(
    (index: number) => {
      const pos = DOT_POSITIONS[index];
      return {
        x: padding + pos.col * cellSize,
        y: padding + pos.row * cellSize,
      };
    },
    [padding, cellSize]
  );

  const getRelativePos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    []
  );

  const findDotAtPos = useCallback(
    (pos: { x: number; y: number }) => {
      const hitRadius = cellSize * 0.35;
      for (let i = 0; i < 9; i++) {
        const center = getDotCenter(i);
        const dist = Math.sqrt((pos.x - center.x) ** 2 + (pos.y - center.y) ** 2);
        if (dist < hitRadius) return i;
      }
      return -1;
    },
    [getDotCenter, cellSize]
  );

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      const pos = getRelativePos(e);
      if (!pos) return;
      const dot = findDotAtPos(pos);
      if (dot >= 0) {
        setSelectedDots([dot]);
        setIsDrawing(true);
        setCurrentPos(pos);
      }
    },
    [disabled, getRelativePos, findDotAtPos]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled) return;
      e.preventDefault();
      const pos = getRelativePos(e);
      if (!pos) return;
      setCurrentPos(pos);
      const dot = findDotAtPos(pos);
      if (dot >= 0 && !selectedDots.includes(dot)) {
        setSelectedDots((prev) => [...prev, dot]);
      }
    },
    [isDrawing, disabled, getRelativePos, findDotAtPos, selectedDots]
  );

  const handleEnd = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setCurrentPos(null);
    if (selectedDots.length >= 4) {
      onComplete(selectedDots);
    }
    setTimeout(() => setSelectedDots([]), 300);
  }, [isDrawing, selectedDots, onComplete]);

  useEffect(() => {
    const handleGlobalEnd = () => {
      if (isDrawing) handleEnd();
    };
    window.addEventListener("mouseup", handleGlobalEnd);
    window.addEventListener("touchend", handleGlobalEnd);
    return () => {
      window.removeEventListener("mouseup", handleGlobalEnd);
      window.removeEventListener("touchend", handleGlobalEnd);
    };
  }, [isDrawing, handleEnd]);

  const lineColor = error
    ? "hsl(var(--destructive))"
    : "hsl(var(--primary))";
  const dotColor = "hsl(var(--muted-foreground))";
  const activeDotColor = error
    ? "hsl(var(--destructive))"
    : "hsl(var(--primary))";

  return (
    <div
      ref={containerRef}
      className="select-none touch-none"
      style={{ width: size, height: size, position: "relative" }}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      data-testid="pattern-lock-grid"
    >
      <svg width={size} height={size} className="absolute inset-0">
        {selectedDots.map((dot, i) => {
          if (i === 0) return null;
          const from = getDotCenter(selectedDots[i - 1]);
          const to = getDotCenter(dot);
          return (
            <line
              key={`line-${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={lineColor}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.7}
            />
          );
        })}
        {isDrawing && selectedDots.length > 0 && currentPos && (
          <line
            x1={getDotCenter(selectedDots[selectedDots.length - 1]).x}
            y1={getDotCenter(selectedDots[selectedDots.length - 1]).y}
            x2={currentPos.x}
            y2={currentPos.y}
            stroke={lineColor}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.4}
            strokeDasharray="4 4"
          />
        )}
        {DOT_POSITIONS.map((_, i) => {
          const center = getDotCenter(i);
          const isActive = selectedDots.includes(i);
          return (
            <g key={`dot-${i}`}>
              {isActive && (
                <circle
                  cx={center.x}
                  cy={center.y}
                  r={activeDotRadius * 2}
                  fill={activeDotColor}
                  opacity={0.12}
                />
              )}
              <circle
                cx={center.x}
                cy={center.y}
                r={isActive ? activeDotRadius : dotRadius}
                fill={isActive ? activeDotColor : dotColor}
                className="transition-all duration-150"
                data-testid={`pattern-dot-${i}`}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
