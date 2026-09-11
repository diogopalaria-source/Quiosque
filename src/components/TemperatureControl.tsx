import React, { useState, useEffect } from 'react';
import { 
  Thermometer, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Download, 
  FileText, 
  Refrigerator, 
  HelpCircle,
  X,
  Plus,
  Loader2
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
  ReferenceLine 
} from 'recharts';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { TemperatureMeasurement } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { logAction } from '../lib/logs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TemperatureControlProps {
  userId: string;
  userRole: string;
  onBack: () => void;
}

const RESPONSABLES = ['Ariane', 'Barbara', 'Breno', 'Diogo', 'Free Lancer', 'Nathan', 'Alicia'];

export const TemperatureControl: React.FC<TemperatureControlProps> = ({
  userId,
  userRole,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'operador' | 'auditoria'>(userRole === 'admin' ? 'auditoria' : 'operador');
  const [measurements, setMeasurements] = useState<TemperatureMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedEquipment, setSelectedEquipment] = useState<'Freezer' | 'Geladeira' | 'Frigobar'>('Geladeira');
  const [tempValue, setTempValue] = useState<string>('');
  const [funcionario, setFuncionario] = useState<string>('');
  const [justificativa, setJustificativa] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter States for Governance Panel
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default last 30 days
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [chartEquipment, setChartEquipment] = useState<'Freezer' | 'Geladeira' | 'Frigobar'>('Geladeira');

  // Auto-detect and prefill staff member
  useEffect(() => {
    if (auth.currentUser) {
      const emailName = auth.currentUser.email ? auth.currentUser.email.split('@')[0] : '';
      // Try to match with Responsables
      const matched = RESPONSABLES.find(r => r.toLowerCase() === emailName.toLowerCase());
      if (matched) {
        setFuncionario(matched);
      } else if (auth.currentUser.displayName) {
        setFuncionario(auth.currentUser.displayName);
      } else if (emailName) {
        setFuncionario(emailName);
      } else {
        setFuncionario('Ariane'); // safe fallback
      }
    } else {
      setFuncionario('Ariane');
    }
  }, []);

  // Fetch all measurements
  useEffect(() => {
    setLoading(true);
    const path = 'users/shared_franquia_data/temperatureMeasurements';
    const q = query(
      collection(db, path),
      orderBy('data_registro', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: TemperatureMeasurement[] = [];
      snapshot.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() } as TemperatureMeasurement;
        // Dynamically recalculate/override compliance to reflect correct range in the UI tables/PDF/charts
        if (item.id_equipamento) {
          item.status_conformidade = checkCompliance(item.id_equipamento, item.temperatura);
        }
        data.push(item);
      });
      // Sort precisely in memory by data_registro desc, then hora_registro desc
      data.sort((a, b) => {
        const dateCompare = b.data_registro.localeCompare(a.data_registro);
        if (dateCompare !== 0) return dateCompare;
        return b.hora_registro.localeCompare(a.hora_registro);
      });
      setMeasurements(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-correct wrong freezer temperatures
  useEffect(() => {
    if (userRole === 'admin' && measurements.length > 0) {
      // 1. Core Auto-correction (20.9 to -20.9)
      const wrongRecords209 = measurements.filter(
        (m) => m.id_equipamento === 'Freezer' && m.temperatura === 20.9
      );
      if (wrongRecords209.length > 0) {
        wrongRecords209.forEach(async (record) => {
          try {
            const docRef = doc(db, 'users/shared_franquia_data/temperatureMeasurements', record.id!);
            await updateDoc(docRef, {
              temperatura: -20.9,
              status_conformidade: 'OK',
              justificativa: ''
            });
            await logAction(
              'Edição',
              'Controle Temperatura',
              `Correção de temperatura do Freezer de 20.9°C para -20.9°C (Status corrigido para OK)`,
              'temperatureMeasurements',
              record.id!,
              { id_equipamento: 'Freezer', temperatura: -20.9, anterior: 20.9, status_conformidade: 'OK' }
            );
            console.log(`Successfully auto-corrected freezer temperature (20.9) for record ${record.id}`);
          } catch (err) {
            console.error('Error auto-correcting freezer temperature (20.9):', err);
          }
        });
      }

      // 2. Correction for 01/07 (16.2 to -16.2)
      const wrongRecords162 = measurements.filter(
        (m) => m.id_equipamento === 'Freezer' && m.data_registro === '2026-07-01' && m.temperatura === 16.2
      );
      if (wrongRecords162.length > 0) {
        wrongRecords162.forEach(async (record) => {
          try {
            const docRef = doc(db, 'users/shared_franquia_data/temperatureMeasurements', record.id!);
            await updateDoc(docRef, {
              temperatura: -16.2,
              status_conformidade: 'ALERTA' // -16.2 is warmer than -18, so it is still ALERTA
            });
            await logAction(
              'Edição',
              'Controle Temperatura',
              `Correção de temperatura do Freezer em 01/07 de 16.2°C para -16.2°C (Status mantido como ALERTA)`,
              'temperatureMeasurements',
              record.id!,
              { id_equipamento: 'Freezer', temperatura: -16.2, anterior: 16.2, status_conformidade: 'ALERTA' }
            );
            console.log(`Successfully auto-corrected freezer temperature (16.2) for record ${record.id}`);
          } catch (err) {
            console.error('Error auto-correcting freezer temperature (16.2):', err);
          }
        });
      }

      // 3. Correction for 02/07 (18.8 to -18.8)
      const wrongRecords188 = measurements.filter(
        (m) => m.id_equipamento === 'Freezer' && m.data_registro === '2026-07-02' && m.temperatura === 18.8
      );
      if (wrongRecords188.length > 0) {
        wrongRecords188.forEach(async (record) => {
          try {
            const docRef = doc(db, 'users/shared_franquia_data/temperatureMeasurements', record.id!);
            await updateDoc(docRef, {
              temperatura: -18.8,
              status_conformidade: 'OK',
              justificativa: '' // Clear compliance warning justification
            });
            await logAction(
              'Edição',
              'Controle Temperatura',
              `Correção de temperatura do Freezer em 02/07 de 18.8°C para -18.8°C (Status corrigido para OK)`,
              'temperatureMeasurements',
              record.id!,
              { id_equipamento: 'Freezer', temperatura: -18.8, anterior: 18.8, status_conformidade: 'OK' }
            );
            console.log(`Successfully auto-corrected freezer temperature (18.8) for record ${record.id}`);
          } catch (err) {
            console.error('Error auto-correcting freezer temperature (18.8):', err);
          }
        });
      }
    }
  }, [measurements, userRole]);

  // Helpers for Local Date and Time
  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalTimeString = (d: Date = new Date()) => {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Helper: check status of locks & constraints for an equipment
  const getEquipmentStatusForToday = (equipment: 'Freezer' | 'Geladeira' | 'Frigobar') => {
    const todayStr = getLocalDateString();
    
    // Filter measurements for today and specific equipment
    const todayMeasurements = measurements
      .filter(m => m.data_registro === todayStr && m.id_equipamento === equipment)
      .sort((a, b) => a.hora_registro.localeCompare(b.hora_registro));

    if (todayMeasurements.length >= 2) {
      return {
        locked: true,
        status: 'completed',
        message: 'Limite diário de 2 medições já preenchido para este equipamento hoje.',
        nextAvailableAt: null
      };
    }

    if (todayMeasurements.length === 1) {
      const first = todayMeasurements[0];
      const [h, m, s] = first.hora_registro.split(':').map(Number);
      
      const firstTime = new Date();
      firstTime.setHours(h, m, s || 0, 0);

      const unlockTime = new Date(firstTime.getTime() + 4 * 60 * 60 * 1000); // +4 hours
      const now = new Date();

      if (now < unlockTime) {
        const unlockStr = `${String(unlockTime.getHours()).padStart(2, '0')}:${String(unlockTime.getMinutes()).padStart(2, '0')}`;
        return {
          locked: true,
          status: 'waiting',
          message: `A próxima medição estará disponível apenas após as ${unlockStr}.`,
          nextAvailableAt: unlockStr
        };
      }
    }

    return {
      locked: false,
      status: 'available',
      message: 'Disponível para registro de temperatura.',
      nextAvailableAt: null
    };
  };

  // Calculate Real-time compliance
  const checkCompliance = (equip: 'Freezer' | 'Geladeira' | 'Frigobar', temp: number): 'OK' | 'ALERTA' => {
    if (equip === 'Freezer') {
      return temp <= -18 ? 'OK' : 'ALERTA';
    } else if (equip === 'Geladeira') {
      // Geladeira (2 to 8 inclusive)
      return (temp >= 2 && temp <= 8) ? 'OK' : 'ALERTA';
    } else {
      // Frigobar (0 to 5 inclusive)
      return (temp >= 0 && temp <= 5) ? 'OK' : 'ALERTA';
    }
  };

  const tempNum = tempValue !== '' ? parseFloat(tempValue) : NaN;
  const isComplianceAlert = !isNaN(tempNum) && checkCompliance(selectedEquipment, tempNum) === 'ALERTA';
  const currentStatus = getEquipmentStatusForToday(selectedEquipment);

  const isFormValid = 
    selectedEquipment && 
    !isNaN(tempNum) && 
    funcionario !== '' && 
    (!isComplianceAlert || (justificativa.trim().length > 0)) &&
    !currentStatus.locked;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const todayDate = getLocalDateString();
      const clickTime = getLocalTimeString();
      const finalCompliance = checkCompliance(selectedEquipment, tempNum);

      const record: TemperatureMeasurement = {
        data_registro: todayDate,
        hora_registro: clickTime,
        id_equipamento: selectedEquipment,
        temperatura: tempNum,
        funcionario: funcionario,
        id_funcionario: auth.currentUser?.uid || 'anonymous',
        status_conformidade: finalCompliance,
        justificativa: finalCompliance === 'ALERTA' ? justificativa.trim() : '',
        userId: userId || 'shared_franquia_data',
        createdAt: new Date().toISOString()
      };

      const path = 'users/shared_franquia_data/temperatureMeasurements';
      const docRef = await addDoc(collection(db, path), record);

      // Log the creation in system logs
      await logAction(
        'Criação',
        'Controle Temperatura',
        `Registrou temperatura de ${tempNum}°C (${finalCompliance}) para o(a) ${selectedEquipment}`,
        'temperatureMeasurements',
        docRef.id,
        record
      );

      setSuccessMessage(`Medição registrada com sucesso! Status: ${finalCompliance}`);
      setTempValue('');
      setJustificativa('');
      
      // Clear success alert after 4 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Erro ao registrar a medição. Por favor, tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter measurements for Governance Chart & Tables
  const filteredData = measurements
    .filter(m => {
      const matchDate = m.data_registro >= startDate && m.data_registro <= endDate;
      return matchDate;
    })
    .sort((a, b) => {
      // Chronological ascending for charts
      const dateCompare = a.data_registro.localeCompare(b.data_registro);
      if (dateCompare !== 0) return dateCompare;
      return a.hora_registro.localeCompare(b.hora_registro);
    });

  // Table Data descending
  const tableDataDesc = [...filteredData].reverse();

  // Out of spec records only
  const outOfSpecRecords = tableDataDesc.filter(m => m.status_conformidade === 'ALERTA');

  // Chart specific filtered data (only current equipment)
  const chartData = filteredData.filter(m => m.id_equipamento === chartEquipment);

  // Generate PDF report
  const generatePDFReport = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('pt-BR');

    // Title / Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('BOTTEGA DA NONNA', 14, 20);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('RELATÓRIO DE CONTROLE DE TEMPERATURA', 14, 27);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Unidade: Quiosque Padrão | Período: ${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`, 14, 33);
    doc.text(`Gerado em: ${today}`, 14, 38);

    const rows = tableDataDesc.map(item => [
      item.data_registro.split('-').reverse().join('/'),
      item.hora_registro.substring(0, 5),
      item.id_equipamento,
      `${item.temperatura.toFixed(1)}°C`,
      item.status_conformidade,
      item.funcionario,
      item.justificativa || '-'
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Data', 'Hora', 'Equipamento', 'Temp.', 'Status', 'Funcionário', 'Justificativa']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      willDrawCell: (data) => {
        if (data.row.section === 'body') {
          const statusVal = data.row.cells[4].text[0];
          if (statusVal === 'ALERTA') {
            data.cell.styles.textColor = [220, 38, 38]; // bold red
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    doc.save(`relatorio_temperatura_${startDate}_${endDate}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" id="temperature-module">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Thermometer className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Controle de Temperatura</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Segurança alimentar & Eficiência de equipamentos</p>
            </div>
          </div>
        </div>

        {/* Tab Selector & Navigation */}
        <div className="flex items-center gap-2">
          {userRole === 'admin' && (
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('operador')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeTab === 'operador' 
                    ? 'bg-white text-slate-950 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Registrar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('auditoria')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeTab === 'auditoria' 
                    ? 'bg-white text-slate-950 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Auditoria (Admin)
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all text-[10px] font-black uppercase tracking-wider"
          >
            Voltar
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'operador' ? (
          <motion.div
            key="operator-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Operator Form */}
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-500" />
                  Novo Lançamento Diário
                </h2>
                <p className="text-slate-400 text-xs">Os dados de data e hora são capturados automaticamente pelo sistema de forma imutável.</p>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                
                {/* Equipment Selection Cards */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">1. Equipamento</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { id: 'Freezer', label: '🎛️ Freezer', ideal: 'Abaixo de -18°C', desc: 'Congelados' },
                      { id: 'Geladeira', label: '🥛 Geladeira Grande', ideal: '2°C a 8°C', desc: 'Insumos gerais' },
                      { id: 'Frigobar', label: '🥤 Frigobar', ideal: '0°C a 5°C', desc: 'Bebidas e prontos' }
                    ].map((item) => {
                      const status = getEquipmentStatusForToday(item.id as any);
                      const isSelected = selectedEquipment === item.id;
                      
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedEquipment(item.id as any);
                            setTempValue('');
                            setJustificativa('');
                          }}
                          className={`flex flex-col items-start p-5 rounded-3xl border text-left transition-all relative overflow-hidden ${
                            isSelected 
                              ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20' 
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.label}</span>
                          <span className="text-[10px] text-slate-500 mt-1 font-bold">Faixa ideal: {item.ideal}</span>
                          <span className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{item.desc}</span>

                          {/* Today's count badge */}
                          <div className="mt-4 flex items-center justify-between w-full pt-3 border-t border-slate-100">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase">
                              Registros hoje: {measurements.filter(m => m.data_registro === getLocalDateString() && m.id_equipamento === item.id).length}/2
                            </span>
                            
                            {status.locked ? (
                              <span className="text-[9px] bg-amber-100 text-amber-700 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                {status.status === 'completed' ? 'Completo' : 'Trancado'}
                              </span>
                            ) : (
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                Ativo
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Locked info warning */}
                {currentStatus.locked && (
                  <div className="p-4 bg-amber-50 text-amber-800 rounded-2xl border border-amber-100 flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-amber-900">Equipamento Temporariamente Bloqueado</p>
                      <p className="text-xs mt-0.5 leading-relaxed font-semibold">{currentStatus.message}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Temp Value */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block" htmlFor="temp-input">
                      2. Temperatura Digitada (°C)
                    </label>
                    <div className="relative">
                      <input
                        id="temp-input"
                        type="number"
                        step="0.1"
                        placeholder="Ex: -19.5 ou 3.2"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        disabled={currentStatus.locked}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400">°C</span>
                    </div>
                  </div>

                  {/* Staff Select */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block" htmlFor="staff-select">
                      3. Funcionário Responsável
                    </label>
                    <select
                      id="staff-select"
                      value={funcionario}
                      onChange={(e) => setFuncionario(e.target.value)}
                      disabled={currentStatus.locked}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                    >
                      <option value="">-- Selecione seu nome --</option>
                      {RESPONSABLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Compliance real-time monitoring */}
                {!isNaN(tempNum) && (
                  <div className={`p-5 rounded-3xl border flex items-start gap-4 transition-all ${
                    isComplianceAlert 
                      ? 'bg-rose-50 border-rose-200 text-rose-900' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    {isComplianceAlert ? (
                      <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider">
                        {isComplianceAlert ? 'Atenção: Fora de Especificação!' : 'Conformidade Ideal'}
                      </h4>
                      <p className="text-xs mt-1 leading-relaxed">
                        {isComplianceAlert 
                          ? `A temperatura de ${tempValue}°C está fora da faixa de segurança indicada para o(a) ${selectedEquipment}. Uma justificativa deve ser fornecida para salvar o registro.` 
                          : `Temperatura de ${tempValue}°C está dentro da faixa aceitável para o(a) ${selectedEquipment}. Tudo OK.`
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Justificativa (Conditional) */}
                <AnimatePresence>
                  {isComplianceAlert && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block" htmlFor="justificativa-input">
                        4. Justificativa de Alerta (Obrigatória) *
                      </label>
                      <textarea
                        id="justificativa-input"
                        rows={3}
                        placeholder="Ex: Porta mantida aberta para higienização e abastecimento semanal."
                        value={justificativa}
                        onChange={(e) => setJustificativa(e.target.value)}
                        className="w-full px-5 py-4 bg-rose-50/20 border border-rose-200 rounded-2xl font-medium text-slate-950 placeholder-rose-400 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Alerts/Status */}
                {errorMessage && (
                  <div className="p-4 bg-rose-100 text-rose-800 rounded-2xl font-bold text-xs">
                    {errorMessage}
                  </div>
                )}
                {successMessage && (
                  <div className="p-4 bg-emerald-100 text-emerald-800 rounded-2xl font-bold text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {successMessage}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="w-full py-4.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-sm hover:shadow flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando no Banco...
                    </>
                  ) : (
                    'Salvar Registro de Temperatura'
                  )}
                </button>
              </form>
            </div>

            {/* Side summary of today's records */}
            <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Lançamentos Hoje
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase font-bold">Resumo das últimas 24h</p>
              </div>

              <div className="space-y-3">
                {measurements
                  .filter(m => m.data_registro === getLocalDateString())
                  .length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-white border border-slate-100 rounded-3xl">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-500" />
                    <p className="text-[10px] font-black uppercase tracking-wider">Nenhuma medição realizada hoje.</p>
                  </div>
                ) : (
                  measurements
                    .filter(m => m.data_registro === getLocalDateString())
                    .map((m) => (
                      <div key={m.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 uppercase">{m.id_equipamento}</span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                            m.status_conformidade === 'OK' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {m.status_conformidade}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                          <span>Temp: <strong className="text-slate-800">{m.temperatura.toFixed(1)}°C</strong></span>
                          <span>Hora: {m.hora_registro.substring(0, 5)}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase truncate">Por: {m.funcionario}</p>
                        {m.justificativa && (
                          <div className="bg-slate-50 p-2.5 rounded-xl text-[10px] text-slate-600 font-semibold border-l-2 border-rose-400">
                            "{m.justificativa}"
                          </div>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="auditor-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Filters panel */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block" htmlFor="audit-start-date">Data Inicial</label>
                  <input
                    id="audit-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block" htmlFor="audit-end-date">Data Final</label>
                  <input
                    id="audit-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block" htmlFor="chart-equip-select">Visualizar Equipamento</label>
                  <select
                    id="chart-equip-select"
                    value={chartEquipment}
                    onChange={(e) => setChartEquipment(e.target.value as any)}
                    className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 w-full"
                  >
                    <option value="Geladeira">Geladeira Grande</option>
                    <option value="Freezer">Freezer</option>
                    <option value="Frigobar">Frigobar</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={generatePDFReport}
                className="w-full md:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-850 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Gerar Relatório PDF
              </button>
            </div>

            {/* Chart Area */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    Gráfico de Degradação (Tendência Temporal)
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-0.5 uppercase font-bold">Acompanhe se a curva de temperatura está subindo ao longo das semanas</p>
                </div>
                <div className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg uppercase">
                  {chartEquipment}
                </div>
              </div>

              <div className="h-72 w-full">
                {chartData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl">
                    <HelpCircle className="w-12 h-12 mb-2 opacity-30 text-slate-500" />
                    <p className="text-xs font-black uppercase tracking-wider">Nenhum dado encontrado para o equipamento e período selecionados.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 15, right: 25, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="data_registro" 
                        tickFormatter={(v) => v.split('-').reverse().slice(0, 2).join('/')}
                        tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }}
                        stroke="#e2e8f0"
                      />
                      <YAxis 
                        tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }}
                        stroke="#e2e8f0"
                        domain={chartEquipment === 'Freezer' ? [-25, -10] : [-5, 10]}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as TemperatureMeasurement;
                            return (
                              <div className="bg-slate-900 text-white p-4.5 rounded-2xl shadow-xl text-xs space-y-1 font-bold border border-slate-800">
                                <p className="text-[10px] text-slate-400 uppercase font-black">{data.data_registro.split('-').reverse().join('/')} às {data.hora_registro.substring(0, 5)}</p>
                                <p className="text-indigo-400 text-sm font-extrabold">{data.temperatura.toFixed(1)}°C</p>
                                <p className="text-[10px] uppercase font-black">Func: <span className="text-slate-300">{data.funcionario}</span></p>
                                <p className={`text-[9px] font-black px-2 py-0.5 rounded uppercase inline-block ${
                                  data.status_conformidade === 'OK' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                }`}>
                                  {data.status_conformidade}
                                </p>
                                {data.justificativa && (
                                  <p className="text-[10px] text-rose-300 italic font-semibold mt-1">"{data.justificativa}"</p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {chartEquipment === 'Freezer' ? (
                        <ReferenceLine 
                          y={-18} 
                          stroke="#ef4444" 
                          strokeDasharray="4 4"
                          label={{ 
                            value: 'Crítico (-18°C)', 
                            fill: '#ef4444', 
                            fontSize: 9, 
                            fontWeight: 'bold', 
                            position: 'top' 
                          }} 
                        />
                      ) : chartEquipment === 'Geladeira' ? (
                        <>
                          <ReferenceLine 
                            y={8} 
                            stroke="#ef4444" 
                            strokeDasharray="4 4"
                            label={{ 
                              value: 'Crítico Máx (8°C)', 
                              fill: '#ef4444', 
                              fontSize: 9, 
                              fontWeight: 'bold', 
                              position: 'top' 
                            }} 
                          />
                          <ReferenceLine 
                            y={2} 
                            stroke="#ef4444" 
                            strokeDasharray="4 4"
                            label={{ 
                              value: 'Crítico Mín (2°C)', 
                              fill: '#ef4444', 
                              fontSize: 9, 
                              fontWeight: 'bold', 
                              position: 'bottom' 
                            }} 
                          />
                        </>
                      ) : (
                        <>
                          <ReferenceLine 
                            y={5} 
                            stroke="#ef4444" 
                            strokeDasharray="4 4"
                            label={{ 
                              value: 'Crítico Máx (5°C)', 
                              fill: '#ef4444', 
                              fontSize: 9, 
                              fontWeight: 'bold', 
                              position: 'top' 
                            }} 
                          />
                          <ReferenceLine 
                            y={0} 
                            stroke="#ef4444" 
                            strokeDasharray="4 4"
                            label={{ 
                              value: 'Crítico Mín (0°C)', 
                              fill: '#ef4444', 
                              fontSize: 9, 
                              fontWeight: 'bold', 
                              position: 'bottom' 
                            }} 
                          />
                        </>
                      )}
                      <Line 
                        type="monotone" 
                        dataKey="temperatura" 
                        stroke="#4f46e5" 
                        strokeWidth={3} 
                        dot={{ r: 4, strokeWidth: 1 }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Out of spec / Alert tables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Alert list ONLY */}
              <div className="bg-rose-50/40 border border-rose-200/60 p-6 rounded-[2.5rem] space-y-4">
                <div>
                  <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Fora de Especificação ({outOfSpecRecords.length})
                  </h4>
                  <p className="text-[9px] text-rose-600/80 mt-0.5 uppercase font-bold">Apenas medições com status ALERTA</p>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-96">
                  {outOfSpecRecords.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-white border border-rose-100 rounded-3xl">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Nenhum alerta registrado no período!</p>
                    </div>
                  ) : (
                    outOfSpecRecords.map((m) => (
                      <div key={m.id} className="p-4 bg-white border border-rose-100 rounded-2xl shadow-sm space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 uppercase">{m.id_equipamento}</span>
                          <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                            {m.temperatura.toFixed(1)}°C
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500 font-extrabold uppercase">
                          {m.data_registro.split('-').reverse().join('/')} às {m.hora_registro.substring(0, 5)} - por {m.funcionario}
                        </p>
                        {m.justificativa && (
                          <div className="bg-slate-50 p-2.5 rounded-xl text-[10px] text-slate-600 font-semibold border-l-2 border-rose-400">
                            "{m.justificativa}"
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Complete Audit Table */}
              <div className="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Histórico Completo de Auditoria
                  </h4>
                  <p className="text-[9px] text-slate-400 mt-0.5 uppercase font-bold">Listagem de todos os lançamentos cronológicos reversos</p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[9px] border-b border-slate-100">
                      <tr>
                        <th className="p-4">Data/Hora</th>
                        <th className="p-4">Equipamento</th>
                        <th className="p-4">Temp</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Funcionário</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                      {tableDataDesc.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 uppercase text-[10px]">
                            Nenhuma medição encontrada para este período.
                          </td>
                        </tr>
                      ) : (
                        tableDataDesc.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="p-4">
                              <span className="block text-slate-900">{m.data_registro.split('-').reverse().join('/')}</span>
                              <span className="block text-[10px] text-slate-400 font-semibold">{m.hora_registro.substring(0, 5)}</span>
                            </td>
                            <td className="p-4 font-black uppercase text-[10px] text-slate-900">{m.id_equipamento}</td>
                            <td className="p-4 font-black">{m.temperatura.toFixed(1)}°C</td>
                            <td className="p-4">
                              <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                                m.status_conformidade === 'OK' 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : 'bg-rose-100 text-rose-700'
                              }`}>
                                {m.status_conformidade}
                              </span>
                            </td>
                            <td className="p-4 text-[10px] text-slate-500 uppercase">{m.funcionario}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
