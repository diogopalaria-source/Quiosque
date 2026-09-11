import React, { useMemo, useState } from 'react';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Search, 
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ShoppingBag,
  UtensilsCrossed,
  Clock,
  Check, 
  Trash2, 
  X, 
  Bookmark, 
  CalendarRange, 
  Filter, 
  Undo2, 
  ListOrdered, 
  CheckCircle, 
  Activity, 
  Sparkles,
  RefreshCcw,
  Plus,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { BankTransaction, FinancialRecord } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAction } from '../lib/logs';

interface CashFlowProps {
  bank: BankTransaction[];
  financial: FinancialRecord[];
  dataPath: string;
}

type ViewMode = 'daily' | 'weekly' | 'monthly';
type TabMode = 'analysis' | 'reconcile';
type ReconcileSubTab = 'debits' | 'credits' | 'history';

export const CashFlow: React.FC<CashFlowProps> = ({ bank, financial = [], dataPath }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<TabMode>('analysis');
  const [reconcileTab, setReconcileTab] = useState<ReconcileSubTab>('debits');

  // Input states for row-by-row debit reconciliation
  const [debitMonths, setDebitMonths] = useState<Record<string, string>>({});
  const [debitClassifications, setDebitClassifications] = useState<Record<string, string>>({});
  const [debitSubcategorySelections, setDebitSubcategorySelections] = useState<Record<string, string>>({});
  const [debitCustomDetails, setDebitCustomDetails] = useState<Record<string, string>>({});
  const [debitSavings, setDebitSavings] = useState<Record<string, boolean>>({});
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  // Type definition and state for desmembrar (split) debits
  interface SplitItem {
    classification: string;
    subcategorySelection: string;
    customDetails: string;
    valor: number;
  }
  const [splitStates, setSplitStates] = useState<Record<string, SplitItem[]>>({});

  // Input states for grouped credit reconciliation
  const [selectedCreditIds, setSelectedCreditIds] = useState<Record<string, boolean>>({});
  const [creditGroupMonth, setCreditGroupMonth] = useState('');
  const [creditGroupSubcategorySel, setCreditGroupSubcategorySel] = useState('');
  const [creditGroupCustomDetails, setCreditGroupCustomDetails] = useState('');
  const [isSavingCreditGroup, setIsSavingCreditGroup] = useState(false);
  const [creditGroupMessage, setCreditGroupMessage] = useState<string | null>(null);

  // General feedback status messages
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const parseDate = (d: string) => {
    if (!d) return new Date();
    const [day, month, year] = d.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  const getMonthFromDateStr = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('/')) return '';
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      return `${parts[1]}/${parts[2]}`;
    }
    return '';
  };

  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const getWeekRange = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay()); // Domingo
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Sábado
    
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return {
      key: `W-${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}-${start.getDate().toString().padStart(2, '0')}`,
      label: `Semana de ${fmt(start)} à ${fmt(end)}`
    };
  };

  // Generate Month Dropdown Options (e.g. "04/2026", "05/2026", ...)
  const monthOptions = useMemo(() => {
    const options = new Set<string>();
    
    // Add current/neighbor months dynamically
    const now = new Date();
    for (let i = -6; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const y = d.getFullYear();
      options.add(`${m}/${y}`);
    }

    // Add months from existing data to make sure any previous months are selectable
    financial.forEach(f => {
      if (f.mes) options.add(f.mes);
    });

    bank.forEach(b => {
      const m = getMonthFromDateStr(b.data);
      if (m) options.add(m);
    });

    return Array.from(options).sort((a, b) => {
      const partsA = String(a || '').split('/');
      const partsB = String(b || '').split('/');
      const mA = Number(partsA[0]) || 0;
      const yA = Number(partsA[1]) || 0;
      const mB = Number(partsB[0]) || 0;
      const yB = Number(partsB[1]) || 0;
      return (yB * 12 + mB) - (yA * 12 + mA); // Descending order
    });
  }, [bank, financial]);

  // Set default group month
  React.useEffect(() => {
    if (monthOptions.length > 0 && !creditGroupMonth) {
      setCreditGroupMonth(monthOptions[0]);
    }
  }, [monthOptions, creditGroupMonth]);

  // Helper to determine if a date is on or before April 30th (30/04/2026 or older years)
  const isAutoReconciled = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('/')) return false;
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        if (year < 2026) return true;
        if (year === 2026 && month <= 4) return true;
      }
    }
    return false;
  };

  // Unique Classifications from financial records (with standard defaults)
  const uniqueClassifications = useMemo(() => {
    const categories = new Set<string>();
    categories.add('Custo Recorrente');
    categories.add('Custo Variável');
    categories.add('Investimento');
    
    financial.forEach(f => {
      if (f.tipo === 'Despesa' && f.classificacao) {
        categories.add(f.classificacao.trim());
      }
    });

    return Array.from(categories).sort();
  }, [financial]);

  // Specific Subcategories (Detalhes) mapped to each classification group
  const classificationSubcategories = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    
    financial.forEach(f => {
      if (f.tipo === 'Despesa' && f.classificacao && f.detalhes) {
        const cl = f.classificacao.trim();
        const det = f.detalhes.trim().toUpperCase();
        if (det) {
          if (!map[cl]) {
            map[cl] = new Set<string>();
          }
          map[cl].add(det);
        }
      }
    });

    // Preset standard fallbacks for classic groups
    const defaults: Record<string, string[]> = {
      'Custo Recorrente': ['ALUGUEL', 'ENERGIA', 'AGUA', 'INTERNET', 'PRO LABORE', 'CONTABILIDADE', 'SISTEMA', 'CONDOMINIO'],
      'Custo Variável': ['EMBALAGENS', 'MERCADORIA', 'IMPOSTOS', 'TAXAS CARTAO', 'COMISSOES', 'MANUTENCAO', 'LOGISTICA'],
      'Investimento': ['MAQUINAS', 'REFORMA', 'MOBILIARIO', 'EQUIPAMENTOS', 'MARKETING']
    };

    Object.keys(defaults).forEach(cl => {
      if (!map[cl]) {
        map[cl] = new Set<string>();
      }
      defaults[cl].forEach(det => map[cl].add(det));
    });

    const finalMap: Record<string, string[]> = {};
    Object.keys(map).forEach(cl => {
      const list = Array.from(map[cl]).sort();
      if (!list.includes('OUTROS')) {
        list.push('OUTROS');
      }
      finalMap[cl] = list;
    });

    return finalMap;
  }, [financial]);

  // All unique Details (Subcategories) from Expense records in Financial collection
  const allFinancialExpenseDetails = useMemo(() => {
    const set = new Set<string>();
    
    financial.forEach(f => {
      if (f.tipo === 'Despesa' && f.detalhes) {
        set.add(f.detalhes.trim().toUpperCase());
      }
    });

    // Preset standard fallbacks for classic groups
    const defaults = [
      'ALUGUEL', 'ENERGIA', 'AGUA', 'INTERNET', 'PRO LABORE', 'CONTABILIDADE', 'SISTEMA', 'CONDOMINIO',
      'EMBALAGENS', 'MERCADORIA', 'IMPOSTOS', 'TAXAS CARTAO', 'COMISSOES', 'MANUTENCAO', 'LOGISTICA',
      'MAQUINAS', 'REFORMA', 'MOBILIARIO', 'EQUIPAMENTOS', 'MARKETING'
    ];
    defaults.forEach(d => set.add(d));

    const list = Array.from(set).sort();
    if (!list.includes('OUTROS')) {
      list.push('OUTROS');
    }
    return list;
  }, [financial]);

  // Map expense details to their known classification from financial records
  const expenseDetailToClassification = useMemo(() => {
    const map: Record<string, string> = {
      // Defaults
      'ALUGUEL': 'Custo Recorrente',
      'ENERGIA': 'Custo Recorrente',
      'AGUA': 'Custo Recorrente',
      'INTERNET': 'Custo Recorrente',
      'PRO LABORE': 'Custo Recorrente',
      'CONTABILIDADE': 'Custo Recorrente',
      'SISTEMA': 'Custo Recorrente',
      'CONDOMINIO': 'Custo Recorrente',
      'EMBALAGENS': 'Custo Variável',
      'MERCADORIA': 'Custo Variável',
      'IMPOSTOS': 'Custo Variável',
      'TAXAS CARTAO': 'Custo Variável',
      'COMISSOES': 'Custo Variável',
      'MANUTENCAO': 'Custo Variável',
      'LOGISTICA': 'Custo Variável',
      'MAQUINAS': 'Investimento',
      'REFORMA': 'Investimento',
      'MOBILIARIO': 'Investimento',
      'EQUIPAMENTOS': 'Investimento',
      'MARKETING': 'Investimento'
    };

    // Overlay database records
    financial.forEach(f => {
      if (f.tipo === 'Despesa' && f.classificacao && f.detalhes) {
        map[f.detalhes.trim().toUpperCase()] = f.classificacao.trim();
      }
    });

    return map;
  }, [financial]);

  // Specific Subcategories (Detalhes) for Credits/Revenues
  const creditSubcategories = useMemo(() => {
    const set = new Set<string>();
    
    financial.forEach(f => {
      if (f.tipo === 'Receita' && f.detalhes) {
        set.add(f.detalhes.trim().toUpperCase());
      }
    });

    const defaults = ['FATURAMENTO MAQUININHA', 'FATURAMENTO PIX', 'FATURAMENTO IFOOD', 'OUTROS FATURAMENTOS'];
    defaults.forEach(d => set.add(d));

    const list = Array.from(set).sort();
    if (!list.includes('OUTROS')) {
      list.push('OUTROS');
    }
    return list;
  }, [financial]);



  // General Statistics of the BANK transactions list passed
  const stats = useMemo(() => {
    const entries = bank.filter(t => t.tipo === 'Entrada').reduce((sum, t) => sum + t.valor, 0);
    const exits = bank.filter(t => t.tipo === 'Saída').reduce((sum, t) => sum + t.valor, 0);
    return {
      entries,
      exits,
      balance: entries - exits
    };
  }, [bank]);

  // List of unreconciled and reconciled transactions (excluding dates on or before April 30th)
  const unreconciledDebits = useMemo(() => {
    return bank.filter(t => t.tipo === 'Saída' && t.reconciled !== true && !isAutoReconciled(t.data));
  }, [bank]);

  const unreconciledCredits = useMemo(() => {
    return bank.filter(t => t.tipo === 'Entrada' && t.reconciled !== true && !isAutoReconciled(t.data));
  }, [bank]);

  const reconciledTransactions = useMemo(() => {
    return bank.filter(t => t.reconciled === true || isAutoReconciled(t.data));
  }, [bank]);

  // Subtotals for bank statement reconciliations
  const unreconciledTotals = useMemo(() => {
    const debitsValue = unreconciledDebits.reduce((sum, t) => sum + t.valor, 0);
    const creditsValue = unreconciledCredits.reduce((sum, t) => sum + t.valor, 0);
    return {
      debitsValue,
      creditsValue,
      totalUnreconciled: debitsValue + creditsValue
    };
  }, [unreconciledDebits, unreconciledCredits]);

  // Filter timeline bank data by view mode
  const timelineData = useMemo(() => {
    const filtered = searchTerm 
      ? bank.filter(t => t.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
      : bank;

    const groups: Record<string, {
      label: string;
      dateObj: Date;
      entries: number;
      exits: number;
      transactions: BankTransaction[];
    }> = {};

    filtered.forEach(t => {
      const d = parseDate(t.data);
      let key = '';
      let label = '';

      if (viewMode === 'daily') {
        key = t.data;
        label = t.data;
      } else if (viewMode === 'weekly') {
        const range = getWeekRange(d);
        key = range.key;
        label = range.label;
      } else {
        key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      }

      if (!groups[key]) {
        groups[key] = { label, dateObj: d, entries: 0, exits: 0, transactions: [] };
      }

      if (t.tipo === 'Entrada') groups[key].entries += t.valor;
      else groups[key].exits += t.valor;
      groups[key].transactions.push(t);
    });

    return Object.values(groups).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [bank, searchTerm, viewMode]);

  const getTag = (desc: string) => {
    const d = desc.toLowerCase();
    if (d.includes('ifood')) return { label: 'iFood', icon: ShoppingBag, color: 'bg-rose-50 text-rose-600 border-rose-100' };
    if (d.includes('maquininha') || d.includes('rede') || d.includes('cielo') || d.includes('pagseguro') || d.includes('getnet')) return { label: 'Maquininha', icon: CreditCard, color: 'bg-blue-50 text-blue-600 border-blue-100' };
    if (d.includes('alimentação') || d.includes('sodexo') || d.includes('alelo') || d.includes('ticket')) return { label: 'Alimentação', icon: UtensilsCrossed, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    return null;
  };

  const handleDeleteBankTransaction = async (id: string, tx: BankTransaction) => {
    try {
      const bankDocRef = doc(db, `${dataPath}/bankTransactions`, id);
      await deleteDoc(bankDocRef);
      
      await logAction(
        'Exclusão',
        'Conciliação Bancária',
        `Apagou transação indesejada do extrato: "${tx.descricao}" no valor de R$ ${tx.valor.toFixed(2)}`,
        'bankTransactions',
        id,
        tx
      );
      
      showFeedback("Lançamento do extrato apagado com sucesso!");
      setDeletingTxId(null);
    } catch (err: any) {
      console.error("Erro ao apagar lançamento bancário:", err);
      showFeedback(`Erro ao apagar lançamento: ${err.message || err}`);
    }
  };

  // Reconcile single Debit transaction
  const handleReconcileDebit = async (id: string, tx: BankTransaction) => {
    try {
      const selectedMonth = debitMonths[id] || getMonthFromDateStr(tx.data) || monthOptions[0];
      const selectedCategory = debitClassifications[id] || 'Custo Variável';
      
      const currentSubcatSel = debitSubcategorySelections[id] || '';
      let selectedDetail = '';
      if (currentSubcatSel === 'OUTROS') {
        selectedDetail = debitCustomDetails[id]?.trim() || '';
      } else {
        selectedDetail = currentSubcatSel;
      }

      if (!selectedDetail) {
        showFeedback("Por favor, preencha ou selecione a subcategoria do detalhe.");
        return;
      }

      setDebitSavings(prev => ({ ...prev, [id]: true }));

      // 1. Create Financial Record
      const recordPayload = {
        mes: selectedMonth,
        valor: tx.valor,
        tipo: 'Despesa' as const,
        classificacao: selectedCategory,
        detalhes: selectedDetail.toUpperCase(),
        observacoes: `Conciliação de Extrato. Transação original: [${tx.data}] ${tx.descricao}`
      };

      const financialRef = collection(db, `${dataPath}/financialRecords`);
      const finDoc = await addDoc(financialRef, recordPayload);

      // 2. Update Bank Document
      const bankDocRef = doc(db, `${dataPath}/bankTransactions`, id);
      await updateDoc(bankDocRef, {
        reconciled: true,
        reconciledId: finDoc.id,
        reconciledMonth: selectedMonth,
        reconciledClassification: selectedCategory,
        reconciledDetails: selectedDetail.toUpperCase()
      });

      // 3. Log
      await logAction(
        'Criação', 
        'Conciliação Bancária', 
        `Conciliou débito do extrato "${tx.descricao}" para despesa "${selectedCategory} - ${selectedDetail.toUpperCase()}"`, 
        'financialRecords', 
        finDoc.id, 
        recordPayload
      );

      showFeedback("Custo conciliado com sucesso!");
      
      // Cleanup field states
      setDebitSubcategorySelections(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setDebitCustomDetails(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setDebitClassifications(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (err: any) {
      console.error("Erro ao conciliar débito bancário:", err);
      showFeedback(`Erro ao conciliar: ${err.message || err}`);
    } finally {
      setDebitSavings(prev => ({ ...prev, [id]: false }));
    }
  };

  // Split transaction management behaviors
  const handleInitializeSplit = (txId: string, txValor: number) => {
    setSplitStates(prev => ({
      ...prev,
      [txId]: [
        { classification: 'Custo Variável', subcategorySelection: '', customDetails: '', valor: Number((txValor / 2).toFixed(2)) },
        { classification: 'Custo Variável', subcategorySelection: '', customDetails: '', valor: Number((txValor - (txValor / 2)).toFixed(2)) }
      ]
    }));
  };

  const handleAddSplitItem = (txId: string) => {
    setSplitStates(prev => {
      const list = prev[txId] || [];
      return {
        ...prev,
        [txId]: [...list, { classification: 'Custo Variável', subcategorySelection: '', customDetails: '', valor: 0 }]
      };
    });
  };

  const handleRemoveSplitItem = (txId: string, index: number) => {
    setSplitStates(prev => {
      const list = [...(prev[txId] || [])];
      list.splice(index, 1);
      return {
        ...prev,
        [txId]: list
      };
    });
  };

  const handleUpdateSplitItem = (txId: string, index: number, field: keyof SplitItem, value: any) => {
    setSplitStates(prev => {
      const list = [...(prev[txId] || [])];
      list[index] = { ...list[index], [field]: value };
      return {
        ...prev,
        [txId]: list
      };
    });
  };

  const handleCancelSplit = (txId: string) => {
    setSplitStates(prev => {
      const next = { ...prev };
      delete next[txId];
      return next;
    });
  };

  const handleReconcileSplit = async (id: string, tx: BankTransaction) => {
    const splits = splitStates[id] || [];
    if (splits.length < 1) return;

    // Calculate sum
    const totalSplit = splits.reduce((acc, current) => acc + (current.valor || 0), 0);
    // Fix floating point errors in comparison
    if (Math.abs(totalSplit - tx.valor) > 0.01) {
      showFeedback(`A soma das parcelas (R$ ${totalSplit.toFixed(2)}) deve ser exatamente igual ao total de R$ ${tx.valor.toFixed(2)}.`);
      return;
    }

    // Verify all items have subcategory
    for (let i = 0; i < splits.length; i++) {
      const item = splits[i];
      const finalDetail = item.subcategorySelection === 'OUTROS' ? item.customDetails.trim() : item.subcategorySelection;
      if (!finalDetail) {
        showFeedback(`Por favor, defina a subcategoria para o item #${i + 1}.`);
        return;
      }
      if (item.valor <= 0) {
        showFeedback(`Ao fracionar, o valor de cada item deve ser maior que zero (Item #${i + 1}).`);
        return;
      }
    }

    // Try saving
    try {
      setDebitSavings(prev => ({ ...prev, [id]: true }));
      const selectedMonth = debitMonths[id] || getMonthFromDateStr(tx.data) || monthOptions[0];

      const financialRef = collection(db, `${dataPath}/financialRecords`);

      for (let i = 0; i < splits.length; i++) {
        const item = splits[i];
        const finalDetail = (item.subcategorySelection === 'OUTROS' ? item.customDetails.trim() : item.subcategorySelection).toUpperCase();
        
        const recordPayload = {
          mes: selectedMonth,
          valor: item.valor,
          tipo: 'Despesa' as const,
          classificacao: item.classification,
          detalhes: finalDetail,
          observacoes: `Desmembramento [${i + 1}/${splits.length}] de Extrato Bancário. Transação original: [${tx.data}] ${tx.descricao} de R$ ${tx.valor.toFixed(2)}`
        };

        const finDoc = await addDoc(financialRef, recordPayload);

        // Log each split action
        await logAction(
          'Criação', 
          'Conciliação Bancária', 
          `Desmembrou parcela ${i + 1}/${splits.length} (R$ ${item.valor.toFixed(2)}) do débito "${tx.descricao}" como ${item.classification} - ${finalDetail}`, 
          'financialRecords', 
          finDoc.id, 
          recordPayload
        );
      }

      // Update Bank Document to reconciled
      const bankDocRef = doc(db, `${dataPath}/bankTransactions`, id);
      await updateDoc(bankDocRef, {
        reconciled: true,
        reconciledMonth: selectedMonth,
        reconciledClassification: 'Múltiplos (Desmembrado)',
        reconciledDetails: `${splits.length} despesas desmembrada(s)`
      });

      showFeedback("Desmembramento de custo conciliado com sucesso!");

      // Cleanup
      setSplitStates(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setDebitClassifications(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setDebitMonths(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

    } catch (err: any) {
      console.error("Erro ao conciliar desmembramento:", err);
      showFeedback(`Erro ao conciliar desmembramento: ${err.message || err}`);
    } finally {
      setDebitSavings(prev => ({ ...prev, [id]: false }));
    }
  };

  // Grouped confirmation/reconciliation of credit entries (revenues)
  const handleGroupReconcileCredits = async () => {
    const selectedIds = Object.keys(selectedCreditIds).filter(id => selectedCreditIds[id] === true);
    if (selectedIds.length === 0) {
      setCreditGroupMessage("Selecione ao menos um crédito do extrato.");
      return;
    }

    let finalCreditDetail = '';
    if (creditGroupSubcategorySel === 'OUTROS') {
      finalCreditDetail = creditGroupCustomDetails.trim();
    } else {
      finalCreditDetail = creditGroupSubcategorySel;
    }

    if (!finalCreditDetail) {
      setCreditGroupMessage("Preencha a subcategoria de faturamento / detalhes do grupo.");
      return;
    }

    try {
      setIsSavingCreditGroup(true);
      setCreditGroupMessage("Processando conciliação agrupada...");

      const selectedTxs = unreconciledCredits.filter(t => t.id && selectedIds.includes(t.id));
      const totalAmount = selectedTxs.reduce((sum, t) => sum + t.valor, 0);
      const formattedMonth = creditGroupMonth || monthOptions[0];
      const detailUpper = finalCreditDetail.toUpperCase();

      const descriptorsList = selectedTxs.map(t => `[${t.data}]: ${t.descricao}`).join(' | ');

      // 1. Create a single combined FinancialRecord representing this group's revenue
      const recordPayload = {
        mes: formattedMonth,
        valor: totalAmount,
        tipo: 'Receita' as const,
        classificacao: 'Receita', // Classificação standard para créditos
        detalhes: detailUpper,
        observacoes: `Grupo conciliado do extrato bancário. Inclui: ${descriptorsList}`
      };

      const financialRef = collection(db, `${dataPath}/financialRecords`);
      const finDoc = await addDoc(financialRef, recordPayload);

      // 2. Mark all reconciled transactions in Firestore
      for (const tx of selectedTxs) {
        if (!tx.id) continue;
        const bankDocRef = doc(db, `${dataPath}/bankTransactions`, tx.id);
        await updateDoc(bankDocRef, {
          reconciled: true,
          reconciledId: finDoc.id,
          reconciledMonth: formattedMonth,
          reconciledClassification: 'Receita',
          reconciledDetails: detailUpper
        });
      }

      // 3. Log action
      await logAction(
        'Criação', 
        'Conciliação Bancária', 
        `Conciliou grupo de ${selectedTxs.length} entries de crédito (Total: R$ ${totalAmount.toFixed(2)}) como Receita "${detailUpper}" no mês ${formattedMonth}`, 
        'financialRecords', 
        finDoc.id, 
        recordPayload
      );

      // Reset selection and message
      setSelectedCreditIds({});
      setCreditGroupSubcategorySel('');
      setCreditGroupCustomDetails('');
      setCreditGroupMessage("Faturamento agrupado e conciliado com sucesso!");
      setTimeout(() => setCreditGroupMessage(null), 3000);
    } catch (err: any) {
      console.error("Erro ao conciliar créditos bancários:", err);
      setCreditGroupMessage(`Erro na operação: ${err.message || err}`);
    } finally {
      setIsSavingCreditGroup(false);
    }
  };

  // Undo/Revert previous reconciliation
  const handleUndoReconciliation = async (tx: BankTransaction) => {
    if (!tx.id) return;
    try {
      showFeedback("Desfazendo conciliação...");

      // If reconciled individually or in a group, we might find multiple transactions sharing the same financial record
      if (tx.reconciledId) {
        try {
          // Remove from financialRecords collection in Firestore
          const finDocRef = doc(db, `${dataPath}/financialRecords`, tx.reconciledId);
          await deleteDoc(finDocRef);
        } catch (e) {
          console.log("Associated financial record not found or already deleted.", e);
        }

        // Find and unlock ALL bank transactions pointing to that financial record ID
        const q = query(collection(db, `${dataPath}/bankTransactions`), where('reconciledId', '==', tx.reconciledId));
        const snap = await getDocs(q);
        
        for (const docSnap of snap.docs) {
          await updateDoc(docSnap.ref, {
            reconciled: false,
            reconciledId: null,
            reconciledMonth: null,
            reconciledClassification: null,
            reconciledDetails: null
          });
        }
      } else {
        // Just revert this single transaction if no reconciledId
        const bankDocRef = doc(db, `${dataPath}/bankTransactions`, tx.id);
        await updateDoc(bankDocRef, {
          reconciled: false,
          reconciledId: null,
          reconciledMonth: null,
          reconciledClassification: null,
          reconciledDetails: null
        });
      }

      await logAction('Exclusão', 'Conciliação Bancária', `Desfez conciliação da transação do extrato "${tx.descricao}"`, 'bankTransactions', tx.id, null);
      showFeedback("Lançamento revertido com sucesso! O item voltou à lista de pendentes.");
    } catch (err: any) {
      console.error("Erro ao desfazer conciliação:", err);
      showFeedback(`Erro ao desfazer: ${err.message || err}`);
    }
  };

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Helper toggle all credits selection
  const handleToggleAllCredits = (checked: boolean) => {
    const ids: Record<string, boolean> = {};
    if (checked) {
      unreconciledCredits.forEach(t => {
        if (t.id) ids[t.id] = true;
      });
    }
    setSelectedCreditIds(ids);
  };

  const areAllCreditsSelected = useMemo(() => {
    if (unreconciledCredits.length === 0) return false;
    return unreconciledCredits.every(t => t.id && selectedCreditIds[t.id] === true);
  }, [unreconciledCredits, selectedCreditIds]);

  const selectedCreditsCount = useMemo(() => {
    return Object.values(selectedCreditIds).filter(v => v === true).length;
  }, [selectedCreditIds]);

  const selectedCreditsTotal = useMemo(() => {
    return unreconciledCredits
      .filter(t => t.id && selectedCreditIds[t.id] === true)
      .reduce((sum, t) => sum + t.valor, 0);
  }, [unreconciledCredits, selectedCreditIds]);

  return (
    <div className="space-y-8 pb-12">
      {/* Dynamic Feedback Alert */}
      {actionFeedback && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 border border-slate-800 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold animate-pulse">
          <Activity className="w-4 h-4 text-emerald-400 rotate-12" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Main Title & Main Tab Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Extrato & Fluxo Financeiro</h3>
          <p className="text-sm text-slate-500 font-medium">Instale dados bancários reais e cruze custos e faturamentos.</p>
        </div>

        {/* Global Navigation Tabs */}
        <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 self-start lg:self-center shadow-sm">
          <button
            onClick={() => setActiveTab('analysis')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === 'analysis' 
                ? "bg-white text-blue-600 shadow-md transform scale-102"
                : "text-slate-500 hover:text-slate-950"
            )}
          >
            <CalendarRange className="w-4 h-4" />
            <span>Fluxo de Caixa</span>
          </button>
          <button
            onClick={() => setActiveTab('reconcile')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 relative",
              activeTab === 'reconcile' 
                ? "bg-white text-blue-600 shadow-md transform scale-102"
                : "text-slate-500 hover:text-slate-950"
            )}
          >
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span>Conciliador de Extrato</span>
            {(unreconciledDebits.length + unreconciledCredits.length) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                {unreconciledDebits.length + unreconciledCredits.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content for TAB 1: VISÃO DE FLUXO DE CAIXA (CHRONOLOGY/TIMELINE) */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
            <div className="flex items-center gap-3">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider">
                Consolidado Real
              </span>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Lançamentos importados do extrato
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="bg-slate-200/50 p-0.5 rounded-xl flex items-center gap-1">
                {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      viewMode === mode 
                        ? "bg-white text-slate-800 shadow-sm" 
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {mode === 'daily' ? 'Diário' : mode === 'weekly' ? 'Semanal' : 'Mensal'}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar lançamento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200/70 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 transition-all font-bold uppercase tracking-wider"
                />
              </div>
            </div>
          </div>

          {/* Core Bank Accounts summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100/60 shadow-sm relative overflow-hidden"
            >
              <ArrowUpCircle className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-200/30 rotate-12" />
              <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1.5">Entradas Totais (Histórico)</p>
              <h3 className="text-2xl font-black text-emerald-700 tabular-nums">{formatCurrency(stats.entries)}</h3>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-rose-50/50 p-6 rounded-3xl border border-rose-100/60 shadow-sm relative overflow-hidden"
            >
              <ArrowDownCircle className="absolute -right-4 -bottom-4 w-24 h-24 text-rose-200/30 -rotate-12" />
              <p className="text-xs font-black text-rose-600 uppercase tracking-widest mb-1.5">Saídas Totais (Histórico)</p>
              <h3 className="text-2xl font-black text-rose-700 tabular-nums">{formatCurrency(stats.exits)}</h3>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100/60 shadow-sm relative overflow-hidden"
            >
              <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1.5">Saldo Bancário (Sobra)</p>
              <h3 className="text-2xl font-black text-blue-700 tabular-nums">{formatCurrency(stats.balance)}</h3>
            </motion.div>
          </div>

          {/* Timeline Dates Accordion */}
          <div className="space-y-4">
            {timelineData.length > 0 ? (
              timelineData.map((group, groupIdx) => (
                <motion.div 
                  key={group.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: groupIdx * 0.05 }}
                  className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  <button 
                    onClick={() => toggleDate(group.label)}
                    className="w-full px-6 py-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                          {group.label}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {group.transactions.length} lançamentos
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="hidden md:block text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resumo Período</p>
                        <div className="flex items-center gap-3 text-[11px] font-black mt-1">
                          <span className="text-emerald-600">+{formatCurrency(group.entries)}</span>
                          <span className="text-rose-600">-{formatCurrency(group.exits)}</span>
                        </div>
                      </div>

                      <div className="text-right px-4.5 py-2.5 bg-slate-50/80 rounded-2xl min-w-[150px]">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Resultado</p>
                        <p className={cn(
                          "text-xs font-black tabular-nums mt-1",
                          group.entries - group.exits >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {formatCurrency(group.entries - group.exits)}
                        </p>
                      </div>
                      
                      {expandedDates[group.label] ? <ChevronUp className="w-5 h-5 text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {expandedDates[group.label] && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-50 bg-slate-50/20"
                      >
                        <div className="px-6 py-4 space-y-2">
                          {group.transactions.map((t, tIdx) => {
                            const tag = getTag(t.descricao);
                            return (
                              <div key={tIdx} className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4 group hover:border-slate-200/80 transition-all">
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center",
                                    t.tipo === 'Entrada' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                  )}>
                                    {t.tipo === 'Entrada' ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-black text-slate-900 uppercase tracking-wide truncate max-w-[200px] md:max-w-md">
                                      {t.descricao}
                                    </h5>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                      <span className="text-[9px] font-bold text-slate-400">{t.data}</span>
                                      {(t.reconciled || isAutoReconciled(t.data)) && (
                                        <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                                          CONCILIADO {t.reconciledMonth ? `EM ${t.reconciledMonth}` : '(LANÇADO)'} • {t.reconciledDetails || 'CONSOLIDADO ANTERIOR'}
                                        </span>
                                      )}
                                      {tag && (
                                        <span className={cn("px-2 py-0.5 rounded text-[8px] font-black border", tag.color)}>
                                          {tag.label.toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className={cn(
                                  "text-xs font-black tabular-nums",
                                  t.tipo === 'Entrada' ? "text-emerald-600" : "text-rose-600"
                                )}>
                                  {t.tipo === 'Entrada' ? '+' : '-'}{formatCurrency(t.valor)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))
            ) : (
              <div className="bg-white border-2 border-dashed border-slate-100 rounded-3xl py-20 text-center">
                <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Nenhum registro para o período.</p>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Content for TAB 2: CONCILIADOR DE EXTRATO BANCÁRIO */}
      {activeTab === 'reconcile' && (
        <div className="space-y-6">
          
          {/* Dashboard Summary for reconciliation task */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">Pendente de Alocação</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xl font-black text-slate-800 tabular-nums">
                  {unreconciledDebits.length + unreconciledCredits.length} lançamentos
                </span>
              </div>
            </div>
            
            <div className="bg-amber-500/[0.03] p-5 rounded-3xl border border-amber-500/10 shadow-sm">
              <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 block mb-1">Débitos / Custos Atuais</span>
              <span className="text-xl font-black text-amber-700 tabular-nums">
                {unreconciledDebits.length} itens a conciliar
              </span>
            </div>

            <div className="bg-emerald-500/[0.03] p-5 rounded-3xl border border-emerald-500/10 shadow-sm">
              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 block mb-1">Créditos / Faturamentos</span>
              <span className="text-xl font-black text-emerald-700 tabular-nums">
                {unreconciledCredits.length} itens a agrupar
              </span>
            </div>

            <div className="bg-blue-500/[0.03] p-5 rounded-3xl border border-blue-500/10 shadow-sm">
              <span className="text-[8px] font-black uppercase tracking-widest text-blue-600 block mb-1">Total Já Conciliado</span>
              <span className="text-xl font-black text-blue-700 tabular-nums">
                {reconciledTransactions.length} reconciliados
              </span>
            </div>
          </div>

          {/* Sub Navigation inside the reconciliador */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setReconcileTab('debits')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                  reconcileTab === 'debits'
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/10"
                    : "bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-800"
                )}
              >
                1. Saídas (Custos Individuais)
                {unreconciledDebits.length > 0 && (
                  <span className="ml-2 bg-white text-amber-700 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                    {unreconciledDebits.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setReconcileTab('credits')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                  reconcileTab === 'credits'
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
                    : "bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-800"
                )}
              >
                2. Entradas (Agrupar Receitas)
                {unreconciledCredits.length > 0 && (
                  <span className="ml-2 bg-white text-emerald-700 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                    {unreconciledCredits.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setReconcileTab('history')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                  reconcileTab === 'history'
                    ? "bg-slate-800 text-white shadow-md"
                    : "bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-800"
                )}
              >
                Histórico Conciliado
                {reconciledTransactions.length > 0 && (
                  <span className="ml-2 bg-slate-700 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                    {reconciledTransactions.length}
                  </span>
                )}
              </button>
            </div>
          </div>


          {/* SUBTAB 1: DEBITS (CUSTOS) */}
          {reconcileTab === 'debits' && (
            <div className="space-y-4">
              <div className="p-4.5 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Alocação Detalhada de Débitos</h4>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">Identifique cada débito bancário e escolha seu mês, classificação e subcategoria.</p>
                </div>
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  Total pendente: <span className="text-amber-600 font-bold tabular-nums">{formatCurrency(unreconciledTotals.debitsValue)}</span>
                </div>
              </div>



              {unreconciledDebits.length > 0 ? (
                <div className="space-y-4">
                  {unreconciledDebits.map(tx => {
                    if (!tx.id) return null;
                    const defaultMonth = debitMonths[tx.id] || getMonthFromDateStr(tx.data) || monthOptions[0];
                    const defaultCl = debitClassifications[tx.id] || 'Custo Variável';
                    const isSaving = debitSavings[tx.id] || false;

                    return (
                      <motion.div
                        key={tx.id}
                        layout
                        className="bg-white border hover:border-slate-300 rounded-3xl p-5 shadow-sm transition-all space-y-4"
                      >
                        {/* Summary details */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                              <ArrowDownCircle className="w-5 h-5" />
                            </div>
                            <div>
                              <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">{tx.descricao}</h5>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {tx.data} • Categoria sugerida extraída: <span className="text-slate-500 font-black">{tx.categoria}</span>
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4.5 shrink-0 ml-auto md:ml-0">
                            <div className="text-base font-black text-slate-900 tabular-nums uppercase tracking-tight">
                              - {formatCurrency(tx.valor)}
                            </div>
                            
                            {/* Inline Delete Button with Two-Step Click Confirmation */}
                            {deletingTxId === tx.id ? (
                              <div className="flex items-center gap-1 bg-rose-50 border border-rose-100 p-1 rounded-xl">
                                <span className="text-[9px] font-black uppercase text-rose-600 px-1.5 animate-pulse">Excluir?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBankTransaction(tx.id!, tx)}
                                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg p-1.5 cursor-pointer text-xs font-bold uppercase flex items-center justify-center"
                                  title="Confirmar exclusão permanente"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingTxId(null)}
                                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg p-1.5 cursor-pointer flex items-center justify-center"
                                  title="Cancelar"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeletingTxId(tx.id!)}
                                className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                                title="Excluir lançamento do extrato"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Split vs Single Forms block */}
                        {splitStates[tx.id] ? (
                          <div className="bg-slate-50/60 rounded-2xl p-4.5 space-y-4 border border-slate-200/60">
                            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                              <div className="flex items-center gap-2">
                                <Bookmark className="w-3.5 h-3.5 text-blue-500" />
                                <h6 className="text-[10px] font-black uppercase text-slate-700 tracking-wider">Desmembrando Débito em Parcelas</h6>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCancelSplit(tx.id!)}
                                className="text-[10px] font-black uppercase tracking-tight text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <X className="w-3 h-3" />
                                <span>Cancelar</span>
                              </button>
                            </div>

                            <div className="space-y-3">
                              {(splitStates[tx.id] || []).map((item, idx) => {
                                const itemCl = item.classification || 'Custo Variável';
                                const subcats = classificationSubcategories[itemCl] || ['OUTROS'];

                                return (
                                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-3 border border-slate-100 rounded-2xl">
                                    {/* Row marker */}
                                    <div className="md:col-span-1 flex items-center justify-center text-[10px] font-extrabold text-slate-400 bg-slate-50 w-6 h-6 rounded-lg self-center">
                                      #{idx + 1}
                                    </div>

                                    {/* Classification */}
                                    <div className="md:col-span-3">
                                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Grupo</label>
                                      <select
                                        value={item.classification}
                                        onChange={(e) => {
                                          handleUpdateSplitItem(tx.id!, idx, 'classification', e.target.value);
                                          handleUpdateSplitItem(tx.id!, idx, 'subcategorySelection', '');
                                          handleUpdateSplitItem(tx.id!, idx, 'customDetails', '');
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
                                      >
                                        {uniqueClassifications.map(cl => (
                                          <option key={cl} value={cl}>{cl}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Subcategory */}
                                    <div className="md:col-span-3">
                                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subcategoria</label>
                                      <select
                                        value={item.subcategorySelection}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          handleUpdateSplitItem(tx.id!, idx, 'subcategorySelection', val);
                                          if (val !== 'OUTROS') {
                                            handleUpdateSplitItem(tx.id!, idx, 'customDetails', '');
                                            // Auto-assign group if matched
                                            const matchedCl = expenseDetailToClassification[val];
                                            if (matchedCl) {
                                              handleUpdateSplitItem(tx.id!, idx, 'classification', matchedCl);
                                            }
                                          }
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
                                      >
                                        <option value="">Selecione...</option>
                                        {allFinancialExpenseDetails.map(sub => (
                                          <option key={sub} value={sub}>{sub}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Custom details */}
                                    <div className="md:col-span-2">
                                      {item.subcategorySelection === 'OUTROS' ? (
                                        <div>
                                          <label className="text-[8px] font-black text-rose-500 uppercase tracking-widest block mb-1">Detalhe Custom</label>
                                          <input
                                            type="text"
                                            placeholder="Detalhe..."
                                            value={item.customDetails}
                                            onChange={(e) => handleUpdateSplitItem(tx.id!, idx, 'customDetails', e.target.value)}
                                            className="w-full bg-rose-50/20 border border-rose-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-800 uppercase outline-none"
                                          />
                                        </div>
                                      ) : (
                                        <div className="hidden md:block text-[10px] text-slate-300 italic text-center pb-2">—</div>
                                      )}
                                    </div>

                                    {/* Value */}
                                    <div className="md:col-span-2">
                                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor (R$)</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0,00"
                                        value={item.valor || ''}
                                        onChange={(e) => handleUpdateSplitItem(tx.id!, idx, 'valor', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-800 tabular-nums outline-none"
                                      />
                                    </div>

                                    {/* Delete Row button */}
                                    <div className="md:col-span-1 flex justify-center pb-1">
                                      <button
                                        type="button"
                                        disabled={(splitStates[tx.id] || []).length <= 1}
                                        onClick={() => handleRemoveSplitItem(tx.id!, idx)}
                                        className="text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-all p-1.5 cursor-pointer"
                                        title="Remover parcela"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Actions and Validation info */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-200/80">
                              <button
                                type="button"
                                onClick={() => handleAddSplitItem(tx.id!)}
                                className="w-full sm:w-auto bg-white border hover:bg-slate-50 text-slate-600 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Nova Parcela</span>
                              </button>

                              {(() => {
                                const currentSplits = splitStates[tx.id] || [];
                                const sum = currentSplits.reduce((acc, c) => acc + (c.valor || 0), 0);
                                const diff = tx.valor - sum;
                                const isMatched = Math.abs(diff) < 0.01;

                                return (
                                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto justify-end">
                                    <div className="text-right">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Fração totalizada: <span className={cn("font-black text-xs", isMatched ? "text-emerald-600" : "text-amber-500")}>
                                          {formatCurrency(sum)} / {formatCurrency(tx.valor)}
                                        </span>
                                      </p>
                                      {!isMatched && (
                                        <p className="text-[9px] font-semibold text-slate-500 mt-0.5">
                                          {diff > 0 
                                            ? `Resta alocar: ${formatCurrency(diff)}`
                                            : `Passou do limite por: ${formatCurrency(Math.abs(diff))}`
                                          }
                                        </p>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      disabled={isSaving || !isMatched}
                                      onClick={() => handleReconcileSplit(tx.id!, tx)}
                                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer"
                                    >
                                      {isSaving ? (
                                        <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Check className="w-3.5 h-3.5" />
                                      )}
                                      <span>Salvar Desmembramento</span>
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Reconstruction actions block */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
                              
                              {/* Competence Month */}
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                  Mês de Fluxo (Competência)
                                </label>
                                <select
                                  value={defaultMonth}
                                  onChange={(e) => setDebitMonths(prev => ({ ...prev, [tx.id!]: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 cursor-pointer shadow-sm transition-all"
                                >
                                  {monthOptions.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Classification (category) */}
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                  Grupo de Classificação
                                </label>
                                <select
                                  value={defaultCl}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDebitClassifications(prev => ({ ...prev, [tx.id!]: val }));
                                    // Reset subcategory selections for this card to prevent illegal inputs
                                    setDebitSubcategorySelections(prev => ({ ...prev, [tx.id!]: '' }));
                                    setDebitCustomDetails(prev => ({ ...prev, [tx.id!]: '' }));
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 cursor-pointer shadow-sm transition-all"
                                >
                                  {uniqueClassifications.map(cl => (
                                    <option key={cl} value={cl}>{cl}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Smart Subcategory / Detalhes Dropdown */}
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                  Subcategoria do Custo
                                </label>
                                <select
                                  value={debitSubcategorySelections[tx.id] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDebitSubcategorySelections(prev => ({ ...prev, [tx.id!]: val }));
                                    if (val !== 'OUTROS') {
                                      setDebitCustomDetails(prev => ({ ...prev, [tx.id!]: '' }));
                                      // Auto-assign group if matched
                                      const matchedCl = expenseDetailToClassification[val];
                                      if (matchedCl) {
                                        setDebitClassifications(prev => ({ ...prev, [tx.id!]: matchedCl }));
                                      }
                                    }
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-850 uppercase cursor-pointer shadow-sm transition-all"
                                >
                                  <option value="">Selecione...</option>
                                  {allFinancialExpenseDetails.map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Free-text field (shown ONLY when OUTROS is selected) */}
                              {debitSubcategorySelections[tx.id] === 'OUTROS' ? (
                                <div>
                                  <label className="text-[9px] font-black text-rose-500 uppercase tracking-widest block mb-1 animate-pulse">
                                    Digite os Detalhes do Custo
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="ALUGUEL, ENERGIA, ETC..."
                                    value={debitCustomDetails[tx.id] || ''}
                                    onChange={(e) => setDebitCustomDetails(prev => ({ ...prev, [tx.id!]: e.target.value }))}
                                    className="w-full bg-rose-50/20 hover:bg-rose-50/40 focus:bg-white border border-rose-200 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-black text-slate-800 uppercase tracking-wider shadow-sm transition-all"
                                  />
                                </div>
                              ) : (
                                <div className="hidden xl:block" />
                              )}

                              {/* Trigger check button */}
                              <div className="flex justify-end sm:col-span-2 lg:col-span-1">
                                <button
                                  type="button"
                                  disabled={isSaving || !(debitSubcategorySelections[tx.id] === 'OUTROS' ? debitCustomDetails[tx.id]?.trim() : debitSubcategorySelections[tx.id])}
                                  onClick={() => handleReconcileDebit(tx.id!, tx)}
                                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/10"
                                >
                                  {isSaving ? (
                                    <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                  <span>Conciliar Débito</span>
                                </button>
                              </div>
                            </div>

                            {/* Option to switch to Split method */}
                            <div className="mt-3.5 pt-3.5 border-t border-slate-50 text-center">
                              <button
                                type="button"
                                onClick={() => handleInitializeSplit(tx.id!, tx.valor)}
                                className="text-[10px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-800 transition-all flex items-center justify-center gap-1.5 mx-auto bg-blue-50 hover:bg-blue-100/80 px-4 py-2 rounded-xl border border-blue-100"
                              >
                                <FolderOpen className="w-3.5 h-3.5" />
                                <span>Desmembrar em múltiplos lançamentos (Ex: Fatura de Cartão)</span>
                              </button>
                            </div>
                          </>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white border-2 border-dashed border-slate-100 rounded-3xl py-16 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Tudo em dia!</h4>
                  <p className="text-xs text-slate-400">Nenhum débito pendente para conciliação.</p>
                </div>
              )}
            </div>
          )}


          {/* SUBTAB 2: CREDITS (RECEITAS - IN GROUPS) */}
          {reconcileTab === 'credits' && (
            <div className="space-y-4">
              <div className="p-4.5 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Faturamento Agrupado (Entradas)</h4>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">Selecione múltiplas receitas do extrato para lançar em grupo de uma única vez.</p>
                </div>
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  Total pendente: <span className="text-emerald-600 font-bold tabular-nums">{formatCurrency(unreconciledTotals.creditsValue)}</span>
                </div>
              </div>



              {/* FLOATING ACTION PANEL FOR THE SELECTED GROUP */}
              {selectedCreditsCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="p-5 bg-gradient-to-tr from-slate-900 to-slate-800 text-white rounded-3xl shadow-xl flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-6"
                >
                  <div className="space-y-3">
                    <span className="text-[8px] font-black uppercase tracking-widest text-blue-400 bg-blue-950 border border-blue-900 px-2 py-0.5 rounded-md">
                      Grupo Selecionado para Receita
                    </span>
                    <h4 className="text-sm font-black uppercase">{selectedCreditsCount} transações marcadas</h4>
                    <p className="text-base font-black text-emerald-400 tabular-nums">
                      Faturamento Total: {formatCurrency(selectedCreditsTotal)}
                    </p>
                  </div>

                  {/* Input form parameters inline for combining */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 xl:flex-1 max-w-2xl items-end text-slate-800">
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2 text-slate-300">
                        Mês de Referência
                      </label>
                      <select
                        value={creditGroupMonth}
                        onChange={(e) => setCreditGroupMonth(e.target.value)}
                        className="w-full bg-white border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold shadow-sm cursor-pointer outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {monthOptions.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2 text-slate-300">
                        Subcategoria de Faturamento
                      </label>
                      <select
                        value={creditGroupSubcategorySel}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreditGroupSubcategorySel(val);
                          if (val !== 'OUTROS') {
                            setCreditGroupCustomDetails('');
                          }
                        }}
                        className="w-full bg-white border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 uppercase cursor-pointer outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione...</option>
                        {creditSubcategories.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>

                    {creditGroupSubcategorySel === 'OUTROS' && (
                      <div>
                        <label className="text-[8px] font-black text-rose-400 uppercase tracking-widest block mb-2 animate-pulse">
                          Digite os Detalhes do Faturamento
                        </label>
                        <input
                          type="text"
                          placeholder="PIX EXCEPCIONAL, APORTE, ETC..."
                          value={creditGroupCustomDetails}
                          onChange={(e) => setCreditGroupCustomDetails(e.target.value)}
                          className="w-full bg-white border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-black text-slate-850 uppercase outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2 md:col-span-1">
                      <button
                        type="button"
                        disabled={isSavingCreditGroup || !(creditGroupSubcategorySel === 'OUTROS' ? creditGroupCustomDetails.trim() : creditGroupSubcategorySel)}
                        onClick={handleGroupReconcileCredits}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
                      >
                        {isSavingCreditGroup ? (
                          <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Agrupar Receita</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {creditGroupMessage && (
                <div className="p-3 bg-blue-50 text-blue-800 text-[10px] font-black rounded-2xl border border-blue-100 text-center uppercase tracking-wider animate-pulse">
                  {creditGroupMessage}
                </div>
              )}

              {/* LIST OF UNRECONCILED CREDITS */}
              {unreconciledCredits.length > 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="py-4 px-6 w-12 text-center">
                            <input
                              type="checkbox"
                              checked={areAllCreditsSelected}
                              onChange={(e) => handleToggleAllCredits(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </th>
                          <th className="py-4 px-4">Data</th>
                          <th className="py-4 px-4">Descrição do Lançamento</th>
                          <th className="py-4 px-4">Categoria Original</th>
                          <th className="py-4 px-6 text-right">Valor Crédito (R$)</th>
                          <th className="py-4 px-6 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs text-slate-800">
                        {unreconciledCredits.map(tx => {
                          if (!tx.id) return null;
                          const isSelected = selectedCreditIds[tx.id] === true;

                          const toggleRow = () => {
                            setSelectedCreditIds(prev => ({
                              ...prev,
                              [tx.id!]: !isSelected
                            }));
                          };

                          return (
                            <tr
                              key={tx.id}
                              onClick={toggleRow}
                              className={cn(
                                "hover:bg-slate-50/50 cursor-pointer transition-colors",
                                isSelected ? "bg-emerald-500/[0.04] text-emerald-950 font-bold" : ""
                              )}
                            >
                              <td className="py-3.5 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleRow()}
                                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-3.5 px-4 font-bold text-slate-500 whitespace-nowrap">{tx.data}</td>
                              <td className="py-3.5 px-4 uppercase font-bold text-slate-800 tracking-wide max-w-xs truncate">{tx.descricao}</td>
                              <td className="py-3.5 px-4">
                                <span className="bg-slate-100 text-slate-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
                                  {tx.categoria}
                                </span>
                              </td>
                              <td className="py-3.5 px-6 text-right font-black text-emerald-600 tabular-nums">
                                + {formatCurrency(tx.valor)}
                              </td>
                              <td className="py-3.5 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                                {deletingTxId === tx.id ? (
                                  <div className="flex items-center justify-center gap-1 bg-rose-50 border border-rose-100 p-0.5 rounded-lg inline-flex">
                                    <span className="text-[8px] font-black uppercase text-rose-600 px-1.5 animate-pulse">Apagar?</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBankTransaction(tx.id!, tx)}
                                      className="bg-rose-600 hover:bg-rose-700 text-white rounded p-1 cursor-pointer flex items-center justify-center"
                                      title="Confirmar exclusão permanente"
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingTxId(null)}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 rounded p-1 cursor-pointer flex items-center justify-center"
                                      title="Cancelar"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingTxId(tx.id!)}
                                    className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded transition-colors cursor-pointer inline-flex items-center justify-center"
                                    title="Excluir lançamento do extrato"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white border-2 border-dashed border-slate-100 rounded-3xl py-16 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Tudo em dia!</h4>
                  <p className="text-xs text-slate-400">Nenhum faturamento de crédito pendente para agrupamento.</p>
                </div>
              )}
            </div>
          )}


          {/* SUBTAB 3: HISTORY (CONCILIADOS) */}
          {reconcileTab === 'history' && (
            <div className="space-y-4">
              <div className="p-4.5 bg-slate-50 border border-slate-100 rounded-3xl">
                <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Histórico de Transações Conciliadas</h4>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">Veja tudo o que já foi reconciliado no fluxo de caixa e reverta lançamentos se necessário.</p>
              </div>

              {reconciledTransactions.length > 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="py-4 px-6">Data</th>
                          <th className="py-4 px-4">Descrição Original</th>
                          <th className="py-4 px-4">Destino no Fluxo (Mês)</th>
                          <th className="py-4 px-4">Alocação / Tipo</th>
                          <th className="py-4 px-4 text-right">Valor</th>
                          <th className="py-4 px-6 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs text-slate-800">
                        {reconciledTransactions.map(tx => {
                          if (!tx.id) return null;
                          const isCredit = tx.tipo === 'Entrada';

                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-4 px-6 font-bold text-slate-400 whitespace-nowrap">{tx.data}</td>
                              <td className="py-4 px-4">
                                <h5 className="font-bold text-slate-800 uppercase tracking-wide max-w-[200px] md:max-w-xs truncate">
                                  {tx.descricao}
                                </h5>
                              </td>
                              <td className="py-4 px-4">
                                <span className="bg-blue-50/50 border border-blue-100 text-blue-700 font-bold text-[10px] px-2 py-1 rounded-md">
                                  {tx.reconciledMonth}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <div>
                                  <span className={cn(
                                    "text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wide text-xs",
                                    isCredit ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                                  )}>
                                    {tx.reconciledClassification || 'Geral'}
                                  </span>
                                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                    {tx.reconciledDetails}
                                  </p>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <span className={cn(
                                  "font-black tabular-nums",
                                  isCredit ? "text-emerald-600" : "text-rose-600"
                                )}>
                                  {isCredit ? '+' : '-'}{formatCurrency(tx.valor)}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleUndoReconciliation(tx)}
                                  className="mx-auto flex items-center justify-center gap-1.5 px-3 py-1.5 border border-transparent hover:border-slate-200 text-rose-600 hover:bg-rose-50 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                  title="Remover classificação e reverter transação para a lista de pendentes"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                  <span>Desfazer</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white border-2 border-dashed border-slate-100 rounded-3xl py-16 text-center space-y-2">
                  <FolderOpen className="w-10 h-10 text-slate-200 mx-auto" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Nenhum lançamento conciliado ainda.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
