import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PackageCheck, 
  Store, 
  Warehouse, 
  Search, 
  Save, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  ArrowLeft, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Clock, 
  User, 
  Lock, 
  Check, 
  Sparkles,
  Info,
  Calendar,
  AlertCircle,
  ChefHat,
  ThumbsUp,
  X,
  ChevronRight,
  Pencil,
  Settings,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { 
  doc, 
  updateDoc, 
  collection, 
  addDoc, 
  serverTimestamp, 
  writeBatch, 
  getDocs, 
  getDoc,
  setDoc,
  deleteDoc,
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAction } from '../lib/logs';
import { StockItem, PurchaseRequest } from '../types';
import { cn, formatCurrency, getDataPath, getBasePath } from '../lib/utils';
import { 
  PREDEFINED_STOCK_ITEMS, 
  PredefinedStockItem, 
  isCakeProduction, 
  CAKE_PRODUCTION_NAMES,
  StockCountType,
  CountLocation
} from '../data/kioskStockList';

interface StockCountingProps {
  stockData: StockItem[];
  userId: string;
  userRole?: string;
  onBack?: () => void;
  onNavigateToPurchases?: () => void;
  isQrSession?: boolean;
}

type SingleLocation = 'quiosque' | 'deposito';

interface ItemLocalCount {
  quantidade: number;
  temAberto: boolean;
  caixasFechadas: number;
  avulsos: number;
  statusBastante?: 'bastante' | 'pedir';
  modificado: boolean;
}

const LOCAL_STORAGE_CUSTOM_ITEMS = 'kiosk_custom_stock_items_v4';
const LOCAL_STORAGE_LAST_COUNT_QUIOSQUE = 'kiosk_last_count_quiosque_ts';
const LOCAL_STORAGE_LAST_COUNT_DEPOSITO = 'kiosk_last_count_deposito_ts';
const LOCAL_STORAGE_DRAFT_QUIOSQUE = 'kiosk_count_draft_quiosque_v5';
const LOCAL_STORAGE_DRAFT_DEPOSITO = 'kiosk_count_draft_deposito_v5';

// 5 dias em milissegundos: 5 * 24 * 60 * 60 * 1000 = 432.000.000 ms
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export const StockCounting: React.FC<StockCountingProps> = ({
  stockData,
  userId,
  userRole = 'user',
  onBack,
  onNavigateToPurchases,
  isQrSession = false
}) => {
  const isAdmin = userRole === 'admin';

  // Catálogo oficial de itens de contagem (carregado do Firestore com fallback para PREDEFINED_STOCK_ITEMS)
  const [stockItems, setStockItems] = useState<PredefinedStockItem[]>(PREDEFINED_STOCK_ITEMS);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('Todas');
  const [catalogLocation, setCatalogLocation] = useState('todos');

  // Modal para adicionar/editar produto no catálogo
  const [editingCatalogItem, setEditingCatalogItem] = useState<PredefinedStockItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [formData, setFormData] = useState({
    produto: '',
    categoria: 'Gelados & Doces',
    local: 'ambos' as CountLocation,
    tipoContagem: 'unidade' as StockCountType,
    minimo: 10,
    unidadeMedida: 'un',
    tamanhoCaixa: 12,
    rotuloEmbalagem: 'caixa'
  });

  const [stockStaffList, setStockStaffList] = useState<string[]>(['Ariane', 'Barbara', 'Breno', 'Diogo', 'Free Lancer', 'Nathan', 'Alicia']);

  useEffect(() => {
    const fetchStockConfig = async () => {
      try {
        const q = query(collection(db, getDataPath('stockCountConfig')));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const loaded: PredefinedStockItem[] = [];
          snap.forEach(d => {
            loaded.push({ id: d.id, ...d.data() } as PredefinedStockItem);
          });
          if (loaded.length > 0) {
            loaded.sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR', { sensitivity: 'base' }));
            setStockItems(loaded);
          }
        }
      } catch (err) {
        console.error('Error fetching stock config:', err);
      }
    };
    fetchStockConfig();

    const fetchStockStaff = async () => {
      try {
        const snap = await getDocs(collection(db, getDataPath('systemStaff')));
        if (!snap.empty) {
          const names: string[] = [];
          snap.forEach(d => {
            const data = d.data();
            const allowed = data.allowedModules;
            if (!allowed || allowed.includes('stockCounting')) {
              if (data.nome) names.push(data.nome);
            }
          });
          if (names.length > 0) {
            setStockStaffList(names.sort((a, b) => a.localeCompare(b, 'pt-BR')));
          }
        }
      } catch (err) {
        console.error('Error fetching stock staff:', err);
      }
    };
    fetchStockStaff();
  }, []);

  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    cats.add('Todas');
    stockItems.forEach(i => {
      if (i.categoria) cats.add(i.categoria);
    });
    return Array.from(cats);
  }, [stockItems]);

  const filteredCatalogItems = useMemo(() => {
    return stockItems.filter(item => {
      const matchName = catalogSearch.trim() === '' || item.produto.toLowerCase().includes(catalogSearch.toLowerCase().trim());
      const matchCat = catalogCategory === 'Todas' || item.categoria === catalogCategory;
      const matchLoc = catalogLocation === 'todos' || item.local === catalogLocation || (catalogLocation === 'deposito' && (item.local === 'deposito' || item.local === 'estoque')) || item.local === 'ambos';
      return matchName && matchCat && matchLoc;
    });
  }, [stockItems, catalogSearch, catalogCategory, catalogLocation]);



  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.produto.trim()) {
      alert('Informe o nome do produto.');
      return;
    }
    try {
      const id = editingCatalogItem ? editingCatalogItem.id : formData.produto.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
      const itemToSave: PredefinedStockItem = {
        id,
        produto: formData.produto.trim(),
        categoria: formData.categoria,
        local: formData.local,
        tipoContagem: formData.tipoContagem,
        minimo: Number(formData.minimo) || 10,
        unidadeMedida: formData.unidadeMedida.trim() || 'un',
        tamanhoCaixa: formData.tipoContagem === 'caixa_ou_avulso' || formData.tipoContagem === 'embalagem_com_aberto' ? Number(formData.tamanhoCaixa) || 1 : undefined,
        rotuloEmbalagem: formData.tipoContagem === 'caixa_ou_avulso' || formData.tipoContagem === 'embalagem_com_aberto' ? (formData.rotuloEmbalagem.trim() || 'caixa') : undefined
      };

      await setDoc(doc(db, getDataPath('stockCountConfig'), id), itemToSave);
      setStockItems(prev => {
        const exists = prev.find(p => p.id === id);
        if (exists) {
          return prev.map(p => p.id === id ? itemToSave : p);
        } else {
          return [...prev, itemToSave].sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR', { sensitivity: 'base' }));
        }
      });
      await logAction(editingCatalogItem ? 'Edição' : 'Criação', 'Catálogo Estoque', `${editingCatalogItem ? 'Atualizou' : 'Adicionou'} item "${itemToSave.produto}" no catálogo de contagem`, getDataPath('stockCountConfig'), id, itemToSave);
      
      setEditingCatalogItem(null);
      setIsAddingItem(false);
      setFormData({
        produto: '',
        categoria: 'Gelados & Doces',
        local: 'ambos',
        tipoContagem: 'unidade',
        minimo: 10,
        unidadeMedida: 'un',
        tamanhoCaixa: 12,
        rotuloEmbalagem: 'caixa'
      });
    } catch (err) {
      console.error('Erro ao salvar item do catálogo:', err);
      alert('Erro ao salvar item no Firestore.');
    }
  };

  const handleDeleteCatalogItem = async (id: string, produtoName: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${produtoName}" do catálogo?`)) return;
    try {
      await deleteDoc(doc(db, getDataPath('stockCountConfig'), id));
      setStockItems(prev => prev.filter(p => p.id !== id));
      await logAction('Exclusão', 'Catálogo Estoque', `Removeu item "${produtoName}" do catálogo de contagem`, getDataPath('stockCountConfig'), id, { produto: produtoName });
    } catch (err) {
      console.error('Erro ao excluir item do catálogo:', err);
      alert('Erro ao excluir item.');
    }
  };

  // Overrides de estoque mínimo configurados por admin
  const [minimoOverrides, setMinimoOverrides] = useState<Record<string, number>>({});
  const [editingMinId, setEditingMinId] = useState<string | null>(null);
  const [editingMinVal, setEditingMinVal] = useState<string>('');

  useEffect(() => {
    const fetchMinimoOverrides = async () => {
      try {
        const q = query(collection(db, getDataPath('stockMinimumOverrides')));
        const snap = await getDocs(q);
        const map: Record<string, number> = {};
        snap.forEach(d => {
          map[d.id] = d.data().minimo;
        });
        setMinimoOverrides(map);
      } catch (err) {
        console.error('Error fetching minimum overrides:', err);
      }
    };
    fetchMinimoOverrides();
  }, []);

  const getEffectiveMin = (item: PredefinedStockItem) => {
    return minimoOverrides[item.id] !== undefined ? minimoOverrides[item.id] : item.minimo;
  };

  const handleSaveMinimo = async (item: PredefinedStockItem) => {
    const num = parseFloat(editingMinVal);
    if (isNaN(num) || num < 0) {
      alert('Informe um valor numérico válido.');
      return;
    }
    try {
      const ref = doc(db, getDataPath('stockMinimumOverrides'), item.id);
      await setDoc(ref, { minimo: num, updatedAt: serverTimestamp() }, { merge: true });
      setMinimoOverrides(prev => ({ ...prev, [item.id]: num }));
      await logAction('Edição', 'Estoque Mínimo', `Alterado estoque mínimo de "${item.produto}" para ${num} ${item.unidadeMedida}`, getDataPath('stockMinimumOverrides'), item.id, { minimo: num });
      setEditingMinId(null);
      setEditingMinVal('');
    } catch (err) {
      console.error('Erro ao salvar estoque mínimo:', err);
      alert('Erro ao salvar estoque mínimo.');
    }
  };

  // Limpeza de caches locais obsoletos
  useEffect(() => {
    try {
      localStorage.removeItem('kiosk_custom_stock_items_v4');
      localStorage.removeItem('kiosk_custom_stock_items_v3');
      localStorage.removeItem('kiosk_custom_stock_items_v2');
      localStorage.removeItem('kiosk_custom_stock_items');
    } catch {}
  }, []);

  // Detector de conectividade de rede
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Seleção de local (Quiosque ou Estoque / Depósito)
  const [activeLocation, setActiveLocation] = useState<SingleLocation>('quiosque');
  const [responsavelName, setResponsavelName] = useState<string>(() => {
    return localStorage.getItem('kiosk_last_counter_name') || '';
  });

  // Timestamps de última contagem
  const [lastCountQuiosque, setLastCountQuiosque] = useState<{ dateStr: string; timestamp: number } | null>(null);
  const [lastCountDeposito, setLastCountDeposito] = useState<{ dateStr: string; timestamp: number } | null>(null);
  const [forceUnlocked, setForceUnlocked] = useState(false);

  // Estados de contagem por item: itemId -> ItemLocalCount
  const [counts, setCounts] = useState<Record<string, ItemLocalCount>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  
  // Status de salvamento e feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedOrdersCount, setLastSavedOrdersCount] = useState<number | null>(null);
  const [lastSavedCakesCount, setLastSavedCakesCount] = useState<number | null>(null);

  // Fechar autopreenchimento ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsAutocompleteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Resetar a categoria selecionada e busca ao alternar de local
  useEffect(() => {
    setSelectedCategory('all');
    setIsAutocompleteOpen(false);
    setHighlightedIndex(-1);
  }, [activeLocation]);

  // Detectar as datas de última contagem salvas no stockData ou localStorage
  useEffect(() => {
    let latestQDate: Date | null = null;
    let latestDDate: Date | null = null;

    stockData.forEach(item => {
      if (item.dataContagemQuiosque) {
        const d = new Date(item.dataContagemQuiosque);
        if (!isNaN(d.getTime()) && (!latestQDate || d > latestQDate)) {
          latestQDate = d;
        }
      }
      if (item.dataContagemDeposito) {
        const d = new Date(item.dataContagemDeposito);
        if (!isNaN(d.getTime()) && (!latestDDate || d > latestDDate)) {
          latestDDate = d;
        }
      }
    });

    const localQ = localStorage.getItem(LOCAL_STORAGE_LAST_COUNT_QUIOSQUE);
    if (localQ) {
      const ts = parseInt(localQ, 10);
      if (!isNaN(ts) && (!latestQDate || ts > latestQDate.getTime())) {
        latestQDate = new Date(ts);
      }
    }

    const localD = localStorage.getItem(LOCAL_STORAGE_LAST_COUNT_DEPOSITO);
    if (localD) {
      const ts = parseInt(localD, 10);
      if (!isNaN(ts) && (!latestDDate || ts > latestDDate.getTime())) {
        latestDDate = new Date(ts);
      }
    }

    if (latestQDate) {
      setLastCountQuiosque({
        dateStr: (latestQDate as Date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        timestamp: (latestQDate as Date).getTime()
      });
    }

    if (latestDDate) {
      setLastCountDeposito({
        dateStr: (latestDDate as Date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        timestamp: (latestDDate as Date).getTime()
      });
    }
  }, [stockData]);

  // Verificar bloqueio de 5 dias
  const isQuiosqueLocked = useMemo(() => {
    if (forceUnlocked || isAdmin) return false;
    if (!lastCountQuiosque) return false;
    const now = Date.now();
    const diff = now - lastCountQuiosque.timestamp;
    return diff < FIVE_DAYS_MS;
  }, [lastCountQuiosque, isAdmin, forceUnlocked]);

  const quiosqueRemainingDays = useMemo(() => {
    if (!lastCountQuiosque) return 0;
    const diff = Date.now() - lastCountQuiosque.timestamp;
    const remainingMs = Math.max(0, FIVE_DAYS_MS - diff);
    return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  }, [lastCountQuiosque]);

  const isDepositoLocked = useMemo(() => {
    if (forceUnlocked || isAdmin) return false;
    if (!lastCountDeposito) return false;
    const now = Date.now();
    const diff = now - lastCountDeposito.timestamp;
    return diff < FIVE_DAYS_MS;
  }, [lastCountDeposito, isAdmin, forceUnlocked]);

  const depositoRemainingDays = useMemo(() => {
    if (!lastCountDeposito) return 0;
    const diff = Date.now() - lastCountDeposito.timestamp;
    const remainingMs = Math.max(0, FIVE_DAYS_MS - diff);
    return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  }, [lastCountDeposito]);

  const isCurrentLocationLocked = activeLocation === 'quiosque' ? isQuiosqueLocked : isDepositoLocked;

  // =========================================================================
  // REQUISITO ESTRITO: FILTRAGEM DE PRODUTOS PELO LOCAL
  // - "quando o local está quiosque, a categoria estoque está sem preenchimento, indicado que o item não deve aparecer quando o atendente estiver com o estou no estoque selecionado"
  // - No quiosque: itens com local 'quiosque' ou 'ambos'
  // - No estoque: itens com local 'estoque' / 'deposito' ou 'ambos' E com categoriaEstoque preenchida
  // =========================================================================
  const availableItemsForLocation = useMemo(() => {
    return stockItems
      .filter(item => {
        const loc = (item.local || '').toLowerCase().trim();
        if (activeLocation === 'quiosque') {
          return loc === 'quiosque' || loc === 'ambos';
        }
        if (activeLocation === 'deposito') {
          if (loc === 'quiosque') return false;
          return (loc === 'deposito' || loc === 'estoque' || loc === 'ambos') && !!(item.categoriaEstoque && item.categoriaEstoque.trim());
        }
        return false;
      })
      .sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR', { sensitivity: 'base' }));
  }, [stockItems, activeLocation]);

  // Contagens para os botões
  const quiosqueItemsCount = useMemo(() => {
    return stockItems.filter(item => {
      const loc = (item.local || '').toLowerCase().trim();
      return loc === 'quiosque' || loc === 'ambos';
    }).length;
  }, [stockItems]);

  const depositoItemsCount = useMemo(() => {
    return stockItems.filter(item => {
      const loc = (item.local || '').toLowerCase().trim();
      if (loc === 'quiosque') return false;
      return (loc === 'deposito' || loc === 'estoque' || loc === 'ambos') && !!(item.categoriaEstoque && item.categoriaEstoque.trim());
    }).length;
  }, [stockItems]);

  // =========================================================================
  // REQUISITO ESTRITO: CATEGORIAS POR LOCAL
  // Quiosque: usa categoriaQuiosque ("Freezer", "Expositor", "Embaixo Air Fryer", "Embaixo do Forno", "Gavetão", "Chá", "Embaixo da Pia", "Bebidas", "Delivery", "Outros")
  // Estoque: usa categoriaEstoque ("Café", "Insumos", "Doces", "Sachês", "Outros", "Uso Pessoal", "Descartáveis", "Limpeza", "Chá", "Bebidas", "Delivery")
  // =========================================================================
  const categories = useMemo(() => {
    const cats = new Set<string>();
    availableItemsForLocation.forEach(item => {
      const catName = activeLocation === 'quiosque' 
        ? item.categoriaQuiosque 
        : item.categoriaEstoque;
      if (catName && catName.trim() && catName.trim() !== '-') {
        cats.add(catName.trim());
      }
    });
    const sorted = Array.from(cats).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    return ['all', ...sorted];
  }, [availableItemsForLocation, activeLocation]);

  // Carregar contagens existentes (inicialização com rascunho local e em nuvem)
  useEffect(() => {
    const loadDrafts = async () => {
      const draftKey = activeLocation === 'quiosque' ? LOCAL_STORAGE_DRAFT_QUIOSQUE : LOCAL_STORAGE_DRAFT_DEPOSITO;
      const savedDraft = localStorage.getItem(draftKey);
      let draftParsed: Record<string, ItemLocalCount> = {};
      if (savedDraft) {
        try {
          draftParsed = JSON.parse(savedDraft);
        } catch {}
      }

      // Tentar carregar rascunho compartilhado da nuvem (permite continuar em outro celular/dispositivo)
      try {
        const cloudRef = doc(db, getDataPath('stockDrafts'), activeLocation);
        const cloudSnap = await getDoc(cloudRef);
        if (cloudSnap.exists()) {
          const cloudData = cloudSnap.data();
          if (cloudData && cloudData.counts) {
            draftParsed = { ...draftParsed, ...cloudData.counts };
            localStorage.setItem(draftKey, JSON.stringify(draftParsed));
          }
        }
      } catch (err) {
        console.warn('Could not load cloud stock draft:', err);
      }

      const initial: Record<string, ItemLocalCount> = {};

      stockItems.forEach(def => {
        const matchDb = stockData.find(s => 
          s.produto.toLowerCase().trim() === def.produto.toLowerCase().trim() ||
          (def.id && s.id === def.id)
        );

        const dbVal = activeLocation === 'quiosque' 
          ? (matchDb?.estoqueQuiosque ?? 0)
          : (matchDb?.estoqueDeposito ?? 0);

        const draftVal = draftParsed[def.id];

        if (draftVal) {
          initial[def.id] = draftVal;
        } else {
          let cx = 0;
          let av = 0;
          if (def.tipoContagem === 'caixa_ou_avulso') {
            if ((matchDb as any)?.caixasFechadas !== undefined && (matchDb as any)?.avulsos !== undefined) {
              cx = (matchDb as any).caixasFechadas ?? 0;
              av = (matchDb as any).avulsos ?? 0;
            } else if (def.tamanhoCaixa && def.tamanhoCaixa > 1) {
              cx = Math.floor(dbVal / def.tamanhoCaixa);
              av = dbVal % def.tamanhoCaixa;
            } else {
              cx = 0;
              av = dbVal;
            }
          }

          const totalQtyInitial = def.tipoContagem === 'caixa_ou_avulso'
            ? (cx * (def.tamanhoCaixa && def.tamanhoCaixa > 0 ? def.tamanhoCaixa : 1)) + av
            : dbVal;

          initial[def.id] = {
            quantidade: totalQtyInitial > 0 ? totalQtyInitial : dbVal,
            temAberto: false,
            caixasFechadas: cx,
            avulsos: av,
            statusBastante: def.tipoContagem === 'tem_bastante' ? 'bastante' : undefined,
            modificado: false
          };
        }
      });

      setCounts(initial);
    };
    loadDrafts();
  }, [activeLocation, stockData, stockItems]);

  // Salvar rascunho local e na nuvem toda vez que mudar
  const updateCountItem = (id: string, updater: (prev: ItemLocalCount) => ItemLocalCount) => {
    setCounts(prev => {
      const current = prev[id] || { quantidade: 0, temAberto: false, caixasFechadas: 0, avulsos: 0, modificado: false };
      const updated = updater(current);
      const next = { ...prev, [id]: updated };
      
      const draftKey = activeLocation === 'quiosque' ? LOCAL_STORAGE_DRAFT_QUIOSQUE : LOCAL_STORAGE_DRAFT_DEPOSITO;
      try {
        localStorage.setItem(draftKey, JSON.stringify(next));
      } catch {}

      // Sincronizar rascunho com a nuvem (Firestore) em background para handoff entre celulares
      setDoc(doc(db, getDataPath('stockDrafts'), activeLocation), {
        counts: next,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(err => console.warn('Error syncing draft to cloud:', err));

      return next;
    });
  };

  // Controles de Quantidade para Tipo A (Unidade Simples)
  const handleSimpleQuantity = (id: string, delta: number) => {
    updateCountItem(id, prev => {
      const nova = Math.max(0, (prev.quantidade || 0) + delta);
      return { ...prev, quantidade: nova, modificado: true };
    });
  };

  const handleSimpleDirectInput = (id: string, valueStr: string) => {
    const val = valueStr === '' ? 0 : parseFloat(valueStr);
    const safeVal = isNaN(val) ? 0 : Math.max(0, val);
    updateCountItem(id, prev => ({
      ...prev,
      quantidade: safeVal,
      modificado: true
    }));
  };

  // Controles para Tipo B (Garrafa / Pote / Caixa Fechada + Checkbox "Aberto (em uso)")
  const handlePackageWithOpenChange = (id: string, fechados: number, temAberto: boolean) => {
    const safeFechados = Math.max(0, fechados);
    updateCountItem(id, prev => ({
      ...prev,
      quantidade: safeFechados,
      temAberto: temAberto,
      modificado: true
    }));
  };

  // Controles para Tipo C (Caixas / Sacos / Fardos Fechados + Unidades)
  const handleBoxAndUnitChange = (id: string, caixas: number, avulsos: number, boxSize?: number) => {
    const safeCx = Math.max(0, caixas);
    const safeAv = Math.max(0, avulsos);
    const multiplier = boxSize && boxSize > 0 ? boxSize : 1;
    const total = (safeCx * multiplier) + safeAv;
    updateCountItem(id, prev => ({
      ...prev,
      caixasFechadas: safeCx,
      avulsos: safeAv,
      quantidade: total,
      modificado: true
    }));
  };

  const handleBoxDirectInput = (id: string, caixasStr: string, currentAvulsos: number, boxSize?: number) => {
    const parsed = caixasStr.trim() === '' ? 0 : parseInt(caixasStr, 10);
    handleBoxAndUnitChange(id, isNaN(parsed) ? 0 : parsed, currentAvulsos, boxSize);
  };

  const handleUnitDirectInput = (id: string, currentCaixas: number, avulsosStr: string, boxSize?: number) => {
    const parsed = avulsosStr.trim() === '' ? 0 : parseInt(avulsosStr, 10);
    handleBoxAndUnitChange(id, currentCaixas, isNaN(parsed) ? 0 : parsed, boxSize);
  };

  // Controles para Tipo D (Tem Bastante / Precisa Pedir - incluindo Sorvete)
  const handleStatusBastanteChange = (id: string, status: 'bastante' | 'pedir') => {
    updateCountItem(id, prev => ({
      ...prev,
      statusBastante: status,
      quantidade: status === 'bastante' ? 999 : 0,
      modificado: true
    }));
  };

  // Itens filtrados para exibição (sempre em ordem alfabética)
  const filteredItems = useMemo(() => {
    return availableItemsForLocation
      .filter(item => {
        const matchSearch = item.produto.toLowerCase().includes(searchTerm.toLowerCase().trim());
        const catName = (activeLocation === 'quiosque' 
          ? item.categoriaQuiosque 
          : item.categoriaEstoque) || '';
        const matchCat = selectedCategory === 'all' || catName === selectedCategory;

        const c = counts[item.id];
        const isChecked = c && (c.modificado || c.quantidade > 0 || c.temAberto || c.statusBastante);
        const matchPending = !showOnlyPending || !isChecked;

        return matchSearch && matchCat && matchPending;
      })
      .sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR', { sensitivity: 'base' }));
  }, [availableItemsForLocation, searchTerm, selectedCategory, activeLocation, counts, showOnlyPending]);

  // Sugestões de Autopreenchimento em tempo real enquanto digita
  const autocompleteSuggestions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return availableItemsForLocation
      .filter(item => item.produto.toLowerCase().includes(term))
      .sort((a, b) => {
        const aStarts = a.produto.toLowerCase().startsWith(term);
        const bStarts = b.produto.toLowerCase().startsWith(term);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.produto.localeCompare(b.produto, 'pt-BR', { sensitivity: 'base' });
      })
      .slice(0, 8);
  }, [availableItemsForLocation, searchTerm]);

  // Ao selecionar uma sugestão de autopreenchimento
  const handleSelectSuggestion = (item: PredefinedStockItem) => {
    setSearchTerm(item.produto);
    setIsAutocompleteOpen(false);
    setHighlightedIndex(-1);
    setSelectedCategory('all');

    setTimeout(() => {
      const el = document.getElementById(`item-card-${item.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-emerald-500', 'ring-offset-2', 'bg-emerald-50/70');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-emerald-500', 'ring-offset-2', 'bg-emerald-50/70');
        }, 2200);
      }
    }, 120);
  };

  // Navegação por teclado no input de busca
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isAutocompleteOpen || autocompleteSuggestions.length === 0) {
      if (e.key === 'ArrowDown' && autocompleteSuggestions.length > 0) {
        setIsAutocompleteOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % autocompleteSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + autocompleteSuggestions.length) % autocompleteSuggestions.length);
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && autocompleteSuggestions[highlightedIndex]) {
        e.preventDefault();
        handleSelectSuggestion(autocompleteSuggestions[highlightedIndex]);
      } else if (autocompleteSuggestions.length > 0) {
        e.preventDefault();
        handleSelectSuggestion(autocompleteSuggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsAutocompleteOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Destaque visual do termo digitado nas sugestões
  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const q = query.trim().toLowerCase();
    const index = text.toLowerCase().indexOf(q);
    if (index === -1) return <span>{text}</span>;
    const before = text.slice(0, index);
    const match = text.slice(index, index + q.length);
    const after = text.slice(index + q.length);
    return (
      <span>
        {before}
        <span className="font-black text-emerald-700 bg-emerald-100/90 px-0.5 rounded">
          {match}
        </span>
        {after}
      </span>
    );
  };

  // Estatísticas do formulário
  const stats = useMemo(() => {
    const totalItens = availableItemsForLocation.length;
    let preenchidos = 0;
    let abaixoMinimoEstimado = 0;

    availableItemsForLocation.forEach(def => {
      const c = counts[def.id];
      const effectiveMin = getEffectiveMin(def);
      if (c && (c.modificado || c.quantidade > 0 || c.temAberto || c.statusBastante)) {
        preenchidos++;
      }

      const matchingDb = stockData.find(s => s.produto.toLowerCase().trim() === def.produto.toLowerCase().trim());
      const otherLocationVal = activeLocation === 'quiosque' 
        ? (matchingDb?.estoqueDeposito ?? 0)
        : (matchingDb?.estoqueQuiosque ?? 0);
      const thisLocationVal = c ? c.quantidade : 0;
      const total = thisLocationVal + otherLocationVal;

      if (def.tipoContagem === 'tem_bastante') {
        const matchingDb = stockData.find(s => s.produto.toLowerCase().trim() === def.produto.toLowerCase().trim());
        const quiosqueStatus = activeLocation === 'quiosque' 
          ? (c?.statusBastante || 'bastante') 
          : ((matchingDb as any)?.statusBastanteQuiosque || 'bastante');
        const depositoStatus = activeLocation === 'deposito' 
          ? (c?.statusBastante || 'bastante') 
          : ((matchingDb as any)?.statusBastanteDeposito || 'bastante');

        let isPedir = false;
        if (def.local === 'quiosque') {
          isPedir = quiosqueStatus === 'pedir';
        } else if (def.local === 'deposito' || def.local === 'estoque') {
          isPedir = depositoStatus === 'pedir';
        } else {
          if (!(quiosqueStatus === 'bastante' || depositoStatus === 'bastante')) {
            isPedir = quiosqueStatus === 'pedir' || depositoStatus === 'pedir';
          }
        }
        if (isPedir) {
          abaixoMinimoEstimado++;
        }
      } else if (def.tipoContagem === 'embalagem_com_aberto') {
        if (effectiveMin === 1) {
          if (thisLocationVal === 0) {
            abaixoMinimoEstimado++;
          }
        } else {
          if (total <= effectiveMin) {
            abaixoMinimoEstimado++;
          }
        }
      } else {
        if (total <= effectiveMin) {
          abaixoMinimoEstimado++;
        }
      }
    });

    return {
      totalItens,
      preenchidos,
      abaixoMinimoEstimado
    };
  }, [availableItemsForLocation, counts, stockData, activeLocation]);

  // =========================================================================
  // SALVAR A CONTAGEM
  // =========================================================================
  const handleSaveLocationCount = async () => {
    if (isCurrentLocationLocked && !isAdmin) {
      setErrorMessage(`Esta contagem está bloqueada no momento. O intervalo mínimo é de 5 dias entre contagens.`);
      return;
    }

    if (!responsavelName.trim()) {
      setErrorMessage('Por favor, digite o nome de quem realizou a contagem.');
      return;
    }

    const allReviewed = stats.preenchidos === stats.totalItens;
    if (!allReviewed) {
      setErrorMessage(`Ainda há ${stats.totalItens - stats.preenchidos} itens pendentes de revisão. Todos os itens devem ser conferidos antes de finalizar.`);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(null);

    try {
      localStorage.setItem('kiosk_last_counter_name', responsavelName.trim());

      const now = new Date();
      const nowIso = now.toISOString();
      const nowDateBr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const nowTimestamp = now.getTime();

      const batch = writeBatch(db);
      const purchaseRequestsToCreate: any[] = [];
      let cakesProductionCount = 0;
      let regularOrdersCount = 0;
      let itemsUpdatedCount = 0;

      // Buscar pedidos de compra atualmente pendentes para evitar duplicados
      const pendingSnap = await getDocs(
        query(collection(db, getDataPath('purchaseRequests')), where('status', '==', 'pendente'))
      );
      const existingPendingMap = new Map<string, string>();
      pendingSnap.docs.forEach(docSnap => {
        const prod = (docSnap.data().produto || '').toLowerCase().trim();
        if (prod) {
          existingPendingMap.set(prod, docSnap.id);
        }
      });

      for (const def of availableItemsForLocation) {
        const c = counts[def.id];
        const newLocationQty = c ? c.quantidade : 0;
        const effectiveMin = getEffectiveMin(def);

        const existingItem = stockData.find(s => 
          s.produto.toLowerCase().trim() === def.produto.toLowerCase().trim() ||
          (s.id && s.id === def.id)
        );

        const currentQuiosque = activeLocation === 'quiosque' ? newLocationQty : (existingItem?.estoqueQuiosque ?? 0);
        const currentDeposito = activeLocation === 'deposito' ? newLocationQty : (existingItem?.estoqueDeposito ?? 0);
        const totalEstoque = currentQuiosque + currentDeposito;
        const custoUnit = existingItem?.custoUnitario || 0;

        if (existingItem?.id) {
          const itemRef = doc(db, getDataPath('stock'), existingItem.id);
          const updatePayload: any = {
            estoqueAtual: totalEstoque,
            valorTotal: totalEstoque * custoUnit,
            estoqueMinimo: effectiveMin,
            responsavelContagem: responsavelName.trim(),
            updatedAt: serverTimestamp()
          };

          if (def.tipoContagem === 'caixa_ou_avulso' && c) {
            updatePayload.caixasFechadas = c.caixasFechadas ?? 0;
            updatePayload.avulsos = c.avulsos ?? 0;
          }
          if (def.tipoContagem === 'embalagem_com_aberto' && c) {
            updatePayload.temAberto = c.temAberto ?? false;
          }
          if (def.tipoContagem === 'tem_bastante' && c) {
            if (activeLocation === 'quiosque') {
              updatePayload.statusBastanteQuiosque = c.statusBastante || 'bastante';
            } else {
              updatePayload.statusBastanteDeposito = c.statusBastante || 'bastante';
            }
          }

          if (activeLocation === 'quiosque') {
            updatePayload.estoqueQuiosque = newLocationQty;
            updatePayload.dataContagemQuiosque = nowIso;
          } else {
            updatePayload.estoqueDeposito = newLocationQty;
            updatePayload.dataContagemDeposito = nowIso;
          }

          batch.update(itemRef, updatePayload);
          itemsUpdatedCount++;
        } else {
          const newDocRef = doc(collection(db, getDataPath('stock')));
          batch.set(newDocRef, {
            produto: def.produto,
            estoqueAtual: totalEstoque,
            estoqueQuiosque: currentQuiosque,
            estoqueDeposito: currentDeposito,
            estoqueMinimo: effectiveMin,
            unidade: def.unidadeMedida,
            categoria: def.categoriaQuiosque || def.categoria || 'Geral',
            custoUnitario: custoUnit,
            valorTotal: totalEstoque * custoUnit,
            responsavelContagem: responsavelName.trim(),
            userId: getBasePath(),
            statusBastanteQuiosque: activeLocation === 'quiosque' ? (c?.statusBastante || 'bastante') : 'bastante',
            statusBastanteDeposito: activeLocation === 'deposito' ? (c?.statusBastante || 'bastante') : 'bastante',
            dataContagemQuiosque: activeLocation === 'quiosque' ? nowIso : null,
            dataContagemDeposito: activeLocation === 'deposito' ? nowIso : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          itemsUpdatedCount++;
        }

        // =========================================================================
        // REGRAS DE DISPARO DE SOLICITAÇÃO DE COMPRA / PRODUÇÃO
        // =========================================================================
        // Se estiver salvando o Quiosque, ignorar itens compartilhados com o Estoque/Depósito até que ambos estejam concluídos
        if (activeLocation === 'quiosque' && def.local !== 'quiosque') {
          continue;
        }

        let precisaPedir = false;
        let deficit = 0;
        let qtdFormatada = '';

        if (def.tipoContagem === 'tem_bastante') {
          const matchingDbForSave = stockData.find(s => s.produto.toLowerCase().trim() === def.produto.toLowerCase().trim());
          const quiosqueStatus = activeLocation === 'quiosque' 
            ? (c?.statusBastante || 'bastante') 
            : ((matchingDbForSave as any)?.statusBastanteQuiosque || 'bastante');
          const depositoStatus = activeLocation === 'deposito' 
            ? (c?.statusBastante || 'bastante') 
            : ((matchingDbForSave as any)?.statusBastanteDeposito || 'bastante');

          let shouldPedir = false;
          if (def.local === 'quiosque') {
            shouldPedir = quiosqueStatus === 'pedir';
          } else if (def.local === 'deposito' || def.local === 'estoque') {
            shouldPedir = depositoStatus === 'pedir';
          } else {
            if (!(quiosqueStatus === 'bastante' || depositoStatus === 'bastante')) {
              shouldPedir = quiosqueStatus === 'pedir' || depositoStatus === 'pedir';
            }
          }

          if (shouldPedir) {
            precisaPedir = true;
            deficit = 1;
            qtdFormatada = def.produto.toLowerCase().includes('sorvete') ? '1 balde' : '1 cx';
          }
        } else if (def.tipoContagem === 'embalagem_com_aberto') {
          if (effectiveMin === 1) {
            // Regra explícita: "para os itens com 1 no estoque minimo... na sessão de fechados e aberto, só quando não tiver nenhum fechado, apenas o aberto em uso..."
            if (newLocationQty === 0) {
              precisaPedir = true;
              deficit = 1;
              qtdFormatada = `1 ${def.rotuloEmbalagem || 'un'}`;
            }
          } else {
            if (totalEstoque <= effectiveMin) {
              precisaPedir = true;
              deficit = Math.max(1, effectiveMin - totalEstoque);
              qtdFormatada = `${deficit} ${def.rotuloEmbalagem || 'un'}`;
            }
          }
        } else {
          // Unidade simples ou Caixa/Avulso
          if (totalEstoque <= effectiveMin) {
            precisaPedir = true;
            deficit = Math.max(1, effectiveMin - totalEstoque);
            qtdFormatada = `${deficit} ${def.unidadeMedida}`;
          }
        }

        if (precisaPedir) {
          const isCake = def.ehBoloProducao || isCakeProduction(def.produto);
          const normalizedProdName = def.produto.toLowerCase().trim();
          const existingPendingId = existingPendingMap.get(normalizedProdName);

          if (isCake) {
            cakesProductionCount++;
            purchaseRequestsToCreate.push({
              existingId: existingPendingId,
              produto: def.produto,
              quantidade: `${deficit} un`,
              quantidadeNumerica: deficit,
              valorUnitario: custoUnit,
              valorTotal: deficit * custoUnit,
              status: 'pendente',
              tipoItem: 'producao',
              ehProducao: true,
              usuarioSolicitante: `${responsavelName.trim()} (Produção Necessária)`,
              dataSolicitacao: new Date().toISOString().split('T')[0],
              urgente: false,
              userId: getBasePath(),
              categoriaEstoque: def.categoriaQuiosque || 'Gelados & Doces',
              observacao: `Estoque mínimo: ${effectiveMin} un | Quiosque: ${currentQuiosque} | Depósito: ${currentDeposito} | Total: ${totalEstoque} un. Bolo a produzir internamente pela equipe.`
            });
          } else {
            regularOrdersCount++;
            purchaseRequestsToCreate.push({
              existingId: existingPendingId,
              produto: def.produto,
              quantidade: qtdFormatada,
              quantidadeNumerica: deficit,
              valorUnitario: custoUnit,
              valorTotal: deficit * custoUnit,
              status: 'pendente',
              tipoItem: 'compra',
              ehProducao: false,
              usuarioSolicitante: `${responsavelName.trim()} (Contagem ${activeLocation === 'quiosque' ? 'Quiosque' : 'Estoque'})`,
              dataSolicitacao: new Date().toISOString().split('T')[0],
              urgente: false,
              userId: getBasePath(),
              categoriaEstoque: def.categoriaQuiosque || 'Geral',
              observacao: `Estoque mínimo: ${effectiveMin} | Quiosque: ${currentQuiosque} | Depósito: ${currentDeposito} | Total: ${totalEstoque}`
            });
          }
        }
      }

      await batch.commit();

      if (purchaseRequestsToCreate.length > 0) {
        for (const req of purchaseRequestsToCreate) {
          try {
            const { existingId, ...reqData } = req;
            if (existingId) {
              await updateDoc(doc(db, getDataPath('purchaseRequests'), existingId), {
                ...reqData,
                updatedAt: serverTimestamp()
              });
            } else {
              await addDoc(collection(db, getDataPath('purchaseRequests')), {
                ...reqData,
                createdAt: serverTimestamp()
              });
            }
          } catch (err) {
            console.error('Erro ao adicionar pedido de compra / produção:', err);
          }
        }
      }

      try {
        const localNome = activeLocation === 'quiosque' ? 'Quiosque' : 'Estoque / Depósito';
        await logAction(
          'Edição',
          'Ajuste Estoque',
          `Contagem física realizada no ${localNome} por ${responsavelName.trim()}. ${purchaseRequestsToCreate.length} solicitações geradas (${cakesProductionCount} bolos a produzir, ${regularOrdersCount} compras externas).`,
          'stock',
          activeLocation,
          {
            local: activeLocation,
            totalItens: itemsUpdatedCount,
            pedidosCompraGerados: regularOrdersCount,
            bolosAProduzir: cakesProductionCount
          },
          responsavelName.trim()
        );
      } catch {}

      if (activeLocation === 'quiosque') {
        localStorage.setItem(LOCAL_STORAGE_LAST_COUNT_QUIOSQUE, nowTimestamp.toString());
        localStorage.removeItem(LOCAL_STORAGE_DRAFT_QUIOSQUE);
        setLastCountQuiosque({ dateStr: nowDateBr, timestamp: nowTimestamp });
      } else {
        localStorage.setItem(LOCAL_STORAGE_LAST_COUNT_DEPOSITO, nowTimestamp.toString());
        localStorage.removeItem(LOCAL_STORAGE_DRAFT_DEPOSITO);
        setLastCountDeposito({ dateStr: nowDateBr, timestamp: nowTimestamp });
      }

      try {
        await deleteDoc(doc(db, getDataPath('stockDrafts'), activeLocation));
      } catch {}

      setLastSavedOrdersCount(regularOrdersCount);
      setLastSavedCakesCount(cakesProductionCount);
      setSaveSuccess(`Contagem do ${activeLocation === 'quiosque' ? 'Quiosque' : 'Estoque'} salva com sucesso!`);
      
      setTimeout(() => {
        setSaveSuccess(null);
      }, 8000);

    } catch (error: any) {
      console.error('Erro ao salvar contagem:', error);
      setErrorMessage(`Erro ao salvar: ${error?.message || 'Tente novamente.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isAdmin && !isQrSession) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-32">
        {/* Header */}
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-7 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-md">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                Gestão do Catálogo de Contagem
              </h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                Adicione, edite ou remova produtos e configure estoques mínimos e locais
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
              {filteredCatalogItems.length} produtos
            </span>
          </div>
        </div>

        {/* Quick Filters & Add Button */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar produto (auto preenchimento)..."
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                value={catalogCategory}
                onChange={e => setCatalogCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
              >
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={catalogLocation}
                onChange={e => setCatalogLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos os Locais</option>
                <option value="quiosque">Quiosque</option>
                <option value="deposito">Estoque / Freezer</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {filteredCatalogItems.length} produto(s) encontrado(s)
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingCatalogItem(null);
                setIsAddingItem(true);
                setFormData({
                  produto: '',
                  categoria: 'Gelados & Doces',
                  local: 'ambos',
                  tipoContagem: 'unidade',
                  minimo: 10,
                  unidadeMedida: 'un',
                  tamanhoCaixa: 12,
                  rotuloEmbalagem: 'caixa'
                });
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Novo Produto</span>
            </button>
          </div>
        </div>

        {/* Add/Edit Form */}
        {(isAddingItem || editingCatalogItem) && (
          <div className="bg-white rounded-3xl p-6 border border-blue-200 shadow-lg">
            <form onSubmit={handleSaveCatalogItem} className="space-y-4">
              <h3 className="text-sm font-black text-blue-900 uppercase tracking-tight">
                {editingCatalogItem ? 'Editar Produto' : 'Adicionar Novo Produto ao Catálogo'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Nome do Produto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Granola 1kg"
                    value={formData.produto}
                    onChange={e => setFormData({ ...formData, produto: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Categoria</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Gelados & Doces"
                    value={formData.categoria}
                    onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Local de Contagem</label>
                  <select
                    value={formData.local}
                    onChange={e => setFormData({ ...formData, local: e.target.value as CountLocation })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    <option value="quiosque">Quiosque</option>
                    <option value="deposito">Estoque / Freezer</option>
                    <option value="ambos">Ambos (Quiosque e Estoque)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Modelo de Contagem</label>
                  <select
                    value={formData.tipoContagem}
                    onChange={e => setFormData({ ...formData, tipoContagem: e.target.value as StockCountType })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    <option value="unidade">Unidade Simples</option>
                    <option value="embalagem_com_aberto">Pacote + Aberto (ex: fardo)</option>
                    <option value="caixa_ou_avulso">Caixas + Avulso</option>
                    <option value="tem_bastante">Tem Bastante / Suficiente</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Estoque Mínimo</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.minimo}
                    onChange={e => setFormData({ ...formData, minimo: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Unidade de Medida</label>
                  <input
                    type="text"
                    required
                    placeholder="un, kg, pct..."
                    value={formData.unidadeMedida}
                    onChange={e => setFormData({ ...formData, unidadeMedida: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
                {(formData.tipoContagem === 'caixa_ou_avulso' || formData.tipoContagem === 'embalagem_com_aberto') && (
                  <>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                        Qtd por {formData.tipoContagem === 'caixa_ou_avulso' ? 'Caixa' : 'Embalagem'} (Ex: 12)
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.tamanhoCaixa}
                        onChange={e => setFormData({ ...formData, tamanhoCaixa: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                        Nome da Embalagem (Ex: caixa, fardo)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="caixa, fardo..."
                        value={formData.rotuloEmbalagem}
                        onChange={e => setFormData({ ...formData, rotuloEmbalagem: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddingItem(false); setEditingCatalogItem(null); }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List of items */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs divide-y divide-slate-100">
          {filteredCatalogItems.map(item => (
            <div key={item.id} className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 px-4 rounded-2xl transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-900">{item.produto}</h4>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase">
                    {item.categoria}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                    item.local === 'quiosque' ? "bg-emerald-50 text-emerald-700" : item.local === 'deposito' || item.local === 'estoque' ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                  )}>
                    {item.local === 'quiosque' ? 'Quiosque' : item.local === 'deposito' || item.local === 'estoque' ? 'Estoque' : 'Ambos'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Mínimo: <strong>{item.minimo} {item.unidadeMedida}</strong> | Tipo: {item.tipoContagem}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCatalogItem(item);
                    setIsAddingItem(false);
                    setFormData({
                      produto: item.produto,
                      categoria: item.categoria,
                      local: item.local,
                      tipoContagem: item.tipoContagem,
                      minimo: item.minimo,
                      unidadeMedida: item.unidadeMedida || 'un',
                      tamanhoCaixa: item.tamanhoCaixa || 12,
                      rotuloEmbalagem: item.rotuloEmbalagem || 'caixa'
                    });
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  title="Editar produto"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCatalogItem(item.id, item.produto)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  title="Excluir produto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filteredCatalogItems.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs font-bold uppercase tracking-wider">
              Nenhum produto encontrado com os filtros rápidos atuais.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-32">
      {/* Barra de Topo do Checklist */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Contagem de Estoque
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  {availableItemsForLocation.length} itens {activeLocation === 'quiosque' ? 'no Quiosque' : 'no Estoque'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Selecione o espaço que você vai contar agora (Quiosque ou Estoque).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Indicador Online/Offline */}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0",
              isOnline ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" : "bg-amber-50 text-amber-800 border border-amber-200/70"
            )}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 text-amber-600 animate-pulse" />}
              <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>

        {/* 1. SELEÇÃO DE LOCAL COM INDICAÇÃO DA ÚLTIMA CONTAGEM E TRAVA DE 5 DIAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* Botão Quiosque */}
          <button
            type="button"
            onClick={() => setActiveLocation('quiosque')}
            className={cn(
              "relative p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer",
              activeLocation === 'quiosque'
                ? "border-emerald-600 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500/20"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/50",
              isQuiosqueLocked && !isAdmin && "opacity-90"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "p-2.5 rounded-xl",
                  activeLocation === 'quiosque' ? "bg-emerald-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                )}>
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">1. Estou no Quiosque</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {quiosqueItemsCount} itens para conferência (Quiosque e Ambos)
                  </p>
                </div>
              </div>

              {isQuiosqueLocked && !isAdmin ? (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                  <Lock className="w-3 h-3 text-amber-600" />
                  Trava 5d
                </span>
              ) : (
                activeLocation === 'quiosque' && (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-600 text-white">
                    <Check className="w-3 h-3" />
                    Ativo
                  </span>
                )
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3 text-slate-400" />
                Última contagem:
              </span>
              <span className="font-bold text-slate-800 text-[11px]">
                {lastCountQuiosque ? lastCountQuiosque.dateStr : 'Nunca contado'}
              </span>
            </div>

            {isQuiosqueLocked && !isAdmin && (
              <div className="mt-2 text-[10px] text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200/80 flex items-center gap-1 font-medium">
                <Info className="w-3 h-3 shrink-0 text-amber-600" />
                <span>Liberado em <strong>{quiosqueRemainingDays} dia(s)</strong> para mitigar contagens duplicadas.</span>
              </div>
            )}
          </button>

          {/* Botão Estoque / Depósito */}
          <button
            type="button"
            onClick={() => setActiveLocation('deposito')}
            className={cn(
              "relative p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer",
              activeLocation === 'deposito'
                ? "border-emerald-600 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500/20"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/50",
              isDepositoLocked && !isAdmin && "opacity-90"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "p-2.5 rounded-xl",
                  activeLocation === 'deposito' ? "bg-emerald-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                )}>
                  <Warehouse className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">2. Estou no Estoque</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {depositoItemsCount} itens para conferência (Estoque e Ambos)
                  </p>
                </div>
              </div>

              {isDepositoLocked && !isAdmin ? (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                  <Lock className="w-3 h-3 text-amber-600" />
                  Trava 5d
                </span>
              ) : (
                activeLocation === 'deposito' && (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-600 text-white">
                    <Check className="w-3 h-3" />
                    Ativo
                  </span>
                )
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3 text-slate-400" />
                Última contagem:
              </span>
              <span className="font-bold text-slate-800 text-[11px]">
                {lastCountDeposito ? lastCountDeposito.dateStr : 'Nunca contado'}
              </span>
            </div>

            {isDepositoLocked && !isAdmin && (
              <div className="mt-2 text-[10px] text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200/80 flex items-center gap-1 font-medium">
                <Info className="w-3 h-3 shrink-0 text-amber-600" />
                <span>Liberado em <strong>{depositoRemainingDays} dia(s)</strong> para mitigar contagens duplicadas.</span>
              </div>
            )}
          </button>
        </div>

        {/* ALERTA DE BLOQUEIO DE 5 DIAS SE APLICÁVEL */}
        {isCurrentLocationLocked && !isAdmin && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-xs">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  A contagem do {activeLocation === 'quiosque' ? 'Quiosque' : 'Estoque'} já foi realizada recentemente.
                </p>
                <p className="text-amber-800/90 mt-0.5">
                  Para manter a integridade do estoque e mitigar risco de dobrar valores, só é liberada nova contagem após 5 dias.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const pass = prompt('Digite a senha para liberar a contagem:');
                if (pass === '2024') {
                  setLastCountQuiosque(null);
                  setLastCountDeposito(null);
                  setForceUnlocked(true);
                  localStorage.removeItem(LOCAL_STORAGE_LAST_COUNT_QUIOSQUE);
                  localStorage.removeItem(LOCAL_STORAGE_LAST_COUNT_DEPOSITO);
                  alert('Contagem liberada com sucesso!');
                } else if (pass !== null) {
                  alert('Senha incorreta!');
                }
              }}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 cursor-pointer shadow-xs self-start sm:self-auto"
              title="Liberar contagem com senha"
            >
              🔓 Liberar com Senha
            </button>
          </div>
        )}

        {/* Campo do Nome do Atendente */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
            <User className="w-3.5 h-3.5 text-slate-500" />
            Funcionário responsável (Contagem):
          </label>
          <select
            value={responsavelName}
            onChange={e => setResponsavelName(e.target.value)}
            disabled={isCurrentLocationLocked && !isAdmin}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">Selecione o funcionário autorizado...</option>
            {stockStaffList.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* FILTROS E BUSCA COM AUTOCOMPLETAR */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div ref={searchContainerRef} className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Buscar produto no ${activeLocation === 'quiosque' ? 'Quiosque' : 'Estoque'} (com autopreenchimento)...`}
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setIsAutocompleteOpen(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => {
                if (searchTerm.trim().length > 0) {
                  setIsAutocompleteOpen(true);
                }
              }}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-9 pr-14 py-2.5 bg-white border border-slate-200/80 rounded-2xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setIsAutocompleteOpen(false);
                  setHighlightedIndex(-1);
                  if (searchInputRef.current) searchInputRef.current.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Menu Dropdown de Autopreenchimento */}
            <AnimatePresence>
              {isAutocompleteOpen && searchTerm.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden divide-y divide-slate-100"
                >
                  <div className="px-3.5 py-2 bg-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      Sugestões de autopreenchimento ({autocompleteSuggestions.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Use ↑ ↓ e Enter</span>
                  </div>

                  {autocompleteSuggestions.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                      {autocompleteSuggestions.map((sug, idx) => {
                        const cat = activeLocation === 'quiosque' ? sug.categoriaQuiosque : sug.categoriaEstoque;
                        const count = counts[sug.id];
                        const isChecked = count && (count.modificado || count.quantidade > 0 || count.temAberto || count.statusBastante);
                        const isSelected = highlightedIndex === idx;

                        return (
                          <button
                            key={sug.id}
                            type="button"
                            onClick={() => handleSelectSuggestion(sug)}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            className={cn(
                              "w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer",
                              isSelected ? "bg-emerald-50 text-slate-900" : "hover:bg-slate-50 text-slate-800"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Search className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-emerald-600" : "text-slate-400")} />
                              <div className="truncate text-xs font-semibold">
                                {renderHighlightedText(sug.produto, searchTerm)}
                              </div>
                              {cat && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 shrink-0">
                                  {cat}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isChecked ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <Check className="w-3 h-3" />
                                  Contado
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  Pendente
                                </span>
                              )}
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-5 text-center text-xs text-slate-500">
                      <p className="font-semibold text-slate-700">Nenhum produto correspondente</p>
                      <p className="text-[11px] mt-0.5 text-slate-400">
                        Não encontramos "{searchTerm}" cadastrado no {activeLocation === 'quiosque' ? 'Quiosque' : 'Estoque'}.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => setShowOnlyPending(prev => !prev)}
            className={cn(
              "px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs",
              showOnlyPending
                ? "bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-200"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
            title="Mostrar apenas itens pendentes (não revisados)"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Pendentes ({stats.totalItens - stats.preenchidos})</span>
          </button>
        </div>

        {/* Categorias específicas deste local em Pílulas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              )}
            >
              {cat === 'all' ? `Todas as Categorias (${availableItemsForLocation.length})` : cat}
            </button>
          ))}
        </div>
      </div>

      {/* FEEDBACK DE SUCESSO OU ERRO */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-900"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-black text-sm">{saveSuccess}</p>
              <div className="mt-1 text-emerald-800 space-y-0.5">
                {lastSavedCakesCount !== null && lastSavedCakesCount > 0 && (
                  <p>
                    🎂 <strong>{lastSavedCakesCount} bolo(s) atingiram o estoque mínimo</strong> e subiram como <strong>Item a Produzir</strong> na sessão de compras (o atendente já pode produzir e enviar direto para o estoque!).
                  </p>
                )}
                {lastSavedOrdersCount !== null && lastSavedOrdersCount > 0 && (
                  <p>
                    📦 <strong>{lastSavedOrdersCount} solicitação(ões) de compra externa</strong> foram geradas automaticamente.
                  </p>
                )}
                {onNavigateToPurchases && (
                  <button
                    onClick={onNavigateToPurchases}
                    className="mt-1 underline font-black text-emerald-950 inline-block hover:opacity-80 cursor-pointer"
                  >
                    Ver quadro de compras e produção &rarr;
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900 text-xs"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">{errorMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LISTA SIMPLES DE ITENS (CHECKLIST ULTRA RÁPIDO) */}
      <div className="space-y-2.5">
        {filteredItems.map(item => {
          const currentCount = counts[item.id] || { 
            quantidade: 0, 
            temAberto: false, 
            caixasFechadas: 0, 
            avulsos: 0, 
            statusBastante: item.tipoContagem === 'tem_bastante' ? 'bastante' : undefined,
            modificado: false 
          };
          const isCake = item.ehBoloProducao || isCakeProduction(item.produto);
          const locationCategory = activeLocation === 'quiosque' 
            ? item.categoriaQuiosque 
            : item.categoriaEstoque;

          return (
            <div
              key={item.id}
              id={`item-card-${item.id}`}
              className={cn(
                "relative bg-white rounded-2xl p-3.5 sm:p-4 border transition-all duration-300 shadow-xs",
                currentCount.modificado 
                  ? "border-emerald-300 bg-emerald-50/15 pr-10 sm:pr-12" 
                  : "border-slate-200/80 hover:border-slate-300"
              )}
            >
              {currentCount.modificado && (
                <div className="absolute top-3.5 right-3.5 flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white shadow-xs z-10" title="Item conferido">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
              {/* Linha Única: Nome do Produto e Badges à esquerda, Controles à direita */}
              <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                      {item.produto}
                    </span>
                    {locationCategory && locationCategory !== '-' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {locationCategory}
                      </span>
                    )}
                    {item.local !== 'ambos' && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                        Apenas {item.local === 'quiosque' ? 'Quiosque' : 'Estoque'}
                      </span>
                    )}
                    {isCake && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 flex items-center gap-1">
                        <ChefHat className="w-3 h-3" />
                        Produção Interna
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.tipoContagem !== 'tem_bastante' ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>
                            Estoque Mínimo: <strong className="text-slate-800 font-bold">{getEffectiveMin(item)} {item.unidadeMedida}</strong>
                          </span>
                          {isAdmin && (
                            editingMinId === item.id ? (
                              <div className="flex items-center gap-1 ml-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={editingMinVal}
                                  onChange={e => setEditingMinVal(e.target.value)}
                                  className="w-16 h-6 text-center text-xs font-bold bg-white border border-slate-300 rounded px-1 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                                  placeholder={String(getEffectiveMin(item))}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveMinimo(item)}
                                  className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingMinId(null); setEditingMinVal(''); }}
                                  className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] cursor-pointer"
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setEditingMinId(item.id); setEditingMinVal(String(getEffectiveMin(item))); }}
                                className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 cursor-pointer"
                                title="Editar Estoque Mínimo (Admin)"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          Contagem Rápida: Tem bastante ou precisa pedir
                        </span>
                      )}




                    </div>

                    {/* Total na contagem logo abaixo do estoque mínimo */}
                    {item.tipoContagem !== 'tem_bastante' && (() => {
                      let tUnits = 0;
                      if (item.tipoContagem === 'unidade') {
                        tUnits = currentCount.quantidade || 0;
                      } else if (item.tipoContagem === 'embalagem_com_aberto') {
                        tUnits = currentCount.quantidade || 0;
                      } else if (item.tipoContagem === 'caixa_ou_avulso') {
                        const cx = currentCount.caixasFechadas || 0;
                        const av = currentCount.avulsos || 0;
                        const mult = item.tamanhoCaixa && item.tamanhoCaixa > 0 ? item.tamanhoCaixa : 1;
                        tUnits = (cx * mult) + av;
                      }
                      if (tUnits > 0 || currentCount.modificado || currentCount.temAberto) {
                        const uLabel = item.unidadeMedida === 'un' ? (tUnits === 1 ? 'unidade' : 'unidades') : item.unidadeMedida;
                        return (
                          <span className="text-slate-600 font-medium">
                            Total na contagem: <strong className="text-slate-900 font-bold">{tUnits} {uLabel}</strong>{currentCount.temAberto ? ' (+ 1 aberto em uso)' : ''}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* TIPO A: Unidade Simples */}
                {item.tipoContagem === 'unidade' && (
                  <div className="flex items-center gap-2 shrink-0 sm:self-center">
                    <button
                      type="button"
                      disabled={isCurrentLocationLocked && !isAdmin}
                      onClick={() => handleSimpleQuantity(item.id, -1)}
                      className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={isCurrentLocationLocked && !isAdmin}
                      value={currentCount.quantidade === 0 ? '' : currentCount.quantidade}
                      placeholder="0"
                      onChange={e => handleSimpleDirectInput(item.id, e.target.value)}
                      className="w-16 h-10 text-center font-black text-slate-900 bg-white border border-slate-300 rounded-xl text-base focus:outline-hidden focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={isCurrentLocationLocked && !isAdmin}
                      onClick={() => handleSimpleQuantity(item.id, 1)}
                      className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-slate-400 ml-1 min-w-[20px]">
                      {item.unidadeMedida}
                    </span>
                  </div>
                )}

                {/* TIPO B: Garrafa / Pote / Caixa Fechada + Checkbox "Aberto (em uso)" */}
                {item.tipoContagem === 'embalagem_com_aberto' && (
                  <div className="flex items-center gap-2 shrink-0 sm:self-center flex-wrap justify-end">
                    <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 px-1.5">
                        Fechados:
                      </span>
                      <button
                        type="button"
                        disabled={isCurrentLocationLocked && !isAdmin}
                        onClick={() => handlePackageWithOpenChange(item.id, (currentCount.quantidade || 0) - 1, currentCount.temAberto)}
                        className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200 disabled:opacity-40 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        disabled={isCurrentLocationLocked && !isAdmin}
                        value={currentCount.quantidade === 0 ? '' : currentCount.quantidade}
                        placeholder="0"
                        onChange={e => handlePackageWithOpenChange(item.id, parseInt(e.target.value, 10) || 0, currentCount.temAberto)}
                        className="w-12 h-8 text-center font-black text-slate-900 bg-white border border-slate-200 rounded-lg text-sm focus:outline-hidden disabled:opacity-50"
                      />
                      <button
                        type="button"
                        disabled={isCurrentLocationLocked && !isAdmin}
                        onClick={() => handlePackageWithOpenChange(item.id, (currentCount.quantidade || 0) + 1, currentCount.temAberto)}
                        className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isCurrentLocationLocked && !isAdmin}
                      onClick={() => handlePackageWithOpenChange(item.id, currentCount.quantidade, !currentCount.temAberto)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border disabled:opacity-40 cursor-pointer",
                        currentCount.temAberto 
                          ? "bg-amber-100/80 text-amber-900 border-amber-300 shadow-xs" 
                          : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-md border flex items-center justify-center text-[10px]",
                        currentCount.temAberto ? "bg-amber-600 border-amber-600 text-white" : "border-slate-400 bg-white"
                      )}>
                        {currentCount.temAberto && <Check className="w-3 h-3" />}
                      </div>
                      <span>Aberto (em uso)</span>
                    </button>
                  </div>
                )}

                {/* TIPO C: Caixas Fechadas + Avulsos */}
                {item.tipoContagem === 'caixa_ou_avulso' && (() => {
                  const rotulo = (item.rotuloEmbalagem || 'caixa').toLowerCase().trim();
                  const isSaco = rotulo === 'saco';
                  const rotuloPlural = isSaco ? 'Sacos Fechados' : rotulo === 'fardo' ? 'Fardos Fechados' : 'Caixas Fechadas';
                  const rotuloSingular = isSaco ? 'saco' : rotulo === 'fardo' ? 'fardo' : 'caixa';
                  const cxVal = currentCount.caixasFechadas || 0;
                  const avVal = currentCount.avulsos || 0;

                  return (
                    <div className="flex items-center gap-2 shrink-0 sm:self-center flex-wrap justify-end">
                      {/* Unidades Avulsas (Primeiro, à esquerda) */}
                      <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-black uppercase text-slate-700 px-1">
                          Unidades:
                        </span>
                        <button
                          type="button"
                          disabled={isCurrentLocationLocked && !isAdmin}
                          onClick={() => handleBoxAndUnitChange(item.id, cxVal, avVal - 1, item.tamanhoCaixa)}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200 disabled:opacity-40 cursor-pointer transition-colors"
                          title="Diminuir Unidades"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          disabled={isCurrentLocationLocked && !isAdmin}
                          value={avVal === 0 ? '' : avVal}
                          placeholder="0"
                          onChange={e => handleUnitDirectInput(item.id, cxVal, e.target.value, item.tamanhoCaixa)}
                          className="w-12 h-8 text-center font-black text-slate-900 bg-white border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
                        />
                        <button
                          type="button"
                          disabled={isCurrentLocationLocked && !isAdmin}
                          onClick={() => handleBoxAndUnitChange(item.id, cxVal, avVal + 1, item.tamanhoCaixa)}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
                          title="Aumentar Unidades"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Embalagens Fechadas (Sacos / Fardos / Caixas) (À direita) */}
                      <div className="flex items-center gap-1.5 bg-blue-50/80 p-1 rounded-xl border border-blue-200 shadow-2xs">
                        <div className="flex flex-col px-1">
                          <span className="text-[10px] font-black uppercase text-blue-900 leading-tight">
                            {rotuloPlural}:
                          </span>
                          {item.tamanhoCaixa && item.tamanhoCaixa > 1 && (
                            <span className="text-[9px] font-bold text-blue-600 leading-tight">
                              {item.tamanhoCaixa} un/{rotuloSingular}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={isCurrentLocationLocked && !isAdmin}
                          onClick={() => handleBoxAndUnitChange(item.id, cxVal - 1, avVal, item.tamanhoCaixa)}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-blue-100 text-blue-950 flex items-center justify-center border border-blue-200 disabled:opacity-40 cursor-pointer transition-colors"
                          title={`Diminuir ${rotuloPlural}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          disabled={isCurrentLocationLocked && !isAdmin}
                          value={cxVal === 0 ? '' : cxVal}
                          placeholder="0"
                          onChange={e => handleBoxDirectInput(item.id, e.target.value, avVal, item.tamanhoCaixa)}
                          className="w-12 h-8 text-center font-black text-slate-900 bg-white border border-blue-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <button
                          type="button"
                          disabled={isCurrentLocationLocked && !isAdmin}
                          onClick={() => handleBoxAndUnitChange(item.id, cxVal + 1, avVal, item.tamanhoCaixa)}
                          className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
                          title={`Aumentar ${rotuloPlural}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* TIPO D: Itens Rápidos de Alto Volume (Sacos Kraft, Embalagens, Sorvete, etc) */}
                {item.tipoContagem === 'tem_bastante' && (
                  <div className="flex items-center gap-2 shrink-0 sm:self-center">
                    <button
                      type="button"
                      disabled={isCurrentLocationLocked && !isAdmin}
                      onClick={() => handleStatusBastanteChange(item.id, 'bastante')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border disabled:opacity-40 cursor-pointer",
                        currentCount.statusBastante === 'bastante'
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-200"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>Tem bastante</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCurrentLocationLocked && !isAdmin}
                      onClick={() => handleStatusBastanteChange(item.id, 'pedir')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border disabled:opacity-40 cursor-pointer",
                        currentCount.statusBastante === 'pedir'
                          ? "bg-rose-600 text-white border-rose-700 shadow-xs ring-2 ring-rose-200"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Precisa pedir</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Nenhum produto encontrado</p>
          <p className="text-xs text-slate-400 mt-1">
            Tente ajustar os termos de busca ou mudar a categoria selecionada.
          </p>
        </div>
      )}

      {/* BARRA FIXA INFERIOR PARA SALVAR CONTAGEM */}
      {availableItemsForLocation.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-xl z-40">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs w-full sm:w-auto justify-between sm:justify-start">
              <div>
                <span className="text-slate-500">Espaço Atual:</span>{' '}
                <strong className="text-slate-900 font-extrabold uppercase">
                  {activeLocation === 'quiosque' ? 'Quiosque' : 'Estoque'}
                </strong>
              </div>
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <div>
                <span className="text-slate-500">Revisados:</span>{' '}
                <strong className="text-emerald-700 font-extrabold">
                  {stats.preenchidos} de {stats.totalItens}
                </strong>
              </div>
              {stats.abaixoMinimoEstimado > 0 && (
                <>
                  <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                  <div className="flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>{stats.abaixoMinimoEstimado} entrarão na lista de compra/produção</span>
                  </div>
                </>
              )}
            </div>

            {(() => {
              const allReviewed = stats.preenchidos === stats.totalItens;
              const isLockedBlock = isCurrentLocationLocked && !isAdmin;
              const canSave = allReviewed;

              return (
                <button
                  type="button"
                  disabled={isSaving || (!canSave && !isLockedBlock) || isLockedBlock}
                  onClick={handleSaveLocationCount}
                  className={cn(
                    "w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer",
                    isLockedBlock
                      ? "bg-slate-400 cursor-not-allowed"
                      : !canSave
                      ? "bg-amber-600 hover:bg-amber-700 active:scale-95 shadow-amber-200"
                      : "bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-200"
                  )}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Salvando no Sistema...</span>
                    </>
                  ) : isLockedBlock ? (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Bloqueado (Aguarde {activeLocation === 'quiosque' ? quiosqueRemainingDays : depositoRemainingDays}d)</span>
                    </>
                  ) : !canSave ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Faltam {stats.totalItens - stats.preenchidos} itens para revisar</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Finalizar Contagem do {activeLocation === 'quiosque' ? 'Quiosque' : 'Estoque'}</span>
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
};
