import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MACRO_INGREDIENTS } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getBasePath = (): string => {
  const isDevOrStudio = typeof window !== 'undefined' && (
    window.location.hostname.includes('ais-dev-') || 
    window.location.hostname.includes('localhost') || 
    window.location.hostname.includes('127.0.0.1') ||
    (import.meta as any).env?.DEV
  );
  return isDevOrStudio ? 'users/dev_qa_franquia_data' : 'users/shared_franquia_data';
};

export const getDataPath = (subcollection?: string): string => {
  const base = getBasePath();
  return subcollection ? `${base}/${subcollection}` : base;
};

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export const getMacroForProduct = (name: string): string => {
  const raw = (name || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  
  if (normalized === 'torta bottega' || normalized === 'tortas bottega' || normalized.includes('bottega') || normalized === 'torta mista' || normalized.includes('torta')) {
    return 'Tortas Bottega';
  }
  if (normalized.includes('cookie') || normalized.includes('cookies')) {
    return 'Cookie';
  }
  if (normalized.includes('croissant') || normalized.includes('croissants')) {
    return 'Croissant';
  }
  if (normalized.includes('pão') || normalized.includes('pao')) {
    if (normalized.includes('gouda') || normalized.includes('queijo gouda')) return 'Pão de queijo Gouda';
    if (normalized.includes('batata') || normalized.includes('batata doce')) return 'Pão de queijo Batata Doce';
    if (normalized.includes('waffle')) return 'Pão de queijo para Waffle';
    return 'Pão';
  }
  if (normalized.includes('recheio maca') || normalized.includes('recheio maça') || normalized.includes('recheio maçã')) {
    return 'Recheio Maça';
  }
  if (normalized.includes('cheese cake') || normalized.includes('cheesecake')) {
    return 'Cheese Cake';
  }
  if (normalized.includes('esfiha carne') || (normalized.includes('esfiha') && normalized.includes('carne'))) {
    return 'Esfiha Carne';
  }
  if (normalized.includes('esfiha queijo') || (normalized.includes('esfiha') && normalized.includes('queijo'))) {
    return 'Esfiha Queijo';
  }
  if (normalized.includes('pastel assado') || normalized.includes('pastel')) {
    return 'Pastel Assado';
  }
  if (normalized.includes('coxinha jaca')) {
    return 'Coxinha Jaca';
  }
  if (normalized.includes('coxinha frango')) {
    return 'Coxinha Frango';
  }
  if (normalized.includes('refri') || normalized.includes('coca') || normalized.includes('gasosa') || normalized.includes('refrigerante')) {
    if (normalized.includes('220')) return 'Refrigerante 220ml';
    return 'Refrigerante 350ml';
  }
  if (normalized.includes('água') || normalized.includes('agua')) {
    if (normalized.includes('com gás') || normalized.includes('com gas')) return 'Agua com gas';
    return 'Agua sem gas';
  }
  if (normalized.includes('café') || normalized.includes('cafe')) {
    if (normalized.includes('grão') || normalized.includes('grao')) return 'Café em grão';
    if (normalized.includes('descafeinado')) return 'Café descafeinado';
    return 'Café moido Classico';
  }
  if (normalized.includes('suco')) return 'Suco Lata';
  if (normalized.includes('fruta') || normalized.includes('congelada') || normalized.includes('congeladas')) return 'Frutas Congeladas';
  if (normalized.includes('quiche')) return 'Quiche';
  if (normalized.includes('yuba')) return 'Yuba';
  if (normalized.includes('carne suculenta') || normalized.includes('carne')) return 'Carne suculenta';
  if (normalized.includes('cinnamon')) return 'Cinnamon Roll';
  if (normalized.includes('brownie')) return 'Brownie';
  if (normalized.includes('bolo')) return 'Bolo Caseiro';
  if (normalized.includes('chá') || normalized.includes('cha') || normalized.includes('twinnings') || normalized.includes('twinings')) {
    return 'chá twinnigs';
  }

  const exact = MACRO_INGREDIENTS.find(m => m.toLowerCase() === normalized);
  if (exact) return exact;

  const containsMatch = MACRO_INGREDIENTS.find(m => {
    const ml = m.toLowerCase();
    return normalized.includes(ml) || ml.includes(normalized);
  });
  if (containsMatch) return containsMatch;

  return raw;
};

export async function cloneProductionToDev(onProgress?: (stepName: string, count: number) => void): Promise<{ success: boolean; count: number; error?: string }> {
  // Dynamic import of db and firestore functions to avoid circular deps
  const { db } = await import('../lib/firebase');
  const { collection, getDocs, doc, writeBatch } = await import('firebase/firestore');

  const subcollections = [
    { key: 'sales', label: 'Vendas' },
    { key: 'purchases', label: 'Compras' },
    { key: 'bankTransactions', label: 'Transações Bancárias' },
    { key: 'financialRecords', label: 'Registros Financeiros' },
    { key: 'stock', label: 'Estoque' },
    { key: 'wasteRecords', label: 'Desperdício e Reuso' },
    { key: 'staffConsumption', label: 'Consumo de Funcionários' },
    { key: 'staffPayments', label: 'Baixa de Pagamentos' },
    { key: 'purchaseRequests', label: 'Pedidos de Compra' },
    { key: 'recipes', label: 'Fichas Técnicas' },
    { key: 'staffDiscountOverrides', label: 'Descontos de Funcionários' },
    { key: 'systemLogs', label: 'Logs do Sistema' },
    { key: 'temperatureMeasurements', label: 'Controle de Temperatura' },
    { key: 'systemStaff', label: 'Gestão de Funcionários' },
    { key: 'stockCountConfig', label: 'Catálogo de Estoque' },
    { key: 'stockMinimumOverrides', label: 'Estoques Mínimos' }
  ];

  let totalCopied = 0;
  try {
    for (const sub of subcollections) {
      if (onProgress) onProgress(sub.label, totalCopied);
      const prodColRef = collection(db, `users/shared_franquia_data/${sub.key}`);
      const devColRef = collection(db, `users/dev_qa_franquia_data/${sub.key}`);
      const snap = await getDocs(prodColRef);
      
      if (!snap.empty) {
        let batch = writeBatch(db);
        let countInBatch = 0;
        
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const targetDocRef = doc(devColRef, docSnap.id);
          batch.set(targetDocRef, data);
          totalCopied++;
          countInBatch++;
          
          if (countInBatch >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            countInBatch = 0;
          }
        }
        if (countInBatch > 0) {
          await batch.commit();
        }
      }
    }
    if (onProgress) onProgress('Concluído com sucesso!', totalCopied);
    return { success: true, count: totalCopied };
  } catch (err: any) {
    console.error('Error cloning production data to dev:', err);
    return { success: false, count: totalCopied, error: err.message || String(err) };
  }
}

