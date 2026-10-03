import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, ArrowLeft, Check, Pencil, X, Save } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getDataPath, cn } from '../lib/utils';
import { logAction } from '../lib/logs';

interface StaffManagerProps {
  userId: string;
  onBack: () => void;
}

export interface StaffMember {
  id: string;
  nome: string;
  funcao?: string;
  ativo: boolean;
  allowedModules?: string[]; // ['consumption', 'payments', 'waste', 'temperature']
}

const DEFAULT_STAFF = [
  'Ariane', 'Barbara', 'Alexandre', 'Breno', 'Keila', 'Diogo', 'Free Lancer', 'Kenji', 'Nathan', 'Alicia'
];

const ALL_MODULES = [
  { id: 'consumption', label: 'Consumo Funcionário' },
  { id: 'payments', label: 'Baixa de Pagamentos' },
  { id: 'waste', label: 'Desperdício e Reuso' },
  { id: 'temperature', label: 'Controle de Temperatura' }
];

export const StaffManager: React.FC<StaffManagerProps> = ({ userId, onBack }) => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state for adding/editing
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formFunction, setFormFunction] = useState('Colaborador');
  const [formModules, setFormModules] = useState<string[]>(['consumption', 'payments', 'waste', 'temperature']);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const colRef = collection(db, getDataPath('systemStaff'));
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const loaded: StaffMember[] = [];
          snap.forEach(d => {
            const data = d.data();
            loaded.push({
              id: d.id,
              nome: data.nome || '',
              funcao: data.funcao || 'Colaborador',
              ativo: data.ativo ?? true,
              allowedModules: data.allowedModules || ['consumption', 'payments', 'waste', 'temperature']
            } as StaffMember);
          });
          loaded.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
          setStaffList(loaded);
        } else {
          // Seed defaults with all modules enabled
          const initial = DEFAULT_STAFF.map(name => ({
            id: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            nome: name,
            funcao: 'Colaborador',
            ativo: true,
            allowedModules: ['consumption', 'payments', 'waste', 'temperature']
          }));
          for (const s of initial) {
            await setDoc(doc(db, getDataPath('systemStaff'), s.id), { ...s, updatedAt: serverTimestamp() });
          }
          setStaffList(initial);
        }
      } catch (err) {
        console.error('Error fetching staff:', err);
      }
    };
    fetchStaff();
  }, [userId]);

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setLoading(true);
    try {
      const id = editingId || (formName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now());
      const member: StaffMember = {
        id,
        nome: formName.trim(),
        funcao: formFunction.trim() || 'Colaborador',
        ativo: true,
        allowedModules: formModules
      };

      await setDoc(doc(db, getDataPath('systemStaff'), id), { ...member, updatedAt: serverTimestamp() }, { merge: true });

      if (editingId) {
        setStaffList(prev => prev.map(s => s.id === id ? member : s).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
        await logAction('Edição', 'Gestão Funcionários', `Atualizou funcionário "${member.nome}"`, 'systemStaff', id, member);
        setSuccessMsg('Funcionário atualizado com sucesso!');
      } else {
        setStaffList(prev => [...prev, member].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
        await logAction('Criação', 'Gestão Funcionários', `Adicionou funcionário "${member.nome}"`, 'systemStaff', id, member);
        setSuccessMsg('Funcionário cadastrado com sucesso!');
      }

      setFormName('');
      setFormFunction('Colaborador');
      setFormModules(['consumption', 'payments', 'waste', 'temperature']);
      setIsAdding(false);
      setEditingId(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar funcionário.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setFormName(member.nome);
    setFormFunction(member.funcao || 'Colaborador');
    setFormModules(member.allowedModules || ['consumption', 'payments', 'waste', 'temperature']);
    setIsAdding(true);
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Deseja remover "${name}" da lista de funcionários? O histórico de consumo e pagamentos anterior será mantido.`)) return;
    try {
      await deleteDoc(doc(db, getDataPath('systemStaff'), id));
      setStaffList(prev => prev.filter(s => s.id !== id));
      await logAction('Exclusão', 'Gestão Funcionários', `Removeu funcionário "${name}"`, 'systemStaff', id, { nome: name });
      setSuccessMsg(`Funcionário "${name}" removido com sucesso.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir funcionário.');
    }
  };



  const toggleModule = (modId: string) => {
    setFormModules(prev => 
      prev.includes(modId) ? prev.filter(m => m !== modId) : [...prev, modId]
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="bg-white rounded-[2.5rem] p-6 sm:p-7 border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-3.5 bg-emerald-600 text-white rounded-2xl shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              Gestão de Funcionários
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              Histórico mantido, lista pré-preenchida e configuração de locais do sistema por colaborador
            </p>
          </div>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setFormName('');
              setFormFunction('Colaborador');
              setFormModules(['consumption', 'payments', 'waste', 'temperature']);
              setIsAdding(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Funcionário</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {isAdding && (
        <div className="bg-white rounded-3xl p-6 border-2 border-emerald-200 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-emerald-900 uppercase tracking-tight">
              {editingId ? 'Editar Funcionário & Locais de Exibição' : 'Cadastrar Novo Funcionário'}
            </h3>
            <button
              type="button"
              onClick={() => { setIsAdding(false); setEditingId(null); }}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveStaff} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Nome do Funcionário</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Função / Cargo</label>
                <input
                  type="text"
                  placeholder="Ex: Atendente, Gerente..."
                  value={formFunction}
                  onChange={e => setFormFunction(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">
                Locais do Sistema onde este nome deve aparecer (Comboboxes):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_MODULES.map(mod => {
                  const checked = formModules.includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      onClick={() => toggleModule(mod.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all",
                        checked ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 font-bold" : "bg-slate-50 border-slate-200 text-slate-600"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}} // Handled by container onClick
                        className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
                      />
                      <span className="text-xs">{mod.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsAdding(false); setEditingId(null); }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Funcionário</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs divide-y divide-slate-100">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-3">
          Colaboradores Cadastrados ({staffList.length})
        </h3>
        {staffList.map(member => (
          <div key={member.id} className="py-4 flex items-center justify-between hover:bg-slate-50/80 px-4 rounded-2xl transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-900">{member.nome}</h4>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase">
                  {member.funcao || 'Colaborador'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {ALL_MODULES.map(mod => {
                  const enabled = !member.allowedModules || member.allowedModules.includes(mod.id);
                  if (!enabled) return null;
                  return (
                    <span key={mod.id} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-md text-[9px] font-black uppercase">
                      {mod.label}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStartEdit(member)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                title="Editar funcionário e locais"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteStaff(member.id, member.nome)}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                title="Excluir funcionário"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
