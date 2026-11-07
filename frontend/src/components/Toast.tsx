import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 99999,
        maxWidth: '380px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertCircle : Info;
        const iconColor = toast.type === 'success' ? '#4ADE80' : toast.type === 'error' ? '#EF4444' : '#60A5FA';
        const borderColor = toast.type === 'success' ? 'rgba(74,222,128,0.3)' : toast.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(96,165,250,0.3)';

        return (
          <div
            key={toast.id}
            className="animate-fade-in"
            style={{
              pointerEvents: 'auto',
              background: '#15151B',
              border: `1px solid ${borderColor}`,
              borderRadius: '16px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
              color: '#F4F4F5',
            }}
          >
            <Icon size={20} color={iconColor} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <strong style={{ fontSize: '14px', fontWeight: 600 }}>{toast.title}</strong>
              {toast.description && (
                <span style={{ fontSize: '13px', color: '#A1A1AA', lineHeight: 1.4 }}>
                  {toast.description}
                </span>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                background: 'transparent',
                border: 0,
                color: '#71717A',
                cursor: 'pointer',
                padding: '2px',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
