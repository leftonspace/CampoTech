'use client';

/**
 * PDF Import Page
 * ================
 * 
 * Phase 4.4: Growth Engine
 * /dashboard/admin/growth-engine/import
 * 
 * Allows admin to upload PDF files from Gasnor/GasNEA to import gasista profiles.
 */

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Database } from 'lucide-react';

interface ImportResult {
    success: boolean;
    imported: number;
    updated: number;
    errors: number;
    total: number;
    fileName: string;
    message: string;
}

export default function PDFImportPage() {
    const searchParams = useSearchParams();
    const initialSource = (searchParams.get('source') as 'GASNOR' | 'GASNEA') || 'GASNOR';

    const [source, setSource] = useState<'GASNOR' | 'GASNEA'>(initialSource);
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const sourceDetails = {
        GASNOR: {
            name: 'Gasnor',
            region: 'Norte (Salta, Jujuy, Tucumán, Santiago del Estero)',
            bgColor: 'bg-orange-50',
            borderColor: 'border-orange-200',
            selectedBg: 'bg-orange-100',
            iconBg: 'bg-orange-100',
            iconColor: 'text-orange-600',
            buttonBg: 'bg-orange-500 hover:bg-orange-600',
        },
        GASNEA: {
            name: 'GasNEA',
            region: 'NEA (Corrientes, Chaco, Formosa, Misiones)',
            bgColor: 'bg-cyan-50',
            borderColor: 'border-cyan-200',
            selectedBg: 'bg-cyan-100',
            iconBg: 'bg-cyan-100',
            iconColor: 'text-cyan-600',
            buttonBg: 'bg-cyan-500 hover:bg-cyan-600',
        },
    };

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
                setError('Por favor seleccioná un archivo PDF');
                setFile(null);
                return;
            }
            if (selectedFile.size > 10 * 1024 * 1024) {
                setError('El archivo debe ser menor a 10MB');
                setFile(null);
                return;
            }
            setFile(selectedFile);
            setError(null);
            setResult(null);
        }
    }

    async function handleUpload() {
        if (!file) return;

        setIsUploading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('source', source);

            const response = await fetch('/api/admin/growth-engine/import/pdf', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al importar el archivo');
            }

            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al importar');
        } finally {
            setIsUploading(false);
        }
    }

    const detail = sourceDetails[source];

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <Link
                    href="/dashboard/admin/growth-engine"
                    className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al Growth Engine
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Importar desde PDF</h1>
                <p className="text-gray-500 mt-1">
                    Subí el listado de matriculados en formato PDF para importar los perfiles
                </p>
            </div>

            {/* Source Selector */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-4">1. Seleccionar Fuente</h2>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => setSource('GASNOR')}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${source === 'GASNOR'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${source === 'GASNOR' ? 'bg-orange-100' : 'bg-gray-200'
                                }`}>
                                <Database className={`w-5 h-5 ${source === 'GASNOR' ? 'text-orange-600' : 'text-gray-500'}`} />
                            </div>
                            <div>
                                <p className={`font-medium ${source === 'GASNOR' ? 'text-orange-900' : 'text-gray-700'}`}>Gasnor</p>
                                <p className="text-xs text-gray-500">Salta, Jujuy, Tucumán</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setSource('GASNEA')}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${source === 'GASNEA'
                            ? 'border-cyan-500 bg-cyan-50'
                            : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${source === 'GASNEA' ? 'bg-cyan-100' : 'bg-gray-200'
                                }`}>
                                <Database className={`w-5 h-5 ${source === 'GASNEA' ? 'text-cyan-600' : 'text-gray-500'}`} />
                            </div>
                            <div>
                                <p className={`font-medium ${source === 'GASNEA' ? 'text-cyan-900' : 'text-gray-700'}`}>GasNEA</p>
                                <p className="text-xs text-gray-500">Corrientes, Chaco, Formosa</p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            {/* File Upload */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-4">2. Subir Archivo PDF</h2>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors bg-gray-50">
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        id="pdf-upload"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                        {file ? (
                            <div className="flex items-center justify-center gap-3">
                                <FileText className="w-10 h-10 text-emerald-500" />
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">{file.name}</p>
                                    <p className="text-sm text-gray-500">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                                <p className="text-gray-600">
                                    Hacé click para seleccionar o arrastrá el archivo aquí
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Formatos soportados: PDF (máx. 10MB)
                                </p>
                            </>
                        )}
                    </label>
                </div>

                {file && (
                    <button
                        onClick={handleUpload}
                        disabled={isUploading}
                        className={`w-full mt-4 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${detail.buttonBg} text-white disabled:bg-gray-300 disabled:cursor-not-allowed`}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Procesando PDF...
                            </>
                        ) : (
                            <>
                                <Upload className="w-5 h-5" />
                                Importar Perfiles de {detail.name}
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-red-800">Error</p>
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                </div>
            )}

            {/* Success Result */}
            {result && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                        <div>
                            <p className="font-semibold text-emerald-800">Importación Completada</p>
                            <p className="text-sm text-emerald-700">{result.message}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 pt-4 border-t border-emerald-200">
                        <div className="text-center bg-white rounded-lg p-3 shadow-sm">
                            <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                            <p className="text-xs text-gray-500">Total Encontrados</p>
                        </div>
                        <div className="text-center bg-white rounded-lg p-3 shadow-sm">
                            <p className="text-2xl font-bold text-emerald-600">{result.imported}</p>
                            <p className="text-xs text-gray-500">Nuevos</p>
                        </div>
                        <div className="text-center bg-white rounded-lg p-3 shadow-sm">
                            <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                            <p className="text-xs text-gray-500">Actualizados</p>
                        </div>
                        <div className="text-center bg-white rounded-lg p-3 shadow-sm">
                            <p className="text-2xl font-bold text-red-600">{result.errors}</p>
                            <p className="text-xs text-gray-500">Errores</p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Link
                            href="/dashboard/admin/growth-engine"
                            className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-center text-sm transition-colors"
                        >
                            Ver Dashboard
                        </Link>
                        <button
                            onClick={() => {
                                setFile(null);
                                setResult(null);
                            }}
                            className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-center text-sm transition-colors"
                        >
                            Importar Otro PDF
                        </button>
                    </div>
                </div>
            )}

            {/* Instructions */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-3">Formato Esperado (GasNEA)</h2>
                <p className="text-sm text-gray-600 mb-4">
                    El PDF debe contener una tabla con las siguientes columnas:
                </p>
                <div className="bg-gray-50 rounded-lg p-3 mb-4 overflow-x-auto">
                    <code className="text-xs text-gray-700 whitespace-nowrap">
                        LOCALIDAD | NOMBRE Y APELLIDO | CUIT | DOMICILIO | TELEFONO | E MAIL | MAT NUMERO | TIPO | VIGENCIA
                    </code>
                </div>
                <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span><strong className="text-gray-900">NOMBRE Y APELLIDO</strong> - Requerido</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span><strong className="text-gray-900">MAT NUMERO</strong> - Número de matrícula</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                        <span><strong className="text-gray-900">TELEFONO</strong> - Para contacto</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                        <span><strong className="text-gray-900">E MAIL</strong> - Para contacto</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-gray-400" />
                        <span><strong className="text-gray-900">LOCALIDAD</strong> - Ubicación del profesional</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
