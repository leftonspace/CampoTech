'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertTriangle, FileText, Building, User, Users, Car } from 'lucide-react';
import { ORGANIZATION_FIELDS, USER_FIELDS, CUSTOMER_FIELDS, VEHICLE_FIELDS } from '@/lib/config/field-permissions';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChangeRequestInput {
  entityType: string;
  entityId: string;
  fieldName: string;
  currentValue: string;
  requestedValue: string;
  reason: string;
  documentUrls?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ENTITY_TYPES = [
  { id: 'organization', label: 'Mi Empresa', icon: Building },
  { id: 'user', label: 'Mi Perfil', icon: User },
  { id: 'customer', label: 'Cliente', icon: Users },
  { id: 'vehicle', label: 'Vehiculo', icon: Car },
];

const FIELD_CONFIGS: Record<string, Record<string, { status: string; lockedMessage?: string }>> = {
  organization: ORGANIZATION_FIELDS,
  user: USER_FIELDS,
  customer: CUSTOMER_FIELDS || {},
  vehicle: VEHICLE_FIELDS || {},
};

const FIELD_LABELS: Record<string, string> = {
  // Organization
  cuit: 'CUIT',
  razonSocial: 'Razon Social',
  tipoSociedad: 'Tipo de Sociedad',
  ivaCondition: 'Condicion IVA',
  puntoVentaAfip: 'Punto de Venta AFIP',
  ingresosBrutos: 'Numero de Ingresos Brutos',
  fechaInscripcionAfip: 'Fecha Inscripcion AFIP',
  domicilioFiscal: 'Domicilio Fiscal',
  // User
  cuil: 'CUIL',
  dni: 'DNI',
  legalName: 'Nombre Legal',
  fechaNacimiento: 'Fecha de Nacimiento',
  nacionalidad: 'Nacionalidad',
  sexo: 'Genero',
  fechaIngreso: 'Fecha de Ingreso',
  modalidadContrato: 'Modalidad de Contrato',
  // Vehicle
  plateNumber: 'Patente',
  vin: 'VIN',
};

const REQUIRED_DOCS: Record<string, string[]> = {
  cuit: ['Constancia de CUIT de AFIP'],
  razonSocial: ['Estatuto social actualizado', 'Acta de asamblea'],
  cuil: ['Constancia de CUIL de ANSES'],
  dni: ['Frente y dorso del DNI'],
  legalName: ['DNI con nombre actual', 'Partida de nacimiento o casamiento'],
  fechaNacimiento: ['Partida de nacimiento'],
  plateNumber: ['Cedula verde o azul'],
  vin: ['Titulo del automotor'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════

async function createChangeRequest(data: ChangeRequestInput): Promise<{ success: boolean; message?: string; data?: unknown }> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/change-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ChangeRequestPage() {
  const [step, setStep] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [requestedValue, setRequestedValue] = useState('');
  const [reason, setReason] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: createChangeRequest,
    onSuccess: (response) => {
      if (response.success) {
        setSuccess(true);
        setStep(5);
      } else {
        setError(response.message || 'Error al crear la solicitud');
      }
    },
    onError: () => {
      setError('Error al enviar la solicitud');
    },
  });

  // Get locked fields for selected entity type
  const lockedFields = Object.entries(FIELD_CONFIGS[entityType] || {})
    .filter(([_, config]) => config.status === 'locked')
    .map(([key, config]) => ({
      key,
      label: FIELD_LABELS[key] || key,
      message: config.lockedMessage,
    }));

  const requiredDocs = REQUIRED_DOCS[fieldName] || [];

  const handleSubmit = () => {
    // For now, use a placeholder entityId
    // In production, you'd fetch the actual entity ID based on context
    const finalEntityId = entityId || 'self';

    mutation.mutate({
      entityType,
      entityId: finalEntityId,
      fieldName,
      currentValue,
      requestedValue,
      reason,
    });
  };

  // Success screen
  if (success) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-8 w-8 text-success-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Solicitud Enviada</h1>
          <p className="text-gray-600 mb-6">
            Tu solicitud de cambio ha sido recibida. Un administrador la revisara
            y te notificara cuando sea procesada.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left text-sm">
            <p className="text-gray-600">
              <strong>Tiempo estimado de respuesta:</strong> 2-3 dias habiles
            </p>
            <p className="text-gray-600 mt-2">
              Recibiras un email cuando tu solicitud sea aprobada o rechazada.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard" className="btn-outline">
              Volver al inicio
            </Link>
            <Link href="/dashboard/support/change-request/list" className="btn-primary">
              Ver mis solicitudes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Solicitar Cambio de Datos</h1>
          <p className="text-gray-500">Modifica datos bloqueados con documentacion oficial</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between px-4">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? 'bg-primary-600 text-white'
                  : s < step
                  ? 'bg-success-100 text-success-700'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {s < step ? <CheckCircle className="h-5 w-5" /> : s}
            </div>
            {s < 4 && (
              <div className={`w-16 h-1 mx-2 ${s < step ? 'bg-success-200' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-danger-50 p-4 text-danger-700 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Step 1: Select Entity Type */}
      {step === 1 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">¿Que tipo de dato queres modificar?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ENTITY_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setEntityType(type.id);
                  setEntityId(type.id === 'organization' || type.id === 'user' ? 'self' : '');
                  setStep(2);
                }}
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 text-left"
              >
                <type.icon className="h-6 w-6 text-gray-400" />
                <span className="font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select Field */}
      {step === 2 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">¿Que campo queres cambiar?</h2>
          {lockedFields.length === 0 ? (
            <p className="text-gray-500">
              No hay campos bloqueados para este tipo de entidad.
            </p>
          ) : (
            <div className="space-y-2">
              {lockedFields.map((field) => (
                <button
                  key={field.key}
                  onClick={() => {
                    setFieldName(field.key);
                    setStep(3);
                  }}
                  className="w-full flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 text-left"
                >
                  <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium">{field.label}</p>
                    {field.message && (
                      <p className="text-sm text-gray-500 mt-1">{field.message}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setStep(1)} className="mt-4 text-sm text-gray-500 hover:underline">
            Volver
          </button>
        </div>
      )}

      {/* Step 3: Enter Values */}
      {step === 3 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">
            Cambiar: {FIELD_LABELS[fieldName] || fieldName}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor actual (si lo conoces)
              </label>
              <input
                type="text"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="Valor actual..."
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nuevo valor solicitado *
              </label>
              <input
                type="text"
                value={requestedValue}
                onChange={(e) => setRequestedValue(e.target.value)}
                placeholder="Nuevo valor..."
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo del cambio *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explica por que necesitas este cambio..."
                className="input min-h-[100px]"
                required
              />
            </div>

            {requiredDocs.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-medium text-amber-800 mb-2">
                  Documentacion requerida:
                </h3>
                <ul className="text-sm text-amber-700 list-disc list-inside">
                  {requiredDocs.map((doc, i) => (
                    <li key={i}>{doc}</li>
                  ))}
                </ul>
                <p className="text-xs text-amber-600 mt-2">
                  Podras adjuntar los documentos despues de enviar la solicitud
                  o enviarlos por email a soporte@campotech.com
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep(2)} className="btn-outline flex-1">
              Volver
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!requestedValue || !reason}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Revisar y Enviar</h2>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">Tipo:</span>
              <span className="font-medium">
                {ENTITY_TYPES.find((t) => t.id === entityType)?.label}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Campo:</span>
              <span className="font-medium">{FIELD_LABELS[fieldName] || fieldName}</span>
            </div>
            {currentValue && (
              <div className="flex justify-between">
                <span className="text-gray-500">Valor actual:</span>
                <span className="font-medium">{currentValue}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Valor nuevo:</span>
              <span className="font-medium text-primary-600">{requestedValue}</span>
            </div>
            <div className="pt-2 border-t">
              <span className="text-gray-500">Motivo:</span>
              <p className="text-gray-900 mt-1">{reason}</p>
            </div>
          </div>

          <label className="flex items-start gap-3 mb-6">
            <input type="checkbox" className="mt-1" required />
            <span className="text-sm text-gray-600">
              Declaro que la información proporcionada es verídica y que los documentos
              que adjunte son auténticos. Entiendo que proporcionar información falsa
              puede resultar en la suspensión de mi cuenta.
            </span>
          </label>

          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="btn-outline flex-1">
              Volver
            </button>
            <button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="btn-primary flex-1"
            >
              {mutation.isPending ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
