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
  HelpCircle
} from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getDataPath, cn } from '../lib/utils';
import { SearchableSelect } from './SearchableSelect';

interface StockEvolutionAnalysisProps {
  dataPath: string;
  onBack: () => void;
}

interface StockHistoryItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
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

  const fetchHistory = async () => {
    setRefreshing(true);
    try {
      // Fetch from stockCountHistory
      const q = query(collection(db, getDataPath('stockCountHistory')));
      const snap = await getDocs(q);
      const loaded: StockHistoryItem[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => {
          loaded.push({ id: docSnap.id, ...docSnap.data() } as StockHistoryItem);
        });
      }

      // If no history items exist yet, let's also fetch current stock items to initialize Semana 1 (03-09/10) as a fallback/seed so the user immediately sees Semana 1 data!
      if (loaded.length === 0) {
        const stockSnap = await getDocs(collection(db, getDataPath('stock')));
        if (!stockSnap.empty) {
          const defaultWeekKey = '2026-10-03';
          const defaultWeekLabel = 'Semana 1 (03-09/10)';
          stockSnap.forEach(sDoc => {
            const sData = sDoc.data();
            loaded.push({
              id: `${sDoc.id}_${defaultWeekKey}`,
              productId: sDoc.id,
              productName: sData.produto || 'Produto',
              category: sData.categoria || 'Geral',
              weekKey: defaultWeekKey,
              weekLabel: defaultWeekLabel,
              startDate: '2026-10-03',
              endDate: '2026-10-09',
              quantity: sData.estoqueAtual ?? 0,
              quiosqueQty: sData.estoqueQuiosque ?? 0,
              depositoQty: sData.estoqueDeposito ?? 0
            });
          });
        }
      }

      setHistoryItems(loaded);
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

    // Ensure Semana 1 (2026-10-03) is always present if not already
    if (!weekMap.has('2026-10-03')) {
      weekMap.set('2026-10-03', {
        weekKey: '2026-10-03',
        weekLabel: 'Semana 1 (03-09/10)',
        startDate: '2026-10-03',
        endDate: '2026-10-09'
      });
    }

    return Array.from(weekMap.values()).sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  }, [historyItems]);

  // Group items by product name
  const productEvolutionMap = useMemo(() => {
    const map = new Map<string, { productName: string; category: string; weeks: Record<string, number> }>();

    historyItems.forEach(item => {
      const prodName = item.productName || 'Produto Desconhecido';
      const cat = item.category || 'Geral';
      if (!map.has(prodName)) {
        map.set(prodName, {
          productName: prodName,
          category: cat,
          weeks: {}
        });
      }
      const prodEntry = map.get(prodName)!;
      if (item.weekKey) {
        prodEntry.weeks[item.weekKey] = item.quantity ?? 0;
      }
      if (cat && cat !== 'Geral') {
        prodEntry.category = cat;
      }
    });

    return map;
  }, [historyItems]);

  // Filter products by search term and category
  const filteredProducts = useMemo(() => {
    const products = Array.from(productEvolutionMap.values());
    return products.filter(p => {
      const matchSearch = searchTerm.trim() === '' || p.productName.toLowerCase().includes(searchTerm.toLowerCase().trim());
      const matchCat = selectedCategory === 'Todas' || p.category === selectedCategory;
      return matchSearch && matchCat;
    }).sort((a, b) => a.productName.localeCompare(b.productName, 'pt-BR', { sensitivity: 'base' }));
  }, [productEvolutionMap, searchTerm, selectedCategory]);

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
              Contagens semanais realizadas entre sábado e sexta-feira
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
                    <th key={w.weekKey} className="py-4 px-4 text-center min-w-[150px] bg-indigo-50/50 border-l border-indigo-100">
                      <div className="font-black text-indigo-900">{w.weekLabel.split(' ')[0]} {w.weekLabel.split(' ')[1]}</div>
                      <div className="text-[9px] font-bold text-indigo-500 tracking-normal mt-0.5">{w.weekLabel.replace(/^[^\(]+\(/, '(')}</div>
                    </th>
                  ))}
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
                      const qty = p.weeks[w.weekKey];
                      const hasCount = qty !== undefined;
                      return (
                        <td key={w.weekKey} className="py-4 px-4 text-center border-l border-slate-100">
                          {hasCount ? (
                            <span className="inline-flex items-center justify-center px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl font-black text-xs border border-emerald-200">
                              {qty}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>
                      );
                    })}
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
            As contagens ocorrem semanalmente entre sábado e sexta-feira (com foco nas segundas e terças-feiras). Cada nova contagem realizada no módulo de Contagem de Estoque alimenta automaticamente a respectiva coluna da semana correspondente.
          </p>
        </div>
      </div>
    </div>
  );
};
