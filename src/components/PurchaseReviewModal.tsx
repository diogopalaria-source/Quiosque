import React, { useState, useEffect } from 'react';
import { X, Check, HelpCircle, RefreshCw, AlertTriangle, Play, Trash2, ArrowUpRight } from 'lucide-react';
import { MACRO_INGREDIENTS, Purchase } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { SearchableSelect } from './SearchableSelect';

interface PurchaseReviewModalProps {
  isOpen: boolean;
  items: Purchase[];
  onConfirm: (finalItems: Purchase[]) => void;
  onCancel: () => void;
}

export const PurchaseReviewModal: React.FC<PurchaseReviewModalProps> = ({
  isOpen,
  items,
  onConfirm,
  onCancel,
}) => {
  const [reviewList, setReviewList] = useState<Purchase[]>([]);

  // Simple heuristic helper to match a product name to macroingredient
  const guessMacroIngredient = (productName: string): string => {
    const normalized = (productName || '').toLowerCase().trim();

    // Direct match check
    for (const macro of MACRO_INGREDIENTS) {
      if (normalized === macro.toLowerCase()) return macro;
    }

    // Heuristics
    if (normalized.includes('torta bottega') || normalized.includes('bottega')) return 'Tortas Bottega';
    if (normalized.includes('croissant')) return 'Croissant';
    if (normalized.includes('cookie')) return 'Cookie';
    if (normalized.includes('pão') || normalized.includes('pao')) {
      if (normalized.includes('queijo gouda')) return 'Pão de queijo Gouda';
      if (normalized.includes('queijo batata') || normalized.includes('batata doce') || normalized.includes('batata')) return 'Pão de queijo Batata Doce';
      if (normalized.includes('waffle')) return 'Pão de queijo para Waffle';
      return 'Pão';
    }
    if (normalized.includes('esfiha') || normalized.includes('esfirra')) {
      if (normalized.includes('carne')) return 'Esfiha Carne';
      if (normalized.includes('queijo')) return 'Esfiha Queijo';
    }
    if (normalized.includes('coxinha')) {
      if (normalized.includes('jaca')) return 'Coxinha Jaca';
      if (normalized.includes('frango')) return 'Coxinha Frango';
    }
    if (normalized.includes('pastel')) return 'Pastel Assado';
    if (normalized.includes('refrigerante 350') || normalized.includes('refri 350') || normalized.includes('lata')) return 'Refrigerante 350ml';
    if (normalized.includes('refrigerante 220') || normalized.includes('refri 220')) return 'Refrigerante 220ml';
    if (normalized.includes('agua com gas') || normalized.includes('água com gás')) return 'Agua com gas';
    if (normalized.includes('agua sem gas') || normalized.includes('água sem gás')) return 'Agua sem gas';
    if (normalized.includes('café em grão') || normalized.includes('café em grao') || normalized.includes('grao')) return 'Café em grão';
    if (normalized.includes('café moido') || normalized.includes('classico')) return 'Café moido Classico';
    if (normalized.includes('descafeinado')) return 'Café descafeinado';
    if (normalized.includes('suco')) return 'Suco Lata';
    if (normalized.includes('fruta') || normalized.includes('congelada')) return 'Frutas Congeladas';
    if (normalized.includes('quiche')) return 'Quiche';
    if (normalized.includes('yuba')) return 'Yuba';
    if (normalized.includes('carne')) return 'Carne suculenta';
    if (normalized.includes('cinnamon')) return 'Cinnamon Roll';
    if (normalized.includes('brownie')) return 'Brownie';
    if (normalized.includes('bolo')) return 'Bolo Caseiro';
    if (normalized.includes('chá')) return 'chá twinnigs';
    if (normalized.includes('sopa de batata') || normalized.includes('batata com bacon') || (normalized.includes('sopa') && normalized.includes('bacon'))) return 'Sopa de Batata com Bacon';
    if (normalized.includes('mandioquinha') || (normalized.includes('caldo') && normalized.includes('mandioquinha'))) return 'Caldo de Mandioquinha';
    if (normalized.includes('caldo verde') || (normalized.includes('caldo') && normalized.includes('verde'))) return 'Caldo verde';

    // Default macro-ingredient fallback
    return 'Outros unidade';
  };

  // Convert raw product names on import to correspond directly or pre-select mapped categories
  useEffect(() => {
    if (isOpen && items && items.length > 0) {
      const initialized = items.map((item) => {
        // Guess macro-ingredient
        const guessed = guessMacroIngredient(item.produto);
        return {
          ...item,
          // Let's store the original product in a custom field or keep it as product but default to guessed macroIngredient
          produto: guessed,
          _originalProduto: item.produto, // store reference
        } as any;
      });
      setReviewList(initialized);
    } else {
      setReviewList([]);
    }
  }, [isOpen, items]);

  if (!isOpen) return null;

  const handleUpdateItem = (index: number, fields: Partial<Purchase>) => {
    setReviewList(prev => {
      const copy = [...prev];
      const updatedItem = { ...copy[index], ...fields };
      // Re-calculate unit cost if total or quantity changes
      if (fields.total !== undefined || fields.quantidade !== undefined) {
        const qty = updatedItem.quantidade;
        const tot = updatedItem.total;
        updatedItem.custoUnitario = qty > 0 ? Number((tot / qty).toFixed(4)) : 0;
      }
      copy[index] = updatedItem;
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setReviewList(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleConfirm = () => {
    // Validate each item
    const validated = reviewList.map(item => {
      // Clean structure to match DB schema
      const { _originalProduto, ...rest } = item as any;
      return {
        ...rest,
        // Make sure it contains required fields
        fornecedor: rest.fornecedor || 'Sem Fornecedor',
        produto: rest.produto || 'Outros unidade',
        quantidade: Number(rest.quantidade) || 0,
        custoUnitario: Number(rest.custoUnitario) || 0,
        total: Number(rest.total) || 0,
      } as Purchase;
    }).filter(p => p.quantidade > 0 && p.total > 0 && p.produto);

    if (validated.length === 0) {
      alert("Aviso: Nenhuma compra válida para registrar!");
      return;
    }

    onConfirm(validated);
  };

  const totalSum = reviewList.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
  const totalQty = reviewList.reduce((acc, curr) => acc + (Number(curr.quantidade) || 0), 0);
  const uniqueSuppliers = Array.from(new Set(reviewList.map(item => item.fornecedor || 'Sem Fornecedor')));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-250">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-2xl shadow-xl border border-slate-150 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md tracking-wider">
              Conferência e Direcionamento de Estoque
            </span>
            <h3 className="text-xl font-bold text-slate-900 mt-1">Conferência de Compras Importadas (CSV)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Revise as informações do seu fornecedor e direcione cada produto para o macro-ingrediente adequado no controle de estoque.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-slate-150 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo Rápido */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Registros Lidos</span>
            <span className="text-lg font-black text-slate-800">{reviewList.length} linhas</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Valor Total do CSV</span>
            <span className="text-lg font-black text-emerald-600">
              R$ {totalSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Quantidade Total</span>
            <span className="text-lg font-black text-slate-800">{totalQty.toLocaleString('pt-BR')} itens</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Fornecedores Diferentes</span>
            <span className="text-sm font-extrabold text-blue-600 truncate block mt-1">
              {uniqueSuppliers.join(', ')}
            </span>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-black tracking-wider">
                <th className="pb-3 pl-2 w-28">Data</th>
                <th className="pb-3 w-40">Fornecedor</th>
                <th className="pb-3 w-56">Item Original CSV</th>
                <th className="pb-3 w-64">Direcionar p/ Macroingrediente</th>
                <th className="pb-3 w-24 text-right">Qtd</th>
                <th className="pb-3 w-32 text-right">Valor Total (R$)</th>
                <th className="pb-3 w-32 text-right">Unitário Calculado</th>
                <th className="pb-3 pr-2 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {reviewList.map((item, idx) => {
                const isOutros = item.produto === 'Outros unidade';
                const originalName = (item as any)._originalProduto || item.produto;

                return (
                  <tr key={idx} className={cn(
                    "hover:bg-slate-50/70 transition-colors",
                    isOutros ? "bg-amber-50/20" : ""
                  )}>
                    {/* Data */}
                    <td className="py-2.5 pl-2">
                      <input
                        type="text"
                        value={item.data}
                        onChange={(e) => handleUpdateItem(idx, { data: e.target.value })}
                        className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg py-1 px-2 text-xs font-mono font-medium text-slate-800 outline-none transition-all"
                        placeholder="DD/MM/AAAA"
                      />
                    </td>

                    {/* Fornecedor */}
                    <td className="py-2.5 pr-2">
                      <input
                        type="text"
                        value={item.fornecedor}
                        onChange={(e) => handleUpdateItem(idx, { fornecedor: e.target.value })}
                        className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg py-1 px-2 text-xs font-semibold text-slate-800 outline-none transition-all"
                      />
                    </td>

                    {/* Item Original CSV */}
                    <td className="py-2.5 pr-2 text-slate-500 font-medium truncate max-w-xs" title={originalName}>
                      {originalName}
                    </td>

                    {/* Direcionar p/ Macroingrediente */}
                    <td className="py-2.5 pr-2">
                      <SearchableSelect
                        value={item.produto}
                        onChange={(val) => handleUpdateItem(idx, { produto: val })}
                        options={MACRO_INGREDIENTS}
                        isAmber={isOutros}
                      />
                    </td>

                    {/* Quantidade */}
                    <td className="py-2.5 pr-2 text-right">
                      <input
                        type="number"
                        step="any"
                        value={item.quantidade}
                        onChange={(e) => handleUpdateItem(idx, { quantidade: parseFloat(e.target.value) || 0 })}
                        className="w-20 bg-white border border-slate-200 hover:border-slate-350 focus:border-blue-500 text-right focus:ring-1 focus:ring-blue-500 rounded-lg py-1 px-2 text-xs font-bold text-slate-800 outline-none transition-all"
                      />
                    </td>

                    {/* Valor Total */}
                    <td className="py-2.5 pr-2 text-right">
                      <input
                        type="number"
                        step="any"
                        value={item.total}
                        onChange={(e) => handleUpdateItem(idx, { total: parseFloat(e.target.value) || 0 })}
                        className="w-24 bg-white border border-slate-200 hover:border-slate-350 focus:border-blue-500 text-right focus:ring-1 focus:ring-blue-500 rounded-lg py-1 px-2 text-xs font-bold text-slate-800 outline-none transition-all"
                      />
                    </td>

                    {/* Unitário Calculado */}
                    <td className="py-2.5 text-right font-mono font-semibold text-slate-500">
                      R$ {item.custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>

                    {/* Ação: Remover */}
                    <td className="py-2.5 pr-2 text-center">
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-all"
                        title="Descartar esta linha"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {reviewList.length === 0 && (
            <div className="text-center py-12 text-slate-450 flex flex-col items-center gap-3">
              <AlertTriangle className="w-12 h-12 text-amber-500/70" />
              <div>
                <h4 className="font-bold text-slate-900">Nenhum registro selecionado</h4>
                <p className="text-xs text-slate-500 mt-1">Carregue um arquivo CSV válido para conferir os dados.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400">Legenda:</span>
            <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-150">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
              <span className="text-[9px] text-amber-600 font-extrabold">Verifique os itens marcados como 'Outros unidade'</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
            >
              Descartar e Fechar
            </button>
            <button
              onClick={handleConfirm}
              disabled={reviewList.length === 0}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition-all",
                reviewList.length > 0 
                  ? "bg-slate-900 hover:bg-slate-800 active:scale-[0.98]" 
                  : "bg-slate-300 cursor-not-allowed opacity-50"
              )}
            >
              <Check className="w-4 h-4" />
              Confirmar e Gravar no Banco de Dados
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
