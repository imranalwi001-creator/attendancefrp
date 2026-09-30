import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  backTo?: string;
}

export function PageHeader({ title, subtitle, children, backTo }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div 
      id="head_digiss" 
      className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-3 sm:p-6"
    >
      
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {backTo && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(backTo)}
              className="shrink-0 h-8 w-8 sm:h-10 sm:w-10 bg-background/50 hover:bg-background/80 backdrop-blur-sm border border-border/50"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {children && (
          <div className="flex items-center gap-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
