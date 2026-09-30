import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  animationDelay?: number;
  bgOuter?: string;
  bgInner?: string;
}

export function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  animationDelay = 0,
  bgOuter = '#E7F6F8',
  bgInner = '#0DA8B6'
}: StatCardProps) {
  return (
    <Card 
      className="bg-card hover:shadow-lg transition-all duration-300 animate-fade-in border hover-scale" 
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardContent className="p-3 md:p-6">
        <div className="flex items-start gap-2 md:gap-4">
          {/* Circular Icon Badge */}
          <div 
            className="rounded-full p-1.5 md:p-2.5 shrink-0" 
            style={{ backgroundColor: bgOuter }}
          >
            <div 
              className="rounded-full p-1 md:p-1.5" 
              style={{ backgroundColor: bgInner }}
            >
              <Icon 
                className="h-2.5 w-2.5 md:h-4 md:w-4" 
                style={{ color: '#FFFFFF' }} 
                strokeWidth={2} 
              />
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm text-muted-foreground mb-1 md:mb-2 whitespace-nowrap">
              {label}
            </p>
            <div className="flex items-end gap-3">
              <h3 className="text-xl md:text-3xl font-bold text-foreground">
                {value}
              </h3>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
