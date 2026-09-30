 import * as React from 'react';
 import { cn } from '@/lib/utils';
 
 interface ExtractionCardHeaderProps {
   icon: React.ReactNode;
   title: string;
   actions?: React.ReactNode;
   className?: string;
 }
 
 export function ExtractionCardHeader({ 
   icon, 
   title, 
   actions,
   className 
 }: ExtractionCardHeaderProps) {
   return (
     <div className={cn("relative overflow-hidden rounded-t-[inherit]", className)}>
       <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
       <div className="relative px-4 py-3 flex items-center justify-between">
         <div className="flex items-center gap-2.5">
           <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
             {icon}
           </div>
           <span className="font-semibold text-foreground">{title}</span>
         </div>
         {actions && (
           <div className="flex items-center gap-2">
             {actions}
           </div>
         )}
       </div>
     </div>
   );
 }