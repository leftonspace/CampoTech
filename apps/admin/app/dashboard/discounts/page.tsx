'use client';

import { useState, useEffect } from 'react';

interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: string;
  percentageOff: number | null;
  freeMonths: number | null;
  fixedAmountOff: number | null;
  combinedFreeMonths: number | null;
  combinedPercentageOff: number | null;
  combinedPercentageMonths: number | null;
  applicableTiers: string[];
  applicableCycles: string[];
  maxTotalUses: number | null;
  maxUsesPerOrg: number;
  currentUses: number;
  usageCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  isExpired: boolean;
  createdAt: string;
}

interface GlobalDiscount {
  id: string;
  name: string;
  description: string | null;
  discountType: string;
  percentageOff: number | null;
  freeMonths: number | null;
  fixedAmountOff: number | null;
  combinedFreeMonths: number | null;
  combinedPercentageOff: number | null;
  combinedPercentageMonths: number | null;
  applicableTiers: string[];
  applicableCycles: string[];
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  isExpired: boolean;
  bannerText: string | null;
  badgeText: string | null;
  createdAt: string;
}

interface PricingSettings {
  id: string;
  defaultAnnualDiscount: number;
  showDiscountsPublicly: boolean;
}

type Tab = 'coupons' | 'global' | 'settings';
type DiscountType = 'PERCENTAGE' | 'FREE_MONTHS' | 'FIXED_AMOUNT' | 'COMBINED';

const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: 'Porcentaje',
  FREE_MONTHS: 'Meses Gratis',
  FIXED_AMOUNT: 'Monto Fijo',
  COMBINED: 'Combinado',
};

const TIER_LABELS: Record<string, string> = {
  INICIAL: 'Inicial',
  PROFESIONAL: 'Profesional',
  EMPRESA: 'Empresa',
};

export default function DiscountsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('coupons');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [globalDiscounts, setGlobalDiscounts] = useState<GlobalDiscount[]>([]);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'coupon' | 'global'>('coupon');
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discountType: 'PERCENTAGE' as DiscountType,
    percentageOff: '',
    freeMonths: '',
    fixedAmountOff: '',
    combinedFreeMonths: '',
    combinedPercentageOff: '',
    combinedPercentageMonths: '',
    applicableTiers: [] as string[],
    applicableCycles: [] as string[],
    maxTotalUses: '',
    maxUsesPerOrg: '1',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
    bannerText: '',
    badgeText: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/discounts');
      const data = await res.json();

      if (data.success) {
        setCoupons(data.data.coupons?.items || []);
        setGlobalDiscounts(data.data.globalDiscounts?.items || []);
        setPricingSettings(data.data.pricingSettings);
      }
    } catch (error) {
      console.error('Error fetching discounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDiscount = async () => {
    try {
      setSaving(true);

      const payload: any = {
        type: createType,
        name: formData.name,
        description: formData.description || null,
        discountType: formData.discountType,
        validFrom: formData.validFrom,
        validUntil: formData.validUntil,
        isActive: formData.isActive,
        applicableTiers: formData.applicableTiers,
        applicableCycles: formData.applicableCycles,
      };

      if (createType === 'coupon') {
        payload.code = formData.code;
        payload.maxTotalUses = formData.maxTotalUses ? parseInt(formData.maxTotalUses) : null;
        payload.maxUsesPerOrg = parseInt(formData.maxUsesPerOrg) || 1;
      } else {
        payload.bannerText = formData.bannerText || null;
        payload.badgeText = formData.badgeText || null;
      }

      // Add discount-specific fields
      switch (formData.discountType) {
        case 'PERCENTAGE':
          payload.percentageOff = parseFloat(formData.percentageOff) || 0;
          break;
        case 'FREE_MONTHS':
          payload.freeMonths = parseInt(formData.freeMonths) || 0;
          break;
        case 'FIXED_AMOUNT':
          payload.fixedAmountOff = parseFloat(formData.fixedAmountOff) || 0;
          break;
        case 'COMBINED':
          payload.combinedFreeMonths = parseInt(formData.combinedFreeMonths) || 0;
          payload.combinedPercentageOff = parseFloat(formData.combinedPercentageOff) || 0;
          payload.combinedPercentageMonths = parseInt(formData.combinedPercentageMonths) || 0;
          break;
      }

      const res = await fetch('/api/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setShowCreateModal(false);
        resetForm();
        fetchData();
      } else {
        alert(data.error || 'Error creating discount');
      }
    } catch (error) {
      console.error('Error creating discount:', error);
      alert('Error creating discount');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, type: 'coupon' | 'global', currentState: boolean) => {
    try {
      const res = await fetch(`/api/admin/discounts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          action: currentState ? 'deactivate' : 'activate',
        }),
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Error');
      }
    } catch (error) {
      console.error('Error toggling discount:', error);
    }
  };

  const handleDelete = async (id: string, type: 'coupon' | 'global') => {
    if (!confirm('¿Estás seguro de eliminar este descuento?')) return;

    try {
      const res = await fetch(`/api/admin/discounts/${id}?type=${type}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Error');
      }
    } catch (error) {
      console.error('Error deleting discount:', error);
    }
  };

  const handleUpdatePricingSettings = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pricing_settings',
          id: pricingSettings?.id,
          defaultAnnualDiscount: pricingSettings?.defaultAnnualDiscount,
          showDiscountsPublicly: pricingSettings?.showDiscountsPublicly,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('Configuración guardada');
        fetchData();
      } else {
        alert(data.error || 'Error');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      discountType: 'PERCENTAGE',
      percentageOff: '',
      freeMonths: '',
      fixedAmountOff: '',
      combinedFreeMonths: '',
      combinedPercentageOff: '',
      combinedPercentageMonths: '',
      applicableTiers: [],
      applicableCycles: [],
      maxTotalUses: '',
      maxUsesPerOrg: '1',
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      bannerText: '',
      badgeText: '',
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDiscountValue = (discount: Coupon | GlobalDiscount) => {
    switch (discount.discountType) {
      case 'PERCENTAGE':
        return `${discount.percentageOff}%`;
      case 'FREE_MONTHS':
        return `${discount.freeMonths} mes${(discount.freeMonths || 0) > 1 ? 'es' : ''} gratis`;
      case 'FIXED_AMOUNT':
        return `$${discount.fixedAmountOff?.toLocaleString('es-AR')}`;
      case 'COMBINED':
        return `${discount.combinedFreeMonths}m + ${discount.combinedPercentageOff}%`;
      default:
        return '-';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Descuentos y Cupones</h1>
          <p className="text-gray-500">Gestiona promociones, códigos de descuento y precios</p>
        </div>
        <button
          onClick={() => {
            setCreateType(activeTab === 'global' ? 'global' : 'coupon');
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo {activeTab === 'global' ? 'Descuento Global' : 'Cupón'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: 'coupons', label: 'Códigos de Cupón', count: coupons.length },
            { id: 'global', label: 'Descuentos Globales', count: globalDiscounts.length },
            { id: 'settings', label: 'Configuración' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Coupons Tab */}
      {activeTab === 'coupons' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descuento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validez</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No hay cupones creados
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                        {coupon.code}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{coupon.name}</div>
                      {coupon.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">{coupon.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium">{formatDiscountValue(coupon)}</span>
                      <div className="text-xs text-gray-500">
                        {DISCOUNT_TYPE_LABELS[coupon.discountType as DiscountType]}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">
                        {coupon.currentUses}/{coupon.maxTotalUses || '∞'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(coupon.validFrom)} - {formatDate(coupon.validUntil)}
                    </td>
                    <td className="px-6 py-4">
                      {coupon.isExpired ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                          Expirado
                        </span>
                      ) : coupon.isActive ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          Activo
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleToggleActive(coupon.id, 'coupon', coupon.isActive)}
                        className="text-gray-400 hover:text-blue-600"
                        title={coupon.isActive ? 'Desactivar' : 'Activar'}
                      >
                        {coupon.isActive ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(coupon.id, 'coupon')}
                        className="text-gray-400 hover:text-red-600"
                        title="Eliminar"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Global Discounts Tab */}
      {activeTab === 'global' && (
        <div className="space-y-4">
          {/* Active promotion banner */}
          {globalDiscounts.some((g) => g.isActive && !g.isExpired) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-medium text-green-800">Promoción activa: </span>
                <span className="text-green-700">
                  {globalDiscounts.find((g) => g.isActive && !g.isExpired)?.name}
                </span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descuento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Banner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validez</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {globalDiscounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No hay descuentos globales creados
                    </td>
                  </tr>
                ) : (
                  globalDiscounts.map((discount) => (
                    <tr key={discount.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{discount.name}</div>
                        {discount.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">{discount.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium">{formatDiscountValue(discount)}</span>
                        <div className="text-xs text-gray-500">
                          {DISCOUNT_TYPE_LABELS[discount.discountType as DiscountType]}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {discount.bannerText || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(discount.validFrom)} - {formatDate(discount.validUntil)}
                      </td>
                      <td className="px-6 py-4">
                        {discount.isExpired ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            Expirado
                          </span>
                        ) : discount.isActive ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            Activo
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleToggleActive(discount.id, 'global', discount.isActive)}
                          className="text-gray-400 hover:text-blue-600"
                          title={discount.isActive ? 'Desactivar' : 'Activar'}
                        >
                          {discount.isActive ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(discount.id, 'global')}
                          className="text-gray-400 hover:text-red-600"
                          title="Eliminar"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && pricingSettings && (
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Configuración de Precios</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descuento anual por defecto (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={pricingSettings.defaultAnnualDiscount}
                onChange={(e) =>
                  setPricingSettings({
                    ...pricingSettings,
                    defaultAnnualDiscount: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Porcentaje de ahorro que se muestra para planes anuales
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showDiscounts"
                checked={pricingSettings.showDiscountsPublicly}
                onChange={(e) =>
                  setPricingSettings({
                    ...pricingSettings,
                    showDiscountsPublicly: e.target.checked,
                  })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="showDiscounts" className="text-sm text-gray-700">
                Mostrar descuentos globales públicamente en la página de precios
              </label>
            </div>

            <button
              onClick={handleUpdatePricingSettings}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Crear {createType === 'coupon' ? 'Cupón' : 'Descuento Global'}
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Type selector */}
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => setCreateType('coupon')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    createType === 'coupon'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Código de Cupón
                </button>
                <button
                  onClick={() => setCreateType('global')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    createType === 'global'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Descuento Global
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Code (only for coupons) */}
              {createType === 'coupon' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código del cupón *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="SUMMER2025"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Promoción de verano"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Discount Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de descuento *</label>
                <select
                  value={formData.discountType}
                  onChange={(e) => setFormData({ ...formData, discountType: e.target.value as DiscountType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="PERCENTAGE">Porcentaje</option>
                  <option value="FREE_MONTHS">Meses Gratis</option>
                  <option value="FIXED_AMOUNT">Monto Fijo</option>
                  <option value="COMBINED">Combinado (Meses + Porcentaje)</option>
                </select>
              </div>

              {/* Discount Value Fields */}
              {formData.discountType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de descuento *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.percentageOff}
                      onChange={(e) => setFormData({ ...formData, percentageOff: e.target.value })}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
              )}

              {formData.discountType === 'FREE_MONTHS' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meses gratis *</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={formData.freeMonths}
                    onChange={(e) => setFormData({ ...formData, freeMonths: e.target.value })}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {formData.discountType === 'FIXED_AMOUNT' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto fijo (ARS) *</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.fixedAmountOff}
                      onChange={(e) => setFormData({ ...formData, fixedAmountOff: e.target.value })}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {formData.discountType === 'COMBINED' && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meses gratis iniciales *</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={formData.combinedFreeMonths}
                      onChange={(e) => setFormData({ ...formData, combinedFreeMonths: e.target.value })}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Luego, % de descuento *</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.combinedPercentageOff}
                          onChange={(e) => setFormData({ ...formData, combinedPercentageOff: e.target.value })}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
                        />
                        <span className="text-gray-500">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Por cuántos meses *</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={formData.combinedPercentageMonths}
                        onChange={(e) => setFormData({ ...formData, combinedPercentageMonths: e.target.value })}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Validity Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Válido desde *</label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Válido hasta *</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Usage limits (only for coupons) */}
              {createType === 'coupon' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Usos totales máximos</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxTotalUses}
                      onChange={(e) => setFormData({ ...formData, maxTotalUses: e.target.value })}
                      placeholder="Sin límite"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Usos por organización</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxUsesPerOrg}
                      onChange={(e) => setFormData({ ...formData, maxUsesPerOrg: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Banner text (only for global) */}
              {createType === 'global' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Texto del banner</label>
                    <input
                      type="text"
                      value={formData.bannerText}
                      onChange={(e) => setFormData({ ...formData, bannerText: e.target.value })}
                      placeholder="¡Oferta especial!"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Badge</label>
                    <input
                      type="text"
                      value={formData.badgeText}
                      onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                      placeholder="🔥 Promo"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Applicable tiers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aplica a planes (vacío = todos)
                </label>
                <div className="flex gap-3">
                  {['INICIAL', 'PROFESIONAL', 'EMPRESA'].map((tier) => (
                    <label key={tier} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.applicableTiers.includes(tier)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              applicableTiers: [...formData.applicableTiers, tier],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              applicableTiers: formData.applicableTiers.filter((t) => t !== tier),
                            });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      />
                      <span className="text-sm">{TIER_LABELS[tier]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Activar inmediatamente
                </label>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateDiscount}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
