'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Users,
  Navigation,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Truck,
  Wrench,
  X,
  Layers,
  Filter,
  Calendar,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { MapLayerControls, MapLayerState } from '@/components/maps/MapLayerControls';
import { MapFiltersPanel, MapFilters } from '@/components/maps/MapFiltersPanel';
import { ItineraryPanel } from '@/components/maps/ItineraryPanel';

// Types
interface CustomerLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  jobCount: number;
  lastJobDate: string | null;
  hasActiveJob: boolean;
}

interface TechnicianLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'en_linea' | 'en_camino' | 'trabajando' | 'sin_conexion';
  currentJobId: string | null;
  currentJobNumber: string | null;
  lastUpdated: string | null;
  avatarUrl: string | null;
  specialty: string | null;
  phone: string;
  currentCustomerName: string | null;
  etaMinutes: number | null;
}

interface TodayJob {
  id: string;
  jobNumber: string;
  lat: number;
  lng: number;
  status: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  technicianId: string | null;
  technicianName: string | null;
  scheduledTime: string | null;
  address: string;
  description: string;
  serviceType: string;
}

interface MapDataResponse {
  success: boolean;
  data: {
    customers: CustomerLocation[];
    technicians: TechnicianLocation[];
    todayJobs: TodayJob[];
    stats: {
      totalCustomers: number;
      customersWithLocation: number;
      totalTechnicians: number;
      techniciansOnline: number;
      techniciansEnRoute: number;
      techniciansWorking: number;
      techniciansOffline: number;
      todayJobsTotal: number;
      todayJobsPending: number;
      todayJobsInProgress: number;
      todayJobsCompleted: number;
    };
    updatedAt: string;
  };
}

type LeafletType = typeof import('leaflet');
type MapType = import('leaflet').Map;
type MarkerType = import('leaflet').Marker;
type LayerGroupType = import('leaflet').LayerGroup;
type MarkerClusterGroupType = import('leaflet.markercluster').MarkerClusterGroup;

// Buenos Aires default center
const BUENOS_AIRES_CENTER = { lat: -34.6037, lng: -58.3816 };

// Fetch map data
async function fetchMapData(): Promise<MapDataResponse> {
  const res = await fetch('/api/map/data');
  if (!res.ok) throw new Error('Error cargando datos del mapa');
  return res.json();
}

// Get status color for technicians
function getTechnicianColor(status: TechnicianLocation['status']): string {
  switch (status) {
    case 'en_linea':
      return '#10B981'; // green
    case 'en_camino':
      return '#3B82F6'; // blue
    case 'trabajando':
      return '#F59E0B'; // amber
    case 'sin_conexion':
    default:
      return '#9CA3AF'; // gray
  }
}

// Get status color for jobs
function getJobColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return '#10B981'; // green
    case 'IN_PROGRESS':
      return '#F59E0B'; // amber
    case 'EN_ROUTE':
      return '#3B82F6'; // blue
    case 'ASSIGNED':
      return '#6366F1'; // indigo
    case 'PENDING':
    default:
      return '#9CA3AF'; // gray
  }
}

// Get status label for jobs
function getJobStatusLabel(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'Completado';
    case 'IN_PROGRESS':
      return 'En progreso';
    case 'EN_ROUTE':
      return 'En camino';
    case 'ASSIGNED':
      return 'Asignado';
    case 'PENDING':
      return 'Pendiente';
    case 'CANCELLED':
      return 'Cancelado';
    default:
      return status;
  }
}

// Default layer state
const defaultLayers: MapLayerState = {
  customers: true,
  customersWithActiveJob: true,
  technicians: true,
  techniciansOnline: true,
  techniciansEnRoute: true,
  techniciansWorking: true,
  techniciansOffline: true,
  jobs: true,
  jobsPending: true,
  jobsInProgress: true,
  jobsCompleted: false,
};

// Default filters
const defaultFilters: MapFilters = {
  search: '',
  technicianId: null,
  zone: null,
  customerHasActiveJob: false,
  showCustomersOnly: false,
  showTechniciansOnly: false,
  showJobsOnly: false,
};

export default function LiveMapPage() {
  // State
  const [layers, setLayers] = useState<MapLayerState>(defaultLayers);
  const [filters, setFilters] = useState<MapFilters>(defaultFilters);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showLayerControls, setShowLayerControls] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianLocation | null>(null);
  const [showItinerary, setShowItinerary] = useState(false);
  const [selectedJob, setSelectedJob] = useState<TodayJob | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLocation | null>(null);

  // Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<MapType | null>(null);
  const customerLayerRef = useRef<LayerGroupType | MarkerClusterGroupType | null>(null);
  const technicianLayerRef = useRef<LayerGroupType | null>(null);
  const jobLayerRef = useRef<LayerGroupType | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [L, setL] = useState<LeafletType | null>(null);

  // Query
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['map-data'],
    queryFn: fetchMapData,
    refetchInterval: autoRefresh ? 15000 : false,
    staleTime: 10000,
  });

  const stats = data?.data?.stats || {
    totalCustomers: 0,
    customersWithLocation: 0,
    totalTechnicians: 0,
    techniciansOnline: 0,
    techniciansEnRoute: 0,
    techniciansWorking: 0,
    techniciansOffline: 0,
    todayJobsTotal: 0,
    todayJobsPending: 0,
    todayJobsInProgress: 0,
    todayJobsCompleted: 0,
  };

  // Filter data based on layers and filters
  const filteredData = useMemo(() => {
    if (!data?.data) {
      return { customers: [], technicians: [], jobs: [] };
    }

    let customers = data.data.customers;
    let technicians = data.data.technicians;
    let jobs = data.data.todayJobs;

    // Apply search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      customers = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.address.toLowerCase().includes(search)
      );
      technicians = technicians.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          t.specialty?.toLowerCase().includes(search)
      );
      jobs = jobs.filter(
        (j) =>
          j.jobNumber.toLowerCase().includes(search) ||
          j.customerName.toLowerCase().includes(search) ||
          j.address.toLowerCase().includes(search)
      );
    }

    // Apply technician filter
    if (filters.technicianId) {
      technicians = technicians.filter((t) => t.id === filters.technicianId);
      jobs = jobs.filter((j) => j.technicianId === filters.technicianId);
    }

    // Apply customer has active job filter
    if (filters.customerHasActiveJob) {
      customers = customers.filter((c) => c.hasActiveJob);
    }

    // Apply show only filters
    if (filters.showCustomersOnly) {
      technicians = [];
      jobs = [];
    }
    if (filters.showTechniciansOnly) {
      customers = [];
      jobs = [];
    }
    if (filters.showJobsOnly) {
      customers = [];
      technicians = [];
    }

    // Apply layer visibility
    if (!layers.customers) {
      customers = [];
    }

    if (!layers.technicians) {
      technicians = [];
    } else {
      technicians = technicians.filter((t) => {
        if (t.status === 'en_linea' && !layers.techniciansOnline) return false;
        if (t.status === 'en_camino' && !layers.techniciansEnRoute) return false;
        if (t.status === 'trabajando' && !layers.techniciansWorking) return false;
        if (t.status === 'sin_conexion' && !layers.techniciansOffline) return false;
        return true;
      });
    }

    if (!layers.jobs) {
      jobs = [];
    } else {
      jobs = jobs.filter((j) => {
        if (['PENDING', 'ASSIGNED'].includes(j.status) && !layers.jobsPending) return false;
        if (['EN_ROUTE', 'IN_PROGRESS'].includes(j.status) && !layers.jobsInProgress) return false;
        if (j.status === 'COMPLETED' && !layers.jobsCompleted) return false;
        return true;
      });
    }

    return { customers, technicians, jobs };
  }, [data, layers, filters]);

  // Load Leaflet
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        const leaflet = await import('leaflet');
        // @ts-expect-error CSS imports are handled by bundler
        await import('leaflet/dist/leaflet.css');
        // Load marker cluster plugin
        await import('leaflet.markercluster');
        // @ts-expect-error CSS imports are handled by bundler
        await import('leaflet.markercluster/dist/MarkerCluster.css');
        // @ts-expect-error CSS imports are handled by bundler
        await import('leaflet.markercluster/dist/MarkerCluster.Default.css');
        setL(leaflet.default);
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
      }
    };
    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!L || !mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current).setView(
      [BUENOS_AIRES_CENTER.lat, BUENOS_AIRES_CENTER.lng],
      12
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    leafletMapRef.current = map;

    // Create layer groups
    // @ts-expect-error MarkerClusterGroup is dynamically loaded
    customerLayerRef.current = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: { getChildCount: () => number }) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            width: 36px;
            height: 36px;
            background-color: #3B82F6;
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${count}</div>`,
          className: 'customer-cluster-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
      },
    });
    technicianLayerRef.current = L.layerGroup();
    jobLayerRef.current = L.layerGroup();

    // Add layers to map
    customerLayerRef.current.addTo(map);
    technicianLayerRef.current.addTo(map);
    jobLayerRef.current.addTo(map);

    setIsLoaded(true);

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [L]);

  // Update customer markers
  useEffect(() => {
    if (!L || !isLoaded || !customerLayerRef.current) return;

    customerLayerRef.current.clearLayers();

    for (const customer of filteredData.customers) {
      const icon = L.divIcon({
        className: 'customer-marker',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background-color: #3B82F6;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="12" height="12" fill="white" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
      });

      const marker = L.marker([customer.lat, customer.lng], { icon });

      marker.bindPopup(`
        <div style="min-width: 180px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
            📍 ${customer.name}
          </div>
          <div style="font-size: 12px; color: #6B7280; margin-bottom: 8px;">
            ${customer.address}
          </div>
          <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">
            📞 ${customer.phone}
          </div>
          <div style="font-size: 12px; color: #6B7280; margin-bottom: 8px;">
            Trabajos: ${customer.jobCount}
            ${customer.lastJobDate ? ` | Último: ${new Date(customer.lastJobDate).toLocaleDateString('es-AR')}` : ''}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <a href="/dashboard/customers/${customer.id}"
               style="font-size: 12px; color: #3B82F6; text-decoration: none;"
               target="_blank">
              Ver cliente
            </a>
            <a href="/dashboard/jobs/new?customerId=${customer.id}"
               style="font-size: 12px; color: #10B981; text-decoration: none;"
               target="_blank">
              Nuevo trabajo
            </a>
          </div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedCustomer(customer);
        setSelectedTechnician(null);
        setSelectedJob(null);
      });

      customerLayerRef.current?.addLayer(marker);
    }
  }, [L, isLoaded, filteredData.customers]);

  // Update technician markers
  useEffect(() => {
    if (!L || !isLoaded || !technicianLayerRef.current) return;

    technicianLayerRef.current.clearLayers();

    for (const tech of filteredData.technicians) {
      const color = getTechnicianColor(tech.status);
      const isSelected = selectedTechnician?.id === tech.id;
      const size = isSelected ? 32 : 28;

      const icon = L.divIcon({
        className: 'technician-marker',
        html: `
          <div style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            border: ${isSelected ? '3px' : '2px'} solid ${isSelected ? '#1F2937' : 'white'};
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            ${tech.status === 'en_linea' ? 'animation: pulse 2s infinite;' : ''}
          ">
            <svg width="${size * 0.5}" height="${size * 0.5}" fill="white" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
      });

      const marker = L.marker([tech.lat, tech.lng], { icon });

      const statusLabel = {
        en_linea: 'En línea',
        en_camino: 'En camino',
        trabajando: 'Trabajando',
        sin_conexion: 'Sin conexión',
      }[tech.status];

      marker.bindPopup(`
        <div style="min-width: 180px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
            👤 ${tech.name}
          </div>
          <div style="font-size: 12px; color: ${color}; font-weight: 500; margin-bottom: 8px;">
            ${statusLabel}
          </div>
          ${tech.specialty ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">${tech.specialty}</div>` : ''}
          ${
            tech.currentJobNumber
              ? `
            <div style="font-size: 12px; margin-top: 8px; padding: 8px; background: #F3F4F6; border-radius: 4px;">
              <div style="font-weight: 500;">Trabajo actual:</div>
              <div>#${tech.currentJobNumber}</div>
              <div>${tech.currentCustomerName || ''}</div>
              ${tech.etaMinutes ? `<div style="color: #3B82F6; margin-top: 4px;">ETA: ${tech.etaMinutes} min</div>` : ''}
            </div>
          `
              : '<div style="font-size: 12px; color: #10B981; margin-top: 8px;">Disponible</div>'
          }
          ${
            tech.lastUpdated
              ? `<div style="font-size: 11px; color: #9CA3AF; margin-top: 8px;">
              Última actualización: ${new Date(tech.lastUpdated).toLocaleTimeString('es-AR')}
            </div>`
              : ''
          }
        </div>
      `);

      marker.on('click', () => {
        setSelectedTechnician(tech);
        setSelectedCustomer(null);
        setSelectedJob(null);
      });

      technicianLayerRef.current?.addLayer(marker);
    }
  }, [L, isLoaded, filteredData.technicians, selectedTechnician]);

  // Update job markers
  useEffect(() => {
    if (!L || !isLoaded || !jobLayerRef.current) return;

    jobLayerRef.current.clearLayers();

    for (const job of filteredData.jobs) {
      const color = getJobColor(job.status);
      const isSelected = selectedJob?.id === job.id;
      const size = isSelected ? 28 : 24;

      const icon = L.divIcon({
        className: 'job-marker',
        html: `
          <div style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            border: ${isSelected ? '3px' : '2px'} solid ${isSelected ? '#1F2937' : 'white'};
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="${size * 0.5}" height="${size * 0.5}" fill="white" viewBox="0 0 24 24">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
            </svg>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
      });

      const marker = L.marker([job.lat, job.lng], { icon });

      marker.bindPopup(`
        <div style="min-width: 200px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 600; font-size: 14px;">
              Trabajo #${job.jobNumber}
            </span>
            <span style="font-size: 11px; padding: 2px 6px; background: ${color}20; color: ${color}; border-radius: 4px; font-weight: 500;">
              ${getJobStatusLabel(job.status)}
            </span>
          </div>
          <div style="font-size: 12px; color: #374151; margin-bottom: 8px;">
            ${job.description}
          </div>
          <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">
            📍 ${job.address}
          </div>
          <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">
            👤 ${job.customerName}
          </div>
          ${job.technicianName ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">🔧 ${job.technicianName}</div>` : ''}
          ${job.scheduledTime ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 8px;">🕐 ${job.scheduledTime}</div>` : ''}
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <a href="/dashboard/jobs/${job.id}"
               style="font-size: 12px; color: #3B82F6; text-decoration: none;"
               target="_blank">
              Ver trabajo
            </a>
            <a href="tel:${job.customerPhone}"
               style="font-size: 12px; color: #10B981; text-decoration: none;">
              Llamar
            </a>
          </div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedJob(job);
        setSelectedTechnician(null);
        setSelectedCustomer(null);
      });

      jobLayerRef.current?.addLayer(marker);
    }
  }, [L, isLoaded, filteredData.jobs, selectedJob]);

  // Fit bounds when data changes
  useEffect(() => {
    if (!leafletMapRef.current || !isLoaded) return;

    const allPoints: [number, number][] = [
      ...filteredData.customers.map((c) => [c.lat, c.lng] as [number, number]),
      ...filteredData.technicians.map((t) => [t.lat, t.lng] as [number, number]),
      ...filteredData.jobs.map((j) => [j.lat, j.lng] as [number, number]),
    ];

    if (allPoints.length > 1 && !selectedTechnician && !selectedJob && !selectedCustomer) {
      leafletMapRef.current.fitBounds(allPoints, { padding: [50, 50] });
    }
  }, [isLoaded, filteredData, selectedTechnician, selectedJob, selectedCustomer]);

  // Handle technician selection
  const handleTechnicianSelect = useCallback((tech: TechnicianLocation) => {
    setSelectedTechnician(tech);
    setShowItinerary(true);
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([tech.lat, tech.lng], 15, { animate: true });
    }
  }, []);

  // Handle itinerary job click
  const handleItineraryJobClick = useCallback((job: { id: string; location: { lat: number | null; lng: number | null } }) => {
    if (job.location.lat && job.location.lng && leafletMapRef.current) {
      leafletMapRef.current.setView([job.location.lat, job.location.lng], 16, { animate: true });
    }
  }, []);

  // Get technicians list for filter dropdown
  const techniciansList = useMemo(() => {
    return (
      data?.data?.technicians.map((t) => ({ id: t.id, name: t.name })) || []
    );
  }, [data]);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mapa en Vivo</h1>
          <p className="text-sm text-gray-500">
            Seguimiento en tiempo real de técnicos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              showFilters
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              autoRefresh
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-actualización' : 'Pausado'}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {stats.totalTechnicians}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-500">En línea</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {stats.techniciansOnline}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-gray-500">En camino</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {stats.techniciansEnRoute}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-amber-500" />
            <span className="text-sm text-gray-500">Trabajando</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {stats.techniciansWorking}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-emerald-500" />
            <span className="text-sm text-gray-500">Disponibles</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {stats.techniciansOnline - stats.techniciansEnRoute - stats.techniciansWorking}
          </p>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative flex-1 overflow-hidden rounded-lg bg-white shadow-sm">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary-600" />
              <p className="mt-2 text-sm text-gray-500">Cargando mapa...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
              <p className="mt-2 text-sm text-gray-500">
                Error cargando ubicaciones
              </p>
              <button
                onClick={() => refetch()}
                className="mt-2 text-sm text-primary-600 hover:underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div ref={mapRef} className="h-full w-full" />

            {/* Map Controls Overlay */}
            <div className="absolute left-4 top-4 z-[1000] flex flex-col gap-3">
              {/* Layer Controls */}
              <MapLayerControls
                layers={layers}
                onLayerChange={setLayers}
                stats={stats}
                isCollapsed={!showLayerControls}
                onToggleCollapse={() => setShowLayerControls(!showLayerControls)}
              />

              {/* Filters Panel */}
              {showFilters && (
                <MapFiltersPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  technicians={techniciansList}
                  zones={[]}
                  onClearFilters={() => setFilters(defaultFilters)}
                />
              )}
            </div>

            {/* Itinerary Panel */}
            {showItinerary && selectedTechnician && (
              <div className="absolute right-0 top-0 h-full w-full sm:w-96 z-[1000]">
                <ItineraryPanel
                  technicianId={selectedTechnician.id}
                  technicianName={selectedTechnician.name}
                  onClose={() => {
                    setShowItinerary(false);
                    setSelectedTechnician(null);
                  }}
                  onJobClick={handleItineraryJobClick}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span>Clientes</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span>En línea</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span>En camino</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-amber-500" />
          <span>Trabajando</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-gray-400" />
          <span>Sin conexión</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-orange-500" />
          <span>Trabajo</span>
        </div>
        {data?.data?.updatedAt && (
          <span className="ml-auto">
            Última actualización:{' '}
            {new Date(data.data.updatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Add pulse animation CSS */}
      <style jsx global>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
      `}</style>
    </div>
  );
}
