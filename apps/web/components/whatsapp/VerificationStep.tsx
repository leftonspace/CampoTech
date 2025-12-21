'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Shield,
  Phone,
  Loader2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';

interface VerificationStepProps {
  phoneNumber: string;
  onVerified: (phoneNumber: string) => void;
  onBack: () => void;
}

export function VerificationStep({
  phoneNumber,
  onVerified,
  onBack,
}: VerificationStepProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Start cooldown on mount
  useEffect(() => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Verify code mutation
  const verifyMutation = useMutation({
    mutationFn: async (verificationCode: string) => {
      const res = await fetch('/api/whatsapp/provision/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Código inválido');
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        onVerified(phoneNumber);
      }
    },
  });

  // Resend code mutation
  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/whatsapp/provision/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al reenviar');
      }
      return res.json();
    },
    onSuccess: () => {
      setCode(['', '', '', '', '', '']);
      setResendCooldown(60);
    },
  });

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (value && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        verifyMutation.mutate(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace - go to previous input
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, '').slice(0, 6).split('');
        const newCode = [...code];
        digits.forEach((digit, i) => {
          if (i < 6) newCode[i] = digit;
        });
        setCode(newCode);
        if (digits.length === 6) {
          verifyMutation.mutate(digits.join(''));
        } else if (digits.length > 0) {
          inputRefs.current[digits.length]?.focus();
        }
      });
    }
  };

  const handleSubmit = () => {
    const fullCode = code.join('');
    if (fullCode.length === 6) {
      verifyMutation.mutate(fullCode);
    }
  };

  const handleResend = () => {
    if (resendCooldown === 0) {
      resendMutation.mutate();
    }
  };

  const maskPhone = (phone: string) => {
    // Show only last 4 digits
    const digits = phone.replace(/\D/g, '');
    if (digits.length > 4) {
      return `+** ****-${digits.slice(-4)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <Shield className="h-8 w-8 text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Verificá tu identidad
        </h1>
        <p className="text-gray-600">
          Enviamos un código de 6 dígitos a tu celular
        </p>
      </div>

      {/* Phone number display */}
      <div className="card p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <Phone className="h-5 w-5" />
          <span className="font-mono text-lg">{maskPhone(phoneNumber)}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Código enviado por SMS
        </p>
      </div>

      {/* Code input */}
      <div className="space-y-4">
        <div className="flex justify-center gap-3">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={`w-12 h-14 text-center text-2xl font-bold rounded-lg border-2 transition-colors ${
                verifyMutation.isError
                  ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
              }`}
              disabled={verifyMutation.isPending}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {/* Error message */}
        {verifyMutation.isError && (
          <div className="flex items-center justify-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{verifyMutation.error?.message}</span>
          </div>
        )}

        {/* Verify button */}
        <button
          onClick={handleSubmit}
          disabled={code.join('').length !== 6 || verifyMutation.isPending}
          className="btn-primary w-full"
        >
          {verifyMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Verificando...
            </>
          ) : (
            'Verificar código'
          )}
        </button>

        {/* Resend option */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">¿No recibiste el código?</p>
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || resendMutation.isPending}
            className="text-sm text-primary-600 hover:text-primary-700 disabled:text-gray-400"
          >
            {resendMutation.isPending ? (
              <>
                <Loader2 className="inline h-4 w-4 mr-1 animate-spin" />
                Reenviando...
              </>
            ) : resendCooldown > 0 ? (
              `Reenviar código (${resendCooldown}s)`
            ) : (
              <>
                <RefreshCw className="inline h-4 w-4 mr-1" />
                Reenviar código
              </>
            )}
          </button>
        </div>
      </div>

      {/* Back button */}
      <div className="pt-4 border-t">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Elegir otro número
        </button>
      </div>

      {/* Info box */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> El código puede tardar hasta 2 minutos en llegar.
          Asegurate de que tu celular tenga señal y que el número ingresado sea correcto.
        </p>
      </div>
    </div>
  );
}
