import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Save, 
  RefreshCw, 
  Trash2,
  Percent,
  Check,
  AlertCircle,
  Plus,
  ArrowLeft,
  Pencil,
  X
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { FIXED_STAFF_PRODUCTS, StaffProduct } from './WasteRegistration';
import { StaffDiscountOverride } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { logAction } from '../lib/logs';

interface StaffDiscountManagerProps {
  dataPath: string;
  overrides: StaffDiscountOverride[];
  onBack?: () => void;
}

export const StaffDiscountManager: React.FC<StaffDiscountManagerProps> = ({
  dataPath,
  overrides,
  onBack
}) => {
  const [customStaffProducts, setCustomStaffProducts] = useState<StaffProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPercents, setEditingPercents] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal para adicionar/editar produto de consumo
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StaffProduct | null>(null);
  const [productForm, setProductForm] = useState({
    nome: '',
    precoCheio: '',
    descontoPercent: '50'
  });

  // Fetch custom staff products from Firestore
  useEffect(() => {
    const fetchCustomProducts = async () => {
      try {
        const colRef = collection(db, `${dataPath}/staffProducts`);
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const loaded: StaffProduct[] = [];
          snap.forEach(d => {
            loaded.push({ id: d.id, ...d.data() } as StaffProduct);
          });
          setCustomStaffProducts(loaded);
        }
      } catch (err) {
        console.error('Error fetching custom staff products:', err);
      }
    };
    if (dataPath) {
      fetchCustomProducts();
    }
  }, [dataPath]);

  // Combined staff products list (FIXED + Custom)
  const allStaffProducts = useMemo(() => {
    const map = new Map<string, StaffProduct>();
    // First load fixed
    FIXED_STAFF_PRODUCTS.forEach(p => map.set(p.id, p));
    // Override/add custom
    customStaffProducts.forEach(p => map.set(p.id, p));
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [customStaffProducts]);

  const [localOverrides, setLocalOverrides] = useState<StaffDiscountOverride[]>(overrides || []);

  useEffect(() => {
    if (overrides) {
      setLocalOverrides(overrides);
    }
  }, [overrides]);

  // Map overrides by product ID for quick access
  const overridesMap = useMemo(() => {
    const map: Record<string, StaffDiscountOverride> = {};
    localOverrides.forEach(o => {
      if (o.productId) {
        map[o.productId] = o;
      }
    });
    return map;
  }, [localOverrides]);

  // Compute final lists with both original and override
  const productsWithDiscounts = useMemo(() => {
    return allStaffProducts.map(p => {
      const override = overridesMap[p.id];
      const actualDiscount = override ? override.descontoPercent : p.descontoPercent;
      const isOverridden = !!override;
      return {
        ...p,
        actualDiscount,
        isOverridden,
        originalDiscount: p.descontoPercent,
      };
    });
  }, [allStaffProducts, overridesMap]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return productsWithDiscounts;
    return productsWithDiscounts.filter(p => 
      p.nome.toLowerCase().includes(term) || p.id === term
    );
  }, [productsWithDiscounts, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const total = productsWithDiscounts.length;
    const customized = productsWithDiscounts.filter(p => p.isOverridden).length;
    const average = productsWithDiscounts.length > 0 
      ? Math.round(productsWithDiscounts.reduce((sum, p) => sum + p.actualDiscount, 0) / total)
      : 0;

    return { total, customized, average };
  }, [productsWithDiscounts]);

  // Save manual override helper
  const handleSaveOverride = async (product: StaffProduct, customPercentStr: string) => {
    const cleanPercent = customPercentStr.trim();
    if (cleanPercent === '') return;

    const percentVal = parseInt(cleanPercent, 10);
    if (isNaN(percentVal) || percentVal < 0 || percentVal > 100) {
      alert('Por favor, digite um percentual válido de 0 a 100.');
      return;
    }

    setSavingId(product.id);
    setErrorMsg(null);

    try {
      const docRef = doc(db, `${dataPath}/staffDiscountOverrides`, product.id);
      const newOverride: StaffDiscountOverride = {
        productId: product.id,
        productName: product.nome,
        descontoPercent: percentVal,
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, newOverride);

      setLocalOverrides(prev => {
        const next = [...prev.filter(o => o.productId !== product.id), newOverride];
        return next;
      });
      window.dispatchEvent(new CustomEvent('staff-overrides-updated', { detail: newOverride }));

      await logAction('Edição', 'Ajuste Desconto', `Alterado desconto do produto "${product.nome}" para ${percentVal}% (Padrão: ${product.descontoPercent}%)`, 'staffDiscountOverrides', product.id, { percentVal });

      const updatedEditing = { ...editingPercents };
      delete updatedEditing[product.id];
      setEditingPercents(updatedEditing);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Falha ao salvar desconto customizado: ${err.message || err}`);
    } finally {
      setSavingId(null);
    }
  };

  // Reset override helper
  const handleResetOverride = async (product: StaffProduct) => {
    setSavingId(product.id);
    setErrorMsg(null);

    try {
      const docRef = doc(db, `${dataPath}/staffDiscountOverrides`, product.id);
      await deleteDoc(docRef);

      setLocalOverrides(prev => prev.filter(o => o.productId !== product.id));
      window.dispatchEvent(new CustomEvent('staff-overrides-deleted', { detail: product.id }));

      await logAction('Exclusão', 'Ajuste Desconto', `Restaurado desconto padrão do produto "${product.nome}" para ${product.descontoPercent}%`, 'staffDiscountOverrides', product.id, {});

      const updatedEditing = { ...editingPercents };
      delete updatedEditing[product.id];
      setEditingPercents(updatedEditing);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Falha ao restaurar desconto original: ${err.message || err}`);
    } finally {
      setSavingId(null);
    }
  };

  // Save / Add Staff Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.nome.trim()) {
      alert('Informe o nome do produto.');
      return;
    }
    const preco = parseFloat(productForm.precoCheio);
    if (isNaN(preco) || preco < 0) {
      alert('Informe um preço cheio válido.');
      return;
    }
    const desc = parseInt(productForm.descontoPercent, 10);
    if (isNaN(desc) || desc < 0 || desc > 100) {
      alert('Informe um percentual válido de 0 a 100.');
      return;
    }

    try {
      const id = editingProduct ? editingProduct.id : 'custom_' + Date.now();
      const productToSave: StaffProduct = {
        id,
        nome: productForm.nome.trim(),
        precoCheio: preco,
        descontoPercent: desc
      };

      await setDoc(doc(db, `${dataPath}/staffProducts`, id), {
        ...productToSave,
        updatedAt: serverTimestamp()
      });

      setCustomStaffProducts(prev => {
        const exists = prev.find(p => p.id === id);
        if (exists) {
          return prev.map(p => p.id === id ? productToSave : p);
        } else {
          return [...prev, productToSave];
        }
      });

      await logAction(editingProduct ? 'Edição' : 'Criação', 'Produtos Consumo', `${editingProduct ? 'Atualizou' : 'Adicionou'} produto "${productToSave.nome}" para consumo`, 'staffProducts', id, productToSave);

      setShowProductModal(false);
      setEditingProduct(null);
      setProductForm({ nome: '', precoCheio: '', descontoPercent: '50' });
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar produto de consumo.');
    }
  };

  // Delete Staff Product
  const handleDeleteProduct = async (product: StaffProduct) => {
    if (!confirm(`Tem certeza que deseja excluir "${product.nome}" dos produtos disponíveis para consumo?`)) return;
    try {
      await deleteDoc(doc(db, `${dataPath}/staffProducts`, product.id));
      setCustomStaffProducts(prev => prev.filter(p => p.id !== product.id));
      await logAction('Exclusão', 'Produtos Consumo', `Removeu produto "${product.nome}" do consumo`, 'staffProducts', product.id, { nome: product.nome });
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir produto.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32" id="discount-manager-root">
      
      {/* Banner / Header info */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-[2.5rem] p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12 select-none">
          <Percent className="w-96 h-96" />
        </div>
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="flex items-center justify-between">
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black uppercase tracking-wider backdrop-blur-sm transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao Menu</span>
              </button>
            )}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/30 border border-emerald-400/20 rounded-full text-emerald-100 text-[10px] font-black uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-ping"></span>
              Acesso Exclusivo - Administrador
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">
            Ajuste de Descontos e Produtos para Consumo
          </h1>
          <p className="text-emerald-100/90 text-sm leading-relaxed font-medium">
            Gerencie os produtos disponíveis para consumo dos funcionários, adicione novos itens, altere preços e configure descontos personalizados.
          </p>
        </div>
      </div>

      {/* KPI Cards & Add Button */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-slate-50 text-slate-500 rounded-2xl">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Produtos</p>
            <p className="text-2xl font-black text-slate-850 mt-1">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Descontos Ajustados</p>
            <p className="text-2xl font-black text-slate-850 mt-1">{stats.customized} <span className="text-xs text-slate-400 font-bold uppercase">sobrescritos</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Desconto Médio Geral</p>
            <p className="text-2xl font-black text-slate-850 mt-1">{stats.average}%</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setProductForm({ nome: '', precoCheio: '', descontoPercent: '50' });
              setShowProductModal(true);
            }}
            className="w-full h-full py-4 px-6 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Incluir Novo Produto</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200/55 p-4 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 opacity-90 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-7 relative border border-slate-100">
            <button 
              onClick={() => setShowProductModal(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-800 transition-colors rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">
              {editingProduct ? 'Editar Produto de Consumo' : 'Adicionar Novo Produto para Consumo'}
            </h3>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Nome do Produto</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pão de Queijo Especial"
                  value={productForm.nome}
                  onChange={e => setProductForm({ ...productForm, nome: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Preço Cheio (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Ex: 15.00"
                  value={productForm.precoCheio}
                  onChange={e => setProductForm({ ...productForm, precoCheio: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Desconto Padrão (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={productForm.descontoPercent}
                  onChange={e => setProductForm({ ...productForm, descontoPercent: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Pesquisar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Exibindo {filteredProducts.length} de {productsWithDiscounts.length} produtos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="py-4 px-6">Produto Disponível</th>
                <th className="py-4 px-6 text-right">Preço Cheio</th>
                <th className="py-4 px-6 text-center">Desconto Efetivo (%)</th>
                <th className="py-4 px-6 text-right">Preço com Desconto</th>
                <th className="py-4 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-semibold">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const currentInputValue = editingPercents[p.id] !== undefined ? editingPercents[p.id] : p.actualDiscount.toString();
                  const isDirty = editingPercents[p.id] !== undefined && editingPercents[p.id] !== p.actualDiscount.toString();
                  const finalPriceWithDiscount = p.precoCheio * (1 - p.actualDiscount / 100);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900">{p.nome}</span>
                          {p.isOverridden && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[9px] font-black uppercase">
                              Ajustado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right text-slate-500">
                        {formatCurrency(p.precoCheio)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 max-w-[120px] mx-auto">
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            value={currentInputValue}
                            onChange={(e) => setEditingPercents({ ...editingPercents, [p.id]: e.target.value })}
                            className="w-12 text-center font-black text-slate-900 bg-transparent focus:outline-hidden"
                          />
                          <span className="text-slate-400 text-xs">%</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right text-emerald-600 font-extrabold">
                        {formatCurrency(finalPriceWithDiscount)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit custom product button if custom */}
                          {p.id.startsWith('custom_') && (
                            <button
                              onClick={() => {
                                setEditingProduct(p);
                                setProductForm({
                                  nome: p.nome,
                                  precoCheio: p.precoCheio.toString(),
                                  descontoPercent: p.descontoPercent.toString()
                                });
                                setShowProductModal(true);
                              }}
                              className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all"
                              title="Editar produto"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}

                          {p.id.startsWith('custom_') && (
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all"
                              title="Excluir produto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          {p.isOverridden && !p.id.startsWith('custom_') && (
                            <button
                              onClick={() => handleResetOverride(p)}
                              disabled={savingId === p.id}
                              title="Restaurar desconto padrão"
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleSaveOverride(p, currentInputValue)}
                            disabled={savingId === p.id || (!isDirty && p.actualDiscount === parseInt(currentInputValue, 10))}
                            className={cn(
                              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-40",
                              isDirty 
                                ? "bg-blue-600 text-white shadow-sm shadow-blue-100 hover:bg-blue-700" 
                                : p.isOverridden
                                  ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  : "bg-emerald-50/50 text-emerald-600 hover:bg-emerald-50 border border-emerald-100/40"
                            )}
                          >
                            {savingId === p.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            {isDirty ? 'Salvar' : 'Gravar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
