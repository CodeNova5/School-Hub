import { cn } from '@/lib/utils';

function Skeleton({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'shimmer' }) {
  return (
    <div
      className={cn(
        'rounded-md bg-muted',
        variant === 'shimmer' ? 'animate-shimmer' : 'animate-pulse',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
