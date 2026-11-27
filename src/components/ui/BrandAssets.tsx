import React, {useState} from 'react';
import {Download, Pause, Play, WifiOff, X} from 'lucide-react';
import {useOnlineStatus, usePWAInstall} from '../../hooks/usePWAInstall';

export function EnapVidaLogo({className = 'max-w-40'}: {className?: string}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}enap-e-vida.png`}
      alt="Enap e-Vida"
      width={1542}
      height={162}
      className={`h-auto object-contain ${className}`}
    />
  );
}

/**
 * Faixa geométrica modular inspirada nas páginas 1, 7, 8 e 10 do RGI 2025.
 * Decorativa (aria-hidden), sem interferir na leitura de formulários ou conteúdos.
 */
export const RgiGeometricStrip: React.FC<{className?: string}> = ({className = 'h-3 w-full'}) => (
  <svg
    viewBox="0 0 600 24"
    preserveAspectRatio="none"
    aria-hidden="true"
    className={className}
  >
    <rect x="0" y="0" width="120" height="24" fill="#173640" />
    <path d="M0 24 A24 24 0 0 1 24 0 L120 0 L120 24 Z" fill="#285D32" opacity="0.65" />
    <rect x="120" y="0" width="120" height="24" fill="#285D32" />
    <circle cx="180" cy="12" r="9" fill="#939C22" />
    <rect x="240" y="0" width="120" height="24" fill="#939C22" />
    <path d="M240 0 A24 24 0 0 1 264 24 L240 24 Z" fill="#FFF2DE" />
    <rect x="360" y="0" width="120" height="24" fill="#218FA3" />
    <circle cx="420" cy="12" r="8" fill="#173640" />
    <rect x="480" y="0" width="120" height="24" fill="#173640" />
    <path d="M540 0 L600 0 L600 24 A24 24 0 0 1 576 0 Z" fill="#FF8500" />
  </svg>
);

const launchAnnouncement = 'O Enap e-Vida chegou! Um novo jeito de se conectar, participar e viver a Enap. Acolhimento, bem-estar, atividades, eventos e participação em um só lugar.';

export function NewsTicker() {
  const [paused, setPaused] = useState(false);

  return (
    <section
      aria-label="Comunicado"
      className="flex items-center gap-2 border-b border-[#218FA3]/30 bg-[#173640] px-4 text-xs font-medium text-[#FFF2DE]"
    >
      <div className="min-w-0 flex-1 overflow-hidden py-2">
        <div className="news-ticker-track" data-paused={paused}>
          <span>{launchAnnouncement}</span>
          <span aria-hidden="true">{launchAnnouncement}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused(!paused)}
        aria-label={paused ? 'Retomar comunicado' : 'Pausar comunicado'}
        className="shrink-0 rounded p-1.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFF2DE] motion-reduce:hidden"
      >
        {paused ? <Play className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
      </button>
    </section>
  );
}

export const PWAInstallButton: React.FC<{compact?: boolean}> = ({compact = false}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#173640]/20 bg-[#FFF2DE] px-3 py-1.5 text-xs font-semibold text-[#173640] hover:bg-[#f6e3c2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{compact ? 'Instalar' : 'Instalar aplicativo'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#173640]/20 bg-[#FFF2DE] px-3 py-1.5 text-xs font-semibold text-[#173640] hover:bg-[#f6e3c2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Instalar no iOS</span>
        </button>
        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ios-pwa-title"
              className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl border border-[#E2DDD5]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 id="ios-pwa-title" className="text-base font-bold text-[#173640]">
                  Instalar Enap e-Vida no iPhone ou iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Fechar orientações"
                  className="p-1 text-[#5F666A] hover:text-[#231F20] rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-sm text-[#4A4F52] list-decimal list-inside">
                <li>Toque no botão <strong>Compartilhar</strong> na barra do Safari.</li>
                <li>Role as opções e selecione <strong>Adicionar à Tela de Início</strong>.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#173640] py-2 text-sm font-semibold text-white hover:bg-[#0F272F]"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-[#710F10] px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-4 h-4" aria-hidden="true" />
      <span>Modo sem conexão — apenas recursos estáticos seguros estão disponíveis.</span>
    </div>
  );
};
