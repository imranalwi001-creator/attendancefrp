import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

export const feelings = [
{ emoji: '😊', label: 'Senang', value: 'happy', message: 'Alhamdulillah! Semoga harimu menyenangkan 💛' },
{ emoji: '🤩', label: 'Semangat', value: 'excited', message: 'MasyaAllah! Semangat terus ya! 🔥' },
{ emoji: '😌', label: 'Tenang', value: 'calm', message: 'Subhanallah, ketenangan itu nikmat 🌿' },
{ emoji: '😐', label: 'Biasa', value: 'neutral', message: 'Tetap semangat, setiap amalan punya pahala 🌟' },
{ emoji: '😔', label: 'Sedih', value: 'sad', message: 'Sabar ya, Allah selalu bersama kita 🤲' }];


interface FeelingDrawerProps {
  open: boolean;
  onClose: (mood: string | null) => void;
  completedCount: number;
  totalCount: number;
}

export function FeelingDrawer({ open, onClose, completedCount, totalCount }: FeelingDrawerProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const percentage = totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0;

  const handleDone = () => {
    const mood = selected;
    setSelected(null);
    onClose(mood);
  };

  const handleDismiss = () => {
    setSelected(null);
    onClose(null);
  };

  const selectedFeeling = feelings.find((f) => f.value === selected);

  return (
    <Drawer open={open} onOpenChange={(o) => {if (!o) handleDismiss();}}>
      <DrawerContent>
        <DrawerHeader className="text-center pb-2">
          <div className="text-4xl mb-2">🎉</div>
          <DrawerTitle className="text-lg">Amalan Tersimpan!</DrawerTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {completedCount}/{totalCount} amalan tercatat ({percentage}%)
          </p>
        </DrawerHeader>

        <div className="px-6 py-4 space-y-4">
          <p className="text-center text-sm font-medium text-foreground">
            How are you feeling today ?   
          </p>
          <div className="flex justify-center gap-3">
            {feelings.map((f) =>
            <button
              key={f.value}
              onClick={() => setSelected(f.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
              selected === f.value ?
              'bg-primary/10 ring-2 ring-primary scale-110' :
              'hover:bg-accent/50'}`
              }>

                <span className="text-3xl">{f.emoji}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{f.label}</span>
              </button>
            )}
          </div>

          {selectedFeeling &&
          <p className="text-center text-sm text-primary font-medium animate-in fade-in">
              {selectedFeeling.message}
            </p>
          }
        </div>

        <DrawerFooter className="pt-2">
          <Button onClick={handleDone} className="w-full" disabled={!selected}>
            Simpan Perasaan
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>);

}