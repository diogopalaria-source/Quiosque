import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  UserPlus, 
  Phone, 
  Store, 
  DollarSign, 
  Search, 
  Download, 
  MessageCircle, 
  Calendar, 
  BarChart3, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Package,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, getDocs, query, onSnapshot, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CustomerRecord } from '../types';
import { getDataPath, formatCurrency, cn } from '../lib/utils';
import { safeAddDoc, handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { logAction } from '../lib/logs';

interface CustomerRegistrationProps {
  userId: string;
  userRole: string;
  onBack: () => void;
}

export const CustomerRegistration: React.FC<CustomerRegistrationProps> = ({
  userId,
  userRole,
  onBack
}) => {
  const isAdmin = userRole === 'admin';
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [partnerStores, setPartnerStores] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('app_partner_stores');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ['GranVision', 'Acium'];
  });

  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [lojaParceira, setLojaParceira] = useState('GranVision');
  const [outraLoja, setOutraLoja] = useState('');
  const [valorPedido, setValorPedido] = useState('');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'this_month' | 'last_7_days'>('all');
  const [activeTab, setActiveTab] = useState<'register' | 'analytics'>('register');

  // Real-time synchronization
  useEffect(() => {
    try {
      const colRef = collection(db, getDataPath('customerRegistrations'));
      const unsubscribe = onSnapshot(colRef, (snap) => {
        const items: CustomerRecord[] = [];
        snap.forEach(docSnap => {
          items.push({ ...docSnap.data(), id: docSnap.id } as CustomerRecord);
        });
        setCustomers(items);
        try {
          localStorage.setItem(`app_cache_${getDataPath('customerRegistrations')}`, JSON.stringify(items));
        } catch {}
      }, (err) => {
        console.warn('onSnapshot error for customerRegistrations:', err);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Error setting up customerRegistrations listener:', err);
    }
  }, [userId]);

  // Load cached customers initially
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`app_cache_${getDataPath('customerRegistrations')}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) setCustomers(parsed);
      }
    } catch {}
  }, []);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente.trim() || !telefone.trim()) {
      setErrorMsg('Por favor, preencha o Nome do Cliente e o Telefone.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    let finalStore = lojaParceira;
    if (lojaParceira === 'Outros') {
      const cleanOther = outraLoja.trim();
      if (!cleanOther) {
        setErrorMsg('Por favor, informe o nome da outra loja parceira.');
        setTimeout(() => setErrorMsg(null), 4000);
        return;
      }
      finalStore = cleanOther;
      // Add to partner stores if not already present
      if (!partnerStores.includes(finalStore)) {
        const updatedStores = [...partnerStores, finalStore];
        setPartnerStores(updatedStores);
        try {
          localStorage.setItem('app_partner_stores', JSON.stringify(updatedStores));
        } catch {}
      }
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const valNum = valorPedido.trim() ? parseFloat(valorPedido.replace(',', '.')) : 0;
      const record: CustomerRecord = {
        nomeCliente: nomeCliente.trim(),
        telefone: telefone.trim(),
        lojaParceira: finalStore,
        valorPedido: !isNaN(valNum) && valNum > 0 ? valNum : 0,
        dataCadastro: format(new Date(), 'yyyy-MM-dd'),
        userId: userId || getDataPath(),
        createdAt: serverTimestamp()
      };

      const docRef = await safeAddDoc(collection(db, getDataPath('customerRegistrations')), record);
      const newCreated: CustomerRecord = {
        ...record,
        id: docRef?.id || `cust_${Date.now()}`
      };

      setCustomers(prev => [newCreated, ...prev]);
      try {
        localStorage.setItem(`app_cache_${getDataPath('customerRegistrations')}`, JSON.stringify([newCreated, ...customers]));
      } catch {}

      await logAction('Criação', 'Cadastro Cliente', `Cadastrou cliente "${record.nomeCliente}" da loja "${finalStore}"`, 'customerRegistrations', docRef?.id || '', record);

      setNomeCliente('');
      setTelefone('');
      setLojaParceira('GranVision');
      setOutraLoja('');
      setValorPedido('');
      setSuccessMsg('Cliente cadastrado com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error saving customer:', err);
      handleFirestoreError(err, OperationType.WRITE, getDataPath('customerRegistrations'));
      setErrorMsg('Erro ao salvar cadastro. Verifique sua conexão.');
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = (phone: string, clientName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const numberWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = `Oi, ${clientName}! Obrigado por escolher a Mr. Cheney - Shopping Plaza Sul hoje! 🍪❤️\n\nGostou do seu pedido? Conta pra gente no Google, sua avaliação nos ajuda muito:\nhttps://g.page/r/CYuaHyI6aNErEBM/review\n\nE quando quiser receber o verdadeiro cookie americano quentinho em casa, peça pela nossa loja no iFood:\nhttps://www.ifood.com.br/delivery/sao-paulo-sp/mr-cheney---plaza-sul-bosque-da-saude/4dbd8bd8-3ff3-4e5c-8d4f-cec75c600649\n\nJá estamos esperando sua próxima visita ao nosso quiosque no Piso P0! Até breve!`;
    const message = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?phone=${numberWithCountry}&text=${message}`, '_blank');
  };

  const openWhatsAppGroup = (phone: string, clientName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const numberWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const groupLink = 'https://chat.whatsapp.com/HIpBsABF691Jm0oxhe4c5q';
    const text = `Oi, ${clientName}! Tudo bem? Aqui é da Mr. Cheney - Shopping Plaza Sul 🍪❤️\n\nConvidamos você a participar do nosso Grupo VIP de Descontos e Promoções Exclusivas:\n${groupLink}\n\nTe esperamos lá!`;
    const message = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?phone=${numberWithCountry}&text=${message}`, '_blank');
  };

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = (c.nomeCliente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.telefone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.lojaParceira || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchSearch) return false;

      if (periodFilter === 'this_month') {
        try {
          const dt = parseISO(c.dataCadastro);
          const now = new Date();
          return dt >= startOfMonth(now) && dt <= endOfMonth(now);
        } catch {
          return true;
        }
      } else if (periodFilter === 'last_7_days') {
        try {
          const dt = parseISO(c.dataCadastro);
          const limitDate = subDays(new Date(), 7);
          return dt >= limitDate;
        } catch {
          return true;
        }
      }
      return true;
    });
  }, [customers, searchTerm, periodFilter]);

  // Analytics per partner store
  const analyticsByStore = useMemo(() => {
    const map: Record<string, { count: number; totalValue: number }> = {};
    filteredCustomers.forEach(c => {
      const store = c.lojaParceira || 'Outros';
      if (!map[store]) {
        map[store] = { count: 0, totalValue: 0 };
      }
      map[store].count += 1;
      map[store].totalValue += c.valorPedido || 0;
    });
    return Object.entries(map).map(([store, data]) => ({
      store,
      count: data.count,
      totalValue: data.totalValue
    })).sort((a, b) => b.count - a.count);
  }, [filteredCustomers]);

  const exportToCSV = () => {
    const headers = ['Nome do Cliente', 'Telefone', 'Loja Parceira', 'Valor do Pedido (R$)', 'Data do Cadastro'];
    const rows = filteredCustomers.map(c => [
      `"${c.nomeCliente || ''}"`,
      `"${c.telefone || ''}"`,
      `"${c.lojaParceira || ''}"`,
      c.valorPedido ? c.valorPedido.toFixed(2).replace('.', ',') : '0,00',
      `"${c.dataCadastro || ''}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cadastro_clientes_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2.5rem] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              <UserPlus className="w-7 h-7 text-emerald-600" />
              Cadastro de Clientes & Lojas Parceiras
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">
              Registre novos clientes, acompanhe o desempenho por parceiro e interaja via WhatsApp
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('register')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                activeTab === 'register' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Novo Cadastro
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                activeTab === 'analytics' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Relatórios & Gráficos
            </button>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-bold animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-sm font-bold animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {(activeTab === 'register' || !isAdmin) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Card */}
          <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Novo Cliente</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Preencha os dados do atendimento</p>
              </div>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Nome do Cliente <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Ex: Maria Silva"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Telefone / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="Ex: (11) 99999-9999"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Loja Parceira
                </label>
                <select
                  value={lojaParceira}
                  onChange={(e) => setLojaParceira(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                >
                  {partnerStores.map(store => (
                    <option key={store} value={store}>{store}</option>
                  ))}
                  <option value="Outros">Outros (Digitar...)</option>
                </select>
              </div>

              {lojaParceira === 'Outros' && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Qual a Nova Loja Parceira? <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={outraLoja}
                    onChange={(e) => setOutraLoja(e.target.value)}
                    placeholder="Ex: Ótica Diniz"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                  />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    * Será adicionada automaticamente às opções futuras.
                  </p>
                </motion.div>
              )}

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Valor do Pedido (R$) <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-sm">R$</span>
                  <input
                    type="text"
                    value={valorPedido}
                    onChange={(e) => setValorPedido(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Salvando...' : 'Cadastrar Cliente'}</span>
              </button>
            </form>
          </div>

          {/* Quick List / Summary Card */}
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xs space-y-6 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Clientes Recentes</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Últimos cadastros realizados na operação</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar cliente, telefone ou loja..."
                  className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 w-full sm:w-64"
                />
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Telefone</th>
                    <th className="py-3 px-4">Loja Parceira</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4 text-right">Ação WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-medium text-xs">
                        Nenhum cliente cadastrado até o momento.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.slice(0, 15).map((cust) => (
                      <tr key={cust.id} className="hover:bg-slate-50/80 transition-all">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{cust.nomeCliente}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-600">{cust.telefone}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full text-xs font-black uppercase tracking-wider">
                            {cust.lojaParceira}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600">
                          {cust.valorPedido ? formatCurrency(cust.valorPedido) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openWhatsApp(cust.telefone, cust.nomeCliente)}
                              title="Enviar mensagem de agradecimento, avaliação Google e iFood"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>WhatsApp</span>
                            </button>
                            <button
                              onClick={() => openWhatsAppGroup(cust.telefone, cust.nomeCliente)}
                              title="Convidar para Grupo de Desconto no WhatsApp"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                            >
                              <Store className="w-4 h-4" />
                              <span>Grupo Desconto</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isAdmin && activeTab === 'analytics' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Analytics Filters & Export */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Calendar className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">Período:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setPeriodFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                    periodFilter === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Todos
                </button>
                <button
                  onClick={() => setPeriodFilter('this_month')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                    periodFilter === 'this_month' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Este Mês
                </button>
                <button
                  onClick={() => setPeriodFilter('last_7_days')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                    periodFilter === 'last_7_days' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Últimos 7 Dias
                </button>
              </div>
            </div>

            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer w-full sm:w-auto justify-center"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Exportar CSV Completo</span>
            </button>
          </div>

          {/* Visual Charts & Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Orders per Store */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  Quantidade de Pedidos por Loja
                </h3>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total: {filteredCustomers.length} pedidos
                </span>
              </div>

              <div className="space-y-4">
                {analyticsByStore.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-8">Nenhum dado no período selecionado.</p>
                ) : (
                  analyticsByStore.map(item => {
                    const maxCount = Math.max(...analyticsByStore.map(i => i.count), 1);
                    const pct = Math.round((item.count / maxCount) * 100);
                    return (
                      <div key={item.store} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-black uppercase">
                          <span className="text-slate-700">{item.store}</span>
                          <span className="text-emerald-600">{item.count} pedidos</span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 8)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Sumarized Value per Store */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Valor Sumarizado por Loja Parceira
                </h3>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total: {formatCurrency(filteredCustomers.reduce((acc, c) => acc + (c.valorPedido || 0), 0))}
                </span>
              </div>

              <div className="space-y-4">
                {analyticsByStore.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-8">Nenhum dado no período selecionado.</p>
                ) : (
                  analyticsByStore.map(item => {
                    const maxVal = Math.max(...analyticsByStore.map(i => i.totalValue), 1);
                    const pct = Math.round((item.totalValue / maxVal) * 100);
                    return (
                      <div key={item.store} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-black uppercase">
                          <span className="text-slate-700">{item.store}</span>
                          <span className="text-emerald-600">{formatCurrency(item.totalValue)}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 8)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Full Customer Table with WhatsApp Web button */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Lista Completa de Clientes</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Todos os cadastros e contato direto via WhatsApp</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar por nome, telefone ou loja..."
                  className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 w-full sm:w-72"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Telefone</th>
                    <th className="py-3 px-4">Loja Parceira</th>
                    <th className="py-3 px-4">Valor Pedido</th>
                    <th className="py-3 px-4 text-right">Contato WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-medium text-xs">
                        Nenhum cliente encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((cust) => (
                      <tr key={cust.id} className="hover:bg-slate-50/80 transition-all">
                        <td className="py-3.5 px-4 font-medium text-slate-500 text-xs">
                          {cust.dataCadastro ? format(parseISO(cust.dataCadastro), 'dd/MM/yyyy') : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{cust.nomeCliente}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-600">{cust.telefone}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full text-xs font-black uppercase tracking-wider">
                            {cust.lojaParceira}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600">
                          {cust.valorPedido ? formatCurrency(cust.valorPedido) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openWhatsApp(cust.telefone, cust.nomeCliente)}
                              title="Enviar mensagem de agradecimento, avaliação Google e iFood"
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>WhatsApp</span>
                            </button>
                            <button
                              onClick={() => openWhatsAppGroup(cust.telefone, cust.nomeCliente)}
                              title="Convidar para Grupo de Desconto no WhatsApp"
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                            >
                              <Store className="w-4 h-4" />
                              <span>Grupo Desconto</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
