'use client';

import { ReactNode } from 'react';

interface WhatsAppLayoutProps {
  children: ReactNode;
}

export default function WhatsAppLayout({ children }: WhatsAppLayoutProps) {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
