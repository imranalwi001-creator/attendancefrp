import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PembinaOption {
  id: string;
  name: string;
  role?: string;
}

interface PembinaSelectorProps {
  pembinaList: PembinaOption[];
  selectedPembinaId: string;
  onPembinaIdChange: (id: string) => void;
  isAlAkhor: boolean;
  onAlAkhorChange: (val: boolean) => void;
  pembinaExternal: string;
  onPembinaExternalChange: (val: string) => void;
}

export function PembinaSelector({
  pembinaList,
  selectedPembinaId,
  onPembinaIdChange,
  isAlAkhor,
  onAlAkhorChange,
  pembinaExternal,
  onPembinaExternalChange,
}: PembinaSelectorProps) {
  return (
    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
      <Label className="text-sm font-semibold text-foreground">Pembina / Penguji</Label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onAlAkhorChange(false)}
          className={cn(
            "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border",
            !isAlAkhor
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:border-primary/50"
          )}
        >
          Pembina
        </button>
        <button
          type="button"
          onClick={() => onAlAkhorChange(true)}
          className={cn(
            "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border",
            isAlAkhor
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:border-primary/50"
          )}
        >
          Al-Akhor (Pembina Eksternal)
        </button>
      </div>

      {isAlAkhor ? (
        <Input
          value={pembinaExternal}
          onChange={(e) => onPembinaExternalChange(e.target.value)}
          placeholder="Nama pembina eksternal..."
        />
      ) : (
        <Select value={selectedPembinaId} onValueChange={onPembinaIdChange}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih pembina..." />
          </SelectTrigger>
          <SelectContent>
            {pembinaList.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
