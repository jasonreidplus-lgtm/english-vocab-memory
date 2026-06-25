import React from 'react';
import { Star } from 'lucide-react';

interface StarsProps {
  count?: number;
  total?: number;
  size?: number;
  pop?: boolean;
  gap?: number;
}

export default function Stars({ count = 0, total = 3, size = 18, pop = false, gap = 4 }: StarsProps) {
  return (
    <span style={{ display: 'inline-flex', gap }}>
      {Array.from({ length: total }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={pop ? 'pop' : undefined}
          style={pop ? { animationDelay: `${i * 0.12}s` } : undefined}
          fill={i < count ? 'var(--accent)' : 'transparent'}
          color="var(--accent)"
          strokeWidth={2}
        />
      ))}
    </span>
  );
}
