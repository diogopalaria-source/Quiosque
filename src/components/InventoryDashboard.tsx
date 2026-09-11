import React, { useMemo, useState, useEffect } from 'react';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Trash2, 
  Users, 
  Calendar,
  Filter,
  BarChart3,
  ArrowRightLeft,
  RefreshCw,
  Upload,
  FileText,
  Check,
  Loader2,
  X,
  Plus,
  Minus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Download,
  HelpCircle,
  Pencil
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  Cell
} from 'recharts';
import { collection, query, getDocs, orderBy, doc, deleteDoc, addDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAction } from '../lib/logs';
import { formatCurrency, cn, getMacroForProduct } from '../lib/utils';
import { SearchableSelect } from './SearchableSelect';
import { Recipe, MACRO_INGREDIENTS } from '../types';
import { findWasteProduct } from './WasteRegistration';

const MONTH_MAP_LOCAL: Record<string, string> = {
  'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
  'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
  'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05',
  'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10',
  'novembro': '11', 'dezembro': '12'
};

const normalizeDayDateLocal = (raw: string): string => {
  if (!raw) return '';
  const pts = raw.split(/[/ -]/).filter(p => p.length > 0);
  if (pts.length >= 2) {
    if (pts[0].length === 4) {
      const y = pts[0];
      const mOriginal = pts[1];
      const mClean = mOriginal.toLowerCase().trim().replace('.', '');
      const m = (MONTH_MAP_LOCAL[mClean] || mOriginal).padStart(2, '0');
      const d = (pts[2] || '01').padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
    let d = pts[0].padStart(2, '0');
    const mOriginal = pts[1];
    const mClean = mOriginal.toLowerCase().trim().replace('.', '');
    let m = (MONTH_MAP_LOCAL[mClean] || mOriginal).padStart(2, '0');
    let y = pts[2] || new Date().getFullYear().toString();
    if (y.length === 2) y = '20' + y;
    return `${d}/${m}/${y}`;
  }
  return raw;
};

interface InventoryDashboardProps {
  dataPath: string;
  salesData?: any[];
  purchasesData?: any[];
  wasteData?: any[];
  staffConsumptionData?: any[];
  stockData?: any[];
  financialData?: any[];
  saveBatch?: (collectionName: string, items: any[]) => Promise<void>;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ 
  dataPath,
  salesData,
  purchasesData,
  wasteData,
  staffConsumptionData,
  stockData,
  financialData,
  saveBatch
}) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [selectedIngredient, setSelectedIngredient] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'6m' | '12m' | 'all'>('6m');
  
  // Tab control inside Inventory
  const [subTab, setSubTab] = useState<'painel' | 'upload'>('painel');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleteStatusMessage, setDeleteStatusMessage] = useState<string | null>(null);

  // States for editing a recorded purchase item
  const [editingPurchase, setEditingPurchase] = useState<any | null>(null);
  const [editingPurchaseFornecedor, setEditingPurchaseFornecedor] = useState('');
  const [editingPurchaseProduto, setEditingPurchaseProduto] = useState('');
  const [editingPurchaseQuantidade, setEditingPurchaseQuantidade] = useState<number>(0);
  const [editingPurchaseCustoUnitario, setEditingPurchaseCustoUnitario] = useState<number>(0);
  const [editingPurchaseUnidade, setEditingPurchaseUnidade] = useState<'un' | 'kg'>('un');
  const [editingPurchaseDesconsiderado, setEditingPurchaseDesconsiderado] = useState(false);
  const [isSavingEditPurchase, setIsSavingEditPurchase] = useState(false);
  const [editPurchaseStatusMessage, setEditPurchaseStatusMessage] = useState<string | null>(null);

  // New expansion and grouping state variables
  const [isAnalyticoExpanded, setIsAnalyticoExpanded] = useState(true);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [isConsumptionDiagnosisExpanded, setIsConsumptionDiagnosisExpanded] = useState(false);
  const [historyGroupBy, setHistoryGroupBy] = useState<'day' | 'supplier'>('day');
  const [historyFilterType, setHistoryFilterType] = useState<string>('all');
  const [expandedHistoryGroups, setExpandedHistoryGroups] = useState<Record<string, boolean>>({});

  const [selectedSupplier, setSelectedSupplier] = useState<string>('Mr. Cheney');

  // Gemini PDF parsing/uploading states
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStage, setParsingStage] = useState('');
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [parseError, setParseError] = useState<string | null>(null);

  // States for interactive consumption mapping diagnostics & adjustments
  const [mappingProduct, setMappingProduct] = useState<string | null>(null);
  const [mappingIngs, setMappingIngs] = useState<any[]>([]);
  const [isEditingExistingMapping, setIsEditingExistingMapping] = useState(false);
  const [existingMappingId, setExistingMappingId] = useState<string | null>(null);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [mappingMessage, setMappingMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // States for adding a custom manual item to the parsed items list
  const [manualItemProduto, setManualItemProduto] = useState('');
  const [manualItemQuantidade, setManualItemQuantidade] = useState<number>(1);
  const [manualItemUnidade, setManualItemUnidade] = useState<'un' | 'kg'>('un');
  const [manualItemValorTotal, setManualItemValorTotal] = useState<number>(0);
  const [manualItemMacro, setManualItemMacro] = useState<string>('');

  // Helper to auto-complete macroingredient based on raw product name
  const detectMacroIngredient = (productName: string): string => {
    const normalized = productName.toLowerCase();
    
    if (normalized.includes('torta bottega') || normalized.includes('bottega')) return 'Tortas Bottega';
    if (normalized.includes('cookie')) return 'Cookie';
    if (normalized.includes('pão de queijo gouda') || normalized.includes('pao de queijo gouda') || normalized.includes('queijo gouda')) return 'Pão de queijo Gouda';
    if (normalized.includes('pão de queijo batata') || normalized.includes('pao de queijo batata')) return 'Pão de queijo Batata Doce';
    if (normalized.includes('pão de queijo para waffle') || normalized.includes('pão de queijo waffle')) return 'Pão de queijo para Waffle';
    if (normalized.includes('brownie')) return 'Brownie';
    if (normalized.includes('cinnamon')) return 'Cinnamon Roll';
    if (normalized.includes('croissant')) return 'Croissant';
    if (normalized.includes('bolo')) return 'Bolo Caseiro';
    if (normalized.includes('refri') || normalized.includes('coca')) {
      if (normalized.includes('220')) return 'Refrigerante 220ml';
      return 'Refrigerante 350ml';
    }
    if (normalized.includes('água') || normalized.includes('agua')) {
      if (normalized.includes('com gás') || normalized.includes('com gas')) return 'Agua com gas';
      return 'Agua sem gas';
    }
    if (normalized.includes('café') || normalized.includes('cafe')) {
      if (normalized.includes('grão') || normalized.includes('grao')) return 'Café em grão';
      if (normalized.includes('descafeinado')) return 'Café descafeinado';
      return 'Café moido Classico';
    }
    if (normalized.includes('suco')) return 'Suco Lata';
    if (normalized.includes('fruta')) return 'Frutas Congeladas';
    if (normalized.includes('quiche')) return 'Quiche';
    if (normalized.includes('chá') || normalized.includes('cha') || normalized.includes('twinnings') || normalized.includes('twinings')) return 'chá twinnigs';
    if (normalized.includes('sopa de batata') || normalized.includes('batata com bacon') || (normalized.includes('sopa') && normalized.includes('bacon'))) return 'Sopa de Batata com Bacon';
    if (normalized.includes('mandioquinha') || (normalized.includes('caldo') && normalized.includes('mandioquinha'))) return 'Caldo de Mandioquinha';
    if (normalized.includes('caldo verde') || (normalized.includes('caldo') && normalized.includes('verde'))) return 'Caldo verde';
    
    return ''; // empty string means user will select manually
  };

  // Unit detector helper
  const detectUnit = (productName: string): 'un' | 'kg' => {
    const norm = productName.toLowerCase();
    
    // Frutas congeladas are managed under quantity/units and not KG
    if (norm.includes('fruta') || norm.includes('polpa') || norm.includes('congelada')) {
      return 'un';
    }

    if (norm.includes('kg') || norm.includes('quilo') || norm.includes('kilo') || norm.includes('gouda')) {
      return 'kg';
    }
    return 'un';
  };

  // Packaging Multiplier helper
  const detectMultiplier = (productName: string): number => {
    const norm = productName.toUpperCase();
    
    // Pattern like "C/100" or "C/ 100" or "C/30" or "C/ 30" or "C/10"
    const matchC = norm.match(/C\/\s*(\d+)/);
    if (matchC && matchC[1]) {
      return parseInt(matchC[1], 10);
    }
    
    // Pattern like "4 UN" or "4 UNI" or "4UND" or "30 UND"
    const matchUn = norm.match(/(\d+)\s*(UN|UNI|UND)/);
    if (matchUn && matchUn[1]) {
      return parseInt(matchUn[1], 10);
    }
    
    // Pattern like "CAIXA C/ 2 KG" or "CX C/ 2 KG" - if it has "C/ 2 KG" and unit is "kg"
    const matchKg = norm.match(/C\/\s*(\d+(\.\d+)?)\s*KG/);
    if (matchKg && matchKg[1]) {
      return parseFloat(matchKg[1]);
    }

    return 1;
  };

  const parseFileWithGemini = async (fileToParse: File) => {
    setIsParsing(true);
    setParseError(null);
    setParsingStage('Lendo arquivo do computador...');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64Str = res.split(',')[1];
          resolve(base64Str);
        };
        reader.onerror = (err) => reject(err);
      });
      reader.readAsDataURL(fileToParse);
      
      const fileBase64 = await base64Promise;
      setParsingStage('Iniciando Inteligência Artificial Gemini para análise do PDF...');

      const resp = await fetch('/api/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          mimeType: fileToParse.type || 'application/pdf'
        })
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        let message = errorText;
        try {
          const parsedErr = JSON.parse(errorText);
          if (parsedErr.error) {
            if (typeof parsedErr.error === 'string' && parsedErr.error.startsWith('{')) {
              const nested = JSON.parse(parsedErr.error);
              if (nested.error && nested.error.message) {
                message = nested.error.message;
              } else {
                message = parsedErr.error;
              }
            } else {
              message = parsedErr.error;
            }
          }
        } catch (_) {}

        if (message.includes("quota") || message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("Quota exceeded") || message.includes("exceeded your current quota")) {
          throw new Error("Você atingiu o limite de cota diária gratuita do Gemini API (limite de 20 requisições). Aguarde cerca de 1 a 2 minutos para liberar a cota no Google, ou utilize o botão preto 'Simular com o PDF Enviado' ao lado direito, que carrega instantaneamente todos os 8 itens mapeados sem gastar cota da API!");
        }

        throw new Error(message || `Erro na API (${resp.status})`);
      }

      setParsingStage('Organizando dados extraídos e realizando auto-preenchimento...');
      const responseJson = await resp.json();

      if (responseJson && Array.isArray(responseJson.items)) {
        const mappedItems = responseJson.items.map((item: any, idx: number) => {
          const matchedMacro = detectMacroIngredient(item.produto);
          const matchedUnit = detectUnit(item.produto);
          const multiplier = detectMultiplier(item.produto);
          const baseQty = Number(item.quantidade) || 1;
          return {
            id: `parsed_${idx}_${Date.now()}`,
            produto: item.produto,
            quantidade: baseQty * multiplier,
            unidade: matchedUnit,
            valorTotal: Number(item.valorTotal) || Number(item.valorUnitario) || 0,
            selectedMacro: matchedMacro || 'Desconsiderar'
          };
        });

        setParsedItems(mappedItems);
        
        // Auto pre-fill the order date if captured from the document
        if (responseJson.data && /^\d{4}-\d{2}-\d{2}$/.test(responseJson.data)) {
          setInvoiceDate(responseJson.data);
        }
        
        setParsingStage('Pronto!');
      } else {
        throw new Error('Não foi possível reconhecer itens estruturados. Verifique se o formato é válido.');
      }
    } catch (err: any) {
      console.error(err);
      setParseError(err?.message || 'Falha ao processar o documento com Gemini. Certifique-se de que a API Key está configurada.');
    } finally {
      setIsParsing(false);
      setParsingStage('');
    }
  };

  const loadTestData = () => {
    const rawTestItems = [
      {
        produto: 'MISTURA P/COOKIE MACADAMIA PX C/100 CONGELADO',
        quantidade: 1,
        valorTotal: 462.00,
        selectedMacro: 'Cookie'
      },
      {
        produto: 'PÃO DE QUEIJO GOUDA PRE ASSADO CAIXA C/ 2 KG',
        quantidade: 1,
        valorTotal: 94.79,
        selectedMacro: 'Pão de queijo Gouda'
      },
      {
        produto: 'CREAMCHEESE COBERTURA 250G CONGELADA 4 UN',
        quantidade: 1,
        valorTotal: 94.05,
        selectedMacro: 'Outros unidade'
      },
      {
        produto: 'MISTURA P/COOKIE RED VELVET CX C/100 CONGELADO',
        quantidade: 1,
        valorTotal: 462.00,
        selectedMacro: 'Cookie'
      },
      {
        produto: 'CINNAMON MASSA CRUA CONGELADA CX C/ 30 UND',
        quantidade: 2,
        valorTotal: 279.84,
        selectedMacro: 'Cinnamon Roll'
      },
      {
        produto: 'MISTURA P/COOKIE DUPLO CX C/100 CONGELADO',
        quantidade: 1,
        valorTotal: 462.00,
        selectedMacro: 'Cookie'
      },
      {
        produto: 'MISTURA P/COOKIE TRADICIONAL CX C/100 CONGELADO',
        quantidade: 1,
        valorTotal: 462.00,
        selectedMacro: 'Cookie'
      },
      {
        produto: 'BROWNIE COM NOZES ASSADO CONGELADO CX C/10 UNI',
        quantidade: 2,
        valorTotal: 103.20,
        selectedMacro: 'Brownie'
      }
    ];

    const testItems = rawTestItems.map((item, idx) => {
      const multiplier = detectMultiplier(item.produto);
      return {
        id: `test_${idx}_${Date.now()}`,
        produto: item.produto,
        quantidade: item.quantidade * multiplier,
        unidade: detectUnit(item.produto),
        valorTotal: item.valorTotal,
        selectedMacro: item.selectedMacro
      };
    });

    setParsedItems(testItems);
    setInvoiceDate('2026-04-27'); // exact date from PDF
    setParseError(null);
  };

  const handleSavePurchases = async () => {
    if (!saveBatch) {
      alert("Erro: Função de persistência de estoque não disponível.");
      return;
    }

    const validItems = parsedItems.filter(item => item.selectedMacro !== '');

    if (validItems.length === 0) {
      alert("Nenhum item válido para salvar.");
      return;
    }

    try {
      setIsParsing(true);
      setParsingStage('Gravando itens mapeados no seu estoque...');

      const dateParts = invoiceDate.split('-'); // ["2026", "04", "27"]
      const mesField = `${dateParts[1]}/${dateParts[0]}`; // "04/2026"
      
      // Consolidate/Group multiple rows of the same macroingredient + unit + desconsiderado status
      const grouped: Record<string, {
        selectedMacro: string;
        unidade: 'un' | 'kg';
        quantidade: number;
        valorTotal: number;
        desconsiderado: boolean;
      }> = {};

      validItems.forEach(item => {
        const isDesconsiderado = item.selectedMacro === 'Desconsiderar';
        const key = `${item.selectedMacro}_${item.unidade || 'un'}_${isDesconsiderado}`;
        if (!grouped[key]) {
          grouped[key] = {
            selectedMacro: item.selectedMacro,
            unidade: (item.unidade || 'un') as 'un' | 'kg',
            quantidade: 0,
            valorTotal: 0,
            desconsiderado: isDesconsiderado
          };
        }
        grouped[key].quantidade += Number(item.quantidade) || 0;
        grouped[key].valorTotal += Number(item.valorTotal) || 0;
      });

      // 1. Identify existing database items on the same day and supplier to perform a merge
      const targetDateNormalized = normalizeDayDateLocal(invoiceDate);
      const targetSupplierClean = String(selectedSupplier || '').trim().toLowerCase();

      const existingSameDayPurchases = (activePurchases || []).filter(p => {
        const itemDateNormalized = normalizeDayDateLocal(p.data || p.dataCompra || '');
        const itemSupplierClean = String(p.fornecedor || '').trim().toLowerCase();
        return itemDateNormalized === targetDateNormalized && itemSupplierClean === targetSupplierClean;
      });

      const consolidatedMap: Record<string, {
        produto: string;
        unidade: 'un' | 'kg';
        quantidade: number;
        total: number;
        desconsiderado: boolean;
      }> = {};

      // First, populate consolidatedMap with existing database items for same supplier and day
      existingSameDayPurchases.forEach(item => {
        const isDesc = item.desconsiderado === true || String(item.produto).toLowerCase().trim() === 'desconsiderar';
        const key = `${item.produto}_${item.unidade || 'un'}_${isDesc}`;
        if (!consolidatedMap[key]) {
          consolidatedMap[key] = {
            produto: item.produto,
            unidade: (item.unidade || 'un') as 'un' | 'kg',
            quantidade: 0,
            total: 0,
            desconsiderado: isDesc
          };
        }
        consolidatedMap[key].quantidade += Number(item.quantidade) || 0;
        consolidatedMap[key].total += Number(item.total || item.valorTotal) || 0;
      });

      // Next, merge with the newly uploaded/parsed items
      Object.values(grouped).forEach(newItem => {
        const key = `${newItem.selectedMacro}_${newItem.unidade || 'un'}_${newItem.desconsiderado}`;
        if (!consolidatedMap[key]) {
          consolidatedMap[key] = {
            produto: newItem.selectedMacro,
            unidade: newItem.unidade,
            quantidade: 0,
            total: 0,
            desconsiderado: newItem.desconsiderado
          };
        }
        consolidatedMap[key].quantidade += Number(newItem.quantidade) || 0;
        consolidatedMap[key].total += Number(newItem.valorTotal) || 0;
      });

      const itemsToSave = Object.values(consolidatedMap).map(item => {
        const qty = item.quantidade;
        const totalVal = item.total;
        return {
          data: invoiceDate, // YYYY-MM-DD
          mes: mesField,      // MM/YYYY
          produto: item.produto,
          quantidade: qty,
          unidade: item.unidade,
          fornecedor: selectedSupplier,
          custoUnitario: qty > 0 ? (totalVal / qty) : 0,
          total: totalVal,
          desconsiderado: item.desconsiderado
        };
      });

      // 2. If existing same-day purchases are found, delete the old entries from Firestore first
      // to avoid duplicates due to deterministic ID updates (since total and quantity changed).
      if (existingSameDayPurchases.length > 0) {
        setParsingStage('Mesclando e consolidando com compras do mesmo dia...');
        await Promise.all(
          existingSameDayPurchases.map(p => 
            deleteDoc(doc(db, `${dataPath}/purchases`, p.id))
          )
        );
        const deletedIds = new Set(existingSameDayPurchases.map(p => p.id));
        setLocalPurchases(prev => prev.filter(p => !deletedIds.has(p.id)));
      }

      await saveBatch('purchases', itemsToSave);
      
      if (existingSameDayPurchases.length > 0) {
        alert(`Pedido mesclado com sucesso! Os itens foram somados e unificados no pedido existente do dia ${targetDateNormalized}.`);
      } else {
        alert(`Sucesso! ${itemsToSave.length} compras gravadas com sucesso no estoque para o período ${mesField}!`);
      }
      setParsedItems([]);
      setSubTab('painel'); // return to flow
    } catch (err: any) {
      console.error(err);
      alert(`Erro no salvamento: ${err?.message || err}`);
    } finally {
      setIsParsing(false);
      setParsingStage('');
    }
  };

  const handleDeletePurchaseItem = async (purchaseId: string) => {
    if (!purchaseId) return;

    try {
      setDeleteStatusMessage("Excluindo compra do estoque...");
      const existingPurchase = localPurchases.find(p => p.id === purchaseId);
      await deleteDoc(doc(db, `${dataPath}/purchases`, purchaseId));
      await logAction('Exclusão', 'Compra Manual', `Excluiu lançamento de compra: "${existingPurchase?.produto || purchaseId}" (R$ ${existingPurchase?.total || 0})`, 'purchases', purchaseId, existingPurchase || {});
      setDeleteStatusMessage("Compra excluída com sucesso! Recalculando saldo...");
      setTimeout(() => setDeleteStatusMessage(null), 3000);
      setLocalPurchases(prev => prev.filter(p => p.id !== purchaseId));
      setConfirmingDeleteId(null);
    } catch (err: any) {
      console.error("Erro ao excluir item de compra:", err);
      setDeleteStatusMessage(`Erro ao excluir: ${err.message || err}`);
      setTimeout(() => setDeleteStatusMessage(null), 5000);
    }
  };

  const openEditPurchaseModal = (item: any) => {
    setEditingPurchase(item);
    setEditingPurchaseFornecedor(item.fornecedor || '');
    setEditingPurchaseProduto(item.produto || '');
    setEditingPurchaseQuantidade(Number(item.quantidade) || 0);
    setEditingPurchaseCustoUnitario(Number(item.custoUnitario) || Number(item.valorUnitario) || 0);
    setEditingPurchaseUnidade((item.unidade as 'un' | 'kg') || 'un');
    setEditingPurchaseDesconsiderado(item.desconsiderado === true || String(item.produto).toLowerCase().trim() === 'desconsiderar');
    setEditPurchaseStatusMessage(null);
  };

  const handleSaveEditPurchase = async () => {
    if (!editingPurchase) return;
    try {
      setIsSavingEditPurchase(true);
      setEditPurchaseStatusMessage("Salvando alterações...");

      const oldProduto = editingPurchase.produto;
      const oldQty = Number(editingPurchase.quantidade) || 0;
      const wasDesconsiderado = editingPurchase.desconsiderado === true || String(oldProduto).toLowerCase().trim() === 'desconsiderar';

      const newQty = Number(editingPurchaseQuantidade);
      const newCusto = Number(editingPurchaseCustoUnitario);
      const newTotal = Number((newQty * newCusto).toFixed(2));
      const finalProduto = editingPurchaseProduto.trim() || 'Desconsiderar';
      const isDesconsiderado = editingPurchaseDesconsiderado === true || String(finalProduto).toLowerCase().trim() === 'desconsiderar';

      const docRef = doc(db, `${dataPath}/purchases`, editingPurchase.id);

      const payload = {
        fornecedor: editingPurchaseFornecedor,
        produto: finalProduto,
        quantidade: newQty,
        custoUnitario: newCusto,
        total: newTotal,
        unidade: editingPurchaseUnidade,
        desconsiderado: isDesconsiderado
      };

      // 1. Update purchase document
      await updateDoc(docRef, payload);
      await logAction('Edição', 'Compra Manual', `Editou item de compra: "${editingPurchase.produto}" -> "${payload.produto}"`, 'purchases', editingPurchase.id, payload);

      // 2. Adjust Stock collection to match this change
      const stockRef = collection(db, `${dataPath}/stock`);

      // A) Subtract old quantity from old product in stock
      if (!wasDesconsiderado && oldProduto && oldProduto !== 'Desconsiderar') {
        const qryOld = query(stockRef, where('produto', '==', oldProduto));
        const oldStockSnap = await getDocs(qryOld);
        if (!oldStockSnap.empty) {
          const stockDoc = oldStockSnap.docs[0];
          const stockData = stockDoc.data();
          const currentStockQty = Number(stockData.estoqueAtual) || 0;
          const updatedStockQty = Math.max(0, currentStockQty - oldQty);
          await updateDoc(stockDoc.ref, {
            estoqueAtual: updatedStockQty,
            valorTotal: Number((updatedStockQty * (Number(stockData.custoUnitario) || 0)).toFixed(2))
          });
        }
      }

      // B) Add new quantity to new product in stock
      if (!isDesconsiderado && finalProduto && finalProduto !== 'Desconsiderar') {
        const qryNew = query(stockRef, where('produto', '==', finalProduto));
        const newStockSnap = await getDocs(qryNew);
        if (!newStockSnap.empty) {
          const stockDoc = newStockSnap.docs[0];
          const stockData = stockDoc.data();
          const currentStockQty = Number(stockData.estoqueAtual) || 0;
          const updatedStockQty = currentStockQty + newQty;
          await updateDoc(stockDoc.ref, {
            estoqueAtual: updatedStockQty,
            custoUnitario: newCusto,
            valorTotal: Number((updatedStockQty * newCusto).toFixed(2))
          });
        } else {
          const newStockDoc = {
            produto: finalProduto,
            estoqueAtual: newQty,
            custoUnitario: newCusto,
            valorTotal: newTotal,
            userId: editingPurchase.userId || 'admin'
          };
          await addDoc(stockRef, newStockDoc);
        }
      }

      // 3. Update local UI state
      setLocalPurchases(prev => prev.map(p => p.id === editingPurchase.id ? { ...p, ...payload } : p));
      
      setEditPurchaseStatusMessage(null);
      setEditingPurchase(null);
    } catch (err: any) {
      console.error("Erro ao salvar alteração de compra:", err);
      setEditPurchaseStatusMessage(`Erro ao salvar: ${err.message || err}`);
    } finally {
      setIsSavingEditPurchase(false);
    }
  };

  // Fallback state if props are not supplied
  const [localSales, setLocalSales] = useState<any[]>([]);
  const [localPurchases, setLocalPurchases] = useState<any[]>([]);
  const [localWaste, setLocalWaste] = useState<any[]>([]);
  const [localConsumption, setLocalConsumption] = useState<any[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);

  // Supplier Options list and state compiled dynamically based on unique suppliers in purchase records + base ones
  const dynamicSuppliers = useMemo(() => {
    const baseSuppliers = [
      "Mr. Cheney",
      "Bottega",
      "My baker",
      "Frutas - Natural Fresh",
      "Origens",
      "Pode Comer"
    ];
    // Gather unique suppliers from purchasesData / localPurchases
    const purchaseSuppliers = (purchasesData || localPurchases || [])
      .map(p => p.fornecedor)
      .filter((v): v is string => typeof v === 'string' && !!v.trim());
    
    const allSuppliersSet = new Set(baseSuppliers);
    purchaseSuppliers.forEach(s => {
      const found = Array.from(allSuppliersSet).find(item => item.toLowerCase() === s.toLowerCase());
      if (!found) {
        allSuppliersSet.add(s);
      }
    });
    return Array.from(allSuppliersSet);
  }, [purchasesData, localPurchases]);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        setLoadingRecipes(true);
        const recipeSnap = await getDocs(collection(db, `${dataPath}/recipes`));
        setRecipes(recipeSnap.docs.map(d => ({ id: d.id, ...d.data() } as Recipe)));
      } catch (err) {
        console.error('Error fetching recipes for inventory:', err);
      } finally {
        setLoadingRecipes(false);
      }
    };

    const fetchFallbackData = async () => {
      if (salesData && purchasesData && wasteData && staffConsumptionData) {
        return; // Don't fetch if props are provided
      }
      try {
        setLoadingLocal(true);
        const [salesSnap, wasteSnap, consumptionSnap, purchasesSnap] = await Promise.all([
          getDocs(collection(db, `${dataPath}/sales`)),
          getDocs(collection(db, `${dataPath}/wasteRecords`)),
          getDocs(collection(db, `${dataPath}/staffConsumption`)),
          getDocs(collection(db, `${dataPath}/purchases`))
        ]);
        setLocalSales(salesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLocalWaste(wasteSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLocalConsumption(consumptionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLocalPurchases(purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching local fallback data:', err);
      } finally {
        setLoadingLocal(false);
      }
    };

    if (dataPath) {
      fetchRecipes();
      fetchFallbackData();
    }
  }, [dataPath, salesData, purchasesData, wasteData, staffConsumptionData]);

  const activeSales = salesData || localSales;
  const activePurchases = purchasesData || localPurchases;
  const activeWaste = wasteData || localWaste;
  const activeConsumption = staffConsumptionData || localConsumption;

  // Derive inventory grouping reactively
  const inventoryData = useMemo(() => {
    if (loadingRecipes || (loadingLocal && !salesData)) {
      return [];
    }

    const months: Record<string, any> = {};

    const getMonthKey = (dateStr: any, mesField?: string) => {
      if (mesField && mesField.includes('/') && mesField.length >= 7) {
        const [m, y] = mesField.split('/');
        return `${y}-${m.padStart(2, '0')}`;
      }
      if (!dateStr || dateStr === 'Sem Data') return 'Sem Data';
      
      // Handle YYYY-MM-DD
      if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const pts = dateStr.split('-');
        if (pts[0].length === 4) return `${pts[0]}-${pts[1].padStart(2, '0')}`;
      }

      // Handle DD/MM/YYYY
      if (typeof dateStr === 'string' && dateStr.includes('/')) {
        const pts = dateStr.split('/');
        if (pts.length === 3) {
          const y = pts[2].length === 2 ? `20${pts[2]}` : pts[2];
          return `${y}-${pts[1].padStart(2, '0')}`;
        }
        if (pts.length === 2) {
           const m = pts[0].padStart(2, '0');
           const y = pts[1].length === 2 ? `20${pts[1]}` : pts[1];
           return `${y}-${m}`;
        }
      }
      
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Sem Data';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    // 1. Process Purchases (Entradas)
    activePurchases.forEach(p => {
      // Ignora itens desconsiderados na contabilização do estoque físico real
      if (p.desconsiderado === true || String(p.produto).toLowerCase().trim() === 'desconsiderar') return;

      const month = getMonthKey(p.data || p.dataCompra, p.mes);
      if (month === 'Sem Data') return;
      if (!months[month]) {
        months[month] = { month, compras: {}, vendas: {}, perdas: {}, reuso: {}, consumo: {} };
      }
      let prod = getMacroForProduct(p.produto || p.macroIngredient || '');
      if (prod) {
        months[month].compras[prod] = (months[month].compras[prod] || 0) + (Number(p.quantidade) || 0);
      }
    });

    // 2. Process Sales (Saídas via Recipe)
    activeSales.forEach(s => {
      const month = getMonthKey(s.data, s.mes);
      if (month === 'Sem Data') return;
      if (!months[month]) {
        months[month] = { month, compras: {}, vendas: {}, perdas: {}, reuso: {}, consumo: {} };
      }
      
      const productName = (s.nome || s.produto || '').trim();
      const quantity = Number(s.quantidade) || 1;
      
      const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === productName.toLowerCase()) ||
                     recipes.find(r => productName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));

      if (recipe) {
        recipe.ingredientes.forEach(ing => {
          const ingMacro = getMacroForProduct(ing.macroIngredient);
          months[month].vendas[ingMacro] = (months[month].vendas[ingMacro] || 0) + (ing.quantidade * quantity);
        });
      } else {
        const prod = getMacroForProduct(productName);
        if (prod) {
          months[month].vendas[prod] = (months[month].vendas[prod] || 0) + quantity;
        }
      }
    });

    // 3. Process Waste & Reuse (Descarte & Reuso)
    activeWaste.forEach(w => {
      const action = String(w.acao || '').toLowerCase().trim();
      const isReuso = action === 'reuso';
      const isDescarte = action === 'descarte';
      if (!isReuso && !isDescarte) return;

      const month = getMonthKey(w.data, (w as any).mes);
      if (month === 'Sem Data') return;
      if (!months[month]) {
        months[month] = { month, compras: {}, vendas: {}, perdas: {}, reuso: {}, consumo: {} };
      }
      if (!months[month].reuso) {
        months[month].reuso = {};
      }
      
      const productName = (w.produto || '').trim();
      const quantity = Number(w.quantidade) || 1;

      const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === productName.toLowerCase()) ||
                     recipes.find(r => productName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));

      if (isDescarte) {
        if (recipe) {
          recipe.ingredientes.forEach(ing => {
            const ingMacro = getMacroForProduct(ing.macroIngredient);
            months[month].perdas[ingMacro] = (months[month].perdas[ingMacro] || 0) + (ing.quantidade * quantity);
          });
        } else {
          const mappedName = getMacroForProduct(productName);
          months[month].perdas[mappedName] = (months[month].perdas[mappedName] || 0) + quantity;
        }
      } else if (isReuso) {
        if (recipe) {
          recipe.ingredientes.forEach(ing => {
            const ingMacro = getMacroForProduct(ing.macroIngredient);
            months[month].reuso[ingMacro] = (months[month].reuso[ingMacro] || 0) + (ing.quantidade * quantity);
          });
        } else {
          const mappedName = getMacroForProduct(productName);
          months[month].reuso[mappedName] = (months[month].reuso[mappedName] || 0) + quantity;
        }
      }
    });

    // 4. Process Staff Consumption
    activeConsumption.forEach(c => {
      const month = getMonthKey(c.data, (c as any).mes);
      if (month === 'Sem Data') return;
      if (!months[month]) {
        months[month] = { month, compras: {}, vendas: {}, perdas: {}, reuso: {}, consumo: {} };
      }
      
      const rawProductName = (c.produto || '').trim();
      const productName = rawProductName.split(' (Qtd:')[0].split(' [Dividido entre:')[0].trim();
      const quantity = Number(c.quantidade) || 1;

      const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === productName.toLowerCase()) ||
                     recipes.find(r => productName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));

      if (recipe) {
        recipe.ingredientes.forEach(ing => {
          const ingMacro = getMacroForProduct(ing.macroIngredient);
          months[month].consumo[ingMacro] = (months[month].consumo[ingMacro] || 0) + (ing.quantidade * quantity);
        });
      } else {
        const mappedName = getMacroForProduct(productName);
        months[month].consumo[mappedName] = (months[month].consumo[mappedName] || 0) + quantity;
      }
    });

    return Object.values(months).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [recipes, loadingRecipes, loadingLocal, salesData, localSales, purchasesData, localPurchases, wasteData, localWaste, staffConsumptionData, localConsumption]);

  const filteredChartData = useMemo(() => {
    return inventoryData.map(d => {
      let compras = 0;
      let vendas = 0;
      let perdas = 0;
      let reuso = 0;
      let consumo = 0;

      if (selectedIngredient === 'all') {
        compras = Object.values(d.compras).reduce((a: any, b: any) => a + b, 0) as number;
        vendas = Object.values(d.vendas).reduce((a: any, b: any) => a + b, 0) as number;
        perdas = Object.values(d.perdas).reduce((a: any, b: any) => a + b, 0) as number;
        reuso = Object.values(d.reuso || {}).reduce((a: any, b: any) => a + b, 0) as number;
        consumo = Object.values(d.consumo).reduce((a: any, b: any) => a + b, 0) as number;
      } else {
        compras = d.compras[selectedIngredient] || 0;
        vendas = d.vendas[selectedIngredient] || 0;
        perdas = d.perdas[selectedIngredient] || 0;
        reuso = (d.reuso && d.reuso[selectedIngredient]) || 0;
        consumo = d.consumo[selectedIngredient] || 0;
      }

      return {
        month: d.month,
        compras,
        vendas,
        perdas,
        reuso,
        consumo,
        totalSaidas: vendas + perdas + consumo + reuso,
        balanço: compras - (vendas + perdas + consumo + reuso)
      };
    });
  }, [inventoryData, selectedIngredient]);

  // Dynamic unit cost for each macro-ingredient
  const ingredientUnitCosts = useMemo(() => {
    const costs: Record<string, number> = {};
    
    // Initialize with stockData costs
    MACRO_INGREDIENTS.forEach(ing => {
      const stockItem = stockData?.find(sd => getMacroForProduct(sd.produto) === ing);
      costs[ing] = stockItem?.custoUnitario || 0;
    });

    // Populate with actual average purchase prices
    const purchaseSum: Record<string, { total: number, qty: number }> = {};
    (activePurchases || []).forEach(p => {
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
        costs[macro] = data.total / data.qty;
      }
    });

    return costs;
  }, [activePurchases, stockData]);

  // Total Purchases Value (R$)
  const totalComprasValor = useMemo(() => {
    return (activePurchases || []).reduce((sum, p) => {
      const isDesconsiderado = p.desconsiderado === true || String(p.produto).toLowerCase().trim() === 'desconsiderar';
      if (isDesconsiderado) return sum;
      
      const parsedMacro = getMacroForProduct(p.produto);
      if (selectedIngredient !== 'all' && parsedMacro !== selectedIngredient) return sum;
      
      return sum + (Number(p.total) || 0);
    }, 0);
  }, [activePurchases, selectedIngredient]);

  // Net-to-Gross internal ratio to adjust specific macro-ingredient sales
  const netSalesRatio = useMemo(() => {
    const grossTotal = (activeSales || []).reduce((sum, s) => {
      const val = Number(s.vendas !== undefined ? s.vendas : (s.total !== undefined ? s.total : (s.valor || 0)));
      return sum + val;
    }, 0);
    const netTotal = (financialData || [])
      .filter(f => f.tipo === 'Receita')
      .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);
    if (grossTotal > 0 && netTotal > 0) {
      return netTotal / grossTotal;
    }
    return 1;
  }, [activeSales, financialData]);

  // Total Sales Value (R$) (Only actual net sales)
  const totalVendasValor = useMemo(() => {
    if (selectedIngredient === 'all' && financialData && financialData.length > 0) {
      return financialData
        .filter(f => f.tipo === 'Receita')
        .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);
    }

    const rawSum = (activeSales || []).reduce((sum, s) => {
      const productName = (s.nome || s.produto || '').trim();
      const value = Number(s.vendas !== undefined ? s.vendas : (s.total !== undefined ? s.total : (s.valor || 0)));
      if (selectedIngredient === 'all') {
        return sum + value;
      }
      // If filtering by specific ingredient, check if this sold product's recipe uses it
      const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === productName.toLowerCase()) ||
                     recipes.find(r => productName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));
      if (recipe) {
        const usesIngredient = recipe.ingredientes.some(ing => getMacroForProduct(ing.macroIngredient) === selectedIngredient);
        if (usesIngredient) return sum + value;
      } else {
        const parsedMacro = getMacroForProduct(productName);
        if (parsedMacro === selectedIngredient) {
          return sum + value;
        }
      }
      return sum;
    }, 0);

    return rawSum * netSalesRatio;
  }, [activeSales, selectedIngredient, recipes, financialData, netSalesRatio]);

  // CMV Consolidado (R$)
  const totalCMVValor = useMemo(() => {
    let sumCMV = 0;
    (activeSales || []).forEach(s => {
      const productName = (s.nome || s.produto || '').trim();
      const quantity = Number(s.quantidade) || 1;
      
      const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === productName.toLowerCase()) ||
                     recipes.find(r => productName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));
      
      if (recipe) {
        recipe.ingredientes.forEach(ing => {
          const ingMacro = getMacroForProduct(ing.macroIngredient);
          if (selectedIngredient !== 'all' && ingMacro !== selectedIngredient) {
            return;
          }
          const unitCost = ingredientUnitCosts[ingMacro] || 0;
          sumCMV += ing.quantidade * quantity * unitCost;
        });
      } else {
        const ingName = getMacroForProduct(productName);
        if (ingName && (MACRO_INGREDIENTS as readonly string[]).includes(ingName)) {
          if (selectedIngredient === 'all' || ingName === selectedIngredient) {
            const unitCost = ingredientUnitCosts[ingName] || 0;
            sumCMV += quantity * unitCost;
          }
        }
      }
    });
    return sumCMV;
  }, [activeSales, selectedIngredient, recipes, ingredientUnitCosts]);

  // Staff Consumption Financial Stats
  const staffConsumptionAnalysis = useMemo(() => {
    let totalComDesconto = 0; // valor pago
    let totalSemDesconto = 0; // valor de venda cheio sem desconto
    let totalCustoCompra = 0; // Custo de compra dos produtos consumidos
    
    (activeConsumption || []).forEach(c => {
      const rawProductName = (c.produto || '').trim();
      const productName = rawProductName.split(' (Qtd:')[0].split(' [Dividido entre:')[0].trim();
      
      let matches = false;
      if (selectedIngredient === 'all') {
        matches = true;
      } else {
        const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === productName.toLowerCase()) ||
                       recipes.find(r => productName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));
        if (recipe) {
          matches = recipe.ingredientes.some(ing => getMacroForProduct(ing.macroIngredient) === selectedIngredient);
        } else {
          matches = getMacroForProduct(productName) === selectedIngredient;
        }
      }
      
      if (matches) {
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

        // --- Calculate purchase cost ---
        const resolvedProduct = findWasteProduct(productName);
        const standardName = resolvedProduct ? resolvedProduct.nome : productName;
        const qty = Number(c.quantidade) || 1;

        const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === standardName.toLowerCase()) ||
                       recipes.find(r => standardName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));

        let itemCost = 0;
        if (recipe) {
          recipe.ingredientes.forEach(ing => {
            const ingMacro = getMacroForProduct(ing.macroIngredient);
            const unitCost = ingredientUnitCosts[ingMacro] || 0;
            itemCost += ing.quantidade * qty * unitCost;
          });
        } else {
          const ingName = getMacroForProduct(standardName);
          if (ingName && (MACRO_INGREDIENTS as readonly string[]).includes(ingName)) {
            const unitCost = ingredientUnitCosts[ingName] || 0;
            itemCost += qty * unitCost;
          }
        }

        // If computed purchase cost is 0, default to 30% of full sales price (cheio)
        if (itemCost === 0) {
          itemCost = cheio * 0.3;
        }

        totalCustoCompra += itemCost;
      }
    });

    const descontoConsolidadoPercent = totalSemDesconto > 0 
      ? ((totalSemDesconto - totalComDesconto) / totalSemDesconto) * 100 
      : 0;

    return {
      totalComDesconto,
      totalSemDesconto,
      totalCustoCompra,
      descontoConsolidadoPercent
    };
  }, [activeConsumption, selectedIngredient, recipes, ingredientUnitCosts]);

  const groupedHistory = useMemo(() => {
    const list = (activePurchases || []).filter(item => {
      const term = historySearchTerm.toLowerCase();
      const textMatch = (
        String(item.produto || '').toLowerCase().includes(term) ||
        String(item.fornecedor || '').toLowerCase().includes(term) ||
        String(item.data || '').toLowerCase().includes(term)
      );

      if (!textMatch) return false;

      const isDesconsiderado = item.desconsiderado === true || String(item.produto).toLowerCase().trim() === 'desconsiderar';

      if (historyFilterType === 'desconsiderados') {
        return isDesconsiderado;
      } else if (historyFilterType !== 'all') {
        return String(item.produto).toUpperCase().trim() === historyFilterType.toUpperCase().trim();
      }

      return true;
    });

    const groups: Record<string, {
      key: string;
      totalAmount: number; // Valor Total Considerado
      totalDesconsideradoAmount: number; // Valor Total Desconsiderado
      itemsCount: number;
      items: typeof list;
    }> = {};

    list.forEach(item => {
      const key = historyGroupBy === 'day' 
        ? (item.data || 'Sem Data')
        : String(item.fornecedor || 'Sem Fornecedor').trim().toUpperCase();

      if (!groups[key]) {
        groups[key] = {
          key,
          totalAmount: 0,
          totalDesconsideradoAmount: 0,
          itemsCount: 0,
          items: []
        };
      }
      
      const isDesconsiderado = item.desconsiderado === true || String(item.produto).toLowerCase().trim() === 'desconsiderar';
      
      if (isDesconsiderado) {
        groups[key].totalDesconsideradoAmount += (Number(item.total) || 0);
      } else {
        groups[key].totalAmount += (Number(item.total) || 0);
      }
      
      groups[key].itemsCount += 1;
      groups[key].items.push(item);
    });

    const result = Object.values(groups);

    // Sort items within each group by date (newest to oldest)
    result.forEach(g => {
      g.items.sort((a, b) => {
        const parseDateStr = (str: string) => {
          if (!str) return '1900-01-01';
          const parts = str.split('/');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return str;
        };
        const dateA = parseDateStr(a.data || '');
        const dateB = parseDateStr(b.data || '');
        return dateB.localeCompare(dateA);
      });
    });

    return result.sort((a, b) => {
      if (historyGroupBy === 'day') {
        const parseDateStr = (str: string) => {
          const parts = str.split('/');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return str;
        };
        return parseDateStr(b.key).localeCompare(parseDateStr(a.key));
      } else {
        return a.key.localeCompare(b.key);
      }
    });
  }, [activePurchases, historySearchTerm, historyGroupBy, historyFilterType]);

  const historyStats = useMemo(() => {
    const list = (activePurchases || []).filter(item => {
      const term = historySearchTerm.toLowerCase();
      const textMatch = (
        String(item.produto || '').toLowerCase().includes(term) ||
        String(item.fornecedor || '').toLowerCase().includes(term) ||
        String(item.data || '').toLowerCase().includes(term)
      );

      if (!textMatch) return false;

      const isDesconsiderado = item.desconsiderado === true || String(item.produto).toLowerCase().trim() === 'desconsiderar';

      if (historyFilterType === 'desconsiderados') {
        return isDesconsiderado;
      } else if (historyFilterType !== 'all') {
        return String(item.produto).toUpperCase().trim() === historyFilterType.toUpperCase().trim();
      }

      return true;
    });

    let totalConsiderado = 0;
    let totalDesconsiderado = 0;
    const supplierTotals: Record<string, number> = {};
    const macroTotals: Record<string, number> = {};

    list.forEach(item => {
      const totalVal = Number(item.total) || 0;
      const isDesconsiderado = item.desconsiderado === true || String(item.produto).toLowerCase().trim() === 'desconsiderar';
      
      if (isDesconsiderado) {
        totalDesconsiderado += totalVal;
      } else {
        totalConsiderado += totalVal;
        
        let prod = String(item.produto || '').trim();
        if (prod.toLowerCase() === 'torta bottega') {
          prod = 'Tortas Bottega';
        }
        const prodUpper = prod.toUpperCase();
        if (prodUpper) {
          macroTotals[prodUpper] = (macroTotals[prodUpper] || 0) + totalVal;
        }
      }

      const supplier = String(item.fornecedor || 'Sem Fornecedor').trim().toUpperCase();
      supplierTotals[supplier] = (supplierTotals[supplier] || 0) + totalVal;
    });

    const topSuppliers = Object.entries(supplierTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    const topMacros = Object.entries(macroTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    return {
      totalConsiderado,
      totalDesconsiderado,
      totalGeral: totalConsiderado + totalDesconsiderado,
      topSuppliers,
      topMacros,
      itemCount: list.length
    };
  }, [activePurchases, historySearchTerm, historyFilterType]);

  const consumptionMappingDiagnosis = useMemo(() => {
    if (!activeConsumption || activeConsumption.length === 0) {
      return { totalRecords: 0, matchedCount: 0, unmatchedCount: 0, matchRatePercent: 0, uniqueMatched: [], uniqueUnmatched: [] };
    }
    
    const unmatchedSet = new Set<string>();
    const matchedSet = new Set<string>();
    let matchedCount = 0;
    let unmatchedCount = 0;

    activeConsumption.forEach(c => {
      const rawProductName = (c.produto || '').trim();
      const productName = rawProductName.split(' (Qtd:')[0].split(' [Dividido entre:')[0].trim();
      if (!productName) return;

      const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === productName.toLowerCase()) ||
                     recipes.find(r => productName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));

      if (recipe) {
        matchedCount++;
        matchedSet.add(productName);
      } else {
        unmatchedCount++;
        unmatchedSet.add(productName);
      }
    });

    return {
      totalRecords: activeConsumption.length,
      matchedCount,
      unmatchedCount,
      matchRatePercent: Math.round((matchedCount / activeConsumption.length) * 100),
      uniqueMatched: Array.from(matchedSet),
      uniqueUnmatched: Array.from(unmatchedSet)
    };
  }, [activeConsumption, recipes]);

  const downloadStaffConsumptionCSV = () => {
    if (!activeConsumption || activeConsumption.length === 0) {
      alert("Nenhum registro de consumo de funcionários encontrado para exportação.");
      return;
    }

    // Build header with BOM for Excel UTF-8 display compatibility
    let csvContent = "\uFEFF";
    csvContent += "Data;Funcionario;Produto Consumido;Quantidade;Valor Cheio (R$);Desconto (%);Valor Pago (R$);Status;Status de Associacao no Estoque\r\n";

    activeConsumption.forEach(c => {
      const rawProductName = (c.produto || '').trim();
      const productName = rawProductName.split(' (Qtd:')[0].split(' [Dividido entre:')[0].trim();
      const qty = c.quantidade || 1;
      
      const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === productName.toLowerCase()) ||
                     recipes.find(r => productName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));
      
      const associationStatus = recipe 
        ? `Mapeado p/ Ficha Tecnica (${recipe.ingredientes.map(i => i.macroIngredient).join(', ')})` 
        : "Nao Encontrado - Baixa automatica do estoque usando o nome direto do produto";

      // Escape semicolons and double quotes
      const sanitizeCSVStr = (str: string) => {
        return '"' + String(str).replace(/"/g, '""').trim() + '"';
      };

      const line = [
        sanitizeCSVStr(c.data),
        sanitizeCSVStr(c.funcionario),
        sanitizeCSVStr(rawProductName),
        qty,
        c.valorCheio || 0,
        c.descontoPercent || 0,
        c.valorPago || 0,
        sanitizeCSVStr(c.status || 'pendente'),
        sanitizeCSVStr(associationStatus)
      ].join(';');
      csvContent += line + "\r\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `consumo_funcionarios_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startInteractiveMapping = (productName: string, isExisting = false) => {
    setMappingProduct(productName);
    setIsEditingExistingMapping(isExisting);
    setMappingMessage(null);

    const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === productName.toLowerCase()) ||
                   recipes.find(r => productName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));

    if (recipe) {
      setExistingMappingId(recipe.id || null);
      setMappingIngs(recipe.ingredientes.map(i => ({ ...i })));
    } else {
      setExistingMappingId(null);
      // Auto-identify standard suggestion
      const guess = detectMacroIngredient(productName);
      const isKg = guess.toLowerCase().includes('cafe') || guess.toLowerCase().includes('carne') || guess.toLowerCase().includes('recheio') || guess.includes('KG') || guess.toLowerCase().includes('gouda');
      
      let defaultQty = 1;
      if (guess === 'Pão de queijo Gouda') {
        if (productName.includes('6')) {
          defaultQty = 0.18;
        } else if (productName.includes('3')) {
          defaultQty = 0.09;
        } else {
          defaultQty = 0.09; // Default portion size is 3 units
        }
      }

      setMappingIngs([{
        macroIngredient: MACRO_INGREDIENTS.includes(guess as any) ? guess : MACRO_INGREDIENTS[0],
        quantidade: defaultQty,
        unidade: isKg ? 'kg' : 'un'
      }]);
    }
  };

  const handleAddMappingIngredient = () => {
    setMappingIngs(prev => [
      ...prev,
      { macroIngredient: MACRO_INGREDIENTS[0], quantidade: 1, unidade: 'un' }
    ]);
  };

  const handleDeleteMappingIngredient = (index: number) => {
    setMappingIngs(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateMappingIngredient = (index: number, fields: Partial<any>) => {
    setMappingIngs(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, ...fields };
      }
      return item;
    }));
  };

  const handleSaveMapping = async () => {
    if (!mappingProduct) return;
    
    const validIngs = mappingIngs.filter(i => i.macroIngredient && Number(i.quantidade) > 0);
    if (validIngs.length === 0) {
      setMappingMessage({ type: 'error', text: 'Você precisa adicionar pelo menos um ingrediente com quantidade válida.' });
      return;
    }

    try {
      setIsSavingMapping(true);
      setMappingMessage(null);
      
      const userId = dataPath.split('/').pop() || 'shared_franquia_data';
      
      const recipeData = {
        produtoFinal: mappingProduct,
        ingredientes: validIngs.map(i => ({
          macroIngredient: i.macroIngredient,
          quantidade: Number(i.quantidade),
          unidade: i.unidade
        })),
        userId
      };

      if (existingMappingId) {
        // Update existing recipe in Firestore
        await updateDoc(doc(db, `${dataPath}/recipes`, existingMappingId), recipeData);
        await logAction('Edição', 'Ficha Técnica', `Atualizou vínculo de baixa para "${mappingProduct}"`, 'recipes', existingMappingId, recipeData);
        
        // Update local state instantly so everything recalculates
        setRecipes(prev => prev.map(r => r.id === existingMappingId ? { ...r, ...recipeData } : r));
        setMappingMessage({ type: 'success', text: 'Ficha técnica de baixa atualizada com sucesso no histórico!' });
      } else {
        // Create new recipe in Firestore
        const docRef = await addDoc(collection(db, `${dataPath}/recipes`), recipeData);
        await logAction('Criação', 'Ficha Técnica', `Cadastrou vínculo de baixa para "${mappingProduct}"`, 'recipes', docRef.id, recipeData);
        
        // Update local state instantly
        setRecipes(prev => [...prev, { id: docRef.id, ...recipeData }]);
        setMappingMessage({ type: 'success', text: 'Vínculo de baixa cadastrado com sucesso! Histórico atualizado.' });
      }

      // Close the workspace after a brief delay
      setTimeout(() => {
        setMappingProduct(null);
        setMappingMessage(null);
      }, 2000);
    } catch (err: any) {
      console.error('Erro ao salvar mapeamento de consumo:', err);
      setMappingMessage({ type: 'error', text: `Falha ao salvar no banco de dados: ${err.message || 'Erro desconhecido'}` });
    } finally {
      setIsSavingMapping(false);
    }
  };

  const loading = loadingRecipes || (loadingLocal && !salesData);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Carregando dados de estoque...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Floating Deletion/Action Toast Notification */}
      {deleteStatusMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold animate-bounce">
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping shrink-0" />
          <span>{deleteStatusMessage}</span>
        </div>
      )}

      {/* Main Stock Content */}
      <div className="space-y-8">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">Acompanhamento de Estoque</h3>
              <p className="text-slate-500">Fluxo mensal de insumos baseados em compras e movimentações reais.</p>
            </div>

            <div className="flex gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none md:min-w-[220px]">
                 <SearchableSelect
                   value={selectedIngredient}
                   onChange={setSelectedIngredient}
                   options={[{ value: 'all', label: 'Todos os Insumos', isPriority: true }, ...MACRO_INGREDIENTS]}
                 />
              </div>
            </div>
          </header>

          {/* Grid de KPIs Rápidos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estoque Físico (Fluxo de Quantidades)</span>
              <div className="h-px bg-slate-100 flex-1"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <StatCard 
                label="Entradas (Compras)" 
                value={filteredChartData.reduce((sum, d) => sum + d.compras, 0)} 
                icon={ShoppingCart} 
                color="blue" 
                unit={selectedIngredient === 'all' ? 'un/kg' : 'un/kg'}
              />
              <StatCard 
                label="Reuso" 
                value={filteredChartData.reduce((sum, d) => sum + d.reuso, 0)} 
                icon={RefreshCw} 
                color="emerald" 
              />
              <StatCard 
                label="Saídas (Vendas)" 
                value={filteredChartData.reduce((sum, d) => sum + d.vendas, 0)} 
                icon={TrendingUp} 
                color="emerald" 
              />
              <StatCard 
                label="Desperdício" 
                value={filteredChartData.reduce((sum, d) => sum + d.perdas, 0)} 
                icon={Trash2} 
                color="rose" 
              />
              <StatCard 
                label="Consumo Func." 
                value={filteredChartData.reduce((sum, d) => sum + d.consumo, 0)} 
                icon={Users} 
                color="amber" 
              />
            </div>
          </div>

          {/* Grid de KPIs Financeiros e CMV */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estoque Financeiro e CMV (Valores)</span>
              <div className="h-px bg-slate-100 flex-1"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Compras em R$ */}
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Compras (Valor)</span>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">
                    {formatCurrency(totalComprasValor)}
                  </h4>
                </div>
                <p className="text-[10px] text-slate-500 mt-3 font-medium">Soma monetária de notas fiscais consideradas no estoque</p>
              </motion.div>

              {/* Vendas faturadas em R$ */}
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Vendas Líquidas (Faturamento)</span>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">
                    {formatCurrency(totalVendasValor)}
                  </h4>
                </div>
                <p className="text-[10px] text-slate-500 mt-3 font-medium">Faturamento líquido em caixa considerando o fluxo de recebíveis descontado</p>
              </motion.div>

              {/* CMV em R$ */}
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 rounded-2xl bg-violet-50 text-violet-600">
                      <ArrowRightLeft className="w-5 h-5" />
                    </div>
                    {totalVendasValor > 0 && (
                      <span className="px-2 py-0.5 text-[8px] font-black uppercase text-violet-600 bg-violet-50 rounded-lg">
                        {((totalCMVValor / totalVendasValor) * 100).toFixed(1)}% CMV
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">CMV (Custo de Mercadoria Vendida)</span>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">
                    {formatCurrency(totalCMVValor)}
                  </h4>
                </div>
                <p className="text-[10px] text-slate-500 mt-3 font-medium">Custo ponderado dos insumos de fichas técnicas vendidos</p>
              </motion.div>

              {/* Consumo de Funcionário */}
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
                      <Users className="w-5 h-5" />
                    </div>
                    {staffConsumptionAnalysis.totalSemDesconto > 0 && (
                      <span className="px-2 py-0.5 text-[8px] font-black uppercase text-amber-600 bg-amber-50 rounded-lg">
                        -{staffConsumptionAnalysis.descontoConsolidadoPercent.toFixed(1)}% Desc
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Consumo Equipe (Valor Pago)</span>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">
                    {formatCurrency(staffConsumptionAnalysis.totalComDesconto)}
                  </h4>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1 text-[10px] text-slate-500">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Venda Sem Desc:</span>
                    <span className="font-bold text-slate-700">{formatCurrency(staffConsumptionAnalysis.totalSemDesconto)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Custo de Compra:</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(staffConsumptionAnalysis.totalCustoCompra)}</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Gráfico de Barras Empilhadas de Saídas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-900">Fluxo Mensal de Insumos</h4>
                </div>
                {selectedIngredient !== 'all' && (
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                    {selectedIngredient}
                  </span>
                )}
              </div>

              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={filteredChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        border: 'none', 
                        borderRadius: '16px', 
                        color: '#fff',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                      }}
                      itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                      formatter={(value: any) => Math.round(value)}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="compras" name="Entradas (Compras)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="vendas" name="Vendas" fill="#0284c7" stackId="outputs" />
                    <Bar dataKey="perdas" name="Desperdício" fill="#f43f5e" stackId="outputs" />
                    <Bar dataKey="consumo" name="Consumo (Equipe)" fill="#f59e0b" stackId="outputs" />
                    <Bar dataKey="reuso" name="Reuso" fill="#10b981" stackId="outputs" radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-slate-900 p-8 rounded-3xl text-white flex flex-col"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-white/10 rounded-xl text-white">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <h4 className="text-xl font-bold">Balanço de Giro</h4>
              </div>

              <div className="space-y-6 flex-1">
                {filteredChartData.slice(-3).reverse().map((d: any, idx: number) => {
                  const totalOut = d.vendas + d.perdas + d.consumo + d.reuso;
                  const totalIn = d.compras;
                  const ratio = totalIn > 0 ? (totalOut / totalIn) * 100 : 0;
                  
                  return (
                    <div key={idx} className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black uppercase text-slate-400">{d.month}</span>
                        <span className={cn(
                          "text-[10px] font-black px-2 py-0.5 rounded-full border",
                          d.balanço >= 0 ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10" : "text-rose-400 border-rose-400/20 bg-rose-400/10"
                        )}>
                          {d.balanço >= 0 ? '+' : ''}{Math.round(d.balanço)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-400">Giro de Estoque</span>
                          <span>{ratio.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              ratio > 90 ? "bg-rose-500" : ratio > 60 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(100, ratio)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                <p className="text-[10px] text-blue-300 leading-relaxed italic">
                  * O Balanço de Giro mostra a relação entre o que entrou via compras e o que saiu via movimentações. Se maior que 100%, você está consumindo estoque reserva.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Tabela de Detalhes Por Insumo */}
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-8">
            <button
              onClick={() => setIsAnalyticoExpanded(!isAnalyticoExpanded)}
              className="w-full p-8 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-xl text-white">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900">Analítico por Insumo</h4>
                  <p className="text-slate-500 text-xs mt-0.5">Clique para visualizar o saldo detalhado de cada ingrediente no período selecionado.</p>
                </div>
              </div>
              <div className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                {isAnalyticoExpanded ? <ChevronUp className="w-6 h-6 text-slate-500" /> : <ChevronDown className="w-6 h-6 text-slate-500" />}
              </div>
            </button>
            
            {isAnalyticoExpanded && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-x-auto border-t border-slate-100"
              >
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Macro Ingrediente</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Entradas Totais</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Reuso</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Vendas</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Desperdício</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Staff</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Saldo Período</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[...MACRO_INGREDIENTS].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(ing => {
                      const compras = inventoryData.reduce((sum, d) => sum + (d.compras[ing] || 0), 0);
                      const reuso = inventoryData.reduce((sum, d) => sum + ((d.reuso && d.reuso[ing]) || 0), 0);
                      const vendas = inventoryData.reduce((sum, d) => sum + (d.vendas[ing] || 0), 0);
                      const perdas = inventoryData.reduce((sum, d) => sum + (d.perdas[ing] || 0), 0);
                      const staff = inventoryData.reduce((sum, d) => sum + (d.consumo[ing] || 0), 0);
                      const saldo = compras - (vendas + perdas + staff + reuso);

                      if (selectedIngredient !== 'all' && selectedIngredient !== ing) return null;
                      if (saldo === 0 && compras === 0 && reuso === 0 && vendas === 0) return null;

                      const norm = ing.toLowerCase();
                      const isKg = (norm.includes('kg') || 
                                   norm.includes('quilo') || 
                                   norm.includes('kilo') ||
                                   norm.includes('cafe em grao') ||
                                   norm.includes('café em grão') ||
                                   norm.includes('outros kg') ||
                                   norm.includes('gouda')) &&
                                   !norm.includes('frutas congeladas');

                      const formatQtd = (val: number) => {
                        if (isKg) {
                          return val.toFixed(2) + " KG";
                        }
                        return Math.round(val) + " un";
                      };

                      return (
                        <tr key={ing} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-8 py-6">
                            <span className="text-xs font-black text-slate-900 uppercase">{ing}</span>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{formatQtd(compras)}</span>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{formatQtd(reuso)}</span>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <span className="text-xs font-bold text-slate-600">{formatQtd(vendas)}</span>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <span className="text-xs font-bold text-rose-500">{formatQtd(perdas)}</span>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <span className="text-xs font-bold text-amber-500">{formatQtd(staff)}</span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <span className={cn(
                              "text-sm font-black",
                              saldo >= 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {formatQtd(saldo)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            )}
          </section>

          {/* Histórico e Correção de Compras Importadas */}
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-8">
            <button
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="w-full p-8 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-xl text-white">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900">Histórico de Compras Registradas</h4>
                  <p className="text-slate-500 text-xs mt-0.5">Clique para visualizar e gerenciar o histórico de compras agrupado por dia ou fornecedor.</p>
                </div>
              </div>
              <div className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                {isHistoryExpanded ? <ChevronUp className="w-6 h-6 text-slate-500" /> : <ChevronDown className="w-6 h-6 text-slate-500" />}
              </div>
            </button>

            {isHistoryExpanded && (
              <div className="border-t border-slate-100 p-8 space-y-6">
                {/* Filtros e Controles de Agrupamento */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider shrink-0">Visualizar por:</span>
                      <div className="flex items-center bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryGroupBy('day');
                            setExpandedHistoryGroups({});
                          }}
                          className={cn(
                            "px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all",
                            historyGroupBy === 'day' 
                              ? "bg-slate-900 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          Dia
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryGroupBy('supplier');
                            setExpandedHistoryGroups({});
                          }}
                          className={cn(
                            "px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all",
                            historyGroupBy === 'supplier' 
                              ? "bg-slate-900 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          Fornecedor
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider shrink-0">Filtro Especial:</span>
                      <select
                        value={historyFilterType}
                        onChange={(e) => setHistoryFilterType(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all shadow-sm cursor-pointer focus:outline-none max-w-[200px] truncate"
                      >
                        <option value="all">🔍 Todos os Lançamentos</option>
                        <option value="desconsiderados">⚠️ Compras Desconsideradas</option>
                        <optgroup label="Macroingredientes">
                          {[...MACRO_INGREDIENTS].sort((a, b) => a.localeCompare(b, 'pt')).map(ing => (
                            <option key={ing} value={ing}>📦 {ing}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>
                  
                  <div className="relative w-full md:w-64">
                    <input 
                      type="text" 
                      placeholder="Filtrar nesta lista..."
                      value={historySearchTerm}
                      onChange={(e) => setHistorySearchTerm(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Cards com Highlights das Compras */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1: Valor Total */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                    <div className="absolute top-2 right-2 p-1.5 bg-blue-50 text-blue-500 rounded-xl">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total das Compras</span>
                      <h4 className="text-xl font-black text-slate-850 mt-1 tabular-nums">{formatCurrency(historyStats.totalGeral)}</h4>
                    </div>
                    <div className="border-t border-slate-200/50 mt-3 pt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-[10px] text-slate-500">No estoque: <strong className="text-blue-600 font-bold">{formatCurrency(historyStats.totalConsiderado)}</strong></span>
                      {historyStats.totalDesconsiderado > 0 && (
                        <span className="text-[10px] text-slate-500">Desconsiderado: <strong className="text-amber-600 font-bold">{formatCurrency(historyStats.totalDesconsiderado)}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Valor por Fornecedor */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                    <div className="absolute top-2 right-2 p-1.5 bg-indigo-50 text-indigo-500 rounded-xl">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Compras por Fornecedor</span>
                      {historyStats.topSuppliers.length > 0 ? (
                        <div className="mt-1">
                          <h4 className="text-sm font-black text-slate-800 truncate uppercase">
                            {historyStats.topSuppliers[0].name}
                          </h4>
                          <span className="text-xs font-bold text-indigo-600 tabular-nums">{formatCurrency(historyStats.topSuppliers[0].total)}</span>
                        </div>
                      ) : (
                        <h4 className="text-sm font-bold text-slate-400 mt-1">Nenhum fornecedor registrado</h4>
                      )}
                    </div>
                    <div className="border-t border-slate-200/50 mt-3 pt-3">
                      {historyStats.topSuppliers.length > 1 ? (
                        <div className="flex flex-wrap items-center gap-x-3 text-[9px] font-black uppercase text-slate-400 max-w-full overflow-hidden">
                          <span className="shrink-0">Outros:</span>
                          <div className="flex flex-wrap gap-1 items-center">
                            {historyStats.topSuppliers.slice(1, 3).map((sup, idx) => (
                              <span key={sup.name} className="text-slate-600 font-bold lowercase bg-white border border-slate-100 px-1.5 py-0.5 rounded">
                                {sup.name.toLowerCase()} <span className="font-extrabold text-indigo-600 mr-0.5">({formatCurrency(sup.total)})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-450 italic">Único fornecedor ativo ou filtrado</span>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Principal Macroingrediente Comprado */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                    <div className="absolute top-2 right-2 p-1.5 bg-emerald-50 text-emerald-500 rounded-xl">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Principal Macroingrediente</span>
                      {historyStats.topMacros.length > 0 ? (
                        <div className="mt-1">
                          <h4 className="text-sm font-black text-slate-800 truncate uppercase">
                            {historyStats.topMacros[0].name}
                          </h4>
                          <span className="text-xs font-bold text-emerald-600 tabular-nums">{formatCurrency(historyStats.topMacros[0].total)}</span>
                        </div>
                      ) : (
                        <h4 className="text-sm font-bold text-slate-400 mt-1">Nenhum ingrediente registrado</h4>
                      )}
                    </div>
                    <div className="border-t border-slate-200/50 mt-3 pt-3">
                      {historyStats.topMacros.length > 1 ? (
                        <div className="flex flex-wrap items-center gap-x-3 text-[9px] font-black uppercase text-slate-400 max-w-full overflow-hidden">
                          <span className="shrink-0">Seguinte:</span>
                          <span className="text-slate-600 font-bold lowercase bg-white border border-slate-100 px-1.5 py-0.5 rounded">
                            {historyStats.topMacros[1].name.toLowerCase()} <span className="font-extrabold text-emerald-600">({formatCurrency(historyStats.topMacros[1].total)})</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-450 italic">Único macroingrediente ativo ou filtrado</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lista Grouped Accordion */}
                <div className="space-y-3">
                  {groupedHistory.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <ShoppingCart className="w-12 h-12 stroke-1 mx-auto mb-4 text-slate-300" />
                      <p className="text-xs font-bold uppercase tracking-wider">Nenhum lançamento de compra encontrado</p>
                    </div>
                  ) : (
                    groupedHistory.map((group) => {
                      const isGroupExpanded = !!expandedHistoryGroups[group.key];
                      return (
                        <div key={group.key} className="border border-slate-100 rounded-2xl shadow-sm overflow-hidden bg-white hover:border-slate-200 transition-all">
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                            className="w-full px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                              <div>
                                <h5 className="text-xs font-black text-slate-800 uppercase">
                                  {group.key}
                                </h5>
                                <p className="text-[10px] font-bold text-slate-400">
                                  {group.itemsCount} {group.itemsCount === 1 ? 'item lançado' : 'itens lançados'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                              {group.totalDesconsideradoAmount > 0 && (
                                <div className="text-right hidden sm:block">
                                  <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block">Desconsiderados</span>
                                  <span className="text-xs font-bold text-amber-600/90 tabular-nums">{formatCurrency(group.totalDesconsideradoAmount)}</span>
                                </div>
                              )}
                              <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Pedido</span>
                                <span className="text-xs font-black text-slate-850 tabular-nums">{formatCurrency(group.totalAmount + group.totalDesconsideradoAmount)}</span>
                              </div>
                              <div className="p-1.5 hover:bg-slate-150 rounded-lg transition-all">
                                {isGroupExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              </div>
                            </div>
                          </button>

                          {isGroupExpanded && (
                            <div className="border-t border-slate-100 bg-slate-50/20 overflow-x-auto">
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="bg-slate-50/40">
                                    <th className="px-6 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                      {historyGroupBy === 'day' ? 'Fornecedor' : 'Data'}
                                    </th>
                                    <th className="px-6 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Macro Insumo</th>
                                    <th className="px-6 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Quantidade</th>
                                    <th className="px-6 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Custo Unitário</th>
                                    <th className="px-6 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Total</th>
                                    <th className="px-6 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {group.items.map((item) => {
                                    const isItemDesconsiderado = item.desconsiderado === true || String(item.produto).toLowerCase().trim() === 'desconsiderar';
                                    return (
                                      <tr key={item.id} className={cn(
                                        "hover:bg-slate-50/30 transition-colors group",
                                        isItemDesconsiderado && "bg-amber-500/[0.01]"
                                      )}>
                                        <td className="px-6 py-4">
                                          <span className="text-xs font-bold text-slate-700 uppercase">
                                            {historyGroupBy === 'day' ? item.fornecedor : item.data}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4">
                                          {isItemDesconsiderado ? (
                                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/50 inline-flex items-center gap-1 uppercase">
                                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                                              {item.produto || 'Desconsiderado'}
                                            </span>
                                          ) : (
                                            <span className="text-xs font-black text-blue-600 bg-blue-50/50 px-2 py-1 rounded-lg border border-blue-100 inline-block uppercase">
                                              {item.produto}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                          <span className="text-xs text-slate-800">
                                            {item.quantidade} <strong className="text-[10px] text-slate-400 font-extrabold uppercase">{item.unidade || 'un'}</strong>
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                          <span className="text-xs text-slate-600 font-medium">{formatCurrency(item.custoUnitario || 0)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                          <span className={cn(
                                            "text-xs font-black",
                                            isItemDesconsiderado ? "text-amber-700 font-bold" : "text-slate-900"
                                          )}>{formatCurrency(item.total || 0)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                          {confirmingDeleteId === item.id ? (
                                            <div className="flex items-center justify-end gap-1.5 shrink-0">
                                              <span className="text-[9px] font-black text-rose-600 tracking-wider uppercase animate-pulse">Excluir?</span>
                                              <button
                                                type="button"
                                                onClick={() => handleDeletePurchaseItem(item.id)}
                                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                                              >
                                                Sim
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setConfirmingDeleteId(null)}
                                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                                              >
                                                Não
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-end gap-2">
                                              <button
                                                type="button"
                                                onClick={() => openEditPurchaseModal(item)}
                                                className="p-1.5 text-blue-500 hover:text-blue-700 bg-blue-500/[0.06] hover:bg-blue-500/[0.12] rounded-xl transition-all"
                                                title="Editar Compra"
                                              >
                                                <Pencil className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setConfirmingDeleteId(item.id)}
                                                className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-500/[0.06] hover:bg-rose-500/[0.12] rounded-xl transition-all"
                                                title="Remover Compra"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-50/50 font-sans border-t border-slate-150">
                                    <td colSpan={2} className="px-6 py-3 text-right">
                                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Subtotais do Pedido:</span>
                                    </td>
                                    <td colSpan={2} className="px-6 py-3 text-left font-sans">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-slate-500">Considerado no estoque: <strong className="text-blue-600 font-bold">{formatCurrency(group.totalAmount)}</strong></span>
                                        <span className="text-[10px] text-slate-500">Desconsiderado: <strong className="text-amber-600 font-bold">{formatCurrency(group.totalDesconsideradoAmount)}</strong></span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                      <div className="inline-block bg-slate-900 text-white font-black text-[11px] px-2.5 py-1 rounded-lg">
                                        {formatCurrency(group.totalAmount + group.totalDesconsideradoAmount)}
                                      </div>
                                    </td>
                                    <td></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Diagnóstico e Exportação de Consumo de Funcionários */}
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-8">
            <button
              onClick={() => setIsConsumptionDiagnosisExpanded(!isConsumptionDiagnosisExpanded)}
              className="w-full p-8 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl text-white">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900">Mapeamento e Filtros de Consumo de Funcionários</h4>
                  <p className="text-slate-500 text-xs mt-0.5">Entenda como o consumo abate o estoque, audite produtos sem Ficha Técnica e exporte em CSV.</p>
                </div>
              </div>
              <div className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                {isConsumptionDiagnosisExpanded ? <ChevronUp className="w-6 h-6 text-slate-500" /> : <ChevronDown className="w-6 h-6 text-slate-500" />}
              </div>
            </button>

            {isConsumptionDiagnosisExpanded && (
              <div className="border-t border-slate-100 p-8 space-y-8">
                {/* Visual Explanation of the Match Algorithm */}
                <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                  <h5 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                    <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                    <span>Como funciona a conciliação do Consumo de Funcionários?</span>
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                    Quando um funcionário consome um produto, o sistema precisa deduzir seus ingredientes correspondentes do estoque. Como a planilha de consumo contém nomes de venda direta, o sistema realiza a seguinte associação:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="bg-white border border-slate-200/60 p-4 rounded-xl flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-black shrink-0">1</div>
                      <div>
                        <h6 className="text-[11px] font-black text-slate-700 uppercase">Se o produto tem Ficha Técnica cadastrada</h6>
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                          O sistema multiplica os insumos da receita pela quantidade de itens consumidos. A baixa no estoque ocorre <strong>diretamente nos macro-ingredientes</strong> (Ex: Café em grão, Leite, Copo).
                        </p>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200/60 p-4 rounded-xl flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-black shrink-0 font-mono">2</div>
                      <div>
                        <h6 className="text-[11px] font-black text-slate-700 uppercase">Se o produto NÃO tem Ficha Técnica</h6>
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                          O sistema não sabe de quais insumos o produto é composto! Como contingência, ele cria uma baixa direta usando o <strong>próprio nome do produto como se fosse o macro-ingrediente</strong>. Isso causa itens órfãos no estoque.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit & Diagnosis Metrics Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Status Card */}
                  <div className="bg-gradient-to-br from-indigo-50/60 to-indigo-50 border border-indigo-100/60 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-extrabold uppercase text-indigo-500 tracking-wider">Acurácia de Associação</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-black text-indigo-950 tabular-nums">{consumptionMappingDiagnosis.matchRatePercent}%</span>
                        <span className="text-xs text-indigo-600 font-bold">mapeado</span>
                      </div>
                      <p className="text-[10px] text-indigo-700/80 mt-2 leading-relaxed">
                        Dos lançamentos de consumo analisados, {consumptionMappingDiagnosis.matchedCount} possuem correspondência com alguma Ficha Técnica. Outros {consumptionMappingDiagnosis.unmatchedCount} estão operando sem receita.
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={downloadStaffConsumptionCSV}
                      className="mt-4 w-full bg-indigo-600 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                    >
                      <Download className="w-4 h-4 text-indigo-200" />
                      <span>Baixar CSV de Consumo</span>
                    </button>
                  </div>

                  {/* Products lists: Matched / Unmatched */}
                  <div className="lg:col-span-2 border border-slate-100 rounded-2xl p-5 bg-slate-50/30 flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Unmatched list (The critical ones!) */}
                      <div>
                        <h6 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                          <span>Não Conversam com as Fichas Técnicas ({consumptionMappingDiagnosis.uniqueUnmatched.length} produtos)</span>
                        </h6>
                        {consumptionMappingDiagnosis.uniqueUnmatched.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-white border border-slate-100 rounded-xl">
                            {consumptionMappingDiagnosis.uniqueUnmatched.map(name => (
                              <button 
                                key={name} 
                                type="button"
                                onClick={() => startInteractiveMapping(name, false)}
                                className={cn(
                                  "text-[9px] font-extrabold uppercase tracking-wide px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition-all active:scale-95 text-left border cursor-pointer",
                                  mappingProduct === name 
                                    ? "bg-slate-900 border-slate-900 text-white shadow-sm" 
                                    : "bg-amber-50/50 border-amber-200/50 hover:border-amber-400 text-amber-800"
                                )}
                                title="Clique aqui para mapear a Ficha Técnica e vincular quais macroingredientes darão baixa!"
                              >
                                <span>{name}</span>
                                <Sparkles className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Excelente! Todos os produtos identificados foram devidamente mapeados.</p>
                        )}
                        <span className="text-[9px] text-slate-400 font-bold mt-2 block leading-normal">
                          💡 Dica: Dê um clique em qualquer produto do consumo acima para mapear sua Ficha Técnica e vincular quais macroingredientes darão baixa!
                        </span>
                      </div>
 
                      {/* Matched list */}
                      <div className="border-t border-slate-200/40 pt-4">
                        <h6 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                          <span>Mapeados Corretamente ({consumptionMappingDiagnosis.uniqueMatched.length} produtos)</span>
                        </h6>
                        {consumptionMappingDiagnosis.uniqueMatched.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white border border-slate-100 rounded-xl">
                            {consumptionMappingDiagnosis.uniqueMatched.map(name => {
                              const isSelected = mappingProduct === name;
                              // Find corresponding recipe ingredients for display on tooltip
                              const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === name.toLowerCase()) ||
                                            recipes.find(r => name.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));
                              const tooltipStr = recipe 
                                ? `Baixa: ${recipe.ingredientes.map(i => `${i.quantidade} ${i.unidade} de ${i.macroIngredient}`).join(', ')}` 
                                : '';
                              return (
                                <button 
                                  key={name}
                                  type="button"
                                  onClick={() => startInteractiveMapping(name, true)}
                                  className={cn(
                                    "text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md inline-flex items-center gap-1 transition-all active:scale-95 text-left border cursor-pointer",
                                    isSelected 
                                      ? "bg-slate-900 border-slate-900 text-white shadow-sm" 
                                      : "bg-emerald-50/45 border-emerald-100 hover:border-emerald-300 text-emerald-700"
                                  )}
                                  title={`${tooltipStr} - Clique para alterar`}
                                >
                                  <span>{name}</span>
                                  <Check className="w-2.5 h-2.5 text-emerald-500" />
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Nenhum produto mapeado até o momento.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interactive Mapping Editor Workspace */}
                {mappingProduct && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="border-t border-slate-150 pt-8 mt-4"
                  >
                    <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-blue-500/10 rounded-2xl text-blue-400 shrink-0 border border-blue-500/15">
                            <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Mapeador Expresso de Ficha Técnica</span>
                            <h5 className="text-base md:text-lg font-black text-slate-100 uppercase tracking-tight leading-none mt-1">
                              {mappingProduct}
                            </h5>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMappingProduct(null)}
                          className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold px-4 py-2 rounded-xl transition-all self-stretch sm:self-auto text-center border border-slate-750 active:scale-95"
                        >
                          Fechar Painel
                        </button>
                      </div>

                      <p className="text-slate-300 text-xs leading-relaxed mb-6 max-w-3xl">
                        Ajuste abaixo as regras de baixa. Defina de quais macroingredientes o produto <span className="text-blue-400 font-extrabold">"{mappingProduct}"</span> é composto e qual a quantidade que deve sair do estoque (em unidades inteiras ou frações de KG) para cada <strong>1 unidade</strong> consumida.
                      </p>

                      <div className="space-y-3.5">
                        {mappingIngs.map((ing, index) => (
                          <div 
                            key={index} 
                            className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center gap-3 transition-all hover:border-slate-700"
                          >
                            {/* Ingredient Picker */}
                            <div className="flex-1 min-w-0">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block">Selecione o Insumo do Estoque</span>
                              <SearchableSelect
                                value={ing.macroIngredient}
                                onChange={(val) => handleUpdateMappingIngredient(index, { macroIngredient: val })}
                                options={MACRO_INGREDIENTS}
                              />
                            </div>

                            {/* Quantity Input */}
                            <div className="w-full md:w-40">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block">Qtd (Frações p/ 1 un de Venda)</span>
                              <input
                                type="number"
                                step="any"
                                min="0.0001"
                                value={ing.quantidade}
                                onChange={(e) => handleUpdateMappingIngredient(index, { quantidade: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-slate-900 border border-slate-850 hover:border-slate-750 text-xs font-mono text-white rounded-xl p-3 focus:outline-none focus:border-blue-500"
                                placeholder="0.00"
                              />
                            </div>

                            {/* Unit Picker */}
                            <div className="w-full md:w-32">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block">Unidade de Medida</span>
                              <select
                                value={ing.unidade}
                                onChange={(e) => handleUpdateMappingIngredient(index, { unidade: e.target.value as 'un' | 'kg' })}
                                className="w-full bg-slate-900 border border-slate-850 hover:border-slate-750 text-xs font-extrabold text-blue-400 rounded-xl p-3 focus:outline-none focus:border-blue-500"
                              >
                                <option value="un">un (unidades)</option>
                                <option value="kg">kg (quilos)</option>
                              </select>
                            </div>

                            {/* Delete Button */}
                            {mappingIngs.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMappingIngredient(index)}
                                className="md:self-end h-11 px-3 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl transition-all flex items-center justify-center border border-rose-500/20"
                                title="Remover este ingrediente"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={handleAddMappingIngredient}
                        className="mt-4 border-2 border-dashed border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all w-full justify-center bg-slate-950/40 hover:bg-slate-950/60"
                      >
                        <Plus className="w-4 h-4 text-blue-400" />
                        <span>Adicionar outro ingrediente composto (Ex: copo + pó + leite)</span>
                      </button>

                      {/* Status Message Alerts */}
                      {mappingMessage && (
                        <div className={cn(
                          "mt-6 p-4 rounded-2xl text-xs font-black tracking-wide text-center uppercase border",
                          mappingMessage.type === 'success' 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        )}>
                          {mappingMessage.text}
                        </div>
                      )}

                      {/* Workspace Controls */}
                      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-end border-t border-slate-800/80 pt-6">
                        <button
                          type="button"
                          onClick={() => setMappingProduct(null)}
                          className="px-6 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all border border-slate-750 active:scale-95 text-center"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveMapping}
                          disabled={isSavingMapping}
                          className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 shadow-md active:scale-95 cursor-pointer text-center"
                        >
                          {isSavingMapping ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Salvando Regras no Banco...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4.5 h-4.5 text-white" />
                              <span>Salvar Regra e Reajustar Estoque</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </section>

      {/* Modal de Edição de Compra Registrada */}
      {editingPurchase && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden text-left"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md tracking-wider">
                  Gerenciador de Lançamentos
                </span>
                <h3 className="text-base font-black text-slate-900 mt-2 uppercase tracking-wide">Editar Item de Compra</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPurchase(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-4">
              {editPurchaseStatusMessage && (
                <div className="p-3 bg-amber-50 text-amber-800 text-[11px] font-bold rounded-xl border border-amber-100/70 animate-pulse">
                  {editPurchaseStatusMessage}
                </div>
              )}

              {/* Checkbox: Desconsiderar */}
              <div className="flex items-center gap-3 bg-amber-500/[0.04] p-4 rounded-xl border border-amber-500/10 mb-4">
                <input
                  type="checkbox"
                  id="editDesconsiderarEstoque"
                  className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  checked={editingPurchaseDesconsiderado}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEditingPurchaseDesconsiderado(checked);
                  }}
                />
                <label htmlFor="editDesconsiderarEstoque" className="text-[10px] font-black text-amber-700 uppercase tracking-wider cursor-pointer select-none">
                  Não considerar este item na gestão de estoque
                </label>
              </div>

              {/* Fornecedor */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Fornecedor
                </label>
                <input
                  type="text"
                  list="editSuppliersList"
                  placeholder="Nome do Fornecedor"
                  value={editingPurchaseFornecedor}
                  onChange={(e) => setEditingPurchaseFornecedor(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl px-4 py-3 text-xs font-black uppercase text-slate-800 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
                />
                <datalist id="editSuppliersList">
                  {dynamicSuppliers.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              {/* Macro Insumo */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Macro Insumo ou Nome do Produto
                </label>
                {editingPurchaseDesconsiderado ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Escreva o nome do produto..."
                      value={editingPurchaseProduto === 'Desconsiderar' ? '' : editingPurchaseProduto}
                      onChange={(e) => setEditingPurchaseProduto(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl px-4 py-3 text-xs font-black uppercase text-slate-800 focus:ring-2 focus:ring-amber-500/20 transition-all shadow-sm"
                    />
                    <p className="text-[9px] text-amber-600 font-bold leading-normal">
                      Este item não atualizará o saldo físico do estoque, mas o nome digitado acima ficará guardado no histórico de compras para análise por fornecedor.
                    </p>
                  </div>
                ) : (
                  <SearchableSelect
                    value={editingPurchaseProduto}
                    placeholder="-- Selecione o Insumo --"
                    onChange={(val) => setEditingPurchaseProduto(val)}
                    options={MACRO_INGREDIENTS}
                  />
                )}
              </div>

              {/* Quantidade e Unidade */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Quantidade Comprada
                  </label>
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 focus-within:bg-white transition-all shadow-sm">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={editingPurchaseQuantidade}
                      onChange={(e) => setEditingPurchaseQuantidade(Number(e.target.value) || 0)}
                      className="w-full bg-transparent border-none text-xs font-black text-slate-800 focus:ring-0 p-0"
                    />
                    <select
                      value={editingPurchaseUnidade}
                      onChange={(e) => setEditingPurchaseUnidade(e.target.value as 'un' | 'kg')}
                      className="bg-transparent border-none py-0 px-1 text-[10px] font-black uppercase text-slate-500 focus:ring-0 cursor-pointer"
                    >
                      <option value="un">un</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Preço Unitário (R$)
                  </label>
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 focus-within:bg-white transition-all shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.0001"
                      value={editingPurchaseCustoUnitario}
                      onChange={(e) => setEditingPurchaseCustoUnitario(Number(e.target.value) || 0)}
                      className="w-full bg-transparent border-none text-xs font-black text-slate-800 focus:ring-0 p-0"
                    />
                  </div>
                </div>
              </div>

              {/* Preço Total (Calculado) */}
              <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Preço Total Estimado</span>
                  <p className="text-[9px] text-slate-400 mt-0.5 uppercase font-bold leading-none">Calculado automaticamente</p>
                </div>
                <span className="text-lg font-black text-slate-900 tabular-nums">
                  {formatCurrency(editingPurchaseQuantidade * editingPurchaseCustoUnitario)}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingPurchase(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingEditPurchase || (!editingPurchaseDesconsiderado && !editingPurchaseProduto) || !editingPurchaseFornecedor.trim()}
                onClick={handleSaveEditPurchase}
                className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/10"
              >
                {isSavingEditPurchase ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar Lançamento</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color, unit }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={cn(
        "p-2.5 rounded-2xl",
        color === 'blue' ? "bg-blue-50 text-blue-600" : 
        color === 'emerald' ? "bg-emerald-50 text-emerald-600" : 
        color === 'rose' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
      )}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <h4 className="text-2xl font-black text-slate-900 mt-1">
        {Math.round(value)}
        <span className="text-[10px] text-slate-400 ml-1.5 font-bold uppercase">{unit || 'un/kg'}</span>
      </h4>
    </div>
  </motion.div>
);
