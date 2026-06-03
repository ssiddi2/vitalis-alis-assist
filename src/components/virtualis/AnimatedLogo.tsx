import { cn } from '@/lib/utils';
import virtualisOneLogo from '@/assets/virtualis-one-logo.png.asset.json';

interface AnimatedLogoProps {
  /** Logo height in pixels */
  size?: number;
  /** Hide the orbit ring (use for compact mobile contexts) */
  compact?: boolean;
  className?: string;
}

/**
 * VirtualisOne logo with futuristic ambient motion:
 * counter-rotating aura, dashed orbit ring, gentle float, shimmer sweep.
 * Honors prefers-reduced-motion via Tailwind `motion-safe:` prefixes.
 */
export const AnimatedLogo = ({ size = 256, compact = false, className }: AnimatedLogoProps) => {
  const ringSize = size * 1.45;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: ringSize, height: ringSize }}
    >
      {/* Counter-rotating aura orbs */}
      <div className="absolute inset-0 motion-safe:animate-spin-slow">
        <div className="absolute inset-[15%] rounded-full bg-gradient-to-tr from-primary/40 via-transparent to-info/40 blur-3xl motion-safe:animate-aura-pulse" />
      </div>
      <div className="absolute inset-0 motion-safe:animate-spin-reverse-slow">
        <div className="absolute inset-[20%] rounded-full bg-gradient-to-bl from-info/30 via-transparent to-primary/30 blur-2xl" />
      </div>

      {/* Dashed orbit ring */}
      {!compact && (
        <svg
          className="absolute inset-0 w-full h-full motion-safe:animate-spin-slow text-primary/30"
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden
        >
          <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 3" />
          <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="0.2" strokeDasharray="1 4" opacity="0.5" />
        </svg>
      )}

      {/* Logo with float + shimmer sweep */}
      <div
        className="relative motion-safe:animate-logo-float overflow-hidden"
        style={{ height: size, width: size }}
      >
        <img
          src={virtualisOneLogo.url}
          alt="VirtualisOne"
          className="relative z-10 h-full w-full object-contain drop-shadow-[0_0_30px_hsl(var(--primary)/0.45)]"
        />
        {/* Shimmer streak */}
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          <div className="absolute top-0 -left-1/2 h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent motion-safe:animate-shimmer-sweep" />
        </div>
      </div>
    </div>
  );
};
