'use client';

/**
 * Language Confirmation Card
 * ==========================
 * 
 * Phase 5.3: Translation UI
 * 
 * Displays when a non-Spanish language is detected, asking the user
 * to confirm the language and optionally send a confirmation to the customer.
 * 
 * Features:
 * - Shows detected language with confidence
 * - Option to confirm and enable translation
 * - Option to dismiss (customer speaks Spanish)
 * - Language correction dropdown
 */

import { useState } from 'react';
import { Globe, Check, X, ChevronDown } from 'lucide-react';

// Common languages for CampoTech's international customers
const LANGUAGE_OPTIONS = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'he', name: 'עברית', flag: '🇮🇱' },
];

interface LanguageConfirmationCardProps {
    detectedLanguage: string;
    detectedLanguageName: string;
    confidence: number;
    conversationId: string;
    onConfirm: (language: string) => void;
    onDismiss: () => void;
    onSendConfirmation?: () => void;
}

export function LanguageConfirmationCard({
    detectedLanguage,
    detectedLanguageName,
    confidence,
    onConfirm,
    onDismiss,
    onSendConfirmation,
}: LanguageConfirmationCardProps) {
    const [selectedLanguage, setSelectedLanguage] = useState(detectedLanguage);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    // Find the flag for the detected language
    const languageOption = LANGUAGE_OPTIONS.find(l => l.code === detectedLanguage);
    const flag = languageOption?.flag || '🌐';

    // Confidence color
    const confidenceColor = confidence >= 0.9
        ? 'text-green-600'
        : confidence >= 0.7
            ? 'text-yellow-600'
            : 'text-orange-600';

    const handleConfirm = async () => {
        setIsConfirming(true);
        try {
            onConfirm(selectedLanguage);
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-full bg-sky-100">
                    <Globe className="h-5 w-5 text-sky-600" />
                </div>
                <div className="flex-1">
                    <h4 className="font-medium text-sky-800">
                        Idioma detectado
                    </h4>
                    <p className="text-sm text-sky-600">
                        El cliente parece hablar otro idioma
                    </p>
                </div>
            </div>

            {/* Detected language display */}
            <div className="bg-white rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{flag}</span>
                        <div>
                            <div className="font-medium text-gray-800">
                                {detectedLanguageName}
                            </div>
                            <div className={`text-xs ${confidenceColor}`}>
                                {Math.round(confidence * 100)}% confianza
                            </div>
                        </div>
                    </div>

                    {/* Language correction dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        >
                            Corregir
                            <ChevronDown className="h-3 w-3" />
                        </button>

                        {showDropdown && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowDropdown(false)}
                                />
                                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                                    {LANGUAGE_OPTIONS.map((lang) => (
                                        <button
                                            key={lang.code}
                                            onClick={() => {
                                                setSelectedLanguage(lang.code);
                                                setShowDropdown(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${selectedLanguage === lang.code ? 'bg-sky-50 text-sky-700' : 'text-gray-700'
                                                }`}
                                        >
                                            <span>{lang.flag}</span>
                                            <span>{lang.name}</span>
                                            {selectedLanguage === lang.code && (
                                                <Check className="h-3 w-3 ml-auto" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Info text */}
            <p className="text-sm text-gray-600 mb-4">
                Si confirmás, las respuestas del AI se generarán en {detectedLanguageName}
                y los mensajes del cliente se traducirán al español para vos.
            </p>

            {/* Action buttons */}
            <div className="flex gap-2">
                <button
                    onClick={handleConfirm}
                    disabled={isConfirming}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50"
                >
                    <Check className="h-4 w-4" />
                    {isConfirming ? 'Confirmando...' : 'Confirmar idioma'}
                </button>

                <button
                    onClick={onDismiss}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                    <X className="h-4 w-4" />
                    Habla español
                </button>
            </div>

            {/* Optional: Send confirmation to customer */}
            {onSendConfirmation && (
                <button
                    onClick={onSendConfirmation}
                    className="w-full mt-2 px-4 py-2 text-sm text-sky-600 hover:text-sky-800 hover:bg-sky-100 rounded-lg transition-colors"
                >
                    Enviar confirmación de idioma al cliente
                </button>
            )}
        </div>
    );
}

export default LanguageConfirmationCard;
