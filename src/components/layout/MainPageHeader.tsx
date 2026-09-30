import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MainPageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  actions?: ReactNode;
  /** Optional integrated row (e.g. Tabs) rendered below the title row */
  bottomSlot?: ReactNode;
  className?: string;
}

/**
 * MainPageHeader — pola header utama (detail page) dari Design System.
 * Background primary, back button glassmorphism, judul + subtitle,
 * area aksi di kanan, dan slot bawah opsional untuk tabs terintegrasi.
 */
export function MainPageHeader({
  title,
  subtitle,
  backTo,
  onBack,
  actions,
  bottomSlot,
  className,
}: MainPageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) return onBack();
    if (backTo) navigate(backTo);
  };

  const showBack = Boolean(backTo || onBack);

  return (
    <div
      className={cn(
        'rounded-2xl bg-primary p-4 md:p-6 shadow-lg space-y-4 no-print',
        className
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          {showBack && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleBack}
              className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4 text-white" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-primary-foreground truncate">
              {title}
            </h1>
            {subtitle && (
              <div className="text-sm text-primary-foreground/70 truncate flex items-center gap-1.5">
                {subtitle}
              </div>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
        {bottomSlot}
      </div>
    </div>
  );
}

export default MainPageHeader;
