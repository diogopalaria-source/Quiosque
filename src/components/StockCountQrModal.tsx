import React, { useState } from 'react';
import { QrCode, Copy, Check, ExternalLink, Smartphone, X, WifiOff, PackageCheck, AlertCircle } from 'lucide-react';

interface StockCountQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDirectly?: () => void;
}

export const StockCountQrModal: React.FC<StockCountQrModalProps> = ({ 
  isOpen, 
  onClose,
  onOpenDirectly 
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build the clean URL for Stock Counting
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  // Use hash #contagem so GitHub Pages routing never returns 404
  const countUrl = `${origin}${pathname}#contagem`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(countUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(countUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">Contagem de Estoque Offline</h3>
              <p className="text-xs text-slate-400 font-medium">QR Code para o celular do atendente levar ao estoque</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center bg-white p-6 rounded-2xl shadow-inner border border-slate-200">
            <img 
              src={qrCodeUrl} 
              alt="QR Code Contagem de Estoque" 
              className="w-52 h-52 object-contain rounded-lg shadow-sm"
              loading="eager"
            />
            <span className="text-[11px] font-black text-slate-600 mt-3.5 uppercase tracking-wider text-center">
              Aponte a câmera do celular para abrir a contagem
            </span>
          </div>

          {/* Offline instruction card */}
          <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-4 space-y-2 text-emerald-200">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-300">
              <WifiOff className="w-4 h-4 text-emerald-400" />
              <span>Funciona 100% Offline no Depósito</span>
            </div>
            <p className="text-xs text-emerald-100/90 leading-relaxed font-normal">
              O atendente pode abrir no celular com a internet do quiosque e ir até o depósito (mesmo sem sinal). A digitação fica guardada no aparelho. Ao voltar para perto do quiosque com Wi-Fi, basta clicar em <strong>"Finalizar e Salvar"</strong>.
            </p>
          </div>

          {/* Automatic purchase notice */}
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Reposição Automática:</strong> Se a soma do Quiosque + Depósito estiver abaixo do <em>Estoque Mínimo</em>, o sistema gera a <strong>Solicitação de Compra</strong> no mesmo instante!
            </p>
          </div>

          {/* Action buttons: open here or copy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {onOpenDirectly && (
              <button
                onClick={() => {
                  onClose();
                  onOpenDirectly();
                }}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Abrir Neste Aparelho</span>
              </button>
            )}

            <button
              onClick={handleCopy}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700 shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Link Copiado!' : 'Copiar Link da Contagem'}</span>
            </button>
          </div>

          {/* Direct Link box */}
          <div className="text-[11px] font-mono text-slate-500 bg-slate-950 p-2.5 rounded-xl border border-slate-800 truncate text-center select-all">
            {countUrl}
          </div>
        </div>
      </div>
    </div>
  );
};
