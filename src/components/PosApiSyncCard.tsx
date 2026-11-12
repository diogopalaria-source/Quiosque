import React, { useState, useEffect } from 'react';
import { Terminal, CheckCircle2, AlertCircle, Globe, Key, RefreshCw, Database } from 'lucide-react';
import { cn, getDataPath } from '../lib/utils';
import { collection, doc, setDoc, query, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, parseISO, addDays } from 'date-fns';
import { logAction } from '../lib/logs';
import { WeeklyGoalRecord } from '../types';

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

export const PosApiSyncCard: React.FC = () => {
  const [apiUrl, setApiUrl] = useState('https://api.alfalabs.com.br/v2/orders?date=2026-11-11');
  const [authHeader, setAuthHeader] = useState('7e00399e6a8823af50e5a841b8f158821f91b685');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentEnvironment = getDataPath();
  const isProd = currentEnvironment.includes('shared_franquia_data');

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('pos_api_token');
      if (savedToken) setAuthHeader(savedToken);
    } catch {}
  }, []);

  const handleSaveToken = (token: string) => {
    setAuthHeader(token);
    try {
      localStorage.setItem('pos_api_token', token);
    } catch {}
  };

  const handleSyncDailyGoalsOnly = async (targetRange: 'yesterday' | 'nov_1_to_11') => {
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
      const dailyTotalsMap: Record<string, number> = {};

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
          let items: any[] = [];
          if (Array.isArray(apiRes.data)) {
            items = apiRes.data;
          } else if (apiRes.data.orders && Array.isArray(apiRes.data.orders)) {
            items = apiRes.data.orders;
          } else if (apiRes.data.data && Array.isArray(apiRes.data.data)) {
            items = apiRes.data.data;
          } else if (apiRes.data.items && Array.isArray(apiRes.data.items)) {
            items = apiRes.data.items;
          } else {
            items = [apiRes.data];
          }

          totalSyncedOrders += items.length;
          let dayNetSum = 0;

          items.forEach((order: any) => {
            // Net order amount for daily goals (desconsiderando descontos para as metas dia a dia)
            const orderNetTotal = Number(
              order.total?.orderAmount || 
              (Number(order.total?.subTotal || 0) - Number(order.discountDetails?.discount || order.total?.discount || 0)) || 
              order.total?.subTotal || 
              0
            );
            if (orderNetTotal > 0) {
              dayNetSum += orderNetTotal;
            }
          });

          dailyTotalsMap[dateStr] = dayNetSum;
        }
      }

      // Update weeklyGoals dailySales for each date (strictly metas, sales collection untouched)
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

      await logAction('Criação', 'POS API Metas', `Atualizou metas diárias de faturamento via API Alfalabs (${targetRange}).`, 'weeklyGoals', 'pos_sync_metas', { targetRange, dailyTotalsMap });

      setSyncMsg(`Sincronização de Metas concluída! ${totalSyncedOrders} pedidos processados. Valores líquidos (sem descontos) atualizados na Seção de Metas. Ambiente: ${currentEnvironment}`);
      setTimeout(() => setSyncMsg(null), 8000);
    } catch (err: any) {
      console.error('Sync error:', err);
      setErrorMsg(err?.message || 'Erro ao sincronizar metas com a POS API.');
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-6 border border-slate-800 shadow-xl md:col-span-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">Integração Exclusiva Administrador</span>
            <h3 className="text-xl font-black text-white">Sincronização Automática POS API (Alfalabs) — Metas Diárias</h3>
          </div>
        </div>
        <div className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span>{isProd ? 'Produção' : 'Teste / QA'}</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-2xl flex items-center gap-3 text-sm font-bold">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {syncMsg && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-2xl flex items-center gap-3 text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{syncMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Key className="w-4 h-4 text-indigo-400" /> Token de Acesso / API Key
          </label>
          <input
            type="text"
            value={authHeader}
            onChange={(e) => handleSaveToken(e.target.value)}
            placeholder="Bearer token ou chave API"
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 font-mono text-xs focus:border-amber-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-400 sm:mb-2 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-amber-400" /> Endpoint Base
          </label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 font-mono text-xs"
          />
        </div>
      </div>

      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2">
        <p className="text-xs text-slate-300 font-medium leading-relaxed">
          <strong>Modo Ativo (Stand-by em Vendas Realizadas):</strong> Conforme solicitado, esta sincronização atualiza <strong>apenas o valor faturado do dia anterior</strong> (ou período de novembro) na <strong>Sessão de Metas</strong> (descontando cupons/descontos). O arquivo *Vendas Realizadas* permanece inalterado por enquanto.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={() => handleSyncDailyGoalsOnly('nov_1_to_11')}
          disabled={syncing}
          className="px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
          <span>{syncing ? 'Sincronizando...' : '⚡ Sincronizar Metas de Novembro (01/11 a 11/11)'}</span>
        </button>

        <button
          onClick={() => handleSyncDailyGoalsOnly('yesterday')}
          disabled={syncing}
          className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
          <span>{syncing ? 'Sincronizando...' : '📅 Sincronizar Faturamento de Ontem (Metas)'}</span>
        </button>
      </div>
    </div>
  );
};
