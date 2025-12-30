'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Store, 
  MapPin, 
  Image as ImageIcon, 
  Save, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Globe,
  DollarSign,
  Clock
} from 'lucide-react';
import Link from 'next/link';

// Mock data types until API is fully implemented
interface MarketplaceProfile {
  isPublic: boolean;
  publicName: string;
  description: string;
  categories: string[];
  coverageRadiusKm: number;
  bannerUrl?: string;
  logoUrl?: string;
  operatingHours: string;
  baseFee: number;
  contactPhone: string;
  contactEmail: string;
}

export default function MarketplaceProfilePage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  
  // TODO: Replace with real API call
  // const { data: profile, isLoading } = useQuery({ queryKey: ['marketplace-profile'], queryFn: ... });
  
  const [profile, setProfile] = useState<MarketplaceProfile>({
    isPublic: false,
    publicName: '',
    description: '',
    categories: [],
    coverageRadiusKm: 10,
    operatingHours: '09:00 - 18:00',
    baseFee: 0,
    contactPhone: '',
    contactEmail: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    
    // Simulate API call
    setTimeout(() => {
      setSaveStatus('success');
      setIsEditing(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
    
    // In real implementation:
    // mutation.mutate(profile);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Perfil de Marketplace</h1>
          <p className="text-gray-500">
            Configurá cómo ven tu negocio los clientes en la app de consumidores
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profile.isPublic && (
             <Link 
               href={`/p/${profile.publicName.toLowerCase().replace(/\s+/g, '-')}`} 
               target="_blank"
               className="btn-outline flex items-center gap-2"
             >
               <Globe className="w-4 h-4" />
               Ver perfil público
             </Link>
          )}
        </div>
      </div>

      {/* Visibility Toggle Card */}
      <div className="card p-6 border-l-4 border-l-primary-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${profile.isPublic ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {profile.isPublic ? 'Tu negocio es visible' : 'Tu negocio está oculto'}
              </h3>
              <p className="text-gray-500">
                {profile.isPublic 
                  ? 'Los clientes pueden encontrarte y reservar servicios.' 
                  : 'Activá el perfil para empezar a recibir trabajos del marketplace.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={profile.isPublic}
                onChange={(e) => setProfile({ ...profile, isPublic: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900 border-b pb-2">Información Pública</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label block mb-1">Nombre del Negocio</label>
              <input 
                type="text" 
                className="input" 
                value={profile.publicName}
                onChange={(e) => setProfile({...profile, publicName: e.target.value})}
                placeholder="Ej. Plomería Express"
              />
            </div>
            <div>
              <label className="label block mb-1">Categorías</label>
              <select className="input">
                <option>Plomería</option>
                <option>Electricidad</option>
                <option>Gas</option>
                <option>Climatización</option>
              </select>
            </div>
          </div>

          <div>
             <label className="label block mb-1">Descripción</label>
             <textarea 
               className="input" 
               rows={4}
               value={profile.description}
               onChange={(e) => setProfile({...profile, description: e.target.value})}
               placeholder="Contale a tus clientes qué servicios ofrecés y por qué elegirte..."
             />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
             <div>
               <label className="label block mb-1">Teléfono de contacto público</label>
               <div className="relative">
                 <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                   type="tel" 
                   className="input pl-9"
                   value={profile.contactPhone}
                   onChange={(e) => setProfile({...profile, contactPhone: e.target.value})}
                 />
               </div>
             </div>
             <div>
               <label className="label block mb-1">Email de contacto (opcional)</label>
               <input 
                 type="email" 
                 className="input"
                 value={profile.contactEmail}
                 onChange={(e) => setProfile({...profile, contactEmail: e.target.value})}
               />
             </div>
          </div>
        </div>

        {/* Service Settings */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900 border-b pb-2">Configuración de Servicio</h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
               <label className="label block mb-1">Radio de Cobertura (km)</label>
               <div className="relative">
                 <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                   type="number" 
                   className="input pl-9"
                   value={profile.coverageRadiusKm}
                   onChange={(e) => setProfile({...profile, coverageRadiusKm: parseInt(e.target.value)})}
                 />
               </div>
            </div>
            <div>
               <label className="label block mb-1">Horario de Atención</label>
               <div className="relative">
                 <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                   type="text" 
                   className="input pl-9"
                   value={profile.operatingHours}
                   onChange={(e) => setProfile({...profile, operatingHours: e.target.value})}
                   placeholder="Ej. 09:00 - 18:00"
                 />
               </div>
            </div>
            <div>
               <label className="label block mb-1">Costo Visita Mínimo</label>
               <div className="relative">
                 <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                   type="number" 
                   className="input pl-9"
                   value={profile.baseFee}
                   onChange={(e) => setProfile({...profile, baseFee: parseInt(e.target.value)})}
                 />
               </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-md flex gap-3 text-blue-700 text-sm">
             <AlertCircle className="w-5 h-5 flex-shrink-0" />
             <p>
               Para aparecer en el marketplace, necesitás tener tu documentación verificada. 
               <Link href="/dashboard/settings/verification" className="underline font-medium ml-1">
                 Verificar cuenta
               </Link>
             </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button 
            type="button"
            className="btn-outline"
            onClick={() => setIsEditing(false)}
          >
            Cancelar
          </button>
          <button 
            type="submit"
            disabled={saveStatus === 'saving'}
            className="btn-primary min-w-[120px]"
          >
            {saveStatus === 'saving' ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
              </span>
            ) : saveStatus === 'success' ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Guardado
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" /> Guardar Cambios
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function PhoneIcon(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
