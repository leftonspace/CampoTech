'use client';

import {
  FileText,
  Calendar,
  MapPin,
  Receipt,
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  color?: string;
}

interface QuickActionsProps {
  onSendTemplate: () => void;
  onScheduleJob?: () => void;
  onSendLocation?: () => void;
  onSendInvoice?: () => void;
  customActions?: QuickAction[];
}

export default function QuickActions({
  onSendTemplate,
  onScheduleJob,
  onSendLocation,
  onSendInvoice,
  customActions = [] }: QuickActionsProps) {
  const defaultActions: QuickAction[] = [
    {
      id: 'template',
      label: 'Enviar template',
      icon: FileText,
      action: onSendTemplate,
      color: 'primary'
    },
  ];

  if (onScheduleJob) {
    defaultActions.push({
      id: 'schedule',
      label: 'Programar trabajo',
      icon: Calendar,
      action: onScheduleJob,
      color: 'success'
    });
  }

  if (onSendLocation) {
    defaultActions.push({
      id: 'location',
      label: 'Enviar ubicacion',
      icon: MapPin,
      action: onSendLocation,
      color: 'danger'
    });
  }

  if (onSendInvoice) {
    defaultActions.push({
      id: 'invoice',
      label: 'Enviar factura',
      icon: Receipt,
      action: onSendInvoice,
      color: 'warning'
    });
  }

  const allActions = [...defaultActions, ...customActions];

  const getColorClasses = (color?: string) => {
    switch (color) {
      case 'primary':
        return 'bg-primary-50 text-primary-600 hover:bg-primary-100';
      case 'success':
        return 'bg-success-50 text-success-600 hover:bg-success-100';
      case 'danger':
        return 'bg-danger-50 text-danger-600 hover:bg-danger-100';
      case 'warning':
        return 'bg-warning-50 text-warning-600 hover:bg-warning-100';
      default:
        return 'bg-gray-50 text-gray-600 hover:bg-gray-100';
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {allActions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={action.action}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors ${getColorClasses(action.color)}`}
          >
            <Icon className="h-4 w-4" />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
