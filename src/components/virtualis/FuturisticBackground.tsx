import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface FuturisticBackgroundProps {
  variant?: 'full' | 'lite' | 'auto';
  className?: string;
}

export const FuturisticBackground = ({ 
  variant = 'auto', 
  className 
}: FuturisticBackgroundProps) => {
  const [isLite, setIsLite] = useState(variant === 'lite');

  useEffect(() => {
    if (variant !== 'auto') {
      setIsLite(variant === 'lite');
      return;
    }

    const checkLiteMode = () => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isMobile = window.innerWidth < 1024;
      setIsLite(prefersReducedMotion || isMobile);
    };

    checkLiteMode();

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = () => checkLiteMode();
    mediaQuery.addEventListener('change', handleMotionChange);

    const handleResize = () => checkLiteMode();
    window.addEventListener('resize', handleResize);

    return () => {
      mediaQuery.removeEventListener('change', handleMotionChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [variant]);

  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {/* Gradient Layer - Always shown */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-info/5" />
      
      {/* Grid Pattern Layer - Always shown */}
      <div className="absolute inset-0 grid-pattern opacity-20" />
      
      {/* Floating Orbs - Full mode only */}
      {!isLite && (
        <>
          <div 
            className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" 
          />
          <div 
            className="absolute bottom-20 right-20 w-96 h-96 bg-info/10 rounded-full blur-3xl animate-float-slow" 
          />
          <div 
            className="absolute top-1/2 left-1/3 w-48 h-48 bg-success/10 rounded-full blur-3xl animate-float" 
            style={{ animationDelay: '2s' }} 
          />
        </>
      )}
    </div>
  );
};
