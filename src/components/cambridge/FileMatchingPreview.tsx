import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Check, AlertTriangle, X, FileText, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SantriData {
  id: string;
  name: string;
  nis: string | null;
  document?: {
    id: string;
    document_url: string | null;
    document_name: string | null;
    uploaded_at: string | null;
  };
}

export interface FileMatch {
  file: File;
  matchedSantri: SantriData | null;
  matchType: 'nis' | 'name' | 'unmatched';
  confidence: 'high' | 'low' | 'none';
}

interface FileMatchingPreviewProps {
  matches: FileMatch[];
  santriList: SantriData[];
  onConfirm: (confirmedMatches: FileMatch[]) => void;
  onCancel: () => void;
  open: boolean;
  isUploading: boolean;
}

// Smart matching function
export function matchFileToSantri(fileName: string, santriList: SantriData[]): Omit<FileMatch, 'file'> {
  const cleanName = fileName.toLowerCase().replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

  // 1. Try match with NIS (high priority)
  for (const santri of santriList) {
    if (santri.nis && cleanName.includes(santri.nis.toLowerCase())) {
      return { matchedSantri: santri, matchType: 'nis', confidence: 'high' };
    }
  }

  // 2. Try match with name (medium priority)
  for (const santri of santriList) {
    const nameParts = santri.name.toLowerCase().split(' ').filter(p => p.length > 2);
    const matchCount = nameParts.filter(part => cleanName.includes(part)).length;
    
    // Match if filename contains at least 2 name parts, or all parts if only 1-2 parts
    if (matchCount >= 2 || (nameParts.length <= 2 && matchCount === nameParts.length)) {
      return { 
        matchedSantri: santri, 
        matchType: 'name', 
        confidence: matchCount >= 2 ? 'high' : 'low' 
      };
    }
  }

  // 3. Try partial name match (low confidence)
  for (const santri of santriList) {
    const nameParts = santri.name.toLowerCase().split(' ').filter(p => p.length > 2);
    const matchCount = nameParts.filter(part => cleanName.includes(part)).length;
    
    if (matchCount >= 1) {
      return { matchedSantri: santri, matchType: 'name', confidence: 'low' };
    }
  }

  return { matchedSantri: null, matchType: 'unmatched', confidence: 'none' };
}

export function FileMatchingPreview({
  matches: initialMatches,
  santriList,
  onConfirm,
  onCancel,
  open,
  isUploading
}: FileMatchingPreviewProps) {
  const [matches, setMatches] = useState<FileMatch[]>(initialMatches);

  // Update matches when initialMatches changes
  useMemo(() => {
    setMatches(initialMatches);
  }, [initialMatches]);

  const handleSantriChange = (fileIndex: number, santriId: string) => {
    setMatches(prev => prev.map((match, i) => {
      if (i !== fileIndex) return match;
      
      const selectedSantri = santriList.find(s => s.id === santriId) || null;
      return {
        ...match,
        matchedSantri: selectedSantri,
        matchType: selectedSantri ? 'name' : 'unmatched',
        confidence: selectedSantri ? 'high' : 'none'
      };
    }));
  };

  const validMatches = matches.filter(m => m.matchedSantri !== null);
  const unmatchedCount = matches.filter(m => m.matchedSantri === null).length;

  // Get list of already assigned santri IDs to prevent duplicates
  const assignedSantriIds = new Set(matches.map(m => m.matchedSantri?.id).filter(Boolean));

  const getConfidenceBadge = (match: FileMatch) => {
    if (!match.matchedSantri) {
      return (
        <Badge variant="destructive" className="gap-1">
          <X className="h-3 w-3" />
          Tidak Cocok
        </Badge>
      );
    }

    if (match.confidence === 'high') {
      return (
        <Badge className="gap-1 bg-green-600">
          <Check className="h-3 w-3" />
          {match.matchType === 'nis' ? 'NIS Match' : 'Nama Match'}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
        <AlertTriangle className="h-3 w-3" />
        Kurang Yakin
      </Badge>
    );
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Preview Pencocokan File
          </DrawerTitle>
          <DrawerDescription>
            {matches.length} file terdeteksi • {validMatches.length} cocok • {unmatchedCount} belum cocok
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4 max-h-[50vh]">
          <div className="space-y-3 pb-4">
            {matches.map((match, index) => (
              <div
                key={`${match.file.name}-${index}`}
                className={cn(
                  "flex flex-col gap-3 p-4 rounded-xl border transition-colors",
                  match.matchedSantri 
                    ? match.confidence === 'high' 
                      ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                      : "bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800"
                    : "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                )}
              >
                {/* File Info */}
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{match.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(match.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  {getConfidenceBadge(match)}
                </div>

                {/* Santri Selection */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">→</span>
                  <Select
                    value={match.matchedSantri?.id || 'unassigned'}
                    onValueChange={(value) => handleSantriChange(index, value === 'unassigned' ? '' : value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Pilih santri..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">-- Tidak dipasangkan --</SelectItem>
                      {santriList.map((santri) => (
                        <SelectItem 
                          key={santri.id} 
                          value={santri.id}
                          disabled={assignedSantriIds.has(santri.id) && match.matchedSantri?.id !== santri.id}
                        >
                          {santri.name} {santri.nis ? `(${santri.nis})` : ''}
                          {santri.document?.document_url && ' ✓'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DrawerFooter className="pt-2">
          <div className="flex flex-col gap-2 w-full">
            <Button
              onClick={() => onConfirm(matches.filter(m => m.matchedSantri !== null))}
              disabled={validMatches.length === 0 || isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Mengupload...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {validMatches.length} File
                </>
              )}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" disabled={isUploading}>Batal</Button>
            </DrawerClose>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
