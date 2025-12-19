'use client';

import { useState, useMemo } from 'react';
import { mockTechnicianLocations, mockActiveJobs } from '@/lib/mock-data';
import { TechnicianLocation, Job } from '@/types';

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusColors: Record<string, string> = {
  en_route: 'bg-blue-500',
  arrived: 'bg-yellow-500',
  in_progress: 'bg-green-500',
  completed: 'bg-slate-400',
  pending: 'bg-orange-500',
};

const statusLabels: Record<string, string> = {
  en_route: 'En camino',
  arrived: 'Llegó',
  in_progress: 'En progreso',
  completed: 'Completado',
  pending: 'Pendiente',
};

type FilterType = 'all' | 'en_route' | 'arrived' | 'in_progress';

export default function MapPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianLocation | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const filteredTechnicians = useMemo(() => {
    if (filter === 'all') return mockTechnicianLocations;
    return mockTechnicianLocations.filter((t) => t.status === filter);
  }, [filter]);

  const activeTechnicians = mockTechnicianLocations.filter((t) => t.status !== 'completed').length;
  const techniciansByStatus = {
    en_route: mockTechnicianLocations.filter((t) => t.status === 'en_route').length,
    arrived: mockTechnicianLocations.filter((t) => t.status === 'arrived').length,
    in_progress: mockTechnicianLocations.filter((t) => t.status === 'in_progress').length,
  };

  return (
    <div className="h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mapa de Actividad</h1>
          <p className="text-slate-500 mt-1">Técnicos y trabajos activos en tiempo real</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-slate-600">{activeTechnicians} técnicos activos</span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{mockTechnicianLocations.length}</p>
              <p className="text-xs text-slate-500">Técnicos totales</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{techniciansByStatus.in_progress}</p>
              <p className="text-xs text-slate-500">En progreso</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{techniciansByStatus.en_route}</p>
              <p className="text-xs text-slate-500">En camino</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{techniciansByStatus.arrived}</p>
              <p className="text-xs text-slate-500">Llegaron</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100%-12rem)]">
        {/* Map Area */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
          {/* Map placeholder - In production, integrate with Google Maps or Mapbox */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100">
            {/* Buenos Aires map background simulation */}
            <div className="absolute inset-0 opacity-20">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Grid lines */}
                {Array.from({ length: 10 }).map((_, i) => (
                  <g key={i}>
                    <line x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="#3b82f6" strokeWidth="0.5" />
                    <line x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="#3b82f6" strokeWidth="0.5" />
                  </g>
                ))}
              </svg>
            </div>

            {/* Map Controls */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              <button className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-slate-50">
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              <button className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-slate-50">
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
            </div>

            {/* Technician Markers */}
            {filteredTechnicians.map((tech, index) => {
              // Position based on lat/lng converted to percentage of map area
              const x = ((tech.longitude + 58.5) / 0.2) * 100;
              const y = ((tech.latitude + 34.55) / -0.1) * 100;

              return (
                <div
                  key={tech.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  style={{ left: `${Math.min(90, Math.max(10, 50 + (index - 2) * 15))}%`, top: `${Math.min(80, Math.max(20, 30 + index * 10))}%` }}
                  onClick={() => setSelectedTechnician(tech)}
                >
                  {/* Pulse animation for active technicians */}
                  {tech.status !== 'completed' && (
                    <div className={`absolute inset-0 rounded-full ${statusColors[tech.status]} animate-ping opacity-50`} style={{ width: '32px', height: '32px', marginLeft: '-16px', marginTop: '-16px' }} />
                  )}

                  {/* Marker */}
                  <div className={`relative w-10 h-10 rounded-full ${statusColors[tech.status]} flex items-center justify-center text-white font-bold text-sm shadow-lg border-2 border-white`}>
                    {tech.technicianName.charAt(0)}
                  </div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                      <p className="font-medium">{tech.technicianName}</p>
                      <p className="text-slate-300">{tech.businessName}</p>
                      <p className="text-slate-400">{statusLabels[tech.status]}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Job Markers */}
            {mockActiveJobs.map((job, index) => (
              <div
                key={job.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{ left: `${Math.min(85, Math.max(15, 35 + index * 20))}%`, top: `${Math.min(75, Math.max(25, 45 + index * 8))}%` }}
                onClick={() => setSelectedJob(job)}
              >
                <div className="w-6 h-6 bg-white rounded-lg shadow-md flex items-center justify-center border-2 border-orange-400">
                  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                    <p className="font-medium">{job.customerName}</p>
                    <p className="text-slate-300">{job.businessName}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Map Legend */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-4">
              <p className="text-xs font-semibold text-slate-700 mb-3">Leyenda</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-slate-600">En progreso</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-slate-600">En camino</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-slate-600">Llegó</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded bg-white border border-orange-400" />
                  <span className="text-slate-600">Trabajo</span>
                </div>
              </div>
            </div>

            {/* Coverage Note */}
            <div className="absolute bottom-4 right-4 bg-white/90 rounded-lg shadow-md p-3">
              <p className="text-xs text-slate-500">Zona: Buenos Aires, Argentina</p>
              <p className="text-xs text-slate-400">Actualización: cada 30 seg</p>
            </div>
          </div>
        </div>

        {/* Sidebar - Technician List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Técnicos</h3>
            <div className="flex gap-1 mt-3">
              {(['all', 'in_progress', 'en_route', 'arrived'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                    filter === f ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f === 'all' ? 'Todos' : statusLabels[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-slate-100">
              {filteredTechnicians.map((tech) => (
                <div
                  key={tech.id}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedTechnician?.id === tech.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedTechnician(tech)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${statusColors[tech.status]} flex items-center justify-center text-white text-sm font-medium`}>
                        {tech.technicianName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{tech.technicianName}</p>
                        <p className="text-xs text-slate-500">{tech.businessName}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      tech.status === 'in_progress' ? 'bg-green-100 text-green-700' :
                      tech.status === 'en_route' ? 'bg-blue-100 text-blue-700' :
                      tech.status === 'arrived' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {statusLabels[tech.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Actualizado: {formatDateTime(tech.lastUpdated)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Technician Detail Modal */}
      {selectedTechnician && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedTechnician(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full ${statusColors[selectedTechnician.status]} flex items-center justify-center text-white text-lg font-bold`}>
                  {selectedTechnician.technicianName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selectedTechnician.technicianName}</h2>
                  <p className="text-sm text-slate-500">{selectedTechnician.businessName}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTechnician(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Estado</p>
                  <span className={`inline-flex mt-1 px-2.5 py-1 text-xs font-medium rounded-full ${
                    selectedTechnician.status === 'in_progress' ? 'bg-green-100 text-green-700' :
                    selectedTechnician.status === 'en_route' ? 'bg-blue-100 text-blue-700' :
                    selectedTechnician.status === 'arrived' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {statusLabels[selectedTechnician.status]}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Última actualización</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {formatDateTime(selectedTechnician.lastUpdated)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-xs text-slate-500">Ubicación</p>
                <p className="text-sm font-medium text-slate-900 mt-1">
                  {selectedTechnician.latitude.toFixed(4)}, {selectedTechnician.longitude.toFixed(4)}
                </p>
              </div>

              {selectedTechnician.currentJobId && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Trabajo Actual</p>
                  <p className="text-sm text-slate-900 mt-1">
                    Job ID: {selectedTechnician.currentJobId}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                  Ver en Google Maps
                </button>
                <button className="py-2 px-4 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm">
                  Historial
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Detalle del Trabajo</h2>
                <p className="text-sm text-slate-500">{selectedJob.businessName}</p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500">Cliente</p>
                <p className="font-medium text-slate-900">{selectedJob.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Dirección</p>
                <p className="font-medium text-slate-900">{selectedJob.address}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Estado</p>
                  <span className={`inline-flex mt-1 px-2.5 py-1 text-xs font-medium rounded-full ${
                    statusColors[selectedJob.status] ? statusColors[selectedJob.status].replace('bg-', 'bg-').replace('-500', '-100').replace('text-', 'text-').replace('-500', '-700') : 'bg-slate-100 text-slate-700'
                  }`}>
                    {statusLabels[selectedJob.status]}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500">Técnico</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">
                    {selectedJob.technicianName || 'Sin asignar'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                  Ver Trabajo Completo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
