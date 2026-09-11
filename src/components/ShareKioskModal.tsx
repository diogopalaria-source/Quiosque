import React, { useState } from 'react';
import { QrCode, Copy, Check, ExternalLink, Smartphone, X, Info, Globe } from 'lucide-react';

interface ShareKioskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareKioskModal: React.FC<ShareKioskModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build the clean URL for the kiosk / attendant
  const origin = window.location.origin;
  const currentFullUrl = window.location.href;
  const kioskUrl = `${origin}/#operacao`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(kioskUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(kioskUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Conectar Quiosque / Atendente</h3>
              <p className="text-xs text-slate-400">Sem e-mail, sem senha, acesso direto</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center bg-white p-6 rounded-2xl shadow-inner border border-slate-200">
            <img 
              src={qrCodeUrl} 
              alt="QR Code Quiosque" 
              className="w-48 h-48 object-contain rounded-lg"
              loading="eager"
            />
            <span className="text-[11px] font-semibold text-slate-500 mt-3 uppercase tracking-wider text-center">
              Aponte a câmera do celular ou tablet do quiosque
            </span>
          </div>

          {/* Direct Link Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Link Direto da Operação:</span>
              {copied && <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Link copiado!</span>}
            </label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded-xl">
              <input 
                type="text" 
                readOnly 
                value={kioskUrl} 
                className="bg-transparent text-xs text-slate-300 flex-1 outline-none px-2 font-mono truncate"
              />
              <button 
                onClick={handleCopy}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Practical guide for home screen bookmark */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> Como transformar em App no Celular/Tablet
            </h4>
            <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
              <li><strong>No iPhone/iPad (Safari):</strong> Abra o link, toque no botão <em>Compartilhar</em> (ícone quadrado com seta para cima) e selecione <strong>"Adicionar à Tela de Início"</strong>.</li>
              <li><strong>No Android (Chrome):</strong> Abra o link, toque nos <em>3 pontinhos</em> no canto superior direito e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</li>
              <li>Fica salvo como um aplicativo independente, em tela cheia e sempre pronto para os atendentes.</li>
            </ul>
          </div>

          {/* AI Studio Cloud Run Deployment notice */}
          <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Para links públicos definitivos (Fora da rede)
            </h4>
            <p className="text-xs text-blue-200/80 leading-relaxed">
              No Google AI Studio (na barra superior à direita), clique no botão <strong>"Share" (Compartilhar)</strong> para gerar a versão pública oficial permanentemente aberta na internet.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
