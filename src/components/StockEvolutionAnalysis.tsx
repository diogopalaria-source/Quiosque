import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  BarChart3, 
  Calendar, 
  Package, 
  Download, 
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  HelpCircle,
  Edit3,
  X,
  Save
} from 'lucide-react';
import { collection, getDocs, query, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getDataPath, cn } from '../lib/utils';
import { safeSetDoc } from '../lib/firestoreUtils';
import { getStockWeekInfo } from './StockCounting';

interface StockEvolutionAnalysisProps {
  dataPath: string;
  onBack: () => void;
}

interface StockHistoryItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  tipoContagem?: string;
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  quantity: number;
  quiosqueQty?: number;
  depositoQty?: number;
  timestamp?: any;
}

export const StockEvolutionAnalysis: React.FC<StockEvolutionAnalysisProps> = ({
  dataPath,
  onBack
}) => {
  const [historyItems, setHistoryItems] = useState<StockHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [refreshing, setRefreshing] = useState(false);

  // Edit / Calibration modal state
  const [editingProduct, setEditingProduct] = useState<{
    productName: string;
    category: string;
    productId: string;
    tipoContagem?: string;
    weeks: Record<string, { quantity: number; quiosqueQty: number; depositoQty: number }>;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSuccessMessage, setEditSuccessMessage] = useState(false);

  // Official catalog items mapping
  const [officialCatalogMap, setOfficialCatalogMap] = useState<Map<string, { id: string; productName: string; category: string; tipoContagem: string }>>(new Map());

  const fetchHistory = async () => {
    setRefreshing(true);
    try {
      // 1. Fetch official stock counting catalog (stockCountConfig)
      const officialCatalogSet = new Set<string>();
      const catalogMap = new Map<string, { id: string; productName: string; category: string; tipoContagem: string }>();
      
      try {
        const configSnap = await getDocs(collection(db, getDataPath('stockCountConfig')));
        configSnap.forEach(docSnap => {
          const d = docSnap.data();
          const prodName = d.produto || d.productName;
          if (prodName) {
            const normalized = prodName.toLowerCase().trim();
            officialCatalogSet.add(normalized);
            catalogMap.set(normalized, {
              id: docSnap.id,
              productName: prodName,
              category: d.categoria || d.categoriaQuiosque || d.categoriaEstoque || 'Geral',
              tipoContagem: d.tipoContagem || 'unidade'
            });
          }
        });
      } catch (e) {
        console.error('Error fetching stockCountConfig:', e);
      }

      setOfficialCatalogMap(catalogMap);

      const loadedMap = new Map<string, StockHistoryItem>();

      // 2. Fetch history from shared and dev paths (QR code counts)
      try {
        const qShared = query(collection(db, 'users/shared_franquia_data/stockCountHistory'));
        const snapShared = await getDocs(qShared);
        if (!snapShared.empty) {
          snapShared.forEach(docSnap => {
            const data = docSnap.data() as StockHistoryItem;
            const prodName = (data.productName || '').toLowerCase().trim();
            if (prodName && (officialCatalogSet.size === 0 || officialCatalogSet.has(prodName))) {
              const catItem = catalogMap.get(prodName);
              loadedMap.set(docSnap.id, { 
                id: docSnap.id, 
                ...data, 
                tipoContagem: data.tipoContagem || catItem?.tipoContagem || 'unidade' 
              });
            }
          });
        }
      } catch (e) {
        console.error('Error fetching shared history:', e);
      }

      try {
        const qDev = query(collection(db, 'users/dev_qa_franquia_data/stockCountHistory'));
        const snapDev = await getDocs(qDev);
        if (!snapDev.empty) {
          snapDev.forEach(docSnap => {
            if (!loadedMap.has(docSnap.id)) {
              const data = docSnap.data() as StockHistoryItem;
              const prodName = (data.productName || '').toLowerCase().trim();
              if (prodName && (officialCatalogSet.size === 0 || officialCatalogSet.has(prodName))) {
                const catItem = catalogMap.get(prodName);
                loadedMap.set(docSnap.id, { 
                  id: docSnap.id, 
                  ...data, 
                  tipoContagem: data.tipoContagem || catItem?.tipoContagem || 'unidade' 
                });
              }
            }
          });
        }
      } catch (e) {
        console.error('Error fetching dev history:', e);
      }

      // 3. For official catalog items without current week history, initialize from stock
      const currentWeekInfo = getStockWeekInfo(new Date());
      try {
        const stockSnap = await getDocs(collection(db, getDataPath('stock')));
        const currentStockMap = new Map<string, { total: number; quiosque: number; deposito: number }>();

        stockSnap.forEach(docSnap => {
          const d = docSnap.data();
          const prodName = (d.produto || d.productName || '').toLowerCase().trim();
          if (prodName && officialCatalogSet.has(prodName)) {
            const qQuiosque = d.estoqueQuiosque ?? d.estoqueQuiosqueAtual ?? 0;
            const qDeposito = d.estoqueDeposito ?? d.estoqueDepositoAtual ?? 0;
            const total = d.estoqueAtual ?? (qQuiosque + qDeposito);
            currentStockMap.set(prodName, { total, quiosque: qQuiosque, deposito: qDeposito });
          }
        });

        for (const [normName, catItem] of catalogMap) {
          const historyDocId = `${catItem.id}_${currentWeekInfo.weekKey}`;
          if (!loadedMap.has(historyDocId)) {
            const stockInfo = currentStockMap.get(normName) || { total: 0, quiosque: 0, deposito: 0 };
            const newItem: StockHistoryItem = {
              id: historyDocId,
              productId: catItem.id,
              productName: catItem.productName,
              category: catItem.category,
              tipoContagem: catItem.tipoContagem,
              weekKey: currentWeekInfo.weekKey,
              weekLabel: currentWeekInfo.weekLabel,
              startDate: currentWeekInfo.startDate,
              endDate: currentWeekInfo.endDate,
              quantity: stockInfo.total,
              quiosqueQty: stockInfo.quiosque,
              depositoQty: stockInfo.deposito,
              timestamp: new Date()
            };
            loadedMap.set(historyDocId, newItem);
          }
        }
      } catch (e) {
        console.error('Error merging current stock into catalog history:', e);
      }

      setHistoryItems(Array.from(loadedMap.values()));
    } catch (err) {
      console.error('Error fetching stock history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [dataPath]);

  // Extract unique categories
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    cats.add('Todas');
    historyItems.forEach(item => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats);
  }, [historyItems]);

  // Extract unique weeks sorted chronologically by weekKey
  const weeksList = useMemo(() => {
    const weekMap = new Map<string, { weekKey: string; weekLabel: string; startDate: string; endDate: string }>();
    historyItems.forEach(item => {
      if (item.weekKey && !weekMap.has(item.weekKey)) {
        weekMap.set(item.weekKey, {
          weekKey: item.weekKey,
          weekLabel: item.weekLabel || item.weekKey,
          startDate: item.startDate || '',
          endDate: item.endDate || ''
        });
      }
    });

    const currentWeekInfo = getStockWeekInfo(new Date());
    if (!weekMap.has(currentWeekInfo.weekKey)) {
      weekMap.set(currentWeekInfo.weekKey, {
        weekKey: currentWeekInfo.weekKey,
        weekLabel: currentWeekInfo.weekLabel,
        startDate: currentWeekInfo.startDate,
        endDate: currentWeekInfo.endDate
      });
    }

    return Array.from(weekMap.values()).sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  }, [historyItems]);

  // Group items by product name
  const productEvolutionMap = useMemo(() => {
    const map = new Map<string, { productName: string; category: string; productId: string; tipoContagem: string; weeks: Record<string, { quantity: number; quiosqueQty?: number; depositoQty?: number }> }>();

    historyItems.forEach(item => {
      const prodName = item.productName || 'Produto Desconhecido';
      const cat = item.category || 'Geral';
      const norm = prodName.toLowerCase().trim();
      const catalogItem = officialCatalogMap.get(norm);
      const tipoContagem = item.tipoContagem || catalogItem?.tipoContagem || 'unidade';

      if (!map.has(prodName)) {
        map.set(prodName, {
          productName: prodName,
          category: cat,
          productId: item.productId || prodName.toLowerCase().replace(/\s+/g, '_'),
          tipoContagem,
          weeks: {}
        });
      }
      const prodEntry = map.get(prodName)!;
      if (item.weekKey) {
        prodEntry.weeks[item.weekKey] = {
          quantity: item.quantity ?? 0,
          quiosqueQty: item.quiosqueQty,
          depositoQty: item.depositoQty
        };
      }
      if (cat && cat !== 'Geral') {
        prodEntry.category = cat;
      }
      if (item.productId && !prodEntry.productId) {
        prodEntry.productId = item.productId;
      }
    });

    return map;
  }, [historyItems, officialCatalogMap]);

  // Filter products by search term and category
  const filteredProducts = useMemo(() => {
    const products = Array.from(productEvolutionMap.values());
    return products.filter(p => {
      const matchSearch = searchTerm.trim() === '' || p.productName.toLowerCase().includes(searchTerm.toLowerCase().trim());
      const matchCat = selectedCategory === 'Todas' || p.category === selectedCategory;
      return matchSearch && matchCat;
    }).sort((a, b) => a.productName.localeCompare(b.productName, 'pt-BR', { sensitivity: 'base' }));
  }, [productEvolutionMap, searchTerm, selectedCategory]);

  const handleOpenEditModal = (product: { productName: string; category: string; productId: string; tipoContagem: string; weeks: Record<string, { quantity: number; quiosqueQty?: number; depositoQty?: number }> }) => {
    const initialWeeksData: Record<string, { quantity: number; quiosqueQty: number; depositoQty: number }> = {};
    weeksList.forEach(w => {
      const existing = product.weeks[w.weekKey];
      initialWeeksData[w.weekKey] = {
        quantity: existing?.quantity ?? 0,
        quiosqueQty: existing?.quiosqueQty ?? 0,
        depositoQty: existing?.depositoQty ?? 0
      };
    });

    setEditingProduct({
      productName: product.productName,
      category: product.category,
      productId: product.productId,
      tipoContagem: product.tipoContagem,
      weeks: initialWeeksData
    });
  };

  const handleSaveEditModal = async () => {
    if (!editingProduct) return;
    setSavingEdit(true);
    try {
      for (const w of weeksList) {
        const weekData = editingProduct.weeks[w.weekKey];
        if (weekData) {
          const historyDocId = `${editingProduct.productId}_${w.weekKey}`;
          await safeSetDoc(doc(db, getDataPath('stockCountHistory'), historyDocId), {
            productId: editingProduct.productId,
            productName: editingProduct.productName,
            category: editingProduct.category,
            tipoContagem: editingProduct.tipoContagem || 'unidade',
            weekKey: w.weekKey,
            weekLabel: w.weekLabel,
            startDate: w.startDate,
            endDate: w.endDate,
            quantity: Number(weekData.quantity) || 0,
            quiosqueQty: Number(weekData.quiosqueQty) || 0,
            depositoQty: Number(weekData.depositoQty) || 0,
            responsavel: 'Calibrado Manualmente',
            timestamp: new Date()
          }, { merge: true });
        }
      }

      setEditSuccessMessage(true);
      await fetchHistory();
      setEditingProduct(null);
      setTimeout(() => setEditSuccessMessage(false), 5000);
    } catch (err) {
      console.error('Error saving stock evolution edit:', err);
      alert('Erro ao salvar as alterações da contagem.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all font-black text-slate-700 text-xs uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-black uppercase tracking-wider">
                Gestão de Informações
              </span>
              <span className="text-slate-400 text-xs font-bold">•</span>
              <span className="text-slate-500 text-xs font-bold uppercase">Ciclo Semanal (Sáb a Sex)</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Evolução da Contagem de Estoque</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchHistory}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-black text-xs uppercase tracking-wider transition-all border border-indigo-200 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            <span>Atualizar Dados</span>
          </button>
        </div>
      </div>

      {editSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-6 py-4 rounded-2xl font-bold text-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Contagens semanais atualizadas e calibradas com sucesso!</span>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar produto pelo nome..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Category Selector */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
          >
            {categoriesList.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Evolução Semanal de Estoque</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              Exibe produtos oficiais com formato adequado para cada modelo de contagem (Unidade, Fechado/Em Uso ou Tem Bastante)
            </p>
          </div>
          <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest">
            {filteredProducts.length} produtos exibidos
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carregando histórico de contagens...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-black text-slate-700 uppercase">Nenhum produto encontrado</p>
            <p className="text-xs font-bold text-slate-400 uppercase">Tente ajustar os filtros de busca ou categoria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6 sticky left-0 bg-slate-50 z-10 min-w-[260px] shadow-xs">Produto</th>
                  <th className="py-4 px-4 min-w-[140px]">Categoria</th>
                  {weeksList.map(w => (
                    <th key={w.weekKey} className="py-4 px-4 text-center min-w-[160px] bg-indigo-50/50 border-l border-indigo-100">
                      <div className="font-black text-indigo-900">{w.weekLabel.split(' ')[0]} {w.weekLabel.split(' ')[1]}</div>
                      <div className="text-[9px] font-bold text-indigo-500 tracking-normal mt-0.5">{w.weekLabel.replace(/^[^\(]+\(/, '(')}</div>
                    </th>
                  ))}
                  <th className="py-4 px-4 text-center min-w-[100px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {filteredProducts.map((p, idx) => (
                  <tr key={p.productName} className={cn("hover:bg-slate-50/80 transition-colors", idx % 2 === 1 && "bg-slate-50/30")}>
                    <td className="py-4 px-6 sticky left-0 bg-white z-10 font-black text-slate-900 uppercase shadow-xs">
                      {p.productName}
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        {p.category}
                      </span>
                    </td>
                    {weeksList.map(w => {
                      const weekEntry = p.weeks[w.weekKey];
                      const qty = weekEntry?.quantity ?? 0;
                      const hasCount = weekEntry !== undefined;

                      return (
                        <td key={w.weekKey} className="py-4 px-4 text-center border-l border-slate-100">
                          {!hasCount ? (
                            <span className="text-slate-300 font-normal">—</span>
                          ) : p.tipoContagem === 'tem_bastante' ? (
                            qty > 0 ? (
                              <span className="inline-flex items-center justify-center px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl font-black text-[11px] border border-emerald-200">
                                TEM BASTANTE
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center px-3 py-1 bg-amber-50 text-amber-800 rounded-xl font-black text-[11px] border border-amber-200">
                                PRECISA PEDIR
                              </span>
                            )
                          ) : p.tipoContagem === 'embalagem_com_aberto' ? (
                            <div className="flex flex-col items-center justify-center text-[11px] font-black text-slate-800">
                              <span>{weekEntry.quiosqueQty ?? qty} fechados</span>
                              {(weekEntry.depositoQty ?? 0) > 0 && (
                                <span className="text-[10px] font-bold text-indigo-600 mt-0.5">
                                  + {weekEntry.depositoQty} em uso
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center">
                              <span className="inline-flex items-center justify-center px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl font-black text-xs border border-emerald-200">
                                {qty}
                              </span>
                              {(weekEntry.quiosqueQty !== undefined || weekEntry.depositoQty !== undefined) && (
                                <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                                  Q: {weekEntry.quiosqueQty ?? 0} | D: {weekEntry.depositoQty ?? 0}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => handleOpenEditModal(p)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border border-indigo-200 inline-flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Ajustar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-6 bg-indigo-50/60 rounded-[2.5rem] border border-indigo-100 flex items-start gap-4">
        <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl shrink-0">
          <Calendar className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-black text-indigo-950 uppercase tracking-tight">Sobre o Ciclo de Contagem Semanal</h4>
          <p className="text-xs font-bold text-indigo-900/80 leading-relaxed uppercase">
            Produtos do tipo "Tem Bastante" exibem status qualitativo em vez de quantidades numéricas. Produtos com embalagem e aberto exibem formato "fechados + em uso". Você pode calibrar qualquer valor clicando em "Ajustar".
          </p>
        </div>
      </div>

      {/* Edit / Calibration Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Ajustar Contagens Semanais</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{editingProduct.productName} ({editingProduct.category})</p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-2 bg-white hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                {editingProduct.tipoContagem === 'tem_bastante' 
                  ? 'Para itens "Tem Bastante", informe > 0 para "TEM BASTANTE" ou 0 para "PRECISA PEDIR":'
                  : 'Insira as quantidades totais, quiosque e depósito para cada semana que deseja calibrar:'}
              </p>

              <div className="space-y-4">
                {weeksList.map(w => {
                  const weekData = editingProduct.weeks[w.weekKey] || { quantity: 0, quiosqueQty: 0, depositoQty: 0 };
                  return (
                    <div key={w.weekKey} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                      <div className="font-black text-indigo-900 text-xs uppercase tracking-wider">
                        {w.weekLabel}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                            {editingProduct.tipoContagem === 'tem_bastante' ? 'Status (1=Bastante, 0=Pedir)' : 'Total Geral'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={weekData.quantity}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditingProduct({
                                ...editingProduct,
                                weeks: {
                                  ...editingProduct.weeks,
                                  [w.weekKey]: { ...weekData, quantity: val }
                                }
                              });
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-black text-xs text-slate-800"
                          />
                        </div>
                        {editingProduct.tipoContagem !== 'tem_bastante' && (
                          <>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Quiosque / Fechado</label>
                              <input
                                type="number"
                                min="0"
                                value={weekData.quiosqueQty}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setEditingProduct({
                                    ...editingProduct,
                                    weeks: {
                                      ...editingProduct.weeks,
                                      [w.weekKey]: { ...weekData, quiosqueQty: val }
                                    }
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-black text-xs text-slate-800"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Depósito / Em Uso</label>
                              <input
                                type="number"
                                min="0"
                                value={weekData.depositoQty}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setEditingProduct({
                                    ...editingProduct,
                                    weeks: {
                                      ...editingProduct.weeks,
                                      [w.weekKey]: { ...weekData, depositoQty: val }
                                    }
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-black text-xs text-slate-800"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setEditingProduct(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEditModal}
                disabled={savingEdit}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingEdit ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
