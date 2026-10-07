import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UserProfile } from '@/types/hrm';
import { hrmService } from '@/services/hrmService';
import { Search, X, User, Check, Building2, IdCard, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface HrmEmployeeSearchInputProps {
  value?: string; // userId or 'all'
  onSelect: (userId: string, user?: UserProfile | null) => void;
  users?: UserProfile[];
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  className?: string;
  disabled?: boolean;
}

export const HrmEmployeeSearchInput: React.FC<HrmEmployeeSearchInputProps> = ({
  value,
  onSelect,
  users: propUsers,
  placeholder = 'Cari nama, NIP, atau divisi karyawan...',
  allowAll = false,
  allLabel = 'Semua Karyawan',
  className,
  disabled = false,
}) => {
  const [internalUsers, setInternalUsers] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (propUsers && propUsers.length > 0) {
      setInternalUsers(propUsers);
    } else {
      setInternalUsers(hrmService.getUsers());
    }
  }, [propUsers]);

  // Find currently selected user object
  const selectedUser = useMemo(() => {
    if (!value || value === 'all') return null;
    return internalUsers.find((u) => u.id === value) || null;
  }, [value, internalUsers]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered users matching query precisely
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return internalUsers;
    }
    return internalUsers.filter((u) => {
      const name = (u.fullName || u.name || '').toLowerCase();
      const nip = (u.nip || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const div = (u.divisionName || u.division || '').toLowerCase();
      return name.includes(q) || nip.includes(q) || email.includes(q) || div.includes(q);
    });
  }, [internalUsers, query]);

  const handleSelect = (userId: string, user?: UserProfile | null) => {
    onSelect(userId, user);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allowAll) {
      onSelect('all', null);
    } else {
      onSelect('', null);
    }
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={
            isOpen
              ? query
              : selectedUser
              ? `${selectedUser.fullName || selectedUser.name} (${selectedUser.nip || 'NIP -'})`
              : value === 'all' && allowAll
              ? allLabel
              : query
          }
          placeholder={placeholder}
          onFocus={() => {
            setIsOpen(true);
            setQuery('');
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          className={cn(
            'h-9 pl-8 pr-16 text-xs rounded-xl transition-all border-border bg-card',
            selectedUser && !isOpen && 'font-medium text-foreground bg-primary/5 border-primary/30',
            value === 'all' && allowAll && !isOpen && 'font-medium text-muted-foreground'
          )}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {((selectedUser && value !== 'all') || query) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Hapus pencarian"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!disabled) setIsOpen(!isOpen);
            }}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Floating Suggestions / Results Popover */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover shadow-xl p-1 animate-in fade-in-50 zoom-in-95">
          {allowAll && (
            <div
              onClick={() => handleSelect('all', null)}
              className={cn(
                'flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors',
                value === 'all' ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted text-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-muted-foreground/10 flex items-center justify-center text-[10px] font-bold">
                  ALL
                </div>
                <span>{allLabel}</span>
              </div>
              {value === 'all' && <Check className="w-3.5 h-3.5" />}
            </div>
          )}

          {filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Tidak ada karyawan ditemukan dengan kata kunci &quot;{query}&quot;
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = value === u.id;
              const displayName = u.fullName || u.name;
              const displayNip = u.nip || '-';
              const displayDiv = u.divisionName || u.division || 'Umum';

              return (
                <div
                  key={u.id}
                  onClick={() => handleSelect(u.id, u)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors mb-0.5',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'hover:bg-muted text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                        isSelected
                          ? 'bg-primary-foreground text-primary'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      {displayName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <span className="truncate font-medium">{displayName}</span>
                      <div className="flex items-center gap-2 text-[10px] opacity-80">
                        <span className="flex items-center gap-0.5">
                          <IdCard className="w-2.5 h-2.5" /> {displayNip}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 truncate">
                          <Building2 className="w-2.5 h-2.5" /> {displayDiv}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 shrink-0 ml-2" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
