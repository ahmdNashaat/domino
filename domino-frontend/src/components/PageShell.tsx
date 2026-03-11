import { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type MaxWidth = 'md' | 'lg' | 'xl' | 'full';

interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  maxWidth?: MaxWidth;
}

const maxWidthClass: Record<MaxWidth, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-none',
};

export default function PageShell({ children, className = '', maxWidth = 'lg', ...rest }: PageShellProps) {
  return (
    <div
      className={cn(
        'min-h-[100dvh] w-full mx-auto px-4 sm:px-6',
        maxWidthClass[maxWidth],
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
