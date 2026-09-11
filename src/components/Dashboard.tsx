import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend,
  ComposedChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  ShoppingCart, 
  PieChart as PieIcon,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Wallet,
  Info,
  RefreshCw,
  CreditCard,
  ShoppingBag
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { MonthlyClosing, Sale, Purchase, BankTransaction, StockItem, FinancialRecord, Recipe, MACRO_INGREDIENTS } from '../types';
import { motion } from 'motion/react';

interface DashboardProps {
  stats: MonthlyClosing;
  sales: Sale[];
  purchases: Purchase[];
  bank: BankTransaction[];
  stock: StockItem[];
  financial: FinancialRecord[];
  wasteRecords?: any[];
  staffConsumptions?: any[];
  staffPayments?: any[];
  userRole?: string;
  recipes?: Recipe[];
  allSales?: Sale[];
  selectedMonths?: string[];
}

const KPICard = ({ title, value, icon: Icon, trend, color, subtitle, info }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative group"
  >
    <div className="flex justify-between items-start">
      <div className={cn("p-2 rounded-xl", color)}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex items-center gap-2">
        {info && (
          <div className="relative group/info">
            <div className="p-1 rounded-full hover:bg-slate-50 cursor-help transition-colors">
              <Info className="w-4 h-4 text-slate-300 hover:text-slate-500" />
            </div>
            {/* Tooltip */}
            <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-slate-900 text-white text-[11px] leading-relaxed rounded-xl shadow-2xl z-50 pointer-events-none opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible group-hover/info:-translate-y-1 transition-all duration-200">
              <div className="font-bold mb-1.5 border-b border-slate-700 pb-1.5 uppercase tracking-wider text-slate-400 text-[9px]">Base de Cálculo</div>
              {info}
              <div className="absolute top-full right-2 w-2 h-2 bg-slate-900 rotate-45 -translate-y-1" />
            </div>
          </div>
        )}
        {trend && (
          <div className={cn(
            "flex items-center text-sm font-medium px-2 py-1 rounded-full",
            trend > 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
          )}>
            {trend > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
    <div className="mt-4">
      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(value)}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  </motion.div>
);

const CustomCostTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const bars = payload.filter((entry: any) => entry.dataKey !== 'total' && entry.value > 0);
    const totalLine = payload.find((entry: any) => entry.dataKey === 'total');
    const totalValue = totalLine ? totalLine.value : bars.reduce((sum: number, b: any) => sum + (b.value || 0), 0);

    const sortedBars = [...bars].sort((a: any, b: any) => b.value - a.value);

    return (
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xl min-w-[240px]">
        <p className="text-sm font-bold text-slate-800 mb-2 border-b border-slate-50 pb-2">{label}</p>
        <div className="space-y-1.5">
          {sortedBars.length > 0 ? (
            sortedBars.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-1.5 h-1.5 rounded-full" 
                    style={{ backgroundColor: item.color || item.fill }} 
                  />
                  <span className="text-slate-500 capitalize">{String(item.name).toLowerCase()}:</span>
                </div>
                <span className="font-semibold text-slate-900">{formatCurrency(item.value)}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic">Sem despesas classificadas</p>
          )}
          <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center">
            <span className="text-slate-900 text-xs font-bold">Custo Total:</span>
            <span className="text-rose-600 font-bold text-sm tracking-tight">{formatCurrency(totalValue)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const getClassificationColor = (cl: string, index: number) => {
  const normalized = String(cl || '').toLowerCase().trim();
  if (normalized.includes('investimento')) return '#6366f1'; // Indigo
  if (normalized.includes('recorrente') || normalized.includes('fixo')) return '#f43f5e'; // Rose
  if (normalized.includes('variável') || normalized.includes('variavel')) return '#f59e0b'; // Amber
  if (normalized.includes('operacional')) return '#10b981'; // Emerald
  if (normalized.includes('pessoal')) return '#14b8a6'; // Teal
  if (normalized.includes('marketing')) return '#ec4899'; // Pink
  
  const palette = ['#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'];
  return palette[index % palette.length];
};

// Fixed product list from CSV (referenced from WasteRegistration)
const FIXED_STAFF_PRODUCTS = [
  { id: '1', nome: 'Água com gás', precoCheio: 8.00, descontoPercent: 50 },
  { id: '2', nome: 'Água sem gás', precoCheio: 7.00, descontoPercent: 50 },
  { id: '3', nome: 'Apple cobbler', precoCheio: 28.00, descontoPercent: 50 },
  { id: '4', nome: 'Bolo caseiro', precoCheio: 15.00, descontoPercent: 30 },
  { id: '5', nome: 'Brownie chocolate', precoCheio: 28.00, descontoPercent: 50 },
  { id: '6', nome: 'Brownie cookie', precoCheio: 18.90, descontoPercent: 50 },
  { id: '7', nome: 'Café latte grande', precoCheio: 16.00, descontoPercent: 50 },
  { id: '8', nome: 'Café latte pequeno', precoCheio: 12.00, descontoPercent: 50 },
  { id: '10', nome: 'Cappuccino dos chocólatras', precoCheio: 18.00, descontoPercent: 50 },
  { id: '11', nome: 'Cappuccino tradicional', precoCheio: 16.00, descontoPercent: 50 },
  { id: '12', nome: 'Chá twinnigs', precoCheio: 10.00, descontoPercent: 50 },
  { id: '13', nome: 'Cheesecake', precoCheio: 28.00, descontoPercent: 50 },
  { id: '14', nome: 'Chocolate cremoso grande', precoCheio: 18.00, descontoPercent: 50 },
  { id: '15', nome: 'Chocolate cremoso pequeno', precoCheio: 15.00, descontoPercent: 50 },
  { id: '16', nome: 'Chocolate gelado', precoCheio: 11.00, descontoPercent: 50 },
  { id: '17', nome: 'Chocolate quente com chantilly grande', precoCheio: 17.00, descontoPercent: 50 },
  { id: '18', nome: 'Chocolate quente com chantilly pequeno', precoCheio: 14.00, descontoPercent: 50 },
  { id: '19', nome: 'Chocolate quente grande', precoCheio: 14.00, descontoPercent: 50 },
  { id: '20', nome: 'Chocolate quente pequeno', precoCheio: 12.00, descontoPercent: 50 },
  { id: '22', nome: 'Cookie avelã crunchy', precoCheio: 27.00, descontoPercent: 50 },
  { id: '23', nome: 'Cookie bomb', precoCheio: 30.57, descontoPercent: 50 },
  { id: '24', nome: 'Cookie cenoura com chocolate', precoCheio: 27.00, descontoPercent: 50 },
  { id: '25', nome: 'Cookie chocolate branco (white)', precoCheio: 18.90, descontoPercent: 50 },
  { id: '26', nome: 'Cookie chocolate chips', precoCheio: 18.90, descontoPercent: 50 },
  { id: '27', nome: 'Cookie chocolate chips com macadâmia', precoCheio: 18.90, descontoPercent: 50 },
  { id: '28', nome: 'Cookie chocolate chips with m&ms', precoCheio: 19.90, descontoPercent: 50 },
  { id: '29', nome: 'Cookie dark', precoCheio: 28.00, descontoPercent: 50 },
  { id: '30', nome: 'Cookie doce de leite', precoCheio: 21.90, descontoPercent: 50 },
  { id: '31', nome: 'Cookie double chocolate', precoCheio: 18.90, descontoPercent: 50 },
  { id: '32', nome: 'Cookie ice mountain', precoCheio: 28.00, descontoPercent: 50 },
  { id: '33', nome: 'Cookie my way', precoCheio: 27.00, descontoPercent: 50 },
  { id: '34', nome: 'Cookie ovomaltine', precoCheio: 27.00, descontoPercent: 50 },
  { id: '35', nome: 'Cookie pao de mel', precoCheio: 27.00, descontoPercent: 50 },
  { id: '36', nome: 'Cookie pistache', precoCheio: 27.00, descontoPercent: 50 },
  { id: '37', nome: 'Cookie red velvet', precoCheio: 21.90, descontoPercent: 50 },
  { id: '38', nome: 'Cookie sandwich', precoCheio: 38.00, descontoPercent: 50 },
  { id: '39', nome: 'Cookie shake', precoCheio: 32.00, descontoPercent: 50 },
  { id: '40', nome: 'Cookie triple chocolate', precoCheio: 18.90, descontoPercent: 50 },
  { id: '41', nome: 'Coxinha de batata doce com frango', precoCheio: 16.00, descontoPercent: 30 },
  { id: '42', nome: 'Coxinha vegana de batata doce com jaca', precoCheio: 17.00, descontoPercent: 30 },
  { id: '43', nome: 'Croissant caprese', precoCheio: 39.00, descontoPercent: 30 },
  { id: '44', nome: 'Croissant presunto e queijo', precoCheio: 25.00, descontoPercent: 30 },
  { id: '45', nome: 'Croissant tradicional', precoCheio: 21.00, descontoPercent: 30 },
  { id: '46', nome: 'Delícia de abacaxi', precoCheio: 16.00, descontoPercent: 50 },
  { id: '47', nome: 'Delícia detox', precoCheio: 18.00, descontoPercent: 50 },
  { id: '49', nome: 'Esfiha de carne', precoCheio: 12.00, descontoPercent: 30 },
  { id: '50', nome: 'Esfiha de queijo', precoCheio: 12.00, descontoPercent: 30 },
  { id: '51', nome: 'Espresso com panna pequeno', precoCheio: 12.00, descontoPercent: 50 },
  { id: '52', nome: 'Espresso macchiato grande', precoCheio: 15.00, descontoPercent: 50 },
  { id: '53', nome: 'Espresso macchiato pequeno', precoCheio: 11.00, descontoPercent: 50 },
  { id: '54', nome: 'Espresso origens grande', precoCheio: 15.00, descontoPercent: 50 },
  { id: '55', nome: 'Espresso origens pequeno', precoCheio: 10.00, descontoPercent: 50 },
  { id: '56', nome: 'Frappé de café', precoCheio: 28.00, descontoPercent: 50 },
  { id: '57', nome: 'Ice cappuccino', precoCheio: 21.50, descontoPercent: 50 },
  { id: '58', nome: 'Leitinho da casa', precoCheio: 14.00, descontoPercent: 50 },
  { id: '59', nome: 'Moccha', precoCheio: 18.00, descontoPercent: 50 },
  { id: '60', nome: 'Mud frappe', precoCheio: 28.00, descontoPercent: 50 },
  { id: '61', nome: 'Novo cinnamon roll clássico', precoCheio: 29.20, descontoPercent: 50 },
  { id: '62', nome: 'Novo cinnamon roll especial', precoCheio: 31.40, descontoPercent: 50 },
  { id: '63', nome: 'Novo cinnamon roll tradicional', precoCheio: 27.00, descontoPercent: 50 },
  { id: '64', nome: 'Ovo cookie loja', precoCheio: 30.00, descontoPercent: 50 },
  { id: '65', nome: 'Ovos orgânicos cremosos', precoCheio: 12.00, descontoPercent: 30 },
  { id: '66', nome: 'Pancakes 2 unidades', precoCheio: 20.90, descontoPercent: 50 },
  { id: '67', nome: 'Pancakes 3 unidades', precoCheio: 24.00, descontoPercent: 50 },
  { id: '68', nome: 'Pão com carne suculenta', precoCheio: 37.00, descontoPercent: 30 },
  { id: '69', nome: 'Pão com ovo', precoCheio: 28.00, descontoPercent: 30 },
  { id: '70', nome: 'Pão de queijo Gouda (3 unid.)', precoCheio: 11.00, descontoPercent: 50 },
  { id: '71', nome: 'Pão de queijo Gouda (6 unid.)', precoCheio: 18.00, descontoPercent: 50 },
  { id: '72', nome: 'Pão de queijo com batata doce e grãos (3unid)', precoCheio: 12.00, descontoPercent: 30 },
  { id: '73', nome: 'Pão de queijo com batata doce e grãos (6unid)', precoCheio: 20.00, descontoPercent: 30 },
  { id: '74', nome: 'Pão na chapa', precoCheio: 10.00, descontoPercent: 30 },
  { id: '75', nome: 'Pão na chapa com requeijão', precoCheio: 17.00, descontoPercent: 30 },
  { id: '76', nome: 'Pastel assado', precoCheio: 19.00, descontoPercent: 30 },
  { id: '77', nome: 'Refrigerante 220ml', precoCheio: 8.00, descontoPercent: 50 },
  { id: '78', nome: 'Refrigerante 350ml', precoCheio: 10.00, descontoPercent: 50 },
  { id: '79', nome: 'Smoothie de fruta', precoCheio: 19.00, descontoPercent: 50 },
  { id: '80', nome: 'Soda americana', precoCheio: 17.00, descontoPercent: 50 },
  { id: '81', nome: 'Suco detox', precoCheio: 16.00, descontoPercent: 50 },
  { id: '82', nome: 'Suco lata (290ml)', precoCheio: 9.00, descontoPercent: 50 },
  { id: '83', nome: 'Suco natural', precoCheio: 14.00, descontoPercent: 50 },
  { id: '84', nome: 'Tortas da bottega', precoCheio: 18.00, descontoPercent: 30 },
  { id: '85', nome: 'Waffle de queijo mr. cheney', precoCheio: 12.00, descontoPercent: 50 },
  { id: '86', nome: 'Yuba', precoCheio: 18.00, descontoPercent: 50 },
  { id: '87', nome: 'Kit Lanche', precoCheio: 0.00, descontoPercent: 0 },
  { id: '88', nome: 'Quiche de Alho Poró', precoCheio: 18.00, descontoPercent: 30 },
  { id: '89', nome: 'Creme de Mandioquinha', precoCheio: 39.90, descontoPercent: 30 },
  { id: '90', nome: 'Caldo Verde', precoCheio: 39.90, descontoPercent: 30 },
  { id: '91', nome: 'Creme de batata com bacon e queijo', precoCheio: 39.90, descontoPercent: 30 },
];

export const Dashboard: React.FC<DashboardProps> = ({ 
  stats, 
  sales, 
  purchases, 
  bank, 
  stock, 
  financial, 
  wasteRecords = [],
  staffConsumptions = [],
  staffPayments = [],
  userRole,
  recipes = [],
  allSales,
  selectedMonths
}) => {
  // Staff calculated balances
  const staffBalances = useMemo(() => {
    const list = ['Ariane', 'Barbara', 'Alexandre', 'Breno', 'Keila', 'Diogo', 'Free Lancer', 'Kenji', 'Nathan', 'Alicia'];
    const norm = (n?: string) => (n || '').trim().toLowerCase() === 'natan' ? 'Nathan' : (n || '').trim();
    return list.map(name => {
      const target = norm(name);
      const consumption = staffConsumptions
        .filter(c => norm(c.funcionario) === target)
        .reduce((sum, c) => sum + (c.valorPago || 0), 0);
      const payments = staffPayments
        .filter(p => norm(p.funcionario) === target)
        .reduce((sum, p) => sum + (p.valorPago || 0), 0);
      return { name, balance: consumption - payments };
    });
  }, [staffConsumptions, staffPayments]);

  const totalPendingBalance = staffBalances.reduce((sum, b) => sum + b.balance, 0);

  // Waste calculation
  const wasteStats = useMemo(() => {
    const records = wasteRecords || [];
    
    // Month normalization map and parser
    const getNormalizedMonth = (val: string): string => {
      const MONTH_MAP_LOCAL: Record<string, string> = {
        'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
        'jan.': '01', 'fev.': '02', 'mar.': '03', 'abr.': '04', 'mai.': '05', 'jun.': '06',
        'jul.': '07', 'ago.': '08', 'set.': '09', 'out.': '10', 'nov.': '11', 'dez.': '12',
        'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06',
        'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
      };
      const raw = val.toLowerCase().trim();
      if (!raw) return '';
      if (/^\d{2}\/\d{4}$/.test(raw)) return raw;
      const separators = ['/', '-', '.', ' '];
      let pts: string[] = [raw];
      for (const sep of separators) {
        if (raw.includes(sep)) {
          pts = raw.split(sep).map(p => p.trim()).filter(p => p !== '');
          if (pts.length >= 2) break;
        }
      }
      let m = '', y = '';
      const findMonthNum = (s: string) => {
        const cleanS = s.replace('.', '').substring(0, 3).toLowerCase();
        return MONTH_MAP_LOCAL[cleanS] || (Number(s) <= 12 ? s.padStart(2, '0') : null);
      };
      if (pts.length >= 2) {
        pts.forEach(p => {
          if (p.length === 4 && !isNaN(Number(p))) y = p;
        });
        pts.forEach(p => {
          const mn = findMonthNum(p);
          if (mn && p !== y) m = mn;
        });
        if (!m || !y) {
          if (pts.length === 3) {
            if (!y) y = pts[2].length === 4 ? pts[2] : (pts[0].length === 4 ? pts[0] : '');
            if (!m) m = pts[1].padStart(2, '0');
          } else if (pts.length === 2) {
            if (!y) y = pts[1].length === 4 ? pts[1] : '';
            if (!m) m = pts[0].padStart(2, '0');
          }
        }
      }
      if (m && y) return `${m}/${y}`;
      return '';
    };

    const findWasteProductLocal = (productName: string) => {
      const normalized = productName.toLowerCase();
      if (normalized === 'carne suculenta' || normalized.includes('carne suculenta')) {
        return FIXED_STAFF_PRODUCTS.find(p => p.nome === 'Pão com carne suculenta');
      }
      let product = FIXED_STAFF_PRODUCTS.find(p => p.nome.toLowerCase() === normalized);
      if (product) return product;
      product = FIXED_STAFF_PRODUCTS.find(p => normalized.startsWith(p.nome.toLowerCase()));
      if (product) return product;
      return null;
    };

    // Index purchases for high-speed lookup
    const purchasesByProd = new Map<string, Purchase[]>();
    (purchases || []).forEach(p => {
      const pProd = (p.produto || '').toLowerCase().trim();
      if (!purchasesByProd.has(pProd)) {
        purchasesByProd.set(pProd, []);
      }
      purchasesByProd.get(pProd)!.push(p);
    });

    const matchCache = new Map<string, Purchase[]>();
    const getGuesses = (macroIngredient: string) => {
      const cacheKey = macroIngredient.toLowerCase().trim();
      if (matchCache.has(cacheKey)) return matchCache.get(cacheKey)!;
      
      const results: Purchase[] = [];
      purchasesByProd.forEach((list, prodKey) => {
        if (prodKey === cacheKey || prodKey.startsWith(cacheKey) || cacheKey.startsWith(prodKey)) {
          results.push(...list);
        }
      });
      matchCache.set(cacheKey, results);
      return results;
    };

    const getRecordCost = (record: any) => {
      const product = findWasteProductLocal(record.produto);
      const price = product ? product.precoCheio : 0;
      const quantity = Number(record.quantidade) || 0;
      if (!quantity) return 0;

      const rawProductName = record.produto || '';
      const cleanName = rawProductName.split(' (Qtd:')[0].split(' [Dividido entre:')[0].trim().toLowerCase();
      
      const recipe = (recipes || []).find(r => r.produtoFinal.toLowerCase() === cleanName) ||
                     (recipes || []).find(r => cleanName.startsWith(r.produtoFinal.toLowerCase())) ||
                     (recipes || []).find(r => r.produtoFinal.toLowerCase().startsWith(cleanName));

      const actionMonth = record.mes || (record.data ? getNormalizedMonth(record.data) : '');

      if (recipe && recipe.ingredientes && recipe.ingredientes.length > 0) {
        let totalRecipeCost = 0;

        for (const ing of recipe.ingredientes) {
          const macroIngredient = ing.macroIngredient || '';
          let ingredientUnitCost = 0;

          // Search purchases via index match
          const candidates = getGuesses(macroIngredient);
          const monthPurchases = candidates.filter(p => {
            const pMonth = 'mes' in p && p.mes ? p.mes : (p.data ? getNormalizedMonth(p.data) : '');
            return pMonth === actionMonth;
          });

          if (monthPurchases.length > 0) {
            const validP = monthPurchases.find(p => p.custoUnitario > 0) || monthPurchases[0];
            ingredientUnitCost = validP.custoUnitario || 0;
            if (!ingredientUnitCost && validP.quantidade > 0 && validP.total > 0) {
              ingredientUnitCost = validP.total / validP.quantidade;
            }
          }

          if (ingredientUnitCost === 0 && candidates.length > 0) {
            const validP = candidates.find(p => p.custoUnitario > 0) || candidates[0];
            ingredientUnitCost = validP.custoUnitario || 0;
            if (!ingredientUnitCost && validP.quantidade > 0 && validP.total > 0) {
              ingredientUnitCost = validP.total / validP.quantidade;
            }
          }

          if (ingredientUnitCost === 0) {
            const stockItem = stock.find(s => s.produto.toLowerCase() === macroIngredient.toLowerCase());
            if (stockItem) {
              ingredientUnitCost = stockItem.custoUnitario || 0;
            }
          }

          if (ingredientUnitCost > 0) {
            totalRecipeCost += ingredientUnitCost * ing.quantidade;
          }
        }

        if (totalRecipeCost > 0) {
          return totalRecipeCost * quantity;
        }
      }

      const stockItem = stock.find(s => s.produto.toLowerCase() === rawProductName.toLowerCase());
      if (stockItem && stockItem.custoUnitario > 0) {
        return stockItem.custoUnitario * quantity;
      }

      return (price * 0.35) * quantity;
    };

    const descarteQty = records.filter(r => r.acao === 'Descarte').reduce((acc, r) => acc + Number(r.quantidade), 0);
    const reusoQty = records.filter(r => r.acao === 'Reuso').reduce((acc, r) => acc + Number(r.quantidade), 0);

    const descarteValue = records
      .filter(r => r.acao === 'Descarte')
      .reduce((acc, r) => {
        const product = findWasteProductLocal(r.produto);
        return acc + ((product?.precoCheio || 0) * Number(r.quantidade));
      }, 0);

    const reusoValue = records
      .filter(r => r.acao === 'Reuso')
      .reduce((acc, r) => {
        const product = findWasteProductLocal(r.produto);
        return acc + ((product?.precoCheio || 0) * Number(r.quantidade));
      }, 0);

    const descarteCost = records
      .filter(r => r.acao === 'Descarte')
      .reduce((acc, r) => acc + getRecordCost(r), 0);

    const reusoCost = records
      .filter(r => r.acao === 'Reuso')
      .reduce((acc, r) => acc + getRecordCost(r), 0);

    return { descarteQty, reusoQty, descarteValue, reusoValue, descarteCost, reusoCost };
  }, [wasteRecords, purchases, stock, recipes]);

  // Evolução Mensal (Tendência)
  const trendData = useMemo(() => {
    const months = new Set<string>();
    sales.forEach(s => s.mes && months.add(s.mes));
    financial.forEach(f => f.mes && months.add(f.mes));
    
    return Array.from(months)
      .sort((a, b) => {
        const partsA = String(a || '').split('/');
        const partsB = String(b || '').split('/');
        const mA = Number(partsA[0]) || 0;
        const yA = Number(partsA[1]) || 0;
        const mB = Number(partsB[0]) || 0;
        const yB = Number(partsB[1]) || 0;
        if (yA !== yB) return yA - yB;
        return mA - mB;
      })
      .map(month => {
        const grossVal = sales.filter(s => s.mes === month).reduce((sum, s) => sum + s.vendas, 0);
        
        const monthFinance = financial.filter(f => f.mes === month);
        const netVal = monthFinance.filter(f => f.tipo === 'Receita').reduce((sum, f) => sum + f.valor, 0);
        const discountVal = Math.max(0, grossVal - netVal);

        const normalizeStr = (str: string) => {
          if (!str) return '';
          return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
        };

        const isInvestment = (f: any) => {
          const cls = normalizeStr(f.classificacao || '');
          const det = normalizeStr(f.detalhes || '');
          return cls.includes('investimento') || det.includes('investimento');
        };

        const costsVal = monthFinance
          .filter(f => f.tipo === 'Despesa' && !isInvestment(f))
          .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

        return {
          month,
          vendasBrutas: grossVal,
          receitaLiquida: netVal,
          descontos: discountVal,
          custos: costsVal
        };
      });
  }, [sales, financial]);

  // Dados para o gráfico de pizza (Gastos)
  const expenseData = [
    { name: 'Produtos (CMV)', value: stats.cmv, color: '#6366f1' },
    { name: 'Fixos', value: stats.gastosFixos, color: '#f43f5e' },
    { name: 'Variáveis', value: stats.gastosVariaveis, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Helper para formatar nomes de produtos
  const formatProductName = (name: string) => {
    if (!name) return '';
    const clean = name.trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  };

  // Agrupar vendas por produto para o ranking
  const topProducts = useMemo(() => {
    const grouped = sales.reduce((acc: any, sale) => {
      const formattedName = formatProductName(sale.nome);
      if (!acc[formattedName]) {
        acc[formattedName] = { name: formattedName, total: 0, qty: 0, category: sale.categoria };
      }
      acc[formattedName].total += sale.vendas;
      acc[formattedName].qty += sale.quantidade;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5);
  }, [sales]);

  // Agrupar vendas por produto para o ranking de PIORES (Bottom 5)
  const bottomProducts = useMemo(() => {
    const allowedCategories = ['bebidas', 'mr. cheney', 'origens'];
    const grouped = sales.reduce((acc: any, sale) => {
      const category = String(sale.categoria || '').toLowerCase().trim();
      
      // Filtros: Apenas as categorias permitidas
      if (!allowedCategories.includes(category)) return acc;
      
      const formattedName = formatProductName(sale.nome);
      if (!acc[formattedName]) {
        acc[formattedName] = { name: formattedName, total: 0, qty: 0, category: sale.categoria };
      }
      acc[formattedName].total += sale.vendas;
      acc[formattedName].qty += sale.quantidade;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a: any, b: any) => a.total - b.total) // Ordem ascendente (piores primeiro)
      .slice(0, 5);
  }, [sales]);

  // Active Month identified from selection
  const activeMonthStr = useMemo(() => {
    if (selectedMonths && selectedMonths.length > 0) {
      // Sort in descending order to get the latest selected month
      const sorted = [...selectedMonths].filter(Boolean).sort((a, b) => {
        const partsA = String(a || '').split('/');
        const partsB = String(b || '').split('/');
        const mA = Number(partsA[0]) || 0;
        const yA = Number(partsA[1]) || 0;
        const mB = Number(partsB[0]) || 0;
        const yB = Number(partsB[1]) || 0;
        if (yA !== yB) return yB - yA;
        return mB - mA;
      });
      return sorted[0] || '05/2026';
    }
    
    // fallback to latest month in sales
    const salesSource = allSales || sales;
    const months = Array.from(new Set(salesSource.map(s => s.mes))).filter(Boolean) as string[];
    if (months.length === 0) return '05/2026';
    const sorted = months.sort((a, b) => {
      const partsA = String(a || '').split('/');
      const partsB = String(b || '').split('/');
      const mA = Number(partsA[0]) || 0;
      const yA = Number(partsA[1]) || 0;
      const mB = Number(partsB[0]) || 0;
      const yB = Number(partsB[1]) || 0;
      if (yA !== yB) return yB - yA;
      return mB - mA;
    });
    return sorted[0] || '05/2026';
  }, [selectedMonths, allSales, sales]);

  // Relative months for comparisons (1 month ago & average of last 3 months)
  const relativeMonths = useMemo(() => {
    if (!activeMonthStr || !activeMonthStr.includes('/')) return { prevMonth: '', last3Months: [] as string[] };
    const parts = activeMonthStr.split('/');
    const m = Number(parts[0]) || 5;
    const y = Number(parts[1]) || 2026;
    
    // Previous month: minus 1 month
    const prevDate = new Date(y, m - 2, 1);
    const prevMonthStr = `${String(prevDate.getMonth() + 1).padStart(2, '0')}/${prevDate.getFullYear()}`;
    
    // Last 3 months (chronologically preceding activeMonthStr)
    const last3: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(y, m - 1 - i, 1);
      last3.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
    }
    
    return {
      prevMonth: prevMonthStr,
      last3Months: last3
    };
  }, [activeMonthStr]);

  // Comprehensive Sales By Category with Comparisons
  const salesByCategoryWithComps = useMemo(() => {
    const salesSource = allSales || sales;
    
    // Compute current categorized sales for `activeMonthStr`
    // (If user selected multiple months, we can aggregate sales of multiple selected months for 'current', but default to activeMonthStr is better and more precise)
    const currentSales = selectedMonths && selectedMonths.length > 0 
      ? salesSource.filter(s => selectedMonths.includes(s.mes || ''))
      : salesSource.filter(s => s.mes === activeMonthStr);

    const totalCurrentVal = currentSales.reduce((sum, s) => sum + (s.vendas || 0), 0);

    const groupedCurrent = currentSales.reduce((acc: Record<string, number>, s) => {
      const cat = s.categoria || 'Outros';
      acc[cat] = (acc[cat] || 0) + (s.vendas || 0);
      return acc;
    }, {});

    // Compute previous month categorized sales
    const prevSales = salesSource.filter(s => s.mes === relativeMonths.prevMonth);
    const groupedPrev = prevSales.reduce((acc: Record<string, number>, s) => {
      const cat = s.categoria || 'Outros';
      acc[cat] = (acc[cat] || 0) + (s.vendas || 0);
      return acc;
    }, {});

    // Compute average of last 3 months categorized sales
    const last3Data = relativeMonths.last3Months.map(mStr => {
      const monthSales = salesSource.filter(s => s.mes === mStr);
      const grouped = monthSales.reduce((acc: Record<string, number>, s) => {
        const cat = s.categoria || 'Outros';
        acc[cat] = (acc[cat] || 0) + (s.vendas || 0);
        return acc;
      }, {});
      return { month: mStr, grouped, total: monthSales.reduce((sum, s) => sum + (s.vendas || 0), 0) };
    });

    let totalSalesLast3Sum = 0;
    let monthsWithTotal = 0;
    last3Data.forEach(d => {
      if (d.total > 0) {
        totalSalesLast3Sum += d.total;
        monthsWithTotal++;
      }
    });
    const avgTotalSalesLast3 = monthsWithTotal > 0 ? totalSalesLast3Sum / monthsWithTotal : 0;

    const totalPrevVal = prevSales.reduce((sum, s) => sum + (s.vendas || 0), 0);

    const categories = Array.from(new Set([
      ...Object.keys(groupedCurrent),
      ...Object.keys(groupedPrev),
      ...last3Data.flatMap(d => Object.keys(d.grouped))
    ]));

    const result = categories.map(cat => {
      const currentVal = groupedCurrent[cat] || 0;
      const prevVal = groupedPrev[cat] || 0;

      // Avg 3 months value
      let monthsWithData = 0;
      let totalValLast3 = 0;
      last3Data.forEach(d => {
        if (d.total > 0) {
          totalValLast3 += (d.grouped[cat] || 0);
          monthsWithData++;
        }
      });
      const avgLast3Val = monthsWithData > 0 ? totalValLast3 / monthsWithData : 0;

      const pctChangeVsPrev = prevVal > 0 ? ((currentVal - prevVal) / prevVal) * 100 : null;
      const pctChangeVsAvg = avgLast3Val > 0 ? ((currentVal - avgLast3Val) / avgLast3Val) * 100 : null;

      const pctOfReceiptPrev = totalPrevVal > 0 ? (prevVal / totalPrevVal) * 100 : 0;
      const pctOfReceiptAvg = avgTotalSalesLast3 > 0 ? (avgLast3Val / avgTotalSalesLast3) * 100 : 0;

      return {
        name: cat,
        value: currentVal,
        prevValue: prevVal,
        avgValue: avgLast3Val,
        pctVsPrev: pctChangeVsPrev,
        pctVsAvg: pctChangeVsAvg,
        pctOfReceiptPrev,
        pctOfReceiptAvg
      };
    })
    .filter(item => item.value > 0) // only active categories in selected periods
    .sort((a, b) => b.value - a.value);

    return {
      categories: result,
      totalSales: totalCurrentVal
    };
  }, [allSales, sales, selectedMonths, activeMonthStr, relativeMonths]);

  const categoryData = useMemo(() => salesByCategoryWithComps.categories, [salesByCategoryWithComps]);

  // iFood Net Revenue
  const ifoodRevenue = useMemo(() => {
    return financial
      .filter(f => f.tipo === 'Receita' && (
        String(f.observacoes || '').toLowerCase().includes('ifood') || 
        String(f.detalhes || '').toLowerCase().includes('ifood')
      ))
      .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);
  }, [financial]);

  const ifoodPercent = useMemo(() => {
    return stats.receitaLiquida > 0 ? (ifoodRevenue / stats.receitaLiquida) * 100 : 0;
  }, [ifoodRevenue, stats.receitaLiquida]);

  const uniqueClassifications = useMemo(() => {
    return Array.from(new Set(financial
      .filter(f => f.tipo === 'Despesa')
      .map(f => (f.classificacao || 'Geral').trim())
    )).filter(c => c !== '');
  }, [financial]);

  // Dados para o gráfico de Custos por Classificação
  const costBreakdownData = useMemo(() => {
    const months = trendData.map(d => d.month);
    
    return months.map(month => {
      const monthExpenses = financial.filter(f => f.mes === month && f.tipo === 'Despesa');
      const dataPoint: any = { month, total: 0 };
      
      uniqueClassifications.forEach((cl: string) => {
        const val = monthExpenses
          .filter(f => (f.classificacao || 'Geral').trim() === cl)
          .reduce((sum, f) => sum + f.valor, 0);
        
        dataPoint[cl] = val;
        dataPoint.total += val;
      });
      
      return dataPoint;
    });
  }, [trendData, financial, uniqueClassifications]);

  const totalExpenses = useMemo(() => expenseData.reduce((sum, d) => sum + d.value, 0), [expenseData]);
  const totalSales = useMemo(() => categoryData.reduce((sum, d) => sum + d.value, 0), [categoryData]);
  
  const latestPurchases = useMemo(() => {
    const normalizeStr = (str: string) => {
      return (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    const list = purchases.filter(p => {
      const prodLower = (p.produto || '').toLowerCase().trim();
      const isDesconsiderado = p.desconsiderado === true || prodLower === 'desconsiderar';
      if (isDesconsiderado) return false;

      const normProd = normalizeStr(p.produto);
      const isMacro = MACRO_INGREDIENTS.some(m => normalizeStr(m) === normProd);
      return isMacro;
    });

    return [...list].sort((a, b) => {
      // Sort by data (DD/MM/YYYY)
      const getNumericDate = (d: string) => {
        if (!d) return 0;
        if (d.includes('-')) { // YYYY-MM-DD
          return new Date(d + 'T00:00:00').getTime();
        }
        const [day, month, year] = d.split('/').map(Number);
        return new Date(year, month - 1, day).getTime();
      };
      
      const dateA = getNumericDate(a.data);
      const dateB = getNumericDate(b.data);
      
      if (dateB !== dateA) return dateB - dateA;

      // Fallback to createdAt
      const getTime = (ca: any) => {
        if (!ca) return 0;
        if (ca.seconds) return ca.seconds * 1000 + (ca.nanoseconds / 1000000);
        if (ca instanceof Date) return ca.getTime();
        if (typeof ca === 'number') return ca;
        if (typeof ca === 'string') return new Date(ca).getTime();
        return 0;
      };
      
      return getTime(b.createdAt) - getTime(a.createdAt);
    }).slice(0, 10);
  }, [purchases]);

  return (
    <div className="space-y-8 pb-12">
      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Vendas Brutas (Balcão)" 
          value={stats.vendasBrutas} 
          icon={ShoppingCart} 
          color="bg-slate-100 text-slate-600"
          subtitle="Valor total sem descontos"
          info="Calculado pela soma total bruta da coluna 'Vendas' no arquivo de gestão de vendas, refletindo o faturamento total antes de deduções."
        />
        <KPICard 
          title="Receita Líquida (Caixa)" 
          value={stats.receitaLiquida} 
          icon={TrendingUp} 
          color="bg-blue-100 text-blue-600"
          subtitle={`Total com pgto. funcionários: ${formatCurrency(stats.receitaLiquida + (stats.totalStaffPayments || 0))}`}
          info="Soma de todas as entradas registradas no fluxo de caixa (Tipo: Receita). Representa o valor de fato disponível após taxas e abatimentos."
        />
        <KPICard 
          title="Receita Líquida iFood" 
          value={ifoodRevenue} 
          icon={ShoppingBag} 
          color="bg-rose-100 text-rose-600"
          subtitle={`Representa ${ifoodPercent.toFixed(1)}% da receita líquida`}
          info="Soma de todas as receitas de delivery (iFood) líquidas registradas no fluxo de caixa para o período selecionado."
        />
        <KPICard 
          title="Descontos Concedidos" 
          value={stats.descontos} 
          icon={ArrowDownRight} 
          color="bg-rose-100 text-rose-600"
          subtitle={`Impacto: ${((stats.descontos / stats.vendasBrutas) * 100 || 0).toFixed(1)}% das vendas`}
          info="Diferença absoluta entre as Vendas Brutas de balcão e a Receita Líquida liquidada. Inclui descontos manuais, promocionais e taxas operacionais."
        />
      </div>

      {/* KPIs Operacionais (Acima do Gráfico) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Lucro Bruto" 
          value={stats.lucroBruto} 
          icon={DollarSign} 
          color="bg-emerald-100 text-emerald-600"
          subtitle={`Margem: ${((stats.lucroBruto / stats.receitaLiquida) * 100 || 0).toFixed(1)}%`}
          info="Receita Líquida (Caixa) subtraída exclusivamente do CMV (Custo de Mercadoria Vendida). Mede a rentabilidade direta dos produtos."
        />
        <KPICard 
          title="Lucro Líquido" 
          value={stats.lucroLiquido} 
          icon={PieIcon} 
          color="bg-indigo-100 text-indigo-600"
          subtitle={`Margem: ${((stats.lucroLiquido / stats.receitaLiquida) * 100 || 0).toFixed(1)}%`}
          info="Resultado final após subtrair TODOS os custos (CMV + Fixos + Variáveis) da Receita Líquida. É o que sobra 'limpo' para o negócio."
        />
        <KPICard 
          title="CMV (Mercadoria)" 
          value={stats.cmv} 
          icon={Package} 
          color="bg-amber-100 text-amber-600"
          subtitle={`Peso: ${((stats.cmv / stats.receitaLiquida) * 100 || 0).toFixed(1)}%`}
          info="Custo de Mercadoria Vendida. Soma do custo de aquisição (preço pago ao fornecedor) de todos os itens vendidos no período."
        />
        <KPICard 
          title="Custos Operacionais" 
          value={stats.gastosFixos + stats.gastosVariaveis} 
          icon={Wallet} 
          color="bg-slate-100 text-slate-600"
          subtitle={`Fixo: ${formatCurrency(stats.gastosFixos)} | Var: ${formatCurrency(stats.gastosVariaveis)}`}
          info="Soma de todas as despesas operacionais (Fixas + Variáveis), excluindo o CMV. Representa o custo total necessário para manter a operação funcionando no dia a dia."
        />
      </div>

      {/* Gráfico de Evolução Mensal */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Evolução Mensal: Vendas vs Custos Totais
            </h3>
            <p className="text-sm text-slate-500 mt-1">Comparativo de performance entre receita e gastos operacionais.</p>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-slate-600">Vendas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-slate-600">Custos</span>
            </div>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(val) => `R$ ${val / 1000}k`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Legend verticalAlign="top" height={36}/>
              <Line 
                name="Receita Líquida"
                type="monotone" 
                dataKey="receitaLiquida" 
                stroke="#3b82f6" 
                strokeWidth={4} 
                dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 8, strokeWidth: 0 }}
              />
              <Line 
                name="Custos Totais"
                type="monotone" 
                dataKey="custos" 
                stroke="#f43f5e" 
                strokeWidth={4} 
                dot={{ r: 6, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 8, strokeWidth: 0 }}
              />
              <Line 
                name="Vendas Brutas"
                type="monotone" 
                dataKey="vendasBrutas" 
                stroke="#94a3b8" 
                strokeWidth={2} 
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Gráfico de Custos por Classificação */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-rose-600" />
              Custo Mensal por Classificação
            </h3>
            <p className="text-sm text-slate-500 mt-1">Detalhamento dos gastos mensais por categoria de custo.</p>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={costBreakdownData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(val) => `R$ ${val / 1000}k`}
              />
              <Tooltip content={<CustomCostTooltip />} />
              <Legend 
                verticalAlign="top" 
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', textTransform: 'capitalize' }}
              />
              {uniqueClassifications.map((cl, idx) => (
                <Bar 
                  key={cl}
                  name={cl}
                  dataKey={cl} 
                  stackId="a" 
                  fill={getClassificationColor(cl, idx)} 
                  radius={idx === uniqueClassifications.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={60}
                />
              ))}
              <Line
                name="Custo Total"
                type="monotone"
                dataKey="total"
                stroke="#64748b"
                strokeWidth={2}
                dot={{ r: 4, fill: '#64748b' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Vendas por Categoria */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-emerald-500" />
                Vendas por Categoria
              </h3>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Receita Total</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(totalSales)}</p>
              </div>
            </div>

            {/* Centered Donut with middle value label */}
            <div className="h-48 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#f43f5e'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center pointer-events-none">
                <span className="text-[9px] uppercase font-bold text-slate-400">Produtos</span>
                <span className="text-sm font-black text-slate-800">{formatCurrency(totalSales)}</span>
              </div>
            </div>

            {/* Custom High Density Bento Legend Sub-grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              {categoryData.map((item, index) => {
                const color = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#f43f5e'][index % 5];
                const percent = totalSales > 0 ? ((item.value / totalSales) * 100).toFixed(1) : '0';
                const vsPrev = item.pctVsPrev;
                const vsAvg = item.pctVsAvg;

                return (
                  <div 
                    key={item.name} 
                    className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col justify-between hover:bg-slate-50 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100/60">
                      <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-bold text-slate-850 text-[11px] capitalize truncate">{String(item.name).toLowerCase()}</span>
                    </div>
                    
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="font-black text-slate-900 text-[13px] tracking-tight">{formatCurrency(item.value)}</span>
                      <span className="text-[10px] text-emerald-600 font-bold bg-white px-1.5 py-0.5 rounded-md border border-slate-100">{percent}%</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-dashed border-slate-200/60">
                      {/* Mês Anterior */}
                      <div className="flex flex-col">
                        <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 whitespace-nowrap">Mês Anterior</span>
                        <span className="text-[9.5px] text-slate-700 font-bold leading-none">
                          {formatCurrency(item.prevValue)}
                        </span>
                      </div>

                      {/* Média 3M */}
                      <div className="flex flex-col">
                        <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 whitespace-nowrap">Média 3M</span>
                        <span className="text-[9.5px] text-slate-700 font-bold leading-none">
                          {formatCurrency(item.avgValue)}
                        </span>
                      </div>

                      {/* % na Receita */}
                      <div className="flex flex-col items-end">
                        <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 whitespace-nowrap">% na Rec. (3M)</span>
                        <span className="text-[9.5px] text-emerald-600 font-extrabold leading-none">
                          {item.pctOfReceiptAvg.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Ranking de Top Produtos */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
        >
          <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Top 5 Produtos em Vendas
          </h3>
          <div className="overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-3 text-blue-500">Produto</th>
                  <th className="pb-3 text-blue-500 text-right">Qtd</th>
                  <th className="pb-3 text-blue-500 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topProducts.map((item: any, i) => (
                  <tr key={i} className="text-sm">
                    <td className="py-3">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.category}</p>
                    </td>
                    <td className="py-3 text-right text-slate-600">{item.qty}</td>
                    <td className="py-3 text-right font-bold text-slate-900">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Distribuição de Gastos */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
        >
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-indigo-500" />
              Custos Operacionais vs Produtos
            </h3>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Custo Total</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(totalExpenses)}</p>
            </div>
          </div>
          <div className="h-80 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {expenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => formatCurrency(value)}
                />
                <Legend 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right"
                  formatter={(value) => {
                    const item = expenseData.find(d => d.name === value);
                    const percent = item ? ((item.value / totalExpenses) * 100).toFixed(1) : 0;
                    return (
                      <span className="text-slate-600 text-xs">
                        {value}: <span className="font-bold text-slate-900">{formatCurrency(item?.value || 0)}</span> <span className="text-[10px] text-slate-400 font-normal">({percent}%)</span>
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Ranking de Piores Produtos */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-rose-500" />
            Bottom 5 Produtos (Baixa Performance)
          </h3>
          <div className="overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-3 text-rose-500">Produto</th>
                  <th className="pb-3 text-rose-500 text-right">Qtd</th>
                  <th className="pb-3 text-rose-500 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bottomProducts.length > 0 ? (
                  bottomProducts.map((item: any, i) => (
                    <tr key={i} className="text-sm">
                      <td className="py-3">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <p className="text-[10px] text-slate-400">{item.category}</p>
                      </td>
                      <td className="py-3 text-right text-slate-600">{item.qty}</td>
                      <td className="py-3 text-right font-bold text-rose-600">{formatCurrency(item.total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-sm text-slate-400 italic">
                      Nenhum produto encontrado nos critérios
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[10px] text-slate-400 italic">
            * Considerando apenas: Bebidas, Mr. Cheney e Origens.
          </p>
        </div>
      </div>

      {/* Estoque e Compras Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2 text-rose-500">
            <Package className="w-5 h-5" />
            Últimas Compras Realizadas
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-100">
                <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 text-rose-500">Data</th>
                  <th className="pb-3 text-rose-500">Produto</th>
                  <th className="pb-3 text-rose-500 text-right">Qtd</th>
                  <th className="pb-3 text-rose-500 text-right">Custo Unit.</th>
                  <th className="pb-3 text-rose-500 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {latestPurchases.map((purchase, i) => (
                  <tr key={i} className="text-sm">
                    <td className="py-4 text-slate-600">{purchase.data}</td>
                    <td className="py-4 font-medium text-slate-900">{formatProductName(purchase.produto)}</td>
                    <td className="py-4 text-right text-slate-600">{purchase.quantidade}</td>
                    <td className="py-4 text-right text-slate-600">{formatCurrency(purchase.custoUnitario)}</td>
                    <td className="py-4 text-right font-medium text-slate-900">{formatCurrency(purchase.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-500" />
            Status do Estoque (Necessidade de Reposição)
          </h3>
          <div className="space-y-4">
            {[...stock]
              .sort((a, b) => a.estoqueAtual - b.estoqueAtual)
              .slice(0, 6)
              .map((item, i) => {
                const norm = (item.produto || '').toLowerCase();
                const isKg = ((item as any).unidade === 'kg' || 
                             (item as any).unidade === 'KG' ||
                             norm.includes('kg') || 
                             norm.includes('quilo') || 
                             norm.includes('kilo') ||
                             norm.includes('cafe em grao') ||
                             norm.includes('café em grão') ||
                             norm.includes('outros kg') ||
                             norm.includes('gouda')) &&
                             !norm.includes('frutas congeladas');
                const formattedQty = isKg ? item.estoqueAtual.toFixed(2) : Math.round(item.estoqueAtual).toString();
                const barQty = Math.max(0, item.estoqueAtual);
                return (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{formatProductName(item.produto)}</p>
                      <p className="text-xs text-slate-500">{formattedQty} {isKg ? 'KG' : 'unidades'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">{formatCurrency(item.valorTotal)}</p>
                      <div className={cn(
                        "w-20 h-1.5 rounded-full bg-slate-200 mt-1 overflow-hidden"
                      )}>
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            item.estoqueAtual < 10 ? "bg-rose-500" : "bg-emerald-500"
                          )} 
                          style={{ width: `${Math.min(100, (barQty / 50) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Seção de Desperdício e Reuso (Final do Quadro) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Perdas Operacionais</h4>
                <p className="text-sm text-slate-500 italic">Descartes e Reusos ({wasteRecords.length})</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="flex flex-col">
                 <span className="text-sm font-bold text-slate-500 italic text-rose-600">Total Descarte</span>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Venda: {formatCurrency(wasteStats.descarteValue)}</span>
                 <span className="text-[11px] font-semibold text-slate-600 mt-0.5">Custo: {formatCurrency(wasteStats.descarteCost)}</span>
               </div>
               <span className="text-xl font-black text-slate-900">
                 {Math.floor(wasteStats.descarteQty)} un
               </span>
             </div>
             <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="flex flex-col">
                 <span className="text-sm font-bold text-slate-500 italic text-emerald-600">Total Reuso</span>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Venda: {formatCurrency(wasteStats.reusoValue)}</span>
                 <span className="text-[11px] font-semibold text-slate-600 mt-0.5">Custo: {formatCurrency(wasteStats.reusoCost)}</span>
               </div>
               <span className="text-xl font-black text-slate-900">
                 {Math.floor(wasteStats.reusoQty)} un
               </span>
             </div>
              <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Perdas (Custo)</span>
                  <span className="text-sm font-bold text-slate-500 italic lowercase">{Math.floor(wasteStats.descarteQty + wasteStats.reusoQty)} produtos registrados</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-slate-900 block">{formatCurrency(wasteStats.descarteCost + wasteStats.reusoCost)}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Venda: {formatCurrency(wasteStats.descarteValue + wasteStats.reusoValue)}</span>
                </div>
              </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-slate-900 p-8 rounded-3xl shadow-xl shadow-slate-900/20 text-white"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-xl">
                <CreditCard className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xl font-bold uppercase tracking-tight">Financeiro Equipe</h4>
                <p className="text-sm text-slate-400 italic">Saldos de Consumo Pendentes</p>
              </div>
            </div>
            <div className="text-right">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Geral</p>
               <p className="text-xl font-black text-emerald-400 font-mono tracking-tighter">{formatCurrency(totalPendingBalance)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {staffBalances.map((staff, i) => (
              <div key={i} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-800 flex justify-between items-center transition-all hover:bg-slate-800">
                <span className="text-xs font-black uppercase tracking-tight text-slate-300">{staff.name}</span>
                <span className={cn(
                  "font-black font-mono text-sm",
                  staff.balance > 0 ? "text-rose-400" : "text-emerald-400"
                )}>{formatCurrency(staff.balance)}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-8 flex justify-center">
             <div className="px-4 py-2 bg-white/5 rounded-full border border-white/5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dados do Banco Sincronizados</span>
             </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
