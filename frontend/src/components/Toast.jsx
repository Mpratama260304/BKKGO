// Tiny toast/notification system. Wrap app in <ToastProvider>; call useToast().push(...).
import { createContext, useCallback, useContext, useState } from 'react';

const ToastCtx = createContext({ push: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((msg, type = 'info', timeout = 3500) => {
    const id = Math.random().toString(36).slice(2);
    setItems((arr) => [...arr, { id, msg, type }]);
    if (timeout) setTimeout(() => setItems((arr) => arr.filter((t) => t.id !== id)), timeout);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-lg shadow-lg text-sm text-white max-w-sm ${
              t.type === 'error' ? 'bg-red-600'
                : t.type === 'success' ? 'bg-emerald-600'
                  : t.type === 'warn' ? 'bg-amber-600'
                    : 'bg-slate-800'
            }`}
          >{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
