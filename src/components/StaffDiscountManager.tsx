import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Save, 
  RefreshCw, 
  Trash2,
  Percent,
  Check,
  AlertCircle
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { FIXED_STAFF_PRODUCTS, StaffProduct } from './WasteRegistration';
import { StaffDiscountOverride } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { logAction } from '../lib/logs';

interface StaffDiscountManagerProps {
  dataPath: string;
  overrides: StaffDiscountOverride[];
  onBack?: () => void;
}

export const StaffDiscountManager: React.FC<StaffDiscountManagerProps> = ({
  dataPath,
  overrides,
  onBack
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPercents, setEditingPercents] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Map overrides by product ID for quick access
  const overridesMap = useMemo(() => {
    const map: Record<string, StaffDiscountOverride> = {};
    overrides.forEach(o => {
      if (o.productId) {
        map[o.productId] = o;
      }
    });
    return map;
  }, [overrides]);

  // Compute final lists with both original and override
  const productsWithDiscounts = useMemo(() => {
    return FIXED_STAFF_PRODUCTS.map(p => {
      const override = overridesMap[p.id];
      const actualDiscount = override ? override.descontoPercent : p.descontoPercent;
      const isOverridden = !!override;
      return {
        ...p,
        actualDiscount,
        isOverridden,
        originalDiscount: p.descontoPercent,
      };
    });
  }, [overridesMap]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return productsWithDiscounts;
    return productsWithDiscounts.filter(p => 
      p.nome.toLowerCase().includes(term) || p.id === term
    );
  }, [productsWithDiscounts, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const total = productsWithDiscounts.length;
    const customized = productsWithDiscounts.filter(p => p.isOverridden).length;
    const average = productsWithDiscounts.length > 0 
      ? Math.round(productsWithDiscounts.reduce((sum, p) => sum + p.actualDiscount, 0) / total)
      : 0;

    return { total, customized, average };
  }, [productsWithDiscounts]);

  // Save manual override helper
  const handleSaveOverride = async (product: StaffProduct, customPercentStr: string) => {
    const cleanPercent = customPercentStr.trim();
    if (cleanPercent === '') return;

    const percentVal = parseInt(cleanPercent, 10);
    if (isNaN(percentVal) || percentVal < 0 || percentVal > 100) {
      alert('Por favor, digite um percentual válido de 0 a 100.');
      return;
    }

    setSavingId(product.id);
    setErrorMsg(null);

    try {
      const docRef = doc(db, `${dataPath}/staffDiscountOverrides`, product.id);
      await setDoc(docRef, {
        productId: product.id,
        productName: product.nome,
        descontoPercent: percentVal,
        updatedAt: new Date().toISOString()
      });

      // Log this admin operation
      await logAction('Edição', 'Ajuste Desconto', `Alterado desconto do produto "${product.nome}" para ${percentVal}% (Padrão: ${product.descontoPercent}%)`, 'staffDiscountOverrides', product.id, { percentVal });

      // Clear edit state for this row
      const updatedEditing = { ...editingPercents };
      delete updatedEditing[product.id];
      setEditingPercents(updatedEditing);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Falha ao salvar desconto customizado: ${err.message || err}`);
    } finally {
      setSavingId(null);
    }
  };

  // Reset override helper (revert to master rule)
  const handleResetOverride = async (product: StaffProduct) => {
    setSavingId(product.id);
    setErrorMsg(null);

    try {
      const docRef = doc(db, `${dataPath}/staffDiscountOverrides`, product.id);
      await deleteDoc(docRef);

      // Log Reversion
      await logAction('Exclusão', 'Ajuste Desconto', `Restaurado desconto padrão do produto "${product.nome}" para ${product.descontoPercent}%`, 'staffDiscountOverrides', product.id, {});

      // Clear editing input
      const updatedEditing = { ...editingPercents };
      delete updatedEditing[product.id];
      setEditingPercents(updatedEditing);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Falha ao restaurar desconto original: ${err.message || err}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8" id="discount-manager-root">
      
      {/* Banner / Header info */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-[2.5rem] p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12 select-none">
          <Percent className="w-96 h-96" />
        </div>
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/30 border border-emerald-400/20 rounded-full text-emerald-100 text-[10px] font-black uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-ping"></span>
            Acesso Reservado - Administrador
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">
            Gerenciamento de Descontos da Equipe
          </h1>
          <p className="text-emerald-100/90 text-sm leading-relaxed font-medium">
            Por padrão, todos os produtos possuem um percentual master de desconto de funcionário (ex: 50% para Mr. Cheney). 
            Neste painel administrativo privado, você pode customizar e sobrescrever especificamente o desconto de qualquer produto.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-slate-50 text-slate-500 rounded-2xl">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Produtos</p>
            <p className="text-2xl font-black text-slate-850 mt-1">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Descontos Ajustados</p>
            <p className="text-2xl font-black text-slate-850 mt-1">{stats.customized} <span className="text-xs text-slate-400 font-bold uppercase">sobrescritos</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Desconto Médio Geral</p>
            <p className="text-2xl font-black text-slate-850 mt-1">{stats.average}%</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200/55 p-4 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 opacity-90 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Products list card */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-md p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-850 uppercase tracking-tight">Produtos e Percentuais</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
              Altere o valor para sobrescrever ou exclua para voltar ao padrão master
            </p>
          </div>

          {/* Search box */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Pesquisar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Desktop and Mobile optimized list */}
        <div className="overflow-x-auto rounded-[1.8rem] border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Produto</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Preço Cheio</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Desconto Padrão (Master)</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center w-48">Desconto Customizado</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-wider">
                    Nenhum produto cadastrado ou correspondente à busca.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isDirty = editingPercents[p.id] !== undefined;
                  const currentInputValue = isDirty ? editingPercents[p.id] : String(p.actualDiscount);

                  return (
                    <tr 
                      key={p.id} 
                      className={cn(
                        "hover:bg-slate-50/60 transition-colors",
                        p.isOverridden && "bg-emerald-50/10"
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 text-sm">{p.nome}</div>
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">ID: {p.id}</div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-600 text-center">
                        {formatCurrency(p.precoCheio)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-black">
                          {p.originalDiscount}%
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            disabled={savingId === p.id}
                            placeholder={String(p.originalDiscount)}
                            value={currentInputValue}
                            onChange={(e) => setEditingPercents({
                              ...editingPercents,
                              [p.id]: e.target.value
                            })}
                            className={cn(
                              "w-16 px-2 py-1.5 text-center font-bold bg-slate-5 rounded-lg border focus:outline-none transition-all",
                              p.isOverridden 
                                ? "border-emerald-300 text-emerald-700 bg-emerald-50/30 font-black" 
                                : "border-slate-200 text-slate-700 focus:ring-1 focus:ring-emerald-500",
                              isDirty && "border-blue-400 ring-1 ring-blue-100"
                            )}
                          />
                          <span className={cn(
                            "text-xs font-bold",
                            p.isOverridden ? "text-emerald-600" : "text-slate-400"
                          )}>%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Revert custom override button */}
                          {p.isOverridden && (
                            <button
                              onClick={() => handleResetOverride(p)}
                              disabled={savingId === p.id}
                              title="Remover desconto modificado e voltar à regra padrão"
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Save discount button */}
                          <button
                            onClick={() => handleSaveOverride(p, currentInputValue)}
                            disabled={savingId === p.id || (!isDirty && p.actualDiscount === parseInt(currentInputValue, 10))}
                            className={cn(
                              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-40",
                              isDirty 
                                ? "bg-blue-600 text-white shadow-sm shadow-blue-100 hover:bg-blue-700" 
                                : p.isOverridden
                                  ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  : "bg-emerald-50/50 text-emerald-600 hover:bg-emerald-50 border border-emerald-100/40"
                            )}
                          >
                            {savingId === p.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            {isDirty ? 'Salvar' : 'Gravar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
