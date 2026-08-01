import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ACUITY_COLOR, type AcuityLevel } from './AcuitySignalBars';

interface AcuityAvatarProps {
  level?: AcuityLevel | null;
  unread?: boolean;
  src?: string | null;
  fallback: string;
  className?: string;
}

/** Avatar with a halo ring colored to the acuity level, shown only while unread. */
export function AcuityAvatar({ level, unread = true, src, fallback, className }: AcuityAvatarProps) {
  const showHalo = !!level && unread;
  const color = level ? ACUITY_COLOR[level] : undefined;

  return (
    <span
      className="inline-flex rounded-full p-[2px] transition-shadow"
      style={
        showHalo
          ? { boxShadow: `0 0 0 2px ${color}, 0 0 10px -1px ${color}80` }
          : undefined
      }
      aria-label={level ? `${level} acuity` : undefined}
    >
      <Avatar className={cn('h-8 w-8', className)}>
        {src && <AvatarImage src={src} alt="" />}
        <AvatarFallback className="text-[11px] font-semibold">{fallback}</AvatarFallback>
      </Avatar>
    </span>
  );
}
