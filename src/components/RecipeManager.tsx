import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  ChevronLeft, 
  ChefHat, 
  ArrowRight,
  Package,
  AlertCircle,
  Search,
  Check,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAction } from '../lib/logs';
import { Recipe, RecipeIngredient, MACRO_INGREDIENTS } from '../types';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

interface RecipeManagerProps {
  userId: string;
  onBack: () => void;
}

export const RecipeManager: React.FC<RecipeManagerProps> = ({ userId, onBack }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductList, setShowProductList] = useState(false);
  const productListRef = React.useRef<HTMLDivElement>(null);

  // Form State
  const [productName, setProductName] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);

  const [activeIngredientIdx, setActiveIngredientIdx] = useState<number | null>(null);
  const ingredientListRef = React.useRef<HTMLDivElement>(null);

  const dataPath = 'users/shared_franquia_data/recipes';

  useEffect(() => {
    // 1. Live listener for Recipes
    const q = query(collection(db, dataPath));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Recipe));
      console.log('Receitas carregadas:', data.length);
      setRecipes(data);
      setLoading(false);
    }, (err) => {
      console.error('Erro no listener de receitas:', err);
      handleFirestoreError(err, OperationType.LIST, dataPath);
      setLoading(false);
    });

    fetchAvailableProducts();

    const handleClickOutside = (event: MouseEvent) => {
      if (productListRef.current && !productListRef.current.contains(event.target as Node)) {
        setShowProductList(false);
      }
      if (ingredientListRef.current && !ingredientListRef.current.contains(event.target as Node)) {
        setActiveIngredientIdx(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchAvailableProducts = async () => {
    try {
      const salesRef = collection(db, 'users/shared_franquia_data/sales');
      const snapshot = await getDocs(salesRef);
      const uniqueNames = new Set<string>();
      
      snapshot.docs.forEach(doc => {
        const name = doc.data().nome || doc.data().produto;
        if (name) uniqueNames.add(name);
      });

      // Default common products
      const commonProducts = [
        'Creme de Mandioquinha',
        'Caldo Verde',
        'Creme de batata com bacon e queijo',
        'Pão com Carne Suculenta',
        'Cookie Chips',
        'Cookie Triple Chocolate',
        'Croissant Tradicional',
        'Esfiha de Carne',
        'Esfiha de Queijo',
        'Coxinha de Frango',
        'Coxinha de Jaca',
        'Pão de Queijo Gouda',
        'Pão de Queijo Batata Doce',
        'Água com Gás',
        'Água sem Gás',
        'Refrigerante 350ml',
        'Refrigerante 220ml',
        'Yuba',
        'Quiche',
        'Coffee Latte'
      ];
      commonProducts.forEach(p => uniqueNames.add(p));

      // 9 Possibilities for Staff Kits (Kit Lanche)
      const drinks = ['Café espresso pequeno', 'Café com leite pequeno', 'Chocolate pequeno'];
      const snacks = ['Pão de queijo Gouda (3 unids.)', 'Pão na chapa com manteiga', 'Pão na chapa com requeijão'];
      
      const kitPossibilities = drinks.flatMap(d => 
        snacks.map(s => `Kit Lanche (Bebida: ${d} | Lanche: ${s})`)
      );

      kitPossibilities.forEach(p => uniqueNames.add(p));

      setAvailableProducts(Array.from(uniqueNames).sort());
    } catch (err) {
      console.error('Erro ao buscar produtos para autocomplete:', err);
    }
  };

  const handleSelectProduct = (name: string) => {
    setProductName(name);
    setProductSearch(name);
    setShowProductList(false);

    // Auto-fill composition for Kit Lanche if it's new
    if (name.startsWith('Kit Lanche') && ingredients.length <= 1 && (!ingredients[0]?.macroIngredient)) {
      const newIngredients: RecipeIngredient[] = [];
      
      // Detect Drink
      if (name.includes('Café espresso') || name.includes('Café com leite')) {
        newIngredients.push({ macroIngredient: 'Café em grão', quantidade: 0.007, unidade: 'kg' });
      }

      // Detect Snack
      if (name.includes('Pão de queijo Gouda')) {
        newIngredients.push({ macroIngredient: 'Pão de queijo Gouda', quantidade: 0.09, unidade: 'kg' });
      } else if (name.includes('Pão na chapa')) {
        newIngredients.push({ macroIngredient: 'Pão', quantidade: 1, unidade: 'un' });
      }

      if (newIngredients.length > 0) {
        setIngredients(newIngredients);
      }
    }
  };

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { macroIngredient: '', quantidade: 1, unidade: 'un' }]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: string | number) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value } as RecipeIngredient;
    setIngredients(newIngredients);
  };

  const resetForm = () => {
    setProductName('');
    setProductSearch('');
    setIngredients([{ macroIngredient: '', quantidade: 1, unidade: 'un' }]);
    setEditingRecipe(null);
  };

  const isFormValid = productName.trim() !== '' && ingredients.some(i => i.macroIngredient && i.quantidade > 0);

  const handleSave = async () => {
    if (!isFormValid) {
      alert('Por favor, preencha o nome do produto e pelo menos um insumo completo.');
      return;
    }

    try {
      const recipeData = {
        produtoFinal: productName,
        ingredientes: ingredients.filter(i => i.macroIngredient && i.quantidade > 0),
        userId
      };

      if (editingRecipe?.id) {
        await updateDoc(doc(db, dataPath, editingRecipe.id), recipeData);
        await logAction('Edição', 'Ficha Técnica', `Atualizou ficha técnica de "${productName}"`, 'recipes', editingRecipe.id, recipeData);
        alert('Ficha técnica atualizada com sucesso!');
      } else {
        const docRef = await addDoc(collection(db, dataPath), recipeData);
        await logAction('Criação', 'Ficha Técnica', `Cadastrou nova ficha técnica de "${productName}"`, 'recipes', docRef.id, recipeData);
        alert('Ficha técnica cadastrada com sucesso!');
      }

      resetForm();
      setShowAddForm(false);
    } catch (err) {
      console.error('Erro ao salvar ficha técnica:', err);
      handleFirestoreError(err, OperationType.WRITE, dataPath);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta ficha técnica?')) return;
    try {
      const existingRecipe = recipes.find(r => r.id === id);
      await deleteDoc(doc(db, dataPath, id));
      await logAction('Exclusão', 'Ficha Técnica', `Excluiu ficha técnica de "${existingRecipe?.produtoFinal || id}"`, 'recipes', id, existingRecipe || {});
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, dataPath);
    }
  };

  // Filter products that already have a recipe (except the one being edited)
  const availableFilteredProducts = availableProducts.filter(p => 
    !recipes.some(r => r.produtoFinal.toLowerCase() === p.toLowerCase() && r.id !== editingRecipe?.id)
  );

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-8">
      <div className="max-w-6xl mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors mb-6 text-xs font-black uppercase tracking-widest"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar ao Hub
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
              <ChefHat className="w-8 h-8 text-blue-600" />
              Fichas Técnicas
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-1">
              Defina a composição para baixa automática de estoque
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowAddForm(true); }}
            className="group bg-blue-600 text-white px-5 py-2.5 rounded-2xl shadow-lg shadow-blue-100 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            Nova Receita
          </button>
        </div>

        <AnimatePresence>
          {(showAddForm || editingRecipe) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white rounded-[2rem] p-8 shadow-2xl shadow-slate-200 border border-slate-100 mb-10"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    {editingRecipe ? 'Editar Ficha' : 'Cadastrar Composição'}
                  </h2>
                </div>
                <button 
                  onClick={() => { setShowAddForm(false); setEditingRecipe(null); }}
                  className="bg-slate-100 text-slate-500 hover:bg-slate-200 px-4 py-1.5 rounded-full font-bold text-[9px] uppercase tracking-widest transition-colors"
                >
                  Fechar
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-5 border-r border-slate-50 pr-0 lg:pr-10">
                  <div className="relative" ref={productListRef}>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                      Produto Vendido
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Busque o produto..."
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] p-4 pl-12 text-xs font-black uppercase text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-0 transition-all placeholder:text-slate-300"
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setProductName(e.target.value);
                          setShowProductList(true);
                        }}
                        onFocus={() => setShowProductList(true)}
                      />
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    </div>

                    <AnimatePresence>
                      {showProductList && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute z-[100] w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto"
                        >
                          {availableFilteredProducts
                            .filter(p => !productSearch || p.toLowerCase().includes(productSearch.toLowerCase()))
                            .map((prod, i) => (
                              <button
                                key={i}
                                onClick={() => handleSelectProduct(prod)}
                                className="w-full text-left p-4 hover:bg-blue-50 flex items-center justify-between group transition-colors border-b border-slate-50 last:border-none"
                              >
                                <span className="text-[10px] font-black uppercase text-slate-900 group-hover:text-blue-700 transition-colors">
                                  {prod}
                                </span>
                                {productName === prod && <Check className="w-3 h-3 text-emerald-500" />}
                              </button>
                            ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <p className="mt-4 text-[9px] text-blue-500 font-bold uppercase leading-relaxed">
                      * Ao vender este produto, os itens abaixo serão removidos do estoque macro.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex justify-between">
                    Insumos e Quantidades
                    <span className="text-slate-300">Defina a unidade (kg/un)</span>
                  </label>
                  
                  <div className="space-y-3" ref={ingredientListRef}>
                    {ingredients.map((ing, idx) => (
                      <motion.div 
                        layout 
                        key={idx} 
                        className="flex gap-3 items-center bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner"
                      >
                        <div className="flex-[2] relative">
                          <input
                            type="text"
                            placeholder="Buscar Insumo..."
                            className="w-full bg-transparent border-none rounded-xl p-2 text-[10px] font-black uppercase text-slate-900 focus:ring-0 placeholder:text-slate-300"
                            value={ing.macroIngredient}
                            onChange={(e) => handleIngredientChange(idx, 'macroIngredient', e.target.value)}
                            onFocus={() => setActiveIngredientIdx(idx)}
                          />
                          
                          <AnimatePresence>
                            {activeIngredientIdx === idx && (
                              <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                className="absolute z-[110] left-0 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-48 overflow-y-auto"
                              >
                                {MACRO_INGREDIENTS
                                  .filter(m => !ing.macroIngredient || m.toLowerCase().includes(ing.macroIngredient.toLowerCase()))
                                  .map((m, i) => (
                                    <button
                                      key={i}
                                      onClick={() => {
                                        handleIngredientChange(idx, 'macroIngredient', m);
                                        setActiveIngredientIdx(null);
                                      }}
                                      className="w-full text-left p-3 hover:bg-blue-50 flex items-center justify-between group transition-colors border-b border-slate-50 last:border-none"
                                    >
                                      <span className="text-[9px] font-black uppercase text-slate-700 group-hover:text-blue-700">
                                        {m}
                                      </span>
                                      {ing.macroIngredient === m && <Check className="w-2.5 h-2.5 text-emerald-500" />}
                                    </button>
                                  ))}
                                {MACRO_INGREDIENTS.filter(m => !ing.macroIngredient || m.toLowerCase().includes(ing.macroIngredient.toLowerCase())).length === 0 && (
                                  <div className="p-4 text-[9px] font-bold text-slate-400 uppercase text-center">
                                    Nenhum insumo encontrado
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="flex-1">
                          <input
                            type="number"
                            step="0.001"
                            placeholder="Qtd"
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-[10px] font-black text-center text-slate-900 focus:border-blue-500 focus:ring-0"
                            value={ing.quantidade}
                            onChange={(e) => handleIngredientChange(idx, 'quantidade', parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="w-20">
                          <select
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-[10px] font-black uppercase text-slate-900 focus:ring-0"
                            value={ing.unidade || 'un'}
                            onChange={(e) => handleIngredientChange(idx, 'unidade', e.target.value)}
                          >
                            <option value="un">un</option>
                            <option value="kg">kg</option>
                          </select>
                        </div>
                        <button
                          onClick={() => handleRemoveIngredient(idx)}
                          className="p-3 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex gap-4 mt-6">
                    <button
                      onClick={handleAddIngredient}
                      className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex items-center justify-center gap-2 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                      <Plus className="w-4 h-4" />
                      Novo Insumo
                    </button>
                    
                    <button
                      onClick={handleSave}
                      disabled={!isFormValid}
                      className="flex-1 bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-30 disabled:grayscale"
                    >
                      <Save className="w-4 h-4" />
                      Salvar Ficha
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest pl-10">Produto Final</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest">Insumos (Baixa de Estoque)</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest pr-10 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recipes.map(recipe => (
                  <tr key={recipe.id} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="p-6 pl-10">
                      <p className="text-xs font-black text-slate-900 uppercase">{recipe.produtoFinal}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">ID: {recipe.id?.slice(-6)}</p>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-wrap gap-2">
                        {recipe.ingredientes.map((ing, i) => (
                          <div key={i} className="bg-white border border-slate-100 rounded-lg px-2 py-1 flex items-center gap-2 shadow-sm">
                            <span className="text-[9px] font-black text-slate-600 uppercase">
                              {ing.macroIngredient}
                            </span>
                            <span className="text-[10px] font-black text-blue-600">
                              {ing.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: ing.unidade === 'kg' ? 3 : 2 })} 
                              <span className="ml-0.5 text-slate-400 text-[8px]">{ing.unidade || 'un'}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-6 pr-10 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingRecipe(recipe);
                            setProductName(recipe.produtoFinal);
                            setProductSearch(recipe.produtoFinal);
                            setIngredients(recipe.ingredientes);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="bg-blue-50 text-blue-600 p-2.5 rounded-xl hover:bg-blue-100 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => recipe.id && handleDelete(recipe.id)}
                          className="bg-rose-50 text-rose-500 p-2.5 rounded-xl hover:bg-rose-100 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {recipes.length === 0 && !loading && (
                  <tr>
                    <td colSpan={3} className="p-20 text-center">
                      <div className="flex flex-col items-center">
                        <AlertCircle className="w-12 h-12 text-slate-200 mb-4" />
                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Nenhuma ficha técnica cadastrada</p>
                        <p className="text-slate-300 text-[10px] mt-2 font-bold max-w-xs uppercase">
                          Cadastre as receitas para automatizar seu estoque.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
