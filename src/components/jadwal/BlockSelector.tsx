import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LearningBlock } from '@/hooks/useLearningBlocks';
import { cn } from '@/lib/utils';
import { Layers } from 'lucide-react';

interface BlockSelectorProps {
  blocks: LearningBlock[];
  selectedBlockId: string | null;
  onBlockChange: (blockId: string | null) => void;
  activeBlockId: string | null;
  formatBlockLabel: (block: LearningBlock) => string;
  isBlockActive: (block: LearningBlock) => boolean;
  showAllOption?: boolean;
  className?: string;
  variant?: 'dropdown' | 'tabs';
}

export function BlockSelector({
  blocks,
  selectedBlockId,
  onBlockChange,
  activeBlockId,
  formatBlockLabel,
  isBlockActive,
  showAllOption = false,
  className = '',
  variant = 'tabs'
}: BlockSelectorProps) {
  if (blocks.length === 0) return null;

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <Select 
        value={selectedBlockId || (showAllOption ? 'all' : '')} 
        onValueChange={(value) => onBlockChange(value === 'all' ? null : value)}
      >
        <SelectTrigger className={cn('w-full sm:w-auto sm:min-w-[240px] rounded-xl', className)}>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Pilih Blok Pembelajaran" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="all">
              <span>Semua Blok</span>
            </SelectItem>
          )}
          {blocks.map((block) => (
            <SelectItem key={block.id} value={block.id}>
              <div className="flex items-center gap-2">
                <span>{formatBlockLabel(block)}</span>
                {isBlockActive(block) && (
                  <Badge variant="default" className="bg-green-500 text-white text-xs py-0 px-1.5">
                    Aktif
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Tabs variant
  return (
    <Tabs 
      value={selectedBlockId || (showAllOption ? 'all' : '')} 
      onValueChange={(value) => onBlockChange(value === 'all' ? null : value)}
      className={cn('w-full', className)}
    >
      <TabsList variant="digiss" className="w-full">
        {showAllOption && (
          <TabsTrigger value="all" variant="digiss" className="flex-1">
            Semua Blok
          </TabsTrigger>
        )}
        {blocks.map((block) => (
          <TabsTrigger 
            key={block.id} 
            value={block.id}
            variant="digiss"
            className={cn(
              "gap-2 flex-1",
              isBlockActive(block) && "ring-2 ring-green-500/50"
            )}
          >
            <span>{formatBlockLabel(block)}</span>
            {isBlockActive(block) && (
              <Badge className="bg-green-500 text-white text-[10px] py-0 px-1.5 border-0">
                Aktif
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
