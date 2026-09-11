import React, { useRef } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface CSVUploadProps {
  title: string;
  description?: string;
  onDataLoaded: (data: any[]) => void;
  onReset?: () => void;
  onRemoveDuplicates?: () => void;
  isLoading?: boolean;
  hasData?: boolean;
  accept?: string;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ 
  title, 
  description = "", 
  onDataLoaded, 
  onReset,
  onRemoveDuplicates,
  isLoading,
  hasData,
  accept = ".csv"
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const useTextReader = file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain';

    if (useTextReader) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => ({ raw: line }));
          
          if (lines.length > 0) {
            onDataLoaded(lines);
            alert(`Sucesso! ${lines.length} linhas lidas do arquivo "${file.name}".`);
          } else {
            alert('Aviso: O arquivo selecionado parece estar vazio.');
          }
        } catch (err) {
          console.error('Erro ao processar TXT:', err);
          alert('Erro ao processar o arquivo de texto.');
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            onDataLoaded(results.data);
            alert(`Sucesso! ${results.data.length} registros importados do arquivo "${file.name}".`);
          } else {
            alert('Aviso: Nenhum dado válido encontrado no arquivo CSV.');
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
        error: (error) => {
          console.error('Erro ao ler CSV:', error);
          alert('Erro ao processar o arquivo CSV.');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      });
    }
  };

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className={cn(
        "relative p-6 border-2 border-dashed rounded-2xl transition-all duration-300",
        hasData ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50/50"
      )}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept && accept !== '*' ? accept : undefined}
        className="hidden"
      />
      
      <div className="flex items-start gap-4">
        <div className={cn(
          "p-3 rounded-xl",
          hasData ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"
        )}>
          {hasData ? <CheckCircle2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
          
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                hasData 
                  ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                  : "bg-slate-900 text-white hover:bg-slate-800",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              <Upload className="w-4 h-4" />
              {hasData ? 'Substituir' : 'Importar'}
            </button>

            {hasData && onRemoveDuplicates && (
              <button
                onClick={onRemoveDuplicates}
                disabled={isLoading}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-100 transition-all",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
                title="Sincronizar e reprocessar todos os registros da lista removendo duplicatas"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isLoading ? 'Sincronizando...' : 'Sincronizar / Deduplicar'}
              </button>
            )}

            {hasData && onReset && (
              <div className="flex items-center gap-2">
                {showResetConfirm ? (
                  <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                    <button
                      onClick={() => {
                        onReset();
                        setShowResetConfirm(false);
                      }}
                      disabled={isLoading}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all border border-rose-600"
                    >
                      {isLoading ? 'Limpando...' : 'Confirmar Limpeza'}
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      disabled={isLoading}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all border border-slate-200"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    disabled={isLoading}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all",
                      isLoading && "opacity-50 cursor-not-allowed"
                    )}
                    title="Limpar todos os dados desta categoria"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Resetar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
