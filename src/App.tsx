/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Upload as UploadIcon, 
  ChevronRight, 
  Cookie, 
  TrendingUp, 
  Wallet,
  Settings,
  HelpCircle,
  LogOut,
  RefreshCw,
  Calendar,
  AlertCircle,
  LogIn,
  Package,
  Cloud,
  WifiOff,
  Database,
  Percent,
  Check,
  CheckCircle,
  QrCode,
  Share2
} from 'lucide-react';
import { cn, getMacroForProduct, formatCurrency } from './lib/utils';
import { Sale, Purchase, BankTransaction, StockItem, MonthlyClosing, FinancialRecord, StaffConsumption, StaffPayment, PurchaseRequest, Recipe, StaffDiscountOverride } from './types';
import { PurchaseReviewModal } from './components/PurchaseReviewModal';
import { Dashboard } from './components/Dashboard';
import { Indicators } from './components/Indicators';
import { CSVUpload } from './components/CSVUpload';
import { CashFlow } from './components/CashFlow';
import { OperationHub } from './components/OperationHub';
import { InventoryDashboard } from './components/InventoryDashboard';
import { LogCenter } from './components/LogCenter';
import { ShareKioskModal } from './components/ShareKioskModal';
import { motion, AnimatePresence } from 'motion/react';
import { MultiSelect } from './components/MultiSelect';
import JSZip from 'jszip';
import Papa from 'papaparse';

// Firebase imports
import { auth, db, signInWithGoogle, logout, googleProvider } from './lib/firebase';
import { logAction } from './lib/logs';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  writeBatch, 
  doc, 
  deleteDoc, 
  getDocs,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { OperationType, handleFirestoreError } from './lib/firestoreUtils';

type Tab = 'dashboard' | 'upload' | 'cashflow' | 'indicators' | 'waste' | 'inventory' | 'logs';

const MONTH_MAP: Record<string, string> = {
  'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
  'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
  'jan.': '01', 'fev.': '02', 'mar.': '03', 'abr.': '04', 'mai.': '05', 'jun.': '06',
  'jul.': '07', 'ago.': '08', 'set.': '09', 'out.': '10', 'nov.': '11', 'dez.': '12',
  'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06',
  'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
};

const normalizeMonth = (val: any): string => {
  if (!val) return '';
  const strVal = typeof val === 'string' ? val : String(val);
  const raw = strVal.toLowerCase().trim();
  if (!raw) return '';

  // Se já estiver no formato MM/YYYY
  if (/^\d{2}\/\d{4}$/.test(raw)) return raw;

  const separators = ['/', '-', '.', ' '];
  let pts: string[] = [raw];
  
  for (const sep of separators) {
    if (raw.includes(sep)) {
      pts = raw.split(sep).map(p => p.trim()).filter(p => p !== '');
      if (pts.length >= 2) break;
    }
  }

  let m = '', y = '';

  // Helper to find month from string
  const findMonthNum = (s: string) => {
    const cleanS = s.replace('.', '').substring(0, 3).toLowerCase();
    return MONTH_MAP[cleanS] || (Number(s) <= 12 ? s.padStart(2, '0') : null);
  };

  if (pts.length >= 2) {
    // Tenta identificar o ano primeiro (4 dígitos)
    pts.forEach(p => {
      if (p.length === 4 && !isNaN(Number(p))) y = p;
    });

    // Tenta achar o mês
    pts.forEach(p => {
      const mn = findMonthNum(p);
      if (mn && p !== y) m = mn;
    });

    // Fallback por posição se não achou m ou y
    if (!m || !y) {
      if (pts.length === 3) {
        // DD/MM/YYYY ou YYYY/MM/DD
        if (!y) y = pts[2].length === 4 ? pts[2] : (pts[0].length === 4 ? pts[0] : '');
        if (!m) m = pts[1].padStart(2, '0');
      } else if (pts.length === 2) {
        if (!y) y = pts[1].length === 4 ? pts[1] : (pts[0].length === 4 ? pts[0] : '');
        if (!m) m = (y === pts[1] ? pts[0] : pts[1]).padStart(2, '0');
      }
    }
  } else if (pts.length === 1) {
    // Apenas mês ou apenas data estranha
    const mn = findMonthNum(pts[0]);
    if (mn) m = mn;
  }

  if (m) {
    if (!y) y = new Date().getFullYear().toString();
    if (y.length === 2) y = '20' + y;
    return `${m}/${y}`;
  }

  return raw;
};

const normalizeDayDate = (raw: any): string => {
  if (!raw) return '';
  const strRaw = typeof raw === 'string' ? raw : String(raw);
  const pts = strRaw.split(/[/ -]/).filter(p => p.length > 0);
  if (pts.length >= 2) {
    // If Year is first (ISO YYYY-MM-DD or similar)
    if (pts[0].length === 4) {
      const y = pts[0];
      const mOriginal = pts[1];
      const mClean = mOriginal.toLowerCase().trim().replace('.', '');
      const m = (MONTH_MAP[mClean] || mOriginal).padStart(2, '0');
      const d = (pts[2] || '01').padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
    let d = pts[0].padStart(2, '0');
    const mOriginal = pts[1];
    const mClean = mOriginal.toLowerCase().trim().replace('.', '');
    let m = (MONTH_MAP[mClean] || mOriginal).padStart(2, '0');
    let y = pts[2] || new Date().getFullYear().toString();
    if (y.length === 2) y = '20' + y;
    return `${d}/${m}/${y}`;
  }
  return raw;
};

const parseCSVAmount = (val: string): number => {
  if (!val) return 0;
  // Remove R$, espaços e outros caracteres não numéricos exceto os de pontuação
  let clean = val.replace(/R\$/g, '').trim().replace(/[^\d,.-]/g, '');
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  return parseFloat(clean) || 0;
};

const getCSVVal = (row: any, keys: string[]) => {
  const ObjectKeys = Object.keys(row || {});
  let actualKey = ObjectKeys.find(rk => 
    keys.some(k => rk.toLowerCase().trim() === k.toLowerCase().trim())
  );
  if (!actualKey) {
    actualKey = ObjectKeys.find(rk => {
      const cleanRk = rk.toLowerCase().trim();
      return keys.some(k => {
        const cleanK = k.toLowerCase().trim();
        return cleanRk.includes(cleanK) || cleanK.includes(cleanRk);
      });
    });
  }
  return actualKey ? String(row[actualKey]).trim() : '';
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const [isPublicWasteMode, setIsPublicWasteMode] = useState(false);
  const [isGiseleMode, setIsGiseleMode] = useState(false);
  const [isManualOperator, setIsManualOperator] = useState<boolean>(() => {
    return localStorage.getItem('is_manual_operator') === 'true';
  });
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Data State
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [purchasesData, setPurchasesData] = useState<Purchase[]>([]);
  const [purchaseReviewItems, setPurchaseReviewItems] = useState<Purchase[] | null>(null);
  const [bankData, setBankData] = useState<BankTransaction[]>([]);
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [financialData, setFinancialData] = useState<FinancialRecord[]>([]);
  const [wasteData, setWasteData] = useState<any[]>([]);
  const [staffConsumptionData, setStaffConsumptionData] = useState<StaffConsumption[]>([]);
  const [staffPaymentsData, setStaffPaymentsData] = useState<StaffPayment[]>([]);
  const [purchaseRequestsData, setPurchaseRequestsData] = useState<PurchaseRequest[]>([]);
  const [recipesData, setRecipesData] = useState<Recipe[]>([]);
  const [staffDiscountOverrides, setStaffDiscountOverrides] = useState<StaffDiscountOverride[]>([]);

  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedMonthsCashflow, setSelectedMonthsCashflow] = useState<string[]>([]);

  // Google Drive Backup State
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupFileName, setBackupFileName] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [backupError, setBackupError] = useState<string | null>(null);
  const [isAuthorizingDrive, setIsAuthorizingDrive] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Alfa Labs API Integrations States
  const [alfaToken, setAlfaToken] = useState<string>(() => localStorage.getItem('alfa_token') || '');
  const [alfaFilialId, setAlfaFilialId] = useState<string>(() => localStorage.getItem('alfa_filial_id') || '1');
  const [alfaDate, setAlfaDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [alfaSyncing, setAlfaSyncing] = useState<boolean>(false);
  const [alfaResult, setAlfaResult] = useState<any | null>(null);
  const [alfaError, setAlfaError] = useState<string | null>(null);
  const [alfaSaving, setAlfaSaving] = useState<boolean>(false);
  
  // Validation States for connection testing
  const [alfaValidating, setAlfaValidating] = useState<boolean>(false);
  const [alfaValidationResult, setAlfaValidationResult] = useState<any | null>(null);
  const [alfaValidationError, setAlfaValidationError] = useState<string | null>(null);

  // Auth Listener
  useEffect(() => {
    const handleRouting = () => {
      const hash = window.location.hash;
      
      // Support only hash for maximum server compatibility (avoids 404s)
      const isWasteAccess = hash.includes('waste');
      const isGiseleAccess = hash.includes('gisele') || hash.includes('gestao');
      
      if (isWasteAccess) {
        setIsPublicWasteMode(true);
        sessionStorage.setItem('public_waste', 'true');
      }
      
      if (isGiseleAccess) {
        setShowPinInput(true);
      }
    };

    handleRouting();
    window.addEventListener('hashchange', handleRouting);
    
    // Recovery from session/local storage
    if (sessionStorage.getItem('public_waste') === 'true') {
      setIsPublicWasteMode(true);
    }

    const savedGiseleMode = localStorage.getItem('gisele_mode') === 'true';
    if (savedGiseleMode) {
      setIsGiseleMode(true);
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    // Safety timeout to ensure attendant screen opens instantly without hanging
    const authTimeout = setTimeout(() => {
      setLoading(false);
    }, 1200);

    // Auto-login anonymously if no user is authenticated to support seamless database access
    const checkAnonAuth = async () => {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (err: any) {
          console.error("Anonymous auth failed:", err);
          if (err.code === 'auth/admin-restricted-operation') {
            setAuthError("A Autenticação Anônima não está ativada no Firebase. Por favor, ative-a no Console do Firebase (Authentication > Sign-in method).");
          }
        }
      }
    };
    checkAnonAuth();

    return () => {
      unsubscribe();
      clearTimeout(authTimeout);
      window.removeEventListener('hashchange', handleRouting);
    };
  }, []);

  const handleSystemLogout = async () => {
    setIsManualOperator(false);
    localStorage.removeItem('is_manual_operator');
    setIsGiseleMode(false);
    localStorage.removeItem('gisele_mode');
    setIsPublicWasteMode(false);
    sessionStorage.removeItem('public_waste');
    await logout();
    setActiveTab('dashboard');
  };

  const handleGiseleLogout = () => {
    handleSystemLogout();
  };

  const handlePublicWasteLogout = () => {
    handleSystemLogout();
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      // Do NOT await any logout or other async call here before signInWithGoogle.
      // Any asynchronous await before opening a popup breaks the browser's user activation context,
      // which triggers the popup blocker and results in 'auth/popup-blocked'.
      // Firebase automatically signs out the anonymous session when a new user signs in.
      const result = await signInWithGoogle();
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveAccessToken(credential.accessToken);
      }
      setIsPublicWasteMode(false); // Reset public mode on login
      setIsGiseleMode(false);
      localStorage.removeItem('gisele_mode');
    } catch (err: any) {
      console.error('Login error:', err);
      const isPopupRestricted = err.code === 'auth/popup-blocked' || 
                                err.code === 'auth/popup-closed-by-user' || 
                                err.code === 'auth/cancelled-popup-request';
      if (isPopupRestricted) {
        setAuthError('O popup de login foi bloqueado ou fechado antes de ser concluído. Isso é extremamente comum devido às restrições de iFrame no visualizador do AI Studio. Para fazer login normalmente com sua Conta Google, por favor, clique no botão de "ABRIR EM NOVA GUIA" (no canto superior direito da área de visualização) para que a janela de login funcione com sucesso!');
      } else if (err.code === 'auth/operation-not-allowed') {
        setAuthError('O login com Google não está ativado no Firebase Console. Por favor, ative-o em Authentication > Sign-in method.');
      } else {
        setAuthError('Ocorreu um erro ao tentar entrar. Tente novamente: ' + (err.message || ''));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleExecuteBackup = async (customName: string) => {
    if (!customName.trim()) {
      setBackupError('O nome do arquivo de backup não pode ser vazio.');
      return;
    }

    let finalFileName = customName.trim();
    if (!finalFileName.toLowerCase().endsWith('.zip')) {
      finalFileName += '.zip';
    }

    setIsBackingUp(true);
    setBackupError(null);
    setBackupStatus('Iniciando exportação dos dados...');

    try {
      const zip = new JSZip();

      // 1. Export database collections to CSVs
      setBackupStatus('Exportando coleções do banco de dados para arquivos CSV...');
      
      const collectionsToExport = [
        { name: 'vendas_realizadas.csv', data: salesData, colName: 'sales' },
        { name: 'compras_e_insumos.csv', data: purchasesData, colName: 'purchases' },
        { name: 'extrato_bancario.csv', data: bankData, colName: 'bankTransactions' },
        { name: 'controle_de_estoque.csv', data: stockData, colName: 'stock' },
        { name: 'gestao_de_fluxo.csv', data: financialData, colName: 'financialRecords' },
        { name: 'desperdicio_e_reuso.csv', data: wasteData, colName: 'wasteRecords' },
        { name: 'consumo_funcionarios.csv', data: staffConsumptionData, colName: 'staffConsumption' },
        { name: 'pagamentos_funcionarios.csv', data: staffPaymentsData, colName: 'staffPayments' },
        { name: 'pedidos_de_compras.csv', data: purchaseRequestsData, colName: 'purchaseRequests' },
        { name: 'fichas_tecnicas.csv', data: recipesData, colName: 'recipes' },
      ];

      const dbFolder = zip.folder('banco_de_dados_csv');
      if (dbFolder) {
        for (const item of collectionsToExport) {
          let itemData = item.data || [];
          
          // Se a lista de dados atual estiver descarregada ou vazia, tenta ler ao vivo do Firestore
          const activePath = dataPath || 'users/shared_franquia_data';
          if (itemData.length === 0) {
            try {
              const q = query(collection(db, `${activePath}/${item.colName}`));
              const snap = await getDocs(q);
              itemData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
            } catch (err: any) {
              console.error(`Fallback fetch failed for backup of ${item.colName}:`, err);
              throw new Error(`Falha ao ler os dados reais de "${item.colName}" do banco para o backup: ${err.message || err}`);
            }
          }

          // Normaliza campos do banco para formato amigável em CSV
          const cleanedData = itemData.map((row: any) => {
            const cleanRow: any = {};
            for (const key in row) {
              if (row[key] && typeof row[key] === 'object' && row[key].seconds !== undefined) {
                // Conversão de data do Firestore (Timestamp)
                cleanRow[key] = new Date(row[key].seconds * 1000).toLocaleString('pt-BR');
              } else if (row[key] && typeof row[key] === 'object') {
                cleanRow[key] = JSON.stringify(row[key]);
              } else {
                cleanRow[key] = row[key];
              }
            }
            return cleanRow;
          });

          const csvContent = Papa.unparse(cleanedData);
          dbFolder.file(item.name, csvContent);
        }
      }

      // 2. Fetch codebase files from Express server
      setBackupStatus('Requisitando arquivos do código-fonte do sistema...');
      const responseCodebase = await fetch('/api/codebase');
      if (!responseCodebase.ok) {
        throw new Error('Falha ao obter os arquivos de código-fonte através do servidor.');
      }
      
      const codebase: Record<string, string> = await responseCodebase.json();
      const codeFolder = zip.folder('codigo_fonte');
      if (codeFolder) {
        Object.entries(codebase).forEach(([relativePath, content]) => {
          codeFolder.file(relativePath, content);
        });
      }

      // 3. Generate ZIP blob
      setBackupStatus('Empacotando coleções de CSV e códigos fontes em arquivo ZIP comprimido...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // 4. Download file directly in the browser
      setBackupStatus('Iniciando o download do seu backup...');
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = finalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setBackupStatus(`Pronto! O backup "${finalFileName}" foi baixado com sucesso localmente. Agora você pode colocá-lo diretamente na sua pasta compartilhada do Google Drive.`);
    } catch (err: any) {
      console.error(err);
      setBackupError(err?.message || 'Erro inesperado ao gerar e baixar o arquivo de backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

// All available months from data
  const sortMonths = (months: string[]) => {
    return [...months].filter(Boolean).sort((a, b) => {
      const partsA = String(a || '').split('/');
      const partsB = String(b || '').split('/');
      const mA = Number(partsA[0]) || 0;
      const yA = Number(partsA[1]) || 0;
      const mB = Number(partsB[0]) || 0;
      const yB = Number(partsB[1]) || 0;
      if (yA !== yB) return yA - yB;
      return mA - mB;
    });
  };

  // Specific months that have revenue
  const revenueMonths = useMemo(() => {
    const months = new Set<string>();
    salesData.forEach(s => s.mes && months.add(s.mes));
    financialData.filter(f => f.tipo === 'Receita').forEach(f => f.mes && months.add(f.mes));
    return sortMonths(Array.from(months));
  }, [salesData, financialData]);

  // All available months from data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    salesData.forEach(s => s.mes && months.add(s.mes));
    financialData.forEach(f => f.mes && months.add(f.mes));
    purchasesData.forEach(p => {
      // New logic: check explicit 'mes' field
      if ('mes' in p && p.mes) {
        months.add(p.mes as string);
        return;
      }
      
      if (p.data) {
        if (p.data.includes('/') && p.data.length === 7) {
          months.add(p.data);
        } else {
          const normalized = normalizeMonth(p.data);
          if (normalized) months.add(normalized);
        }
      }
    });
    wasteData.forEach(w => {
      const normalized = normalizeMonth(w.data);
      if (normalized) months.add(normalized);
    });
    bankData.forEach(b => {
      const normalized = normalizeMonth(String(b.data));
      if (normalized && normalized.includes('/')) {
        months.add(normalized);
      }
    });

    return sortMonths(Array.from(months));
  }, [salesData, financialData, bankData, purchasesData, wasteData]);

  const userRole = useMemo((): 'admin' | 'attendant' | 'viewer' => {
    // 1. Modos especiais explícitos (Gisele/Admin via PIN) têm prioridade de bypass para evitar bloqueios por conta Google logada
    if (isGiseleMode) return 'admin'; 
    if (isPublicWasteMode) return 'attendant';
    if (isManualOperator) return 'attendant';

    // 2. Classificação baseada no e-mail logado via Google
    if (user && user.email) {
      const email = user.email.toLowerCase();
      if (
        email === 'diogopalaria@gmail.com' || 
        email === 'gisele.palaria@gmail.com' ||
        email === 'diogo@cheney.com.br' ||
        email === 'diogopalaria@hotmail.com'
      ) return 'admin';

      if (email === 'plazasulmrcheney@gmail.com') {
        return 'attendant';
      }

      // Outros e-mails do Google entram automáticos como atendente/operador
      // para permitir que funcionários do quiosque usem o sistema mesmo que logados com Gmail pessoal
      return 'attendant';
    }
    
    // Outros usuários logados (como anônimos ou equipe) e visitantes não-logados (como operador)
    // entram automáticos como atendentes para liberar o acesso físico.
    return 'attendant';
  }, [user, isGiseleMode, isPublicWasteMode, isManualOperator]);

  const isAuthorized = userRole === 'admin' || userRole === 'viewer';
  const isAttendant = !isAuthorized;

  // Shared Data Path Logic
  // Atendentes também salvam no caminho compartilhado para que o dono veja
  const dataPath = (isAuthorized || isAttendant) ? 'users/shared_franquia_data' : null;

  // Firestore Sync
  useEffect(() => {
    if (!dataPath) {
      setSalesData([]);
      setPurchasesData([]);
      setBankData([]);
      setStockData([]);
      setFinancialData([]);
      setSyncError(null);
      return;
    }

    setSyncError(null);

    const collections = [
      { name: 'sales', setter: setSalesData },
      { name: 'purchases', setter: setPurchasesData },
      { name: 'bankTransactions', setter: setBankData },
      { name: 'stock', setter: setStockData },
      { name: 'financialRecords', setter: setFinancialData },
      { name: 'wasteRecords', setter: setWasteData },
      { name: 'staffConsumption', setter: setStaffConsumptionData },
      { name: 'staffPayments', setter: setStaffPaymentsData },
      { name: 'purchaseRequests', setter: setPurchaseRequestsData },
      { name: 'recipes', setter: setRecipesData },
      { name: 'staffDiscountOverrides', setter: setStaffDiscountOverrides },
    ];

    const unsubscribes = collections.map(({ name, setter }) => {
      const path = `${dataPath}/${name}`;
      const q = query(collection(db, path));
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const item = { ...doc.data(), id: doc.id } as any;
          if (name === 'staffConsumption' || name === 'staffPayments') {
            if (item.funcionario === 'Natan') {
              item.funcionario = 'Nathan';
            }
          }
          if (name === 'wasteRecords') {
            if (item.responsavel === 'Natan') {
              item.responsavel = 'Nathan';
            }
          }
          return item;
        });
        setter(data);

        // Check for new urgent purchase requests
        if (name === 'purchaseRequests') {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const req = change.doc.data() as PurchaseRequest;
              // Check if it's urgent AND newly created (not just loaded on startup)
              // We skip the initial load by checking metadata
              if (req.urgente && !snapshot.metadata.fromCache && snapshot.metadata.hasPendingWrites === false) {
                // To be even safer against startup noise, check if createdAt is recent
                const createdAt = req.createdAt?.toDate?.() || new Date();
                const now = new Date();
                const diffInSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
                
                if (diffInSeconds < 30) { // Only notify if created in the last 30 seconds
                  try {
                    if ('Notification' in window && Notification.permission === 'granted') {
                      new Notification('PEDIDO URGENTE!', {
                        body: `Novo produto urgente solicitado: ${req.produto}`,
                        icon: '/favicon.ico',
                        tag: `urgent-${change.doc.id}`
                      });
                    }
                  } catch (e) {
                    console.warn("Notifications blocked or not supported in this iframe:", e);
                  }
                }
              }
            }
          });
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        setSyncError(`Leitura de '${name}' interrompida: ${error.message || error}`);
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [dataPath]);

  // Data patching for specific known errors (Alexandre 2029) and Natan -> Nathan migration
  useEffect(() => {
    if (!dataPath || !isAuthorized || !user) return;
    
    // Procura por registro com erro conhecido de data (informado pelo usuário)
    const alexandreErrado = staffConsumptionData.find(c => 
      c.funcionario === 'Alexandre' && (c.data === '08/02/2029' || c.data === '2029-02-08')
    );
    
    if (alexandreErrado && alexandreErrado.id && dataPath) {
      console.log('Aplicando correção automática de data para Alexandre...');
      updateDoc(doc(db, `${dataPath}/staffConsumption`, alexandreErrado.id), {
        data: '08/02/2026'
      }).catch(err => console.error('Falha ao corrigir data:', err));
    }

    // Auto-migrate any Firestore documents with 'Natan' to 'Nathan'
    const migrateNatanInFirestore = async () => {
      const migratedFlag = sessionStorage.getItem('natan_to_nathan_migrated_v1');
      if (migratedFlag === 'true') return;

      try {
        const { getDocs, collection, updateDoc: updateFireDoc, doc: fireDoc } = await import('firebase/firestore');
        
        // 1. staffConsumption
        try {
          const snap = await getDocs(collection(db, `${dataPath}/staffConsumption`));
          for (const d of snap.docs) {
            const data = d.data();
            if (data.funcionario === 'Natan') {
              await updateFireDoc(fireDoc(db, `${dataPath}/staffConsumption`, d.id), { funcionario: 'Nathan' });
            }
          }
        } catch (e) {
          console.warn('Migração staffConsumption Natan->Nathan:', e);
        }

        // 2. staffPayments
        try {
          const snap = await getDocs(collection(db, `${dataPath}/staffPayments`));
          for (const d of snap.docs) {
            const data = d.data();
            if (data.funcionario === 'Natan') {
              await updateFireDoc(fireDoc(db, `${dataPath}/staffPayments`, d.id), { funcionario: 'Nathan' });
            }
          }
        } catch (e) {
          console.warn('Migração staffPayments Natan->Nathan:', e);
        }

        // 3. wasteRecords
        try {
          const snap = await getDocs(collection(db, `${dataPath}/wasteRecords`));
          for (const d of snap.docs) {
            const data = d.data();
            if (data.responsavel === 'Natan') {
              await updateFireDoc(fireDoc(db, `${dataPath}/wasteRecords`, d.id), { responsavel: 'Nathan' });
            }
          }
        } catch (e) {
          console.warn('Migração wasteRecords Natan->Nathan:', e);
        }

        // 4. temperatureMeasurements
        try {
          const snap = await getDocs(collection(db, 'users/shared_franquia_data/temperatureMeasurements'));
          for (const d of snap.docs) {
            const data = d.data();
            if (data.funcionario === 'Natan') {
              await updateFireDoc(fireDoc(db, 'users/shared_franquia_data/temperatureMeasurements', d.id), { funcionario: 'Nathan' });
            }
          }
        } catch (e) {
          console.warn('Migração temperatureMeasurements Natan->Nathan:', e);
        }

        sessionStorage.setItem('natan_to_nathan_migrated_v1', 'true');
      } catch (err) {
        console.error('Erro na migração de Natan para Nathan:', err);
      }
    };

    migrateNatanInFirestore();
  }, [staffConsumptionData, isAuthorized, user, dataPath]);

  // Patch database with user's corrected values and remove macadamia test item
  useEffect(() => {
    if (!dataPath || !user) return;

    const applyStockCorrections = async () => {
      // Use flag to run only once per page session
      const correctedFlag = sessionStorage.getItem('stock_corrections_version_7');
      if (correctedFlag === 'true') return;

      console.log('--- STARTING RESILIENT STOCK AND PURCHASES DATA PATCHING ---');
      try {
        const { getDocs, deleteDoc, updateDoc, doc, collection } = await import('firebase/firestore');

        // 1. Correct purchaseRequests
        try {
          const prSnap = await getDocs(collection(db, `${dataPath}/purchaseRequests`));
          for (const d of prSnap.docs) {
            try {
              const req = d.data();
              const name = String(req.produto || '').toLowerCase().trim();
              
              if (name.includes('macadamia') || name.includes('macadâmia')) {
                console.log(`Deletando pedido de macadamia: ${d.id}`);
                await deleteDoc(doc(db, `${dataPath}/purchaseRequests`, d.id));
              } else if (name.includes('batata doce') || (name.includes('pão de queijo') && name.includes('batata') && !name.includes('bacon'))) {
                const qtyNum = Number(req.quantidadeNumerica) || Number(req.quantidade?.split(' ')[0]) || 1;
                const newUnit = 1.54;
                const newTotal = Number((newUnit * qtyNum).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/purchaseRequests`, d.id), {
                  valorUnitario: newUnit,
                  valorTotal: newTotal
                });
              } else if (name.includes('sopa de bacon') || name.includes('sopa bacon') || name.includes('batata com bacon') || name.includes('batata e bacon')) {
                const qtyNum = Number(req.quantidadeNumerica) || Number(req.quantidade?.split(' ')[0]) || 1;
                const newUnit = 17.00;
                const newTotal = Number((newUnit * qtyNum).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/purchaseRequests`, d.id), {
                  valorUnitario: newUnit,
                  valorTotal: newTotal
                });
              } else if (name.includes('caldo verde')) {
                const qtyNum = Number(req.quantidadeNumerica) || Number(req.quantidade?.split(' ')[0]) || 1;
                const newUnit = 17.00;
                const newTotal = Number((newUnit * qtyNum).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/purchaseRequests`, d.id), {
                  valorUnitario: newUnit,
                  valorTotal: newTotal
                });
              } else if (name.includes('mandioquinha')) {
                const qtyNum = Number(req.quantidadeNumerica) || Number(req.quantidade?.split(' ')[0]) || 1;
                const newUnit = 15.00;
                const newTotal = Number((newUnit * qtyNum).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/purchaseRequests`, d.id), {
                  valorUnitario: newUnit,
                  valorTotal: newTotal
                });
              }
            } catch (singleItemErr) {
              console.warn(`Alerta de permissão ou de validação ao corrigir purchaseRequest individual ${d.id}:`, singleItemErr);
            }
          }
        } catch (catErr) {
          console.warn('Coleção branch de purchaseRequests pulada devido a restrições de leitura:', catErr);
        }

        // 2. Correct purchases
        try {
          const purSnap = await getDocs(collection(db, `${dataPath}/purchases`));
          for (const d of purSnap.docs) {
            try {
              const pur = d.data();
              const name = String(pur.produto || '').toLowerCase().trim();

              if (name.includes('macadamia') || name.includes('macadâmia')) {
                console.log(`Deletando compra de macadamia: ${d.id}`);
                await deleteDoc(doc(db, `${dataPath}/purchases`, d.id));
              } else if (name.includes('batata doce') || (name.includes('pão de queijo') && name.includes('batata') && !name.includes('bacon'))) {
                const qty = Number(pur.quantidade) || 1;
                const newUnit = 1.54;
                const newTotal = Number((newUnit * qty).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/purchases`, d.id), {
                  custoUnitario: newUnit,
                  total: newTotal
                });
              } else if (name.includes('sopa de bacon') || name.includes('sopa bacon') || name.includes('batata com bacon') || name.includes('batata e bacon')) {
                const qty = Number(pur.quantidade) || 1;
                const newUnit = 17.00;
                const newTotal = Number((newUnit * qty).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/purchases`, d.id), {
                  custoUnitario: newUnit,
                  total: newTotal
                });
              } else if (name.includes('caldo verde')) {
                const qty = Number(pur.quantidade) || 1;
                const newUnit = 17.00;
                const newTotal = Number((newUnit * qty).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/purchases`, d.id), {
                  custoUnitario: newUnit,
                  total: newTotal
                });
              } else if (name.includes('mandioquinha')) {
                const qty = Number(pur.quantidade) || 1;
                const newUnit = 15.00;
                const newTotal = Number((newUnit * qty).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/purchases`, d.id), {
                  custoUnitario: newUnit,
                  total: newTotal
                });
              }
            } catch (singleItemErr) {
              console.warn(`Alerta ao corrigir purchase individual ${d.id}:`, singleItemErr);
            }
          }
        } catch (catErr) {
          console.warn('Coleção branch de purchases pulada devido a restrições de leitura:', catErr);
        }

        // 3. Correct stock
        try {
          const stockSnap = await getDocs(collection(db, `${dataPath}/stock`));
          for (const d of stockSnap.docs) {
            try {
              const item = d.data();
              const name = String(item.produto || '').toLowerCase().trim();

              if (name.includes('macadamia') || name.includes('macadâmia')) {
                console.log(`Deletando estoque de macadamia: ${d.id}`);
                await deleteDoc(doc(db, `${dataPath}/stock`, d.id));
              } else if (name.includes('batata doce') || (name.includes('pão de queijo') && name.includes('batata') && !name.includes('bacon'))) {
                const qty = Number(item.estoqueAtual) || 0;
                const newUnit = 1.54;
                const newTotal = Number((newUnit * qty).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/stock`, d.id), {
                  produto: item.produto || 'Pão de queijo Batata Doce',
                  estoqueAtual: qty,
                  custoUnitario: newUnit,
                  valorTotal: newTotal
                });
              } else if (name.includes('sopa de bacon') || name.includes('sopa bacon') || name.includes('batata com bacon') || name.includes('batata e bacon')) {
                const qty = Number(item.estoqueAtual) || 0;
                const newUnit = 17.00;
                const newTotal = Number((newUnit * qty).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/stock`, d.id), {
                  produto: item.produto || 'Sopa de Batata com Bacon',
                  estoqueAtual: qty,
                  custoUnitario: newUnit,
                  valorTotal: newTotal
                });
              } else if (name.includes('caldo verde')) {
                const qty = Number(item.estoqueAtual) || 0;
                const newUnit = 17.00;
                const newTotal = Number((newUnit * qty).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/stock`, d.id), {
                  produto: item.produto || 'Caldo verde',
                  estoqueAtual: qty,
                  custoUnitario: newUnit,
                  valorTotal: newTotal
                });
              } else if (name.includes('mandioquinha')) {
                const qty = Number(item.estoqueAtual) || 0;
                const newUnit = 15.00;
                const newTotal = Number((newUnit * qty).toFixed(2));
                await updateDoc(doc(db, `${dataPath}/stock`, d.id), {
                  produto: item.produto || 'Caldo de Mandioquinha',
                  estoqueAtual: qty,
                  custoUnitario: newUnit,
                  valorTotal: newTotal
                });
              }
            } catch (singleItemErr) {
              console.warn(`Alerta ao corrigir stock individual ${d.id}:`, singleItemErr);
            }
          }
        } catch (catErr) {
          console.warn('Coleção branch de stock pulada devido a restrições de leitura:', catErr);
        }

        sessionStorage.setItem('stock_corrections_version_7', 'true');
        console.log('--- COMPLETED STOCK CORRECTIONS PART SUCCESSFULLY ---');

        // 4. Import user's custom CSV data automatically!
        const userImportFlag = sessionStorage.getItem('user_csv_import_version_7');
        if (userImportFlag !== 'true') {
          try {
            console.log('--- STARTING AUTOMATIC USER CUSTOM CSV ROWS IMPORT ---');
            const customCSVItems = [
              { data: "07/04/2026", mes: "04/2026", fornecedor: "AMBEV", produto: "Refrigerante 350ml", quantidade: 48, total: 144.48, custoUnitario: 3.01 },
              { data: "05/05/2026", mes: "05/2026", fornecedor: "AMBEV", produto: "Refrigerante 350ml", quantidade: 48, total: 139.68, custoUnitario: 2.91 },
              { data: "28/02/2026", mes: "02/2026", fornecedor: "AMBEV", produto: "Agua sem gas", quantidade: 120, total: 203.10, custoUnitario: 1.6925 },
              { data: "28/02/2026", mes: "02/2026", fornecedor: "AMBEV", produto: "Agua com gas", quantidade: 36, total: 67.05, custoUnitario: 1.8625 },
              { data: "28/02/2026", mes: "02/2026", fornecedor: "AMBEV", produto: "Refrigerante 350ml", quantidade: 24, total: 71.04, custoUnitario: 2.96 },
              { data: "17/03/2026", mes: "03/2026", fornecedor: "AMBEV", produto: "Agua sem gas", quantidade: 180, total: 304.65, custoUnitario: 1.6925 },
              { data: "17/03/2026", mes: "03/2026", fornecedor: "AMBEV", produto: "Refrigerante 350ml", quantidade: 24, total: 60.33, custoUnitario: 2.51375 },
              { data: "13/03/2026", mes: "03/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 350ml", quantidade: 24, total: 41.40, custoUnitario: 1.725 },
              { data: "13/03/2026", mes: "03/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Suco Lata", quantidade: 30, total: 107.40, custoUnitario: 3.58 },
              { data: "13/03/2026", mes: "03/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 220ml", quantidade: 24, total: 50.16, custoUnitario: 2.09 },
              { data: "20/03/2026", mes: "03/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua com gas", quantidade: 120, total: 196.80, custoUnitario: 1.64 },
              { data: "07/04/2026", mes: "04/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua sem gas", quantidade: 120, total: 175.20, custoUnitario: 1.46 },
              { data: "07/04/2026", mes: "04/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 220ml", quantidade: 24, total: 50.16, custoUnitario: 2.09 },
              { data: "07/04/2026", mes: "04/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua com gas", quantidade: 48, total: 78.72, custoUnitario: 1.64 },
              { data: "07/04/2026", mes: "04/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 350ml", quantidade: 24, total: 82.80, custoUnitario: 3.45 },
              { data: "23/04/2026", mes: "04/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua com gas", quantidade: 84, total: 137.76, custoUnitario: 1.64 },
              { data: "23/04/2026", mes: "04/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua sem gas", quantidade: 144, total: 210.24, custoUnitario: 1.46 },
              { data: "27/04/2026", mes: "04/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 350ml", quantidade: 60, total: 207.00, custoUnitario: 3.45 },
              { data: "27/04/2026", mes: "04/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Suco Lata", quantidade: 36, total: 128.88, custoUnitario: 3.58 },
              { data: "27/04/2026", mes: "04/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 220ml", quantidade: 60, total: 125.39, custoUnitario: 2.08983 },
              { data: "09/05/2026", mes: "05/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua com gas", quantidade: 108, total: 177.12, custoUnitario: 1.64 },
              { data: "09/05/2026", mes: "05/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua sem gas", quantidade: 180, total: 262.80, custoUnitario: 1.46 },
              { data: "21/05/2026", mes: "05/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 220ml", quantidade: 36, total: 124.20, custoUnitario: 3.45 },
              { data: "21/05/2026", mes: "05/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua com gas", quantidade: 60, total: 98.40, custoUnitario: 1.64 },
              { data: "21/05/2026", mes: "05/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua sem gas", quantidade: 60, total: 87.60, custoUnitario: 1.46 },
              { data: "21/05/2026", mes: "05/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 220ml", quantidade: 24, total: 50.16, custoUnitario: 2.09 },
              { data: "21/05/2026", mes: "05/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Suco Lata", quantidade: 36, total: 115.99, custoUnitario: 3.22194 },
              { data: "01/01/2026", mes: "01/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua sem gas", quantidade: 292, total: 426.32, custoUnitario: 1.46 },
              { data: "01/01/2026", mes: "01/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua com gas", quantidade: 113, total: 185.32, custoUnitario: 1.64 },
              { data: "01/01/2026", mes: "01/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 350ml", quantidade: 49, total: 169.05, custoUnitario: 3.45 },
              { data: "01/01/2026", mes: "01/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 220ml", quantidade: 24, total: 50.16, custoUnitario: 2.09 },
              { data: "01/01/2026", mes: "01/2026", fornecedor: "FEMSA (Coca-Cola)", produto: "Suco Lata", quantidade: 14, total: 50.12, custoUnitario: 3.58 },
              { data: "01/12/2025", mes: "12/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua sem gas", quantidade: 494, total: 721.24, custoUnitario: 1.46 },
              { data: "01/12/2025", mes: "12/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua com gas", quantidade: 209, total: 342.76, custoUnitario: 1.64 },
              { data: "01/12/2025", mes: "12/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 350ml", quantidade: 56, total: 193.20, custoUnitario: 3.45 },
              { data: "01/12/2025", mes: "12/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 220ml", quantidade: 47, total: 98.23, custoUnitario: 2.09 },
              { data: "01/12/2025", mes: "12/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Suco Lata", quantidade: 2, total: 7.16, custoUnitario: 3.58 },
              { data: "01/11/2025", mes: "11/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua sem gas", quantidade: 340, total: 496.40, custoUnitario: 1.46 },
              { data: "01/11/2025", mes: "11/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua com gas", quantidade: 117, total: 191.88, custoUnitario: 1.64 },
              { data: "01/11/2025", mes: "11/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 350ml", quantidade: 25, total: 86.25, custoUnitario: 3.45 },
              { data: "01/11/2025", mes: "11/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 220ml", quantidade: 41, total: 85.69, custoUnitario: 2.09 },
              { data: "01/11/2025", mes: "11/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Suco Lata", quantidade: 6, total: 21.48, custoUnitario: 3.58 },
              { data: "01/10/2025", mes: "10/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua sem gas", quantidade: 152, total: 148.92, custoUnitario: 0.97973 },
              { data: "01/10/2025", mes: "10/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Agua com gas", quantidade: 91, total: 67.24, custoUnitario: 0.7389 },
              { data: "01/10/2025", mes: "10/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 350ml", quantidade: 40, total: 31.05, custoUnitario: 0.77625 },
              { data: "01/10/2025", mes: "10/2025", fornecedor: "FEMSA (Coca-Cola)", produto: "Refrigerante 220ml", quantidade: 60, total: 20.90, custoUnitario: 0.34833 }
            ];

            const purBatch = writeBatch(db);
            const occurrencesMap: Record<string, number> = {};

            customCSVItems.forEach((item: any) => {
              const key = `${item.data}_${item.fornecedor}_${item.produto}_${item.quantidade}_${item.total}`.toLowerCase().trim();
              occurrencesMap[key] = (occurrencesMap[key] || 0) + 1;
              const seq = occurrencesMap[key];
              const itemWithSeq = { ...item, seq };
              const id = generateDeterministicId(itemWithSeq, 'purchases');
              const docRef = doc(db, `${dataPath}/purchases`, id);
              purBatch.set(docRef, { ...itemWithSeq, userId: user.uid });
            });

            await purBatch.commit();
            console.log(`Automatic imported ${customCSVItems.length} custom CSV rows successfully!`);
            await recalculateAllStock();
            sessionStorage.setItem('user_csv_import_version_7', 'true');
          } catch (err) {
            console.error("Failed to automatically import user custom CSV rows:", err);
          }
        }
      } catch (err) {
        console.error('Failed to correct stock and purchases data:', err);
      }
    };

    applyStockCorrections();
  }, [dataPath, user]);

  const generateDeterministicId = (item: any, type: string) => {
    const sanitize = (val: any) => String(val || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_').substring(0, 50);
    const seqStr = item.seq ? `_seq_${item.seq}` : '';

    if (type === 'sales') {
      return `sale_${sanitize(item.mes)}_${sanitize(item.nome)}_${item.quantidade}_${Math.round((item.vendas || 0) * 100)}${seqStr}`;
    }
    if (type === 'purchases') {
      return `purchase_${sanitize(normalizeDayDate(item.data))}_${sanitize(item.produto)}_${item.quantidade}_${Math.round((item.total || 0) * 100)}${seqStr}`;
    }
    if (type === 'bankTransactions') {
      return `tx_${sanitize(normalizeDayDate(item.data))}_${sanitize(item.descricao)}_${Math.round((item.valor || 0) * 100)}_${sanitize(item.tipo)}${seqStr}`;
    }
    if (type === 'stock') {
      return `stock_${sanitize(item.produto)}`;
    }
    if (type === 'financialRecords') {
      return `fin_${sanitize(item.mes)}_${Math.round((item.valor || 0) * 100)}_${sanitize(item.tipo)}_${sanitize(item.classificacao)}_${sanitize(item.detalhes)}${seqStr}`;
    }
    if (type === 'staffConsumption') {
      return `staff_cons_${sanitize(item.funcionario)}_${sanitize(item.data)}_${sanitize(item.produto)}_${Math.round((item.valorPago || 0) * 100)}${seqStr}`;
    }
    if (type === 'staffPayments') {
      return `staff_pay_${sanitize(item.funcionario)}_${sanitize(item.dataDeposito)}_${Math.round((item.valorPago || 0) * 100)}${seqStr}`;
    }
    if (type === 'wasteRecords') {
      return `waste_${sanitize(item.data)}_${sanitize(item.produto)}_${item.quantidade}_${sanitize(item.responsavel)}_${sanitize(item.acao)}${seqStr}`;
    }
    return null;
  };

  // Recipe Engine: Maps Sale Products to Macro Ingredients
  async function recalculateAllStock() {
    if (!dataPath) return;
    const stockPath = `${dataPath}/stock`;
    const recipePath = `${dataPath}/recipes`;
    const salesPath = `${dataPath}/sales`;
    const wastePath = `${dataPath}/wasteRecords`;
    const consumptionPath = `${dataPath}/staffConsumption`;
    const purchasesPath = `${dataPath}/purchases`;

    try {
      setIsResetting(true);
      // 1. Fetch All Historical Data
      const [
        stockSnapshot, 
        recipeSnapshot,
        salesSnapshot,
        wasteSnapshot,
        consumptionSnapshot,
        purchasesSnapshot
      ] = await Promise.all([
        getDocs(collection(db, stockPath)),
        getDocs(collection(db, recipePath)),
        getDocs(collection(db, salesPath)),
        getDocs(collection(db, wastePath)),
        getDocs(collection(db, consumptionPath)),
        getDocs(collection(db, purchasesPath))
      ]);

      const recipes = recipeSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
      const stocks = stockSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const allSales = salesSnapshot.docs.map(d => d.data());
      const allWaste = wasteSnapshot.docs.map(d => d.data());
      const allConsumption = consumptionSnapshot.docs.map(d => d.data());
      const allPurchases = purchasesSnapshot.docs.map(d => d.data());

      // 2. Initialize Stock Map from Purchases
      const stockMap: Record<string, { qty: number, cost: number }> = {};
      
      allPurchases.forEach(p => {
        let name = (p.produto || '').trim();
        if (name.toLowerCase() === 'torta bottega') {
          name = 'Tortas Bottega';
        }
        if (!stockMap[name]) stockMap[name] = { qty: 0, cost: 0 };
        stockMap[name].qty += (Number(p.quantidade) || 0);
        stockMap[name].cost = (Number(p.custoUnitario) || stockMap[name].cost);
      });

      // Helper to deduct based on recipe or fallback
      const deductFromMap = (rawProductName: string, quantity: number) => {
        // Clean product name from extra info like (Qtd: ...) or [Dividido entre: ...]
        const cleanName = rawProductName.split(' (Qtd:')[0].split(' [Dividido entre:')[0].trim();
        
        const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === cleanName.toLowerCase()) || 
                      recipes.find(r => cleanName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));

        if (recipe) {
          recipe.ingredientes.forEach(ing => {
            if (!stockMap[ing.macroIngredient]) stockMap[ing.macroIngredient] = { qty: 0, cost: 0 };
            stockMap[ing.macroIngredient].qty -= (ing.quantidade * quantity);
          });
        } else {
          // Fallback keyword matching
          const lowerName = cleanName.toLowerCase();
          let macro = '';
          if (lowerName.includes('cookie')) macro = 'Cookie';
          else if (lowerName.includes('croissant')) macro = 'Croissant';
          else if (lowerName.includes('esfiha') && lowerName.includes('carne')) macro = 'Esfiha Carne';
          else if (lowerName.includes('esfiha') && lowerName.includes('queijo')) macro = 'Esfiha Queijo';
          else if (lowerName.includes('quiche')) macro = 'Quiche';
          
          if (macro) {
            if (!stockMap[macro]) stockMap[macro] = { qty: 0, cost: 0 };
            stockMap[macro].qty -= quantity;
          }
        }
      };

      // 3. Subtract All Deductions
      allSales.forEach(s => deductFromMap(s.nome || s.produto, Number(s.quantidade) || 1));
      allWaste.forEach(w => {
        if (String(w.acao || '').toLowerCase().trim() === 'descarte') {
          deductFromMap(w.produto, Number(w.quantidade) || 1);
        }
      });
      allConsumption.forEach(c => deductFromMap(c.produto, Number(c.quantidade) || 1));

      // 4. Update Stock Collection in Firestore
      const batch = writeBatch(db);
      
      // Update existing or add missing
      Object.entries(stockMap).forEach(([name, data]) => {
        const stockDoc = stocks.find(s => s.produto === name);
        
        const qty = isNaN(data.qty) || data.qty === undefined || data.qty === null ? 0 : Number(data.qty);
        const cost = isNaN(data.cost) || data.cost === undefined || data.cost === null ? 0 : Number(data.cost);
        const unitCost = cost || Number(stockDoc?.custoUnitario) || 0;
        const totalValue = qty * unitCost;

        if (stockDoc) {
          batch.update(doc(db, stockPath, stockDoc.id), {
            produto: name,
            estoqueAtual: qty,
            custoUnitario: unitCost,
            valorTotal: totalValue
          });
        } else {
          batch.set(doc(collection(db, stockPath)), {
            produto: name,
            estoqueAtual: qty,
            custoUnitario: unitCost,
            valorTotal: totalValue,
            userId: user?.uid
          });
        }
      });

      await batch.commit();
      alert('Recálculo de estoque completo finalizado com sucesso!');
    } catch (err) {
      console.error('Erro ao recalcular estoque:', err);
      alert('Erro ao recalcular estoque. Verifique o console.');
    } finally {
      setIsResetting(false);
    }
  }

  const applyRecipesToStock = async (items: any[]) => {
    if (!dataPath) return;
    const stockPath = `${dataPath}/stock`;
    const recipePath = `${dataPath}/recipes`;
    
    try {
      // 1. Fetch Stock and Recipes
      const [stockSnapshot, recipeSnapshot] = await Promise.all([
        getDocs(collection(db, stockPath)),
        getDocs(collection(db, recipePath))
      ]);

      const stockItems = stockSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const recipes = recipeSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
      
      const batch = writeBatch(db);
      let techUpdates = 0;

      for (const item of items) {
        const rawProductName = (item.nome || item.produto || '').trim();
        // Clean product name from extra info
        const fullProductName = rawProductName.split(' (Qtd:')[0].split(' [Dividido entre:')[0].trim();
        const quantity = Number(item.quantidade) || 1;

        // Improved recipe matching: exact or startsWith (for products with options)
        const recipe = recipes.find(r => r.produtoFinal.toLowerCase() === fullProductName.toLowerCase()) ||
                       recipes.find(r => fullProductName.toLowerCase().startsWith(r.produtoFinal.toLowerCase()));

        if (recipe) {
          // Process all ingredients in the recipe
          for (const ingredient of recipe.ingredientes) {
            const stockDoc = stockItems.find(s => {
              const stockMacro = getMacroForProduct(s.produto);
              const ingMacro = getMacroForProduct(ingredient.macroIngredient);
              return stockMacro === ingMacro || s.produto === ingredient.macroIngredient;
            });
            if (stockDoc) {
              const totalDeduction = ingredient.quantidade * quantity;
              const newQty = (Number(stockDoc.estoqueAtual) || 0) - totalDeduction;
              
              const docRef = doc(db, stockPath, stockDoc.id);
              batch.update(docRef, { 
                estoqueAtual: newQty,
                valorTotal: newQty * (Number(stockDoc.custoUnitario) || 0)
              });
              techUpdates++;
              
              // Update local state for subsequent items in the same batch
              stockDoc.estoqueAtual = newQty;
            }
          }
        } else {
          // Fallback to our robust matching helper to deduct direct sales without explicit recipe
          const macroToDeduct = getMacroForProduct(fullProductName);
          if (macroToDeduct) {
            const stockDoc = stockItems.find(s => {
              const stockMacro = getMacroForProduct(s.produto);
              return stockMacro === macroToDeduct || s.produto === macroToDeduct;
            });
            if (stockDoc) {
              const newQty = (Number(stockDoc.estoqueAtual) || 0) - quantity;
              const docRef = doc(db, stockPath, stockDoc.id);
              batch.update(docRef, { 
                estoqueAtual: newQty,
                valorTotal: newQty * (Number(stockDoc.custoUnitario) || 0)
              });
              techUpdates++;
              stockDoc.estoqueAtual = newQty;
            }
          }
        }
      }

      if (techUpdates > 0) {
        await batch.commit();
        console.log(`Receitas aplicadas: ${techUpdates} deduções de estoque processadas.`);
      }
    } catch (err) {
      console.error('Erro ao aplicar receitas ao estoque:', err);
    }
  };

  const saveBatch = async (collectionName: string, items: any[]) => {
    if (!user || !dataPath) return;
    const userId = user.uid;
    const path = `${dataPath}/${collectionName}`;

    try {
      // Process items in chunks of 500 (Firestore limit)
      const chunks = [];
      for (let i = 0; i < items.length; i += 500) {
        chunks.push(items.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          const id = generateDeterministicId(item, collectionName);
          const docRef = id ? doc(db, path, id) : doc(collection(db, path));
          batch.set(docRef, { ...item, userId });
        });
        await batch.commit();
      }
      
      const categoryMap: Record<string, string> = {
        sales: 'Faturamento',
        wasteRecords: 'Descarte',
        staffConsumption: 'Consumo Equipe',
        staffPayments: 'Pagamento Equipe',
        purchaseRequests: 'Pedido Compra',
        recipes: 'Ficha Técnica',
        purchases: 'Compra Manual/Estoque'
      };
      const categoryPt = categoryMap[collectionName] || collectionName;
      await logAction('Upload CSV', categoryPt, `Importou arquivo com ${items.length} linhas de ${categoryPt}`, collectionName, 'multiple', { rowCount: items.length });
      
      // Auto-deduct stock for sales, waste and consumption, and recalculate for purchases
      if (collectionName === 'sales' || collectionName === 'wasteRecords' || collectionName === 'staffConsumption' || collectionName === 'purchases') {
        if (collectionName === 'purchases') {
          await recalculateAllStock();
        } else if (collectionName === 'sales' && items.length > 50) {
          recalculateAllStock();
        } else if (collectionName === 'wasteRecords') {
          // Only deduct stock for 'Descarte' action
          const itemsToDeduct = items.filter(i => String(i.acao || '').toLowerCase().trim() === 'descarte');
          if (itemsToDeduct.length > 0) applyRecipesToStock(itemsToDeduct);
        } else {
          applyRecipesToStock(items);
        }
      }
      
      alert('Dados salvos com sucesso e estoque atualizado!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleAlfaLabsValidate = async () => {
    setAlfaValidating(true);
    setAlfaValidationError(null);
    setAlfaValidationResult(null);

    // Save configuration persistently
    localStorage.setItem('alfa_token', alfaToken);
    localStorage.setItem('alfa_filial_id', alfaFilialId);

    try {
      const response = await fetch('/api/alfalabs/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: alfaToken,
          filialId: Number(alfaFilialId)
        }),
      });

      const res = await response.json();
      if (res.success) {
        setAlfaValidationResult(res);
      } else {
        setAlfaValidationError(res.error || 'Erro na validação das credenciais.');
      }
    } catch (err: any) {
      console.error('Error validating credentials:', err);
      setAlfaValidationError(err.message || 'Falha de conexão com o servidor de validação.');
    } finally {
      setAlfaValidating(false);
    }
  };

  const resolveProductOrigem = (nome: string, categoria: string, currentOrigem?: string) => {
    const cleanOrigem = String(currentOrigem || '').toLowerCase().trim();
    const allowed = ["mr. cheney", "mr cheney", "origens", "bebidas", "porção", "porçao"];
    if (cleanOrigem && allowed.includes(cleanOrigem)) {
      if (cleanOrigem.includes('cheney')) return 'Mr. Cheney';
      if (cleanOrigem.includes('origens')) return 'Origens';
      if (cleanOrigem.includes('bebida')) return 'Bebidas';
      if (cleanOrigem.includes('porç') || cleanOrigem.includes('porc')) return 'Porção';
    }

    const cleanName = String(nome || '').toLowerCase();
    const cleanCat = String(categoria || '').toLowerCase();
    
    if (cleanName.includes("cookie") || cleanName.includes("cheney") || cleanCat.includes("cheney") || cleanName.includes("torta") || cleanName.includes("bottega")) {
      return "Mr. Cheney";
    } else if (cleanName.includes("suco") || cleanName.includes("refrigerante") || cleanName.includes("agua") || cleanName.includes("água") || cleanName.includes("refri") || cleanName.includes("café") || cleanName.includes("cafe") || cleanName.includes("chá") || cleanName.includes("cha") || cleanCat.includes("bebida") || cleanCat.includes("café") || cleanCat.includes("cafe")) {
      return "Bebidas";
    } else if (cleanName.includes("porção") || cleanName.includes("porçao") || cleanName.includes("fritas") || cleanName.includes("batata") || cleanName.includes("bacon") || cleanCat.includes("porção") || cleanCat.includes("porco") || cleanCat.includes("salgad")) {
      return "Porção";
    } else {
      return "Origens";
    }
  };

  const handleAlfaLabsSync = async (simulate: boolean) => {
    setAlfaSyncing(true);
    setAlfaError(null);
    setAlfaResult(null);

    // Save configuration persistently
    localStorage.setItem('alfa_token', alfaToken);
    localStorage.setItem('alfa_filial_id', alfaFilialId);

    try {
      const response = await fetch('/api/alfalabs/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: alfaToken,
          filialId: Number(alfaFilialId),
          date: alfaDate,
          simulate
        }),
      });

      const res = await response.json();
      if (res.success) {
        if (res.sales && Array.isArray(res.sales)) {
          const productOriginMap: Record<string, string> = {};
          const allowedOriginsClean = ["mr. cheney", "mr cheney", "origens", "bebidas", "porção", "porçao"];
          
          salesData.forEach((s: any) => {
            const pName = (s.nome || s.produto || "").toLowerCase().trim();
            const pOrigem = s.origem;
            if (pName && pOrigem) {
              const lowerOrigem = String(pOrigem).toLowerCase().trim();
              if (allowedOriginsClean.includes(lowerOrigem)) {
                productOriginMap[pName] = pOrigem;
              }
            }
          });

          res.sales = res.sales.map((sale: any) => {
            const saleNameClean = (sale.nome || "").toLowerCase().trim();
            
            let foundOrigem = productOriginMap[saleNameClean];
            if (!foundOrigem) {
              const matchedKey = Object.keys(productOriginMap).find(
                key => key.includes(saleNameClean) || saleNameClean.includes(key)
              );
              if (matchedKey) {
                foundOrigem = productOriginMap[matchedKey];
              }
            }

            const resolved = resolveProductOrigem(sale.nome, sale.categoria, foundOrigem);

            return {
              ...sale,
              origem: resolved,
              tipoEntrega: sale.tipoEntrega || 'Balcão'
            };
          });
        }

        setAlfaResult(res);
        await logAction(
          'Upload CSV',
          'Sincronização PDV',
          `Sincronizou vendas para ${alfaDate} via Alfa Labs API (${simulate ? 'Simulação' : 'Real'})`,
          'sales',
          'single',
          { date: alfaDate, ordersCount: res.ordersCount, itemsCount: res.itemsCount }
        );
      } else {
        setAlfaError(res.error || 'Erro desconhecido na sincronização.');
      }
    } catch (err: any) {
      console.error('Error syncing Alfa Labs API:', err);
      setAlfaError(err.message || 'Falha de comunicação com o servidor.');
    } finally {
      setAlfaSyncing(false);
    }
  };

  const handleAlfaLabsSaveToDB = async () => {
    if (!alfaResult || !alfaResult.sales || alfaResult.sales.length === 0) return;
    setAlfaSaving(true);
    try {
      // Map and save to DB
      const mapped = alfaResult.sales.map((item: any) => ({
        mes: item.mes,
        data: item.data,
        nome: item.nome,
        quantidade: item.quantidade,
        vendas: item.vendas,
        categoria: item.categoria || 'Geral',
        seq: item.seq,
        origem: resolveProductOrigem(item.nome, item.categoria, item.origem),
        tipoEntrega: item.tipoEntrega || 'Balcão'
      }));
      await saveBatch('sales', mapped);
      alert(`Sucesso! ${mapped.length} registros de vendas foram importados com sucesso para o banco de dados e as receitas já foram abatidas do estoque!`);
    } catch (err: any) {
      alert(`Erro ao salvar no banco de dados: ${err.message}`);
    } finally {
      setAlfaSaving(false);
    }
  };

  const handleAlfaLabsDownloadCSV = () => {
    if (!alfaResult || !alfaResult.sales) return;
    
    let csvLines = ["Mês,Data,Nome,Quantidade,Vendas,Categoria,Origem"];
    alfaResult.sales.forEach((s: any) => {
      const escNome = s.nome.includes(",") ? `"${s.nome}"` : s.nome;
      const escCat = s.categoria.includes(",") ? `"${s.categoria}"` : s.categoria;
      const escOrigem = (s.origem || 'Balcão').includes(",") ? `"${s.origem || 'Balcão'}"` : (s.origem || 'Balcão');
      csvLines.push(`${s.mes},${s.data},${escNome},${s.quantidade},${s.vendas},${escCat},${escOrigem}`);
    });

    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vendas_realizadas_${alfaDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const alfaSummary = useMemo(() => {
    if (!alfaResult || !alfaResult.sales) return null;
    
    const pagamentos: Record<string, number> = {};
    let totalVendas = 0;
    let ifoodTotal = 0;
    let outrosTotal = 0;

    if (alfaResult.pagamentos && Object.keys(alfaResult.pagamentos).length > 0) {
      Object.assign(pagamentos, alfaResult.pagamentos);
      
      Object.entries(pagamentos).forEach(([key, val]) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'ifood' || lowerKey.includes('ifood') || lowerKey.includes('cupom ifood') || lowerKey.includes('integrador')) {
          ifoodTotal += Number(val || 0);
        } else {
          outrosTotal += Number(val || 0);
        }
      });
      totalVendas = ifoodTotal + outrosTotal;
    } else {
      // Emergency absolute fallback
      alfaResult.sales.forEach((s: any) => {
        const pgto = s.formaPagamento || 'Outro';
        pagamentos[pgto] = (pagamentos[pgto] || 0) + (s.vendas || 0);
      });
      totalVendas = alfaResult.sales.reduce((sum: number, s: any) => sum + (s.vendas || 0), 0);

      Object.entries(pagamentos).forEach(([key, val]) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'ifood' || lowerKey.includes('ifood') || lowerKey.includes('cupom ifood') || lowerKey.includes('integrador')) {
          ifoodTotal += val;
        } else {
          outrosTotal += val;
        }
      });
    }

    if (alfaResult.reportTotalVendas && Number(alfaResult.reportTotalVendas) > 0) {
      totalVendas = Number(alfaResult.reportTotalVendas);
      const sumOfPayments = ifoodTotal + outrosTotal;
      if (sumOfPayments > 0) {
        const ratio = totalVendas / sumOfPayments;
        ifoodTotal = Number((ifoodTotal * ratio).toFixed(2));
        outrosTotal = Number((outrosTotal * ratio).toFixed(2));
        
        // Scale individual items in pagamentos map too
        Object.keys(pagamentos).forEach(k => {
          pagamentos[k] = Number((pagamentos[k] * ratio).toFixed(2));
        });
      } else {
        outrosTotal = totalVendas;
      }
    }

    const totalItens = alfaResult.sales.reduce((sum: number, s: any) => sum + (s.quantidade || 0), 0);
    const countPedidos = alfaResult.ordersCount || 0;
      
    const categorias: Record<string, number> = {};
    if (alfaResult.categorias && Object.keys(alfaResult.categorias).length > 0) {
      Object.assign(categorias, alfaResult.categorias);
    } else {
      alfaResult.sales.forEach((s: any) => {
        const cat = s.categoria || 'Geral';
        categorias[cat] = (categorias[cat] || 0) + (s.vendas || 0);
      });
    }

    return {
      totalVendas,
      totalItens,
      countPedidos,
      ifoodTotal,
      outrosTotal,
      pagamentos,
      categorias
    };
  }, [alfaResult]);

  const clearCollection = async (collName: string, displayName: string) => {
    if (!user || !dataPath) {
      console.warn('Limpeza cancelada: usuário ou caminho de dados ausente.', { user: !!user, dataPath });
      return;
    }
    const collPath = `${dataPath}/${collName}`;
    setIsResetting(true);
    try {
      console.log(`Iniciando limpeza da coleção: ${collPath}`);
      const querySnapshot = await getDocs(collection(db, collPath));
      const docs = querySnapshot.docs;
      
      console.log(`Documentos encontrados para "${displayName}": ${docs.length}`);
      
      if (docs.length === 0) {
        console.warn(`Não há dados para limpar em "${displayName}".`);
        return;
      }
      
      console.log(`Deletando ${docs.length} documentos em lotes...`);
      for (let i = 0; i < docs.length; i += 500) {
        const chunk = docs.slice(i, i + 500);
        const batch = writeBatch(db);
        chunk.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`Lote ${Math.floor(i/500) + 1} concluído.`);
      }
      alert(`Dados de "${displayName}" limpos com sucesso!`);
    } catch (error) {
      console.error(`Erro ao limpar ${collName}:`, error);
      alert(`Erro ao limpar dados de "${displayName}". Verifique o console.`);
    } finally {
      setIsResetting(false);
    }
  };

  const deduplicateCollection = async (collName: string, data: any[], displayName: string) => {
    if (!data || data.length === 0) {
      alert(`Não há dados carregados no sistema para "${displayName}" para processar.`);
      return;
    }
    
    const confirmDeduplicate = window.confirm(`Deseja re-sincronizar os dados de "${displayName}"? Isso removerá duplicatas baseando-se nos identificadores únicos de cada registro.`);
    if (!confirmDeduplicate) return;

    setIsResetting(true);
    try {
      await saveBatch(collName, data);
      alert(`Sincronização de "${displayName}" concluída!`);
    } catch (error) {
      console.error(`Erro ao deduplicar ${collName}:`, error);
    } finally {
      setIsResetting(false);
    }
  };

  // Sync selected months when data is loaded
  React.useEffect(() => {
    if (availableMonths.length > 0) {
      setSelectedMonths(prev => {
        if (prev.length === 0) return availableMonths;
        const hasNewMonths = availableMonths.some(m => !prev.includes(m));
        if (hasNewMonths) return sortMonths(Array.from(new Set([...prev, ...availableMonths])));
        return prev;
      });
    }
  }, [availableMonths]);

  React.useEffect(() => {
    if (availableMonths.length > 0) {
      setSelectedMonthsCashflow(prev => {
        if (prev.length === 0) return availableMonths;
        const hasNewMonths = availableMonths.some(m => !prev.includes(m));
        if (hasNewMonths) return sortMonths(Array.from(new Set([...prev, ...availableMonths])));
        return prev;
      });
    }
  }, [availableMonths]);

  // Derived Stats
  const filteredSales = useMemo(() => 
    salesData.filter(s => selectedMonths.includes(s.mes)), 
  [salesData, selectedMonths]);

  const filteredPurchases = useMemo(() => 
    purchasesData.filter(p => {
      // Prioritize explicit 'mes' field if created by new logic
      if ('mes' in p && p.mes) return selectedMonths.includes(p.mes as string);
      
      // Fallback to p.data logic for legacy/imported records
      if (!p.data) return false;
      if (selectedMonths.includes(p.data)) return true;
      const normalized = normalizeMonth(p.data);
      return normalized && selectedMonths.includes(normalized);
    }), 
  [purchasesData, selectedMonths]);

  const filteredBankGeneral = useMemo(() => 
    bankData.filter(b => {
      if (selectedMonths.length === 0) return true;
      if (!b.data) return true;
      const normalized = normalizeMonth(b.data);
      return selectedMonths.includes(normalized);
    }), 
  [bankData, selectedMonths]);

  const filteredBankCashFlow = useMemo(() => 
    bankData.filter(b => {
      if (selectedMonthsCashflow.length === 0) return true;
      if (!b.data) return true;
      const normalized = normalizeMonth(b.data);
      return selectedMonthsCashflow.includes(normalized);
    }), 
  [bankData, selectedMonthsCashflow]);

  const filteredFinancial = useMemo(() => 
    financialData.filter(f => !f.mes || selectedMonths.includes(f.mes)), 
  [financialData, selectedMonths]);

  const filteredWaste = useMemo(() => {
    if (selectedMonths.length === 0) return wasteData;
    return wasteData.filter(w => {
      // Prioritiza o campo 'mes' explícito se disponível, caso contrário normaliza a partir de 'data'
      const monthToUse = w.mes || (w.data ? normalizeMonth(w.data) : '');
      return monthToUse && selectedMonths.includes(monthToUse);
    });
  }, [wasteData, selectedMonths]);

  const filteredStaffConsumption = useMemo(() => {
    if (selectedMonths.length === 0) return staffConsumptionData;
    return staffConsumptionData.filter(c => {
      const monthToUse = c.mes || (c.data ? normalizeMonth(c.data) : '');
      return monthToUse && selectedMonths.includes(monthToUse);
    });
  }, [staffConsumptionData, selectedMonths]);

  const filteredStaffPayments = useMemo(() => {
    if (selectedMonths.length === 0) return staffPaymentsData;
    return staffPaymentsData.filter(p => {
      const monthToUse = normalizeMonth(p.dataDeposito);
      return monthToUse && selectedMonths.includes(monthToUse);
    });
  }, [staffPaymentsData, selectedMonths]);

  const stats: MonthlyClosing = useMemo(() => {
    const vendasBrutas = filteredSales.reduce((sum, s) => sum + (Number(s.vendas) || 0), 0);
    const receitaLiquida = filteredFinancial
      .filter(f => f.tipo === 'Receita')
      .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

    const totalStaffPayments = filteredStaffPayments.reduce((sum, p) => sum + (Number(p.valorPago) || 0), 0);

    const descontos = Math.max(0, vendasBrutas - receitaLiquida);

    const normalizeStr = (str: string) => {
      if (!str) return '';
      return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    };

    const isInvestment = (f: any) => {
      const cls = normalizeStr(f.classificacao);
      const det = normalizeStr(f.detalhes);
      return cls.includes('investimento') || det.includes('investimento');
    };

    // CMV: Detalhes contém "mercadoria" (custo com fornecedor e frete) ou classificação cmv
    const cmv = filteredFinancial
      .filter(f => f.tipo === 'Despesa' && !isInvestment(f) && (normalizeStr(f.detalhes).includes('mercadoria') || normalizeStr(f.classificacao).includes('cmv')))
      .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

    const gastosFixos = filteredFinancial
      .filter(f => f.tipo === 'Despesa' && 
        !isInvestment(f) &&
        !(normalizeStr(f.detalhes).includes('mercadoria') || normalizeStr(f.classificacao).includes('cmv')) &&
        (normalizeStr(f.classificacao).includes('fixa') || normalizeStr(f.classificacao).includes('recorrente'))
      )
      .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);
      
    // GASTOS VARIÁVEIS inclui qualquer outra despesa que não seja mercantil e não seja fixa (garante partição completa)
    const gastosVariaveis = filteredFinancial
      .filter(f => f.tipo === 'Despesa' && 
        !isInvestment(f) &&
        !(normalizeStr(f.detalhes).includes('mercadoria') || normalizeStr(f.classificacao).includes('cmv')) &&
        !(normalizeStr(f.classificacao).includes('fixa') || normalizeStr(f.classificacao).includes('recorrente'))
      )
      .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

    const lBruto = receitaLiquida - cmv;
    const lLiquido = receitaLiquida - (cmv + gastosFixos + gastosVariaveis) + totalStaffPayments;
    // Margem de contribuição oficial desconta tanto CMV quanto despesas variáveis
    const mContribuicao = receitaLiquida > 0 ? ((receitaLiquida - cmv - gastosVariaveis) / receitaLiquida) * 100 : 0;

    const custoOcupacao = filteredFinancial
      .filter(f => f.tipo === 'Despesa' && !isInvestment(f) && (
        normalizeStr(f.detalhes).includes('ocupacao') || 
        normalizeStr(f.detalhes).includes('aluguel') || 
        normalizeStr(f.detalhes).includes('condominio') || 
        normalizeStr(f.classificacao).includes('ocupacao') || 
        normalizeStr(f.classificacao).includes('aluguel') || 
        normalizeStr(f.classificacao).includes('condominio')
      ))
      .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

    const custoPessoal = filteredFinancial
      .filter(f => f.tipo === 'Despesa' && !isInvestment(f) && (
        normalizeStr(f.detalhes).includes('pessoas') || 
        normalizeStr(f.detalhes).includes('pessoal') || 
        normalizeStr(f.detalhes).includes('equipe') || 
        normalizeStr(f.detalhes).includes('salario') || 
        normalizeStr(f.detalhes).includes('folha') || 
        normalizeStr(f.detalhes).includes('colaborador') || 
        normalizeStr(f.detalhes).includes('funcionario') || 
        normalizeStr(f.detalhes).includes('rh') ||
        normalizeStr(f.classificacao).includes('pessoas') || 
        normalizeStr(f.classificacao).includes('pessoal') || 
        normalizeStr(f.classificacao).includes('equipe') || 
        normalizeStr(f.classificacao).includes('salario') || 
        normalizeStr(f.classificacao).includes('folha') || 
        normalizeStr(f.classificacao).includes('colaborador') || 
        normalizeStr(f.classificacao).includes('funcionario') || 
        normalizeStr(f.classificacao).includes('rh')
      ))
      .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

    return {
      vendasBrutas,
      receitaLiquida,
      descontos,
      cmv,
      gastosFixos,
      gastosVariaveis,
      lucroBruto: lBruto,
      lucroLiquido: lLiquido,
      margemContribuicao: mContribuicao,
      custoOcupacao,
      custoPessoal,
      totalStaffPayments
    };
  }, [filteredSales, filteredFinancial, filteredStaffPayments, selectedMonths]);

  const evolutionData = useMemo(() => {
    const sorted = sortMonths(selectedMonths);
    const normalizeStr = (str: string) => {
      if (!str) return '';
      return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    };

    const isInvestment = (f: any) => {
      const cls = normalizeStr(f.classificacao);
      const det = normalizeStr(f.detalhes);
      return cls.includes('investimento') || det.includes('investimento');
    };

    return sorted.map(month => {
      const monthSales = salesData.filter(s => s.mes === month);
      const monthFinancial = financialData.filter(f => f.mes === month);
      
      const receitaLiquida = monthFinancial
        .filter(f => f.tipo === 'Receita')
        .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

      const totalStaffPayments = staffPaymentsData
        .filter(p => normalizeMonth(p.dataDeposito) === month)
        .reduce((sum, p) => sum + (Number(p.valorPago) || 0), 0);

      const cmv = monthFinancial
        .filter(f => f.tipo === 'Despesa' && !isInvestment(f) && (normalizeStr(f.detalhes).includes('mercadoria') || normalizeStr(f.classificacao).includes('cmv')))
        .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

      const gastosFixos = monthFinancial
        .filter(f => f.tipo === 'Despesa' && 
          !isInvestment(f) &&
          !(normalizeStr(f.detalhes).includes('mercadoria') || normalizeStr(f.classificacao).includes('cmv')) &&
          (normalizeStr(f.classificacao).includes('fixa') || normalizeStr(f.classificacao).includes('recorrente'))
        )
        .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);
        
      const gastosVariaveis = monthFinancial
        .filter(f => f.tipo === 'Despesa' && 
          !isInvestment(f) &&
          !(normalizeStr(f.detalhes).includes('mercadoria') || normalizeStr(f.classificacao).includes('cmv')) &&
          !(normalizeStr(f.classificacao).includes('fixa') || normalizeStr(f.classificacao).includes('recorrente'))
        )
        .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

      const lucroLiquido = receitaLiquida - (cmv + gastosFixos + gastosVariaveis) + totalStaffPayments;
      const margemContribuicao = receitaLiquida > 0 ? ((receitaLiquida - cmv - gastosVariaveis) / receitaLiquida) * 100 : 0;

      const custoOcupacao = monthFinancial
        .filter(f => f.tipo === 'Despesa' && !isInvestment(f) && (
          normalizeStr(f.detalhes).includes('ocupacao') || 
          normalizeStr(f.detalhes).includes('aluguel') || 
          normalizeStr(f.detalhes).includes('condominio') || 
          normalizeStr(f.classificacao).includes('ocupacao') || 
          normalizeStr(f.classificacao).includes('aluguel') || 
          normalizeStr(f.classificacao).includes('condominio')
        ))
        .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

      const custoPessoal = monthFinancial
        .filter(f => f.tipo === 'Despesa' && !isInvestment(f) && (
          normalizeStr(f.detalhes).includes('pessoas') || 
          normalizeStr(f.detalhes).includes('pessoal') || 
          normalizeStr(f.detalhes).includes('equipe') || 
          normalizeStr(f.detalhes).includes('salario') || 
          normalizeStr(f.detalhes).includes('folha') || 
          normalizeStr(f.detalhes).includes('colaborador') || 
          normalizeStr(f.detalhes).includes('funcionario') || 
          normalizeStr(f.detalhes).includes('rh') ||
          normalizeStr(f.classificacao).includes('pessoas') || 
          normalizeStr(f.classificacao).includes('pessoal') || 
          normalizeStr(f.classificacao).includes('equipe') || 
          normalizeStr(f.classificacao).includes('salario') || 
          normalizeStr(f.classificacao).includes('folha') || 
          normalizeStr(f.classificacao).includes('colaborador') || 
          normalizeStr(f.classificacao).includes('funcionario') || 
          normalizeStr(f.classificacao).includes('rh')
        ))
        .reduce((sum, f) => sum + (Number(f.valor) || 0), 0);

      return {
        month,
        receitaLiquida,
        lucroLiquido,
        cmv,
        gastosFixos,
        gastosVariaveis,
        margemContribuicao,
        custoOcupacao,
        custoPessoal,
        totalStaffPayments
      };
    });
  }, [salesData, financialData, staffPaymentsData, selectedMonths]);

  const hasAnyData = salesData.length > 0 || financialData.length > 0 || bankData.length > 0 || purchasesData.length > 0;



  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  // Se for atendente (acesso livre por padrão sem pedir e-mail), abre a tela de operação do quiosque
  if (isAttendant) {
    const isNormalUser = user && !user.isAnonymous;

    return (
      <div className="min-h-screen bg-slate-50 font-sans p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8 px-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <Cookie className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-900 leading-tight text-left">Mr. Cheney</h1>
                  <p className="text-xs text-slate-500 font-medium truncate">{user?.displayName || 'Atendimento (Quiosque)'}</p>
                </div>
             </div>
             
             <div className="flex items-center gap-2">
               <button 
                 onClick={() => setShowShareModal(true)} 
                 className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 rounded-xl transition-colors flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-sm"
                 title="Compartilhar / Conectar Celular ou Tablet do Quiosque"
               >
                 <QrCode className="w-4 h-4" />
                 <span className="hidden sm:inline">QR CODE / LINK</span>
               </button>
               <button 
                 onClick={() => { setShowPinInput(true); setAuthError(null); }} 
                 className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100/50 rounded-xl transition-colors flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-sm"
                 title="Acesso Gestão / Administrativo"
               >
                 <LogIn className="w-4 h-4" />
                 <span>ADMIN / GESTÃO</span>
               </button>
               {isNormalUser && (
                 <button 
                   onClick={handleSystemLogout} 
                   className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-2 text-xs font-black uppercase tracking-wider"
                   title="Sair da Conta"
                 >
                   <LogOut className="w-5 h-5" />
                   <span className="hidden sm:inline">SAIR</span>
                 </button>
               )}
             </div>
          </div>
          <div className="max-w-4xl mx-auto">
            <OperationHub 
              userId="shared_franquia_data" 
              onBack={handleSystemLogout} 
              wasteRecords={wasteData}
              staffConsumptions={staffConsumptionData}
              staffPayments={staffPaymentsData}
              purchaseRequests={purchaseRequestsData}
              userRole={userRole}
              salesData={salesData}
              staffDiscountOverrides={staffDiscountOverrides}
              stockData={stockData}
              recipes={recipesData}
              purchases={purchasesData}
              selectedMonths={selectedMonths}
            />
          </div>
        </div>

        <AnimatePresence>
          {showPinInput && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-center shadow-2xl"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white p-8 rounded-[2rem] max-w-sm w-full border border-white"
              >
                <h3 className="text-xl font-bold text-slate-900 mb-2">Área Administrativa</h3>
                <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">Digite o PIN "2024" ou entre com uma Conta Google autorizada.</p>
                
                {authError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-bold uppercase tracking-wider leading-relaxed">
                    {authError}
                  </div>
                )}

                <input 
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full text-center text-3xl font-black tracking-[1em] p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-blue-500 transition-all mb-4"
                />
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => { setShowPinInput(false); setPin(''); setAuthError(null); }}
                      className="py-3 px-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest border border-slate-100 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => {
                        if (pin === '2024') { // PIN DE GESTAO
                          setIsGiseleMode(true);
                          localStorage.setItem('gisele_mode', 'true');
                          setShowPinInput(false);
                          setPin('');
                          setAuthError(null);
                          // Force anon login if needed
                          if (!auth.currentUser) {
                            signInAnonymously(auth).catch(e => {
                              console.error(e);
                              if (e.code === 'auth/admin-restricted-operation') {
                                setAuthError('A Autenticação Anônima está desativada no Firebase. Ative-a no console.');
                              } else {
                                setAuthError(`Erro de autenticação: ${e.message}`);
                              }
                            });
                          }
                        } else {
                          setAuthError('Senha PIN incorreta para acesso Gestão.');
                          setPin('');
                        }
                      }}
                      className="py-3 px-4 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100"
                    >
                      Entrar PIN
                    </button>
                  </div>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-100"></div>
                    <span className="flex-shrink mx-4 text-slate-300 text-[8px] font-black uppercase tracking-widest">ou</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                  </div>

                  <button 
                    disabled={isLoggingIn}
                    onClick={async () => {
                      try {
                        await handleLogin();
                        setShowPinInput(false);
                      } catch (err) {
                        // error is handled inside handleLogin
                      }
                    }}
                    className={`w-full text-slate-700 py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider ${
                      isLoggingIn ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isLoggingIn ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                        <span>Entrando...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Administrador (Google)</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ShareKioskModal 
          isOpen={showShareModal} 
          onClose={() => setShowShareModal(false)} 
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans relative">
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-6 right-6 z-50">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-3 bg-white shadow-xl shadow-blue-100 rounded-2xl border border-white text-slate-900"
        >
          {isSidebarOpen ? <LogOut className="w-6 h-6 rotate-90" /> : <LayoutDashboard className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-40 transition-transform duration-300 ease-in-out lg:translate-x-0",
        isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        <div className="p-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Cookie className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-slate-900 leading-tight truncate">Mr. Cheney</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-tight truncate">
                {isGiseleMode ? 'Modo Gestão' : (user?.displayName || 'Gestor')}
              </p>
              {user && user.email && (
                <p className="text-[9px] text-slate-400 truncate max-w-[150px] leading-tight mt-0.5">
                  {user.email}
                </p>
              )}
              {user && userRole !== 'admin' && !isGiseleMode && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black uppercase rounded-md border border-slate-200">
                    Equipe
                  </span>
                  <button 
                    onClick={handleSystemLogout}
                    className="text-[8px] font-black text-blue-600 uppercase hover:underline"
                  >
                    Trocar Conta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          <button
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
              activeTab === 'dashboard' 
                ? "bg-blue-50 text-blue-600 shadow-sm shadow-blue-100" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <LayoutDashboard className={cn("w-5 h-5", activeTab === 'dashboard' ? "text-blue-600" : "text-slate-400 group-hover:text-slate-900")} />
            Dashboard Geral
            {activeTab === 'dashboard' && <ChevronRight className="w-4 h-4 ml-auto" />}
          </button>

          <button
            onClick={() => { setActiveTab('indicators'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
              activeTab === 'indicators' 
                ? "bg-blue-50 text-blue-600 shadow-sm shadow-blue-100" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <TrendingUp className={cn("w-5 h-5", activeTab === 'indicators' ? "text-blue-600" : "text-slate-400 group-hover:text-slate-900")} />
            Indicadores
            {activeTab === 'indicators' && <ChevronRight className="w-4 h-4 ml-auto" />}
          </button>

          <button
            onClick={() => { setActiveTab('inventory'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
              activeTab === 'inventory' 
                ? "bg-blue-50 text-blue-600 shadow-sm shadow-blue-100" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Package className={cn("w-5 h-5", activeTab === 'inventory' ? "text-blue-600" : "text-slate-400 group-hover:text-slate-900")} />
            Estoque
            {activeTab === 'inventory' && <ChevronRight className="w-4 h-4 ml-auto" />}
          </button>

          <button
            onClick={() => { setActiveTab('cashflow'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
              activeTab === 'cashflow' 
                ? "bg-blue-50 text-blue-600 shadow-sm shadow-blue-100" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Wallet className={cn("w-5 h-5", activeTab === 'cashflow' ? "text-blue-600" : "text-slate-400 group-hover:text-slate-900")} />
            Fluxo de Caixa
            {activeTab === 'cashflow' && <ChevronRight className="w-4 h-4 ml-auto" />}
          </button>

          {(!isGiseleMode || userRole === 'admin') && (
            <button
              onClick={() => { setActiveTab('waste'); setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                activeTab === 'waste' 
                  ? "bg-rose-50 text-rose-600 shadow-sm shadow-rose-100" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <RefreshCw className={cn("w-5 h-5", activeTab === 'waste' ? "text-rose-600" : "text-slate-400 group-hover:text-slate-900")} />
              Operação
              {activeTab === 'waste' && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          )}

          <div className="pt-8 space-y-2">
            {userRole === 'admin' && (
              <button
                onClick={() => { setActiveTab('upload'); setIsSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                  activeTab === 'upload' 
                    ? "bg-blue-50 text-blue-600 shadow-sm shadow-blue-100" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <UploadIcon className={cn("w-5 h-5", activeTab === 'upload' ? "text-blue-600" : "text-slate-400 group-hover:text-slate-900")} />
                Importar Dados
                {activeTab === 'upload' && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            )}

            {userRole === 'admin' && (
              <button
                onClick={() => { setActiveTab('logs'); setIsSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                  activeTab === 'logs' 
                    ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Database className={cn("w-5 h-5", activeTab === 'logs' ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-900")} />
                Auditoria de Logs
                {activeTab === 'logs' && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            )}

            <button
              onClick={() => { setShowShareModal(true); setIsSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all group bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/70 shadow-xs"
            >
              <QrCode className="w-4 h-4 text-amber-600" />
              Link Quiosque (QR Code)
            </button>

            <div className="flex items-center gap-3 px-4 py-3 text-xs text-blue-600 font-black uppercase tracking-widest bg-slate-50/50 rounded-xl">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              Dados Sincronizados
            </div>
          </div>
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">
            <Settings className="w-4 h-4" /> Configurações
          </button>
          <button 
            onClick={handleSystemLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 rounded-lg transition-colors mt-2"
          >
            <LogOut className="w-4 h-4" /> Sair do Painel
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 flex-1 p-4 md:p-10 min-h-screen">
        {syncError && (
          <div className="mb-8 p-5 bg-rose-50 border border-rose-200 rounded-[2rem] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0 mt-0.5 md:mt-0 border border-rose-200 shadow-sm">
                <WifiOff className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-rose-900 text-sm">Problema ao Sincronizar dados do Banco</h4>
                <p className="text-xs text-rose-700/90 mt-1 leading-relaxed">
                  Por favor, verifique a mensagem do Firebase: <code className="bg-rose-100/60 px-1 py-0.5 rounded font-mono text-[11px] text-rose-800">{syncError}</code>.
                  <br />
                  <span className="font-bold">Dica importante:</span> Se estiver usando a visualização integrada do AI Studio, restrições do navegador podem bloquear conexões externas em iFrames. Clique em <span className="underline font-bold">"Open in a new tab"</span> (Abrir em nova aba) no painel de visualização para resolver isto!
                </p>
              </div>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shrink-0 uppercase tracking-widest cursor-pointer shadow-md"
            >
              Recarregar Sistema
            </button>
          </div>
        )}

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 mt-12 lg:mt-0">
          <div>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                  {activeTab === 'dashboard' ? 'Resultados Mensais' : 
                   activeTab === 'cashflow' ? 'Fluxo de Caixa' : 
                   activeTab === 'indicators' ? 'Performance Estratégica' :
                   activeTab === 'inventory' ? 'Gestão de Insumos' :
                   activeTab === 'waste' ? 'Gestão do Quiosque' :
                   'Importação de Dados'}
                </h2>
                { (activeTab === 'indicators' || activeTab === 'inventory') && (
                  <button 
                    onClick={() => recalculateAllStock()}
                    disabled={isResetting}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all font-black text-[9px] uppercase tracking-widest border border-emerald-100 disabled:opacity-50 mt-1 md:mt-0"
                    title="Recalcular todo o estoque baseando-se no histórico total de compras, vendas, perdas e consumo"
                  >
                    <RefreshCw className={cn("w-3 h-3", isResetting && "animate-spin")} />
                    Recalcular Estoque
                  </button>
                )}
              </div>
              <p className="text-slate-500 mt-1 text-sm md:text-base">
                Olá, {isGiseleMode ? 'Gestão' : (user?.displayName?.split(' ')[0] || 'Gestor')}. {
                  activeTab === 'dashboard' ? 'Visualize sua saúde financeira.' : 
                  activeTab === 'cashflow' ? 'Movimentações em tempo real.' : 
                  activeTab === 'indicators' ? 'Análise profunda do negócio.' :
                  activeTab === 'inventory' ? 'Acompanhamento do fluxo de insumos.' :
                  activeTab === 'waste' ? 'Gestão do Quiosque.' :
                  'Importe novos dados.'
                }
              </p>
          </div>
          
          {(activeTab !== 'waste' && activeTab !== 'upload') && (
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-white pl-2 pr-1 py-1 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
                <div className="p-2 bg-blue-50 rounded-xl hidden sm:block">
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <MultiSelect 
                    options={availableMonths} 
                    selected={activeTab === 'cashflow' ? selectedMonthsCashflow : selectedMonths} 
                    onChange={activeTab === 'cashflow' ? setSelectedMonthsCashflow : setSelectedMonths} 
                    placeholder={availableMonths.length > 0 ? "Selecionar Períodos" : "Sem períodos disponíveis"}
                  />
                </div>
              </div>
            </div>
          )}
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {hasAnyData ? (
                  <Dashboard 
                    stats={stats} 
                    sales={filteredSales} 
                    purchases={purchasesData} 
                    bank={filteredBankGeneral} 
                    stock={stockData} 
                    financial={filteredFinancial}
                    wasteRecords={filteredWaste}
                    staffConsumptions={staffConsumptionData}
                    staffPayments={staffPaymentsData}
                    userRole={userRole}
                    recipes={recipesData}
                    allSales={salesData}
                    selectedMonths={selectedMonths}
                  />
              ) : (
                <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center">
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-6">
                    <AlertCircle className="w-12 h-12" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Sem dados importados</h3>
                  <p className="text-slate-500 mt-2 max-w-sm">
                    Para visualizar seu dashboard e indicadores, você precisa primeiro importar seus arquivos CSV.
                  </p>
                  {userRole === 'admin' && (
                    <button 
                      onClick={() => setActiveTab('upload')}
                      className="mt-8 bg-blue-600 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                      Ir para Importação
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'inventory' ? (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <InventoryDashboard 
                dataPath={dataPath!} 
                salesData={filteredSales}
                purchasesData={filteredPurchases}
                wasteData={filteredWaste}
                staffConsumptionData={filteredStaffConsumption}
                stockData={stockData}
                financialData={filteredFinancial}
                saveBatch={saveBatch}
              />
            </motion.div>
          ) : activeTab === 'indicators' ? (
            <motion.div
              key="indicators"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {hasAnyData ? (
                <Indicators stats={stats} evolutionData={evolutionData} />
              ) : (
                <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-6">
                    <AlertCircle className="w-12 h-12" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Dados insuficientes</h3>
                  <p className="text-slate-500 mt-2 max-w-sm">
                    Importe seus dados para desbloquear a análise de indicadores estratégicos.
                  </p>
                </div>
              )}
            </motion.div>
          ) : activeTab === 'cashflow' ? (
            <motion.div
              key="cashflow"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <CashFlow 
                bank={filteredBankCashFlow} 
                financial={financialData}
                dataPath={dataPath || "users/shared_franquia_data"}
              />
            </motion.div>
          ) : activeTab === 'waste' ? (
            <motion.div
              key="waste"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <OperationHub 
                userId="shared_franquia_data" 
                onBack={() => setActiveTab('dashboard')} 
                wasteRecords={wasteData}
                staffConsumptions={staffConsumptionData}
                staffPayments={staffPaymentsData}
                purchaseRequests={purchaseRequestsData}
                userRole={userRole}
                salesData={salesData}
                stockData={stockData}
                recipes={recipesData}
                purchases={purchasesData}
                staffDiscountOverrides={staffDiscountOverrides}
                selectedMonths={selectedMonths}
              />
            </motion.div>
          ) : (activeTab === 'upload' && userRole === 'admin') ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              <CSVUpload 
                title="Vendas Realizadas" 
                onDataLoaded={(data) => {
                  const occurrences: Record<string, number> = {};
                  const mapped = data.map((row: any) => {
                    const rawMonth = getCSVVal(row, ['Mês', 'mes', 'Mes', 'Periodo', 'Mês/Ano']);
                    const rawYear = getCSVVal(row, ['Ano', 'ano', 'Exercício']);
                    const rawDate = getCSVVal(row, ['Data', 'Data Venda', 'Venda em', 'data']);
                    
                    let mes = '';
                    if (rawMonth && rawYear && !rawMonth.includes('/')) {
                      mes = normalizeMonth(`${rawMonth}/${rawYear}`);
                    } else {
                      mes = normalizeMonth(rawMonth || rawDate);
                    }

                    const rawDateNormalized = rawDate ? normalizeDayDate(rawDate) : '';
                    const nome = getCSVVal(row, ['Nome', 'nome', 'Produto', 'Item']);
                    const quantidade = parseCSVAmount(getCSVVal(row, ['quantidade', 'Quantidade', 'Qtd', 'Qtde']));
                    const vendas = parseCSVAmount(getCSVVal(row, ['vendas', 'Vendas', 'valor', 'Total', 'Preço Total']));

                    const key = `${mes}_${rawDateNormalized}_${nome}_${quantidade}_${vendas}`.toLowerCase().trim();
                    occurrences[key] = (occurrences[key] || 0) + 1;
                    const seq = occurrences[key];

                    const origemVal = getCSVVal(row, ['Origem', 'origem', 'tipoEntrega', 'tipo_entrega', 'Tipo Entrega', 'Canal', 'canal', 'Origem da Venda', 'Tipo']) || 'Balcão';

                    return {
                      mes,
                      data: rawDateNormalized,
                      nome,
                      quantidade,
                      vendas,
                      categoria: getCSVVal(row, ['Categoria', 'categoria', 'Grupo']) || 'Geral',
                      seq,
                      origem: origemVal,
                      tipoEntrega: origemVal,
                    };
                  }).filter(item => item.mes && item.nome);
                  if (mapped.length > 0) saveBatch('sales', mapped);
                }}
                onReset={() => clearCollection('sales', 'Vendas Realizadas')}
                onRemoveDuplicates={() => deduplicateCollection('sales', salesData, 'Vendas Realizadas')}
                hasData={salesData.length > 0}
                isLoading={isResetting}
              />
              <CSVUpload 
                title="Gestão de Fluxo" 
                onDataLoaded={(data) => {
                  const mapped = data.map((row: any) => {
                    const tipoRaw = getCSVVal(row, ['Tipo', 'tipo']).toLowerCase();
                    const tipo = (tipoRaw.includes('receita') || tipoRaw.startsWith('e')) ? 'Receita' : 'Despesa';
                    const classificacaoRaw = getCSVVal(row, ['Classificação', 'Classificacao', 'classificacao', 'Categoria', 'Grupo']);
                    let classificacao = classificacaoRaw || 'Geral';
                    
                    // Normalização para os 3 grandes grupos se encontrados no texto
                    const lowerCl = classificacao.toLowerCase();
                    if (lowerCl.includes('investimento')) classificacao = 'Investimento';
                    else if (lowerCl.includes('recorrente') || lowerCl.includes('fixo')) classificacao = 'Custo Recorrente';
                    else if (lowerCl.includes('variável') || lowerCl.includes('variavel')) classificacao = 'Custo Variável';

                    return {
                      mes: normalizeMonth(getCSVVal(row, ['Mês', 'mes', 'Mes', 'Periodo']) || getCSVVal(row, ['Data', 'data'])),
                      valor: parseCSVAmount(getCSVVal(row, ['Valor', 'valor', 'Montante'])),
                      tipo: tipo as any,
                      classificacao: classificacao,
                      detalhes: getCSVVal(row, ['Detalhes', 'detalhes', 'Razão Social']),
                      observacoes: getCSVVal(row, ['Observações', 'observacoes', 'Obs'])
                    };
                  }).filter(i => i.mes && i.valor !== 0);
                  if (mapped.length > 0) saveBatch('financialRecords', mapped);
                }}
                onReset={() => clearCollection('financialRecords', 'Gestão de Fluxo')}
                onRemoveDuplicates={() => deduplicateCollection('financialRecords', financialData, 'Gestão de Fluxo')}
                hasData={financialData.length > 0}
                isLoading={isResetting}
              />
              <CSVUpload 
                title="Compras e Insumos" 
                onDataLoaded={(data) => {
                  const occurrences: Record<string, number> = {};
                  const mapped = data.map((row: any) => {
                    const rawDate = getCSVVal(row, ['Data', 'data', 'Data da Compra', 'Dia']);
                    const rawMonth = getCSVVal(row, ['Mês', 'mes', 'Mes', 'Periodo']);
                    const rawYear = getCSVVal(row, ['Ano', 'ano']);

                    let mes = '';
                    if (rawMonth && rawYear && !rawMonth.includes('/')) {
                      mes = normalizeMonth(`${rawMonth}/${rawYear}`);
                    } else {
                      mes = normalizeMonth(rawMonth || rawDate);
                    }

                    const finalDate = rawDate ? normalizeDayDate(rawDate) : (mes || '');
                    const fornecedor = getCSVVal(row, ['fornecedor', 'Fornecedor', 'Supplier', 'supplier', 'fornecedores', 'Fornecedores']).trim();
                    const rawProduto = getCSVVal(row, ['Produto', 'produto', 'Nome', 'Item', 'Macroingrediente', 'macroingrediente', 'Insumo', 'insumo']);
                    const produto = rawProduto.trim().toLowerCase() === 'torta bottega' ? 'Tortas Bottega' : rawProduto;
                    const quantidade = parseCSVAmount(getCSVVal(row, ['quantidade', 'Quantidade', 'Qtd', 'Qtd.']));
                    const total = parseCSVAmount(getCSVVal(row, ['total', 'Total', 'Valor Total', 'valor total', 'ValorTotal', 'valortotal']));
                    
                    const rawCusto = parseCSVAmount(getCSVVal(row, ['custo', 'Custo Unitário', 'Preço', 'custoUnitario', 'CustoUnitario']));
                    const custoUnitario = rawCusto || (quantidade > 0 ? (total / quantidade) : 0);

                    const key = `${finalDate}_${fornecedor}_${produto}_${quantidade}_${total}`.toLowerCase().trim();
                    occurrences[key] = (occurrences[key] || 0) + 1;
                    const seq = occurrences[key];

                    return {
                      data: finalDate,
                      mes: mes,
                      produto,
                      quantidade,
                      custoUnitario,
                      total,
                      fornecedor: fornecedor || 'Sem Fornecedor',
                      seq,
                    };
                  }).filter(i => i.produto && i.total > 0);
                  if (mapped.length > 0) {
                    setPurchaseReviewItems(mapped);
                  }
                }}
                onReset={() => clearCollection('purchases', 'Compras e Insumos')}
                onRemoveDuplicates={() => deduplicateCollection('purchases', purchasesData, 'Compras e Insumos')}
                hasData={purchasesData.length > 0}
                isLoading={isResetting}
              />
              <CSVUpload 
                title="Extrato Bancário" 
                accept=".txt,.csv,.txt;text/plain;text/csv"
                onDataLoaded={(data) => {
                  const occurrences: Record<string, number> = {};
                  const mapped = data.map((row: any) => {
                    let line = row.raw;
                    if (!line && typeof row === 'object') {
                      const values = Object.values(row);
                      if (values.length === 1 && typeof values[0] === 'string' && values[0].includes(';')) line = values[0];
                    }
                    if (line) {
                      const trimmedLine = line.trim();
                      const lowerLine = trimmedLine.toLowerCase();
                      if (!trimmedLine || lowerLine.includes('saldo') || lowerLine.includes('disponível') || lowerLine.includes('disponivel') || lowerLine.includes('anterior')) return null;
                      let parts = trimmedLine.split(';').map(p => p.trim()).filter(p => p.length > 0);
                      if (parts.length >= 3) {
                        const rawData = normalizeDayDate(parts[0]); 
                        const rawValor = parts[parts.length - 1];
                        const descricao = parts.slice(1, parts.length - 1).join('; '); 
                        const valorNum = parseCSVAmount(rawValor);
                        return { data: rawData, descricao: descricao, categoria: 'Outros' as any, valor: Math.abs(valorNum), tipo: valorNum >= 0 ? 'Entrada' : 'Saída' as any };
                      }
                      return null;
                    }
                    const valCSV = parseCSVAmount(getCSVVal(row, ['Valor', 'valor', 'Montante']));
                    return { data: normalizeDayDate(getCSVVal(row, ['Data', 'data', 'Transação', 'Dia'])), descricao: getCSVVal(row, ['Razão Social', 'Razão', 'Descrição', 'descricao', 'Historico', 'Detalhes']), categoria: 'Fixa' as any, valor: Math.abs(valCSV), tipo: valCSV >= 0 ? 'Entrada' : 'Saída' as any };
                  }).filter((i): i is any => {
                    if (!i || i.valor === 0) return false;
                    const descLower = (i.descricao || '').toLowerCase();
                    if (
                      descLower.includes('saldo') ||
                      descLower.includes('disponível') ||
                      descLower.includes('disponivel') ||
                      descLower.includes('anterior')
                    ) return false;
                    return true;
                  }).map((item) => {
                    const key = `${item.data}_${item.descricao}_${item.valor}_${item.tipo}`.toLowerCase().trim();
                    occurrences[key] = (occurrences[key] || 0) + 1;
                    return { ...item, seq: occurrences[key] };
                  });
                  if (mapped.length > 0) saveBatch('bankTransactions', mapped);
                }}
                onReset={() => clearCollection('bankTransactions', 'Extrato Bancário')}
                onRemoveDuplicates={() => deduplicateCollection('bankTransactions', bankData, 'Extrato Bancário')}
                hasData={bankData.length > 0}
                isLoading={isResetting}
              />
              <CSVUpload 
                title="Controle de Estoque" 
                onDataLoaded={(data) => {
                  const mapped = data.map((row: any) => ({
                    produto: getCSVVal(row, ['Produto', 'produto', 'Nome']),
                    estoqueAtual: parseCSVAmount(getCSVVal(row, ['Estoque', 'Estoque Atual', 'Qtd'])),
                    custoUnitario: parseCSVAmount(getCSVVal(row, ['Custo', 'Custo Unitário'])),
                    valorTotal: parseCSVAmount(getCSVVal(row, ['Total', 'Valor Total']))
                  })).filter(i => i.produto);
                  if (mapped.length > 0) saveBatch('stock', mapped);
                }}
                onReset={() => clearCollection('stock', 'Controle de Estoque')}
                onRemoveDuplicates={() => deduplicateCollection('stock', stockData, 'Controle de Estoque')}
                hasData={stockData.length > 0}
                isLoading={isResetting}
              />
              <CSVUpload 
                title="Consumo Funcionários" 
                onDataLoaded={(data) => {
                  const occurrences: Record<string, number> = {};
                  const mapped = data.map((row: any) => {
                    const valorCheio = parseCSVAmount(getCSVVal(row, ['valorCheio', 'Valor Cheio', 'Preço Unitário', 'Valor Bruto', 'Valor']));
                    const rawValorPago = parseCSVAmount(getCSVVal(row, ['valorPago', 'Valor Pago', 'Total Pago', 'Pago']));
                    const rawDesconto = parseCSVAmount(getCSVVal(row, ['desconto', 'Desconto %', '% Desconto', 'Desconto']));
                    
                    let valorPago = rawValorPago;
                    let desconto = rawDesconto;

                    if (valorCheio > 0 && valorPago === 0 && rawDesconto > 0) {
                      valorPago = valorCheio * (1 - (rawDesconto / 100));
                    } else if (valorCheio > 0 && valorPago > 0) {
                      desconto = ((valorCheio - valorPago) / valorCheio) * 100;
                    }

                    const rawDate = getCSVVal(row, ['Data', 'data', 'Dia']);
                    const rawMonth = getCSVVal(row, ['Mês', 'mes', 'Mes', 'Periodo']);
                    const rawYear = getCSVVal(row, ['Ano', 'ano']);

                    let mes = '';
                    if (rawMonth && rawYear && !rawMonth.includes('/')) {
                      mes = normalizeMonth(`${rawMonth}/${rawYear}`);
                    } else {
                      mes = normalizeMonth(rawMonth || rawDate);
                    }
                    
                    const finalDate = rawDate ? normalizeDayDate(rawDate) : (mes ? `01/${mes}` : '');
                    const funcionario = getCSVVal(row, ['Funcionário', 'Funcionario', 'funcionario', 'Nome']);
                    const produto = getCSVVal(row, ['Produto', 'produto', 'Item']);

                    const key = `${funcionario}_${finalDate}_${produto}_${valorPago}`.toLowerCase().trim();
                    occurrences[key] = (occurrences[key] || 0) + 1;
                    const seq = occurrences[key];

                    return {
                      data: finalDate,
                      mes: mes,
                      funcionario,
                      produto,
                      valorCheio: valorCheio,
                      descontoPercent: Math.round(desconto),
                      valorPago: valorPago,
                      status: 'pendente',
                      seq,
                    };
                  }).filter(i => (i.data || i.mes) && i.funcionario && i.produto);
                  if (mapped.length > 0) saveBatch('staffConsumption', mapped);
                }}
                onReset={() => clearCollection('staffConsumption', 'Consumo Funcionários')}
                onRemoveDuplicates={() => deduplicateCollection('staffConsumption', staffConsumptionData, 'Consumo Funcionários')}
                hasData={staffConsumptionData.length > 0}
                isLoading={isResetting}
              />
              <CSVUpload 
                title="Desperdício e Reuso" 
                onDataLoaded={(data) => {
                  const occurrences: Record<string, number> = {};
                  const mapped = data.map((row: any) => {
                    const rawDate = getCSVVal(row, ['Data', 'data', 'Dia', 'DATA', 'Data do Registro', 'Data Ocorrência', 'Data Ocorrencia', 'Data Lançamento', 'Data Lancamento', 'Data Reg', 'Data Lanç.', 'Data Lanc.', 'Registro', 'Criado em', 'Data Lcto']);
                    const rawMonth = getCSVVal(row, ['Mês', 'mes', 'Mes', 'Periodo', 'Mês/Ano', 'Mes/Ano', 'Período', 'Referência', 'Referencia']);
                    const rawYear = getCSVVal(row, ['Ano', 'ano', 'Exercício', 'Exercicio']);

                    let mes = '';
                    if (rawMonth && rawYear && !rawMonth.includes('/')) {
                      mes = normalizeMonth(`${rawMonth}/${rawYear}`);
                    } else {
                      mes = normalizeMonth(rawMonth || rawDate);
                    }

                    const rawAction = getCSVVal(row, ['acao', 'Ação', 'açao', 'Tipo', 'AÇÃO', 'Destino', 'Operação', 'Operacao', 'Destinação', 'Destinacao', 'Ação Tomada', 'Acao Tomada', 'Status', 'fluxo', 'Tipo de Registro', 'Movimento', 'Categoria', 'Grupo']);
                    const normAction = rawAction.toLowerCase();
                    const isReuso = 
                      normAction.includes('reuso') || 
                      normAction.includes('reutil') || 
                      normAction.includes('reaproveit') || 
                      normAction.includes('reus') || 
                      normAction.includes('doac') || 
                      normAction.includes('doaç');
                    const action = isReuso ? 'Reuso' : 'Descarte';
                    
                    const finalDate = rawDate ? normalizeDayDate(rawDate) : (mes ? `01/${mes}` : '');

                    const rawReason = (getCSVVal(row, ['motivo', 'Motivo', 'motivo', 'MOTIVO', 'Observação', 'Obs', 'Observacao', 'Justificativa', 'Razão', 'Razao', 'Descrição do Motivo', 'Descricao do Motivo']) || '').toLowerCase().trim();
                    let motivo = rawReason || 'qualidade';
                    
                    const produto = getCSVVal(row, ['Produto', 'produto', 'Item', 'Nome', 'PRODUTO', 'Insumo', 'insumo', 'Ingrediente', 'ingrediente', 'Mercadoria', 'Material', 'Descrição', 'Descricao', 'Descrição do Item', 'Descricao do Item', 'Nome do Produto', 'Nome Item', 'Alimento']);
                    const rawQtyVal = getCSVVal(row, ['quantidade', 'Quantidade', 'Qtd', 'Qtde', 'QTD', 'Qt', 'Vol', 'Volume', 'Unidades', 'Peso', 'Qtd.', 'Qtde.']);
                    let quantidade = parseCSVAmount(rawQtyVal);
                    if (!quantidade || quantidade <= 0) {
                      quantidade = 1;
                    }
                    const responsavel = getCSVVal(row, ['RESPONSÁVEL', 'Responsável', 'Responsavel', 'RESP.', 'Funcionario', 'Resp', 'funcionario', 'Quem lançou', 'Colaborador', 'Usuário', 'Usuario', 'Quem lancou', 'Operador', 'Assinatura', 'Nome Funcionario', 'Nome Funcionário']);

                    const key = `${finalDate}_${produto}_${quantidade}_${responsavel}_${action}`.toLowerCase().trim();
                    occurrences[key] = (occurrences[key] || 0) + 1;
                    const seq = occurrences[key];

                    return {
                      data: finalDate,
                      mes: mes,
                      produto,
                      quantidade,
                      responsavel,
                      acao: action,
                      motivo,
                      seq,
                      createdAt: serverTimestamp()
                    };
                  }).filter(i => (i.data || i.mes) && i.produto && i.quantidade > 0);
                  if (mapped.length > 0) saveBatch('wasteRecords', mapped);
                }}
                onReset={() => clearCollection('wasteRecords', 'Desperdício e Reuso')}
                onRemoveDuplicates={() => deduplicateCollection('wasteRecords', wasteData, 'Desperdício e Reuso')}
                hasData={wasteData.length > 0}
                isLoading={isResetting}
              />

              {/* Seção de Backup Completo com Download ZIP Local */}
              <div className="md:col-span-2 mt-8 p-8 bg-linear-to-br from-slate-50 to-blue-50/20 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
                    <Cloud className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Backup Mensal Completo (Download ZIP)</h3>
                    <p className="text-sm text-slate-500 max-w-xl mt-1 leading-relaxed">
                      Gere e baixe um arquivo compactado `.zip` contendo os dados de todas as 10 planilhas em formato CSV e todo o código fonte atualizado do sistema. Depois, basta salvar o arquivo baixado diretamente na sua pasta compartilhada do Google Drive.
                    </p>
                    <p className="text-xs text-slate-400 font-mono mt-2 flex items-center gap-1">
                      Pasta de Destino para Upload Manual: <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-semibold text-slate-600 select-all">1qwRegYNrZyKcbvwEOV3DjEntKl9ZPi4l</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto shrink-0">
                  <button
                    onClick={() => {
                      const date = new Date();
                      const defaultName = `backup_sistema_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}_${String(date.getDate()).padStart(2, '0')}`;
                      setBackupFileName(defaultName);
                      setBackupError(null);
                      setBackupStatus('');
                      setShowBackupModal(true);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white font-bold px-8 py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-md cursor-pointer"
                  >
                    <Cloud className="w-5 h-5" />
                    Gerar e Baixar ZIP
                  </button>
                </div>
              </div>
              
              {hasAnyData && (
                <div className="md:col-span-2 mt-8 flex flex-col items-center gap-4">
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 group"
                  >
                    Ver Resultado das Análises
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}
            </motion.div>
          ) : (activeTab === 'logs' && userRole === 'admin') ? (
            <motion.div
              key="logs"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <LogCenter isAdmin={userRole === 'admin'} onBack={() => setActiveTab('dashboard')} />
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-slate-100 text-center">
              <p className="text-slate-500 font-medium">Selecione uma opção disponível no menu lateral.</p>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal de confirmação e progresso do Backup */}
      <AnimatePresence>
        {showBackupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!isBackingUp) setShowBackupModal(false); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            
            {/* Modal Body */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 overflow-hidden z-10"
            >
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Salvar Backup do Sistema</h3>
              <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                Digite um nome personalizado para o seu arquivo compactado de backup. Ele será salvo na pasta compartilhada do Google Drive em formato `.zip`.
              </p>

              {/* Error Alert */}
              {backupError && (
                <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs font-semibold text-rose-700 leading-normal">
                    {backupError}
                  </div>
                </div>
              )}

              {/* Main Actions / Status */}
              {!isBackingUp && backupStatus.includes('sucesso') ? (
                /* Success screen */
                <div className="my-6 py-6 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-md font-bold text-slate-800">Backup Concluído!</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
                    {backupStatus}
                  </p>
                  <button
                    onClick={() => setShowBackupModal(false)}
                    className="mt-6 w-full bg-slate-950 text-white font-bold py-3 px-4 rounded-xl hover:bg-slate-850 transition-all font-mono text-sm leading-none cursor-pointer"
                  >
                    Fechar Janela
                  </button>
                </div>
              ) : isBackingUp ? (
                /* Loading screen */
                <div className="my-6 py-4 flex flex-col items-center text-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <h4 className="text-sm font-bold text-slate-800">Processando Backup</h4>
                  <p className="text-xs text-blue-600 font-medium font-mono max-w-sm mt-2 animate-pulse leading-normal">
                    {backupStatus}
                  </p>
                </div>
              ) : (
                /* Interactive Input Screen */
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">Nome do Arquivo ZIP</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={backupFileName}
                        onChange={(e) => setBackupFileName(e.target.value)}
                        placeholder="Ex: backup_maio_2026"
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-mono font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition-all placeholder-slate-400"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-450 font-mono text-xs font-bold">
                        .zip
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowBackupModal(false)}
                      className="flex-1 bg-slate-100 text-slate-705 font-bold py-3.5 px-4 rounded-2xl hover:bg-slate-200 transition-all text-sm cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecuteBackup(backupFileName)}
                      className="flex-1 bg-blue-600 text-white font-bold py-3.5 px-4 rounded-2xl hover:bg-blue-700 shadow-md shadow-blue-100 transition-all text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Salvar no Drive
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PurchaseReviewModal
        isOpen={purchaseReviewItems !== null}
        items={purchaseReviewItems || []}
        onCancel={() => setPurchaseReviewItems(null)}
        onConfirm={async (finalItems) => {
          setPurchaseReviewItems(null);
          await saveBatch('purchases', finalItems);
        }}
      />

      <ShareKioskModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)} 
      />
    </div>
  );
}
