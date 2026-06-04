import React, { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--spacing-md)',
      }}
      onClick={onClose}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        animation: 'fadeIn 150ms ease-out',
      }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'var(--color-white)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          padding: 'var(--spacing-xl)',
          maxWidth: 500, width: '100%',
          animation: 'fadeIn 200ms ease-out',
        }}
      >
        {title && (
          <h2 style={{
            fontSize: '1.25rem', fontWeight: 700,
            color: 'var(--color-dark)', marginBottom: 'var(--spacing-md)',
          }}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}