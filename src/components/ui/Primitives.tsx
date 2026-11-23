import React, {createContext, useCallback, useContext, useState} from 'react';
import {AlertCircle, CheckCircle2, Info, X} from 'lucide-react';

// ============================================================================
// Toast Notifications (feedback acessível <= 200ms)
// ============================================================================
interface ToastItem {
  id: string;
  tone: 'success' | 'error' | 'info';
  message: string;
}

const ToastContext = createContext<{
  pushToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
} | null>(null);

export const ToastProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((message: string, tone: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-2), {id, tone, message}]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{pushToast}}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-20 md:bottom-5 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
      >
        {toasts.map((t) => {
          const styles =
            t.tone === 'success'
              ? 'bg-[#0B3D1E] text-white border-[#285D32]'
              : t.tone === 'error'
                ? 'bg-[#710F10] text-white border-[#ED2124]'
                : 'bg-[#173640] text-white border-[#218FA3]';
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertCircle : Info;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${styles}`}
            >
              <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                aria-label="Fechar mensagem"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="opacity-80 hover:opacity-100 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider.');
  return ctx;
}

// ============================================================================
// Design System Core Components (§5.4)
// ============================================================================

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
  }
> = ({variant = 'primary', size = 'md', className = '', type = 'button', ...props}) => {
  const variants = {
    primary: 'bg-[#173640] text-white hover:bg-[#0F272F] disabled:bg-[#173640]/50',
    secondary: 'bg-[#285D32] text-white hover:bg-[#1E4726] disabled:bg-[#285D32]/50',
    accent: 'bg-[#FF8500] text-[#173640] font-bold hover:bg-[#E67700] disabled:bg-[#FF8500]/50',
    outline:
      'bg-white text-[#173640] border border-[#C5BEB2] hover:bg-[#F2EFE9] disabled:opacity-50',
    ghost: 'bg-transparent text-[#173640] hover:bg-[#F2EFE9] disabled:opacity-50',
    danger: 'bg-[#710F10] text-white hover:bg-[#5A0B0C] disabled:bg-[#710F10]/50',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs min-h-[36px]',
    md: 'px-4 py-2 text-sm min-h-[42px]',
    lg: 'px-5 py-2.5 text-base min-h-[46px]',
  };
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
};

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  warm?: boolean;
}> = ({children, className = '', warm = false}) => (
  <div
    className={`rounded-xl border border-[#E2DDD5] ${
      warm ? 'bg-[#FFF2DE]/65' : 'bg-white'
    } ${className}`}
  >
    {children}
  </div>
);

export const Field: React.FC<{
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}> = ({id, label, required, hint, error, children}) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium text-[#231F20]">
      {label}
      {required && (
        <span className="text-[#8E1113] ml-1" aria-hidden="true">
          *
        </span>
      )}
    </label>
    {children}
    {hint && !error && <p className="text-xs text-[#5F666A]">{hint}</p>}
    {error && (
      <p role="alert" className="text-xs font-medium text-[#8E1113] flex items-center gap-1">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </p>
    )}
  </div>
);

export const inputBaseClass =
  'w-full rounded-lg border border-[#C5BEB2] bg-white px-3.5 py-2.5 text-sm text-[#231F20] placeholder:text-[#767D81] focus:border-[#218FA3] focus:outline-none min-h-[42px] disabled:bg-[#F2EFE9] disabled:text-[#5F666A]';

export const ProgressBar: React.FC<{
  value: number;
  label?: string;
  sublabel?: string;
}> = ({value, label, sublabel}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-1.5">
      {(label || sublabel) && (
        <div className="flex items-center justify-between gap-2 text-xs font-medium">
          <span className="text-[#231F20]">{label}</span>
          <span className="text-[#173640] font-bold tabular-nums">{sublabel || `${clamped}%`}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progresso'}
        className="h-2.5 w-full overflow-hidden rounded-full bg-[#E8E4DC]"
      >
        <div
          className="h-full rounded-full bg-[#285D32] transition-all duration-300"
          style={{width: `${clamped}%`}}
        />
      </div>
    </div>
  );
};

export const AlertBox: React.FC<{
  tone?: 'info' | 'warning' | 'success' | 'error';
  title?: string;
  children: React.ReactNode;
  className?: string;
}> = ({tone = 'info', title, children, className = ''}) => {
  const styles = {
    info: 'bg-[#E7F4F7] border-[#218FA3]/35 text-[#105563]',
    warning: 'bg-[#FEF5E6] border-[#FF8500]/40 text-[#7A3E00]',
    success: 'bg-[#EAF4EC] border-[#285D32]/35 text-[#164A21]',
    error: 'bg-[#FCECEC] border-[#ED2124]/35 text-[#8E1113]',
  };
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'note'}
      className={`rounded-xl border p-4 text-sm flex items-start gap-3 ${styles[tone]} ${className}`}
    >
      <Icon className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {title && <p className="font-bold">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}> = ({open, onClose, title, children, maxWidthClass = 'max-w-2xl'}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#173640]/55 p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="evida-modal-title"
        className={`w-full ${maxWidthClass} rounded-2xl bg-white border border-[#E2DDD5] shadow-2xl my-8 overflow-hidden`}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E2DDD5] bg-[#FAF8F4]">
          <h2 id="evida-modal-title" className="text-lg font-bold text-[#173640]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="rounded-lg p-1.5 text-[#5F666A] hover:bg-[#E8E4DC] hover:text-[#231F20] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[78vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const PageHeader: React.FC<{
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({kicker, title, description, actions}) => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#E2DDD5]">
    <div className="space-y-1 max-w-3xl">
      {kicker && <p className="text-xs font-semibold tracking-wide text-[#186F80]">{kicker}</p>}
      <h1 className="text-2xl sm:text-3xl font-extrabold text-[#173640] text-balance tracking-tight">
        {title}
      </h1>
      {description && <p className="text-sm sm:text-base text-[#4A4F52]">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({title, description, action}) => (
  <div className="rounded-xl border border-dashed border-[#C5BEB2] bg-[#FAF8F4] px-6 py-10 text-center space-y-2">
    <p className="text-base font-bold text-[#173640]">{title}</p>
    <p className="text-sm text-[#5F666A] max-w-md mx-auto">{description}</p>
    {action && <div className="pt-2">{action}</div>}
  </div>
);

export const SkeletonBlock: React.FC<{rows?: number}> = ({rows = 3}) => (
  <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Carregando conteúdo">
    {Array.from({length: rows}).map((_, idx) => (
      <div key={idx} className="h-16 rounded-xl bg-[#EAE6DE]" />
    ))}
  </div>
);
