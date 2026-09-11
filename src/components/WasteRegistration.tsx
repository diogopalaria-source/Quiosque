import React from 'react';
import { 
  Calendar, 
  Package, 
  User, 
  RefreshCw, 
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Coffee,
  Trash2,
  Edit,
  CreditCard,
  History,
  DollarSign,
  Briefcase,
  Download,
  Search,
  FileText,
  Layers,
  ShoppingBag,
  Tag,
  TrendingDown,
  ShoppingCart,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAction } from '../lib/logs';
import { WasteRecord, StaffConsumption, StaffPayment, Sale, StockItem, Recipe, Purchase, MACRO_INGREDIENTS, StaffDiscountOverride } from '../types';
import { cn, formatCurrency, getMacroForProduct } from '../lib/utils';
import { SearchableSelect } from './SearchableSelect';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const parseWasteDate = (d: string): Date => {
  if (!d) return new Date();
  const trimmed = d.trim();
  if (trimmed.includes('-')) {
    const parsed = new Date(trimmed + 'T00:00:00'); // YYYY-MM-DD
    if (!isNaN(parsed.getTime())) return parsed;
  }
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    let year = Number(parts[2]);
    if (year < 100) year += 2000;
    const parsed = new Date(year, month - 1, day);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (parts.length === 2) {
    const month = Number(parts[0]);
    let year = Number(parts[1]);
    if (year < 100) year += 2000;
    const parsed = new Date(year, month - 1, 1);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  const fallback = new Date(trimmed);
  if (isNaN(fallback.getTime())) return new Date();
  return fallback;
};

const formatWasteDate = (d: string, formatStr: string = 'dd/MM/yyyy'): string => {
  try {
    const parsed = parseWasteDate(d);
    return format(parsed, formatStr);
  } catch (err) {
    console.error('Failed to format date:', d, err);
    return d || '';
  }
};

const ALL_RESPONSABLES = ['Ariane', 'Barbara', 'Alexandre', 'Breno', 'Keila', 'Diogo', 'Free Lancer', 'Kenji', 'Nathan', 'Alicia'];
const CONSUMPTION_RESPONSABLES = ['Ariane', 'Barbara', 'Breno', 'Diogo', 'Free Lancer', 'Nathan', 'Alicia'];
const PAYMENT_RESPONSABLES = ['Ariane', 'Barbara', 'Alexandre', 'Breno', 'Keila', 'Diogo', 'Free Lancer', 'Kenji', 'Nathan', 'Alicia'];
const RESPONSABLES = ALL_RESPONSABLES;
export const normalizeStaffName = (name?: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.toLowerCase() === 'natan') return 'Nathan';
  return trimmed;
};
const ACTIONS = ['Reuso', 'Descarte'] as const;
const REASONS = ['café', 'qualidade', 'validade', 'vitrine'] as const;

// Initial product list
const INITIAL_WASTE_PRODUCTS = [
  'Cookie Tradicional',
  'Cookie Nutella',
  'Cookie Red Velvet',
  'Leite',
  'Café Grão',
  'Refrigerante Lata',
  'Suco',
  'Salgado'
];

export interface StaffProduct {
  id: string;
  nome: string;
  precoCheio: number;
  descontoPercent: number;
}

// Fixed product list from CSV
export const FIXED_STAFF_PRODUCTS: StaffProduct[] = [
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

const SUB_OPTIONS: Record<string, string[]> = {
  'refrigerante 350ml': ['Coca cola normal', 'Guaraná Normal', 'Guaraná zero', 'Limoneto'],
  'suco natural': ['Laranja', 'Manga', 'Abacaxi', 'Maracujá', 'Morango', 'Frutas Vermelhas', 'Frutas Amarelas'],
  'smoothie de fruta': ['Laranja', 'Manga', 'Abacaxi', 'Maracujá', 'Morango', 'Frutas Vermelhas', 'Frutas Amarelas'],
  'bolo caseiro': ['Milho', 'Coco', 'Banana e Canela', 'Laranja', 'Cenoura', 'Chocolate'],
  'tortas da bottega': ['Frango', 'Palmito', 'Mista'],
  'pastel assado': ['Frango', 'Carne Seca']
};

export const ALIASMAP: Record<string, string> = {
  // Cookies
  'cookie brownie': 'Brownie cookie',
  'brownie': 'Brownie cookie',
  'cookie duplo': 'Cookie double chocolate',
  'duplo': 'Cookie double chocolate',
  'cookie m&ms': 'Cookie chocolate chips with m&ms',
  'cookie m&m': 'Cookie chocolate chips with m&ms',
  'coomie m&ms': 'Cookie chocolate chips with m&ms',
  'coomie m&m': 'Cookie chocolate chips with m&ms',
  'm&ms': 'Cookie chocolate chips with m&ms',
  'm&m': 'Cookie chocolate chips with m&ms',
  'cookie macadamia': 'Cookie chocolate chips com macadâmia',
  'macadamia': 'Cookie chocolate chips com macadâmia',
  'cookie triplo': 'Cookie triple chocolate',
  'triplo': 'Cookie triple chocolate',
  'cookie branco': 'Cookie chocolate branco (white)',
  'branco': 'Cookie chocolate branco (white)',
  'cookie tradicional': 'Cookie chocolate chips',
  'tradicional': 'Cookie chocolate chips',
  
  // Tortas / Bottega
  'torta de palmito': 'Tortas da bottega',
  'bottega palmito': 'Tortas da bottega',
  'torta palmito': 'Tortas da bottega',
  'torta de frango': 'Tortas da bottega',
  'bottega frango': 'Tortas da bottega',
  'torta frango': 'Tortas da bottega',
  'torta mista': 'Tortas da bottega',
  'bottega mista': 'Tortas da bottega',
  
  // Croissants
  'croissant': 'Croissant tradicional',
  'croissant de presunto': 'Croissant presunto e queijo',
  'croissant presunto': 'Croissant presunto e queijo',
  'croissant caprese': 'Croissant caprese',
  
  // Cinnamon
  'cinnamon roll': 'Novo cinnamon roll tradicional',
  'cinnamon': 'Novo cinnamon roll tradicional',
  
  // Pao de queijo
  'pao de queijo': 'Pão de queijo Gouda (3 unid.)',
  'pao queijo': 'Pão de queijo Gouda (3 unid.)',
  'pão de queijo': 'Pão de queijo Gouda (3 unid.)',
  
  // Others
  'carne suculenta': 'Pão com carne suculenta',
  'pão suculento': 'Pão com carne suculenta',
  'bolo caseiro': 'Bolo caseiro',
  'refrigerante': 'Refrigerante 350ml',
  'suco': 'Suco natural',
  'espresso': 'Espresso origens pequeno'
};

export const findWasteProduct = (productName: string) => {
  const normalized = productName.toLowerCase().trim();
  
  // Try mapping via explicit translation / alias dictionary first
  if (normalized === 'carne suculenta' || normalized.includes('carne suculenta')) {
    return FIXED_STAFF_PRODUCTS.find(p => p.nome === 'Pão com carne suculenta') || null;
  }

  // Check aliases directly first (exact alias key, or key contained in the text, or text contained in alias key)
  const aliasMatchKey = Object.keys(ALIASMAP).find(k => k === normalized || normalized.startsWith(k) || k.startsWith(normalized));
  if (aliasMatchKey) {
    const mappedName = ALIASMAP[aliasMatchKey];
    const product = FIXED_STAFF_PRODUCTS.find(p => p.nome.toLowerCase() === mappedName.toLowerCase());
    if (product) return product;
  }

  // Exact match with FIXED_STAFF_PRODUCTS
  let product = FIXED_STAFF_PRODUCTS.find(p => p.nome.toLowerCase() === normalized);
  if (product) return product;

  // Prefix match
  product = FIXED_STAFF_PRODUCTS.find(p => normalized.startsWith(p.nome.toLowerCase()));
  if (product) return product;

  // Postfix/Infix match: is any product name contained inside the normalized name?
  product = FIXED_STAFF_PRODUCTS.find(p => normalized.includes(p.nome.toLowerCase()));
  if (product) return product;

  return null;
};

const normalizeToYYYYMMDD = (dStr: string) => {
  if (!dStr) return '';
  if (dStr.includes('-')) return dStr.split('T')[0];
  const parts = dStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dStr;
};

const getMonthForRecord = (c: any) => {
  if (c.mes && /^\d{2}\/\d{4}$/.test(c.mes)) {
    return c.mes;
  }
  if (c.data) {
    const norm = normalizeToYYYYMMDD(c.data);
    const parts = norm.split('-');
    if (parts.length >= 2) {
      return `${parts[1]}/${parts[0]}`;
    }
  }
  return '';
};

interface WasteRegistrationProps {
  userId: string;
  onBack: () => void;
  wasteRecords: WasteRecord[];
  staffConsumptions: StaffConsumption[];
  staffPayments: StaffPayment[];
  userRole: string;
  initialMode?: Mode;
  salesData?: Sale[];
  stockData?: StockItem[];
  recipes?: Recipe[];
  purchasesData?: Purchase[];
  staffDiscountOverrides?: StaffDiscountOverride[];
  selectedMonths?: string[];
}

type Mode = 'waste' | 'consumption' | 'payments';

export const WasteRegistration: React.FC<WasteRegistrationProps> = ({ 
  userId, 
  onBack, 
  wasteRecords,
  staffConsumptions,
  staffPayments,
  userRole,
  initialMode = 'waste',
  salesData = [],
  stockData = [],
  recipes = [],
  purchasesData = [],
  staffDiscountOverrides = [],
  selectedMonths = []
}) => {
  const [activeMode, setActiveMode] = React.useState<Mode>(initialMode);
  const [statementFilter, setStatementFilter] = React.useState<'all' | 'consumption' | 'payment'>('all');
  const [paymentsFilter, setPaymentsFilter] = React.useState<'all' | 'debit' | 'credit'>('all');

  // Fixed staff products from CSV list
  const staffProductsData = FIXED_STAFF_PRODUCTS;

  const getProductDiscount = React.useCallback((productId: string, defaultDiscount: number) => {
    const override = staffDiscountOverrides.find(o => o.productId === productId);
    return override ? override.descontoPercent : defaultDiscount;
  }, [staffDiscountOverrides]);

  const applyDeductionToStock = async (items: Array<{ produto: string; quantidade: number }>) => {
    const stockPath = `users/shared_franquia_data/stock`;
    const batch = writeBatch(db);
    let techUpdates = 0;

    // Use a mutable copy of stockData to correctly accumulate consecutive deductions in the same call
    const stockCopy = stockData.map(s => ({ ...s }));

    for (const item of items) {
      const rawProductName = (item.produto || '').trim();
      const fullProductName = rawProductName.split(' (Qtd:')[0].split(' [Dividido entre:')[0].trim();
      const quantity = Number(item.quantidade) || 1;

      // Improved recipe matching template
      const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === fullProductName.toLowerCase()) ||
                     recipes.find(r => fullProductName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));

      if (recipe) {
        for (const ingredient of recipe.ingredientes) {
          const stockDoc = stockCopy.find(s => {
            const stockMacro = getMacroForProduct(s.produto);
            const ingMacro = getMacroForProduct(ingredient.macroIngredient);
            return stockMacro === ingMacro || s.produto === ingredient.macroIngredient;
          }) as any;
          if (stockDoc && stockDoc.id) {
            const totalDeduction = ingredient.quantidade * quantity;
            const newQty = (Number(stockDoc.estoqueAtual) || 0) - totalDeduction;
            const docRef = doc(db, stockPath, stockDoc.id);
            batch.update(docRef, { 
              estoqueAtual: newQty,
              valorTotal: newQty * (Number(stockDoc.custoUnitario) || 0)
            });
            techUpdates++;
            stockDoc.estoqueAtual = newQty;
          }
        }
      } else {
        const macroToDeduct = getMacroForProduct(fullProductName);
        if (macroToDeduct) {
          const stockDoc = stockCopy.find(s => {
            const stockMacro = getMacroForProduct(s.produto);
            return stockMacro === macroToDeduct || s.produto === macroToDeduct;
          }) as any;
          if (stockDoc && stockDoc.id) {
            const newQty = (Number(stockDoc.estoqueAtual) || 0) - quantity;
            const docRef = doc(db, stockPath, stockDoc.id);
            batch.update(docRef, { 
              estoqueAtual: newQty,
              valorTotal: newQty * (Number(stockDoc.custoUnitario) || 0)
            });
            techUpdates++;
            stockDoc.estoqueAtual = newQty;
          }
        }
      }
    }

    if (techUpdates > 0) {
      await batch.commit();
      console.log(`[Real-time Stock] Decremented stock: ${techUpdates} updates committed.`);
    }
  };

  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Search states for products
  const [productSearch, setProductSearch] = React.useState('');
  const [showProductList, setShowProductList] = React.useState(false);
  const [wasteProductSearch, setWasteProductSearch] = React.useState('');
  const [showWasteProductList, setShowWasteProductList] = React.useState(false);

  const productListRef = React.useRef<HTMLDivElement>(null);
  const wasteListRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productListRef.current && !productListRef.current.contains(event.target as Node)) {
        setShowProductList(false);
      }
      if (wasteListRef.current && !wasteListRef.current.contains(event.target as Node)) {
        setShowWasteProductList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Waste Form State
  const [wasteForm, setWasteForm] = React.useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    produto: '',
    subOpcao: '',
    quantidade: '',
    responsavel: '',
    acao: '' as any,
    motivo: '' as any
  });

  // Waste Report State
  const [wasteReportAction, setWasteReportAction] = React.useState<string>('all');
  const [wasteReportStart, setWasteReportStart] = React.useState(format(new Date(), 'yyyy-01-01')); // Default to start of year to show imports
  const [wasteReportEnd, setWasteReportEnd] = React.useState(format(new Date(), 'yyyy-12-31'));

  // Consumption Form State
  const [consumptionForm, setConsumptionForm] = React.useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    funcionario: '',
    produtoId: '',
    subOpcao: '',
    subOpcaoExtra: '',
    quantidade: 1,
    divididoCom: [] as string[]
  });

  // Payment Form State (Admin Only)
  const [paymentForm, setPaymentForm] = React.useState({
    dataDeposito: format(new Date(), 'yyyy-MM-dd'),
    funcionario: '',
    valorPago: '',
    observacao: '',
  });

  const [pdfStartDate, setPdfStartDate] = React.useState('');
  const [pdfEndDate, setPdfEndDate] = React.useState('');
  const [selectedMacroIngredient, setSelectedMacroIngredient] = React.useState('');

  const [editingTx, setEditingTx] = React.useState<any | null>(null);
  const [deletingTx, setDeletingTx] = React.useState<any | null>(null);
  const [editForm, setEditForm] = React.useState<any>({
    data: '',
    funcionario: '',
    produto: '',
    quantidade: 1,
    valorCheio: 0,
    descontoPercent: 0,
    valorPago: 0,
    dataDeposito: '',
    observacao: '',
  });

  const [editingWaste, setEditingWaste] = React.useState<any | null>(null);
  const [deletingWaste, setDeletingWaste] = React.useState<any | null>(null);
  const [editWasteForm, setEditWasteForm] = React.useState<any>({
    data: '',
    produto: '',
    quantidade: 1,
    responsavel: '',
    acao: 'Descarte',
    motivo: '',
  });

  const startEditWaste = (w: any) => {
    setEditingWaste(w);
    setEditWasteForm({
      data: formatWasteDate(w.data, 'yyyy-MM-dd') || '',
      produto: w.produto || '',
      quantidade: Number(w.quantidade || 1),
      responsavel: w.responsavel || '',
      acao: w.acao || 'Descarte',
      motivo: w.motivo || '',
    });
  };

  const startEditTx = (tx: any) => {
    setEditingTx(tx);
    if (tx.type === 'debit') {
      setEditForm({
        data: tx.raw.data || '',
        funcionario: tx.raw.funcionario || '',
        produto: tx.raw.produto || '',
        quantidade: Number(tx.raw.quantidade || 1),
        valorCheio: Number(tx.raw.valorCheio || 0),
        descontoPercent: Number(tx.raw.descontoPercent || 0),
        valorPago: Number(tx.raw.valorPago || 0),
      });
    } else {
      setEditForm({
        dataDeposito: tx.raw.dataDeposito || '',
        funcionario: tx.raw.funcionario || '',
        valorPago: Number(tx.raw.valorPago || 0),
        observacao: tx.raw.observacao || '',
      });
    }
  };

  const handleEditFieldChange = (field: string, val: any) => {
    setEditForm(prev => {
      const updated = { ...prev, [field]: val };
      if (editingTx?.type === 'debit') {
        const qty = field === 'quantidade' ? Number(val) : prev.quantidade;
        const fullVal = field === 'valorCheio' ? Number(val) : prev.valorCheio;
        const disc = field === 'descontoPercent' ? Number(val) : prev.descontoPercent;
        updated.valorPago = Number((fullVal * (1 - disc / 100) * qty).toFixed(2));
      }
      return updated;
    });
  };

  const handleSaveEditedTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    setLoading(true);
    setError(null);
    try {
      if (editingTx.type === 'debit') {
        const updatedRecord = {
          data: editForm.data,
          mes: formatWasteDate(editForm.data, 'MM/yyyy'),
          funcionario: editForm.funcionario,
          produto: editForm.produto,
          quantidade: Number(editForm.quantidade),
          valorCheio: Number(editForm.valorCheio),
          descontoPercent: Number(editForm.descontoPercent),
          valorPago: Number(editForm.valorPago),
        };
        
        const docRef = doc(db, `users/shared_franquia_data/staffConsumption`, editingTx.id);
        await updateDoc(docRef, updatedRecord);
        
        await logAction(
          'Edição',
          'Consumo Equipe',
          `Alterou consumo [ID: ${editingTx.id}] de ${editForm.funcionario}: ${editForm.quantidade}un de ${editForm.produto}`,
          'staffConsumption',
          editingTx.id,
          updatedRecord
        );
      } else {
        const updatedRecord = {
          dataDeposito: editForm.dataDeposito,
          funcionario: editForm.funcionario,
          valorPago: Number(editForm.valorPago),
          observacao: editForm.observacao,
        };
        
        const docRef = doc(db, `users/shared_franquia_data/staffPayments`, editingTx.id);
        await updateDoc(docRef, updatedRecord);
        
        await logAction(
          'Edição',
          'Pagamento Equipe',
          `Alterou pagamento [ID: ${editingTx.id}] de ${editForm.funcionario} para R$ ${editForm.valorPago}`,
          'staffPayments',
          editingTx.id,
          updatedRecord
        );
      }
      
      setEditingTx(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating record:', err);
      setError(`Erro ao atualizar registro: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTx) return;
    setLoading(true);
    setError(null);
    try {
      const isDebit = deletingTx.type === 'debit';
      const collectionPath = isDebit ? 'staffConsumption' : 'staffPayments';
      const docRef = doc(db, `users/shared_franquia_data/${collectionPath}`, deletingTx.id);
      
      await deleteDoc(docRef);
      
      await logAction(
        'Exclusão',
        isDebit ? 'Consumo Equipe' : 'Pagamento Equipe',
        isDebit 
          ? `Excluiu consumo de ${deletingTx.funcionario}: ${deletingTx.description}`
          : `Excluiu pagamento de ${deletingTx.funcionario} no valor de R$ ${deletingTx.value}`,
        collectionPath,
        deletingTx.id,
        deletingTx.raw
      );
      
      setDeletingTx(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error deleting record:', err);
      setError(`Erro ao excluir registro: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const adjustStockForWasteRecord = async (produto: string, deltaQty: number) => {
    if (deltaQty === 0) return;
    const stockPath = `users/shared_franquia_data/stock`;
    const batch = writeBatch(db);
    let techUpdates = 0;
    const stockCopy = stockData.map(s => ({ ...s }));

    const rawProductName = (produto || '').trim();
    const fullProductName = rawProductName.split(' (Qtd:')[0].split(' [Dividido entre:')[0].trim();

    const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === fullProductName.toLowerCase()) ||
                   recipes.find(r => fullProductName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));

    if (recipe) {
      for (const ingredient of recipe.ingredientes) {
        const stockDoc = stockCopy.find(s => {
          const stockMacro = getMacroForProduct(s.produto);
          const ingMacro = getMacroForProduct(ingredient.macroIngredient);
          return stockMacro === ingMacro || s.produto === ingredient.macroIngredient;
        }) as any;
        if (stockDoc && stockDoc.id) {
          const totalAdjustment = ingredient.quantidade * deltaQty;
          const newQty = (Number(stockDoc.estoqueAtual) || 0) + totalAdjustment;
          const docRef = doc(db, stockPath, stockDoc.id);
          batch.update(docRef, { 
            estoqueAtual: newQty,
            valorTotal: newQty * (Number(stockDoc.custoUnitario) || 0)
          });
          techUpdates++;
          stockDoc.estoqueAtual = newQty;
        }
      }
    } else {
      const macroToDeduct = getMacroForProduct(fullProductName);
      if (macroToDeduct) {
        const stockDoc = stockCopy.find(s => {
          const stockMacro = getMacroForProduct(s.produto);
          return stockMacro === macroToDeduct || s.produto === macroToDeduct;
        }) as any;
        if (stockDoc && stockDoc.id) {
          const newQty = (Number(stockDoc.estoqueAtual) || 0) + deltaQty;
          const docRef = doc(db, stockPath, stockDoc.id);
          batch.update(docRef, { 
            estoqueAtual: newQty,
            valorTotal: newQty * (Number(stockDoc.custoUnitario) || 0)
          });
          techUpdates++;
          stockDoc.estoqueAtual = newQty;
        }
      }
    }

    if (techUpdates > 0) {
      await batch.commit();
      console.log(`[Real-time Stock] Adjusted stock by ${deltaQty}: ${techUpdates} updates committed.`);
    }
  };

  const handleSaveEditedWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWaste) return;
    setLoading(true);
    setError(null);
    try {
      const originalRecord = editingWaste;
      const updatedRecord = {
        data: editWasteForm.data,
        mes: formatWasteDate(editWasteForm.data, 'MM/yyyy'),
        produto: editWasteForm.produto,
        quantidade: Math.floor(Number(editWasteForm.quantidade)),
        responsavel: editWasteForm.responsavel,
        acao: editWasteForm.acao,
        motivo: editWasteForm.motivo,
        userId: userId,
        ...(originalRecord.createdAt ? { createdAt: originalRecord.createdAt } : {}),
        updatedAt: serverTimestamp()
      };

      // Revert old stock deduction if old was Descarte
      if (originalRecord.acao === 'Descarte') {
        try {
          await adjustStockForWasteRecord(originalRecord.produto, originalRecord.quantidade);
        } catch (stockErr) {
          console.error('Falha ao reverter estoque antigo:', stockErr);
        }
      }

      // Apply new stock deduction if new is Descarte
      if (updatedRecord.acao === 'Descarte') {
        try {
          await adjustStockForWasteRecord(updatedRecord.produto, -updatedRecord.quantidade);
        } catch (stockErr) {
          console.error('Falha ao aplicar novo estoque:', stockErr);
        }
      }

      const docRef = doc(db, `users/shared_franquia_data/wasteRecords`, originalRecord.id);
      await updateDoc(docRef, updatedRecord);

      await logAction(
        'Edição',
        'Descarte',
        `Alterou descarte [ID: ${originalRecord.id}] de ${updatedRecord.quantidade} un de ${updatedRecord.produto}`,
        'wasteRecords',
        originalRecord.id,
        updatedRecord
      );

      setEditingWaste(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating waste record:', err);
      setError(`Erro ao atualizar registro: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteWaste = async () => {
    if (!deletingWaste) return;
    setLoading(true);
    setError(null);
    try {
      const originalRecord = deletingWaste;

      if (originalRecord.acao === 'Descarte') {
        try {
          await adjustStockForWasteRecord(originalRecord.produto, originalRecord.quantidade);
        } catch (stockErr) {
          console.error('Falha ao reverter estoque do registro excluído:', stockErr);
        }
      }

      const docRef = doc(db, `users/shared_franquia_data/wasteRecords`, originalRecord.id);
      await deleteDoc(docRef);

      await logAction(
        'Exclusão',
        'Descarte',
        `Excluiu descarte de ${originalRecord.quantidade} un de ${originalRecord.produto}`,
        'wasteRecords',
        originalRecord.id,
        originalRecord
      );

      setDeletingWaste(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error deleting waste record:', err);
      setError(`Erro ao excluir registro: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = FIXED_STAFF_PRODUCTS.find(p => p.id === consumptionForm.produtoId);
  const quantidade = Number(consumptionForm.quantidade) || 1;
  const numParticipantes = 1 + consumptionForm.divididoCom.length;
  
  const unitValorCheio = selectedProduct ? selectedProduct.precoCheio : 0;
  const unitValorPago = selectedProduct 
    ? selectedProduct.precoCheio * (1 - getProductDiscount(selectedProduct.id, selectedProduct.descontoPercent) / 100)
    : 0;

  const totalValorCheio = unitValorCheio * quantidade;
  const totalValorPago = unitValorPago * quantidade;

  const individualValorCheio = totalValorCheio / numParticipantes;
  const individualValorPago = totalValorPago / numParticipantes;

  const subOptionsForSelected = selectedProduct ? SUB_OPTIONS[selectedProduct.nome.toLowerCase()] : [];

  const handleWasteReport = () => {
    if (!wasteReportStart || !wasteReportEnd) {
      setError('Por favor, selecione as datas para o relatório de desperdício.');
      return;
    }

    const doc = new jsPDF();
    const title = wasteReportAction === 'all' 
      ? 'Relatório de Desperdício e Reuso' 
      : wasteReportAction === 'Descarte' 
        ? 'Relatório de Desperdício' 
        : `Relatório de ${wasteReportAction}`;
    
    doc.setFontSize(20);
    doc.text(title, 14, 22);
    doc.setFontSize(10);
    doc.text(`Período: ${formatWasteDate(wasteReportStart, 'dd/MM/yyyy')} até ${formatWasteDate(wasteReportEnd, 'dd/MM/yyyy')}`, 14, 30);

    const normalizeDateForFilter = (d: string) => {
      if (d && d.includes('/') && d.split('/').length === 3) {
        const [dd, mm, yy] = d.split('/');
        return `${yy.padStart(4, '20')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
      return d;
    };

    const filteredRecords = (wasteRecords || [])
      .filter(w => {
        const recordDateFormatted = normalizeDateForFilter(w.data);
        const matchesAction = wasteReportAction === 'all' || w.acao === wasteReportAction;
        const isWithinRange = recordDateFormatted >= wasteReportStart && recordDateFormatted <= wasteReportEnd;
        return matchesAction && isWithinRange;
      })
      .sort((a, b) => normalizeDateForFilter(b.data).localeCompare(normalizeDateForFilter(a.data)));

    const tableData = filteredRecords.map(item => {
      const product = findWasteProduct(item.produto);
      const unitPrice = product ? product.precoCheio : 0;
      const totalPrice = unitPrice * item.quantidade;

      return [
        formatWasteDate(item.data, 'dd/MM/yyyy'),
        item.produto,
        item.acao === 'Descarte' ? 'Desperdício' : item.acao,
        item.motivo,
        item.quantidade,
        formatCurrency(totalPrice)
      ];
    });

    const totalValue = filteredRecords.reduce((acc, item) => {
      const product = findWasteProduct(item.produto);
      const unitPrice = product ? product.precoCheio : 0;
      return acc + (unitPrice * item.quantidade);
    }, 0);

    autoTable(doc, {
      startY: 40,
      head: [['Data', 'Produto', 'Ação', 'Motivo', 'Qtd', 'Valor Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: '#e11d48', textColor: '#ffffff' },
      foot: [['', '', '', 'TOTAL', '', formatCurrency(totalValue)]],
      footStyles: { fillColor: '#f8fafc', textColor: '#0f172a', fontStyle: 'bold' }
    });

    doc.save(`relatorio_desperdicio_${wasteReportStart}_${wasteReportEnd}.pdf`);
  };

  const handleWasteReportCSV = () => {
    const normalizeDateForFilter = (d: string) => {
      if (d && d.includes('/') && d.split('/').length === 3) {
        const [dd, mm, yy] = d.split('/');
        return `${yy.padStart(4, '20')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
      return d;
    };

    const recordsToExport = (wasteRecords || [])
      .filter(w => {
        const recordDateFormatted = normalizeDateForFilter(w.data);
        const matchesAction = wasteReportAction === 'all' || w.acao === wasteReportAction;
        const isWithinRange = (!wasteReportStart || recordDateFormatted >= wasteReportStart) && (!wasteReportEnd || recordDateFormatted <= wasteReportEnd);
        return matchesAction && isWithinRange;
      })
      .sort((a, b) => normalizeDateForFilter(b.data).localeCompare(normalizeDateForFilter(a.data)));

    if (recordsToExport.length === 0) {
      alert("Nenhum registro encontrado para exportar com os filtros atuais.");
      return;
    }

    const headers = ['Data', 'Produto', 'Quantidade', 'Responsável', 'Ação', 'Motivo'];
    const csvRows = [headers.join(';')];

    recordsToExport.forEach(item => {
      const row = [
        item.data || '',
        item.produto || '',
        item.quantidade || 0,
        item.responsavel || '',
        item.acao === 'Descarte' ? 'Descarte' : item.acao,
        item.motivo || ''
      ];
      const escapedRow = row.map(v => {
        const str = String(v).replace(/"/g, '""');
        if (str.includes(';') || str.includes('\n') || str.includes('"')) {
          return `"${str}"`;
        }
        return str;
      });
      csvRows.push(escapedRow.join(';'));
    });

    const csvContent = "\uFEFF" + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `painel_desperdicios_reuso_${wasteReportStart || 'inicio'}_${wasteReportEnd || 'fim'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteForm.produto || !wasteForm.quantidade || !wasteForm.responsavel || !wasteForm.acao || !wasteForm.motivo) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (SUB_OPTIONS[wasteForm.produto.toLowerCase()] && !wasteForm.subOpcao) {
      setError('Por favor, selecione uma opção para o produto.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const finalProductName = wasteForm.subOpcao 
        ? `${wasteForm.produto} (${wasteForm.subOpcao})` 
        : wasteForm.produto;

      const { subOpcao, ...wasteDataForRecord } = wasteForm;
      const record = {
        ...wasteDataForRecord,
        mes: formatWasteDate(wasteForm.data, 'MM/yyyy'),
        produto: finalProductName,
        quantidade: Math.floor(Number(wasteForm.quantidade)),
        userId: userId,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, `users/shared_franquia_data/wasteRecords`), record);
      await logAction('Criação', 'Descarte', `Registrou descarte de ${record.quantidade} un de ${record.produto}`, 'wasteRecords', docRef.id, record);
      
      // Auto-deduct stock for waste with 'Descarte' action
      if (record.acao === 'Descarte') {
        try {
          await applyDeductionToStock([{ produto: record.produto, quantidade: record.quantidade }]);
        } catch (stockErr) {
          console.error('Falha ao auto-deduzir estoque:', stockErr);
        }
      }
      
      setSuccess(true);
      setWasteForm({
        data: format(new Date(), 'yyyy-MM-dd'),
        produto: '',
        subOpcao: '',
        quantidade: '',
        responsavel: '',
        acao: '' as any,
        motivo: '' as any
      });
      setWasteProductSearch('');

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError('Erro ao salvar registro.');
    } finally {
      setLoading(false);
    }
  };

  const handleConsumptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumptionForm.funcionario || !consumptionForm.produtoId) {
      setError('Por favor, selecione o funcionário e o produto.');
      return;
    }

    const product = FIXED_STAFF_PRODUCTS.find(p => p.id === consumptionForm.produtoId);
    if (!product) return;

    if (product.nome === 'Kit Lanche') {
      if (!consumptionForm.subOpcao || !consumptionForm.subOpcaoExtra) {
        setError('Por favor, selecione a bebida e o lanche do kit.');
        return;
      }
    } else if (SUB_OPTIONS[product.nome.toLowerCase()] && !consumptionForm.subOpcao) {
      setError('Por favor, selecione uma opção para o produto.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalProductNameBase = '';
      if (product.nome === 'Kit Lanche') {
        finalProductNameBase = `Kit Lanche (Bebida: ${consumptionForm.subOpcao} | Lanche: ${consumptionForm.subOpcaoExtra})`;
      } else {
        finalProductNameBase = consumptionForm.subOpcao 
          ? `${product.nome} (${consumptionForm.subOpcao})` 
          : product.nome;
      }
      
      const quantityStr = quantidade > 1 ? ` (Qtd: ${quantidade})` : '';
      const splitStr = consumptionForm.divididoCom.length > 0 
        ? ` [Dividido entre: ${[consumptionForm.funcionario, ...consumptionForm.divididoCom].join(', ')}]` 
        : '';
      
      const finalProductName = `${finalProductNameBase}${quantityStr}${splitStr}`;

      const participants = [consumptionForm.funcionario, ...consumptionForm.divididoCom];
      
      const promises = participants.map(participant => {
        const record = {
          data: consumptionForm.data,
          mes: formatWasteDate(consumptionForm.data, 'MM/yyyy'),
          funcionario: participant,
          produto: finalProductName,
          quantidade: quantidade,
          valorCheio: individualValorCheio,
          descontoPercent: getProductDiscount(product.id, product.descontoPercent),
          valorPago: individualValorPago,
          status: 'pendente',
          userId: userId,
          createdAt: serverTimestamp()
        };
        return addDoc(collection(db, `users/shared_franquia_data/staffConsumption`), record).then(async (docRef) => {
          await logAction('Criação', 'Consumo Equipe', `Registrou consumo para ${record.funcionario}: ${record.quantidade} un de ${record.produto}`, 'staffConsumption', docRef.id, record);
          return docRef;
        });
      });

      await Promise.all(promises);
      
      // Auto-deduct stock for staff consumption
      try {
        await applyDeductionToStock([{ produto: finalProductNameBase, quantidade: quantidade * participants.length }]);
      } catch (stockErr) {
        console.error('Falha ao auto-deduzir estoque:', stockErr);
      }
      
      setSuccess(true);
      setConsumptionForm({
        data: format(new Date(), 'yyyy-MM-dd'),
        funcionario: '',
        produtoId: '',
        subOpcao: '',
        subOpcaoExtra: '',
        quantidade: 1,
        divididoCom: []
      });
      setProductSearch('');

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError('Erro ao salvar consumo.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.funcionario || !paymentForm.valorPago) {
      setError('Preencha funcionário e valor pago.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const record = {
        dataDeposito: paymentForm.dataDeposito,
        funcionario: paymentForm.funcionario,
        valorPago: Number(paymentForm.valorPago),
        observacao: paymentForm.observacao,
        userId: userId,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, `users/shared_franquia_data/staffPayments`), record);
      await logAction('Criação', 'Pagamento Equipe', `Registrou pagamento para ${record.funcionario} de R$ ${record.valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'staffPayments', docRef.id, record);
      
      setSuccess(true);
      setPaymentForm({
        dataDeposito: format(new Date(), 'yyyy-MM-dd'),
        funcionario: '',
        valorPago: '',
        observacao: '',
      });

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError('Erro ao salvar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const matchesMacroIngredient = (productName: string, selectedMacro: string) => {
    if (!selectedMacro) return true;
    const pNameLower = productName.toLowerCase();
    const macroLower = selectedMacro.toLowerCase();
    
    const cleanName = productName.split(' (Qtd:')[0].split(' [Dividido entre:')[0].trim().toLowerCase();
    const recipe = (recipes || []).find(r => r.produtoFinal.toLowerCase() === cleanName) ||
                   (recipes || []).find(r => cleanName.startsWith(r.produtoFinal.toLowerCase())) ||
                   (recipes || []).find(r => r.produtoFinal.toLowerCase().startsWith(cleanName));
    
    if (recipe && recipe.ingredientes) {
      if (recipe.ingredientes.some(ing => (ing.macroIngredient || '').toLowerCase().trim() === macroLower)) {
        return true;
      }
    }
    
    if (pNameLower.includes(macroLower) || macroLower.includes(pNameLower)) {
      return true;
    }
    
    return false;
  };

  const staffAnalytics = React.useMemo(() => {
    // 1. Calculate ingredient unit costs
    const ingUnitCosts: Record<string, number> = {};
    (MACRO_INGREDIENTS || []).forEach(ing => {
      const stockItem = stockData?.find(sd => getMacroForProduct(sd.produto) === ing);
      ingUnitCosts[ing] = stockItem?.custoUnitario || 0;
    });

    const purchaseSum: Record<string, { total: number, qty: number }> = {};
    (purchasesData || []).forEach(p => {
      const isDesconsiderado = p.desconsiderado === true || String(p.produto).toLowerCase().trim() === 'desconsiderar';
      if (isDesconsiderado) return;
      const parsedMacro = getMacroForProduct(p.produto);
      if (parsedMacro) {
        if (!purchaseSum[parsedMacro]) {
          purchaseSum[parsedMacro] = { total: 0, qty: 0 };
        }
        purchaseSum[parsedMacro].total += (Number(p.total) || 0);
        purchaseSum[parsedMacro].qty += (Number(p.quantidade) || 0);
      }
    });

    Object.entries(purchaseSum).forEach(([macro, data]) => {
      if (data.qty > 0) {
        ingUnitCosts[macro] = data.total / data.qty;
      }
    });

    // 2. Filter consumptions
    const filteredConsumptions = (staffConsumptions || []).filter(c => {
      // Employee filter
      if (consumptionForm.funcionario && normalizeStaffName(c.funcionario) !== normalizeStaffName(consumptionForm.funcionario)) {
        return false;
      }
      // Macro ingredient filter
      if (!matchesMacroIngredient(c.produto, selectedMacroIngredient)) {
        return false;
      }
      // Date filter
      const dCompare = normalizeToYYYYMMDD(c.data);
      if (pdfStartDate && dCompare < pdfStartDate) return false;
      if (pdfEndDate && dCompare > pdfEndDate) return false;

      // Selected Months filter
      if (selectedMonths && selectedMonths.length > 0 && !pdfStartDate && !pdfEndDate) {
        const m = c.mes || getMonthForRecord(c);
        if (!m || !selectedMonths.includes(m)) {
          return false;
        }
      }

      return true;
    });

    // 3. Compute sums
    let totalComDesconto = 0; // valor pago
    let totalSemDesconto = 0; // valor cheio
    let totalCustoCompra = 0;

    filteredConsumptions.forEach(c => {
      const pago = Number(c.valorPago) || 0;
      let cheio = Number(c.valorCheio) || 0;
      if (cheio === 0 && pago > 0) {
        const descPercent = Number(c.descontoPercent) || 0;
        if (descPercent < 100) {
          cheio = pago / (1 - descPercent / 100);
        } else {
          cheio = pago;
        }
      }
      totalComDesconto += pago;
      totalSemDesconto += cheio;

      // Purchase cost
      const rawProductName = (c.produto || '').trim();
      const productName = rawProductName.split(' (Qtd:')[0].split(' [Dividido entre:')[0].trim();
      const resolvedProduct = findWasteProduct(productName);
      const standardName = resolvedProduct ? resolvedProduct.nome : productName;
      const qty = Number(c.quantidade) || 1;

      const recipe = (recipes || []).find(r => r.produtoFinal.toLowerCase() === standardName.toLowerCase()) ||
                     (recipes || []).find(r => standardName.toLowerCase().startsWith(r.produtoFinal.toLowerCase())) ||
                     (recipes || []).find(r => r.produtoFinal.toLowerCase().startsWith(standardName.toLowerCase()));

      let itemCost = 0;
      if (recipe && recipe.ingredientes) {
        recipe.ingredientes.forEach(ing => {
          const ingMacro = getMacroForProduct(ing.macroIngredient);
          const unitCost = ingUnitCosts[ingMacro] || 0;
          itemCost += ing.quantidade * qty * unitCost;
        });
      } else {
        const ingName = getMacroForProduct(standardName);
        if (ingName && (MACRO_INGREDIENTS as readonly string[]).includes(ingName)) {
          const unitCost = ingUnitCosts[ingName] || 0;
          itemCost += qty * unitCost;
        }
      }

      if (itemCost === 0) {
        itemCost = cheio * 0.3;
      }
      totalCustoCompra += itemCost;
    });

    const descontoConcedidoPercent = totalSemDesconto > 0 
      ? ((totalSemDesconto - totalComDesconto) / totalSemDesconto) * 100 
      : 0;

    const custoCompraPercent = totalSemDesconto > 0
      ? (totalCustoCompra / totalSemDesconto) * 100
      : 0;

    const custoCompraPercentOfPaid = totalComDesconto > 0
      ? (totalCustoCompra / totalComDesconto) * 100
      : 0;

    // Differences
    const diffPagoVsVenda = totalComDesconto - totalSemDesconto; // Negative or 0
    const diffPagoVsCusto = totalComDesconto - totalCustoCompra; // Positive if cover cost, negative if subsidizing ingredients too

    return {
      totalComDesconto,
      totalSemDesconto,
      totalCustoCompra,
      descontoConcedidoPercent,
      custoCompraPercent,
      custoCompraPercentOfPaid,
      diffPagoVsVenda,
      diffPagoVsCusto,
      count: filteredConsumptions.length
    };
  }, [
    staffConsumptions, 
    stockData, 
    purchasesData, 
    recipes, 
    consumptionForm.funcionario, 
    selectedMacroIngredient, 
    pdfStartDate, 
    pdfEndDate,
    selectedMonths
  ]);

  const generatePDF = (employeeName: string) => {
    const doc = new jsPDF();
    const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm');
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('EXTRATO DE CONSUMO', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-400
    doc.text(`MR. CHENEY`, 14, 28);
    doc.text(`GERADO EM: ${dateStr}`, 14, 33);

    if (pdfStartDate || pdfEndDate) {
      doc.setFontSize(9);
      const period = `PERÍODO: ${pdfStartDate ? formatWasteDate(pdfStartDate, 'dd/MM/yyyy') : 'INÍCIO'} ATÉ ${pdfEndDate ? formatWasteDate(pdfEndDate, 'dd/MM/yyyy') : 'HOJE'}`;
      doc.text(period, 14, 38);
    }

    if (selectedMacroIngredient) {
      doc.setFontSize(9);
      doc.setTextColor(59, 130, 246); // blue-500
      doc.text(`FILTRO INGREDIENTE: ${selectedMacroIngredient.toUpperCase()}`, 14, pdfStartDate || pdfEndDate ? 43 : 38);
    }
    
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`FUNCIONÁRIO: ${employeeName ? employeeName.toUpperCase() : 'TODOS OS FUNCIONÁRIOS'}`, 14, selectedMacroIngredient ? (pdfStartDate || pdfEndDate ? 50 : 45) : 45);

    // Consolidate data (all-time Consumptions and Payments for history balance)
    const targetEmployee = normalizeStaffName(employeeName);
    const allConsumptions = staffConsumptions
      .filter(c => (!targetEmployee || normalizeStaffName(c.funcionario) === targetEmployee) && 
        matchesMacroIngredient(c.produto, selectedMacroIngredient))
      .map(c => ({
        date: parseWasteDate(c.data),
        rawDate: c.data,
        funcionario: normalizeStaffName(c.funcionario),
        description: c.produto.toUpperCase(),
        fullPrice: c.valorCheio,
        discount: `${c.descontoPercent}%`,
        amount: c.valorPago,
        type: 'consumo',
        qty: c.quantidade || 1
      }));

    const allPayments = selectedMacroIngredient ? [] : staffPayments
      .filter(p => !targetEmployee || normalizeStaffName(p.funcionario) === targetEmployee)
      .map(p => ({
        date: parseWasteDate(p.dataDeposito),
        rawDate: p.dataDeposito,
        funcionario: normalizeStaffName(p.funcionario),
        description: p.observacao ? `PAGAMENTO (${p.observacao.toUpperCase()})` : 'PAGAMENTO / BAIXA',
        fullPrice: 0,
        discount: '-',
        amount: -p.valorPago, // Negative for payments to show impact on balance
        type: 'pagamento',
        qty: 1
      }));

    const allRecords = [...allConsumptions, ...allPayments].sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
      return a.description.localeCompare(b.description);
    });

    const parsedStart = pdfStartDate ? parseWasteDate(pdfStartDate).getTime() : null;
    const parsedEnd = pdfEndDate ? parseWasteDate(pdfEndDate).getTime() : null;

    let runningBalance = 0;
    let initialBalance = 0;

    const historyWithBalances = allRecords.map(item => {
      runningBalance += item.amount;
      return {
        ...item,
        runningBalanceAtThisPoint: runningBalance
      };
    });

    if (parsedStart !== null) {
      const beforePeriod = historyWithBalances.filter(item => item.date.getTime() < parsedStart);
      if (beforePeriod.length > 0) {
        initialBalance = beforePeriod[beforePeriod.length - 1].runningBalanceAtThisPoint;
      }
    }

    const filteredRecords = historyWithBalances.filter(item => {
      const t = item.date.getTime();
      return (parsedStart === null || t >= parsedStart) && (parsedEnd === null || t <= parsedEnd);
    });

    const tableData = [];

    if (pdfStartDate) {
      if (!employeeName) {
        tableData.push([
          '-',
          '-',
          'SALDO ANTERIOR ACUMULADO',
          '-',
          '-',
          '-',
          `R$ ${initialBalance.toFixed(2)}`
        ]);
      } else {
        tableData.push([
          '-',
          'SALDO ANTERIOR ACUMULADO',
          '-',
          '-',
          '-',
          `R$ ${initialBalance.toFixed(2)}`
        ]);
      }
    }

    filteredRecords.forEach(item => {
      const formattedDate = format(item.date, 'dd/MM/yyyy');
      const valMovContent = { 
        content: `R$ ${Math.abs(item.amount).toFixed(2)}`, 
        styles: { textColor: item.type === 'pagamento' ? [5, 150, 105] : [225, 29, 72] } // emerald-600 or rose-600
      };
      const precoCheio = item.fullPrice > 0 ? (item.qty > 1 && !item.description.includes('[DIVIDIDO') ? `${item.qty}x ` : '') + `R$ ${item.fullPrice.toFixed(2)}` : '-';
      
      if (!employeeName) {
        tableData.push([
          formattedDate,
          item.funcionario.toUpperCase(),
          item.description,
          precoCheio,
          item.discount,
          valMovContent,
          `R$ ${item.runningBalanceAtThisPoint.toFixed(2)}`
        ]);
      } else {
        tableData.push([
          formattedDate,
          item.description,
          precoCheio,
          item.discount,
          valMovContent,
          `R$ ${item.runningBalanceAtThisPoint.toFixed(2)}`
        ]);
      }
    });

    const headers = !employeeName 
      ? [['Data', 'Funcionário', 'Descrição', 'Preço Cheio', 'Desconto', 'Valor Mov.', 'Saldo Acum.']]
      : [['Data', 'Descrição', 'Preço Cheio', 'Desconto', 'Valor Mov.', 'Saldo Acum.']];

    autoTable(doc, {
      startY: selectedMacroIngredient ? (pdfStartDate || pdfEndDate ? 60 : 55) : 55,
      head: headers,
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3.5 },
      columnStyles: !employeeName ? {
        3: { halign: 'right' },
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' }
      } : {
        2: { halign: 'right' },
        4: { halign: 'center' },
        3: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Summary box
    const periodConsumo = filteredRecords.filter(r => r.type === 'consumo').reduce((sum, r) => sum + r.amount, 0);
    const periodPago = filteredRecords.filter(r => r.type === 'pagamento').reduce((sum, r) => sum + Math.abs(r.amount), 0);
    const saldoAnterior = initialBalance;
    const finalSaldo = saldoAnterior + periodConsumo - periodPago;

    const hasFilter = !!pdfStartDate;
    const boxHeight = hasFilter ? 43 : 35;

    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(135, finalY, 61, boxHeight, 3, 3, 'F');
    
    let currentY = finalY + 10;
    
    if (hasFilter) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('SALDO ANTERIOR:', 140, currentY);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`R$ ${saldoAnterior.toFixed(2)}`, 190, currentY, { align: 'right' });
      currentY += 8;
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL CONSUMO:', 140, currentY);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`R$ ${periodConsumo.toFixed(2)}`, 190, currentY, { align: 'right' });
    currentY += 8;

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL PAGO:', 140, currentY);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`R$ ${periodPago.toFixed(2)}`, 190, currentY, { align: 'right' });
    currentY += 5;

    doc.setDrawColor(226, 232, 240);
    doc.line(140, currentY, 190, currentY);
    currentY += 7;

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('SALDO DEVEDOR:', 140, currentY);
    doc.setFontSize(10);
    
    if (finalSaldo > 0) {
      doc.setTextColor(225, 29, 72); // rose-600
    } else {
      doc.setTextColor(5, 150, 105); // emerald-600
    }
    
    doc.text(`R$ ${finalSaldo.toFixed(2)}`, 190, currentY, { align: 'right' });
    
    // Date and Signature footer
    const footerY = Math.max(finalY + 60, 260); // Ensure it's near bottom but respects summary
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('DATA: _____________________', 14, footerY);
    doc.text('ASSINATURA: _________________________________', 85, footerY);

    doc.save(`Extrato_${employeeName ? employeeName : 'TODOS'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handleStaffStatementCSV = () => {
    const employeeName = normalizeStaffName(consumptionForm.funcionario);
    
    const allConsumptions = staffConsumptions
      .filter(c => (!employeeName || normalizeStaffName(c.funcionario) === employeeName) && 
        matchesMacroIngredient(c.produto, selectedMacroIngredient))
      .map(c => ({
        data: c.data,
        date: parseWasteDate(c.data),
        funcionario: normalizeStaffName(c.funcionario),
        tipo: 'Consumo',
        detalhe: c.produto,
        valorOriginal: c.valorCheio,
        desconto: `${c.descontoPercent}%`,
        valorMovimentado: c.valorPago,
        type: 'debit'
      }));

    const allPayments = selectedMacroIngredient ? [] : staffPayments
      .filter(p => !employeeName || normalizeStaffName(p.funcionario) === employeeName)
      .map(p => ({
        data: p.dataDeposito,
        date: parseWasteDate(p.dataDeposito),
        funcionario: normalizeStaffName(p.funcionario),
        tipo: 'Pagamento/Baixa',
        detalhe: p.observacao ? `PAGAMENTO - OBS: ${p.observacao}` : 'PAGAMENTO / BAIXA',
        valorOriginal: 0,
        desconto: '-',
        valorMovimentado: -p.valorPago, // Negative for payments
        type: 'credit'
      }));

    const allHistoryRecords = [...allConsumptions, ...allPayments].sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
      return a.detalhe.localeCompare(b.detalhe);
    });

    const parsedStart = pdfStartDate ? parseWasteDate(pdfStartDate).getTime() : null;
    const parsedEnd = pdfEndDate ? parseWasteDate(pdfEndDate).getTime() : null;

    let runningBalance = 0;
    let initialBalance = 0;

    const historyWithBalances = allHistoryRecords.map(item => {
      runningBalance += item.valorMovimentado;
      return {
        ...item,
        saldoAcumulado: runningBalance
      };
    });

    if (parsedStart !== null) {
      const beforePeriod = historyWithBalances.filter(item => item.date.getTime() < parsedStart);
      if (beforePeriod.length > 0) {
        initialBalance = beforePeriod[beforePeriod.length - 1].saldoAcumulado;
      }
    }

    const filteredRecords = historyWithBalances.filter(item => {
      const t = item.date.getTime();
      return (parsedStart === null || t >= parsedStart) && (parsedEnd === null || t <= parsedEnd);
    });

    // In the CSV, we reverse filteredRecords so that the newest ones appear at the top.
    const reversedFiltered = [...filteredRecords].reverse();

    const exportRows = [...reversedFiltered];
    if (pdfStartDate) {
      exportRows.push({
        data: pdfStartDate,
        date: parseWasteDate(pdfStartDate),
        funcionario: employeeName || 'TODOS',
        tipo: 'Saldo Anterior',
        detalhe: 'SALDO ANTERIOR ACUMULADO AO PERÍODO',
        valorOriginal: 0,
        desconto: '-',
        valorMovimentado: 0,
        type: 'credit',
        saldoAcumulado: initialBalance
      });
    }

    if (exportRows.length === 0) {
      alert("Nenhum registro encontrado para exportar com os filtros atuais.");
      return;
    }

    const headers = ['Data', 'Funcionário', 'Tipo', 'Detalhe', 'Valor Original', 'Desconto', 'Valor Movimentado', 'Saldo Acumulado'];
    const csvRows = [headers.join(';')];

    exportRows.forEach(item => {
      const row = [
        item.data || '',
        item.funcionario || '',
        item.tipo || '',
        item.detalhe || '',
        item.valorOriginal ? item.valorOriginal.toFixed(2) : '0.00',
        item.desconto || '-',
        item.valorMovimentado ? item.valorMovimentado.toFixed(2) : '0.00',
        item.saldoAcumulado ? item.saldoAcumulado.toFixed(2) : '0.00'
      ];
      const escapedRow = row.map(v => {
        const str = String(v).replace(/"/g, '""');
        if (str.includes(';') || str.includes('\n') || str.includes('"')) {
          return `"${str}"`;
        }
        return str;
      });
      csvRows.push(escapedRow.join(';'));
    });

    const csvContent = "\uFEFF" + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `extrato_colaboradores_${employeeName ? employeeName : 'todos'}_${pdfStartDate || 'inicio'}_${pdfEndDate || 'fim'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const employeeBalances = React.useMemo(() => {
    const balances: Record<string, number> = {};
    ALL_RESPONSABLES.forEach(name => {
      balances[name] = 0;
    });
    
    (staffConsumptions || []).forEach(c => {
      const name = normalizeStaffName(c.funcionario);
      if (name) {
        balances[name] = (balances[name] || 0) + (c.valorPago || 0);
      }
    });

    (staffPayments || []).forEach(p => {
      const name = normalizeStaffName(p.funcionario);
      if (name) {
        balances[name] = (balances[name] || 0) - (p.valorPago || 0);
      }
    });

    return balances;
  }, [staffConsumptions, staffPayments]);

  const memoizedWasteStats = React.useMemo(() => {
    const rawRecords = wasteRecords || [];
    const records = rawRecords.filter(w => {
      // Normalizada data do registro para YYYY-MM-DD para comparação robusta
      let recordDateFormatted = w.data;
      if (w.data.includes('/') && w.data.split('/').length === 3) {
        const [d, m, y] = w.data.split('/');
        recordDateFormatted = `${y.padStart(4, '20')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return (!wasteReportStart || recordDateFormatted >= wasteReportStart) && (!wasteReportEnd || recordDateFormatted <= wasteReportEnd);
    });
    
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

    // Precompile/index purchases by product name for quick lookup
    const purchasesByProd = new Map<string, Purchase[]>();
    (purchasesData || []).forEach(p => {
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
      const product = findWasteProduct(record.produto);
      const price = product ? product.precoCheio : 0;
      const quantity = record.quantidade || 0;
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

          // Search purchases via indexed match
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
            const stockItem = stockData.find(s => s.produto.toLowerCase() === macroIngredient.toLowerCase());
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

      const stockItem = stockData.find(s => s.produto.toLowerCase() === rawProductName.toLowerCase());
      if (stockItem && stockItem.custoUnitario > 0) {
        return stockItem.custoUnitario * quantity;
      }

      return (price * 0.35) * quantity;
    };

    return records.reduce((acc, record) => {
      const product = findWasteProduct(record.produto);
      const price = product ? product.precoCheio : 0;
      const totalValue = price * record.quantidade;
      const totalCost = getRecordCost(record);

      if (record.acao === 'Reuso') {
        acc.reuseQty += record.quantidade;
        acc.reuseValue += totalValue;
        acc.reuseCost += totalCost;
      } else {
        acc.wasteQty += record.quantidade;
        acc.wasteValue += totalValue;
        acc.wasteCost += totalCost;
      }
      return acc;
    }, { reuseQty: 0, reuseValue: 0, reuseCost: 0, wasteQty: 0, wasteValue: 0, wasteCost: 0 });
  }, [wasteRecords, recipes, purchasesData, stockData, wasteReportStart, wasteReportEnd]);

  const getPendingBalance = (name: string) => {
    return employeeBalances[name] || 0;
  };

  const isAdmin = userRole === 'admin';

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 w-fit rounded-xl transition-colors font-bold text-slate-500 text-xs uppercase tracking-widest"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
              {activeMode === 'waste' ? 'Registro de Operação' : activeMode === 'consumption' ? 'Consumo Equipe' : 'Gestão de Pagamentos'}
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
              {activeMode === 'waste' ? 'Gestão de Operação e Eficiência' : activeMode === 'consumption' ? 'Consumo Equipe' : 'Gestão de Pagamentos'}
            </p>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeMode === 'waste' && (
          <motion.div
            key="waste"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-12"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
                  <Trash2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Desperdício e Reuso</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Acompanhamento de desperdício e reuso</p>
                </div>
              </div>
            </div>

            {/* Dashboard de Acompanhamento (NEW) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(() => {
                const canSeeValues = userRole === 'admin' || userRole === 'viewer';
                return (
                  <>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100 shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4">
                          <RefreshCw className="w-4 h-4" />
                          Acompanhamento Reuso
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-4xl font-black text-emerald-700 font-mono tracking-tighter">
                              {memoizedWasteStats.reuseQty}
                            </div>
                            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Produtos Reutilizados</div>
                          </div>
                          {canSeeValues && (
                            <div className="text-right space-y-1">
                              <div>
                                <div className="text-2xl font-black text-emerald-800 font-mono tracking-tight">
                                  {formatCurrency(memoizedWasteStats.reuseValue)}
                                </div>
                                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Valor de Venda</div>
                              </div>
                              <div className="pt-2 border-t border-emerald-200/50">
                                <div className="text-lg font-black text-emerald-600 font-mono tracking-tight">
                                  {formatCurrency(memoizedWasteStats.reuseCost)}
                                </div>
                                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Custo de Compra</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-rose-50 p-8 rounded-[2.5rem] border border-rose-100 shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mb-4">
                          <Trash2 className="w-4 h-4" />
                          Acompanhamento Desperdício
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-4xl font-black text-rose-700 font-mono tracking-tighter">
                              {memoizedWasteStats.wasteQty}
                            </div>
                            <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-1">Produtos Desperdiçados</div>
                          </div>
                          {canSeeValues && (
                            <div className="text-right space-y-1">
                              <div>
                                <div className="text-2xl font-black text-rose-800 font-mono tracking-tight">
                                  {formatCurrency(memoizedWasteStats.wasteValue)}
                                </div>
                                <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Valor de Venda</div>
                              </div>
                              <div className="pt-2 border-t border-rose-200/50">
                                <div className="text-lg font-black text-rose-600 font-mono tracking-tight">
                                  {formatCurrency(memoizedWasteStats.wasteCost)}
                                </div>
                                <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Custo de Compra</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </>
                );
              })()}
            </div>

            <form onSubmit={handleWasteSubmit} className="space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="relative" ref={wasteListRef}>
                      <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        <Package className="w-3.5 h-3.5" />
                        Item para Registro
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Pesquisar ou digitar produto..."
                          value={wasteProductSearch || wasteForm.produto}
                          onFocus={() => setShowWasteProductList(true)}
                          onChange={(e) => {
                            setWasteProductSearch(e.target.value);
                            setWasteForm({ ...wasteForm, produto: e.target.value });
                            setShowWasteProductList(true);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all pr-12"
                          required
                        />
                        <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        
                        <AnimatePresence>
                          {showWasteProductList && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar overflow-hidden"
                            >
                              <div className="p-2 space-y-1">
                                {FIXED_STAFF_PRODUCTS
                                  .filter(p => p.nome !== 'Kit Lanche' && p.nome.toLowerCase().includes(wasteProductSearch.toLowerCase()))
                                  .map(p => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => {
                                        setWasteForm({ ...wasteForm, produto: p.nome, subOpcao: '' });
                                        setWasteProductSearch(p.nome);
                                        setShowWasteProductList(false);
                                      }}
                                      className="w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-900 font-bold text-sm rounded-xl transition-colors flex items-center justify-between group"
                                    >
                                      <span>{p.nome}</span>
                                      <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-slate-400 transition-colors" />
                                    </button>
                                  ))}
                                {FIXED_STAFF_PRODUCTS.filter(p => p.nome.toLowerCase().includes(wasteProductSearch.toLowerCase())).length === 0 && (
                                  <div className="px-5 py-8 text-center">
                                    <p className="text-slate-400 text-xs font-bold italic mb-2">Produto não encontrado na lista padrão</p>
                                    <p className="text-[10px] text-slate-300 uppercase font-black">Você pode continuar digitando o nome</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
 
                    <AnimatePresence>
                      {wasteForm.produto && SUB_OPTIONS[wasteForm.produto.toLowerCase()] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-6"
                        >
                          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                            <ChevronRight className="w-3.5 h-3.5 text-rose-500" />
                            Selecione a Opção do Produto
                          </label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {SUB_OPTIONS[wasteForm.produto.toLowerCase()].map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setWasteForm({ ...wasteForm, subOpcao: opt })}
                                className={cn(
                                  "p-3 rounded-xl border font-bold text-[9px] uppercase transition-all text-center",
                                  wasteForm.subOpcao === opt 
                                    ? "bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-600/20" 
                                    : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                                )}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
 
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                          <Calendar className="w-3.5 h-3.5" />
                          Data
                        </label>
                        <input 
                          type="date"
                          value={wasteForm.data}
                          onChange={(e) => setWasteForm({ ...wasteForm, data: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Quantidade
                        </label>
                        <input 
                          type="number"
                          placeholder="Ex: 5"
                          value={wasteForm.quantidade}
                          onChange={(e) => setWasteForm({ ...wasteForm, quantidade: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-slate-900 font-black focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all text-xl"
                          required
                        />
                      </div>
                    </div>
                  </div>
 
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Ação</label>
                        <div className="flex flex-col gap-3">
                          {ACTIONS.map(action => (
                            <button
                              key={action}
                              type="button"
                              onClick={() => setWasteForm({ ...wasteForm, acao: action })}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-2xl border-2 font-black uppercase tracking-widest text-[11px] transition-all",
                                wasteForm.acao === action 
                                  ? (action === 'Reuso' ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-rose-50 border-rose-500 text-rose-600 shadow-md")
                                  : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                              )}
                            >
                              <span>{action === 'Descarte' ? 'Desperdício' : action}</span>
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Motivo</label>
                        <div className="grid grid-cols-1 gap-2">
                          {REASONS.map(reason => (
                            <button
                              key={reason}
                              type="button"
                              onClick={() => setWasteForm({ ...wasteForm, motivo: reason })}
                              className={cn(
                                "py-3 rounded-xl border-2 font-bold transition-all text-[10px] uppercase",
                                wasteForm.motivo === reason 
                                  ? "bg-slate-900 border-slate-900 text-white" 
                                  : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                              )}
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
 
                    <div className="flex flex-col md:flex-row md:items-end gap-6 pt-4">
                      <div className="flex-1">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                          <User className="w-3.5 h-3.5" />
                          Responsável
                        </label>
                        <select
                          value={wasteForm.responsavel}
                          onChange={(e) => setWasteForm({ ...wasteForm, responsavel: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all cursor-pointer"
                          required
                        >
                          <option value="">Funcionário</option>
                          {CONSUMPTION_RESPONSABLES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-rose-600 text-white h-[66px] px-10 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-rose-600/20 hover:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 whitespace-nowrap"
                      >
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Confirmar Registro"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Visualização do Relatório</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-tight">Registros de perda e reuso no período selecionado</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 ml-2" />
                    <select
                      value={wasteReportAction}
                      onChange={(e) => setWasteReportAction(e.target.value)}
                      className="bg-transparent border-none text-xs font-black uppercase tracking-widest text-slate-900 focus:ring-0 cursor-pointer w-full"
                    >
                      <option value="all">Todos (Desperdício + Reuso)</option>
                      <option value="Descarte">Apenas Desperdício</option>
                      <option value="Reuso">Apenas Reuso</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Início</span>
                      <input 
                        type="date"
                        value={wasteReportStart}
                        onChange={(e) => setWasteReportStart(e.target.value)}
                        className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-900 focus:ring-0 cursor-pointer p-0 px-1"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fim</span>
                      <input 
                        type="date"
                        value={wasteReportEnd}
                        onChange={(e) => setWasteReportEnd(e.target.value)}
                        className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-900 focus:ring-0 cursor-pointer p-0 px-1"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleWasteReport}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-md active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF
                  </button>

                  <button
                    onClick={handleWasteReportCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                    title="Exportar os dados atualmente filtrados nas colunas em formato CSV para validação"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-slate-100">
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic">Data</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic">Produto</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-center">Ação</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic">Motivo</th>
                      <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-center">Qtd</th>
                      {isAdmin && <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-right bg-slate-100/50">Valor Total</th>}
                      {isAdmin && <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-center bg-slate-100/50">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredRecords = (wasteRecords || [])
                        .filter(w => {
                          // Normaliza data do registro para YYYY-MM-DD para comparação robusta
                          let recordDateFormatted = w.data;
                          if (w.data.includes('/') && w.data.split('/').length === 3) {
                            const [d, m, y] = w.data.split('/');
                            recordDateFormatted = `${y.padStart(4, '20')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                          }

                          const matchesAction = wasteReportAction === 'all' || w.acao === wasteReportAction;
                          const isWithinRange = (!wasteReportStart || recordDateFormatted >= wasteReportStart) && (!wasteReportEnd || recordDateFormatted <= wasteReportEnd);
                          return matchesAction && isWithinRange;
                        })
                        .sort((a, b) => {
                          // Sorteia por data (precisa normalizar para comparar strings corretamente)
                          const normalizeForSort = (d: string) => {
                            if (d.includes('/') && d.split('/').length === 3) {
                              const [dd, mm, yy] = d.split('/');
                              return `${yy.padStart(4, '20')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
                            }
                            return d;
                          };
                          return normalizeForSort(b.data).localeCompare(normalizeForSort(a.data));
                        });

                      if (filteredRecords.length === 0) {
                        return (
                          <tr>
                            <td colSpan={isAdmin ? 7 : 5} className="px-5 py-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                              Nenhum registro encontrado para este filtro
                            </td>
                          </tr>
                        );
                      }

                      return filteredRecords.map((item, idx) => {
                        const product = findWasteProduct(item.produto);
                        const unitPrice = product ? product.precoCheio : 0;
                        const totalPrice = unitPrice * item.quantidade;

                        return (
                          <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                            <td className="px-5 py-4 text-xs font-bold text-slate-900 uppercase">
                              {formatWasteDate(item.data, 'dd/MM/yyyy')}
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">{item.produto}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={cn(
                                "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                                item.acao === 'Reuso' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                              )}>
                                {item.acao === 'Descarte' ? 'Desperdício' : item.acao}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-xs font-medium text-slate-500 uppercase">{item.motivo}</td>
                            <td className="px-5 py-4 text-center text-xs font-bold text-slate-900">{item.quantidade}</td>
                            {isAdmin && (
                              <td className="px-5 py-4 text-sm font-bold text-right bg-slate-100/30 text-slate-900 tracking-tight">
                                {formatCurrency(totalPrice)}
                              </td>
                            )}
                            {isAdmin && (
                              <td className="px-5 py-4 text-center bg-slate-100/30">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => startEditWaste(item)}
                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Editar"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingWaste(item)}
                                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeMode === 'consumption' && (
          <motion.div
            key="consumption"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-12"
          >
            <form onSubmit={handleConsumptionSubmit} className="space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div>
                      <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        <User className="w-3.5 h-3.5" />
                        Funcionário
                      </label>
                        <select
                          value={consumptionForm.funcionario}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConsumptionForm({ 
                              ...consumptionForm, 
                              funcionario: val,
                              divididoCom: consumptionForm.divididoCom.filter(f => f !== val)
                            });
                          }}
                          className="w-full bg-white border-2 border-slate-200 rounded-2xl p-5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer shadow-sm"
                          required
                        >
                          <option value="" className="text-slate-900">Selecione o funcionário...</option>
                          {CONSUMPTION_RESPONSABLES.map(r => (
                            <option key={r} value={r} className="text-slate-900">{r}</option>
                          ))}
                        </select>
                    </div>

                    <div className="relative" ref={productListRef}>
                      <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        <Package className="w-3.5 h-3.5" />
                        Produto Consumido
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Qual o produto? Escreva para buscar..."
                          value={productSearch || (selectedProduct?.nome || '')}
                          onFocus={() => setShowProductList(true)}
                          onChange={(e) => {
                            setProductSearch(e.target.value);
                            setShowProductList(true);
                            if (!e.target.value) setConsumptionForm({ ...consumptionForm, produtoId: '' });
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all pr-12"
                          required
                        />
                        <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />

                        <AnimatePresence>
                          {showProductList && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-72 overflow-y-auto custom-scrollbar overflow-hidden"
                            >
                              <div className="p-2 space-y-1">
                                {staffProductsData
                                  .filter(p => !productSearch || p.nome.toLowerCase().includes(productSearch.toLowerCase()))
                                  .map(p => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => {
                                        setConsumptionForm({ ...consumptionForm, produtoId: p.id, subOpcao: '' });
                                        setProductSearch(p.nome);
                                        setShowProductList(false);
                                      }}
                                      className="w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-900 font-bold rounded-xl transition-all group border-b border-slate-50 last:border-0"
                                    >
                                      <div className="flex justify-between items-center">
                                        <div className="flex flex-col">
                                          <span className="text-sm group-hover:text-blue-600 transition-colors uppercase tracking-tight">{p.nome}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400 font-normal line-through">{formatCurrency(p.precoCheio)}</span>
                                            <span className="text-[9px] font-black text-emerald-600 uppercase">{getProductDiscount(p.id, p.descontoPercent)}% OFF</span>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-xs text-blue-600 font-black font-mono">
                                            {formatCurrency(p.precoCheio * (1 - getProductDiscount(p.id, p.descontoPercent) / 100))}
                                          </div>
                                          <div className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Preço Final</div>
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                {staffProductsData.filter(p => p.nome.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                  <div className="px-5 py-10 text-center">
                                    <Coffee className="w-8 h-8 text-slate-100 mx-auto mb-2" />
                                    <p className="text-slate-400 text-xs font-bold italic">Nenhum produto encontrado</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <AnimatePresence>
                      {selectedProduct && (
                        <>
                          {selectedProduct.nome === 'Kit Lanche' ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden space-y-6"
                            >
                              <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                  <Coffee className="w-3.5 h-3.5" />
                                  Escolha a Bebida (Kit Lanche)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  {['Café espresso pequeno', 'Café com leite pequeno', 'Chocolate pequeno'].map(opt => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setConsumptionForm({ ...consumptionForm, subOpcao: opt })}
                                      className={cn(
                                        "p-4 rounded-2xl border font-bold text-[10px] uppercase transition-all text-center",
                                        consumptionForm.subOpcao === opt 
                                          ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                                          : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                                      )}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                  <Package className="w-3.5 h-3.5" />
                                  Escolha o Lanche (Kit Lanche)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  {['Pão de queijo Gouda (3 unids.)', 'Pão na chapa com manteiga', 'Pão na chapa com requeijão'].map(opt => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setConsumptionForm({ ...consumptionForm, subOpcaoExtra: opt })}
                                      className={cn(
                                        "p-4 rounded-2xl border font-bold text-[10px] uppercase transition-all text-center",
                                        consumptionForm.subOpcaoExtra === opt 
                                          ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                                          : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                                      )}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="h-2" />
                            </motion.div>
                          ) : subOptionsForSelected && subOptionsForSelected.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pr-1">
                                <ChevronRight className="w-3.5 h-3.5" />
                                Selecione a Opção
                              </label>
                              <div className="grid grid-cols-2 gap-3">
                                {subOptionsForSelected.map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setConsumptionForm({ ...consumptionForm, subOpcao: opt })}
                                    className={cn(
                                      "p-4 rounded-2xl border font-black uppercase tracking-widest text-[9px] transition-all text-center",
                                      consumptionForm.subOpcao === opt 
                                        ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20" 
                                        : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                                    )}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                              <div className="h-6" />
                            </motion.div>
                          )}
                        </>
                      )}
                    </AnimatePresence>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                          <Package className="w-3.5 h-3.5" />
                          Quantidade
                        </label>
                        <input 
                          type="number"
                          min="1"
                          step="1"
                          value={selectedProduct?.nome === 'Kit Lanche' ? 1 : consumptionForm.quantidade}
                          onChange={(e) => setConsumptionForm({ ...consumptionForm, quantidade: Math.max(1, parseInt(e.target.value) || 1) })}
                          disabled={selectedProduct?.nome === 'Kit Lanche'}
                          className={cn(
                            "w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-slate-900 font-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xl",
                            selectedProduct?.nome === 'Kit Lanche' && "opacity-50 cursor-not-allowed bg-slate-100"
                          )}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                          <Calendar className="w-3.5 h-3.5" />
                          Data do Consumo
                        </label>
                        <input 
                          type="date"
                          value={consumptionForm.data}
                          onChange={(e) => setConsumptionForm({ ...consumptionForm, data: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm h-[66px]"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        <User className="w-3.5 h-3.5" />
                        Dividir com colegas? (Opcional)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {!consumptionForm.funcionario ? (
                          <p className="text-slate-400 text-xs font-bold italic py-1.5 px-1 bg-slate-50 border border-dashed border-slate-200 rounded-xl leading-relaxed w-full">
                            Selecione o funcionário no combo acima para liberar a divisão de consumo.
                          </p>
                        ) : (
                          CONSUMPTION_RESPONSABLES
                            .filter(r => r.trim().toLowerCase() !== consumptionForm.funcionario.trim().toLowerCase())
                            .map(colleague => {
                              const isSelected = consumptionForm.divididoCom.includes(colleague);
                              return (
                                <button
                                  key={colleague}
                                  type="button"
                                  onClick={() => {
                                    if (colleague.trim().toLowerCase() === consumptionForm.funcionario.trim().toLowerCase()) return;
                                    const newDividido = isSelected
                                      ? consumptionForm.divididoCom.filter(c => c !== colleague)
                                      : [...consumptionForm.divididoCom, colleague];
                                    setConsumptionForm({ ...consumptionForm, divididoCom: newDividido });
                                  }}
                                  className={cn(
                                    "px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-tight transition-all",
                                    isSelected 
                                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20" 
                                      : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                                  )}
                                >
                                  {colleague}
                                </button>
                              );
                            })
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <div className="bg-slate-50 p-10 rounded-[2rem] border border-slate-100 text-center relative overflow-hidden">
                       <Coffee className="absolute top-[-20px] right-[-20px] w-40 h-40 text-slate-100 -rotate-12" />
                       
                       <AnimatePresence mode="wait">
                         {selectedProduct ? (
                           <motion.div 
                             initial={{ opacity: 0, scale: 0.9 }}
                             animate={{ opacity: 1, scale: 1 }}
                             exit={{ opacity: 0, scale: 0.9 }}
                             className="relative z-10"
                           >
                             <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Resumo do Consumo</div>
                             <div className="text-2xl font-black text-slate-900 mb-1">
                               {quantidade}x {selectedProduct.nome}
                             </div>
                             {selectedProduct.nome === 'Kit Lanche' && (consumptionForm.subOpcao || consumptionForm.subOpcaoExtra) && (
                               <div className="flex flex-col gap-1 mb-3">
                                 {consumptionForm.subOpcao && <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{consumptionForm.subOpcao}</span>}
                                 {consumptionForm.subOpcaoExtra && <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{consumptionForm.subOpcaoExtra}</span>}
                               </div>
                             )}
                             {selectedProduct.nome !== 'Kit Lanche' && consumptionForm.subOpcao && (
                               <div className="mb-3">
                                 <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{consumptionForm.subOpcao}</span>
                               </div>
                             )}
                             <div className="flex items-center justify-center gap-3 mb-6">
                               <span className="text-slate-400 line-through text-sm font-bold">
                                 {quantidade > 1 ? `${quantidade}x ` : ''}{formatCurrency(selectedProduct.precoCheio)}
                               </span>
                               <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-black">-{getProductDiscount(selectedProduct.id, selectedProduct.descontoPercent)}% OFF</span>
                             </div>
                             
                             <div className="grid grid-cols-1 gap-4 mb-4">
                               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total (c/ desconto)</div>
                                 <div className="text-4xl font-black text-blue-600 font-mono tracking-tighter">{formatCurrency(totalValorPago)}</div>
                               </div>

                               {numParticipantes > 1 && (
                                 <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                                   <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Valor por participante ({numParticipantes})</div>
                                   <div className="text-3xl font-black text-emerald-700 font-mono tracking-tight">{formatCurrency(individualValorPago)}</div>
                                   <p className="text-[8px] text-emerald-500 font-bold uppercase mt-2 italic">Dívida dividida igualmente</p>
                                 </div>
                               )}
                             </div>
                             
                             <p className="text-[10px] text-slate-400 font-bold leading-tight italic">
                               * Este valor será adicionado ao extrato<br />dos colaboradores participantes.
                             </p>
                           </motion.div>
                         ) : (
                           <div className="relative z-10 py-10">
                             <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                             <p className="text-slate-400 font-bold text-sm">Selecione um produto para ver<br />os detalhes do desconto.</p>
                           </div>
                         )}
                       </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-lg shadow-xl shadow-blue-600/20 hover:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Registrar Consumo"}
              </button>
            </form>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Valor Pendente</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-tight">Confira o saldo de cada colaborador</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100 min-w-[200px]">
                    <User className="w-4 h-4 text-slate-400 ml-2" />
                    <select 
                      value={consumptionForm.funcionario}
                      onChange={(e) => setConsumptionForm({ ...consumptionForm, funcionario: e.target.value })}
                      className="bg-transparent border-none text-xs font-black uppercase tracking-widest text-slate-900 focus:ring-0 cursor-pointer w-full"
                    >
                      <option value="">Todos os Funcionários</option>
                      {CONSUMPTION_RESPONSABLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Início</span>
                      <input 
                        type="date"
                        value={pdfStartDate}
                        onChange={(e) => setPdfStartDate(e.target.value)}
                        className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-900 focus:ring-0 cursor-pointer p-0 px-1"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fim</span>
                      <input 
                        type="date"
                        value={pdfEndDate}
                        onChange={(e) => setPdfEndDate(e.target.value)}
                        className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-900 focus:ring-0 cursor-pointer p-0 px-1"
                      />
                    </div>
                  </div>

                  {consumptionForm.funcionario && (
                    <button
                      onClick={(e) => { e.preventDefault(); generatePDF(consumptionForm.funcionario); }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Gerar Extrato PDF
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {CONSUMPTION_RESPONSABLES.filter(name => !consumptionForm.funcionario || name === consumptionForm.funcionario).map(name => {
                  const balance = getPendingBalance(name);
                  return (
                    <div key={name} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-slate-100 text-slate-900 font-bold shadow-sm">
                          {name[0]}
                        </div>
                        <div>
                           <span className="font-black text-slate-900 uppercase text-xs block">{name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight mb-1">Pendente</p>
                        <p className={cn(
                          "font-black text-sm font-mono tracking-tighter",
                          balance > 0 ? "text-rose-600" : "text-emerald-600"
                        )}>
                          {formatCurrency(balance)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {consumptionForm.funcionario && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Extrato Detalhado do Funcionário</h4>
                  
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <button
                      onClick={() => setStatementFilter('consumption')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                        statementFilter === 'consumption' 
                          ? "bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-200" 
                          : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      Ver Consumos
                    </button>
                    <button
                      onClick={() => setStatementFilter('payment')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                        statementFilter === 'payment' 
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200" 
                          : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      Ver Pagamentos
                    </button>
                    <button
                      onClick={() => setStatementFilter('all')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                        statementFilter === 'all' 
                          ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200" 
                          : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      Ver Extrato Completo
                    </button>
                  </div>

                  <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-slate-100">
                          <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic">Data</th>
                          <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic">Detalhe</th>
                          <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-right">Valor Original</th>
                          <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-center">% Desconto</th>
                          <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-right">Valor a Pagar / Pago</th>
                          <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-right bg-slate-100/50">Saldo Acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const targetEmp = normalizeStaffName(consumptionForm.funcionario);
                          // Combine and calculate accumulated balance
                          const txs = [
                            ...staffConsumptions.filter(c => !targetEmp || normalizeStaffName(c.funcionario) === targetEmp).map(c => ({
                              date: c.data,
                              description: c.produto || 'Consumo',
                              original: c.valorCheio,
                              discount: 1 - (c.valorPago / (c.valorCheio || c.valorPago)),
                              value: c.valorPago,
                              type: 'debit' as const,
                              qty: c.quantidade || 1
                            })),
                            ...staffPayments.filter(p => !targetEmp || normalizeStaffName(p.funcionario) === targetEmp).map(p => ({
                              date: p.dataDeposito,
                              description: 'PAGAMENTO / BAIXA',
                              original: 0,
                              discount: 0,
                              value: p.valorPago,
                              type: 'credit' as const
                            }))
                          ].sort((a,b) => b.date.localeCompare(a.date));

                          let runningBalance = 0;
                          // Calculate running balance using OLD TO NEW order first
                          const txsWithBalance = [...txs].sort((a,b) => a.date.localeCompare(b.date)).map((tx) => {
                            runningBalance += (tx.type === 'debit' ? tx.value : -tx.value);
                            return { ...tx, accumulated: runningBalance };
                          });

                          return txsWithBalance
                            .slice()
                            .reverse() // Show newest first in table
                            .filter(tx => {
                              const dateInRange = (!pdfStartDate || tx.date >= pdfStartDate) && (!pdfEndDate || tx.date <= pdfEndDate);
                              if (!dateInRange) return false;
                              
                              if (statementFilter === 'consumption') return tx.type === 'debit';
                              if (statementFilter === 'payment') return tx.type === 'credit';
                              return true;
                            })
                          .map((tx, idx) => (
                            <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                              <td className="px-5 py-4 text-xs font-bold text-slate-900 uppercase">{formatWasteDate(tx.date, 'dd/MM/yyyy')}</td>
                              <td className="px-5 py-4">
                                <span className={cn(
                                  "text-xs font-bold uppercase px-2 py-1 rounded-md",
                                  tx.type === 'credit' ? "bg-emerald-50 text-emerald-600" : "text-slate-900"
                                )}>
                                  {tx.description}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-sm font-bold text-slate-400 text-right">{tx.original ? formatCurrency(tx.original) : '-'}</td>
                              <td className="px-5 py-4 text-center">
                                {tx.discount > 0 ? (
                                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    {(tx.discount * 100).toFixed(0)}%
                                  </span>
                                ) : '-'}
                              </td>
                              <td className={cn(
                                "px-5 py-4 text-sm font-bold text-right tracking-tight",
                                tx.type === 'debit' ? "text-slate-900" : "text-emerald-600 font-bold"
                              )}>
                                {tx.type === 'debit' ? '+' : '-'}{formatCurrency(tx.value)}
                              </td>
                              <td className="px-5 py-4 text-sm font-bold text-right bg-slate-100/30 text-slate-900 tracking-tight">
                                {formatCurrency(tx.accumulated)}
                              </td>
                            </tr>
                          ));
                        })()}
                        {staffConsumptions.filter(c => c.funcionario === consumptionForm.funcionario).length === 0 && 
                         staffPayments.filter(p => p.funcionario === consumptionForm.funcionario).length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-5 py-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhuma transação encontrada</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeMode === 'payments' && (
          <motion.div
            key="payments"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {/* Painel Analítico de Consumo de Funcionários */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6" id="staff-analytics-panel">
              {/* Card 1: Valor Total de Consumo Pago */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consumo Pago/Devido</span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 font-sans tracking-tight">
                    {formatCurrency(staffAnalytics.totalComDesconto)}
                  </h4>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>{staffAnalytics.count} {staffAnalytics.count === 1 ? 'lançamento' : 'lançamentos'} no período</span>
                </div>
              </div>

              {/* Card 2: Valor Total sem Desconto (Preço de Venda Cheio) */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Venda (Cheio)</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                      <Tag className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 font-sans tracking-tight">
                    {formatCurrency(staffAnalytics.totalSemDesconto)}
                  </h4>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 text-[10px] text-amber-600 font-bold uppercase tracking-wider flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Desconto: {staffAnalytics.descontoConcedidoPercent.toFixed(1)}%</span>
                </div>
              </div>

              {/* Card 3: Custo de Compra dos Produtos Consumidos */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custo de Compra (CMV)</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 font-sans tracking-tight">
                    {formatCurrency(staffAnalytics.totalCustoCompra)}
                  </h4>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>Equivale a {staffAnalytics.custoCompraPercentOfPaid.toFixed(1)}% do valor cobrado</span>
                </div>
              </div>

              {/* Card 4: Diferenças / Comparativos */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Análise de Diferença</span>
                    <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                      <Scale className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">vs. Venda Cheia:</span>
                      <span className="text-xs font-black text-rose-600 font-mono">
                        {formatCurrency(staffAnalytics.diffPagoVsVenda)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">vs. Custo Compra:</span>
                      <span className={cn(
                        "text-xs font-black font-mono",
                        staffAnalytics.diffPagoVsCusto >= 0 ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {staffAnalytics.diffPagoVsCusto >= 0 ? '+' : ''}{formatCurrency(staffAnalytics.diffPagoVsCusto)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 text-[9px] text-slate-400 font-medium">
                  {staffAnalytics.diffPagoVsCusto >= 0 
                    ? "Valor pago cobre custo dos ingredientes" 
                    : "Subvenção abaixo do custo de compra!"}
                </div>
              </div>
            </div>

            {/* Top row cards: Consultar Pendências and Registro de Pagamento side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Consultar Pendências (Visible to all) */}
              <div className="lg:col-span-2">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Consultar Pendências</h3>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-tight">Selecione o funcionário para ver detalhes</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border-2 border-slate-200 min-w-[200px]">
                          <User className="w-4 h-4 text-slate-400 ml-2" />
                          <select 
                            value={consumptionForm.funcionario}
                            onChange={(e) => setConsumptionForm({ ...consumptionForm, funcionario: e.target.value })}
                            className="bg-transparent border-none text-sm font-black uppercase tracking-widest text-slate-900 focus:ring-0 cursor-pointer w-full"
                          >
                            <option value="" className="text-slate-900">Todos os Funcionários</option>
                            {PAYMENT_RESPONSABLES.map(r => <option key={r} value={r} className="text-slate-900">{r}</option>)}
                          </select>
                        </div>

                        <div className="min-w-[220px]">
                          <SearchableSelect
                            value={selectedMacroIngredient}
                            onChange={setSelectedMacroIngredient}
                            options={[{ value: '', label: 'Filtrar Macroingrediente', isPriority: true }, ...MACRO_INGREDIENTS]}
                          />
                        </div>

                        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border-2 border-slate-200">
                          <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Início</span>
                             <input 
                              type="date"
                              value={pdfStartDate}
                              onChange={(e) => setPdfStartDate(e.target.value)}
                              className="bg-transparent border-none text-sm font-black uppercase tracking-widest text-slate-900 focus:ring-0 cursor-pointer p-0 px-1"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border-2 border-slate-200">
                          <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fim</span>
                             <input 
                              type="date"
                              value={pdfEndDate}
                              onChange={(e) => setPdfEndDate(e.target.value)}
                              className="bg-transparent border-none text-sm font-black uppercase tracking-widest text-slate-900 focus:ring-0 cursor-pointer p-0 px-1"
                            />
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => generatePDF(consumptionForm.funcionario)}
                              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all h-[42px] shadow-md active:scale-95 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </button>
                            <button
                              onClick={handleStaffStatementCSV}
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all h-[42px] shadow-md active:scale-95 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Planilha CSV
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {PAYMENT_RESPONSABLES.filter(name => !consumptionForm.funcionario || name === consumptionForm.funcionario).map(name => {
                        const balance = getPendingBalance(name);
                        return (
                          <div key={name} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-slate-100 text-slate-900 font-bold shadow-sm">
                                {name[0]}
                              </div>
                              <div>
                                 <span className="font-black text-slate-900 uppercase text-xs block">{name}</span>
                                 <span className="text-[10px] font-bold text-slate-400">Status Financeiro</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Saldo Pendente</p>
                              <p className={cn(
                                "font-black text-lg font-mono tracking-tighter",
                                balance > 0 ? "text-rose-600" : "text-emerald-600"
                              )}>
                                {formatCurrency(balance)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Registro de Pagamento (Admin Only) - Placed side-by-side but NOT sticky as requested */}
              <div className="lg:col-span-1">
                {isAdmin ? (
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl shadow-slate-900/40 text-white border border-white/5 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-800 p-3 rounded-xl border border-white/5">
                            <DollarSign className="w-6 h-6 text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="font-black uppercase tracking-tight text-sm">Baixa</h3>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Recebimento</p>
                          </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Pendente</p>
                           <p className="text-lg font-black text-emerald-400 font-mono tracking-tighter">
                             {formatCurrency(PAYMENT_RESPONSABLES.reduce((total, name) => total + getPendingBalance(name), 0))}
                           </p>
                        </div>
                      </div>

                      <form onSubmit={handlePaymentSubmit} className="space-y-6">
                        <div>
                          <label className="text-[10px] font-black text-emerald-300 uppercase tracking-widest block mb-2">Funcionário</label>
                          <select
                            value={paymentForm.funcionario}
                            onChange={(e) => setPaymentForm({ ...paymentForm, funcionario: e.target.value })}
                            className="w-full bg-white border-2 border-slate-200/20 rounded-2xl p-4 text-slate-900 font-bold focus:ring-2 focus:ring-emerald-400 transition-all cursor-pointer shadow-inner"
                            required
                          >
                            <option value="" className="text-slate-900">Selecione...</option>
                            {PAYMENT_RESPONSABLES.map(r => (
                              <option key={r} value={r} className="text-slate-900">{r}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-emerald-300 uppercase tracking-widest block mb-2">Valor Recebido</label>
                          <input 
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={paymentForm.valorPago}
                            onChange={(e) => setPaymentForm({ ...paymentForm, valorPago: e.target.value })}
                            className="w-full bg-emerald-800 border-none rounded-2xl p-4 text-white font-black focus:ring-2 focus:ring-emerald-400 transition-all text-2xl"
                            required
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-emerald-300 uppercase tracking-widest block mb-2">Data do Depósito</label>
                          <input 
                            type="date"
                            value={paymentForm.dataDeposito}
                            onChange={(e) => setPaymentForm({ ...paymentForm, dataDeposito: e.target.value })}
                            className="w-full bg-emerald-800 border-none rounded-2xl p-4 text-white font-bold focus:ring-2 focus:ring-emerald-400 transition-all"
                            required
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-emerald-300 uppercase tracking-widest block mb-2">Observação (Opcional)</label>
                          <textarea 
                            placeholder="Ex: Pagamento referente a..."
                            value={paymentForm.observacao}
                            onChange={(e) => setPaymentForm({ ...paymentForm, observacao: e.target.value })}
                            className="w-full bg-emerald-800 border-none rounded-2xl p-4 text-white font-medium focus:ring-2 focus:ring-emerald-400 transition-all text-xs resize-none"
                            rows={2}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-emerald-400 text-emerald-950 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-400/20 hover:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
                        >
                          {loading ? <div className="w-5 h-5 border-2 border-emerald-950/30 border-t-emerald-950 rounded-full animate-spin" /> : "Registrar Recebimento"}
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-100 p-8 rounded-[2.5rem] border border-dashed border-slate-300 text-center h-full flex flex-col justify-center">
                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-slate-500 font-black uppercase text-xs tracking-widest mb-2">Acesso Restrito</h3>
                    <p className="text-slate-500 text-xs font-bold leading-relaxed uppercase">
                      Apenas administradores podem registrar<br />a baixa de pagamentos da equipe.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom row: Detailed History (Occupies full space) */}
            {true && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                        {consumptionForm.funcionario ? `Histórico Detalhado de ${consumptionForm.funcionario}` : 'Histórico Detalhado de Todos os Funcionários'}
                      </h3>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-tight">Detalhamento de consumo e baixas de pagamento</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setPaymentsFilter('all')}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border cursor-pointer",
                          paymentsFilter === 'all' 
                            ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200/50" 
                            : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                        )}
                      >
                        Todos
                      </button>
                      <button
                        onClick={() => setPaymentsFilter('debit')}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border cursor-pointer",
                          paymentsFilter === 'debit' 
                            ? "bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-200" 
                            : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                        )}
                      >
                        Consumo (Débitos)
                      </button>
                      <button
                        onClick={() => setPaymentsFilter('credit')}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border cursor-pointer",
                          paymentsFilter === 'credit' 
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200" 
                            : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                        )}
                      >
                        Valores Recebidos (Créditos)
                      </button>
                    </div>
                </div>
                
                <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic">Data</th>
                        <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic">Funcionário</th>
                        <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic">Detalhe</th>
                        <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-right">Valor Original</th>
                        <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-center">% Desconto</th>
                        <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-right">Valor a Pagar / Pago</th>
                        <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-right bg-slate-100/50">Saldo Acumulado</th>
                        {isAdmin && <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight italic text-center">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const parseMyDate = (d: string) => {
                          if (!d) return new Date();
                          if (d.includes('-')) return new Date(d + 'T00:00:00'); // YYYY-MM-DD
                          const [day, month, year] = d.split('/').map(Number);
                          return new Date(year, month - 1, day);
                        };

                        const getMonthForPayment = (p: any) => {
                          if (p.mes && /^\d{2}\/\d{4}$/.test(p.mes)) {
                            return p.mes;
                          }
                          if (p.dataDeposito) {
                            const norm = normalizeToYYYYMMDD(p.dataDeposito);
                            const parts = norm.split('-');
                            if (parts.length >= 2) {
                              return `${parts[1]}/${parts[0]}`;
                            }
                          }
                          return '';
                        };

                        const targetEmp = normalizeStaffName(consumptionForm.funcionario);
                        const txs = [
                          ...staffConsumptions
                            .filter(c => {
                              const matchesEmployee = !targetEmp || normalizeStaffName(c.funcionario) === targetEmp;
                              const matchesMacro = matchesMacroIngredient(c.produto, selectedMacroIngredient);
                              if (!matchesEmployee || !matchesMacro) return false;
                              if (selectedMonths && selectedMonths.length > 0 && !pdfStartDate && !pdfEndDate) {
                                const m = c.mes || getMonthForRecord(c);
                                return m && selectedMonths.includes(m);
                              }
                              return true;
                            })
                            .map(c => ({
                              id: c.id,
                              raw: c,
                              date: c.data,
                              parsedDate: parseMyDate(c.data),
                              funcionario: normalizeStaffName(c.funcionario),
                              description: c.produto || 'Consumo',
                              original: c.valorCheio,
                              discount: 1 - (c.valorPago / (c.valorCheio || c.valorPago)),
                              value: c.valorPago,
                              type: 'debit' as const
                            })),
                          ...(selectedMacroIngredient ? [] : staffPayments
                            .filter(p => {
                              const matchesEmployee = !targetEmp || normalizeStaffName(p.funcionario) === targetEmp;
                              if (!matchesEmployee) return false;
                              if (selectedMonths && selectedMonths.length > 0 && !pdfStartDate && !pdfEndDate) {
                                const m = (p as any).mes || getMonthForPayment(p);
                                return m && selectedMonths.includes(m);
                              }
                              return true;
                            })
                            .map(p => ({
                              id: p.id,
                              raw: p,
                              date: p.dataDeposito,
                              parsedDate: parseMyDate(p.dataDeposito),
                              funcionario: normalizeStaffName(p.funcionario),
                              description: p.observacao 
                                ? `DEPÓSITO IDENTIFICADO [${p.funcionario.toUpperCase()}] - ${p.observacao}` 
                                : `DEPÓSITO IDENTIFICADO [${p.funcionario.toUpperCase()}]`,
                              original: 0,
                              discount: 0,
                              value: p.valorPago,
                              type: 'credit' as const
                            })))
                        ].sort((a,b) => a.parsedDate.getTime() - b.parsedDate.getTime());

                        let runningBalance = 0;
                        const txsWithBalance = txs.map((tx) => {
                          runningBalance += (tx.type === 'debit' ? tx.value : -tx.value);
                          return { ...tx, accumulated: runningBalance };
                        });

                        const filteredTxs = txsWithBalance
                          .slice()
                          .reverse() 
                          .filter(tx => {
                            const dCompare = tx.date;
                            const matchesDate = (!pdfStartDate || dCompare >= pdfStartDate) && (!pdfEndDate || dCompare <= pdfEndDate);
                            const matchesType = paymentsFilter === 'all' || tx.type === paymentsFilter;
                            return matchesDate && matchesType;
                          });

                        if (filteredTxs.length === 0) {
                          return (
                            <tr>
                              <td colSpan={isAdmin ? 8 : 7} className="px-5 py-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest font-sans">Nenhuma transação encontrada</td>
                            </tr>
                          );
                        }

                        return filteredTxs.map((tx, idx) => (
                          <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                            <td className="px-5 py-5 text-sm font-bold text-slate-900 uppercase">
                              {formatWasteDate(tx.date, 'dd/MM/yyyy')}
                            </td>
                            <td className="px-5 py-5 text-xs font-black text-slate-600 uppercase">
                              {tx.funcionario}
                            </td>
                            <td className="px-5 py-5">
                              <span className={cn(
                                "text-sm font-bold uppercase px-3 py-1.5 rounded-lg",
                                tx.type === 'credit' ? "bg-emerald-50 text-emerald-600 font-black" : "text-slate-900 bg-slate-50"
                              )}>
                                {tx.description}
                              </span>
                            </td>
                            <td className="px-5 py-5 text-base font-bold text-slate-400 text-right">{tx.original ? formatCurrency(tx.original) : '-'}</td>
                            <td className="px-5 py-5 text-center">
                              {tx.discount > 0 ? (
                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                  {(tx.discount * 100).toFixed(0)}%
                                </span>
                              ) : '-'}
                            </td>
                            <td className={cn(
                              "px-5 py-5 text-base font-bold text-right tracking-tight",
                              tx.type === 'debit' ? "text-slate-900" : "text-emerald-600 font-bold"
                            )}>
                              {tx.type === 'debit' ? '+' : '-'}{formatCurrency(tx.value)}
                            </td>
                            <td className="px-5 py-5 text-base font-bold text-right bg-slate-100/30 text-slate-900 tracking-tight">
                              {formatCurrency(tx.accumulated)}
                            </td>
                            {isAdmin && (
                              <td className="px-5 py-5 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => startEditTx(tx)}
                                    title="Alterar registro"
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer inline-flex items-center"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingTx(tx)}
                                    title="Excluir registro"
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer inline-flex items-center"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* Custom Modals inside active payments block for complete modular containment */}
            <AnimatePresence>
              {editingTx && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-[2.5rem] max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 p-8"
                  >
                    <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                        <Edit className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Alterar Registro</h3>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                          Ajuste os valores registrados para corrigir erros
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveEditedTx} className="space-y-4">
                      {editingTx.type === 'debit' ? (
                        <>
                          {/* Date */}
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Data</label>
                            <input 
                              type="date"
                              value={editForm.data}
                              onChange={(e) => handleEditFieldChange('data', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 text-sm focus:outline-none"
                              required
                            />
                          </div>

                          {/* Employee */}
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Funcionário</label>
                            <select
                              value={editForm.funcionario}
                              onChange={(e) => handleEditFieldChange('funcionario', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 text-sm focus:outline-none cursor-pointer"
                              required
                            >
                              {Array.from(new Set([...CONSUMPTION_RESPONSABLES, editForm.funcionario])).filter(Boolean).map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>

                          {/* Product Name */}
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Item / Produto</label>
                            <input 
                              type="text"
                              value={editForm.produto}
                              onChange={(e) => handleEditFieldChange('produto', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 text-sm focus:outline-none"
                              required
                            />
                          </div>

                          {/* Quantity & Unit price / full price */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Quantidade</label>
                              <input 
                                type="number"
                                value={editForm.quantidade}
                                onChange={(e) => handleEditFieldChange('quantidade', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 text-sm focus:outline-none"
                                min="1"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Valor Unitário Cheio</label>
                              <input 
                                type="number"
                                step="0.01"
                                value={editForm.valorCheio}
                                onChange={(e) => handleEditFieldChange('valorCheio', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 text-sm focus:outline-none"
                                required
                              />
                            </div>
                          </div>

                          {/* Discount & Final Paid */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Desconto (%)</label>
                              <input 
                                type="number"
                                min="0"
                                max="100"
                                value={editForm.descontoPercent}
                                onChange={(e) => handleEditFieldChange('descontoPercent', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 text-sm focus:outline-none"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Valor a Pagar (Final)</label>
                              <input 
                                type="number"
                                step="0.01"
                                value={editForm.valorPago}
                                onChange={(e) => handleEditFieldChange('valorPago', e.target.value)}
                                className="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-slate-800 font-black text-sm focus:outline-none"
                                required
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Payment/Credit fields */}
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Data do Depósito</label>
                            <input 
                              type="date"
                              value={editForm.dataDeposito}
                              onChange={(e) => setEditForm({ ...editForm, dataDeposito: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 text-sm focus:outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Funcionário</label>
                            <select
                              value={editForm.funcionario}
                              onChange={(e) => setEditForm({ ...editForm, funcionario: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 text-sm focus:outline-none cursor-pointer"
                              required
                            >
                              {Array.from(new Set([...PAYMENT_RESPONSABLES, editForm.funcionario])).filter(Boolean).map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Valor Recebido</label>
                            <input 
                              type="number"
                              step="0.01"
                              value={editForm.valorPago}
                              onChange={(e) => setEditForm({ ...editForm, valorPago: Number(e.target.value) })}
                              className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 font-black text-lg focus:outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Observação</label>
                            <textarea
                              value={editForm.observacao}
                              onChange={(e) => setEditForm({ ...editForm, observacao: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-xs focus:outline-none resize-none"
                              rows={2}
                            />
                          </div>
                        </>
                      )}

                      <div className="flex gap-3 justify-end pt-4">
                        <button
                          type="button"
                          onClick={() => setEditingTx(null)}
                          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-md"
                        >
                          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Salvar Alterações"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {deletingTx && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-[2.5rem] max-w-sm w-full overflow-hidden shadow-2xl border border-slate-100 p-8 text-center"
                  >
                    <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
                      <Trash2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Confirmar Exclusão</h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">
                      Esta ação é definitiva e não pode ser desfeita.
                    </p>

                    <div className="my-6 p-4 bg-slate-50 rounded-2xl text-left border border-slate-100 text-xs font-semibold space-y-1.5">
                      <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-widest">Detalhes do Registro</p>
                      <p className="text-slate-900 font-extrabold"><span className="text-slate-400">Func.:</span> {deletingTx.funcionario}</p>
                      <p className="text-slate-900 font-extrabold"><span className="text-slate-400">Item:</span> {deletingTx.description}</p>
                      <p className="text-slate-900 font-extrabold"><span className="text-slate-400">Valor:</span> {formatCurrency(deletingTx.value)}</p>
                      <p className="text-slate-900 font-extrabold"><span className="text-slate-400">Data:</span> {formatWasteDate(deletingTx.date, 'dd/MM/yyyy')}</p>
                    </div>

                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => setDeletingTx(null)}
                        className="w-1/2 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDelete}
                        disabled={loading}
                        className="w-1/2 p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Confirmar"}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingWaste && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 p-8"
            >
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                  <Edit className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Alterar Registro de Reuso/Descarte</h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                    Ajuste os valores registrados para corrigir erros
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveEditedWaste} className="space-y-4">
                {/* Date */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Data</label>
                  <input 
                    type="date"
                    value={editWasteForm.data}
                    onChange={(e) => setEditWasteForm({ ...editWasteForm, data: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-rose-500 text-sm focus:outline-none"
                    required
                  />
                </div>

                {/* Responsible */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Responsável</label>
                  <select
                    value={editWasteForm.responsavel}
                    onChange={(e) => setEditWasteForm({ ...editWasteForm, responsavel: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-rose-500 text-sm focus:outline-none cursor-pointer"
                    required
                  >
                    <option value="">Selecione o funcionário</option>
                    {Array.from(new Set([...CONSUMPTION_RESPONSABLES, editWasteForm.responsavel])).filter(Boolean).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Product Name */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Item / Produto</label>
                  <input 
                    type="text"
                    value={editWasteForm.produto}
                    onChange={(e) => setEditWasteForm({ ...editWasteForm, produto: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-rose-500 text-sm focus:outline-none"
                    required
                  />
                </div>

                {/* Action & Reason */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Ação</label>
                    <select
                      value={editWasteForm.acao}
                      onChange={(e) => setEditWasteForm({ ...editWasteForm, acao: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-rose-500 text-sm focus:outline-none cursor-pointer"
                      required
                    >
                      <option value="Descarte">Desperdício</option>
                      <option value="Reuso">Reuso</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Motivo</label>
                    <select
                      value={editWasteForm.motivo}
                      onChange={(e) => setEditWasteForm({ ...editWasteForm, motivo: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-rose-500 text-sm focus:outline-none cursor-pointer"
                      required
                    >
                      <option value="">Selecione o motivo</option>
                      {REASONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Quantidade</label>
                  <input 
                    type="number"
                    value={editWasteForm.quantidade}
                    onChange={(e) => setEditWasteForm({ ...editWasteForm, quantidade: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-rose-500 text-sm focus:outline-none"
                    min="1"
                    required
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingWaste(null)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Salvar Alterações"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deletingWaste && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] max-w-sm w-full overflow-hidden shadow-2xl border border-slate-100 p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Confirmar Exclusão</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">
                Esta ação é definitiva e não pode ser desfeita.
              </p>

              <div className="my-6 p-4 bg-slate-50 rounded-2xl text-left border border-slate-100 text-xs font-semibold space-y-1.5">
                <p className="text-slate-400 font-extrabold uppercase text-[9px] tracking-widest">Detalhes do Registro</p>
                <p className="text-slate-900 font-extrabold"><span className="text-slate-400">Responsável:</span> {deletingWaste.responsavel}</p>
                <p className="text-slate-900 font-extrabold"><span className="text-slate-400">Produto:</span> {deletingWaste.produto}</p>
                <p className="text-slate-900 font-extrabold"><span className="text-slate-400">Qtd:</span> {deletingWaste.quantidade}</p>
                <p className="text-slate-900 font-extrabold"><span className="text-slate-400">Ação:</span> {deletingWaste.acao === 'Descarte' ? 'Desperdício' : deletingWaste.acao}</p>
                <p className="text-slate-900 font-extrabold"><span className="text-slate-400">Data:</span> {formatWasteDate(deletingWaste.data, 'dd/MM/yyyy')}</p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeletingWaste(null)}
                  className="w-1/2 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteWaste}
                  disabled={loading}
                  className="w-1/2 p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Confirmar"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-3 mt-6"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-sm font-bold flex items-center gap-3 mt-6"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            Operação realizada com sucesso!
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-12 text-center">
        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-relaxed">
          * Os dados registrados alimentam automaticamente<br />
          o dashboard de gestão estratégica.
        </p>
      </div>
    </div>
  );
};
