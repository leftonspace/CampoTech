'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PublicHeader, PublicFooter } from '@/components/layout';
import {
    Search,
    MapPin,
    Star,
    Filter,
    ArrowRight,
    ShieldCheck,
    Zap
} from 'lucide-react';

// Mock Data for Search Results
const MOCK_RESULTS = [
    {
        id: '1',
        name: 'ElectroService Buenos Aires',
        category: 'Electricista',
        rating: 4.9,
        reviews: 124,
        price: '$$',
        verified: true,
        availableNow: true,
        distance: '1.2km',
        image: 'https://images.unsplash.com/photo-1621905476438-5f6616164112?w=800&q=80',
        tags: ['Emergencias 24hs', 'Matriculado']
    },
    {
        id: '2',
        name: 'Plomería Total',
        category: 'Plomero',
        rating: 4.8,
        reviews: 89,
        price: '$',
        verified: true,
        availableNow: false,
        distance: '3.5km',
        image: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=800&q=80',
        tags: ['Destapaciones']
    },
    {
        id: '3',
        name: 'ClimaTech Aires',
        category: 'Aire Acondicionado',
        rating: 4.7,
        reviews: 256,
        price: '$$$',
        verified: true,
        availableNow: true,
        distance: '5.0km',
        image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&q=80',
        tags: ['Instalación Certificada']
    },
    {
        id: '4',
        name: 'Gasista Matriculado Juan',
        category: 'Gasista',
        rating: 5.0,
        reviews: 42,
        price: '$$',
        verified: true,
        availableNow: false,
        distance: '2.1km',
        image: 'https://images.unsplash.com/photo-1621905476438-5f6616164112?w=800&q=80',
        tags: ['Habilitaciones']
    }
];

export default function SearchPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [location, setLocation] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const categories = ['Electricista', 'Plomero', 'Gasista', 'Aire Acondicionado', 'Albañil', 'Cerrajero'];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <PublicHeader />

            {/* Search Header */}
            <div className="bg-white border-b pt-24 pb-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        Encontrá profesionales de confianza cerca tuyo
                    </h1>

                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="¿Qué servicio buscás?"
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Ubicación (Barrio, Ciudad)"
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>
                        <button className="bg-primary-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors">
                            Buscar
                        </button>
                    </div>

                    {/* Quick Categories */}
                    <div className="flex gap-2 mt-6 overflow-x-auto pb-2 scrollbar-hide">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(curr => curr === cat ? null : cat)}
                                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${selectedCategory === cat
                                    ? 'bg-primary-50 border-primary-200 text-primary-700'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Results Content */}
            <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* Filters Sidebar */}
                    <div className="hidden lg:block space-y-6">
                        <div className="bg-white p-4 rounded-lg border shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900">Filtros</h3>
                                <Filter className="w-4 h-4 text-gray-500" />
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Precio</label>
                                    <div className="flex gap-2">
                                        {['$', '$$', '$$$'].map((p) => (
                                            <button key={p} className="flex-1 border rounded px-2 py-1 text-sm hover:bg-gray-50">{p}</button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Disponibilidad</label>
                                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                        <input type="checkbox" className="rounded text-primary-600" />
                                        Disponible hoy
                                    </label>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Verificación</label>
                                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                        <input type="checkbox" className="rounded text-primary-600" defaultChecked />
                                        Verificado por CampoTech
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Results Grid */}
                    <div className="lg:col-span-3">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-gray-600">{MOCK_RESULTS.length} profesionales encontrados</p>
                            <select className="border-none bg-transparent text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer">
                                <option>Recomendados</option>
                                <option>Mejor calificados</option>
                                <option>Más cercanos</option>
                                <option>Menor precio</option>
                            </select>
                        </div>

                        <div className="grid gap-4">
                            {MOCK_RESULTS.map((pro) => (
                                <div key={pro.id} className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col sm:flex-row gap-4">
                                    {/* Image */}
                                    <div className="w-full sm:w-48 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                        <Image
                                            src={pro.image}
                                            alt={pro.name}
                                            width={192}
                                            height={128}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">{pro.name}</h3>
                                                <p className="text-gray-500 text-sm mb-1">{pro.category} • {pro.distance}</p>
                                            </div>
                                            <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded text-yellow-700 text-sm font-bold">
                                                <Star className="w-3 h-3 fill-yellow-500" />
                                                {pro.rating}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 my-3">
                                            {pro.verified && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                                                    <ShieldCheck className="w-3 h-3" /> Verificado
                                                </span>
                                            )}
                                            {pro.availableNow && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                                                    <Zap className="w-3 h-3" /> Disponible ahora
                                                </span>
                                            )}
                                            {pro.tags.map(tag => (
                                                <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action */}
                                    <div className="flex flex-col justify-between items-end min-w-[140px] border-l pl-4 border-gray-100">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-gray-500">Precio estimado</p>
                                            <p className="font-semibold text-gray-900">{pro.price}</p>
                                        </div>
                                        <Link
                                            href={`/p/${pro.id}`} // Takes user to the public profile
                                            className="w-full sm:w-auto bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                        >
                                            Ver Perfil
                                            <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            <PublicFooter />
        </div>
    );
}
