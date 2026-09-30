import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown' | 'sidebar';
  className?: string;
  isCompact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'icon',
  className,
  isCompact = false,
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          'w-9 h-9 rounded-xl bg-muted/40 animate-pulse',
          isCompact && 'w-9 h-9',
          className
        )}
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  // Simple direct toggle (Light <-> Dark)
  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  if (variant === 'sidebar') {
    if (isCompact) {
      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          className={cn(
            'w-full h-10 rounded-xl hover:bg-muted text-foreground transition-all duration-300',
            className
          )}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 scale-100" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700 transition-transform rotate-0 scale-100" />
          )}
          <span className="sr-only">Toggle Theme</span>
        </Button>
      );
    }

    return (
      <Button
        variant="ghost"
        onClick={toggleTheme}
        className={cn(
          'w-full justify-between h-10 px-3 rounded-xl hover:bg-muted text-foreground font-medium text-xs transition-all duration-300',
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          )}
          <span>Tema Tampilan</span>
        </div>
        <span className="text-[11px] text-muted-foreground capitalize font-semibold px-2 py-0.5 rounded-md bg-muted/80 border border-border/40">
          {theme === 'system' ? 'Sistem' : isDark ? 'Gelap' : 'Terang'}
        </span>
      </Button>
    );
  }

  if (variant === 'dropdown') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-9 w-9 rounded-xl border border-border/50 bg-background/50 hover:bg-muted transition-all duration-300',
              className
            )}
            title="Pilih Tema (Terang / Gelap / Sistem)"
          >
            {isDark ? (
              <Moon className="w-4 h-4 text-primary" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            <span className="sr-only">Pilih Tema</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl border border-border shadow-xl">
          <DropdownMenuItem
            onClick={() => setTheme('light')}
            className={cn(
              'flex items-center gap-2 text-xs cursor-pointer rounded-lg',
              theme === 'light' && 'bg-primary/10 text-primary font-semibold'
            )}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Mode Terang (Light)</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme('dark')}
            className={cn(
              'flex items-center gap-2 text-xs cursor-pointer rounded-lg',
              theme === 'dark' && 'bg-primary/10 text-primary font-semibold'
            )}
          >
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>Mode Gelap (Dark)</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme('system')}
            className={cn(
              'flex items-center gap-2 text-xs cursor-pointer rounded-lg',
              theme === 'system' && 'bg-primary/10 text-primary font-semibold'
            )}
          >
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <span>Ikuti Sistem (Auto)</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Default Icon Button
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        'h-9 w-9 rounded-xl border border-border/60 bg-card hover:bg-muted text-foreground transition-all duration-300 shadow-xs active:scale-95',
        className
      )}
      title={isDark ? 'Beralih ke Mode Terang (Light Mode)' : 'Beralih ke Mode Gelap (Dark Mode)'}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 hover:rotate-45 duration-300" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300 transition-transform rotate-0 hover:-rotate-12 duration-300" />
      )}
      <span className="sr-only">Toggle Theme</span>
    </Button>
  );
};
