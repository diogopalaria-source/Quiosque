import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Search, 
  Filter, 
  RefreshCw, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  FileText, 
  ShieldAlert, 
  Globe, 
  Clock, 
  AlertCircle,
  Database,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, setDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAction, autoPurgeOldLogs, SystemLog } from '../lib/logs';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

interface LogCenterProps {
  isAdmin: boolean;
  onBack?: () => void;
}

export const LogCenter: React.FC<LogCenterProps> = ({ isAdmin, onBack }) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [actionFilter, setActionFilter] = useState('Todos');

  // Edit Modal State
  const [editingLog, setEditingLog] = useState<SystemLog | null>(null);
  const [editPayload, setEditPayload] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // State for purging/expurging logs older than 10 days
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const hasAutoPurged = useRef(false);

  const purgeOldLogs = async () => {
    if (isPurging) return;
    setIsPurging(true);
    setPurgeStatus('Expurgando logs com mais de 10 dias em alta velocidade...');

    try {
      const res = await autoPurgeOldLogs(10);
      if (res.deleted > 0) {
        setPurgeStatus(`Expurgo concluído! ${res.deleted} logs antigos foram deletados.`);
      } else {
        setPurgeStatus('Todos os logs já estão em conformidade (últimos 10 dias).');
      }
      setTimeout(() => setPurgeStatus(null), 4000);
    } catch (err: any) {
      console.error('Erro ao expurgar logs:', err);
      setPurgeStatus(`Erro ao expurgar: ${err.message || err}`);
      setTimeout(() => setPurgeStatus(null), 5000);
    } finally {
      setIsPurging(false);
    }
  };

  // Trigger auto-purge once when LogCenter opens
  useEffect(() => {
    if (isAdmin && !hasAutoPurged.current) {
      hasAutoPurged.current = true;
      autoPurgeOldLogs(10);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const logsRef = collection(db, 'users/shared_franquia_data/systemLogs');
    const qry = query(logsRef, orderBy('timestamp', 'desc'), limit(500));

    const unsubscribe = onSnapshot(qry, (snapshot) => {
      const loadedLogs: SystemLog[] = [];
      snapshot.forEach((doc) => {
        loadedLogs.push({
          id: doc.id,
          ...doc.data()
        } as SystemLog);
      });
      setLogs(loadedLogs);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error('Erro ao escutar logs:', err);
      handleFirestoreError(err, OperationType.GET, 'users/shared_franquia_data/systemLogs');
      setError('Erro ao ler logs do Firebase. Verifique suas permissões.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-100 max-w-2xl mx-auto my-12 text-center">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4 animate-bounce" id="shield-alert-icon" />
        <h2 className="text-2xl font-bold font-sans text-slate-800 mb-2">Acesso Restrito</h2>
        <p className="text-slate-500 font-sans mb-6">
          Apenas administradores autorizados têm acesso à central de logs e auditoria do sistema.
        </p>
        {onBack && (
          <button 
            onClick={onBack}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-all font-sans"
            id="back-unauthorized-btn"
          >
            Voltar ao Painel
          </button>
        )}
      </div>
    );
  }

  // Filter computation
  const filteredLogs = logs.filter(log => {
    // 1. Date filter (data is 'YYYY-MM-DD')
    if (dateFilter && log.data !== dateFilter) return false;

    // 2. Action filter (Criação, Edição, Exclusão, Upload CSV)
    if (actionFilter !== 'Todos' && log.acao !== actionFilter) return false;

    // 3. Type filter (Descarte, Consumo Equipe, etc)
    if (typeFilter !== 'Todos' && log.tipo !== typeFilter) return false;

    // 4. Search query
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      const descMatches = log.descricao?.toLowerCase().includes(queryLower);
      const userMatches = log.usuario?.toLowerCase().includes(queryLower);
      const typeMatches = log.tipo?.toLowerCase().includes(queryLower);
      const colMatches = log.detalhesRef?.collection?.toLowerCase().includes(queryLower);
      if (!descMatches && !userMatches && !typeMatches && !colMatches) return false;
    }

    return true;
  });

  // Extract unique types for type filter
  const logTypes = ['Todos', ...Array.from(new Set(logs.map(l => l.tipo)))];

  const handleOpenEdit = (logItem: SystemLog) => {
    setEditingLog(logItem);
    setSaveStatus(null);
    // Deep copy payload to change safely
    setEditPayload(JSON.parse(JSON.stringify(logItem.detalhesRef?.payload || {})));
  };

  const handleFieldChange = (key: string, value: any) => {
    setEditPayload(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveDocument = async () => {
    if (!editingLog?.detalhesRef?.collection || !editingLog?.detalhesRef?.docId) {
      setSaveStatus({ type: 'error', text: 'Coleção ou ID do documento de referência ausente.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    const fullPath = `users/shared_franquia_data/${editingLog.detalhesRef.collection}`;
    const docRef = doc(db, fullPath, editingLog.detalhesRef.docId);

    try {
      // 1. Save modified payload back to the referenced table in Firestore (or recreate it if missing)
      try {
        await setDoc(docRef, editPayload, { merge: true });
      } catch (err: any) {
        throw new Error(`Erro no Passo 1 (Salvar no módulo ${editingLog.detalhesRef.collection}): ${err.message || err}`);
      }

      // 2. Record this modification as a new audit log
      try {
        await logAction(
          'Edição',
          `${editingLog.tipo} (Auditoria)`,
          `Suporte Admin alterou o item original de ID "${editingLog.detalhesRef.docId}"`,
          editingLog.detalhesRef.collection,
          editingLog.detalhesRef.docId,
          editPayload
        );
      } catch (err: any) {
        throw new Error(`Erro no Passo 2 (Gravar novo Log de Auditoria): ${err.message || err}`);
      }

      // 3. If the log itself stores the payload, also update this log item's detailsRef.payload in Firestore
      // so that it matches the current database records state
      try {
        const logDocRef = doc(db, 'users/shared_franquia_data/systemLogs', editingLog.id!);
        await updateDoc(logDocRef, {
          'detalhesRef.payload': editPayload
        });
      } catch (err: any) {
        throw new Error(`Erro no Passo 3 (Atualizar payload do Log de Origem): ${err.message || err}`);
      }

      setSaveStatus({ type: 'success', text: 'Documento original atualizado e auditado com sucesso!' });
      
      setTimeout(() => {
        setEditingLog(null);
      }, 1500);

    } catch (err: any) {
      console.error('Erro ao atualizar documento auditado:', err);
      setSaveStatus({ type: 'error', text: `Falha ao salvar: ${err.message || err}` });
    } finally {
      setIsSaving(false);
    }
  };

  const getActionBadgeStyle = (action: string) => {
    switch (action) {
      case 'Criação':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 'Edição':
        return 'bg-amber-50 text-amber-700 border-amber-200/60';
      case 'Exclusão':
        return 'bg-rose-50 text-rose-700 border-rose-200/60';
      case 'Upload CSV':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/60';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/60';
    }
  };

  const getFormattedDate = (timestamp: any) => {
    if (!timestamp) return 'Agora';
    try {
      const d = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
      return d.toLocaleString('pt-BR');
    } catch (_) {
      return 'N/A';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6" id="log-center-container">
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Database className="w-4.5 h-4.5" />
            </div>
            <h1 className="text-xl font-bold font-sans text-slate-900 tracking-tight">
              Central de Auditoria de Logs
            </h1>
          </div>
          <p className="text-sm text-slate-500 font-sans">
            Rastreamento completo de inserções, atualizações e exclusões em tempo real.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 font-sans">
              <RefreshCw className={`w-3 h-3 ${isPurging ? 'animate-spin' : ''}`} />
              Manutenção de 10 dias ativa (Autolimpeza)
            </span>
            {purgeStatus && (
              <span className="text-xs text-indigo-600 font-sans font-semibold animate-pulse">
                • {purgeStatus}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => purgeOldLogs()}
            disabled={isPurging}
            className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded-xl border border-amber-200 text-xs transition-colors font-sans flex items-center gap-1.5 disabled:opacity-50"
            id="manual-purge-logs-btn"
            title="Exclui imediatamente todos os registros com mais de 10 dias para liberar espaço"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Expurgar logs (+10 dias)
          </button>

          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded-xl border border-slate-200 text-xs transition-colors font-sans flex items-center gap-2"
              id="back-admin-panel-btn"
            >
              Voltar ao Painel
            </button>
          )}
        </div>
      </div>

      {/* Filter Workspace */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Filter Date */}
        <div className="flex flex-col gap-1.5 col-span-1">
          <label className="text-xs font-semibold text-slate-600 font-sans flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" /> Filtrar Data
          </label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs font-sans text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            id="date-filter-picker"
          />
        </div>

        {/* Action filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 font-sans">Ação</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs font-sans text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            id="action-filter-select"
          >
            <option value="Todos">Todas as Ações</option>
            <option value="Criação">Criações (+)</option>
            <option value="Edição">Edições</option>
            <option value="Exclusão">Exclusões (-)</option>
            <option value="Upload CSV">Upload CSV</option>
          </select>
        </div>

        {/* Type filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 font-sans">Tipo de Log</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs font-sans text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            id="type-filter-select"
          >
            {logTypes.map(lt => (
              <option key={lt} value={lt}>{lt}</option>
            ))}
          </select>
        </div>

        {/* Free text search */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-xs font-semibold text-slate-600 font-sans flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" /> Pesquisa rápida
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Pesquisar por usuário, descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs font-sans text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              id="search-query-field"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {/* Date Clear button */}
      {(dateFilter || searchQuery || actionFilter !== 'Todos' || typeFilter !== 'Todos') && (
        <div className="flex justify-end">
          <button 
            onClick={() => {
              setDateFilter('');
              setSearchQuery('');
              setActionFilter('Todos');
              setTypeFilter('Todos');
            }}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 font-sans flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all"
            id="clear-all-filters-btn"
          >
            <X className="w-3.5 h-3.5" /> Limpar Filtros
          </button>
        </div>
      )}

      {/* Main Table Workspace */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden" id="log-table-wrapper">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-9 h-9 text-slate-800 animate-spin" />
            <span className="text-sm font-sans text-slate-500 font-medium">Lendo trilhas de auditoria...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
            <p className="text-slate-800 font-sans font-bold text-lg">Erro ao carregar logs</p>
            <p className="text-slate-500 font-sans text-xs max-w-md mt-1 mb-4">{error}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Database className="w-14 h-14 text-slate-200 mb-3" />
            <p className="text-slate-800 font-sans font-bold text-md">Nenhum log encontrado</p>
            <p className="text-slate-400 font-sans text-xs mt-0.5">Mude os filtros de busca para encontrar registros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto" id="audit-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-4 text-xs font-bold text-slate-600 font-sans">Data/Hora</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-600 font-sans">Usuário</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-600 font-sans">Ação</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-600 font-sans">Módulo/Tipo</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-600 font-sans">Descrição do Input</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-600 font-none text-right">Ação Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const hasReference = !!(log.detalhesRef?.collection && log.detalhesRef?.docId);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Date */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="text-xs font-medium font-sans text-slate-900 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {getFormattedDate(log.timestamp)}
                        </div>
                        <span className="text-[10px] font-mono font-medium text-slate-400 block mt-0.5 bg-slate-100 rounded px-1.5 py-0.5 w-max">
                          {log.data}
                        </span>
                      </td>

                      {/* Usuario */}
                      <td className="px-5 py-3.5">
                        <div className="text-xs font-sans text-slate-800 max-w-[200px] truncate" title={log.usuario}>
                          {log.usuario}
                        </div>
                      </td>

                      {/* Badge Ação */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border ${getActionBadgeStyle(log.acao)}`}>
                          {log.acao}
                        </span>
                      </td>

                      {/* Tipo de Log */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-xs font-sans text-slate-600 font-semibold">
                          {log.tipo}
                        </span>
                      </td>

                      {/* Descricao */}
                      <td className="px-5 py-3.5">
                        <div className="text-xs font-medium font-sans text-slate-700 max-w-[450px]">
                          {log.descricao}
                        </div>
                        {hasReference && (
                          <span className="text-[9px] font-mono text-indigo-600 mt-1 block">
                            REF: {log.detalhesRef.collection} &rarr; {log.detalhesRef.docId.slice(0, 8)}...
                          </span>
                        )}
                      </td>

                      {/* Edit Admin Button */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        {hasReference ? (
                          <button
                            onClick={() => handleOpenEdit(log)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200/50 transition-all cursor-pointer"
                            id={`edit-log-btn-${log.id}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Editar Original
                          </button>
                        ) : (
                          <span className="text-[10px] font-sans font-medium text-slate-400 italic">
                            Sem referência alterável
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Payload Modal */}
      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-2xl w-full rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
              id="edit-log-modal"
            >
              {/* Modal header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                <div>
                  <h3 className="text-base font-bold font-sans">Editar Registro Banco de Dados</h3>
                  <p className="text-[11px] text-slate-300 font-sans mt-0.5">
                    Modificar doc original da tabela: <span className="font-mono bg-slate-800 text-yellow-300 rounded px-1.5 py-0.5">{editingLog.detalhesRef.collection}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setEditingLog(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  id="close-edit-modal-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status information alert */}
              <div className="bg-amber-50 p-4 border-b border-amber-100 flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs font-sans text-amber-800">
                  <span className="font-bold block">Aviso de Auditoria Crucial</span>
                  Qualquer modificação salvará diretamente por cima do dado que está no Firestore database.
                  Esta ação será gravada em uma nova linha de logs sob seu usuário ({editingLog.usuario}) para fins de auditoria.
                </div>
              </div>

              {/* Fields Form Workspace */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {Object.keys(editPayload).length === 0 ? (
                  <p className="text-xs font-sans font-medium text-slate-400 text-center py-6">
                    Nenhum campo disponível para alteração. O payload original está vazio.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(editPayload).map(([key, value]) => {
                      if (key === 'userId' || key === 'createdAt') {
                        // Keep these system metadata read-only for security
                        return (
                          <div key={key} className="grid grid-cols-3 gap-3 items-center border-b border-slate-50 pb-2">
                            <span className="text-xs font-bold text-slate-400 font-mono">{key} (meta)</span>
                            <span className="text-xs text-slate-500 font-mono col-span-2 select-all">{String(value)}</span>
                          </div>
                        );
                      }

                      // Dynamic Fields
                      const isArrayOrObj = typeof value === 'object' && value !== null;

                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <label className="text-xs font-bold text-slate-700 font-mono flex items-center justify-between">
                            <span>{key}</span>
                            <span className="text-[9px] text-slate-400 font-sans">
                              {typeof value === 'boolean' ? 'Booleano' : isArrayOrObj ? 'Array/Objetos' : typeof value === 'number' ? 'Número' : 'Texto'}
                            </span>
                          </label>

                          {typeof value === 'boolean' ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="checkbox"
                                checked={!!editPayload[key]}
                                onChange={(e) => handleFieldChange(key, e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 focus:outline-none"
                                id={`input-field-${key}`}
                              />
                              <span className="text-xs font-semibold text-slate-600 font-sans">Habilitado</span>
                            </div>
                          ) : isArrayOrObj ? (
                            // Render nested ingredients/lists as rich serializable text area
                            <textarea
                              value={typeof editPayload[key] === 'string' ? editPayload[key] : JSON.stringify(editPayload[key], null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  handleFieldChange(key, parsed);
                                } catch (_) {
                                  // Accept string in current intermediate typing state before commit
                                  handleFieldChange(key, e.target.value);
                                }
                              }}
                              className="w-full px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-mono h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              id={`input-field-${key}`}
                            />
                          ) : typeof value === 'number' ? (
                            <input
                              type="number"
                              value={editPayload[key]}
                              onChange={(e) => handleFieldChange(key, e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-3 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-xs font-sans text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-950 transition-all font-medium"
                              id={`input-field-${key}`}
                            />
                          ) : (
                            <input
                              type="text"
                              value={editPayload[key]}
                              onChange={(e) => handleFieldChange(key, e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 bg-slate-50 border-slate-200 rounded-xl text-xs font-sans text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-950 transition-all font-medium"
                              id={`input-field-${key}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status alert message */}
              {saveStatus && (
                <div className={`p-4 text-xs font-bold font-sans flex items-center gap-2 ${saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-t border-emerald-100' : 'bg-rose-50 text-rose-800 border-t border-rose-100'}`}>
                  <AlertCircle className="w-4 h-4" />
                  {saveStatus.text}
                </div>
              )}

              {/* Modal footer control actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                  id="cancel-edit-modal-btn"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveDocument}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 rounded-xl transition-all"
                  id="save-edit-modal-btn"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Confirmar Alteração
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
