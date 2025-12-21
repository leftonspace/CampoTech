'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatCUIT, formatPhone, formatDate, formatCurrency, IVA_CONDITION_LABELS } from '@/lib/utils';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Briefcase,
  Save,
  X,
  MessageCircle,
} from 'lucide-react';
import { generateCustomerWhatsAppLink } from '@/lib/whatsapp-links';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cuit?: string;
  ivaCondition: string;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
  };
  notes?: string;
  jobs?: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  invoices?: Array<{
    id: string;
    invoiceType: string;
    number?: number;
    total: number;
    status: string;
    createdAt: string;
  }>;
}

const COUNTRY_CODES = [
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
];

const IVA_CONDITIONS = [
  { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' },
  { value: 'MONOTRIBUTISTA', label: 'Monotributista' },
  { value: 'EXENTO', label: 'Exento' },
];

const JOB_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const customerId = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Customer>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.customers.get(customerId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Customer>) => api.customers.update(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.customers.delete(customerId),
    onSuccess: () => {
      router.push('/dashboard/customers');
    },
  });

  const customer = data?.data as Customer | undefined;

  const handleEdit = () => {
    if (customer) {
      setEditData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        cuit: customer.cuit || '',
        ivaCondition: customer.ivaCondition,
        address: customer.address || { street: '', city: '', postalCode: '' },
        notes: customer.notes || '',
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const handleDelete = () => {
    if (confirm('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) {
      deleteMutation.mutate();
    }
  };

  const formatCuit = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/customers"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cliente no encontrado</h1>
          </div>
        </div>
        <div className="card p-8 text-center">
          <p className="text-gray-500">Este cliente no existe o no tenés acceso.</p>
          <Link href="/dashboard/customers" className="btn-primary mt-4 inline-flex">
            Volver a clientes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/customers"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="text-gray-500">
            {IVA_CONDITION_LABELS[customer.ivaCondition] || customer.ivaCondition}
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="btn-outline">
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="btn-primary"
              >
                <Save className="mr-2 h-4 w-4" />
                {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          ) : (
            <>
              <button onClick={handleEdit} className="btn-outline">
                <Edit2 className="mr-2 h-4 w-4" />
                Editar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="btn-outline text-danger-600 hover:bg-danger-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Customer info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Información del cliente</h2>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="label mb-1 block">Nombre / Razón social</label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Teléfono</label>
                  <input
                    type="tel"
                    value={editData.phone || ''}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Email</label>
                  <input
                    type="email"
                    value={editData.email || ''}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label mb-1 block">CUIT</label>
                    <input
                      type="text"
                      value={formatCuit(editData.cuit || '')}
                      onChange={(e) => setEditData({ ...editData, cuit: e.target.value })}
                      placeholder="XX-XXXXXXXX-X"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">Condición IVA</label>
                    <select
                      value={editData.ivaCondition || 'CONSUMIDOR_FINAL'}
                      onChange={(e) => setEditData({ ...editData, ivaCondition: e.target.value })}
                      className="input"
                    >
                      {IVA_CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label mb-1 block">Dirección</label>
                  <input
                    type="text"
                    value={editData.address?.street || ''}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        address: { ...editData.address, street: e.target.value },
                      })
                    }
                    placeholder="Calle y número"
                    className="input mb-2"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={editData.address?.city || ''}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          address: { ...editData.address, city: e.target.value },
                        })
                      }
                      placeholder="Ciudad"
                      className="input"
                    />
                    <input
                      type="text"
                      value={editData.address?.postalCode || ''}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          address: { ...editData.address, postalCode: e.target.value },
                        })
                      }
                      placeholder="Código postal"
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="label mb-1 block">Notas</label>
                  <textarea
                    value={editData.notes || ''}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    rows={3}
                    className="input"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <a href={`tel:${customer.phone}`} className="text-primary-600 hover:underline">
                    {formatPhone(customer.phone)}
                  </a>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <a href={`mailto:${customer.email}`} className="text-primary-600 hover:underline">
                      {customer.email}
                    </a>
                  </div>
                )}
                {customer.cuit && (
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <span>CUIT: {formatCUIT(customer.cuit)}</span>
                  </div>
                )}
                {customer.address?.street && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <span>
                      {customer.address.street}
                      {customer.address.city && `, ${customer.address.city}`}
                      {customer.address.postalCode && ` (${customer.address.postalCode})`}
                    </span>
                  </div>
                )}
                {customer.notes && (
                  <div className="mt-4 rounded-md bg-gray-50 p-3">
                    <p className="text-sm text-gray-600">{customer.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Acciones rápidas</h2>
            <div className="space-y-2">
              {/* WhatsApp button */}
              {customer.phone && (
                <a
                  href={generateCustomerWhatsAppLink(customer.phone, customer.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline w-full justify-center bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Enviar WhatsApp
                </a>
              )}
              <Link
                href={`/dashboard/jobs/new?customerId=${customer.id}`}
                className="btn-primary w-full justify-center"
              >
                <Briefcase className="mr-2 h-4 w-4" />
                Nuevo trabajo
              </Link>
              <Link
                href={`/dashboard/invoices/new?customerId=${customer.id}`}
                className="btn-outline w-full justify-center"
              >
                <FileText className="mr-2 h-4 w-4" />
                Nueva factura
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Estadísticas</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Trabajos</span>
                <span className="font-medium">{customer.jobs?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Facturas</span>
                <span className="font-medium">{customer.invoices?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent jobs */}
      {customer.jobs && customer.jobs.length > 0 && (
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Trabajos recientes</h2>
            <Link href={`/dashboard/jobs?customerId=${customer.id}`} className="text-sm text-primary-600 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="divide-y">
            {customer.jobs.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
              >
                <div>
                  <p className="font-medium text-gray-900">{job.title}</p>
                  <p className="text-sm text-gray-500">{formatDate(job.createdAt)}</p>
                </div>
                <span className="text-sm text-gray-500">
                  {JOB_STATUS_LABELS[job.status] || job.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent invoices */}
      {customer.invoices && customer.invoices.length > 0 && (
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Facturas recientes</h2>
            <Link href={`/dashboard/invoices?customerId=${customer.id}`} className="text-sm text-primary-600 hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="divide-y">
            {customer.invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/dashboard/invoices/${invoice.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {invoice.invoiceType} {invoice.number ? `#${invoice.number}` : '(borrador)'}
                  </p>
                  <p className="text-sm text-gray-500">{formatDate(invoice.createdAt)}</p>
                </div>
                <span className="font-medium text-gray-900">
                  {formatCurrency(invoice.total)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
