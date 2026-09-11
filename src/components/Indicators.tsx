import React, { useMemo } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Activity as ActivityIcon,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Target,
  Info,
  TrendingDown,
  BarChart3,
  Zap,
  ShieldCheck,
  TrendingUp as TrendingUpIcon,
  Wallet,
  History,
  Timer,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { MonthlyClosing } from '../types';

interface IndicatorsProps {
  stats: MonthlyClosing;
  evolutionData: Array<{
    month: string;
    receitaLiquida: number;
    lucroLiquido: number;
    cmv: number;
    gastosFixos: number;
    gastosVariaveis: number;
    margemContribuicao: number;
    custoOcupacao: number;
    custoPessoal: number;
    totalStaffPayments?: number;
  }>;
}

export const Indicators: React.FC<IndicatorsProps> = ({ stats, evolutionData }) => {
  const [activeInfo, setActiveInfo] = React.useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = React.useState<string>("Lucro Líquido");
  const [isSimulationOpen, setIsSimulationOpen] = React.useState<boolean>(false);
  const [isEditingPayback, setIsEditingPayback] = React.useState<boolean>(false);

  // Faturamento provisório/simulado para meses em aberto (ex: meses com receita muito baixa ou em andamento)
  const [provisionalRevenues, setProvisionalRevenues] = React.useState<Record<string, number>>(() => {
    try {
      const persisted = localStorage.getItem('provisional_revenues');
      if (persisted) {
        return JSON.parse(persisted);
      }
    } catch (e) {
      console.error(e);
    }
    // Valor padrão inteligente para maio de 2026 com base no feedback real do usuário
    return { "05/2026": 51400 };
  });

  const updateProvisionalRevenue = (month: string, val: number) => {
    const updated = { ...provisionalRevenues, [month]: val };
    setProvisionalRevenues(updated);
    try {
      localStorage.setItem('provisional_revenues', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const removeProvisionalRevenue = (month: string) => {
    const updated = { ...provisionalRevenues };
    delete updated[month];
    setProvisionalRevenues(updated);
    try {
      localStorage.setItem('provisional_revenues', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const simulatedEvolutionData = useMemo(() => {
    return evolutionData.map(d => {
      const overrideVal = provisionalRevenues[d.month];
      // Apenas aplica faturamento provisório se for um mês de baixa receita (< 5000), caracterizando mês em aberto
      if (overrideVal !== undefined && overrideVal !== null && d.receitaLiquida < 5000) {
        const simulatedReceitaLiquida = overrideVal;
        const simulatedLucroLiquido = simulatedReceitaLiquida - (d.cmv + d.gastosFixos + d.gastosVariaveis) + (d.totalStaffPayments || 0);
        const simulatedMargemContribuicao = simulatedReceitaLiquida > 0 ? ((simulatedReceitaLiquida - d.cmv - d.gastosVariaveis) / simulatedReceitaLiquida) * 100 : 0;
        return {
          ...d,
          receitaLiquida: simulatedReceitaLiquida,
          lucroLiquido: simulatedLucroLiquido,
          margemContribuicao: simulatedMargemContribuicao,
          isProvisional: true
        };
      }
      return d;
    });
  }, [evolutionData, provisionalRevenues]);

  const simulatedStats = useMemo(() => {
    const activeMonths = evolutionData.map(d => d.month);
    const receitaLiquida = simulatedEvolutionData.reduce((sum, d) => sum + d.receitaLiquida, 0);
    const cmv = simulatedEvolutionData.reduce((sum, d) => sum + d.cmv, 0);
    const gastosFixos = simulatedEvolutionData.reduce((sum, d) => sum + d.gastosFixos, 0);
    const gastosVariaveis = simulatedEvolutionData.reduce((sum, d) => sum + d.gastosVariaveis, 0);
    const totalStaffPayments = simulatedEvolutionData.reduce((sum, d) => sum + (d.totalStaffPayments || 0), 0);
    const lucroLiquido = receitaLiquida - (cmv + gastosFixos + gastosVariaveis) + totalStaffPayments;
    
    // Obter custos específicos agregados baseado em simulatedEvolutionData
    const custoOcupacao = simulatedEvolutionData.reduce((sum, d) => sum + d.custoOcupacao, 0);
    const custoPessoal = simulatedEvolutionData.reduce((sum, d) => sum + d.custoPessoal, 0);

    const hasAnyOverride = activeMonths.some(m => {
      const monthData = evolutionData.find(d => d.month === m);
      return provisionalRevenues[m] !== undefined && monthData && monthData.receitaLiquida < 5000;
    });

    if (hasAnyOverride) {
      return {
        ...stats,
        receitaLiquida,
        cmv,
        gastosFixos,
        gastosVariaveis,
        lucroLiquido,
        custoOcupacao,
        custoPessoal,
        totalStaffPayments
      };
    }
    return stats;
  }, [stats, simulatedEvolutionData, provisionalRevenues, evolutionData]);

  const lowRevenueMonths = useMemo(() => {
    return evolutionData
      .filter(d => {
        // Excluir agosto e setembro de 2025 da simulação conforme solicitação
        if (d.month === '08/2025' || d.month === '09/2025' || d.month === '8/2025' || d.month === '9/2025') {
          return false;
        }
        return d.receitaLiquida < 5000;
      })
      .sort((a, b) => {
        const partsA = String(a.month || '').split('/');
        const partsB = String(b.month || '').split('/');
        const mA = Number(partsA[0]) || 0;
        const yA = Number(partsA[1]) || 0;
        const mB = Number(partsB[0]) || 0;
        const yB = Number(partsB[1]) || 0;
        if (yA !== yB) return yA - yB;
        return mA - mB;
      });
  }, [evolutionData]);

  // Dados de Investimento Editáveis com Persistência
  const [initialInvestment, setInitialInvestment] = React.useState<number>(() => {
    try {
      const p = localStorage.getItem('initial_investment');
      return p ? parseFloat(p) : 72953.73;
    } catch {
      return 72953.73;
    }
  });

  const [additionalAporte, setAdditionalAporte] = React.useState<number>(() => {
    try {
      const p = localStorage.getItem('additional_aporte');
      return p ? parseFloat(p) : 4696.41; // Inicializado com R$ 4.696,41 conforme solicitado pelo usuário
    } catch {
      return 4696.41;
    }
  });

  const [actualAmortization, setActualAmortization] = React.useState<number>(() => {
    try {
      const p = localStorage.getItem('actual_amortization');
      return p ? parseFloat(p) : 0;
    } catch {
      return 0;
    }
  });

  const TOTAL_INVESTMENT = useMemo(() => initialInvestment + additionalAporte, [initialInvestment, additionalAporte]);

  // Cálculos de Investimento e Payback
  const investmentStats = useMemo(() => {
    // Calculamos o lucro acumulado apenas para referência de performance
    const cumulativeProfit = simulatedEvolutionData.reduce((sum, d) => sum + d.lucroLiquido, 0);
    
    // O resgate agora é baseado apenas na amortização real informada
    const recoveredPercent = Math.min(100, Math.max(0, (actualAmortization / (TOTAL_INVESTMENT || 1)) * 100));
    const pendingAmount = Math.max(0, TOTAL_INVESTMENT - actualAmortization);
    
    // Média de lucro mensal para projeção de CAPACIDADE de resgate
    const avgMonthlyProfit = cumulativeProfit / (simulatedEvolutionData.length || 1);

    return {
      initial: initialInvestment,
      additional: additionalAporte,
      total: TOTAL_INVESTMENT,
      cumulativeProfit,
      actualAmortization: actualAmortization,
      recoveredPercent,
      pendingAmount,
      avgMonthlyProfit
    };
  }, [simulatedEvolutionData, initialInvestment, additionalAporte, actualAmortization, TOTAL_INVESTMENT]);

  // Cálculos de Saúde Financeira
  const healthIndicators = useMemo(() => {
    // Para evitar distorções quando a receita for muito baixa ou nula (ex: meses em andamento),
    // calculamos primeiro a média histórica da margem de contribuição de meses com receita válida (>= 5000)
    const historicalIndexes = simulatedEvolutionData
      .filter(d => d.receitaLiquida >= 5000)
      .map(d => {
        const cmvP = d.cmv / d.receitaLiquida;
        const varP = d.gastosVariaveis / d.receitaLiquida;
        return Math.max(0.1, Math.min(0.9, 1 - (cmvP + varP)));
      });
    const avgHistoricalMarginIndex = historicalIndexes.length > 0
      ? historicalIndexes.reduce((sum, val) => sum + val, 0) / historicalIndexes.length
      : 0.55; // 55% de margem padrão caso não existam dados históricos

    const receita = simulatedStats.receitaLiquida;
    let cmvPeso = 0;
    let variaveisPeso = 0;
    let margemContribuicaoIndex = avgHistoricalMarginIndex;

    if (receita >= 5000) {
      cmvPeso = simulatedStats.cmv / receita;
      variaveisPeso = simulatedStats.gastosVariaveis / receita;
      margemContribuicaoIndex = Math.max(0.1, Math.min(0.9, 1 - (cmvPeso + variaveisPeso)));
    } else {
      // Para baixa receita, estimamos custos proporcionais baseados na média histórica para evitar divisão por 1
      cmvPeso = simulatedStats.receitaLiquida > 0 ? Math.min(0.9, simulatedStats.cmv / simulatedStats.receitaLiquida) : (1 - avgHistoricalMarginIndex) * 0.7;
      variaveisPeso = simulatedStats.receitaLiquida > 0 ? Math.min(0.9, simulatedStats.gastosVariaveis / simulatedStats.receitaLiquida) : (1 - avgHistoricalMarginIndex) * 0.3;
    }
    
    // Ponto de Equilíbrio = Custos Fixos / Margem de Contribuição
    const pontoEquilibrio = simulatedStats.gastosFixos / margemContribuicaoIndex;
    
    // Eficiência Operacional = (Fixos + Variáveis) / Receita
    const eficienciaOperacional = simulatedStats.receitaLiquida >= 5000
      ? (simulatedStats.gastosFixos + simulatedStats.gastosVariaveis) / simulatedStats.receitaLiquida
      : 0;
    
    const margemLiquida = simulatedStats.receitaLiquida >= 5000 ? simulatedStats.lucroLiquido / simulatedStats.receitaLiquida : 0;
    const custoOcupacaoPeso = simulatedStats.receitaLiquida >= 5000 ? simulatedStats.custoOcupacao / simulatedStats.receitaLiquida : 0;
    const custoPessoalPeso = simulatedStats.receitaLiquida >= 5000 ? simulatedStats.custoPessoal / simulatedStats.receitaLiquida : 0;

    return {
      margemContribuicao: margemContribuicaoIndex * 100,
      pontoEquilibrio,
      eficienciaOperacional: eficienciaOperacional * 100,
      margemLiquida: margemLiquida * 100,
      cmvPeso: cmvPeso * 100,
      custoOcupacaoPeso: custoOcupacaoPeso * 100,
      custoPessoalPeso: custoPessoalPeso * 100
    };
  }, [simulatedStats, simulatedEvolutionData]);

  const chartData = useMemo(() => {
    // Média de margem de contribuição histórica para meses futuros ou sem dados de faturamento
    const historicalIndexes = simulatedEvolutionData
      .filter(d => d.receitaLiquida >= 5000)
      .map(d => {
        const cmvP = d.cmv / d.receitaLiquida;
        const varP = d.gastosVariaveis / d.receitaLiquida;
        return Math.max(0.1, Math.min(0.9, 1 - (cmvP + varP)));
      });
    const avgHistoricalMarginIndex = historicalIndexes.length > 0
      ? historicalIndexes.reduce((sum, val) => sum + val, 0) / historicalIndexes.length
      : 0.55;

    return simulatedEvolutionData.map(d => {
      const isLowRevenue = d.receitaLiquida < 5000;
      
      const cmvPeso = isLowRevenue
        ? (d.cmv > 0 && d.receitaLiquida > 0 ? (d.cmv / d.receitaLiquida) * 100 : (1 - avgHistoricalMarginIndex) * 70)
        : (d.cmv / d.receitaLiquida) * 100;
        
      const variaveisPeso = isLowRevenue
        ? (d.gastosVariaveis > 0 && d.receitaLiquida > 0 ? (d.gastosVariaveis / d.receitaLiquida) : 0)
        : (d.gastosVariaveis / d.receitaLiquida);

      let margemContribuicaoIndex = avgHistoricalMarginIndex;
      if (!isLowRevenue) {
        margemContribuicaoIndex = Math.max(0.1, Math.min(0.9, 1 - ((d.cmv / d.receitaLiquida) + variaveisPeso)));
      }

      const pontoEquilibrio = d.gastosFixos / margemContribuicaoIndex;
      const eficienciaOperacional = d.receitaLiquida >= 5000
        ? ((d.gastosFixos + d.gastosVariaveis) / d.receitaLiquida) * 100
        : 0;
      const margemLiquida = d.receitaLiquida >= 5000 ? (d.lucroLiquido / d.receitaLiquida) * 100 : 0;

      return {
        month: d.month,
        "Lucro Líquido": d.lucroLiquido,
        "Ponto de Equilíbrio": pontoEquilibrio,
        "Eficiência Operacional": eficienciaOperacional,
        "Margem Líquida": margemLiquida,
        "Peso do CMV": Math.min(100, cmvPeso),
        "Margem de Contribuição": margemContribuicaoIndex * 100,
        "Custo Ocupação": d.receitaLiquida >= 5000 ? (d.custoOcupacao / d.receitaLiquida) * 100 : 0,
        "Custo Pessoal": d.receitaLiquida >= 5000 ? (d.custoPessoal / d.receitaLiquida) * 100 : 0,
        // Dados brutos para o tooltip
        receitaLiquida: d.receitaLiquida,
        lucroLiquido_abs: d.lucroLiquido,
        pontoEquilibrio_abs: pontoEquilibrio,
        custosOperacionais_abs: d.gastosFixos + d.gastosVariaveis,
        cmv_abs: d.cmv,
        margemContribuicao_abs: d.receitaLiquida >= 5000 ? (d.receitaLiquida - d.cmv - d.gastosVariaveis) : 0,
        custoOcupacao_abs: d.custoOcupacao,
        custoPessoal_abs: d.custoPessoal
      };
    });
  }, [simulatedEvolutionData]);

  const metrics = [
    { label: "Lucro Líquido", color: "#10b981", unit: "currency" },
    { label: "Ponto de Equilíbrio", color: "#6366f1", unit: "currency" },
    { label: "Eficiência Operacional", color: "#f59e0b", unit: "percent" },
    { label: "Margem Líquida", color: "#0ea5e9", unit: "percent" },
    { label: "Peso do CMV", color: "#8b5cf6", unit: "percent" },
    { label: "Margem de Contribuição", color: "#ec4899", unit: "percent" },
    { label: "Custo Ocupação", color: "#64748b", unit: "percent" },
    { label: "Custo Pessoal", color: "#f43f5e", unit: "percent" }
  ];

  const activeMetric = metrics.find(m => m.label === selectedMetric) || metrics[0];

  const getHealthStatus = (value: number, type: 'margem' | 'eficiencia' | 'cmv') => {
    if (type === 'margem') {
      if (value > 15) return { label: 'Saudável', color: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50' };
      if (value > 5) return { label: 'Alerta', color: 'text-amber-600', icon: AlertTriangle, bg: 'bg-amber-50' };
      return { label: 'Crítico', color: 'text-rose-600', icon: XCircle, bg: 'bg-rose-50' };
    }
    if (type === 'eficiencia') {
      if (value < 30) return { label: 'Excelente', color: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50' };
      if (value < 45) return { label: 'Moderada', color: 'text-amber-600', icon: AlertTriangle, bg: 'bg-amber-50' };
      return { label: 'Ineficiente', color: 'text-rose-600', icon: XCircle, bg: 'bg-rose-50' };
    }
    if (type === 'cmv') {
      if (value < 35) return { label: 'Ótimo', color: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50' };
      if (value < 42) return { label: 'Alto', color: 'text-amber-600', icon: AlertTriangle, bg: 'bg-amber-50' };
      return { label: 'Crítico', color: 'text-rose-600', icon: XCircle, bg: 'bg-rose-50' };
    }
    return null;
  };

  const toggleInfo = (id: string) => {
    setActiveInfo(activeInfo === id ? null : id);
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="mb-8">
        <h3 className="text-2xl font-bold text-slate-900">Indicadores de Sucesso</h3>
        <p className="text-slate-500">Métricas avançadas para análise de performance e saúde do negócio.</p>
      </header>

      {/* Bloco de Ajuste Provisório de Meses em Aberto */}
      {lowRevenueMonths.length > 0 && (
        <motion.div 
          layout
          className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border border-indigo-100/60 rounded-3xl overflow-hidden transition-shadow duration-300 hover:shadow-sm"
        >
          {/* Header Toggle */}
          <div 
            onClick={() => setIsSimulationOpen(!isSimulationOpen)}
            className="flex items-center justify-between p-5 cursor-pointer select-none"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">💡</span>
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  Simulação de Faturamento (Meses em Aberto)
                  {Object.keys(provisionalRevenues).length > 0 && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black uppercase tracking-wider animate-pulse">
                      Ativo
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {Object.keys(provisionalRevenues).length > 0 
                    ? `Simulando faturamento para: ${Object.keys(provisionalRevenues).map(m => `${m} (${formatCurrency(provisionalRevenues[m])})`).join(', ')}`
                    : "Simule o faturamento real em andamento para calcular o ponto de equilíbrio e saúde financeira."
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {Object.keys(provisionalRevenues).length > 0 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); // Evitar abrir/fechar o card
                    setProvisionalRevenues({});
                    try { localStorage.removeItem('provisional_revenues'); } catch {}
                  }}
                  className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase bg-white border border-indigo-200 px-2.5 py-1.5 rounded-xl shadow-sm cursor-pointer"
                >
                  Limpar
                </button>
              )}
              <div className="p-1.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-slate-600 shadow-sm transition-transform duration-200 flex items-center justify-center">
                {isSimulationOpen ? <ChevronUp className="w-4 h-4 animate-bounce" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isSimulationOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="border-t border-indigo-100/50"
              >
                <div className="p-6 pt-4 bg-white/40">
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed max-w-3xl">
                    Os meses que ainda não foram fechados oficialmente via planilha aparecem com receita zerada nos relatórios. 
                    Insira o faturamento aproximado/parcial abaixo para atualizar instantaneamente o ponto de equilíbrio, 
                    a margem líquida e as análises do painel de indicadores.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {lowRevenueMonths.map(d => {
                      const currentVal = provisionalRevenues[d.month] || 0;
                      return (
                        <div key={d.month} className="bg-white p-4 rounded-2xl border border-indigo-100/50 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-slate-400 block uppercase tracking-wider">{d.month}</span>
                            {provisionalRevenues[d.month] !== undefined ? (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">Simulado</span>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">Em Aberto</span>
                            )}
                          </div>
                          
                          <div className="relative mt-2">
                            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                            <input
                              type="number"
                              placeholder="Ex: 51400"
                              value={currentVal || ''}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                if (val <= 0) {
                                  removeProvisionalRevenue(d.month);
                                } else {
                                  updateProvisionalRevenue(d.month, val);
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            />
                          </div>
                          
                          <p className="text-[9px] text-slate-400 mt-2 italic leading-none shrink-0 font-sans">
                            Despesas registradas: <span className="font-bold text-slate-600">{formatCurrency(d.cmv + d.gastosFixos + d.gastosVariaveis)}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Grid Principal de Saúde */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Ponto de Equilíbrio */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Target className="w-24 h-24 text-slate-900" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <Target className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ponto de Equilíbrio</span>
              </div>
              <button 
                onClick={() => toggleInfo('pe')}
                className={cn(
                  "p-1.5 rounded-lg transition-colors border",
                  activeInfo === 'pe' ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-400 border-slate-100 hover:text-slate-600"
                )}
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
            
            <h4 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(healthIndicators.pontoEquilibrio)}</h4>
            <p className="text-sm text-slate-500 leading-relaxed mb-4 mt-2">
              Faturamento mínimo necessário para cobrir 100% dos custos fixos e variáveis.
            </p>
 
            {/* Nova métrica solicitada: Lucro Marginal */}
            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 mb-6 group-hover:bg-indigo-50 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Potencial de Lucro</span>
              </div>
              <p className="text-sm font-bold text-slate-900">
                +{formatCurrency(1000 * (healthIndicators.margemContribuicao / 100))} <span className="text-[10px] text-slate-500 font-normal">de lucro real</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Para cada <span className="font-bold">R$ 1.000,00</span> vendidos <span className="text-indigo-600 font-bold tracking-tight">acima</span> do Ponto de Equilíbrio.
              </p>
            </div>
 
            <AnimatePresence>
              {activeInfo === 'pe' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-slate-100 mb-6 pt-4"
                >
                  <p className="text-[11px] font-bold text-indigo-600 uppercase mb-2">Como melhorar:</p>
                  <ul className="space-y-2">
                    <li className="text-xs text-slate-600 flex gap-2">
                      <TrendingDown className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Reduza custos fixos como aluguéis e licenças.</span>
                    </li>
                    <li className="text-xs text-slate-600 flex gap-2">
                      <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Aumente o preço de venda para elevar a margem de contribuição.</span>
                    </li>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
 
            <div className="pt-6 border-t border-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">STATUS:</span>
                {simulatedStats.receitaLiquida > healthIndicators.pontoEquilibrio 
                  ? <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> ZONA DE LUCRO
                    </span>
                  : <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> ZONA DE RISCO
                    </span>
                }
              </div>
            </div>
          </div>
        </motion.div>
 
        {/* Eficiência Operacional */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Zap className="w-24 h-24 text-slate-900" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Eficiência Operacional</span>
              </div>
              <button 
                onClick={() => toggleInfo('eo')}
                className={cn(
                  "p-1.5 rounded-lg transition-colors border",
                  activeInfo === 'eo' ? "bg-amber-500 text-white border-amber-500" : "bg-slate-50 text-slate-400 border-slate-100 hover:text-slate-600"
                )}
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
 
            <h4 className="text-2xl font-bold text-slate-900 mt-1">{healthIndicators.eficienciaOperacional.toFixed(1)}%</h4>
            <div className="w-full bg-slate-100 h-2 rounded-full mb-4 mt-6 overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  healthIndicators.eficienciaOperacional < 30 ? "bg-emerald-500" : healthIndicators.eficienciaOperacional < 45 ? "bg-amber-500" : "bg-rose-500"
                )}
                style={{ width: `${Math.min(100, healthIndicators.eficienciaOperacional)}%` }}
              />
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Peso da estrutura na receita. Quanto menor, mais eficiente.
            </p>
 
            <AnimatePresence>
              {activeInfo === 'eo' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-slate-100 mb-6 pt-4"
                >
                  <p className="text-[11px] font-bold text-amber-600 uppercase mb-2">Como melhorar:</p>
                  <ul className="space-y-2">
                    <li className="text-xs text-slate-600 flex gap-2">
                      <BarChart3 className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                      <span>Automatize processos para reduzir gastos com pessoal.</span>
                    </li>
                    <li className="text-xs text-slate-600 flex gap-2">
                      <TrendingDown className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Negocie tarifas bancárias e taxas de cartão.</span>
                    </li>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
 
        {/* Margem Líquida */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <ShieldCheck className="w-24 h-24 text-slate-900" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Margem Líquida</span>
              </div>
              <button 
                onClick={() => toggleInfo('ml')}
                className={cn(
                  "p-1.5 rounded-lg transition-colors border",
                  activeInfo === 'ml' ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 text-slate-400 border-slate-100 hover:text-slate-600"
                )}
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
 
            <h4 className="text-2xl font-bold text-slate-900 mt-1">{healthIndicators.margemLiquida.toFixed(1)}%</h4>
            <div className="h-2 w-full bg-slate-50 rounded-full mt-6 mb-4 overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  healthIndicators.margemLiquida > 15 ? "bg-emerald-500" : healthIndicators.margemLiquida > 5 ? "bg-amber-500" : "bg-rose-500"
                )}
                style={{ width: `${Math.max(0, Math.min(100, healthIndicators.margemLiquida))}%` }}
              />
            </div>
            
            <AnimatePresence>
              {activeInfo === 'ml' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-slate-100 mb-6 pt-4"
                >
                  <p className="text-[11px] font-bold text-emerald-600 uppercase mb-2">Como melhorar:</p>
                  <ul className="space-y-2">
                    <li className="text-xs text-slate-600 flex gap-2">
                      <Target className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                      <span>Priorize o mix de produtos com maior rentabilidade.</span>
                    </li>
                    <li className="text-xs text-slate-600 flex gap-2">
                      <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Controle rigorosamente os custos de operação (SLA).</span>
                    </li>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
 
            <div className="flex flex-col gap-3 mt-4">
              <div className={cn(
                "p-3 rounded-xl border flex items-center justify-between",
                getHealthStatus(healthIndicators.margemLiquida, 'margem')?.bg,
                "border-transparent"
              )}>
                <span className={cn("text-xs font-bold", getHealthStatus(healthIndicators.margemLiquida, 'margem')?.color)}>
                  STATUS: {getHealthStatus(healthIndicators.margemLiquida, 'margem')?.label.toUpperCase()}
                </span>
                {(() => {
                  const status = getHealthStatus(healthIndicators.margemLiquida, 'margem');
                  const Icon = status?.icon || Info;
                  return <Icon className={cn("w-4 h-4", status?.color)} />;
                })()}
              </div>
              <p className="text-xs text-slate-400 italic">Meta recomendada: 15%</p>
            </div>
          </div>
        </motion.div>
      </div>
 
      {/* Cards de Análise Profunda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gestão de Capital e Payback */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <History className="w-32 h-32 text-slate-900" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-xl text-white">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900">Payback do Investimento</h4>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-0.5">Retorno de Capital Aportado</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-400 block uppercase">Aporte Total</span>
                <span className="text-lg font-bold text-slate-900">{formatCurrency(investmentStats.total)}</span>
                {investmentStats.additional > 0 && (
                  <span className="text-[9px] text-indigo-600 block font-bold mt-0.5">
                    ({formatCurrency(investmentStats.initial)} + {formatCurrency(investmentStats.additional)})
                  </span>
                )}
              </div>
            </div>
 
            <div className="space-y-8">
              {/* Barra de Progresso do Resgate */}
              <div>
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <span className="text-2xl font-bold text-slate-900">{investmentStats.recoveredPercent.toFixed(1)}%</span>
                    <span className="text-xs text-slate-500 ml-2 font-medium">Recuperado</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Saldo Pendente</span>
                    <span className="text-sm font-bold text-rose-600">{formatCurrency(investmentStats.pendingAmount)}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden p-1">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${investmentStats.recoveredPercent}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full shadow-sm",
                      investmentStats.recoveredPercent > 70 ? "bg-emerald-500" : investmentStats.recoveredPercent > 30 ? "bg-indigo-500" : "bg-slate-900"
                    )}
                  />
                </div>
              </div>
 
              {/* Grid de Métricas de Payback */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <History className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amortizado</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900">
                    {formatCurrency(investmentStats.actualAmortization)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Valor efetivamente retirado.</p>
                </div>
 
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUpIcon className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capacidade / Mês</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900">
                    {formatCurrency(investmentStats.avgMonthlyProfit)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Lucro disponível para resgate.</p>
                </div>
              </div>

              {/* Botão de ajuste */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingPayback(!isEditingPayback)}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 cursor-pointer"
                >
                  {isEditingPayback ? "Ocultar Ajustes" : "Ajustar Valores"}
                </button>
              </div>

              {/* Painel de ajuste expansível */}
              <AnimatePresence>
                {isEditingPayback && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4 overflow-hidden"
                  >
                    <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Configurar Valores de Payback</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                          Aporte Inicial (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={initialInvestment}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setInitialInvestment(val);
                            localStorage.setItem('initial_investment', String(val));
                          }}
                          className="w-full bg-white border border-slate-255 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-indigo-600 uppercase tracking-widest block mb-1">
                          Aporte Adicional (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={additionalAporte}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setAdditionalAporte(val);
                            localStorage.setItem('additional_aporte', String(val));
                          }}
                          className="w-full bg-indigo-50/50 border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                          Amortizado (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={actualAmortization}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setActualAmortization(val);
                            localStorage.setItem('actual_amortization', String(val));
                          }}
                          className="w-full bg-white border border-slate-255 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
 
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 border-dashed">
                <p className="text-[11px] text-indigo-700 leading-relaxed italic">
                  * O saldo pendente de <strong>{formatCurrency(investmentStats.pendingAmount)}</strong> será reduzido apenas mediante retiradas explícitas informadas por você. O lucro mensal é mostrado como <strong>Capacidade</strong> de pagamento.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
 
        <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl -mr-32 -mt-32 rounded-full" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                <ActivityIcon className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold">Distribuição de Custo</h4>
            </div>
            
            <div className="space-y-8 mt-8">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400 font-medium">CMV (Produtos)</span>
                  <span className="font-bold">{healthIndicators.cmvPeso.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]")} 
                    style={{ width: `${healthIndicators.cmvPeso}%` }} 
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase">Status: {getHealthStatus(healthIndicators.cmvPeso, 'cmv')?.label}</p>
              </div>
 
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400 font-medium">Gastos Variáveis</span>
                  <span className="font-bold">{(simulatedStats.gastosVariaveis / (simulatedStats.receitaLiquida || 1) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.3)]")} 
                    style={{ width: `${(simulatedStats.gastosVariaveis / (simulatedStats.receitaLiquida || 1) * 100)}%` }} 
                  />
                </div>
              </div>
 
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400 font-medium">Custos Fixos (Estrutura)</span>
                  <span className="font-bold">{(simulatedStats.gastosFixos / (simulatedStats.receitaLiquida || 1) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.3)]")} 
                    style={{ width: `${(simulatedStats.gastosFixos / (simulatedStats.receitaLiquida || 1) * 100)}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
 
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm mt-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
            <TrendingUpIcon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900">Checklist de Sucesso Comercial</h4>
            <p className="text-sm text-slate-500">Monitoramento estratégico de performance e eficiência.</p>
          </div>
        </div>
 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <SuccessItem 
              label="Equilíbrio CMV" 
              status={healthIndicators.cmvPeso < 38 ? 'success' : 'warning'} 
              value={`${healthIndicators.cmvPeso.toFixed(1)}%`}
              subValue={formatCurrency(simulatedStats.cmv)}
              desc="Meta: Manter custos de produtos abaixo de 38% da receita."
              ideal="Abaixo de 38,0% (Excelente se estiver entre 30,0% e 35,0% do Faturamento)"
              actions={[
                "Negocie melhores condições com fornecedores fixos.",
                "Revise o mix de produtos para focar nos de menor custo.",
                "Analise e reduza desperdícios ou perdas de estoque."
              ]}
            />
            <SuccessItem 
              label="Custo de Ocupação" 
              status={healthIndicators.custoOcupacaoPeso < 10 ? 'success' : healthIndicators.custoOcupacaoPeso < 15 ? 'warning' : 'danger'} 
              value={`${healthIndicators.custoOcupacaoPeso.toFixed(1)}%`}
              subValue={formatCurrency(simulatedStats.custoOcupacao)}
              desc="Aluguel, condomínio, IPTU e manutenção do espaço."
              ideal="Abaixo de 10,0% do Faturamento Líquido (Máximo aceitável de 15,0%)"
              actions={[
                "Tente renegociar o valor do aluguel se estiver acima de 10%.",
                "Considere models de sublocação de espaços ociosos.",
                "Otimize o consumo de energia e água nas áreas comuns."
              ]}
            />
          </div>
 
          <div className="space-y-4">
            <SuccessItem 
              label="Margem de Contribuição" 
              status={healthIndicators.margemContribuicao > 55 ? 'success' : healthIndicators.margemContribuicao > 45 ? 'warning' : 'danger'} 
              value={`${healthIndicators.margemContribuicao.toFixed(1)}%`}
              subValue={formatCurrency(simulatedStats.receitaLiquida - simulatedStats.cmv - simulatedStats.gastosVariaveis)}
              desc="O que sobra para pagar os custos fixos e gerar lucro."
              ideal="Acima de 55,0% (Aceitável a partir de 45,0% do Faturamento)"
              actions={[
                "Reduza taxas de antecipação e de marketplaces.",
                "Otimize custos de embalagem e frete.",
                "Aumente o ticket médio através de upsell/cross-sell."
              ]}
            />
            <SuccessItem 
              label="Custo com Pessoal" 
              status={healthIndicators.custoPessoalPeso < 20 ? 'success' : healthIndicators.custoPessoalPeso < 25 ? 'warning' : 'danger'} 
              value={`${healthIndicators.custoPessoalPeso.toFixed(1)}%`}
              subValue={formatCurrency(simulatedStats.custoPessoal)}
              desc="Salários, encargos, benefícios e bônus da equipe."
              ideal="Abaixo de 20,0% do Faturamento Líquido (Máximo aceitável de 25,0%)"
              actions={[
                "Melhore a produtividade por colaborador.",
                "Revise a escala de horários para evitar ociosidade.",
                "Invista em treinamento para reduzir turnover e custos extras."
              ]}
            />
          </div>
 
          <div className="space-y-4">
            <SuccessItem 
              label="Resultado do Período" 
              status={simulatedStats.lucroLiquido > 0 ? 'success' : 'danger'} 
              value={formatCurrency(simulatedStats.lucroLiquido)}
              subValue={`${healthIndicators.margemLiquida.toFixed(1)}% da receita`}
              desc="Lucratividade real do negócio após todas as deduções."
              ideal="Faturamento com lucro real acima de 15,0% de Margem Líquida (Excelente se for > 20,0%)"
              actions={[
                "Controle rigorosamente os saques e retiradas.",
                "Foque em canais de venda com maior lucratividade.",
                "Revise mensalmente todas as despesas fixas 'invisíveis'."
              ]}
            />
            <SuccessItem 
              label="Segurança Operacional" 
              status={simulatedStats.receitaLiquida > healthIndicators.pontoEquilibrio * 1.2 ? 'success' : simulatedStats.receitaLiquida > healthIndicators.pontoEquilibrio ? 'warning' : 'danger'} 
              value={simulatedStats.receitaLiquida > healthIndicators.pontoEquilibrio ? 'Protegido' : 'Exposto'}
              subValue={simulatedStats.receitaLiquida > healthIndicators.pontoEquilibrio ? 
                `Acima do PE: ${formatCurrency(simulatedStats.receitaLiquida - healthIndicators.pontoEquilibrio)} (+${(((simulatedStats.receitaLiquida - healthIndicators.pontoEquilibrio) / healthIndicators.pontoEquilibrio) * 100).toFixed(1)}%)` : 
                `Abaixo do PE: -${formatCurrency(healthIndicators.pontoEquilibrio - simulatedStats.receitaLiquida)} (-${(((healthIndicators.pontoEquilibrio - simulatedStats.receitaLiquida) / healthIndicators.pontoEquilibrio) * 100).toFixed(1)}%)`
              }
              desc="Capacidade de faturar acima do ponto de equilíbrio."
              ideal="Pelo menos 20,0% acima do Ponto de Equilíbrio financeiro calculável"
              actions={[
                "Aumente o volume de vendas via tráfego pago ou orgânico.",
                "Crie campanhas para aumentar a recorrência de clientes.",
                "Reduza o Ponto de Equilíbrio cortando custos fixos excedentes."
              ]}
            />
          </div>
        </div>
      </div>

      {/* Gráfico de Evolução de Indicadores */}
      <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm mt-8">
        {/* ... existing chart code ... */}
      </section>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm mt-8"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-xl text-white">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900">Evolução de Indicadores</h4>
              <p className="text-sm text-slate-500">Histórico de performance por período selecionado.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {metrics.map((m) => (
              <button
                key={m.label}
                onClick={() => setSelectedMetric(m.label)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                  selectedMetric === m.label
                    ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200"
                    : "bg-white text-slate-500 border-slate-100 hover:border-slate-200 hover:text-slate-900"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={activeMetric.color} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={activeMetric.color} stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                tickFormatter={(val) => 
                  activeMetric.unit === 'currency' 
                    ? `R$ ${val >= 1000 ? (val/1000).toFixed(0) + 'k' : (val/1000).toFixed(1) + 'k'}` 
                    : `${val}%`
                }
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const value = payload[0].value as number;
                    const receita = data.receitaLiquida || 1;
                    
                    const isDual = ["Custo Ocupação", "Custo Pessoal", "Lucro Líquido"].includes(selectedMetric);

                    if (isDual) {
                      let absValue = 0;
                      let pctValue = 0;
                      
                      if (activeMetric.unit === 'currency') {
                        absValue = value;
                        pctValue = (value / receita) * 100;
                      } else {
                        pctValue = value;
                        if (selectedMetric === "Custo Ocupação") absValue = data.custoOcupacao_abs;
                        else if (selectedMetric === "Custo Pessoal") absValue = data.custoPessoal_abs;
                      }

                      return (
                        <div className="bg-slate-900 p-4 rounded-2xl shadow-2xl border border-white/10 text-white min-w-[200px]">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">{label}</p>
                          
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Valor Nominal</p>
                              <p className="text-lg font-black" style={{ color: activeMetric.color }}>
                                {formatCurrency(absValue)}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-black mb-1">
                                {selectedMetric === "Lucro Líquido" ? "Percentual sobre a Receita" : "Peso na Receita"}
                              </p>
                              <p className="text-lg font-black" style={{ color: activeMetric.color }}>
                                {pctValue.toFixed(1)}%
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/5">
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                              📊 Métrica: {selectedMetric}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="bg-slate-900 p-4 rounded-2xl shadow-2xl border border-white/10 text-white">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                        <p className="text-lg font-black" style={{ color: activeMetric.color }}>
                          {activeMetric.unit === 'currency' ? formatCurrency(value) : `${value.toFixed(1)}%`}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-tight max-w-[150px]">
                          {selectedMetric} no período selecionado.
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey={selectedMetric} 
                stroke={activeMetric.color} 
                strokeWidth={4}
                fillOpacity={1} 
                fill="url(#colorMetric)"
                animationDuration={1500}
                dot={{ fill: activeMetric.color, strokeWidth: 2, r: 4, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
};

const SuccessItem = ({ label, status, value, subValue, desc, actions, ideal }: any) => {
  const [showInfo, setShowInfo] = React.useState(false);

  return (
    <div className="relative group">
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-md hover:border-slate-200">
        <div className={cn(
          "p-1.5 rounded-full mt-1 shrink-0",
          status === 'success' ? "bg-emerald-100 text-emerald-600" : 
          status === 'warning' ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
        )}>
          {status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : 
           status === 'warning' ? <AlertTriangle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-bold text-slate-900 truncate">{label}</span>
              <button 
                onClick={() => setShowInfo(!showInfo)}
                className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                title="Dicas de melhoria"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className={cn(
                "text-sm font-bold transition-colors",
                status === 'success' ? "text-emerald-600" : 
                status === 'warning' ? "text-amber-600" : "text-rose-600"
              )}>{value}</span>
              {subValue && (
                <span className="text-[10px] text-slate-400 font-bold tracking-tight">
                  {subValue}
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2 md:line-clamp-none">{desc}</p>
          
          <AnimatePresence>
            {showInfo && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                  {ideal && (
                    <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-left">
                      <p className="text-[9px] font-black text-indigo-700 uppercase tracking-wider">Valor Ideal Saudável</p>
                      <p className="text-xs font-bold text-indigo-900 mt-0.5">{ideal}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ações Recomendadas:</p>
                    <ul className="space-y-1">
                      {actions.map((action: string, i: number) => (
                        <li key={i} className="text-[10px] text-slate-600 flex items-start gap-1.5">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
