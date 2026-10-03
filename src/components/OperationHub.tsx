import React, { useState } from 'react';
import { 
  Trash2, 
  Coffee, 
  ShoppingCart, 
  ChevronRight,
  Package,
  ArrowLeft,
  Briefcase,
  ChefHat,
  Percent,
  Thermometer,
  QrCode,
  PackageCheck,
  Settings,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WasteRegistration } from './WasteRegistration';
import { PurchaseRequests } from './PurchaseRequests';
import { RecipeManager } from './RecipeManager';
import { StaffDiscountManager } from './StaffDiscountManager';

import { TemperatureControl } from './TemperatureControl';
import { StockCountQrModal } from './StockCountQrModal';
import { StockCounting } from './StockCounting';
import { WasteRecord, StaffConsumption, StaffPayment, PurchaseRequest, Sale, StockItem, Recipe, Purchase, StaffDiscountOverride } from '../types';
import { cn } from '../lib/utils';

interface OperationHubProps {
  userId: string;
  userRole: string;
  wasteRecords: WasteRecord[];
  staffConsumptions: StaffConsumption[];
  staffPayments: StaffPayment[];
  purchaseRequests: PurchaseRequest[];
  onBack: () => void;
  salesData?: Sale[];
  stockData?: StockItem[];
  recipes?: Recipe[];
  purchases?: Purchase[];
  staffDiscountOverrides?: StaffDiscountOverride[];
  selectedMonths?: string[];
}

type OperationView = 'menu' | 'waste' | 'consumption' | 'payments' | 'purchase' | 'recipes' | 'discounts' | 'temperature' | 'stock_count' | 'system_hub';

export const OperationHub: React.FC<OperationHubProps> = ({
  userId,
  userRole,
  wasteRecords,
  staffConsumptions,
  staffPayments,
  purchaseRequests,
  onBack,
  salesData = [],
  stockData = [],
  recipes = [],
  purchases = [],
  staffDiscountOverrides = [],
  selectedMonths = []
}) => {
  const [currentView, setCurrentView] = useState<OperationView>('menu');
  const [showShareModal, setShowShareModal] = useState(false);

  const menuItems = [
    ...(userRole === 'admin' ? [{
      id: 'system_hub',
      title: 'Gestão das Informações do Sistema',
      description: 'Catálogo de contagem, gestão de funcionários, baixa de pagamentos, fichas técnicas e ajuste de descontos/produtos.',
      icon: Settings,
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      iconBg: 'bg-purple-100'
    }] : []),
    {
      id: 'waste',
      title: 'Desperdício e Reuso',
      description: 'Registro de desperdícios, perdas e itens para reuso.',
      icon: Trash2,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
      iconBg: 'bg-rose-100'
    },
    {
      id: 'consumption',
      title: 'Consumo Funcionário',
      description: 'Registro de consumo e consulta de saldo pendente.',
      icon: Coffee,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      iconBg: 'bg-blue-100'
    },
    {
      id: 'purchase',
      title: 'Solicitação de Compra',
      description: 'Quadro de necessidades de compra e confirmação de chegada.',
      icon: ShoppingCart,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      iconBg: 'bg-amber-100'
    },
    {
      id: 'temperature',
      title: 'Controle Temperatura',
      description: 'Registro diário de temperaturas dos equipamentos.',
      icon: Thermometer,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      iconBg: 'bg-indigo-100'
    }
  ];

  const systemHubItems = [
    {
      id: 'stock_count',
      title: 'Catálogo de Contagem de Estoque',
      description: 'Gestão, inclusão, exclusão, locais e estoques mínimos de produtos.',
      icon: PackageCheck,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      iconBg: 'bg-emerald-100'
    },

    {
      id: 'payments',
      title: 'Baixa de Pagamentos',
      description: 'Registro de pagamentos recebidos dos funcionários.',
      icon: Briefcase,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      iconBg: 'bg-indigo-100'
    },
    {
      id: 'recipes',
      title: 'Fichas Técnicas',
      description: 'Defina a composição de cada produto para baixar estoque.',
      icon: ChefHat,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      iconBg: 'bg-emerald-100'
    },
    {
      id: 'discounts',
      title: 'Ajuste de Descontos e Produtos',
      description: 'Inclua, altere e remova produtos de consumo da equipe e defina descontos.',
      icon: Percent,
      color: 'bg-sky-50 text-sky-600 border-sky-100',
      iconBg: 'bg-sky-100'
    }
  ];

  if (currentView === 'menu') {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Gestão do Quiosque</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Clique no card para registrar</p>
          <div className="mt-4 flex items-center justify-center">
            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl shadow-xs text-xs font-black uppercase tracking-wider transition-all"
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>QR Code - Contagem de Estoque (Celular Offline)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView(item.id as OperationView)}
              className={cn(
                "flex flex-col items-start p-8 rounded-[2.5rem] border-2 text-left transition-all shadow-sm h-full",
                item.color
              )}
            >
              <div className={cn("p-4 rounded-2xl mb-6", item.iconBg)}>
                <item.icon className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">{item.title}</h3>
              <p className="text-slate-500 text-xs font-bold leading-relaxed uppercase opacity-80">
                {item.description}
              </p>
              <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                Acessar Módulo
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.button>
          ))}
        </div>

        <div className="mt-12 text-center p-8 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
            * Todos os registros são sincronizados em tempo real<br />
            com o painel administrativo.
          </p>
        </div>

        <StockCountQrModal 
          isOpen={showShareModal} 
          onClose={() => setShowShareModal(false)}
          onOpenDirectly={() => {
            setShowShareModal(false);
            setCurrentView('stock_count');
          }}
        />
      </div>
    );
  }

  if (currentView === 'system_hub') {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={() => setCurrentView('menu')}
            className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 rounded-xl transition-all font-black text-slate-400 text-[10px] uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Menu
          </button>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestão das Informações do Sistema</span>
          </div>
        </div>

        <div className="mb-8 text-center">
          <div className="inline-flex p-4 bg-purple-100 text-purple-700 rounded-3xl mb-3">
            <Settings className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Gestão das Informações do Sistema</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Configurações avançadas e cadastros centrais da franquia</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {systemHubItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView(item.id as OperationView)}
              className={cn(
                "flex flex-col items-start p-7 rounded-[2rem] border-2 text-left transition-all shadow-sm h-full",
                item.color
              )}
            >
              <div className={cn("p-3.5 rounded-2xl mb-4", item.iconBg)}>
                <item.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight mb-1.5">{item.title}</h3>
              <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                {item.description}
              </p>
              <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                Gerenciar
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={() => setCurrentView(userRole === 'admin' ? 'system_hub' : 'menu')}
          className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 rounded-xl transition-all font-black text-slate-400 text-[10px] uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          {userRole === 'admin' ? 'Voltar à Gestão do Sistema' : 'Voltar ao Menu'}
        </button>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conectado ao Cloud Hub</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={currentView}
           initial={{ opacity: 0, scale: 0.98 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.98 }}
           transition={{ duration: 0.2 }}
        >
          {currentView === 'waste' && (
            <WasteRegistration 
              userId={userId} 
              onBack={() => setCurrentView('menu')} 
              wasteRecords={wasteRecords}
              staffConsumptions={staffConsumptions}
              staffPayments={staffPayments}
              userRole={userRole}
              initialMode="waste"
              salesData={salesData}
              stockData={stockData}
              recipes={recipes}
              purchasesData={purchases}
              staffDiscountOverrides={staffDiscountOverrides}
              selectedMonths={selectedMonths}
            />
          )}

          {currentView === 'consumption' && (
            <WasteRegistration 
              userId={userId} 
              onBack={() => setCurrentView('menu')} 
              wasteRecords={wasteRecords}
              staffConsumptions={staffConsumptions}
              staffPayments={staffPayments}
              userRole={userRole}
              initialMode="consumption"
              salesData={salesData}
              stockData={stockData}
              recipes={recipes}
              purchasesData={purchases}
              staffDiscountOverrides={staffDiscountOverrides}
              selectedMonths={selectedMonths}
            />
          )}

          {currentView === 'payments' && (
            <WasteRegistration 
              userId={userId} 
              onBack={() => setCurrentView(userRole === 'admin' ? 'system_hub' : 'menu')} 
              wasteRecords={wasteRecords}
              staffConsumptions={staffConsumptions}
              staffPayments={staffPayments}
              userRole={userRole}
              initialMode="payments"
              salesData={salesData}
              stockData={stockData}
              recipes={recipes}
              purchasesData={purchases}
              staffDiscountOverrides={staffDiscountOverrides}
              selectedMonths={selectedMonths}
            />
          )}

          {currentView === 'purchase' && (
            <PurchaseRequests 
              userId={userId}
              requests={purchaseRequests}
              userRole={userRole}
              purchasesData={purchases}
              stockData={stockData}
            />
          )}

          {currentView === 'recipes' && userRole === 'admin' && (
            <RecipeManager 
              userId={userId} 
              onBack={() => setCurrentView('system_hub')} 
            />
          )}

          {currentView === 'discounts' && userRole === 'admin' && (
            <StaffDiscountManager 
              dataPath={userId}
              overrides={staffDiscountOverrides}
              onBack={() => setCurrentView('system_hub')}
            />
          )}



          {currentView === 'temperature' && (
            <TemperatureControl 
              userId={userId}
              userRole={userRole}
              onBack={() => setCurrentView('menu')}
            />
          )}

          {currentView === 'stock_count' && (
            <StockCounting 
              stockData={stockData}
              userId={userId}
              userRole={userRole}
              onBack={() => setCurrentView(userRole === 'admin' ? 'system_hub' : 'menu')}
              onNavigateToPurchases={() => setCurrentView('purchase')}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <StockCountQrModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)}
        onOpenDirectly={() => {
          setShowShareModal(false);
          setCurrentView('stock_count');
        }}
      />
    </div>
  );
};
