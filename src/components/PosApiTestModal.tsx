import React, { useState } from 'react';
import { 
  X, 
  Terminal, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Globe, 
  Key, 
  ShieldCheck, 
  Code,
  Copy,
  Check,
  RefreshCw,
  Database
} from 'lucide-react';
import { formatCurrency, cn, getDataPath, getMacroForProduct } from '../lib/utils';
import { collection, doc, setDoc, writeBatch, serverTimestamp, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, parseISO, addDays } from 'date-fns';
import { logAction } from '../lib/logs';
import { WeeklyGoalRecord } from '../types';

interface PosApiTestModalProps {
  onClose: () => void;
}

function computeYesterdaySalesSummary(data: any) {
  if (!data) return { total: 0, count: 0, totalDiscount: 0, couponsCount: 0, items: [] };
  
  let items: any[] = [];
  if (Array.isArray(data)) {
    items = data;
  } else if (data.orders && Array.isArray(data.orders)) {
    items = data.orders;
  } else if (data.data && Array.isArray(data.data)) {
    items = data.data;
  } else if (data.items && Array.isArray(data.items)) {
    items = data.items;
  } else {
    items = [data];
  }

  let sum = 0;
  let count = 0;
  let totalDiscount = 0;
  let couponsCount = 0;

  items.forEach((item: any) => {
    let val = 0;
    if (typeof item.total === 'object' && item.total !== null) {
      val = Number(item.total.orderAmount || item.total.subTotal || item.total.total || 0);
    } else {
      val = Number(
        item.total || 
        item.valor || 
        item.amount || 
        item.grandTotal || 
        item.grand_total || 
        item.price || 
        item.vendas || 
        item.net_amount ||
        item.value ||
        item.orderAmount ||
        item.order_amount ||
        0
      );
    }
    if (val > 0) {
      sum += val;
      count++;
    }

    const discountVal = Number(
      item.discountDetails?.discount ||
      item.discountDetails?.total ||
      item.discount ||
      item.couponDiscount ||
      0
    );
    if (discountVal > 0) {
      totalDiscount += discountVal;
    }

    const couponCode = 
      item.discountDetails?.code ||
      item.coupon ||
      item.couponCode ||
      item.discountCode;

    if (couponCode) {
      couponsCount++;
    }
  });

  if (sum === 0 && typeof data === 'object') {
    for (const k of Object.keys(data)) {
      const lower = k.toLowerCase();
      if ((lower.includes('total') || lower.includes('valor') || lower.includes('vendas')) && typeof data[k] === 'number') {
        sum = data[k];
        count = 1;
      }
    }
  }

  return { total: sum, count, totalDiscount, couponsCount, items };
}

function getWeeklyCycle(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToThu = day >= 4 ? day - 4 : day + 3;
  const startThu = new Date(d);
  startThu.setDate(d.getDate() - diffToThu);
  startThu.setHours(0, 0, 0, 0);

  const endWed = new Date(startThu);
  endWed.setDate(startThu.getDate() + 6);
  endWed.setHours(23, 59, 59, 999);

  const weekKey = format(startThu, 'yyyy-MM-dd');
  return { startThu, endWed, weekKey };
}

export const PosApiTestModal: React.FC<PosApiTestModalProps> = ({ onClose }) => {
  const [apiUrl, setApiUrl] = useState('https://api.alfalabs.com.br/v2/orders?date=2026-11-11');
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [authHeader, setAuthHeader] = useState('7e00399e6a8823af50e5a841b8f158821f91b685');
  const [customHeaders, setCustomHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [requestBody, setRequestBody] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentEnvironment = getDataPath();
  const isProd = currentEnvironment.includes('shared_franquia_data');

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiUrl.trim()) {
      setErrorMsg('Informe a URL da API.');
      return;
    }

    setLoading(true);
    setResult(null);
    setErrorMsg(null);
    setSyncMsg(null);

    try {
      let headersObj: Record<string, string> = {};
      try {
        if (customHeaders.trim()) {
          headersObj = JSON.parse(customHeaders);
        }
      } catch {
        setErrorMsg('JSON de cabeçalhos personalizado inválido.');
        setLoading(false);
        return;
      }

      if (authHeader.trim()) {
        headersObj['Authorization'] = authHeader.startsWith('Bearer ') || authHeader.startsWith('Basic ') 
          ? authHeader 
          : `Bearer ${authHeader}`;
      }

      let bodyData = undefined;
      if (method === 'POST' && requestBody.trim()) {
        try {
          bodyData = JSON.parse(requestBody);
        } catch {
          bodyData = requestBody;
        }
      }

      const res = await fetch('/api/test-pos-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: apiUrl.trim(),
          method,
          headers: headersObj,
          body: bodyData
        })
      });

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error('API Test Error:', err);
      setErrorMsg(err?.message || 'Erro de comunicação ao testar a API.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOrders = async (targetRange: 'yesterday' | 'nov_1_to_11') => {
    setSyncing(true);
    setSyncMsg(null);
    setErrorMsg(null);

    try {
      let headersObj: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authHeader.trim()) {
        headersObj['Authorization'] = authHeader.startsWith('Bearer ') || authHeader.startsWith('Basic ') 
          ? authHeader 
          : `Bearer ${authHeader}`;
      }

      const datesToFetch: string[] = [];
      if (targetRange === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        datesToFetch.push(format(y, 'yyyy-MM-dd'));
      } else if (targetRange === 'nov_1_to_11') {
        for (let d = 1; d <= 11; d++) {
          const dayStr = d < 10 ? `0${d}` : `${d}`;
          datesToFetch.push(`2026-11-${dayStr}`);
        }
      }

      let totalSyncedOrders = 0;
      let totalItemsAdded = 0;
      const dailyTotalsMap: Record<string, number> = {};
      const allSalesBatch: any[] = [];

      // Build product category lookup from uploaded production CSV and existing sales records
      const productCategoryMap = new Map<string, string>();
      try {
        const csvRes = await fetch('/assets/aistudio/relatorioProdutos_out26_ab2f54fd.csv');
        if (csvRes.ok) {
          const csvText = await csvRes.text();
          const lines = csvText.split('\n');
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(';');
            if (parts.length >= 5) {
              const prodName = parts[1].trim().toLowerCase();
              const catName = parts[4].trim();
              if (prodName && catName && catName !== 'Outros') {
                productCategoryMap.set(prodName, catName);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not load production CSV categories:', err);
      }

      try {
        const existingSalesSnap = await getDocs(collection(db, getDataPath('sales')));
        existingSalesSnap.forEach(docSnap => {
          const d = docSnap.data();
          if (d.produto && d.categoria && d.categoria.trim() && d.categoria !== 'Outros') {
            productCategoryMap.set(d.produto.trim().toLowerCase(), d.categoria.trim());
          }
        });
      } catch (err) {
        console.warn('Could not load existing sales categories:', err);
      }

      for (const dateStr of datesToFetch) {
        const url = `https://api.alfalabs.com.br/v2/orders?date=${dateStr}`;
        const res = await fetch('/api/test-pos-api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            method: 'GET',
            headers: headersObj
          })
        });

        const apiRes = await res.json();
        if (apiRes.success && apiRes.data) {
          const summary = computeYesterdaySalesSummary(apiRes.data);
          totalSyncedOrders += summary.count;

          let dayGrossSum = 0;

          summary.items.forEach((order: any) => {
            // Net order amount for daily goals (desconsiderando descontos para as metas dia a dia)
            const orderNetTotal = Number(
              order.total?.orderAmount || 
              (Number(order.total?.subTotal || 0) - Number(order.discountDetails?.discount || order.total?.discount || 0)) || 
              order.total?.subTotal || 
              0
            );
            dayGrossSum += orderNetTotal;

            let saleDateFormatted = format(parseISO(dateStr), 'dd/MM/yyyy');
            if (order.createdAt) {
              try {
                const parsedDt = parseISO(order.createdAt.replace(' ', 'T'));
                if (!isNaN(parsedDt.getTime())) {
                  saleDateFormatted = format(parsedDt, 'dd/MM/yyyy');
                }
              } catch {}
            }

            if (order.items && Array.isArray(order.items)) {
              order.items.forEach((item: any, idx: number) => {
                const qty = Number(item.quantity || 1);
                const unitPrice = Number(item.unitPrice || (item.price / qty) || 0);
                const grossItemTotal = qty * unitPrice; // Gross without discount

                const rawProductName = (item.name || item.productName || item.description || item.title || 'Produto POS').trim();
                const lookupKey = rawProductName.toLowerCase();

                let resolvedCategory = item.category;
                if (!resolvedCategory || !resolvedCategory.trim() || resolvedCategory === 'Outros') {
                  resolvedCategory = productCategoryMap.get(lookupKey) || getMacroForProduct(rawProductName);
                }

                const saleId = `pos_${dateStr}_${order.id || 'ord'}_${item.id || idx}`;

                allSalesBatch.push({
                  id: saleId,
                  data: saleDateFormatted,
                  mes: 'Novembro',
                  produto: rawProductName,
                  quantidade: qty,
                  precoUnitario: unitPrice,
                  total: grossItemTotal,
                  vendas: grossItemTotal,
                  categoria: resolvedCategory || 'Outros',
                  origem: 'POS API',
                  tipoEntrega: order.deliveryType || 'Balcão',
                  nome: order.customer?.name || 'Cliente POS'
                });
                totalItemsAdded++;
              });
            }
          });

          dailyTotalsMap[dateStr] = dayGrossSum;
        }
      }

      // 1. Save all sales in batches to 'sales' collection (using deterministic IDs to prevent duplication on re-sync)
      if (allSalesBatch.length > 0) {
        const colRef = collection(db, getDataPath('sales'));
        let batch = writeBatch(db);
        let count = 0;
        for (const item of allSalesBatch) {
          const docRef = doc(colRef, item.id);
          batch.set(docRef, {
            ...item,
            userId: getDataPath(),
            createdAt: serverTimestamp()
          }, { merge: true });
          count++;
          if (count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      }

      // 2. Update weeklyGoals dailySales for each date
      for (const [dateKey, daySum] of Object.entries(dailyTotalsMap)) {
        const dt = parseISO(dateKey);
        const cycle = getWeeklyCycle(dt);
        const weekKey = cycle.weekKey;
        const startDt = parseISO(weekKey);
        const endDt = addDays(startDt, 6);

        const goalDocRef = doc(db, getDataPath('weeklyGoals'), weekKey);
        
        let existingDailySales: Record<string, number> = {};
        try {
          const snap = await getDocs(query(collection(db, getDataPath('weeklyGoals'))));
          snap.forEach(d => {
            if (d.id === weekKey) {
              const data = d.data() as WeeklyGoalRecord;
              if (data.dailySales) existingDailySales = { ...data.dailySales };
            }
          });
        } catch {}

        existingDailySales[dateKey] = daySum;

        const recordUpdate: any = {
          weekKey,
          startDate: format(startDt, 'yyyy-MM-dd'),
          endDate: format(endDt, 'yyyy-MM-dd'),
          dailySales: existingDailySales,
          userId: getDataPath(),
          createdAt: serverTimestamp()
        };
        await setDoc(goalDocRef, recordUpdate, { merge: true });
      }

      await logAction('Criação', 'POS API', `Sincronizou ${totalSyncedOrders} pedidos e ${totalItemsAdded} itens da API Alfalabs (${targetRange}).`, 'sales', 'pos_sync', { totalSyncedOrders, totalItemsAdded, targetRange });

      setSyncMsg(`Sincronização realizada com sucesso! ${totalSyncedOrders} pedidos processados (${totalItemsAdded} itens adicionados em Vendas Realizadas e metas diárias atualizadas). Ambiente atual: ${currentEnvironment}`);
      setTimeout(() => setSyncMsg(null), 8000);
    } catch (err: any) {
      console.error('Sync error:', err);
      setErrorMsg(err?.message || 'Erro ao sincronizar com a POS API.');
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyJson = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-8 py-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Sincronização & Teste POS API</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">
                Integração de Caixa • Vendas Realizadas & Metas Diárias
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1">
          
          {/* Environment & Automation Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                  Ambiente Ativo: {isProd ? 'Produção (shared_franquia_data)' : 'Teste / QA (dev_qa_franquia_data)'}
                </h4>
              </div>
              <p className="text-xs font-medium text-amber-800">
                Você pode testar e sincronizar os dados aqui em ambiente de testes. Quando estiver pronto para atualizar a base oficial, basta alternar para Produção. Os valores sobem sem descontos aplicados (conforme sua regra).
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-sm font-bold">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {syncMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{syncMsg}</span>
            </div>
          )}

          {/* Quick Production Sync Action Panel */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-4 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">Automação de Caixa (POS API)</span>
                <h3 className="text-lg font-black text-white">Importação e Atualização de Vendas & Metas</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-xl">Diário às 06:00 AM</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Clique abaixo para disparar a sincronização dos pedidos da API. O sistema alimentará automaticamente o arquivo <strong>Vendas Realizadas</strong> (com os produtos e quantidades sem desconto) e cravará os valores na <strong>Sessão de Metas</strong> (01 a 11 de Novembro ou o dia anterior).
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => handleSyncOrders('nov_1_to_11')}
                disabled={syncing}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                <span>{syncing ? 'Sincronizando...' : '⚡ Sincronizar Novembro (01/11 a 11/11)'}</span>
              </button>

              <button
                onClick={() => handleSyncOrders('yesterday')}
                disabled={syncing}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                <span>{syncing ? 'Sincronizando...' : '📅 Sincronizar Ontem (Diário)'}</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleTestConnection} className="space-y-5 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Validação Manual de Requisições HTTP</h3>
            
            {/* URL and Method */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-amber-600" /> Endpoint URL da API
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://sua-api-pos.com/v1/orders"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium text-sm focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Método HTTP
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold text-sm"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
            </div>

            {/* Auth and Headers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-indigo-600" /> Token de Acesso / API Key
                </label>
                <input
                  type="text"
                  value={authHeader}
                  onChange={(e) => setAuthHeader(e.target.value)}
                  placeholder="Bearer seu_token_aqui ou Chave API"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Code className="w-4 h-4 text-emerald-600" /> Cabeçalhos HTTP Adicionais (JSON)
                </label>
                <input
                  type="text"
                  value={customHeaders}
                  onChange={(e) => setCustomHeaders(e.target.value)}
                  placeholder='{"Content-Type": "application/json"}'
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium text-sm font-mono"
                />
              </div>
            </div>

            {method === 'POST' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Corpo da Requisição (JSON Body)
                </label>
                <textarea
                  rows={3}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder='{"startDate": "2026-11-01", "status": "completed"}'
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-mono text-xs"
                />
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'Testando Conexão...' : 'Executar Teste de Requisição'}</span>
              </button>
            </div>
          </form>

          {/* Response Section */}
          {result && (
            <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 space-y-4 border border-slate-800 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5",
                    result.success ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  )}>
                    {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>Status: {result.status} {result.statusText}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 px-3 py-1.5 bg-slate-800 rounded-xl">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{result.responseTimeMs} ms</span>
                  </div>
                </div>

                <button
                  onClick={handleCopyJson}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar JSON'}</span>
                </button>
              </div>

              {/* Automatic Sales Analysis Card */}
              {result.success && (() => {
                const summary = computeYesterdaySalesSummary(result.data);
                return (
                  <div className="bg-gradient-to-r from-amber-500/20 to-indigo-500/20 border border-amber-500/40 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">Análise Automática de Vendas & Cupons (POS API)</span>
                      <h4 className="text-xl font-black text-white">{formatCurrency(summary.total)}</h4>
                      <p className="text-xs font-bold text-slate-300">
                        Total de {summary.count} pedidos • {summary.couponsCount} cupom(ns) aplicado(s) ({formatCurrency(summary.totalDiscount)} em descontos)
                      </p>
                    </div>
                    <div className="px-4 py-2 bg-amber-500 text-slate-900 rounded-xl font-black text-xs uppercase tracking-wider shadow-md shrink-0">
                      API Sincronizada ⚡
                    </div>
                  </div>
                );
              })()}

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Payload de Resposta (JSON)</span>
                <pre className="bg-slate-950 p-4 rounded-2xl text-emerald-400 font-mono text-xs overflow-x-auto max-h-96 border border-slate-800/80">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-8 py-5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Endpoint oficial Alfalabs: <code className="bg-slate-200/80 px-2 py-0.5 rounded text-[11px] font-mono text-slate-700">https://api.alfalabs.com.br/v2/orders?date=YYYY-MM-DD</code>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
