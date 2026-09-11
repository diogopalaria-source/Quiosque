import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  isPriority?: boolean; // puts it on top, e.g. "Todos os Insumos" or "Desconsiderar"
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly (string | SelectOption)[] | (string | SelectOption)[];
  placeholder?: string;
  className?: string;
  isAmber?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  className = "",
  isAmber = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to unified SelectOption scheme
  const normalizedOptions = useMemo<SelectOption[]>(() => {
    return options.map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Sort options: priority options stay at the top, others are sorted alphabetically by label
  const sortedOptions = useMemo(() => {
    const priorities = normalizedOptions.filter(o => o.isPriority);
    const nonPriorities = normalizedOptions.filter(o => !o.isPriority);
    const sortedNonPriorities = [...nonPriorities].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return [...priorities, ...sortedNonPriorities];
  }, [normalizedOptions]);

  // Filter options by searchable term
  const filteredOptions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return sortedOptions;
    return sortedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(term)
    );
  }, [sortedOptions, searchTerm]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync input focus with opening state
  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Find label to show in the dropdown trigger
  const selectedDisplay = useMemo(() => {
    const found = normalizedOptions.find(o => o.value === value);
    return found ? found.label : (value || placeholder);
  }, [value, normalizedOptions, placeholder]);

  return (
    <div ref={containerRef} className={cn("relative w-full text-xs select-none", className)}>
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-white border rounded-lg py-1.5 px-2.5 flex items-center justify-between cursor-pointer transition-all outline-none min-h-[32px]",
          isAmber 
            ? "border-amber-300 hover:border-amber-450 text-amber-900 bg-amber-50/10" 
            : "border-slate-200 hover:border-slate-350 text-slate-800",
          isOpen && "ring-1 ring-blue-500 border-blue-500"
        )}
      >
        <span className={cn("truncate font-semibold", !value && "text-slate-400 font-normal")}>
          {selectedDisplay}
        </span>
        <ChevronsUpDown className="w-3.5 h-3.5 text-slate-450 shrink-0 ml-1" />
      </div>

      {/* Floating Options Panel */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col max-h-64">
          {/* Search box inside the panel */}
          <div className="p-2 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digitar para filtrar..."
              className="w-full bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 outline-none p-0 focus:ring-0"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                } else if (e.key === 'Enter' && filteredOptions.length > 0) {
                  onChange(filteredOptions[0].value);
                  setIsOpen(false);
                }
              }}
            />
            {searchTerm && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm("");
                }}
                className="p-0.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* List content */}
          <div className="overflow-y-auto flex-1 max-h-48 py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between px-3 py-1.5 cursor-pointer text-xs transition-colors",
                      isSelected 
                        ? "bg-slate-100 font-bold text-slate-900" 
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-3 text-center text-slate-400 italic">
                Nenhuma opção encontrada
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
