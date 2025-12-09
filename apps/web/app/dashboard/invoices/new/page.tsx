'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatCurrency, IVA_CONDITION_LABELS } from '@/lib/utils';
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  FileText,
  Calculator,
  AlertCircle,
} from 'lucide-react';
import { Customer, InvoiceLineItem } from '@/types';

interface LineItemInput {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  ivaRate: number;
}

const IVA_RATES = [
  { value: 21, label: '21%' },
  { value: 10.5, label: '10.5%' },
  { value: 27, label: '27%' },
  { value: 0, label: 'Exento (0%)' },
];

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId');
  const preselectedJobId = searchParams.get('jobId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState({
    invoiceType: 'B' as 'A' | 'B' | 'C',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    jobId: preselectedJobId || '',
  });

  const [lineItems, setLineItems] = useState<LineItemInput[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, ivaRate: 21 },
  ]);

  // Fetch customer if preselected
  const { data: preselectedCustomerData } = useQuery({
    queryKey: ['customer', preselectedCustomerId],
    queryFn: () => api.customers.get(preselectedCustomerId!),
    enabled: !!preselectedCustomerId && !selectedCustomer,
  });

  // Fetch pricebook items for autocomplete
  const { data: pricebookData } = useQuery({
    queryKey: ['pricebook'],
    queryFn: () => api.settings.pricebook.list(),
  });

  // Search customers
  const { data: customersData } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => api.customers.search(customerSearch),
    enabled: customerSearch.length > 2 && !selectedCustomer,
  });

  // Set preselected customer
  useEffect(() => {
    if (preselectedCustomerData?.data && !selectedCustomer) {
      setSelectedCustomer(preselectedCustomerData.data as Customer);
    }
  }, [preselectedCustomerData, selectedCustomer]);

  // Determine invoice type based on customer IVA condition
  useEffect(() => {
    if (selectedCustomer) {
      const ivaCondition = selectedCustomer.ivaCondition;
      let invoiceType: 'A' | 'B' | 'C' = 'B';

      if (ivaCondition === 'responsable_inscripto') {
        invoiceType = 'A';
      } else if (ivaCondition === 'consumidor_final' || ivaCondition === 'exento') {
        invoiceType = 'B';
      } else if (ivaCondition === 'monotributista') {
        invoiceType = 'C';
      }

      setFormData((prev) => ({ ...prev, invoiceType }));
    }
  }, [selectedCustomer]);

  // Calculate due date (30 days from issue date)
  useEffect(() => {
    if (formData.issueDate && !formData.dueDate) {
      const issue = new Date(formData.issueDate);
      issue.setDate(issue.getDate() + 30);
      setFormData((prev) => ({
        ...prev,
        dueDate: issue.toISOString().split('T')[0],
      }));
    }
  }, [formData.issueDate, formData.dueDate]);

  const customers = customersData?.data as Customer[] | undefined;
  const pricebook = pricebookData?.data as Array<{
    id: string;
    name: string;
    price: number;
    ivaRate: number;
  }> | undefined;

  // Calculate totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalIva = 0;

    lineItems.forEach((item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemIva = (itemSubtotal * item.ivaRate) / 100;
      subtotal += itemSubtotal;
      totalIva += itemIva;
    });

    return {
      subtotal,
      totalIva,
      total: subtotal + totalIva,
    };
  }, [lineItems]);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        ivaRate: 21,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItemInput, value: string | number) => {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const selectPricebookItem = (itemId: string, pricebookItem: { name: string; price: number; ivaRate: number }) => {
    updateLineItem(itemId, 'description', pricebookItem.name);
    updateLineItem(itemId, 'unitPrice', pricebookItem.price);
    updateLineItem(itemId, 'ivaRate', pricebookItem.ivaRate);
  };

  const handleSubmit = async (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault();

    if (!selectedCustomer) {
      setError('Seleccioná un cliente');
      return;
    }

    const validItems = lineItems.filter((item) => item.description && item.quantity > 0);
    if (validItems.length === 0) {
      setError('Agregá al menos un ítem a la factura');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const invoiceData = {
      customerId: selectedCustomer.id,
      invoiceType: formData.invoiceType,
      issueDate: formData.issueDate,
      dueDate: formData.dueDate,
      notes: formData.notes,
      jobId: formData.jobId || undefined,
      lineItems: validItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        ivaRate: item.ivaRate,
      })),
      asDraft,
    };

    const response = await api.invoices.create(invoiceData);

    if (response.success) {
      router.push('/dashboard/invoices');
    } else {
      setError(response.error?.message || 'Error al crear la factura');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/invoices"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva factura</h1>
          <p className="text-gray-500">Crear factura electrónica AFIP</p>
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Customer selection */}
        <div className="card p-6">
          <h2 className="mb-4 font-medium text-gray-900">Cliente</h2>

          {selectedCustomer ? (
            <div className="flex items-start justify-between rounded-md border bg-gray-50 p-4">
              <div>
                <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
                {selectedCustomer.cuit && (
                  <p className="text-sm text-gray-500">CUIT: {selectedCustomer.cuit}</p>
                )}
                <p className="text-sm text-gray-500">
                  {IVA_CONDITION_LABELS[selectedCustomer.ivaCondition] || selectedCustomer.ivaCondition}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-sm text-primary-600 hover:underline"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Buscar cliente por nombre, teléfono o CUIT..."
                className="input pl-10"
              />
              {customers && customers.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomerSearch('');
                      }}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-gray-500">
                          {IVA_CONDITION_LABELS[customer.ivaCondition] || customer.ivaCondition}
                        </p>
                      </div>
                      {customer.cuit && (
                        <span className="text-sm text-gray-500">{customer.cuit}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Link
            href="/dashboard/customers/new"
            className="mt-2 inline-block text-sm text-primary-600 hover:underline"
          >
            + Crear nuevo cliente
          </Link>
        </div>

        {/* Invoice details */}
        <div className="card p-6">
          <h2 className="mb-4 font-medium text-gray-900">Datos de la factura</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="invoiceType" className="label mb-1 block">
                Tipo de comprobante
              </label>
              <select
                id="invoiceType"
                value={formData.invoiceType}
                onChange={(e) => setFormData({ ...formData, invoiceType: e.target.value as 'A' | 'B' | 'C' })}
                className="input"
              >
                <option value="A">Factura A</option>
                <option value="B">Factura B</option>
                <option value="C">Factura C</option>
              </select>
              {selectedCustomer && (
                <p className="mt-1 text-xs text-gray-500">
                  Sugerido por condición IVA del cliente
                </p>
              )}
            </div>
            <div>
              <label htmlFor="issueDate" className="label mb-1 block">
                Fecha de emisión
              </label>
              <input
                id="issueDate"
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="dueDate" className="label mb-1 block">
                Fecha de vencimiento
              </label>
              <input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Conceptos</h2>
            <button
              type="button"
              onClick={addLineItem}
              className="btn-outline text-sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              Agregar ítem
            </button>
          </div>

          <div className="space-y-4">
            {lineItems.map((item, index) => (
              <div
                key={item.id}
                className="grid gap-4 rounded-lg border p-4 sm:grid-cols-12"
              >
                <div className="sm:col-span-5">
                  <label className="label mb-1 block text-xs">Descripción</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      placeholder="Descripción del servicio o producto"
                      className="input"
                      list={`pricebook-${item.id}`}
                    />
                    {pricebook && pricebook.length > 0 && (
                      <datalist id={`pricebook-${item.id}`}>
                        {pricebook.map((pb) => (
                          <option key={pb.id} value={pb.name} />
                        ))}
                      </datalist>
                    )}
                  </div>
                  {pricebook && pricebook.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {pricebook.slice(0, 3).map((pb) => (
                        <button
                          key={pb.id}
                          type="button"
                          onClick={() => selectPricebookItem(item.id, pb)}
                          className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200"
                        >
                          {pb.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="label mb-1 block text-xs">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label mb-1 block text-xs">Precio unitario</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label mb-1 block text-xs">IVA</label>
                  <select
                    value={item.ivaRate}
                    onChange={(e) => updateLineItem(item.id, 'ivaRate', parseFloat(e.target.value))}
                    className="input"
                  >
                    {IVA_RATES.map((rate) => (
                      <option key={rate.value} value={rate.value}>
                        {rate.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeLineItem(item.id)}
                    disabled={lineItems.length === 1}
                    className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-danger-500 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IVA</span>
                <span>{formatCurrency(totals.totalIva)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-6">
          <h2 className="mb-4 font-medium text-gray-900">Observaciones</h2>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Notas adicionales para la factura..."
            rows={3}
            className="input"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-danger-50 p-4 text-danger-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Link href="/dashboard/invoices" className="btn-outline">
            Cancelar
          </Link>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={isSubmitting}
            className="btn-outline"
          >
            <FileText className="mr-2 h-4 w-4" />
            Guardar borrador
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            <Calculator className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Procesando...' : 'Emitir factura'}
          </button>
        </div>
      </form>
    </div>
  );
}
