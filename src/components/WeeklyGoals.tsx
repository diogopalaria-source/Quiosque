import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Trophy, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Award, 
  Target, 
  AlertCircle, 
  Save, 
  Edit3, 
  Users, 
  Sparkles,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, doc, setDoc, addDoc, updateDoc, getDocs, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WeeklyGoalRecord, Sale } from '../types';
import { getDataPath, formatCurrency, cn } from '../lib/utils';
import { safeSetDoc, safeAddDoc, safeUpdateDoc, handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { logAction } from '../lib/logs';

interface WeeklyGoalsProps {
  userId: string;
  userRole: string;
  salesData: Sale[];
  onBack: () => void;
}

// Helper to get Thursday to Wednesday cycle for a given date
function getWeeklyCycle(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0:Sun, 1:Mon, 2:Tue, 3:Wed, 4:Thu, 5:Fri, 6:Sat
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

function parseSaleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
    return parseISO(dateStr);
  } catch {
    return null;
  }
}

function isSaleInWeek(saleDateStr: string, startThu: Date, endWed: Date): boolean {
  const dt = parseSaleDate(saleDateStr);
  if (!dt) return false;
  dt.setHours(0, 0, 0, 0);
  const s = new Date(startThu); s.setHours(0, 0, 0, 0);
  const e = new Date(endWed); e.setHours(23, 59, 59, 999);
  return dt >= s && dt <= e;
}

function isSaleOnDay(saleDateStr: string, targetDate: Date): boolean {
  const dt = parseSaleDate(saleDateStr);
  if (!dt) return false;
  dt.setHours(0, 0, 0, 0);
  const t = new Date(targetDate); t.setHours(0, 0, 0, 0);
  return dt.getTime() === t.getTime();
}

// Calculate actual sales for a week with manual daily entry precedence over CSV sales (stored in weeklyGoals document for complete isolation)
function calculateWeekActualSales(sales: Sale[], weekRecord: WeeklyGoalRecord | undefined, startThu: Date, endWed: Date): number {
  let totalWeekSum = 0;
  const weekDays: Date[] = [];
  for (let d = 0; d < 7; d++) {
    weekDays.push(addDays(startThu, d));
  }

  weekDays.forEach(dayDate => {
    const dateKey = format(dayDate, 'yyyy-MM-dd');
    const manualVal = weekRecord?.dailySales?.[dateKey];

    if (manualVal !== undefined) {
      totalWeekSum += manualVal;
    } else {
      let dayCsvSum = 0;
      sales.forEach(s => {
        if (s.produto !== 'Faturamento Diário' && s.data && isSaleOnDay(s.data, dayDate)) {
          dayCsvSum += (s.vendas || s.total || 0);
        }
      });
      totalWeekSum += dayCsvSum;
    }
  });

  return totalWeekSum;
}

export const WeeklyGoals: React.FC<WeeklyGoalsProps> = ({
  userId,
  userRole,
  salesData,
  onBack
}) => {
  const isAdmin = userRole === 'admin';
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Expanded week in admin evolution table for day-by-day entry
  const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(null);
  const [dayInputValues, setDayInputValues] = useState<Record<string, string>>({});

  const currentCycle = useMemo(() => getWeeklyCycle(new Date()), []);
  const prevCycle = useMemo(() => {
    const prevThu = subDays(currentCycle.startThu, 7);
    return getWeeklyCycle(prevThu);
  }, [currentCycle]);

  // Generate list of weeks from 4 weeks in the past to 8 weeks in the future for admin combobox
  const adminWeekOptions = useMemo(() => {
    const list: { weekKey: string; label: string }[] = [];
    let baseDate = subDays(currentCycle.startThu, 28); // 4 weeks past
    for (let i = 0; i < 13; i++) {
      const cycle = getWeeklyCycle(baseDate);
      const label = `${format(cycle.startThu, 'dd/MM/yyyy')} - ${format(cycle.endWed, 'dd/MM/yyyy')}`;
      if (!list.some(l => l.weekKey === cycle.weekKey)) {
        list.push({ weekKey: cycle.weekKey, label });
      }
      baseDate = addDays(baseDate, 7);
    }
    return list;
  }, [currentCycle]);

  // Admin state for previous year sales reference
  const [prevYearInput, setPrevYearInput] = useState('');
  const [selectedWeekKey, setSelectedWeekKey] = useState(currentCycle.weekKey);

  // Sync weekly goals from Firestore
  useEffect(() => {
    try {
      const colRef = collection(db, getDataPath('weeklyGoals'));
      const unsubscribe = onSnapshot(colRef, (snap) => {
        const records: WeeklyGoalRecord[] = [];
        snap.forEach(docSnap => {
          records.push({ ...docSnap.data(), id: docSnap.id } as WeeklyGoalRecord);
        });
        setWeeklyGoals(records);
        try {
          localStorage.setItem(`app_cache_${getDataPath('weeklyGoals')}`, JSON.stringify(records));
        } catch {}
      }, (err) => {
        console.warn('onSnapshot weeklyGoals error:', err);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('weeklyGoals listener error:', err);
    }
  }, [userId]);

  // Load cached weekly goals initially
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`app_cache_${getDataPath('weeklyGoals')}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) setWeeklyGoals(parsed);
      }
    } catch {}
  }, []);

  // Handle admin save of previous year reference
  const handleSaveGoalRef = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(prevYearInput.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      setErrorMsg('Informe um valor válido para a referência da mesma semana do ano anterior.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const startDt = parseISO(selectedWeekKey);
      const endDt = addDays(startDt, 6);
      const existing = weeklyGoals.find(g => g.weekKey === selectedWeekKey);
      const record: WeeklyGoalRecord = {
        weekKey: selectedWeekKey,
        startDate: format(startDt, 'yyyy-MM-dd'),
        endDate: format(endDt, 'yyyy-MM-dd'),
        previousYearSales: val,
        dailySales: existing?.dailySales || {},
        userId: userId || getDataPath(),
        createdAt: existing?.createdAt || serverTimestamp()
      };

      await safeSetDoc(doc(db, getDataPath('weeklyGoals'), selectedWeekKey), record);
      await logAction('Edição', 'Metas Semanais', `Atualizou referência ano anterior para semana ${selectedWeekKey}: ${formatCurrency(val)}`, 'weeklyGoals', selectedWeekKey, record);

      setSuccessMsg('Faturamento de referência salvo com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
      setPrevYearInput('');
    } catch (err: any) {
      console.error('Error saving weekly goal:', err);
      setErrorMsg('Erro ao salvar meta.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  // Handle saving day sale in weeklyGoals document for complete isolation from sales collection
  const handleSaveDaySale = async (weekKey: string, dayDate: Date) => {
    const dateKey = format(dayDate, 'yyyy-MM-dd');
    const rawVal = dayInputValues[dateKey];
    if (rawVal === undefined || rawVal === '') return;

    const val = parseFloat(rawVal.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      setErrorMsg('Informe um valor válido.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const existingGoal = weeklyGoals.find(g => g.weekKey === weekKey);
      const startDt = parseISO(weekKey);
      const endDt = addDays(startDt, 6);

      const updatedDailySales = {
        ...(existingGoal?.dailySales || {}),
        [dateKey]: val
      };

      const record: WeeklyGoalRecord = {
        weekKey,
        startDate: format(startDt, 'yyyy-MM-dd'),
        endDate: format(endDt, 'yyyy-MM-dd'),
        previousYearSales: existingGoal?.previousYearSales || 0,
        dailySales: updatedDailySales,
        userId: userId || getDataPath(),
        createdAt: existingGoal?.createdAt || serverTimestamp()
      };

      await safeSetDoc(doc(db, getDataPath('weeklyGoals'), weekKey), record);
      await logAction('Edição', 'Metas Semanais - Faturamento Diário', `Atualizou venda diária em ${dateKey} para ${formatCurrency(val)}`, 'weeklyGoals', weekKey, record);

      setSuccessMsg(`Venda de ${formatCurrency(val)} salva para ${format(dayDate, 'dd/MM/yyyy')} com sucesso!`);
      setTimeout(() => setSuccessMsg(null), 3500);
      
      setDayInputValues(prev => ({ ...prev, [dateKey]: '' }));
    } catch (err: any) {
      console.error('Error saving day sale:', err);
      setErrorMsg('Erro ao salvar venda diária.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const currentGoalRecord = useMemo(() => {
    return weeklyGoals.find(g => g.weekKey === currentCycle.weekKey);
  }, [weeklyGoals, currentCycle]);

  const prevGoalRecord = useMemo(() => {
    return weeklyGoals.find(g => g.weekKey === prevCycle.weekKey);
  }, [weeklyGoals, prevCycle]);

  // Compute week-by-week evolution history for admin: ONLY weeks where previousYearSales > 0
  const weeklyEvolutionHistory = useMemo(() => {
    const registeredGoals = weeklyGoals.filter(g => g.previousYearSales && g.previousYearSales > 0);

    const list = registeredGoals.map(g => {
      const startThu = parseISO(g.weekKey);
      const endWed = addDays(startThu, 6);
      const actual = calculateWeekActualSales(salesData, g, startThu, endWed);

      return {
        weekKey: g.weekKey,
        startThu,
        endWed,
        prevYear: g.previousYearSales || 0,
        actual
      };
    }).sort((a, b) => b.weekKey.localeCompare(a.weekKey));

    return list.map(w => {
      const prevYear = w.prevYear;
      const actual = w.actual;
      const t1 = prevYear * 1.10;
      const t2 = prevYear * 1.15;
      const t3 = prevYear * 1.20;

      let statusDescription = '';
      let badgeColor = '';

      if (prevYear === 0) {
        statusDescription = 'Sem referência do ano anterior cadastrada.';
        badgeColor = 'bg-slate-100 text-slate-600';
      } else if (actual < prevYear) {
        const diff = prevYear - actual;
        statusDescription = `Abaixo do ano anterior por ${formatCurrency(diff)}`;
        badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
      } else {
        const abovePrev = actual - prevYear;
        if (actual >= t3) {
          statusDescription = `Nível 3 Batido (+20%)! Excedeu por ${formatCurrency(actual - t3)} (Bônus R$ 50 🏆)`;
          badgeColor = 'bg-amber-100 text-amber-900 border-amber-300 font-black';
        } else if (actual >= t2) {
          const missingForT3 = t3 - actual;
          statusDescription = `Nível 2 Batido (+15%)! (Bônus R$ 30 🥈). Faltam ${formatCurrency(missingForT3)} para Nível 3`;
          badgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-200';
        } else if (actual >= t1) {
          const missingForT2 = t2 - actual;
          statusDescription = `Nível 1 Batido (+10%)! (Bônus R$ 15 🥉). Faltam ${formatCurrency(missingForT2)} para Nível 2`;
          badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        } else {
          const missingForT1 = t1 - actual;
          statusDescription = `Superou ano anterior em ${formatCurrency(abovePrev)}, mas faltam ${formatCurrency(missingForT1)} para o Nível 1 (+10%)`;
          badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
        }
      }

      return {
        ...w,
        t1,
        t2,
        t3,
        statusDescription,
        badgeColor
      };
    });
  }, [weeklyGoals, salesData]);

  // Calculate current week sales for attendant view
  const currentWeekSales = useMemo(() => {
    return calculateWeekActualSales(salesData, currentGoalRecord, currentCycle.startThu, currentCycle.endWed);
  }, [salesData, currentGoalRecord, currentCycle]);

  // Calculate previous week sales for attendant view
  const prevWeekSales = useMemo(() => {
    return calculateWeekActualSales(salesData, prevGoalRecord, prevCycle.startThu, prevCycle.endWed);
  }, [salesData, prevGoalRecord, prevCycle]);

  const currentPrevYearRef = currentGoalRecord?.previousYearSales ?? (prevWeekSales > 0 ? prevWeekSales : 5000);

  const targetLevel1 = currentPrevYearRef * 1.10;
  const targetLevel2 = currentPrevYearRef * 1.15;
  const targetLevel3 = currentPrevYearRef * 1.20;

  const currentLevel = useMemo(() => {
    if (currentWeekSales >= targetLevel3) return { level: 3, title: 'Nível 3 (+20%)', bonus: 50 };
    if (currentWeekSales >= targetLevel2) return { level: 2, title: 'Nível 2 (+15%)', bonus: 30 };
    if (currentWeekSales >= targetLevel1) return { level: 1, title: 'Nível 1 (+10%)', bonus: 15 };
    return { level: 0, title: 'Em andamento', bonus: 0 };
  }, [currentWeekSales, targetLevel1, targetLevel2, targetLevel3]);

  const remainingToNextLevel = useMemo(() => {
    if (currentLevel.level === 0) return Math.max(0, targetLevel1 - currentWeekSales);
    if (currentLevel.level === 1) return Math.max(0, targetLevel2 - currentWeekSales);
    if (currentLevel.level === 2) return Math.max(0, targetLevel3 - currentWeekSales);
    return 0;
  }, [currentLevel.level, currentWeekSales, targetLevel1, targetLevel2, targetLevel3]);

  const prevWeekPrevYearRef = prevGoalRecord?.previousYearSales ?? 5000;
  const prevWeekTarget1 = prevWeekPrevYearRef * 1.10;
  const prevWeekTarget2 = prevWeekPrevYearRef * 1.15;
  const prevWeekTarget3 = prevWeekPrevYearRef * 1.20;

  const prevWeekAchieved = useMemo(() => {
    if (prevWeekSales >= prevWeekTarget3) return { title: 'Nível 3 (+20%) batido! 🏆 (Bônus R$ 50)', bonus: 50 };
    if (prevWeekSales >= prevWeekTarget2) return { title: 'Nível 2 (+15%) batido! 🥈 (Bônus R$ 30)', bonus: 30 };
    if (prevWeekSales >= prevWeekTarget1) return { title: 'Nível 1 (+10%) batido! 🥉 (Bônus R$ 15)', bonus: 15 };
    return { title: 'Quase batemos a meta na semana anterior! Vamos com tudo para esta nova semana! 🍪💪', bonus: 0 };
  }, [prevWeekSales, prevWeekTarget1, prevWeekTarget2, prevWeekTarget3]);

  const maxBarValue = targetLevel3 * 1.08;
  const progressPercent = Math.min(100, Math.max(2, (currentWeekSales / maxBarValue) * 100));
  const p1 = (targetLevel1 / maxBarValue) * 100;
  const p2 = (targetLevel2 / maxBarValue) * 100;
  const p3 = (targetLevel3 / maxBarValue) * 100;

  // ADMIN VIEW: Administration of Goals & Week-by-Week Evolution (Only weeks with registered previous year sales)
  if (isAdmin) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                <Trophy className="w-7 h-7 text-amber-500" />
                Administração de Metas Semanais & Evolução
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">
                Cadastre o faturamento do ano anterior para habilitar a semana na tabela de evolução
              </p>
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-sm font-bold">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Cadastro de Faturamento de Referência (Ano Anterior) para Semanas Passadas e Futuras */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Cadastro de Faturamento do Ano Anterior (Passadas e Futuras)</h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Selecione qualquer semana no combobox para cadastrar ou atualizar o ano anterior</p>
            </div>
          </div>

          <form onSubmit={handleSaveGoalRef} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                Selecionar Semana (Início Quinta)
              </label>
              <select
                value={selectedWeekKey}
                onChange={(e) => setSelectedWeekKey(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium text-sm"
              >
                {adminWeekOptions.map(opt => {
                  const isCurrent = opt.weekKey === currentCycle.weekKey;
                  const hasReference = weeklyGoals.some(g => g.weekKey === opt.weekKey && g.previousYearSales > 0);
                  return (
                    <option key={opt.weekKey} value={opt.weekKey}>
                      {isCurrent ? '⚡ Semana Vigente: ' : ''}{opt.label} {hasReference ? ' (Cadastrada)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                Faturamento Ano Anterior (R$) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-sm">R$</span>
                <input
                  type="text"
                  value={prevYearInput}
                  onChange={(e) => setPrevYearInput(e.target.value)}
                  placeholder="Ex: 12500,00"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Referência Semanal</span>
            </button>
          </form>
        </div>

        {/* 2. Evolução Semana a Semana (Painel do Administrador - Apenas semanas com faturamento cadastrado) */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Evolução Semanal de Metas (Apenas Semanas Cadastradas)</h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Exibe apenas as semanas que possuem faturamento do ano anterior cadastrado</p>
            </div>
          </div>

          <div className="space-y-4">
            {weeklyEvolutionHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-medium text-xs">
                Nenhuma semana possui faturamento do ano anterior cadastrado. Selecione uma semana acima para cadastrar a primeira meta!
              </div>
            ) : (
              weeklyEvolutionHistory.map((item) => {
                const isExpanded = expandedWeekKey === item.weekKey;

                const weekDays: Date[] = [];
                for (let d = 0; d < 7; d++) {
                  weekDays.push(addDays(item.startThu, d));
                }

                return (
                  <div key={item.weekKey} className="bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden transition-all">
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setExpandedWeekKey(isExpanded ? null : item.weekKey)}
                            className="p-2 bg-white hover:bg-slate-200 rounded-xl text-slate-700 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 text-xs font-black uppercase tracking-wider"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-emerald-600" /> : <ChevronDown className="w-4 h-4 text-emerald-600" />}
                            <span>{isExpanded ? 'Ocultar Dias' : 'Detalhar Dia a Dia'}</span>
                          </button>
                          <span className="font-black text-slate-900 text-sm">
                            {format(item.startThu, 'dd/MM/yyyy')} até {format(item.endWed, 'dd/MM/yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                          <span>Ref. Ano Anterior: <strong className="text-slate-800">{formatCurrency(item.prevYear)}</strong></span>
                          <span>Vendas Realizadas: <strong className="text-emerald-600">{formatCurrency(item.actual)}</strong></span>
                        </div>
                      </div>

                      <div>
                        <span className={cn("px-3.5 py-1.5 rounded-xl border inline-block font-bold text-xs", item.badgeColor)}>
                          {item.statusDescription}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Day-by-Day Entry View */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-white border-t border-slate-200 p-6 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                            Cadastro de Faturamento Diário (Ciclo Quinta a Quarta)
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Lançamentos manuais têm prioridade absoluta sobre o CSV
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                          {weekDays.map((dayDate) => {
                            const dateKey = format(dayDate, 'yyyy-MM-dd');
                            
                            const goalRecord = weeklyGoals.find(g => g.weekKey === item.weekKey);
                            const manualVal = goalRecord?.dailySales?.[dateKey];
                            const csvSum = salesData
                              .filter(s => s.produto !== 'Faturamento Diário' && s.data && isSaleOnDay(s.data, dayDate))
                              .reduce((acc, s) => acc + (s.vendas || s.total || 0), 0);

                            const effectiveVal = manualVal !== undefined ? manualVal : csvSum;
                            const isManual = manualVal !== undefined;

                            const dayName = format(dayDate, 'EEEE', { locale: undefined }) || '';
                            const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);

                            return (
                              <div key={dateKey} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3 flex flex-col justify-between">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                    {formattedDayName}
                                  </span>
                                  <span className="text-xs font-black text-slate-900 block">
                                    {format(dayDate, 'dd/MM/yyyy')}
                                  </span>
                                  <div className="text-xs font-black text-emerald-600 pt-1">
                                    {isManual ? `Cadastrado: ${formatCurrency(effectiveVal)}` : (csvSum > 0 ? `CSV: ${formatCurrency(csvSum)}` : 'Não cadastrado')}
                                  </div>
                                </div>

                                <div className="space-y-2 pt-3 border-t border-slate-200/60">
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-2 text-slate-400 font-bold text-xs">R$</span>
                                    <input
                                      type="text"
                                      value={dayInputValues[dateKey] ?? ''}
                                      onChange={(e) => setDayInputValues(prev => ({ ...prev, [dateKey]: e.target.value }))}
                                      placeholder={String(effectiveVal).replace('.', ',')}
                                      className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium text-xs"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => handleSaveDaySale(item.weekKey, dayDate)}
                                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                                  >
                                    {isManual ? 'Atualizar' : 'Salvar'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ATTENDANT VIEW: Current week progress card & Previous week encouraging message summary
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              <Trophy className="w-7 h-7 text-amber-500" />
              Metas Semanais (Bônus)
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5">
              Ciclo semanal: Quinta-feira a Quarta-feira • Acompanhe a evolução e bônus
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-8 sm:p-10 rounded-[3rem] shadow-xl relative overflow-hidden space-y-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-6 relative z-10">
          <div>
            <span className="px-3.5 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Ciclo Atual (Qui a Qua)
            </span>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
              De {format(currentCycle.startThu, 'dd/MM')} até {format(currentCycle.endWed, 'dd/MM')}
            </h2>
          </div>
          <div className="text-right sm:text-left">
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider block">Faturamento Atual</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-400">{formatCurrency(currentWeekSales)}</span>
          </div>
        </div>

        {/* Previous Week Result Summary with Motivational Message if Level 1 not reached */}
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl flex items-center gap-3">
          <Award className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs font-bold text-slate-300">
            <span className="text-slate-400 uppercase tracking-wider block text-[10px]">Resultado da Semana Anterior ({format(prevCycle.startThu, 'dd/MM')} - {format(prevCycle.endWed, 'dd/MM')}):</span>
            <span className="text-white font-black">{prevWeekAchieved.title}</span>
          </div>
        </div>

        {/* 3 Goal Levels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
          {/* Nível 1 */}
          <div className={cn(
            "p-5 rounded-2xl border transition-all flex flex-col justify-between",
            currentLevel.level === 1 ? "bg-amber-500/25 border-amber-400 text-amber-100 shadow-lg ring-2 ring-amber-400/50" :
            currentLevel.level > 1 ? "bg-slate-800/40 border-slate-700/80 text-slate-400 opacity-75" :
            "bg-slate-800/60 border-slate-700 text-slate-300"
          )}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider opacity-90 block">Nível 1 (+10% Aumento)</span>
                {currentLevel.level > 1 && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Superado ✅</span>}
                {currentLevel.level === 1 && <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">Ativo ⚡</span>}
              </div>
              <div className="text-lg font-black mt-1">{formatCurrency(targetLevel1)}</div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-black">
              <span>Bônus Nível 1:</span>
              <span className={cn("text-sm", currentLevel.level === 1 ? "text-amber-300 font-black" : "text-slate-400")}>R$ 15,00 / func</span>
            </div>
          </div>

          {/* Nível 2 */}
          <div className={cn(
            "p-5 rounded-2xl border transition-all flex flex-col justify-between",
            currentLevel.level === 2 ? "bg-amber-500/25 border-amber-400 text-amber-100 shadow-lg ring-2 ring-amber-400/50" :
            currentLevel.level > 2 ? "bg-slate-800/40 border-slate-700/80 text-slate-400 opacity-75" :
            "bg-slate-800/60 border-slate-700 text-slate-300"
          )}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider opacity-90 block">Nível 2 (+15% Aumento)</span>
                {currentLevel.level > 2 && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Superado ✅</span>}
                {currentLevel.level === 2 && <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">Ativo ⚡</span>}
              </div>
              <div className="text-lg font-black mt-1">{formatCurrency(targetLevel2)}</div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-black">
              <span>Bônus Nível 2:</span>
              <span className={cn("text-sm", currentLevel.level === 2 ? "text-amber-300 font-black" : "text-slate-400")}>R$ 30,00 / func</span>
            </div>
          </div>

          {/* Nível 3 */}
          <div className={cn(
            "p-5 rounded-2xl border transition-all flex flex-col justify-between",
            currentLevel.level === 3 ? "bg-amber-500/25 border-amber-400 text-amber-100 shadow-lg ring-2 ring-amber-400/50" :
            "bg-slate-800/60 border-slate-700 text-slate-300"
          )}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider opacity-90 block">Nível 3 (+20% Aumento) 🏆</span>
                {currentLevel.level === 3 && <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">Ativo ⚡</span>}
              </div>
              <div className="text-lg font-black mt-1">{formatCurrency(targetLevel3)}</div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-black">
              <span>Bônus Nível 3:</span>
              <span className={cn("text-sm", currentLevel.level === 3 ? "text-amber-300 font-black" : "text-slate-400")}>R$ 50,00 / func</span>
            </div>
          </div>
        </div>

        {/* Progress Bar with Markers */}
        <div className="space-y-3 relative z-10 pt-2">
          <div className="flex justify-between text-xs font-black uppercase tracking-wider text-slate-400">
            <span>Semana Atual ({currentLevel.title}{currentLevel.bonus > 0 ? ` • Bônus: ${formatCurrency(currentLevel.bonus)}/func` : ''})</span>
            <span>Ref. Ano Anterior: {formatCurrency(currentPrevYearRef)}</span>
          </div>

          <div className="w-full bg-slate-800 h-6 rounded-full overflow-hidden p-1 relative border border-slate-700">
            <div className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-20" style={{ left: `${p1}%` }} title="Nível 1 (+10%)"></div>
            <div className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-20" style={{ left: `${p2}%` }} title="Nível 2 (+15%)"></div>
            <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-20" style={{ left: `${p3}%` }} title="Nível 3 (+20%)"></div>

            <div
              className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 h-full rounded-full transition-all duration-700 relative"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
            <span style={{ position: 'absolute', left: `${p1}%`, transform: 'translateX(-50%)' }}>+10%</span>
            <span style={{ position: 'absolute', left: `${p2}%`, transform: 'translateX(-50%)' }}>+15%</span>
            <span style={{ position: 'absolute', left: `${p3}%`, transform: 'translateX(-50%)' }} className="text-amber-300 font-black">+20% 🏆</span>
          </div>
        </div>

        {/* Amount Remaining to Next Level */}
        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between text-sm font-bold relative z-10">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            <span>Falta para o próximo nível:</span>
          </div>
          <span className="text-amber-300 font-black text-lg">
            {remainingToNextLevel > 0 ? formatCurrency(remainingToNextLevel) : 'Meta Máxima Atingida! 🎉'}
          </span>
        </div>
      </div>
    </div>
  );
};
