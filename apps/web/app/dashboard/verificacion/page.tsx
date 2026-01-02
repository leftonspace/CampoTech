'use client';

/**
 * Verification Center Page
 * ========================
 *
 * Central hub for organization verification management.
 * Features:
 * - Overall verification status with marketplace visibility
 * - Alert section for issues requiring attention
 * - Tabbed interface: Mi Negocio, Empleados, Historial, Configuración
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Building2,
  Users,
  History,
  Settings,
  FileText,
  Calendar,
  Search,
  RefreshCw,
  Bell,
  Mail,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RequirementsTable, type Requirement } from '@/components/verification/RequirementsTable';
import { BadgesGrid, type Badge } from '@/components/verification/BadgesGrid';
import { EmployeeComplianceTable, type EmployeeVerification } from '@/components/verification/EmployeeComplianceTable';
import { DocumentUpload } from '@/components/verification';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type TabId = 'negocio' | 'empleados' | 'historial' | 'configuracion';

interface VerificationStatusResponse {
  success: boolean;
  type: 'organization';
  status: 'pending' | 'partial' | 'verified' | 'suspended';
  canReceiveJobs: boolean;
  marketplaceVisible: boolean;
  complianceScore: number;
  verificationCompletedAt: string | null;
  tier2: {
    total: number;
    completed: number;
    pending: number;
    inReview: number;
    rejected: number;
  };
  tier4: {
    total: number;
    earned: number;
  };
  badges: Badge[];
  activeBlocks: number;
  requirements: Requirement[];
  requiresAttention: Array<{
    code: string;
    name: string;
    status: string;
    reason: string;
  }>;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  subject: string;
  result: string;
  performedBy: string;
  metadata?: Record<string, unknown>;
}

interface NotificationSettings {
  expiryReminder: boolean;
  expiryReminderDays: number;
  rejectionAlert: boolean;
  weeklyDigest: boolean;
  employeeReminders: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchVerificationStatus(): Promise<VerificationStatusResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/verification/status', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  if (!res.ok) throw new Error('Failed to fetch verification status');
  return res.json();
}

async function fetchEmployeeVerifications(): Promise<{ data: EmployeeVerification[] }> {
  const token = localStorage.getItem('accessToken');

  // Fetch team members
  const teamRes = await fetch('/api/team', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  if (!teamRes.ok) throw new Error('Failed to fetch team');
  const teamData = await teamRes.json();

  // For each team member, get their verification status
  const employees: EmployeeVerification[] = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    teamData.data.members.map(async (member: any) => {
      try {
        const statusRes = await fetch(`/api/verification/status?userId=${member.id}`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        });

        if (!statusRes.ok) {
          // Return default status if API fails
          return {
            userId: member.id,
            name: member.name || 'Sin nombre',
            email: member.email,
            avatar: member.avatar,
            role: member.role,
            status: 'not_started' as const,
            canWork: true,
            pendingDocs: 0,
            completedDocs: 0,
            totalDocs: 0,
            nextExpiry: null,
            daysUntilExpiry: null,
            isExpiringSoon: false,
            issues: [],
          };
        }

        const status = await statusRes.json();

        if (status.type !== 'user') {
          return {
            userId: member.id,
            name: member.name || 'Sin nombre',
            email: member.email,
            avatar: member.avatar,
            role: member.role,
            status: 'not_started' as const,
            canWork: true,
            pendingDocs: 0,
            completedDocs: 0,
            totalDocs: 0,
            nextExpiry: null,
            daysUntilExpiry: null,
            isExpiringSoon: false,
            issues: [],
          };
        }

        // Find nearest expiry
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expiringReqs = status.requirements.filter((r: any) => r.expiresAt);
        let nextExpiry: string | null = null;
        let daysUntilExpiry: number | null = null;
        let isExpiringSoon = false;

        if (expiringReqs.length > 0) {
          const sorted = expiringReqs.sort(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any, b: any) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
          );
          nextExpiry = sorted[0].expiresAt;
          daysUntilExpiry = sorted[0].daysUntilExpiry;
          isExpiringSoon = sorted[0].isExpiringSoon;
        }

        return {
          userId: member.id,
          name: member.name || 'Sin nombre',
          email: member.email,
          avatar: member.avatar,
          role: member.role,
          status: status.status,
          canWork: status.canBeAssignedJobs,
          pendingDocs: status.tier3?.pending || 0,
          completedDocs: status.tier3?.completed || 0,
          totalDocs: status.tier3?.total || 0,
          nextExpiry,
          daysUntilExpiry,
          isExpiringSoon,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          issues: status.requiresAttention.map((r: any) => r.reason),
        };
      } catch (error) {
        console.error(`Error fetching status for user ${member.id}:`, error);
        return {
          userId: member.id,
          name: member.name || 'Sin nombre',
          email: member.email,
          avatar: member.avatar,
          role: member.role,
          status: 'not_started' as const,
          canWork: true,
          pendingDocs: 0,
          completedDocs: 0,
          totalDocs: 0,
          nextExpiry: null,
          daysUntilExpiry: null,
          isExpiringSoon: false,
          issues: [],
        };
      }
    })
  );

  return { data: employees };
}

async function fetchAuditLog(filters: {
  startDate?: string;
  endDate?: string;
  entityType?: string;
  userId?: string;
}): Promise<{ data: AuditLogEntry[] }> {
  // In a real implementation, this would fetch from an audit API
  // For now, return mock data
  return {
    data: [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        action: 'CREATE',
        entityType: 'verification_submission',
        entityId: 'sub-1',
        subject: 'Constancia CUIT',
        result: 'Enviado para revisión',
        performedBy: 'Juan Pérez',
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        action: 'UPDATE',
        entityType: 'verification_submission',
        entityId: 'sub-2',
        subject: 'Habilitación Municipal',
        result: 'Aprobado',
        performedBy: 'Sistema',
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        action: 'UPDATE',
        entityType: 'verification_submission',
        entityId: 'sub-3',
        subject: 'DNI - María García',
        result: 'Rechazado: Imagen borrosa',
        performedBy: 'Admin',
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  pending: {
    label: 'Incompleto',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Clock,
  },
  partial: {
    label: 'Incompleto',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: AlertTriangle,
  },
  verified: {
    label: 'Verificado',
    color: 'bg-success-100 text-success-800 border-success-200',
    icon: CheckCircle,
  },
  suspended: {
    label: 'Suspendido',
    color: 'bg-danger-100 text-danger-800 border-danger-200',
    icon: XCircle,
  },
};

function VerificationStatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border',
        config.color
      )}
    >
      <Icon className="h-4 w-4" />
      {config.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT SECTION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface AlertSectionProps {
  alerts: Array<{
    code: string;
    name: string;
    status: string;
    reason: string;
  }>;
  onResolve: (code: string) => void;
}

function AlertSection({ alerts, onResolve }: AlertSectionProps) {
  if (alerts.length === 0) return null;

  const getAlertIcon = (status: string) => {
    switch (status) {
      case 'expired':
        return <AlertCircle className="h-5 w-5 text-danger-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-danger-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    }
  };

  const getAlertColor = (status: string) => {
    return status === 'expired' || status === 'rejected'
      ? 'border-danger-200 bg-danger-50'
      : 'border-amber-200 bg-amber-50';
  };

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-gray-900 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        Requiere atención ({alerts.length})
      </h3>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.code}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border',
              getAlertColor(alert.status)
            )}
          >
            <div className="flex items-center gap-3">
              {getAlertIcon(alert.status)}
              <div>
                <p className="font-medium text-gray-900 text-sm">{alert.name}</p>
                <p className="text-xs text-gray-600">{alert.reason}</p>
              </div>
            </div>
            <button
              onClick={() => onResolve(alert.code)}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Resolver
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB NAVIGATION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  employeeCount?: number;
}

function TabNavigation({ activeTab, onTabChange, employeeCount }: TabNavigationProps) {
  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'negocio', label: 'Mi Negocio', icon: Building2 },
    { id: 'empleados', label: 'Empleados', icon: Users },
    { id: 'historial', label: 'Historial', icon: History },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.id === 'empleados' && employeeCount !== undefined && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                {employeeCount}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY TAB COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function HistoryTab() {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    entityType: '',
    userId: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', filters],
    queryFn: () => fetchAuditLog(filters),
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      CREATE: 'Creación',
      UPDATE: 'Actualización',
      DELETE: 'Eliminación',
      VIEW: 'Visualización',
    };
    return labels[action] || action;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Desde</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos</option>
            <option value="verification_submission">Documentos</option>
            <option value="badge">Badges</option>
            <option value="block">Bloqueos</option>
          </select>
        </div>
      </div>

      {/* Log entries */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent mx-auto" />
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha/Hora
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acción
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Elemento
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Resultado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Por
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data?.data.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(entry.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {getActionLabel(entry.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    {entry.subject}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {entry.result}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {entry.performedBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(!data?.data || data.data.length === 0) && (
            <div className="text-center py-12 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay actividad registrada.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS TAB COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsTab() {
  const [settings, setSettings] = useState<NotificationSettings>({
    expiryReminder: true,
    expiryReminderDays: 30,
    rejectionAlert: true,
    weeklyDigest: false,
    employeeReminders: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // In a real implementation, save to API
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-medium text-gray-900 mb-4">Notificaciones de Verificación</h3>

        <div className="space-y-4">
          {/* Expiry reminder */}
          <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Recordatorio de vencimiento</p>
                <p className="text-xs text-gray-500 mt-1">
                  Recibir alertas cuando los documentos estén por vencer
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.expiryReminder}
                onChange={(e) => setSettings({ ...settings, expiryReminder: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {/* Days before expiry */}
          {settings.expiryReminder && (
            <div className="ml-8 flex items-center gap-3">
              <label className="text-sm text-gray-600">Notificar</label>
              <select
                value={settings.expiryReminderDays}
                onChange={(e) => setSettings({ ...settings, expiryReminderDays: Number(e.target.value) })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={7}>7 días</option>
                <option value={14}>14 días</option>
                <option value={30}>30 días</option>
                <option value={60}>60 días</option>
              </select>
              <span className="text-sm text-gray-600">antes del vencimiento</span>
            </div>
          )}

          {/* Rejection alert */}
          <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Alerta de rechazo</p>
                <p className="text-xs text-gray-500 mt-1">
                  Notificación inmediata cuando un documento es rechazado
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.rejectionAlert}
                onChange={(e) => setSettings({ ...settings, rejectionAlert: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {/* Weekly digest */}
          <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Resumen semanal</p>
                <p className="text-xs text-gray-500 mt-1">
                  Email semanal con el estado de verificación del equipo
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.weeklyDigest}
                onChange={(e) => setSettings({ ...settings, weeklyDigest: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {/* Employee reminders */}
          <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Recordatorios a empleados</p>
                <p className="text-xs text-gray-500 mt-1">
                  Enviar recordatorios automáticos a empleados con documentos pendientes
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.employeeReminders}
                onChange={(e) => setSettings({ ...settings, employeeReminders: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT UPLOAD MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirementCode: string;
  requirementName: string;
  onUploadComplete: () => void;
}

function UploadModal({ isOpen, onClose, requirementCode, requirementName, onUploadComplete }: UploadModalProps) {
  if (!isOpen) return null;

  const handleUploadComplete = () => {
    onUploadComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Subir: {requirementName}
        </h2>

        <DocumentUpload
          requirementCode={requirementCode}
          onUploadComplete={handleUploadComplete}
          onUploadError={(error: string) => console.error('Upload error:', error)}
        />

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function VerificacionPage() {
  const [activeTab, setActiveTab] = useState<TabId>('negocio');
  const [uploadModal, setUploadModal] = useState<{ code: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  // Fetch verification status
  const { data: status, isLoading, error, refetch } = useQuery({
    queryKey: ['verification-status'],
    queryFn: fetchVerificationStatus,
  });

  // Fetch employee verifications
  const { data: employeesData } = useQuery({
    queryKey: ['employee-verifications'],
    queryFn: fetchEmployeeVerifications,
    enabled: activeTab === 'empleados',
  });

  // Handle actions
  const handleUpload = (code: string) => {
    const req = status?.requirements.find((r) => r.code === code);
    if (req) {
      setUploadModal({ code, name: req.name });
    }
  };

  const handleUpdate = (code: string) => {
    const req = status?.requirements.find((r) => r.code === code);
    if (req) {
      setUploadModal({ code, name: req.name });
    }
  };

  const handleViewReason = (requirement: Requirement) => {
    alert(`Motivo de rechazo:\n\n${requirement.rejectionReason || 'Sin motivo especificado'}`);
  };

  const handleViewDocument = (requirement: Requirement) => {
    if (requirement.documentUrl) {
      window.open(requirement.documentUrl, '_blank');
    }
  };

  const handleObtainBadge = (code: string) => {
    handleUpload(code);
  };

  const handleRenewBadge = (code: string) => {
    handleUpdate(code);
  };

  const handleViewEmployeeDetails = (userId: string) => {
    // Navigate to employee verification details
    window.location.href = `/dashboard/team/${userId}/verificacion`;
  };

  const handleSendReminder = async (userId: string) => {
    // In a real implementation, send reminder via API
    alert('Recordatorio enviado');
  };

  const handleResolveAlert = (code: string) => {
    handleUpload(code);
  };

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['verification-status'] });
    queryClient.invalidateQueries({ queryKey: ['employee-verifications'] });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  // Error state
  if (error || !status) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-md bg-danger-50 p-4 text-danger-700">
          Error al cargar el estado de verificación. Por favor, intentá de nuevo.
        </div>
      </div>
    );
  }

  // Prepare badges data for BadgesGrid
  const badgesForGrid: Badge[] = status.requirements
    .filter((r) => r.tier === 4)
    .map((r) => {
      const earnedBadge = status.badges.find((b) => b.code === r.code);
      return {
        code: r.code,
        name: r.name,
        description: r.description,
        icon: earnedBadge?.icon || null,
        label: earnedBadge?.label || null,
        earnedAt: earnedBadge?.earnedAt ? String(earnedBadge.earnedAt) : undefined,
        expiresAt: r.expiresAt,
        isValid: earnedBadge?.isValid ?? false,
        isEarned: r.status === 'approved',
        isExpiringSoon: r.isExpiringSoon,
        daysUntilExpiry: r.daysUntilExpiry,
      };
    });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary-100">
            <Shield className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Centro de Verificación</h1>
            <p className="text-gray-500">Gestiona la documentación y estado de tu negocio</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Status badge */}
          <VerificationStatusBadge status={status.status} />

          {/* Marketplace visibility */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
              status.marketplaceVisible
                ? 'border-success-200 bg-success-50 text-success-700'
                : 'border-gray-200 bg-gray-50 text-gray-600'
            )}
          >
            <Store className="h-4 w-4" />
            {status.marketplaceVisible ? 'Visible en marketplace' : 'No visible'}
          </div>

          {/* Refresh button */}
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Progreso de verificación
          </span>
          <span className="text-sm text-gray-500">
            {status.tier2.completed}/{status.tier2.total} requisitos completados
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${(status.tier2.completed / status.tier2.total) * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-success-500" />
            {status.tier2.completed} aprobados
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            {status.tier2.inReview} en revisión
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
            {status.tier2.pending} pendientes
          </span>
          {status.tier2.rejected > 0 && (
            <span className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-danger-500" />
              {status.tier2.rejected} rechazados
            </span>
          )}
        </div>
      </div>

      {/* Alerts section */}
      {status.requiresAttention.length > 0 && (
        <div className="card p-4">
          <AlertSection alerts={status.requiresAttention} onResolve={handleResolveAlert} />
        </div>
      )}

      {/* Tab navigation */}
      <div className="card">
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          employeeCount={employeesData?.data.length}
        />

        {/* Tab content */}
        <div className="p-6">
          {/* Mi Negocio tab */}
          {activeTab === 'negocio' && (
            <div className="space-y-8">
              {/* Requirements table */}
              <RequirementsTable
                requirements={status.requirements.filter((r) => r.tier === 2)}
                onUpload={handleUpload}
                onUpdate={handleUpdate}
                onViewReason={handleViewReason}
                onViewDocument={handleViewDocument}
              />

              {/* Badges grid */}
              {badgesForGrid.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Badges Opcionales</h3>
                  <BadgesGrid
                    badges={badgesForGrid}
                    onObtain={handleObtainBadge}
                    onRenew={handleRenewBadge}
                  />
                </div>
              )}
            </div>
          )}

          {/* Empleados tab */}
          {activeTab === 'empleados' && (
            <EmployeeComplianceTable
              employees={employeesData?.data || []}
              onViewDetails={handleViewEmployeeDetails}
              onSendReminder={handleSendReminder}
            />
          )}

          {/* Historial tab */}
          {activeTab === 'historial' && <HistoryTab />}

          {/* Configuración tab */}
          {activeTab === 'configuracion' && <SettingsTab />}
        </div>
      </div>

      {/* Upload modal */}
      {uploadModal && (
        <UploadModal
          isOpen={true}
          onClose={() => setUploadModal(null)}
          requirementCode={uploadModal.code}
          requirementName={uploadModal.name}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </div>
  );
}
