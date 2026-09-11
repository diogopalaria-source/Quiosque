import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ 
  options, 
  selected, 
  onChange, 
  placeholder = "Selecionar..." 
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="relative w-64" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 bg-white border rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm cursor-pointer",
          isOpen ? "border-blue-500 ring-2 ring-blue-100 text-blue-700 font-bold" : "border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-slate-50"
        )}
      >
        <span className="truncate mr-2">
          {selected.length === 0 
            ? placeholder 
            : selected.length === options.length 
              ? "Todos os períodos" 
              : `${selected.length} selecionado(s)`}
        </span>
        <ChevronDown className={cn("w-4 h-4 transition-transform duration-300 shrink-0", isOpen && "rotate-180 text-blue-600")} />
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl py-3 animate-in fade-in zoom-in duration-200 origin-top">
          <div className="px-3 pb-2 mb-2 border-b border-slate-50 flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Períodos</span>
            <button
              type="button"
              onClick={() => onChange(selected.length === options.length ? [] : [...options])}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-tight"
            >
              {selected.length === options.length ? "Limpar" : "Todos"}
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-slate-200">
            {options.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                Aguardando importação...
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleOption(option)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors mb-1 text-left",
                    selected.includes(option) ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-200 shrink-0",
                    selected.includes(option) ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white"
                  )}>
                    {selected.includes(option) && <Check className="w-3 h-3 text-white stroke-[3px]" />}
                  </div>
                  <span className="truncate">{option}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
