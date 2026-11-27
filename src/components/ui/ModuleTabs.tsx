import {useId, type ReactNode} from 'react';

export function ModuleTabs<T extends string>({tabs, value, onChange, label, children}: {
  tabs: readonly {id: T; label: string}[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label={label}
        className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-[#E2DDD5] bg-white p-1"
        onKeyDown={(event) => {
          const index = tabs.findIndex((tab) => tab.id === value);
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
            : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault();
          const tab = tabs[next];
          onChange(tab.id);
          document.getElementById(id + '-tab-' + tab.id)?.focus();
        }}>
        {tabs.map((tab) => (
          <button key={tab.id} id={id + '-tab-' + tab.id} type="button" role="tab"
            aria-selected={value === tab.id} aria-controls={id + '-panel'} tabIndex={value === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={'rounded-lg px-4 py-2 text-sm font-semibold transition-colors ' + (
              value === tab.id ? 'bg-[#173640] text-white' : 'text-[#173640] hover:bg-[#F2EFE9]'
            )}>
            {tab.label}
          </button>
        ))}
      </div>
      <div id={id + '-panel'} role="tabpanel" tabIndex={0} aria-labelledby={id + '-tab-' + value} className="space-y-5">
        {children}
      </div>
    </div>
  );
}
