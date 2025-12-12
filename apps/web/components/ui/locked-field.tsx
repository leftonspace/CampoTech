'use client';

import { Lock, Info } from 'lucide-react';

interface LockedFieldProps {
  label: string;
  value: string | number | null | undefined;
  message?: string;
  className?: string;
}

/**
 * LockedField component displays a field that cannot be edited
 * with a lock icon and tooltip message explaining why
 */
export function LockedField({ label, value, message, className = '' }: LockedFieldProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="relative group">
          <Lock className="h-3.5 w-3.5 text-gray-400 cursor-help" />
          {message && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 max-w-xs">
              {message}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          )}
        </div>
      </div>
      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600 select-none">
        {value !== null && value !== undefined && value !== '' ? String(value) : '-'}
      </div>
    </div>
  );
}

interface LockedFieldGroupProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * LockedFieldGroup component wraps a group of locked fields
 * with a section header and description
 */
export function LockedFieldGroup({ title, description, children, className = '' }: LockedFieldGroupProps) {
  return (
    <section className={`border rounded-lg p-4 bg-gray-50 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Lock className="h-4 w-4 text-gray-500" />
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
      {description && (
        <p className="text-sm text-gray-500 mt-4 flex items-start gap-2">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {description}
        </p>
      )}
    </section>
  );
}
