import React, { useState } from 'react';
import { 
  Plus, 
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
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAction } from '../lib/logs';
import { PurchaseRequest, MACRO_INGREDIENTS } from '../types';
import { cn, formatCurrency, getMacroForProduct } from '../lib/utils';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Search } from 'lucide-react';

interface PurchaseRequestsProps {
  userId: string;
  requests: PurchaseRequest[];
  userRole: string;
  purchasesData?: any[];
}

export const PurchaseRequests: React.FC<PurchaseRequestsProps> = ({ 
  userId, 
  requests,
  userRole,
  purchasesData = []
}) => {
  const isAdmin = userRole === 'admin';
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRequest, setNewRequest] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

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

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const record: Omit<PurchaseRequest, 'id'> = {
        produto: newRequest.trim(),
        status: 'pendente',
        usuarioSolicitante: 'Operação',
        dataSolicitacao: format(new Date(), 'yyyy-MM-dd'),
        urgente: isUrgent,
        userId: userId,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'users/shared_franquia_data/purchaseRequests'), record);
      await logAction('Criação', 'Pedido Compra', `Solicitou compra de: ${record.produto}${record.urgente ? ' (URGENTE)' : ''}`, 'purchaseRequests', docRef.id, record);

      // Notification logic
      if (isUrgent) {
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('COMPRA URGENTE SOLICITADA!', {
              body: `O produto "${newRequest.trim()}" foi marcado como urgente.`,
              icon: '/favicon.ico'
            });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        }
      }

      setNewRequest('');
      setIsUrgent(false);
      setShowAddForm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users/shared_franquia_data/purchaseRequests');
      setError('Erro ao salvar solicitação. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const existingReq = requests?.find(r => r.id === id);
      await deleteDoc(doc(db, 'users/shared_franquia_data/purchaseRequests', id));
      await logAction('Exclusão', 'Pedido Compra', `Excluiu pedido de compra para "${existingReq?.produto || id}"`, 'purchaseRequests', id, existingReq || {});
    } catch (err) {
      console.error(err);
    }
  };

  const findLastUnitPriceForCategory = React.useCallback((category: string, excludeId?: string) => {
    if (!category || category === 'Desconsiderar') return null;
    
    const matches = (requests || []).filter(r => 
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
  }, [requests]);

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
      const requestRef = doc(db, 'users/shared_franquia_data/purchaseRequests', confirmModal.request.id!);
      const payloadUpdate = {
        status: 'comprado',
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
      await updateDoc(requestRef, payloadUpdate);
      await logAction('Edição', 'Pedido Compra', `Marcou solicitacao de "${confirmModal.request.produto}" como comprado`, 'purchaseRequests', confirmModal.request.id!, { ...confirmModal.request, ...payloadUpdate });

      setConfirmModal({ ...confirmModal, show: false, request: null });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users/shared_franquia_data/purchaseRequests');
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
      
      const pathRequests = 'users/shared_franquia_data/purchaseRequests';
      const updatedReqPayload = {
        status: 'recebido',
        dataRecebimento: format(new Date(), 'yyyy-MM-dd')
      };
      await updateDoc(doc(db, pathRequests, req.id), updatedReqPayload);
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
          userId: userId,
          createdAt: serverTimestamp(),
          fornecedor: req.fornecedor || 'Sem Fornecedor'
        };

        if (isDesconsiderado) {
          purchaseRecord.desconsiderado = true;
        }

        const pathPurchases = 'users/shared_franquia_data/purchases';
        const purchaseDocRef = await addDoc(collection(db, pathPurchases), purchaseRecord);
        await logAction('Criação', 'Lançamento Manual', `Compra registrada por recebimento de "${stockProductName}"`, 'purchases', purchaseDocRef.id, purchaseRecord);

        // ONLY update stock if not desconsiderado
        if (!isDesconsiderado) {
          const stockRef = collection(db, 'users/shared_franquia_data/stock');
          const qry = query(stockRef, where('produto', '==', stockProductName));
          const querySnapshot = await getDocs(qry);

          if (!querySnapshot.empty) {
            const stockDoc = querySnapshot.docs[0];
            const currentData = stockDoc.data();
            const newQty = (Number(currentData.estoqueAtual) || 0) + qtyToAdd;
            const unitPrice = req.valorUnitario || Number(currentData.custoUnitario) || 0;
            
            await updateDoc(stockDoc.ref, {
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
              userId: userId
            };
            const stockDocRef = await addDoc(stockRef, newStockDoc);
            await logAction('Criação', 'Ajuste Estoque', `Criou item de estoque "${stockProductName}" via recebimento`, 'stock', stockDocRef.id, newStockDoc);
          }
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users/shared_franquia_data/confirmReceiptFlow');
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
    return sortRequests((requests || []).filter(r => r.status === 'pendente'));
  }, [requests]);

  const column2 = React.useMemo(() => {
    return sortReceivedRequests((requests || []).filter(r => r.status === 'comprado'));
  }, [requests]);

  const receivedRequestsHistory = React.useMemo(() => {
    return (requests || [])
      .filter(r => r.status === 'recebido')
      .sort((a, b) => {
        const dateA = a.dataRecebimento || '';
        const dateB = b.dataRecebimento || '';
        return dateB.localeCompare(dateA);
      });
  }, [requests]);

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
                  className="bg-white p-4 rounded-2xl shadow-sm border-2 border-blue-100"
                >
                  <input 
                    autoFocus
                    placeholder="Nome do produto..."
                    className="w-full text-sm font-bold text-slate-900 placeholder:text-slate-300 border-none p-0 focus:ring-0 mb-4"
                    value={newRequest}
                    onChange={(e) => setNewRequest(e.target.value)}
                  />
                  <div className="flex items-center gap-2 mb-4 p-2 bg-slate-50 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setIsUrgent(!isUrgent)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        isUrgent 
                          ? "bg-rose-100 text-rose-600 border border-rose-200" 
                          : "bg-white text-slate-400 border border-slate-200"
                      )}
                    >
                      <AlertTriangle className={cn("w-3 h-3", isUrgent ? "text-rose-600" : "text-slate-400")} />
                      Urgente
                    </button>
                    {isUrgent && (
                      <span className="text-[9px] font-bold text-rose-500 uppercase animate-pulse">Marcar como prioridade</span>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button 
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-50 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={loading || !newRequest.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      Solicitar
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {column1.map(req => (
              <motion.div 
                layout
                key={req.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "bg-white p-5 rounded-2xl shadow-md border-2 flex items-center justify-between group relative overflow-hidden transition-all duration-300",
                  req.urgente ? "border-rose-500 bg-rose-100 shadow-rose-200" : "border-slate-100"
                )}
              >
                {req.urgente && (
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-rose-600"></div>
                )}
                <div>
                  <h4 className={cn(
                    "font-black uppercase text-sm mb-1 flex items-center gap-2",
                    req.urgente ? "text-rose-900" : "text-slate-900"
                  )}>
                    {req.produto}
                    {req.urgente && (
                      <span className="px-2 py-0.5 bg-rose-600 text-white text-[9px] rounded-full animate-bounce shadow-md">URGENTE</span>
                    )}
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(req.dataSolicitacao + 'T00:00:00'), 'dd/MM')}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                      <User className="w-3 h-3" />
                      {req.usuarioSolicitante || 'Operação'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleDelete(req.id!)}
                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    title="Excluir solicitação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => openConfirmModal(req)}
                      className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                      title="Marcar como comprado"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}

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
