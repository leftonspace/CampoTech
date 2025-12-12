'use client';

import { LockedField } from './locked-field';
import { AlertTriangle } from 'lucide-react';

export interface FieldMeta {
  visible: boolean;
  editable: boolean;
  locked: boolean;
  message?: string;
  requiresApproval?: boolean;
}

interface PermissionFieldProps {
  name: string;
  label: string;
  value: string | number | null | undefined;
  meta: FieldMeta;
  onChange?: (value: string) => void;
  type?: 'text' | 'email' | 'number' | 'tel' | 'date' | 'password';
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * PermissionField component renders a form field based on user permissions
 * - If not visible: returns null
 * - If locked/not editable: renders as LockedField
 * - If editable but requires approval: shows warning
 * - If editable: renders normal input
 */
export function PermissionField({
  name,
  label,
  value,
  meta,
  onChange,
  type = 'text',
  placeholder,
  className = '',
  disabled = false,
}: PermissionFieldProps) {
  // Field not visible to this user
  if (!meta.visible) {
    return null;
  }

  // Field is locked or not editable
  if (meta.locked || !meta.editable) {
    return <LockedField label={label} value={value} message={meta.message} className={className} />;
  }

  // Field requires approval - show warning
  const showApprovalWarning = meta.requiresApproval;

  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={name} className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {label}
        {showApprovalWarning && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            requiere aprobacion
          </span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value !== null && value !== undefined ? String(value) : ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
          showApprovalWarning ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}

interface PermissionTextareaProps extends Omit<PermissionFieldProps, 'type'> {
  rows?: number;
}

/**
 * PermissionTextarea component for multi-line text input with permissions
 */
export function PermissionTextarea({
  name,
  label,
  value,
  meta,
  onChange,
  placeholder,
  className = '',
  disabled = false,
  rows = 3,
}: PermissionTextareaProps) {
  // Field not visible to this user
  if (!meta.visible) {
    return null;
  }

  // Field is locked or not editable
  if (meta.locked || !meta.editable) {
    return <LockedField label={label} value={value} message={meta.message} className={className} />;
  }

  const showApprovalWarning = meta.requiresApproval;

  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={name} className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {label}
        {showApprovalWarning && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            requiere aprobacion
          </span>
        )}
      </label>
      <textarea
        id={name}
        name={name}
        value={value !== null && value !== undefined ? String(value) : ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
          showApprovalWarning ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}

interface PermissionSelectProps extends Omit<PermissionFieldProps, 'type' | 'onChange'> {
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
}

/**
 * PermissionSelect component for dropdown selections with permissions
 */
export function PermissionSelect({
  name,
  label,
  value,
  meta,
  onChange,
  options,
  placeholder,
  className = '',
  disabled = false,
}: PermissionSelectProps) {
  // Field not visible to this user
  if (!meta.visible) {
    return null;
  }

  // Field is locked or not editable
  if (meta.locked || !meta.editable) {
    const displayValue = options.find((opt) => opt.value === value)?.label || value;
    return <LockedField label={label} value={displayValue} message={meta.message} className={className} />;
  }

  const showApprovalWarning = meta.requiresApproval;

  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={name} className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {label}
        {showApprovalWarning && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            requiere aprobacion
          </span>
        )}
      </label>
      <select
        id={name}
        name={name}
        value={value !== null && value !== undefined ? String(value) : ''}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
          showApprovalWarning ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface RestrictedSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  visible: boolean;
  className?: string;
}

/**
 * RestrictedSection component wraps restricted fields
 * Only renders if visible is true
 */
export function RestrictedSection({
  title,
  description,
  children,
  visible,
  className = '',
}: RestrictedSectionProps) {
  if (!visible) {
    return null;
  }

  return (
    <section className={`border rounded-lg p-4 border-amber-200 bg-amber-50 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">!</span>
        </div>
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
      {description && <p className="text-sm text-amber-700 mt-4">{description}</p>}
    </section>
  );
}
