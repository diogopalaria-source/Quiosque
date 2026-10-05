import React, { useState } from 'react';
import { 
  Plus, 
  Minus,
  Trash2, 
  ArrowRight, 
  CheckCircle2, 
  ShoppingCart, 
  Clock, 
  X,
  AlertCircle,
  Package,
  DollarSign,
  User,
  MoreVertical,
  Calendar,
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronUp,
  ChefHat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAction } from '../lib/logs';
import { PurchaseRequest, MACRO_INGREDIENTS, StockItem } from '../types';
import { cn, formatCurrency, getMacroForProduct, getDataPath, getBasePath } from '../lib/utils';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType, safeAddDoc, safeUpdateDoc } from '../lib/firestoreUtils';
import { Search } from 'lucide-react';
import { isCakeProduction, CAKE_PRODUCTION_NAMES, PREDEFINED_STOCK_ITEMS } from '../data/kioskStockList';

interface PurchaseRequestsProps {
  userId: string;
  requests: PurchaseRequest[];
  userRole: string;
  purchasesData?: any[];
  stockData?: StockItem[];
}

export const PurchaseRequests: React.FC<PurchaseRequestsProps> = ({ 
  userId, 
  requests,
  userRole,
  purchasesData = [],
  stockData = []
}) => {
  const isAdmin = userRole === 'admin';
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRequest, setNewRequest] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState('un');
  const [newRequester, setNewRequester] = useState(() => {
    try {
      return localStorage.getItem('last_purchase_solicitante') || '';
    } catch {
      return '';
    }
  });
  const [newObs, setNewObs] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [staffList, setStaffList] = useState<string[]>([]);

  // Estado local com sincronização em tempo real e atualização otimista instantânea
  const [localRequests, setLocalRequests] = useState<PurchaseRequest[]>(() => {
    try {
      const cached = localStorage.getItem(`app_cache_${getDataPath('purchaseRequests')}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return requests || [];
  });

  // Atualizar quando props mudarem sem perder dados locais
  React.useEffect(() => {
    if (requests && requests.length > 0) {
      setLocalRequests(prev => {
        const propMap = new Map(requests.map(r => [r.id, r]));
        const localNew = prev.filter(r => r.id && !propMap.has(r.id));
        return [...requests, ...localNew];
      });
    }
  }, [requests]);

  // Listener em tempo real do Firestore para pedidos de compra
  React.useEffect(() => {
    try {
      const colRef = collection(db, getDataPath('purchaseRequests'));
      const unsubscribe = onSnapshot(colRef, (snap) => {
        const items: PurchaseRequest[] = [];
        snap.forEach(docSnap => {
          items.push({ ...docSnap.data(), id: docSnap.id } as PurchaseRequest);
        });
        if (items.length > 0) {
          setLocalRequests(items);
          try {
            localStorage.setItem(`app_cache_${getDataPath('purchaseRequests')}`, JSON.stringify(items));
          } catch {}
          window.dispatchEvent(new CustomEvent('purchase-requests-synced', { detail: items }));
        }
      }, (err) => {
        console.warn('onSnapshot para purchaseRequests em modo cache:', err);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Erro ao conectar onSnapshot para purchaseRequests:', err);
    }
  }, [userId]);

  // Carregar lista de colaboradores cadastrados
  React.useEffect(() => {
    const fetchStaff = async () => {
      try {
        const snap = await getDocs(collection(db, getDataPath('systemStaff')));
        if (!snap.empty) {
          const names: string[] = [];
          snap.forEach(d => {
            const data = d.data();
            if (data.nome && typeof data.nome === 'string') {
              names.push(data.nome.trim());
            }
          });
          if (names.length > 0) {
            setStaffList(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'pt-BR')));
          }
        }
      } catch (err) {
        console.error('Error fetching staff for purchase requests:', err);
      }
    };
    fetchStaff();
  }, []);

  const dynamicSuppliers = React.useMemo(() => {
    const baseSuppliers = [
      'Mr. Cheney',
      'Bottega',
      'My baker',
      'Frutas - Natural Fresh',
      'Origens',
      "Pode Comer"
    ];
    const suppliers: string[] = [...baseSuppliers];
    const lowerSet = new Set(baseSuppliers.map(s => s.toLowerCase()));

    if (purchasesData && purchasesData.length > 0) {
      for (let i = 0; i < purchasesData.length; i++) {
        const v = purchasesData[i]?.fornecedor;
        if (typeof v === 'string' && v.trim()) {
          const lower = v.trim().toLowerCase();
          if (!lowerSet.has(lower)) {
            lowerSet.add(lower);
            suppliers.push(v.trim());
          }
        }
      }
    }
    return suppliers;
  }, [purchasesData]);

  React.useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
  
  // Modal for moving to "Confirmar Recebimento"
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    request: PurchaseRequest | null;
    quantidadeNum: string;
    unidade: 'un' | 'kg';
    valorTotal: string;
    valorUnitario: string;
    dataCompra: string;
    previsaoChegada: string;
    useTotal: boolean;
    categoriaEstoque: string;
    showEstoqueSearch: boolean;
    fornecedor: string;
    produtoNome: string;
    naoConsiderarEstoque: boolean;
  }>({
    show: false,
    request: null,
    quantidadeNum: '',
    unidade: 'un',
    valorTotal: '',
    valorUnitario: '',
    dataCompra: format(new Date(), 'yyyy-MM-dd'),
    previsaoChegada: '',
    useTotal: true,
    categoriaEstoque: '',
    showEstoqueSearch: false,
    fornecedor: '',
    produtoNome: '',
    naoConsiderarEstoque: false
  });

  // Modal para atendente concluir produção de bolo e enviar direto para o estoque
  const [cakeProductionModal, setCakeProductionModal] = useState<{
    show: boolean;
    request: PurchaseRequest | null;
    quantidadeProduzida: string;
    destino: 'quiosque' | 'deposito';
    responsavel: string;
  }>({
    show: false,
    request: null,
    quantidadeProduzida: '10',
    destino: 'deposito',
    responsavel: ''
  });

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanProd = newRequest.trim();
    if (!cleanProd) {
      setError('Por favor, informe o nome do produto.');
      setTimeout(() => setError(null), 4000);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const isCake = isCakeProduction(cleanProd);
      const requester = newRequester.trim() || (isCake ? 'Operação (Produção Interna)' : 'Operação');
      
      try {
        if (newRequester.trim()) {
          localStorage.setItem('last_purchase_solicitante', newRequester.trim());
        }
      } catch {}

      const record: Record<string, any> = {
        produto: cleanProd,
        status: 'pendente',
        usuarioSolicitante: requester,
        dataSolicitacao: format(new Date(), 'yyyy-MM-dd'),
        urgente: Boolean(isUrgent),
        tipoItem: isCake ? 'producao' : 'compra',
        ehProducao: Boolean(isCake),
        userId: userId || getBasePath(),
        createdAt: serverTimestamp()
      };

      if (isCake) {
        record.quantidade = newQuantity.trim() ? `${newQuantity.trim()} un` : '10 un';
        record.quantidadeNumerica = newQuantity.trim() ? (Number(newQuantity.trim()) || 10) : 10;
      } else if (newQuantity.trim()) {
        record.quantidade = `${newQuantity.trim()} ${newUnit || 'un'}`.trim();
        const num = parseFloat(newQuantity.replace(',', '.'));
        if (!isNaN(num) && num > 0) {
          record.quantidadeNumerica = num;
        }
      }

      if (newObs.trim()) {
        record.observacao = newObs.trim();
      }

      const docRef = await safeAddDoc(collection(db, getDataPath('purchaseRequests')), record);
      
      const newCreatedItem: PurchaseRequest = {
        ...record,
        id: docRef?.id || `req_${Date.now()}`
      } as PurchaseRequest;

      // Atualização otimista imediata na interface
      setLocalRequests(prev => {
        const next = [newCreatedItem, ...prev.filter(r => r.id !== newCreatedItem.id)];
        try {
          localStorage.setItem(`app_cache_${getDataPath('purchaseRequests')}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      window.dispatchEvent(new CustomEvent('purchase-requests-updated', { detail: newCreatedItem }));

      try {
        await logAction(
          'Criação', 
          'Pedido Compra', 
          `Solicitou compra/produção de: ${record.produto}${record.urgente ? ' (URGENTE)' : ''} por ${requester}`, 
          'purchaseRequests', 
          docRef.id, 
          record,
          requester
        );
      } catch (logErr) {
        console.warn('Não foi possível gravar log:', logErr);
      }

      // Notification logic
      if (isUrgent) {
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('COMPRA URGENTE SOLICITADA!', {
              body: `O produto "${cleanProd}" foi marcado como urgente por ${requester}.`,
              icon: '/favicon.ico'
            });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        }
      }

      setNewRequest('');
      setNewQuantity('');
      setNewObs('');
      setIsUrgent(false);
      setShowAddForm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      console.error('Erro ao adicionar pedido de compra:', err);
      handleFirestoreError(err, OperationType.WRITE, getDataPath('purchaseRequests'));
      const msg = err?.message || '';
      if (msg.includes('Quota limit exceeded')) {
        setError('Solicitação registrada em modo offline com sucesso!');
        setSuccess(true);
      } else {
        setError('Erro ao salvar solicitação. Verifique sua conexão.');
      }
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const existingReq = localRequests?.find(r => r.id === id);
      setLocalRequests(prev => {
        const next = prev.filter(r => r.id !== id);
        try {
          localStorage.setItem(`app_cache_${getDataPath('purchaseRequests')}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      window.dispatchEvent(new CustomEvent('purchase-requests-deleted', { detail: id }));

      await deleteDoc(doc(db, getDataPath('purchaseRequests'), id));
      await logAction('Exclusão', 'Pedido Compra', `Excluiu pedido de compra para "${existingReq?.produto || id}"`, 'purchaseRequests', id, existingReq || {});
    } catch (err) {
      console.error(err);
    }
  };

  const findLastUnitPriceForCategory = React.useCallback((category: string, excludeId?: string) => {
    if (!category || category === 'Desconsiderar') return null;
    
    const matches = (localRequests || []).filter(r => 
      r.categoriaEstoque === category && 
      (r.status === 'comprado' || r.status === 'recebido') &&
      r.valorUnitario !== undefined &&
      r.valorUnitario !== null &&
      r.valorUnitario > 0 &&
      r.id !== excludeId
    );

    if (matches.length === 0) return null;

    const sorted = [...matches].sort((a, b) => {
      const dateA = a.dataCompra || '';
      const dateB = b.dataCompra || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // descending
      }
      return (b.id || '').localeCompare(a.id || '');
    });

    return sorted[0].valorUnitario;
  }, [localRequests]);

  const openConfirmModal = (req: PurchaseRequest) => {
    const detected = req.categoriaEstoque || getMacroForProduct(req.produto) || '';
    
    let lastUnitVal = req.valorUnitario?.toString() || '';
    if (!lastUnitVal && detected) {
      const foundVal = findLastUnitPriceForCategory(detected, req.id);
      if (foundVal !== null && foundVal !== undefined) {
        lastUnitVal = foundVal.toString();
      }
    }

    const qtyStr = req.quantidadeNumerica?.toString() || req.quantidade?.split(' ')[0] || '';
    const useTotal = req.valorTotal ? true : false;
    let valTotalStr = req.valorTotal?.toString() || '';

    if (!valTotalStr && lastUnitVal && qtyStr) {
      valTotalStr = (Number(lastUnitVal) * Number(qtyStr)).toFixed(2);
    }

    setConfirmModal({
      show: true,
      request: req,
      quantidadeNum: qtyStr,
      unidade: (req.quantidade?.includes('kg') ? 'kg' : 'un') as 'un' | 'kg',
      valorTotal: valTotalStr,
      valorUnitario: lastUnitVal,
      dataCompra: req.dataCompra || format(new Date(), 'yyyy-MM-dd'),
      previsaoChegada: req.previsaoChegada || '',
      useTotal: useTotal,
      categoriaEstoque: detected,
      showEstoqueSearch: false,
      fornecedor: req.fornecedor || '',
      produtoNome: req.produto || '',
      naoConsiderarEstoque: req.naoConsiderarEstoque || false
    });
  };

  const handleMoveToBought = async () => {
    if (!confirmModal.request || !confirmModal.quantidadeNum) return;

    setLoading(true);
    try {
      const q = Number(confirmModal.quantidadeNum);
      const vTotal = confirmModal.useTotal ? Number(confirmModal.valorTotal) : Number(confirmModal.valorUnitario) * q;
      const vUnit = confirmModal.useTotal ? Number(confirmModal.valorTotal) / q : Number(confirmModal.valorUnitario);

      // We store the quantitative part for calculations and string for display
      const requestRef = doc(db, getDataPath('purchaseRequests'), confirmModal.request.id!);
      const payloadUpdate = {
        status: 'comprado' as const,
        produto: confirmModal.produtoNome,
        quantidade: `${confirmModal.quantidadeNum} ${confirmModal.unidade}`,
        quantidadeNumerica: q,
        valorTotal: vTotal,
        valorUnitario: vUnit,
        dataCompra: confirmModal.dataCompra,
        previsaoChegada: confirmModal.previsaoChegada,
        categoriaEstoque: confirmModal.naoConsiderarEstoque ? 'Desconsiderar' : confirmModal.categoriaEstoque,
        naoConsiderarEstoque: confirmModal.naoConsiderarEstoque,
        fornecedor: confirmModal.fornecedor
      };
      await safeUpdateDoc(requestRef, payloadUpdate);
      setLocalRequests(prev => {
        const next = prev.map(r => r.id === confirmModal.request!.id ? { ...r, ...payloadUpdate } : r);
        try {
          localStorage.setItem(`app_cache_${getDataPath('purchaseRequests')}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      window.dispatchEvent(new CustomEvent('purchase-requests-updated', { detail: { ...confirmModal.request, ...payloadUpdate } }));
      await logAction('Edição', 'Pedido Compra', `Marcou solicitacao de "${confirmModal.request.produto}" como comprado`, 'purchaseRequests', confirmModal.request.id!, { ...confirmModal.request, ...payloadUpdate });

      setConfirmModal({ ...confirmModal, show: false, request: null });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, getDataPath('purchaseRequests'));
    } finally {
      setLoading(false);
    }
  };

  // Enviar bolo produzido da coluna da esquerda direto para o estoque
  const handleCompleteCakeProduction = async () => {
    if (!cakeProductionModal.request || !cakeProductionModal.quantidadeProduzida) return;
    const qtd = parseInt(cakeProductionModal.quantidadeProduzida, 10);
    if (isNaN(qtd) || qtd <= 0) {
      setError('Por favor, informe uma quantidade válida maior que zero.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const req = cakeProductionModal.request;
      const destino = cakeProductionModal.destino;
      const responsavel = cakeProductionModal.responsavel.trim() || 'Atendente';
      const nowIso = new Date().toISOString();

      // 1. Atualizar ou criar o estoque do bolo
      const stockColRef = collection(db, getDataPath('stock'));
      const qry = query(stockColRef, where('produto', '==', req.produto));
      const snap = await getDocs(qry);

      if (!snap.empty) {
        const stockDoc = snap.docs[0];
        const currentData = stockDoc.data();
        const currentTotal = Number(currentData.estoqueAtual) || 0;
        const currentQuiosque = Number(currentData.estoqueQuiosque) || 0;
        const currentDeposito = Number(currentData.estoqueDeposito) || 0;

        const newTotal = currentTotal + qtd;
        const newQuiosque = destino === 'quiosque' ? currentQuiosque + qtd : currentQuiosque;
        const newDeposito = destino === 'deposito' ? currentDeposito + qtd : currentDeposito;

        await safeUpdateDoc(stockDoc.ref, {
          estoqueAtual: newTotal,
          estoqueQuiosque: newQuiosque,
          estoqueDeposito: newDeposito,
          responsavelContagem: responsavel,
          ...(destino === 'quiosque' ? { dataContagemQuiosque: nowIso } : { dataContagemDeposito: nowIso }),
          updatedAt: serverTimestamp()
        });
      } else {
        await safeAddDoc(stockColRef, {
          produto: req.produto,
          estoqueAtual: qtd,
          estoqueQuiosque: destino === 'quiosque' ? qtd : 0,
          estoqueDeposito: destino === 'deposito' ? qtd : 0,
          estoqueMinimo: 10,
          unidade: 'un',
          categoria: 'Gelados & Doces',
          custoUnitario: req.valorUnitario || 0,
          valorTotal: qtd * (req.valorUnitario || 0),
          responsavelContagem: responsavel,
          userId: getBasePath(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // 2. Atualizar o pedido para 'recebido'
      if (req.id) {
        const updateCakePayload = {
          status: 'recebido' as const,
          dataRecebimento: format(new Date(), 'yyyy-MM-dd'),
          quantidadeRecebida: qtd,
          quantidadeProduzida: qtd,
          responsavelProducao: responsavel,
          destinoProducao: destino,
          observacao: `Bolo produzido internamente (${qtd} un enviadas para o ${destino === 'quiosque' ? 'Quiosque' : 'Estoque'}) por ${responsavel}`
        };
        await safeUpdateDoc(doc(db, getDataPath('purchaseRequests'), req.id), updateCakePayload);
        setLocalRequests(prev => {
          const next = prev.map(r => r.id === req.id ? { ...r, ...updateCakePayload } : r);
          try {
            localStorage.setItem(`app_cache_${getDataPath('purchaseRequests')}`, JSON.stringify(next));
          } catch {}
          return next;
        });
        window.dispatchEvent(new CustomEvent('purchase-requests-updated', { detail: { ...req, ...updateCakePayload } }));
      }

      // 3. Registrar Log de Auditoria
      await logAction(
        'Criação',
        'Produção de Bolo',
        `Produção concluída: ${qtd} un de "${req.produto}" enviadas direto para o ${destino === 'quiosque' ? 'Quiosque' : 'Estoque'} por ${responsavel}.`,
        'stock',
        req.id || 'cake_production',
        {
          produto: req.produto,
          quantidadeProduzida: qtd,
          destino: destino,
          responsavel: responsavel
        },
        responsavel
      );

      setCakeProductionModal({ show: false, request: null, quantidadeProduzida: '10', destino: 'quiosque', responsavel: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      console.error('Erro ao registrar produção de bolo:', err);
      handleFirestoreError(err, OperationType.WRITE, getDataPath('cakeProduction'));
      setError('Erro ao enviar bolo para o estoque. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReceipt = async (req: PurchaseRequest) => {
    if (!req.id) return;
    setLoading(true);
    try {
      const purchaseDate = req.dataCompra || format(new Date(), 'yyyy-MM-dd');
      const [year, month, day] = purchaseDate.split('-');
      const mesRef = `${month}/${year}`;
      
      const pathRequests = getDataPath('purchaseRequests');
      const updatedReqPayload = {
        status: 'recebido' as const,
        dataRecebimento: format(new Date(), 'yyyy-MM-dd')
      };
      await safeUpdateDoc(doc(db, pathRequests, req.id), updatedReqPayload);
      setLocalRequests(prev => {
        const next = prev.map(r => r.id === req.id ? { ...r, ...updatedReqPayload } : r);
        try {
          localStorage.setItem(`app_cache_${getDataPath('purchaseRequests')}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      window.dispatchEvent(new CustomEvent('purchase-requests-updated', { detail: { ...req, ...updatedReqPayload } }));
      await logAction('Edição', 'Pedido Compra', `Confirmou recebimento de "${req.produto}"`, 'purchaseRequests', req.id, { ...req, ...updatedReqPayload });

      const qtyToAdd = req.quantidadeNumerica || Number(req.quantidade?.split(' ')[0]) || 0;
      const isDesconsiderado = req.naoConsiderarEstoque === true || req.categoriaEstoque === 'Desconsiderar';
      
      if (qtyToAdd > 0) {
        // Safe robust mapping of the product name or selected category to the standard MACRO_INGREDIENTS list
        const stockProductName = isDesconsiderado 
          ? (req.produto || 'Desconsiderado') 
          : (req.categoriaEstoque && req.categoriaEstoque !== 'Desconsiderar' 
              ? req.categoriaEstoque 
              : (getMacroForProduct(req.produto) || req.produto));

        const purchaseRecord: any = {
          data: `${day}/${month}/${year}`,
          mes: mesRef,
          produto: stockProductName,
          quantidade: qtyToAdd,
          custoUnitario: req.valorUnitario || 0,
          total: req.valorTotal || 0,
          userId: userId || getBasePath(),
          createdAt: serverTimestamp(),
          fornecedor: req.fornecedor || 'Sem Fornecedor'
        };

        if (isDesconsiderado) {
          purchaseRecord.desconsiderado = true;
        }

        const pathPurchases = getDataPath('purchases');
        const purchaseDocRef = await safeAddDoc(collection(db, pathPurchases), purchaseRecord);
        await logAction('Criação', 'Lançamento Manual', `Compra registrada por recebimento de "${stockProductName}"`, 'purchases', purchaseDocRef.id, purchaseRecord);

        // ONLY update stock if not desconsiderado
        if (!isDesconsiderado) {
          const stockRef = collection(db, getDataPath('stock'));
          const qry = query(stockRef, where('produto', '==', stockProductName));
          const querySnapshot = await getDocs(qry);

          if (!querySnapshot.empty) {
            const stockDoc = querySnapshot.docs[0];
            const currentData = stockDoc.data();
            const newQty = (Number(currentData.estoqueAtual) || 0) + qtyToAdd;
            const unitPrice = req.valorUnitario || Number(currentData.custoUnitario) || 0;
            
            await safeUpdateDoc(stockDoc.ref, {
              estoqueAtual: newQty,
              custoUnitario: unitPrice,
              valorTotal: newQty * unitPrice
            });
            await logAction('Edição', 'Ajuste Estoque', `Estoque de "${stockProductName}" aumentado por recebimento (Nova Qtd: ${newQty})`, 'stock', stockDoc.id, { ...currentData, estoqueAtual: newQty, custoUnitario: unitPrice });
          } else {
            const newStockDoc = {
              produto: stockProductName,
              estoqueAtual: qtyToAdd,
              custoUnitario: req.valorUnitario || 0,
              valorTotal: qtyToAdd * (req.valorUnitario || 0),
              userId: userId || getBasePath()
            };
            const stockDocRef = await safeAddDoc(stockRef, newStockDoc);
            await logAction('Criação', 'Ajuste Estoque', `Criou item de estoque "${stockProductName}" via recebimento`, 'stock', stockDocRef.id, newStockDoc);
          }
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, getDataPath('confirmReceiptFlow'));
    } finally {
      setLoading(false);
    }
  };

  const sortRequests = (reqList: typeof requests) => {
    return [...reqList].sort((a, b) => {
      const uA = a.urgente ? 1 : 0;
      const uB = b.urgente ? 1 : 0;
      if (uA !== uB) {
        return uB - uA; // urgent first
      }
      return (a.produto || '').localeCompare(b.produto || '', 'pt', { sensitivity: 'base' });
    });
  };

  const sortReceivedRequests = (reqList: typeof requests) => {
    return [...reqList].sort((a, b) => {
      const dateA = a.previsaoChegada || '';
      const dateB = b.previsaoChegada || '';
      
      // Coloca itens com previsão preenchida no topo da lista
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      
      // Se ambos tiverem data, ordena da mais recente para a mais tarde (crescente)
      if (dateA && dateB) {
        const dateComparison = dateA.localeCompare(dateB);
        if (dateComparison !== 0) {
          return dateComparison;
        }
      }
      
      // Segundo nível de ordenação: Ordem Alfabética
      return (a.produto || '').localeCompare(b.produto || '', 'pt', { sensitivity: 'base' });
    });
  };

  const column1 = React.useMemo(() => {
    return sortRequests((localRequests || []).filter(r => r.status === 'pendente'));
  }, [localRequests]);

  const column2 = React.useMemo(() => {
    return sortReceivedRequests((localRequests || []).filter(r => r.status === 'comprado'));
  }, [localRequests]);

  const receivedRequestsHistory = React.useMemo(() => {
    return (localRequests || [])
      .filter(r => r.status === 'recebido')
      .sort((a, b) => {
        const dateA = a.dataRecebimento || '';
        const dateB = b.dataRecebimento || '';
        return dateB.localeCompare(dateA);
      });
  }, [localRequests]);

  // Grouping column2 by previsaoChegada
  const groupedColumn2 = React.useMemo(() => {
    const groups: Record<string, typeof column2> = {};
    column2.forEach(req => {
      const dateKey = req.previsaoChegada || 'sem_data';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(req);
    });
    
    // Sort keys:
    // We want dates in ascending order (earliest/closest first), and 'sem_data' at the end.
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'sem_data') return 1;
      if (b === 'sem_data') return -1;
      return a.localeCompare(b);
    });

    return sortedKeys.map(key => ({
      dateKey: key,
      requests: groups[key]
    }));
  }, [column2]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full min-h-[600px]">
        {/* Column 1: Precisa Comprar */}
        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-6 px-2">
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Precisa Comprar
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aguardando aquisição</p>
            </div>
            <button 
              onClick={() => setShowAddForm(true)}
              className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-blue-600 hover:bg-blue-50 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 space-y-4">
            <AnimatePresence>
              {showAddForm && (
                <motion.form 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleAddRequest}
                  className="bg-white p-4 sm:p-5 rounded-2xl shadow-md border-2 border-blue-200 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                      Cadastrar Produto para Compras
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Nome do Produto */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Produto *
                    </label>
                    <input 
                      autoFocus
                      placeholder="Ex: Cookie Macadâmia, Café Grão, Copo 300ml..."
                      className="w-full text-sm font-bold text-slate-900 placeholder:text-slate-300 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      value={newRequest}
                      onChange={(e) => setNewRequest(e.target.value)}
                    />

                    {/* Quick suggestions when typing */}
                    {newRequest.trim().length >= 2 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {PREDEFINED_STOCK_ITEMS
                          .filter(i => i.produto.toLowerCase().includes(newRequest.toLowerCase().trim()))
                          .slice(0, 5)
                          .map(item => (
                            <button
                              type="button"
                              key={item.id}
                              onClick={() => {
                                setNewRequest(item.produto);
                                if (item.unidadeMedida) {
                                  setNewUnit(item.unidadeMedida);
                                }
                              }}
                              className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-md border border-slate-200 transition-colors"
                            >
                              + {item.produto}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Quantidade e Unidade */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Quantidade (Opcional)
                      </label>
                      <input 
                        type="text"
                        placeholder="Ex: 2, 4, 10..."
                        className="w-full text-sm font-bold text-slate-900 placeholder:text-slate-300 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                        value={newQuantity}
                        onChange={(e) => setNewQuantity(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Unidade
                      </label>
                      <select
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)}
                        className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:border-blue-500 outline-none"
                      >
                        <option value="un">Unidade (un)</option>
                        <option value="cx">Caixa (cx)</option>
                        <option value="fardo">Fardo</option>
                        <option value="pct">Pacote (pct)</option>
                        <option value="kg">Quilo (kg)</option>
                        <option value="litro">Litro (L)</option>
                        <option value="lata">Lata</option>
                        <option value="balde">Balde</option>
                      </select>
                    </div>
                  </div>

                  {/* Solicitante */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Quem está solicitando
                    </label>
                    {staffList.length > 0 ? (
                      <select
                        value={newRequester}
                        onChange={(e) => setNewRequester(e.target.value)}
                        className="w-full text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:border-blue-500 outline-none"
                      >
                        <option value="">Selecione o atendente / responsável...</option>
                        {staffList.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                        <option value="Operação (Quiosque)">Operação (Quiosque)</option>
                      </select>
                    ) : (
                      <input 
                        type="text"
                        placeholder="Nome do atendente..."
                        className="w-full text-sm font-bold text-slate-900 placeholder:text-slate-300 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:border-blue-500 outline-none"
                        value={newRequester}
                        onChange={(e) => setNewRequester(e.target.value)}
                      />
                    )}
                  </div>

                  {/* Observação Opcional */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Observação (Opcional)
                    </label>
                    <input 
                      type="text"
                      placeholder="Ex: Marca específica, comprar hoje..."
                      className="w-full text-xs font-semibold text-slate-700 placeholder:text-slate-300 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:border-blue-500 outline-none"
                      value={newObs}
                      onChange={(e) => setNewObs(e.target.value)}
                    />
                  </div>

                  {/* Botão Urgente */}
                  <div className="flex items-center gap-2 pt-1">
                    <button 
                      type="button"
                      onClick={() => setIsUrgent(!isUrgent)}
                      className={cn(
                        "flex items-center gap-2 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                        isUrgent 
                          ? "bg-rose-600 text-white border-2 border-rose-700 shadow-sm" 
                          : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                      )}
                    >
                      <AlertTriangle className={cn("w-3.5 h-3.5", isUrgent ? "text-white" : "text-slate-400")} />
                      {isUrgent ? "URGENTE ATIVADO" : "Marcar como Urgente"}
                    </button>
                    {isUrgent && (
                      <span className="text-[10px] font-black text-rose-600 uppercase animate-pulse">
                        Prioridade Alta
                      </span>
                    )}
                  </div>

                  {/* Rodapé Form */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button 
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={loading || !newRequest.trim()}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50 shadow-md transition-all flex items-center gap-2"
                    >
                      {loading ? (
                        <span>Salvando...</span>
                      ) : (
                        <>
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Solicitar Produto</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {column1.map(req => {
              const isCake = isCakeProduction(req.produto) || req.ehProducao || req.tipoItem === 'producao';

              return (
                <motion.div 
                  layout
                  key={req.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "p-5 rounded-2xl shadow-md border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group relative overflow-hidden transition-all duration-300",
                    isCake 
                      ? "border-amber-300 bg-amber-50/40 shadow-amber-100" 
                      : req.urgente 
                        ? "border-rose-500 bg-rose-100 shadow-rose-200" 
                        : "bg-white border-slate-100"
                  )}
                >
                  {req.urgente && (
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-rose-600"></div>
                  )}
                  {isCake && !req.urgente && (
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-amber-500"></div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className={cn(
                        "font-black uppercase text-sm flex items-center gap-2",
                        req.urgente ? "text-rose-900" : isCake ? "text-amber-950" : "text-slate-900"
                      )}>
                        {req.produto}
                      </h4>

                      {isCake && (
                        <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black uppercase rounded-full flex items-center gap-1 shadow-xs">
                          <ChefHat className="w-3 h-3" /> Produção Interna
                        </span>
                      )}

                      {req.urgente && (
                        <span className="px-2 py-0.5 bg-rose-600 text-white text-[9px] font-black uppercase rounded-full animate-bounce shadow-md">
                          URGENTE
                        </span>
                      )}

                      {req.quantidade && (
                        <span className="px-2 py-0.5 bg-white/80 border border-slate-200 text-slate-700 text-[10px] font-black uppercase rounded-md">
                          Pedir: {req.quantidade}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {format(new Date(req.dataSolicitacao + 'T00:00:00'), 'dd/MM')}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {req.usuarioSolicitante || 'Operação'}
                      </span>
                    </div>

                    {req.observacao && (
                      <p className="text-[11px] text-slate-500 mt-1 font-medium italic">
                        {req.observacao}
                      </p>
                    )}
                  </div>

                  {/* AÇÕES DA COLUNA 1 */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Botão de Envio Direto para Estoque para Bolos de Produção */}
                    {isCake ? (
                      <button
                        onClick={() => {
                          const initialQtd = req.quantidadeNumerica?.toString() || req.quantidade?.split(' ')[0] || '10';
                          setCakeProductionModal({
                            show: true,
                            request: req,
                            quantidadeProduzida: initialQtd,
                            destino: 'deposito',
                            responsavel: ''
                          });
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
                        title="Registrar que o bolo foi produzido e enviar direto para o estoque"
                      >
                        <ChefHat className="w-4 h-4" />
                        <span>Produzido &rarr; Estoque</span>
                      </button>
                    ) : null}

                    {/* Botão de Compra para Admin */}
                    {isAdmin && !isCake && (
                      <button 
                        onClick={() => openConfirmModal(req)}
                        className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                        title="Marcar como comprado"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    {/* Botão Urgente ao lado do lixinho */}
                    <button
                      onClick={async () => {
                        try {
                          const newUrgentVal = !req.urgente;
                          setLocalRequests(prev => {
                            const next = prev.map(r => r.id === req.id ? { ...r, urgente: newUrgentVal } : r);
                            try {
                              localStorage.setItem(`app_cache_${getDataPath('purchaseRequests')}`, JSON.stringify(next));
                            } catch {}
                            return next;
                          });
                          window.dispatchEvent(new CustomEvent('purchase-requests-updated', { detail: { ...req, urgente: newUrgentVal } }));

                          await safeUpdateDoc(doc(db, getDataPath('purchaseRequests'), req.id!), {
                            urgente: newUrgentVal
                          });
                          await logAction('Edição', 'Pedido Compra', `Marcou pedido de "${req.produto}" como ${newUrgentVal ? 'URGENTE' : 'não urgente'}`, 'purchaseRequests', req.id!, { ...req, urgente: newUrgentVal });
                        } catch (err) {
                          console.error('Erro ao atualizar urgência:', err);
                        }
                      }}
                      className={cn(
                        "p-2.5 rounded-xl transition-all border",
                        req.urgente 
                          ? "bg-rose-500 text-white border-rose-600 shadow-xs" 
                          : "bg-white text-slate-400 border-slate-200 hover:text-rose-500 hover:border-rose-300"
                      )}
                      title={req.urgente ? "Remover marcação de urgente" : "Marcar como URGENTE"}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </button>

                    {/* Excluir solicitação */}
                    <button 
                      onClick={() => handleDelete(req.id!)}
                      className="p-2.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      title="Excluir solicitação"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {column1.length === 0 && !showAddForm && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-300 font-bold uppercase text-[10px] tracking-widest border-2 border-dashed border-slate-200 rounded-2xl">
                <ShoppingCart className="w-8 h-8 mb-2 opacity-20" />
                Nenhuma solicitação
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Confirmar Recebimento */}
        <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 flex flex-col">
          <div className="mb-6 px-2">
            <h3 className="text-lg font-black text-emerald-900 uppercase tracking-tight flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              Confirmar Recebimento (Chegou)
            </h3>
            <p className="text-[10px] text-emerald-600/60 font-bold uppercase tracking-widest">Aguardando entrega física</p>
          </div>

          <div className="flex-1 space-y-4">
            {groupedColumn2.map(({ dateKey, requests: groupRequests }) => {
              const isExpanded = !!expandedDates[dateKey];
              const formattedDate = dateKey === 'sem_data' 
                ? 'Sem previsão registrada'
                : /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
                  ? format(new Date(dateKey + 'T00:00:00'), 'dd/MM/yyyy')
                  : dateKey;

              return (
                <div key={dateKey} className="bg-white border border-emerald-100/80 rounded-2xl p-2 shadow-xs transition-all duration-200">
                  <button
                    onClick={() => setExpandedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }))}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-emerald-50/60 transition-colors duration-200 focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black uppercase text-slate-800 tracking-wider">
                          {formattedDate}
                        </p>
                        <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest mt-0.5">
                          {groupRequests.length} {groupRequests.length === 1 ? 'produto' : 'produtos'}
                        </p>
                      </div>
                    </div>
                    <div className="p-1 text-slate-400 hover:text-slate-800 transition-colors">
                      <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform duration-200", isExpanded && "rotate-180")} />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-3 mt-3 px-1 pb-1"
                      >
                        {groupRequests.map(req => (
                          <motion.div 
                            layout
                            key={req.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between relative overflow-hidden group min-h-[5.5rem]"
                          >
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
                            <div className="flex-1 min-w-0 pr-4">
                              <h4 className="font-black text-slate-900 uppercase text-sm leading-snug mb-1 truncate group-hover:text-clip group-hover:whitespace-normal" title={req.produto}>
                                {req.produto}
                              </h4>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black text-emerald-750 uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded">Qtd</span>
                                <span className="text-base font-black text-emerald-600 tracking-tight">{req.quantidade}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isAdmin && (
                                <button 
                                  onClick={() => openConfirmModal(req)}
                                  className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 bg-white rounded-xl transition-all border border-slate-100 shadow-xs"
                                  title="Editar detalhes da compra"
                                >
                                  <ArrowRight className="w-4 h-4 rotate-180" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleConfirmReceipt(req)}
                                className="flex flex-col items-center justify-center gap-1 w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all active:scale-95 shadow-xs"
                                title="Confirmar chegada física"
                              >
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-[8px] font-black uppercase tracking-wider">Chegou</span>
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {column2.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center text-emerald-200 font-bold uppercase text-[10px] tracking-widest border-2 border-dashed border-emerald-100 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 mb-2 opacity-20" />
                Nada pendente
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Histórico de Pedidos Recebidos & Integrados ao Estoque */}
      <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6 mt-6">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between text-left focus:outline-none"
        >
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Histórico de Pedidos Recebidos & Estoque
            </h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Itens comprados que já chegaram fisicamente e alimentaram o inventário
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
              {receivedRequestsHistory.length} Itens
            </span>
            {showHistory ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden mt-6"
            >
              {receivedRequestsHistory.length === 0 ? (
                <div className="h-28 flex flex-col items-center justify-center text-slate-300 font-bold uppercase text-[9px] tracking-widest border border-dashed border-slate-200 rounded-2xl bg-white">
                  Nenhum pedido recebido e integrado ao estoque ainda
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                  {receivedRequestsHistory.map(req => (
                      <div key={req.id} className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="font-black text-slate-950 uppercase text-xs mb-1">{req.produto}</h4>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-slate-400 font-bold uppercase">
                            <span className="text-emerald-600 flex items-center gap-1">
                              ● Recebido em {req.dataRecebimento ? format(new Date(req.dataRecebimento + 'T00:00:00'), 'dd/MM/yyyy') : 'N/A'}
                            </span>
                            <span>Qtd: {req.quantidade || req.quantidadeNumerica}</span>
                            {req.categoriaEstoque && (
                              <span className="text-blue-500">Vínculo: {req.categoriaEstoque}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest border border-emerald-100 px-3 py-1 rounded-xl">
                            No Estoque
                          </span>
                          {isAdmin && (
                            <button 
                              onClick={() => handleDelete(req.id!)}
                              className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                              title="Remover do histórico"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Admin Confirm Purchase Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh] relative"
            >
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-blue-50 rounded-2xl text-blue-600">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Confirmar Compra</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{confirmModal.request?.produto}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Alterar Nome do Item Pedido</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Cookie de Macadâmia"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 transition-all uppercase text-xs placeholder:normal-case placeholder:font-normal"
                    value={confirmModal.produtoNome}
                    onChange={(e) => setConfirmModal({ ...confirmModal, produtoNome: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Fornecedor</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Pode Comer, My Baker, etc."
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 transition-all uppercase text-xs placeholder:normal-case placeholder:font-normal mb-2"
                    value={confirmModal.fornecedor}
                    onChange={(e) => setConfirmModal({ ...confirmModal, fornecedor: e.target.value })}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {dynamicSuppliers.map((supplier) => (
                      <button
                        key={supplier}
                        type="button"
                        onClick={() => setConfirmModal({ ...confirmModal, fornecedor: supplier })}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border",
                          confirmModal.fornecedor.toLowerCase() === supplier.toLowerCase()
                            ? "bg-blue-50 text-blue-600 border-blue-200"
                            : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {supplier}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Quantidade Comprada</label>
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      step="any"
                      placeholder="Ex: 10"
                      className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 font-black focus:ring-2 focus:ring-blue-500 transition-all"
                      value={confirmModal.quantidadeNum}
                      onChange={(e) => setConfirmModal({ ...confirmModal, quantidadeNum: e.target.value })}
                    />
                    <select
                      className="bg-slate-50 border border-slate-100 rounded-2xl px-4 text-xs font-black uppercase text-slate-900 focus:ring-2 focus:ring-blue-500"
                      value={confirmModal.unidade}
                      onChange={(e) => setConfirmModal({ ...confirmModal, unidade: e.target.value as 'un' | 'kg' })}
                    >
                      <option value="un">Unidades</option>
                      <option value="kg">Quilos (Kg)</option>
                    </select>
                  </div>
                </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <div className="mb-6 flex items-center gap-3 bg-amber-500/[0.04] p-4 rounded-2xl border border-amber-500/10">
                      <input
                        type="checkbox"
                        id="naoConsiderarEstoque"
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={confirmModal.naoConsiderarEstoque}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setConfirmModal({
                            ...confirmModal,
                            naoConsiderarEstoque: checked,
                            categoriaEstoque: checked ? 'Desconsiderar' : ''
                          });
                        }}
                      />
                      <label htmlFor="naoConsiderarEstoque" className="text-xs font-black text-amber-700 uppercase tracking-wide cursor-pointer select-none">
                        Não considerar na gestão de estoque
                      </label>
                    </div>

                    <div className="mb-6">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-2">
                        <Package className="w-3 h-3" />
                        Vincular ao Estoque (Macro Ingrediente)
                      </label>
                      <div className="relative group/search">
                        <input
                          type="text"
                          placeholder={confirmModal.naoConsiderarEstoque ? "Desconsiderado para o estoque" : "Buscar Ingrediente..."}
                          className={cn(
                            "w-full rounded-2xl p-4 text-xs font-black uppercase shadow-sm transition-all text-slate-900 border",
                            confirmModal.naoConsiderarEstoque
                              ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed select-none"
                              : "bg-white border-slate-200 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300"
                          )}
                          disabled={confirmModal.naoConsiderarEstoque}
                          value={confirmModal.naoConsiderarEstoque ? 'Desconsiderar' : confirmModal.categoriaEstoque}
                          onChange={(e) => setConfirmModal({ ...confirmModal, categoriaEstoque: e.target.value, showEstoqueSearch: true })}
                          onFocus={() => {
                            if (!confirmModal.naoConsiderarEstoque) {
                              setConfirmModal({ ...confirmModal, showEstoqueSearch: true });
                            }
                          }}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                          <Search className="w-4 h-4" />
                        </div>
                        
                        <AnimatePresence>
                          {confirmModal.showEstoqueSearch && !confirmModal.naoConsiderarEstoque && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute z-[110] left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-48 overflow-y-auto"
                            >
                              {MACRO_INGREDIENTS
                                .filter(ing => !confirmModal.categoriaEstoque || ing.toLowerCase().includes(confirmModal.categoriaEstoque.toLowerCase()))
                                .map((ing, i) => (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      const lastVal = findLastUnitPriceForCategory(ing, confirmModal.request?.id);
                                      const uVal = lastVal !== null && lastVal !== undefined ? lastVal.toString() : confirmModal.valorUnitario;
                                      
                                      let tVal = confirmModal.valorTotal;
                                      if (lastVal !== null && lastVal !== undefined && confirmModal.quantidadeNum) {
                                        tVal = (Number(lastVal) * Number(confirmModal.quantidadeNum)).toFixed(2);
                                      }

                                      setConfirmModal({ 
                                        ...confirmModal, 
                                        categoriaEstoque: ing, 
                                        showEstoqueSearch: false,
                                        valorUnitario: uVal,
                                        valorTotal: tVal
                                      });
                                    }}
                                    className="w-full text-left p-4 hover:bg-blue-50 flex items-center justify-between group transition-colors border-b border-slate-50 last:border-none"
                                  >
                                    <span className="text-[10px] font-black uppercase text-slate-700 group-hover:text-blue-700">
                                      {ing}
                                    </span>
                                    {confirmModal.categoriaEstoque === ing && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                  </button>
                                ))}
                              {MACRO_INGREDIENTS.filter(ing => !confirmModal.categoriaEstoque || ing.toLowerCase().includes(confirmModal.categoriaEstoque.toLowerCase())).length === 0 && (
                                <div className="p-4 text-[10px] font-bold text-slate-400 uppercase text-center">
                                  Nenhum item encontrado
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <p className="mt-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">
                        {confirmModal.naoConsiderarEstoque
                          ? "Este item está marcado para ser desconsiderado do controle de estoque automático."
                          : "Selecione o item macro que este produto deve alimentar no seu controle de estoque."}
                      </p>
                    </div>

                    <div className="mb-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Data da Compra</label>
                    <input 
                      type="date"
                      className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-black text-slate-900 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={confirmModal.dataCompra}
                      onChange={(e) => setConfirmModal({ ...confirmModal, dataCompra: e.target.value })}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                      Previsão de Chegada
                    </label>
                    <input 
                      type="date"
                      className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-black text-slate-900 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={confirmModal.previsaoChegada}
                      onChange={(e) => setConfirmModal({ ...confirmModal, previsaoChegada: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modo de Valor</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                      <button 
                        onClick={() => setConfirmModal({ ...confirmModal, useTotal: true })}
                        className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", confirmModal.useTotal ? "bg-blue-600 text-white" : "text-slate-400")}
                      >Total</button>
                      <button 
                        onClick={() => setConfirmModal({ ...confirmModal, useTotal: false })}
                        className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", !confirmModal.useTotal ? "bg-blue-600 text-white" : "text-slate-400")}
                      >Unitário</button>
                    </div>
                  </div>

                  {confirmModal.useTotal ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total Pago</span>
                      </div>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-2xl font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                        value={confirmModal.valorTotal}
                        onChange={(e) => setConfirmModal({ ...confirmModal, valorTotal: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Unitário</span>
                      </div>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-2xl font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                        value={confirmModal.valorUnitario}
                        onChange={(e) => setConfirmModal({ ...confirmModal, valorUnitario: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <button 
                  disabled={loading || !confirmModal.quantidadeNum || !confirmModal.fornecedor.trim() || !confirmModal.produtoNome.trim() || (confirmModal.useTotal ? !confirmModal.valorTotal : !confirmModal.valorUnitario)}
                  onClick={handleMoveToBought}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:scale-[0.98] transition-all flex items-center justify-center gap-3"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Confirmar e Mover"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal para Atendente Concluir Produção de Bolo e Enviar Direto para o Estoque */}
      <AnimatePresence>
        {cakeProductionModal.show && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-7 relative border border-amber-200"
            >
              <button 
                onClick={() => setCakeProductionModal({ ...cakeProductionModal, show: false })}
                className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-800 transition-colors rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5 mb-6">
                <div className="p-3.5 bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-200">
                  <ChefHat className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    Concluir Produção de Bolo
                  </h3>
                  <p className="text-xs text-amber-700 font-bold uppercase tracking-wider">
                    {cakeProductionModal.request?.produto}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Quantidade Produzida */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Quantidade Produzida (unidades)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseInt(cakeProductionModal.quantidadeProduzida, 10) || 0;
                        setCakeProductionModal({
                          ...cakeProductionModal,
                          quantidadeProduzida: Math.max(1, current - 1).toString()
                        });
                      }}
                      className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-lg font-bold"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      required
                      value={cakeProductionModal.quantidadeProduzida}
                      onChange={e => setCakeProductionModal({ ...cakeProductionModal, quantidadeProduzida: e.target.value })}
                      className="flex-1 h-12 text-center text-xl font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseInt(cakeProductionModal.quantidadeProduzida, 10) || 0;
                        setCakeProductionModal({
                          ...cakeProductionModal,
                          quantidadeProduzida: (current + 1).toString()
                        });
                      }}
                      className="w-12 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center text-lg font-bold"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Nome de quem produziu */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Atendente / Responsável pela Produção
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos, Ana..."
                    value={cakeProductionModal.responsavel}
                    onChange={e => setCakeProductionModal({ ...cakeProductionModal, responsavel: e.target.value })}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCakeProductionModal({ ...cakeProductionModal, show: false })}
                    className="flex-1 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={loading || !cakeProductionModal.quantidadeProduzida}
                    onClick={handleCompleteCakeProduction}
                    className="flex-[2] py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Enviar para Estoque</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(error || success) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 p-4 rounded-2xl text-sm font-bold flex items-center gap-3 shadow-2xl z-[60] min-w-[300px]",
              error ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
            )}
          >
            {error ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            {error || "Operação realizada com sucesso!"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
