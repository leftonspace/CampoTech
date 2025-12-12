'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Maximize2,
  Minimize2,
  Navigation2,
  Car,
  Zap,
  XCircle,
  MapPinOff,
  UserPlus,
  Plus,
  Route,
  History,
} from 'lucide-react';
import { MapLayerControls, MapLayerState } from '@/components/maps/MapLayerControls';
import { MapFiltersPanel, MapFilters } from '@/components/maps/MapFiltersPanel';
import { ItineraryPanel } from '@/components/maps/ItineraryPanel';
import { ReassignJobDialog } from '@/components/maps/ReassignJobDialog';
import { CoordinatePickerDialog } from '@/components/maps/CoordinatePickerDialog';
import { useAuth } from '@/lib/auth-context';

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
  heading: number | null;
  locationSource?: 'current' | 'home' | 'office';
  nextJob?: {
    id: string;
    jobNumber: string;
    customerName: string;
    scheduledTime: string | null;
  } | null;
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
  arrivedAt: string | null;
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
    zones: { id: string; name: string }[];
    updatedAt: string;
  };
}

interface RouteData {
  polyline: [number, number][];
  durationMinutes: number;
  distanceMeters: number;
}

type LeafletType = typeof import('leaflet');
type MapType = import('leaflet').Map;
type LayerGroupType = import('leaflet').LayerGroup;
type PolylineType = import('leaflet').Polyline;
type MarkerClusterGroupType = import('leaflet.markercluster').MarkerClusterGroup;

// Buenos Aires default center
const BUENOS_AIRES_CENTER = { lat: -34.6037, lng: -58.3816 };

// Route deviation threshold in meters
const ROUTE_DEVIATION_THRESHOLD = 500; // 500 meters

// Calculate distance between two points using Haversine formula
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate minimum distance from a point to a polyline
function distanceToPolyline(
  point: { lat: number; lng: number },
  polyline: [number, number][]
): number {
  if (polyline.length < 2) return Infinity;

  let minDistance = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const segmentStart = { lat: polyline[i][0], lng: polyline[i][1] };
    const segmentEnd = { lat: polyline[i + 1][0], lng: polyline[i + 1][1] };

    // Project point onto line segment
    const dx = segmentEnd.lng - segmentStart.lng;
    const dy = segmentEnd.lat - segmentStart.lat;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.lng - segmentStart.lng) * dx + (point.lat - segmentStart.lat) * dy) /
          (dx * dx + dy * dy || 1)
      )
    );

    const nearestLng = segmentStart.lng + t * dx;
    const nearestLat = segmentStart.lat + t * dy;

    const distance = haversineDistance(point.lat, point.lng, nearestLat, nearestLng);
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

interface RouteDeviation {
  technicianId: string;
  technicianName: string;
  distanceMeters: number;
  jobNumber: string;
}

// Fetch map data
async function fetchMapData(params: URLSearchParams): Promise<MapDataResponse> {
  const res = await fetch(`/api/map/data?${params.toString()}`);
  if (!res.ok) throw new Error('Error cargando datos del mapa');
  return res.json();
}

// Fetch route data
async function fetchRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteData | null> {
  try {
    const res = await fetch(
      `/api/map/route?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
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
    case 'ARRIVED':
      return '#EAB308'; // yellow
    case 'ASSIGNED':
      return '#6366F1'; // indigo
    case 'CANCELLED':
      return '#EF4444'; // red
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
    case 'ARRIVED':
      return 'Llegó';
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

// Get job status icon SVG
function getJobStatusIcon(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>'; // checkmark
    case 'IN_PROGRESS':
      return '<path d="M7 2v11h3v9l7-12h-4l4-8z"/>'; // lightning
    case 'EN_ROUTE':
      return '<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>'; // car
    case 'ARRIVED':
      return '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>'; // pin
    case 'CANCELLED':
      return '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>'; // x
    case 'ASSIGNED':
      return '<path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>'; // clipboard
    default:
      return '<path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>'; // clipboard
  }
}

// Format relative time
function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString('es-AR');
}

// Default layer state
const defaultLayers: MapLayerState = {
  customers: true,
  customersWithActiveJob: true,
  technicians: true,
  techniciansActive: true,
  techniciansInactive: true,
  techniciansOnline: true,
  techniciansEnRoute: true,
  techniciansWorking: true,
  techniciansOffline: true,
  jobs: true,
  jobsPending: true,
  jobsInProgress: true,
  jobsCompleted: false,
};

// Map type options
type MapTileType = 'street' | 'satellite' | 'terrain';

const MAP_TILE_URLS: Record<MapTileType, { url: string; attribution: string; name: string }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    name: 'Calles',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    name: 'Satélite',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    name: 'Terreno',
  },
};

// Default filters
const defaultFilters: MapFilters = {
  search: '',
  technicianId: null,
  zone: null,
  customerHasActiveJob: false,
  customerNoRecentJob: false,
  showCustomersOnly: false,
  showTechniciansOnly: false,
  showJobsOnly: false,
};

// Store marker positions for smooth animation
const markerPositions = new Map<string, { lat: number; lng: number }>();

export default function LiveMapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  // Role-based access check - only ADMIN, OWNER, DISPATCHER can access full map
  const allowedRoles = ['ADMIN', 'OWNER', 'DISPATCHER'];
  const hasAccess = user && allowedRoles.includes(user.role.toUpperCase());
  const isTechnician = user?.role.toUpperCase() === 'TECHNICIAN';

  // Early return for technicians - they should use the mobile app for tracking
  if (!authLoading && isTechnician) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <div className="text-center">
          <MapPin className="mx-auto h-16 w-16 text-gray-300" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Acceso restringido
          </h2>
          <p className="mt-2 max-w-md text-gray-500">
            Como técnico, puedes ver tu ubicación y trabajos asignados desde la
            aplicación móvil o tu panel de técnico.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <a
              href="/dashboard/technician"
              className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
            >
              Ir a mi panel
            </a>
            <a
              href="/dashboard/jobs"
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Ver mis trabajos
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Early return for unauthorized access
  if (!authLoading && !hasAccess && !isTechnician) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-16 w-16 text-red-300" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Sin permisos
          </h2>
          <p className="mt-2 max-w-md text-gray-500">
            No tienes permisos para acceder al mapa en vivo. Contacta al
            administrador si crees que esto es un error.
          </p>
          <a
            href="/dashboard"
            className="mt-6 inline-block rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
          >
            Volver al dashboard
          </a>
        </div>
      </div>
    );
  }

  // Initialize state from URL params
  const getInitialFilters = (): MapFilters => {
    const search = searchParams.get('search') || '';
    const technicianId = searchParams.get('technicianId') || null;
    const zone = searchParams.get('zone') || null;
    const customerHasActiveJob = searchParams.get('customerHasActiveJob') === 'true';
    const customerNoRecentJob = searchParams.get('customerNoRecentJob') === 'true';
    return { ...defaultFilters, search, technicianId, zone, customerHasActiveJob, customerNoRecentJob };
  };

  // State
  const [layers, setLayers] = useState<MapLayerState>(defaultLayers);
  const [filters, setFilters] = useState<MapFilters>(getInitialFilters);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showLayerControls, setShowLayerControls] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianLocation | null>(null);
  const [showItinerary, setShowItinerary] = useState(false);
  const [selectedJob, setSelectedJob] = useState<TodayJob | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLocation | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [mapTileType, setMapTileType] = useState<MapTileType>('street');
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [jobToReassign, setJobToReassign] = useState<TodayJob | null>(null);
  const [showCoordinatePicker, setShowCoordinatePicker] = useState(false);
  const [entityForCoordinates, setEntityForCoordinates] = useState<{
    type: 'customer' | 'job' | 'location';
    id: string;
    name: string;
    lat?: number;
    lng?: number;
    address?: string;
  } | null>(null);
  const [breadcrumbTrail, setBreadcrumbTrail] = useState<[number, number][]>([]);
  const [routeDeviations, setRouteDeviations] = useState<RouteDeviation[]>([]);

  // Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<MapType | null>(null);
  const customerLayerRef = useRef<LayerGroupType | MarkerClusterGroupType | null>(null);
  const technicianLayerRef = useRef<LayerGroupType | null>(null);
  const jobLayerRef = useRef<LayerGroupType | null>(null);
  const routeLayerRef = useRef<PolylineType | null>(null);
  const breadcrumbLayerRef = useRef<PolylineType | null>(null);
  const tileLayerRef = useRef<import('leaflet').TileLayer | null>(null);
  const itineraryLayerRef = useRef<LayerGroupType | null>(null);
  const technicianMarkersRef = useRef<Map<string, import('leaflet').Marker>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [L, setL] = useState<LeafletType | null>(null);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.technicianId) params.set('technicianId', filters.technicianId);
    if (filters.zone) params.set('zone', filters.zone);
    return params;
  }, [filters.technicianId, filters.zone]);

  // Query
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['map-data', queryParams.toString()],
    queryFn: () => fetchMapData(queryParams),
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

  const zones = data?.data?.zones || [];

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.technicianId) params.set('technicianId', filters.technicianId);
    if (filters.zone) params.set('zone', filters.zone);
    if (filters.customerHasActiveJob) params.set('customerHasActiveJob', 'true');
    if (filters.customerNoRecentJob) params.set('customerNoRecentJob', 'true');

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [filters]);

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

    // Apply customer no recent job filter (>30 days)
    if (filters.customerNoRecentJob) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      customers = customers.filter((c) => {
        if (!c.lastJobDate) return true;
        return new Date(c.lastJobDate) < thirtyDaysAgo;
      });
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
        if (['EN_ROUTE', 'IN_PROGRESS', 'ARRIVED'].includes(j.status) && !layers.jobsInProgress) return false;
        if (j.status === 'COMPLETED' && !layers.jobsCompleted) return false;
        if (j.status === 'CANCELLED') return false; // Always hide cancelled
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

    const map = L.map(mapRef.current, {
      zoomControl: false, // We'll add custom controls
    }).setView([BUENOS_AIRES_CENTER.lat, BUENOS_AIRES_CENTER.lng], 12);

    // Add initial tile layer
    const tileConfig = MAP_TILE_URLS[mapTileType];
    const tileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    leafletMapRef.current = map;

    // Create layer groups
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

  // Handle map tile type changes
  useEffect(() => {
    if (!L || !leafletMapRef.current || !tileLayerRef.current) return;

    const tileConfig = MAP_TILE_URLS[mapTileType];

    // Remove old tile layer and add new one
    leafletMapRef.current.removeLayer(tileLayerRef.current);
    const newTileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
    }).addTo(leafletMapRef.current);
    tileLayerRef.current = newTileLayer;
  }, [L, mapTileType]);

  // Handle breadcrumb trail rendering
  useEffect(() => {
    if (!L || !leafletMapRef.current || !isLoaded) return;

    // Remove existing breadcrumb layer
    if (breadcrumbLayerRef.current) {
      leafletMapRef.current.removeLayer(breadcrumbLayerRef.current);
      breadcrumbLayerRef.current = null;
    }

    // Draw breadcrumb trail if enabled and we have data
    if (showBreadcrumbs && breadcrumbTrail.length > 1) {
      breadcrumbLayerRef.current = L.polyline(breadcrumbTrail, {
        color: '#6366F1',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 5',
      }).addTo(leafletMapRef.current);
    }
  }, [L, isLoaded, showBreadcrumbs, breadcrumbTrail]);

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
            cursor: pointer;
          " title="${customer.name}">
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

      // Add tooltip on hover
      marker.bindTooltip(customer.name, {
        permanent: false,
        direction: 'top',
        offset: [0, -20],
      });

      marker.bindPopup(`
        <div style="min-width: 200px;">
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
            ${customer.lastJobDate ? ` | Último: ${formatRelativeTime(customer.lastJobDate)}` : ''}
          </div>
          ${customer.hasActiveJob ? '<div style="font-size: 11px; color: #F59E0B; margin-bottom: 8px;">⚡ Tiene trabajo activo</div>' : ''}
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <a href="/dashboard/customers/${customer.id}"
               style="font-size: 12px; color: #3B82F6; text-decoration: none; display: flex; align-items: center; gap: 4px;"
               target="_blank">
              Ver cliente →
            </a>
            <a href="/dashboard/jobs/new?customerId=${customer.id}"
               style="font-size: 12px; color: #10B981; text-decoration: none; display: flex; align-items: center; gap: 4px;"
               target="_blank">
              + Nuevo trabajo
            </a>
          </div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedCustomer(customer);
        setSelectedTechnician(null);
        setSelectedJob(null);
        setShowItinerary(false);
      });

      customerLayerRef.current?.addLayer(marker);
    }
  }, [L, isLoaded, filteredData.customers]);

  // Update technician markers with smooth animation
  useEffect(() => {
    if (!L || !isLoaded || !technicianLayerRef.current) return;

    const existingMarkers = technicianMarkersRef.current;
    const currentTechIds = new Set(filteredData.technicians.map((t) => t.id));

    // Remove markers for technicians no longer in view
    existingMarkers.forEach((marker, id) => {
      if (!currentTechIds.has(id)) {
        technicianLayerRef.current?.removeLayer(marker);
        existingMarkers.delete(id);
        markerPositions.delete(id);
      }
    });

    for (const tech of filteredData.technicians) {
      const color = getTechnicianColor(tech.status);
      const isSelected = selectedTechnician?.id === tech.id;
      const size = isSelected ? 36 : 30;
      const heading = tech.heading || 0;

      // Create direction arrow for en_camino status
      const directionArrow =
        tech.status === 'en_camino' && tech.heading !== null
          ? `<div style="
              position: absolute;
              top: -8px;
              left: 50%;
              transform: translateX(-50%) rotate(${heading}deg);
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-bottom: 10px solid ${color};
            "></div>`
          : '';

      const icon = L.divIcon({
        className: 'technician-marker',
        html: `
          <div style="position: relative;">
            ${directionArrow}
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
              cursor: pointer;
              transition: transform 0.3s ease;
              ${tech.status === 'en_linea' ? 'animation: pulse 2s infinite;' : ''}
            " title="${tech.name}">
              ${
                tech.avatarUrl
                  ? `<img src="${tech.avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`
                  : `<svg width="${size * 0.5}" height="${size * 0.5}" fill="white" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>`
              }
            </div>
          </div>
        `,
        iconSize: [size, size + (tech.status === 'en_camino' ? 10 : 0)],
        iconAnchor: [size / 2, size / 2 + (tech.status === 'en_camino' ? 5 : 0)],
        popupAnchor: [0, -size / 2],
      });

      const statusLabel = {
        en_linea: 'En línea',
        en_camino: 'En camino',
        trabajando: 'Trabajando',
        sin_conexion: 'Sin conexión',
      }[tech.status];

      // Check if marker exists - animate if so
      const existingMarker = existingMarkers.get(tech.id);
      const prevPos = markerPositions.get(tech.id);

      if (existingMarker && prevPos) {
        // Animate to new position
        const startLat = prevPos.lat;
        const startLng = prevPos.lng;
        const endLat = tech.lat;
        const endLng = tech.lng;

        // Only animate if position changed significantly
        if (Math.abs(startLat - endLat) > 0.00001 || Math.abs(startLng - endLng) > 0.00001) {
          const duration = 1000; // 1 second animation
          const startTime = Date.now();

          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);

            const currentLat = startLat + (endLat - startLat) * eased;
            const currentLng = startLng + (endLng - startLng) * eased;

            existingMarker.setLatLng([currentLat, currentLng]);

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }

        // Update icon
        existingMarker.setIcon(icon);
        markerPositions.set(tech.id, { lat: tech.lat, lng: tech.lng });
      } else {
        // Create new marker
        const marker = L.marker([tech.lat, tech.lng], { icon });

        // Add tooltip on hover
        marker.bindTooltip(tech.name, {
          permanent: false,
          direction: 'top',
          offset: [0, -20],
        });

        marker.bindPopup(`
          <div style="min-width: 220px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              ${
                tech.avatarUrl
                  ? `<img src="${tech.avatarUrl}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />`
                  : `<div style="width: 40px; height: 40px; border-radius: 50%; background: ${color}; display: flex; align-items: center; justify-content: center;">
                  <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>`
              }
              <div>
                <div style="font-weight: 600; font-size: 14px;">${tech.name}</div>
                <div style="font-size: 12px; color: ${color}; font-weight: 500;">${statusLabel}</div>
              </div>
            </div>
            ${tech.specialty ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">🔧 ${tech.specialty}</div>` : ''}
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
                : '<div style="font-size: 12px; color: #10B981; margin-top: 8px;">✓ Disponible</div>'
            }
            ${
              tech.nextJob
                ? `
              <div style="font-size: 12px; margin-top: 8px; padding: 8px; background: #EEF2FF; border-radius: 4px;">
                <div style="font-weight: 500; color: #6366F1;">Próximo trabajo:</div>
                <div>#${tech.nextJob.jobNumber} - ${tech.nextJob.customerName}</div>
                ${tech.nextJob.scheduledTime ? `<div>🕐 ${tech.nextJob.scheduledTime}</div>` : ''}
              </div>
            `
                : ''
            }
            ${
              tech.lastUpdated
                ? `<div style="font-size: 11px; color: #9CA3AF; margin-top: 8px;">
                Última vez: ${formatRelativeTime(tech.lastUpdated)}
              </div>`
                : ''
            }
            <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 8px; border-top: 1px solid #E5E7EB;">
              <button onclick="window.open('/dashboard/technicians/${tech.id}/itinerary', '_blank')"
                style="flex: 1; font-size: 12px; padding: 6px 8px; background: #3B82F6; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Ver itinerario
              </button>
              <a href="tel:${tech.phone}"
                style="flex: 1; font-size: 12px; padding: 6px 8px; background: #10B981; color: white; text-decoration: none; border-radius: 4px; text-align: center;">
                📞 Llamar
              </a>
            </div>
          </div>
        `);

        marker.on('click', () => {
          setSelectedTechnician(tech);
          setSelectedCustomer(null);
          setSelectedJob(null);
        });

        technicianLayerRef.current?.addLayer(marker);
        existingMarkers.set(tech.id, marker);
        markerPositions.set(tech.id, { lat: tech.lat, lng: tech.lng });
      }
    }
  }, [L, isLoaded, filteredData.technicians, selectedTechnician]);

  // Update job markers
  useEffect(() => {
    if (!L || !isLoaded || !jobLayerRef.current) return;

    jobLayerRef.current.clearLayers();

    for (const job of filteredData.jobs) {
      const color = getJobColor(job.status);
      const isSelected = selectedJob?.id === job.id;
      const size = isSelected ? 32 : 26;
      const statusIcon = getJobStatusIcon(job.status);

      // Animation for EN_ROUTE status
      const isAnimated = job.status === 'EN_ROUTE';

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
            cursor: pointer;
            ${isAnimated ? 'animation: job-pulse 1.5s infinite;' : ''}
          " title="Trabajo #${job.jobNumber}">
            <svg width="${size * 0.55}" height="${size * 0.55}" fill="white" viewBox="0 0 24 24">
              ${statusIcon}
            </svg>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
      });

      const marker = L.marker([job.lat, job.lng], { icon });

      // Add tooltip on hover
      marker.bindTooltip(`#${job.jobNumber} - ${job.customerName}`, {
        permanent: false,
        direction: 'top',
        offset: [0, -20],
      });

      marker.bindPopup(`
        <div style="min-width: 220px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 600; font-size: 14px;">
              #${job.jobNumber}
            </span>
            <span style="font-size: 11px; padding: 2px 8px; background: ${color}20; color: ${color}; border-radius: 4px; font-weight: 500;">
              ${getJobStatusLabel(job.status)}
            </span>
          </div>
          <div style="font-size: 12px; color: #374151; margin-bottom: 8px;">
            ${job.description || job.serviceType}
          </div>
          <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">
            📍 ${job.address}
          </div>
          <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">
            👤 ${job.customerName}
          </div>
          ${job.technicianName ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">🔧 ${job.technicianName}</div>` : '<div style="font-size: 12px; color: #EF4444; margin-bottom: 4px;">⚠️ Sin asignar</div>'}
          ${job.scheduledTime ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">🕐 Programado: ${job.scheduledTime}</div>` : ''}
          ${job.arrivedAt ? `<div style="font-size: 12px; color: #10B981; margin-bottom: 4px;">✓ Llegó: ${new Date(job.arrivedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
          <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 8px; border-top: 1px solid #E5E7EB;">
            <a href="/dashboard/jobs/${job.id}"
               style="flex: 1; font-size: 12px; padding: 6px 8px; background: #3B82F6; color: white; text-decoration: none; border-radius: 4px; text-align: center;"
               target="_blank">
              Ver trabajo
            </a>
            <a href="tel:${job.customerPhone}"
               style="flex: 1; font-size: 12px; padding: 6px 8px; background: #10B981; color: white; text-decoration: none; border-radius: 4px; text-align: center;">
              📞 Contactar
            </a>
          </div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedJob(job);
        setSelectedTechnician(null);
        setSelectedCustomer(null);
        setShowItinerary(false);
      });

      jobLayerRef.current?.addLayer(marker);
    }
  }, [L, isLoaded, filteredData.jobs, selectedJob]);

  // Fetch and draw route when technician with active job is selected
  useEffect(() => {
    if (!L || !isLoaded || !leafletMapRef.current) return;

    // Clear existing route
    if (routeLayerRef.current) {
      leafletMapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    // Draw route if technician is en_camino and has a current job
    if (selectedTechnician?.status === 'en_camino' && selectedTechnician.currentJobId) {
      const job = filteredData.jobs.find((j) => j.id === selectedTechnician.currentJobId);
      if (job) {
        fetchRoute(selectedTechnician.lat, selectedTechnician.lng, job.lat, job.lng).then(
          (route) => {
            if (route && leafletMapRef.current) {
              setRouteData(route);
              routeLayerRef.current = L.polyline(route.polyline, {
                color: '#3B82F6',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 10',
              }).addTo(leafletMapRef.current);

              // Add ETA popup at midpoint
              const midIndex = Math.floor(route.polyline.length / 2);
              const midPoint = route.polyline[midIndex];
              L.popup({ closeButton: false, autoClose: false, closeOnClick: false })
                .setLatLng(midPoint)
                .setContent(
                  `<div style="font-size: 12px; font-weight: 500; color: #3B82F6;">${route.durationMinutes} min</div>`
                )
                .openOn(leafletMapRef.current);
            }
          }
        );
      }
    }
  }, [L, isLoaded, selectedTechnician, filteredData.jobs]);

  // Draw numbered job markers for selected technician's route
  useEffect(() => {
    if (!L || !isLoaded || !leafletMapRef.current) return;

    // Create itinerary layer if it doesn't exist
    if (!itineraryLayerRef.current) {
      itineraryLayerRef.current = L.layerGroup().addTo(leafletMapRef.current);
    }

    // Clear existing numbered markers
    itineraryLayerRef.current.clearLayers();

    // Only show numbered markers when showing itinerary
    if (!showItinerary || !selectedTechnician) return;

    // Get technician's jobs for today, sorted by scheduled time
    const techJobs = filteredData.jobs
      .filter((j) => j.technicianId === selectedTechnician.id)
      .sort((a, b) => {
        // Sort by status priority (in progress > assigned > pending > completed)
        const statusOrder: Record<string, number> = {
          IN_PROGRESS: 1,
          EN_ROUTE: 2,
          ARRIVED: 3,
          ASSIGNED: 4,
          PENDING: 5,
          COMPLETED: 6,
        };
        const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        if (statusDiff !== 0) return statusDiff;

        // Then by scheduled time
        if (a.scheduledTime && b.scheduledTime) {
          return a.scheduledTime.localeCompare(b.scheduledTime);
        }
        return 0;
      });

    // Add numbered markers for each job
    techJobs.forEach((job, index) => {
      const number = index + 1;
      const color = getJobColor(job.status);
      const isActive = ['IN_PROGRESS', 'EN_ROUTE', 'ARRIVED'].includes(job.status);

      const icon = L.divIcon({
        className: 'numbered-job-marker',
        html: `
          <div style="
            position: relative;
            width: 28px;
            height: 28px;
          ">
            <div style="
              width: 28px;
              height: 28px;
              background: ${color};
              border: 2px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              ${isActive ? 'animation: pulse 2s infinite;' : ''}
            ">
              <span style="
                color: white;
                font-size: 12px;
                font-weight: 700;
              ">${number}</span>
            </div>
            ${
              index < techJobs.length - 1
                ? `<div style="
                position: absolute;
                bottom: -8px;
                left: 50%;
                transform: translateX(-50%);
                width: 2px;
                height: 8px;
                background: ${color};
              "></div>`
                : ''
            }
          </div>
        `,
        iconSize: [28, 36],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([job.lat, job.lng], { icon, zIndexOffset: 1000 + index });

      marker.bindTooltip(`#${number}: ${job.customerName}`, {
        permanent: false,
        direction: 'right',
        offset: [15, 0],
      });

      itineraryLayerRef.current?.addLayer(marker);
    });

    // Draw connecting lines between jobs
    if (techJobs.length > 1) {
      const points: [number, number][] = [
        [selectedTechnician.lat, selectedTechnician.lng],
        ...techJobs.map((j) => [j.lat, j.lng] as [number, number]),
      ];

      const routeLine = L.polyline(points, {
        color: '#6366F1',
        weight: 2,
        opacity: 0.5,
        dashArray: '8, 8',
      });

      itineraryLayerRef.current?.addLayer(routeLine);
    }
  }, [L, isLoaded, showItinerary, selectedTechnician, filteredData.jobs]);

  // Route deviation detection for en_camino technicians
  useEffect(() => {
    if (!routeData || !selectedTechnician?.status || selectedTechnician.status !== 'en_camino') {
      // Clear deviations when not tracking a specific route
      if (routeDeviations.length > 0 && !selectedTechnician) {
        setRouteDeviations([]);
      }
      return;
    }

    // Calculate distance from technician to route
    const distance = distanceToPolyline(
      { lat: selectedTechnician.lat, lng: selectedTechnician.lng },
      routeData.polyline
    );

    if (distance > ROUTE_DEVIATION_THRESHOLD) {
      // Technician has deviated from route
      const job = filteredData.jobs.find((j) => j.id === selectedTechnician.currentJobId);
      const deviation: RouteDeviation = {
        technicianId: selectedTechnician.id,
        technicianName: selectedTechnician.name,
        distanceMeters: Math.round(distance),
        jobNumber: job?.jobNumber || 'Desconocido',
      };

      // Update if not already in list or if distance changed significantly
      setRouteDeviations((prev) => {
        const existing = prev.find((d) => d.technicianId === selectedTechnician.id);
        if (!existing) {
          return [...prev, deviation];
        }
        // Update if distance changed by more than 50m
        if (Math.abs(existing.distanceMeters - deviation.distanceMeters) > 50) {
          return prev.map((d) =>
            d.technicianId === selectedTechnician.id ? deviation : d
          );
        }
        return prev;
      });
    } else {
      // Technician is on route, remove from deviations
      setRouteDeviations((prev) =>
        prev.filter((d) => d.technicianId !== selectedTechnician.id)
      );
    }
  }, [routeData, selectedTechnician, filteredData.jobs, routeDeviations.length]);

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
  const handleItineraryJobClick = useCallback(
    (job: { id: string; location: { lat: number | null; lng: number | null } }) => {
      if (job.location.lat && job.location.lng && leafletMapRef.current) {
        leafletMapRef.current.setView([job.location.lat, job.location.lng], 16, { animate: true });

        // Find and open popup for this job
        jobLayerRef.current?.eachLayer((layer) => {
          const marker = layer as import('leaflet').Marker;
          const latLng = marker.getLatLng();
          if (
            Math.abs(latLng.lat - job.location.lat!) < 0.0001 &&
            Math.abs(latLng.lng - job.location.lng!) < 0.0001
          ) {
            marker.openPopup();
          }
        });
      }
    },
    []
  );

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      mapRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Handle current location
  const goToCurrentLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (leafletMapRef.current) {
            leafletMapRef.current.setView(
              [position.coords.latitude, position.coords.longitude],
              15,
              { animate: true }
            );
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }, []);

  // Get technicians list for filter dropdown
  const techniciansList = useMemo(() => {
    return data?.data?.technicians.map((t) => ({ id: t.id, name: t.name })) || [];
  }, [data]);

  // Quick filter handlers
  const handleQuickFilterActive = useCallback(() => {
    setLayers((prev) => ({
      ...prev,
      techniciansOnline: true,
      techniciansEnRoute: true,
      techniciansWorking: true,
      techniciansOffline: false,
    }));
  }, []);

  const handleQuickFilterJobs = useCallback(() => {
    setFilters((prev) => ({ ...prev, showJobsOnly: !prev.showJobsOnly }));
  }, []);

  // Empty state messages - entity-specific
  const getEmptyStateMessage = () => {
    const total =
      filteredData.customers.length +
      filteredData.technicians.length +
      filteredData.jobs.length;

    if (total === 0) {
      // Search with no results
      if (filters.search) {
        return {
          icon: <MapPinOff className="h-12 w-12 text-gray-300" />,
          title: 'Sin resultados',
          message: `No se encontraron resultados para "${filters.search}"`,
          action: (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
              className="text-primary-600 hover:underline"
            >
              Limpiar búsqueda
            </button>
          ),
        };
      }

      // All layers hidden
      if (!layers.customers && !layers.technicians && !layers.jobs) {
        return {
          icon: <Layers className="h-12 w-12 text-gray-300" />,
          title: 'Capas ocultas',
          message: 'Todas las capas están desactivadas',
          action: (
            <button
              onClick={() => setLayers(defaultLayers)}
              className="text-primary-600 hover:underline"
            >
              Mostrar todas las capas
            </button>
          ),
        };
      }

      // Only customers layer is on but no customers
      if (layers.customers && !layers.technicians && !layers.jobs) {
        return {
          icon: <Users className="h-12 w-12 text-gray-300" />,
          title: 'Sin clientes geolocalizados',
          message: 'No hay clientes con ubicación en el mapa. Agrega coordenadas a tus clientes.',
          action: (
            <div className="flex gap-2">
              <a
                href="/dashboard/customers/new"
                className="flex items-center gap-1 rounded bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700"
              >
                <UserPlus className="h-4 w-4" />
                Agregar cliente
              </a>
            </div>
          ),
        };
      }

      // Only technicians layer is on but no technicians
      if (layers.technicians && !layers.customers && !layers.jobs) {
        return {
          icon: <Navigation className="h-12 w-12 text-gray-300" />,
          title: 'Sin técnicos disponibles',
          message: 'No hay técnicos con ubicación activa. Los técnicos aparecerán cuando inicien sesión en la app móvil.',
          action: (
            <a
              href="/dashboard/users"
              className="text-primary-600 hover:underline"
            >
              Ver técnicos
            </a>
          ),
        };
      }

      // Only jobs layer is on but no jobs
      if (layers.jobs && !layers.customers && !layers.technicians) {
        return {
          icon: <Wrench className="h-12 w-12 text-gray-300" />,
          title: 'Sin trabajos hoy',
          message: 'No hay trabajos programados para hoy. Crea un nuevo trabajo para verlo en el mapa.',
          action: (
            <a
              href="/dashboard/jobs/new"
              className="flex items-center gap-1 rounded bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              Nuevo trabajo
            </a>
          ),
        };
      }

      // Generic empty state
      return {
        icon: <MapPin className="h-12 w-12 text-gray-300" />,
        title: 'Sin ubicaciones',
        message: 'No hay clientes, técnicos ni trabajos para mostrar en el mapa.',
        action: (
          <div className="flex flex-wrap gap-2 justify-center">
            <a
              href="/dashboard/customers/new"
              className="flex items-center gap-1 rounded bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700"
            >
              <UserPlus className="h-4 w-4" />
              Agregar cliente
            </a>
            <a
              href="/dashboard/jobs/new"
              className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Nuevo trabajo
            </a>
          </div>
        ),
      };
    }
    return null;
  };

  const emptyState = getEmptyStateMessage();

  return (
    <div className={`flex flex-col ${isFullscreen ? 'h-screen' : 'h-[calc(100vh-8rem)]'}`}>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mapa en Vivo</h1>
          <p className="text-sm text-gray-500">Seguimiento en tiempo real de técnicos</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Filters */}
          <button
            onClick={handleQuickFilterActive}
            className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-200"
          >
            <Users className="h-4 w-4" />
            Solo activos
          </button>
          <button
            onClick={handleQuickFilterJobs}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              filters.showJobsOnly
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Wrench className="h-4 w-4" />
            Trabajos de hoy
          </button>
          {/* Map Type Toggle */}
          <div className="relative">
            <select
              value={mapTileType}
              onChange={(e) => setMapTileType(e.target.value as MapTileType)}
              className="appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Object.entries(MAP_TILE_URLS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name}
                </option>
              ))}
            </select>
            <Layers className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="h-6 w-px bg-gray-300" />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              showFilters ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto' : 'Pausado'}
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
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.totalTechnicians}</p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-500">En línea</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-600">{stats.techniciansOnline}</p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-gray-500">En camino</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-600">{stats.techniciansEnRoute}</p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-amber-500" />
            <span className="text-sm text-gray-500">Trabajando</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats.techniciansWorking}</p>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-emerald-500" />
            <span className="text-sm text-gray-500">Disponibles</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {Math.max(0, stats.techniciansOnline - stats.techniciansEnRoute - stats.techniciansWorking)}
          </p>
        </div>
      </div>

      {/* Route Deviation Alerts */}
      {routeDeviations.length > 0 && (
        <div className="mb-4 space-y-2">
          {routeDeviations.map((deviation) => (
            <div
              key={deviation.technicianId}
              className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-800">
                    Desviación de ruta detectada
                  </p>
                  <p className="text-xs text-orange-600">
                    {deviation.technicianName} está a {deviation.distanceMeters}m de la ruta hacia el trabajo #{deviation.jobNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const tech = filteredData.technicians.find(
                      (t) => t.id === deviation.technicianId
                    );
                    if (tech) {
                      handleTechnicianSelect(tech);
                    }
                  }}
                  className="rounded bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
                >
                  Ver en mapa
                </button>
                <button
                  onClick={() => {
                    setRouteDeviations((prev) =>
                      prev.filter((d) => d.technicianId !== deviation.technicianId)
                    );
                  }}
                  className="p-1 text-orange-400 hover:text-orange-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
              <p className="mt-2 text-sm text-gray-500">Error cargando ubicaciones</p>
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

            {/* Empty state overlay */}
            {emptyState && (
              <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80">
                <div className="text-center">
                  {emptyState.icon}
                  <h3 className="mt-2 text-lg font-medium text-gray-900">{emptyState.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">{emptyState.message}</p>
                  <div className="mt-4">{emptyState.action}</div>
                </div>
              </div>
            )}

            {/* Map Controls - Top Left */}
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
                  zones={zones}
                  onClearFilters={() => setFilters(defaultFilters)}
                />
              )}
            </div>

            {/* Map Controls - Top Right */}
            <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-2">
              <button
                onClick={toggleFullscreen}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md hover:bg-gray-50"
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5 text-gray-600" />
                ) : (
                  <Maximize2 className="h-5 w-5 text-gray-600" />
                )}
              </button>
              <button
                onClick={goToCurrentLocation}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md hover:bg-gray-50"
                title="Mi ubicación"
              >
                <Navigation2 className="h-5 w-5 text-gray-600" />
              </button>
              <button
                onClick={() => setShowBreadcrumbs(!showBreadcrumbs)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg shadow-md ${
                  showBreadcrumbs ? 'bg-blue-100' : 'bg-white'
                } hover:bg-gray-50`}
                title="Mostrar recorrido"
              >
                <History className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Route Info - Bottom Center */}
            {routeData && selectedTechnician?.status === 'en_camino' && (
              <div className="absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 transform">
                <div className="flex items-center gap-4 rounded-lg bg-white px-4 py-2 shadow-lg">
                  <div className="flex items-center gap-2">
                    <Route className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium">
                      {(routeData.distanceMeters / 1000).toFixed(1)} km
                    </span>
                  </div>
                  <div className="h-4 w-px bg-gray-300" />
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium">{routeData.durationMinutes} min</span>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Job Actions Panel - Bottom Left */}
            {selectedJob && !showItinerary && (
              <div className="absolute bottom-4 left-4 z-[1000]">
                <div className="rounded-lg bg-white p-3 shadow-lg">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">
                      #{selectedJob.jobNumber}
                    </span>
                    <button
                      onClick={() => setSelectedJob(null)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-gray-500">{selectedJob.customerName}</p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setJobToReassign(selectedJob);
                        setShowReassignDialog(true);
                      }}
                      className="flex items-center justify-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Reasignar técnico
                    </button>
                    <button
                      onClick={() => {
                        setEntityForCoordinates({
                          type: 'job',
                          id: selectedJob.id,
                          name: `Trabajo #${selectedJob.jobNumber}`,
                          lat: selectedJob.lat,
                          lng: selectedJob.lng,
                          address: selectedJob.address,
                        });
                        setShowCoordinatePicker(true);
                      }}
                      className="flex items-center justify-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Ajustar ubicación
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Customer Actions Panel - Bottom Left */}
            {selectedCustomer && !showItinerary && !selectedJob && (
              <div className="absolute bottom-4 left-4 z-[1000]">
                <div className="rounded-lg bg-white p-3 shadow-lg">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">
                      {selectedCustomer.name}
                    </span>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-gray-500">{selectedCustomer.address}</p>
                  <div className="flex flex-col gap-2">
                    <a
                      href={`/dashboard/jobs/new?customerId=${selectedCustomer.id}`}
                      className="flex items-center justify-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nuevo trabajo
                    </a>
                    <button
                      onClick={() => {
                        setEntityForCoordinates({
                          type: 'customer',
                          id: selectedCustomer.id,
                          name: selectedCustomer.name,
                          lat: selectedCustomer.lat,
                          lng: selectedCustomer.lng,
                          address: selectedCustomer.address,
                        });
                        setShowCoordinatePicker(true);
                      }}
                      className="flex items-center justify-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Ajustar ubicación
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Itinerary Panel */}
            {showItinerary && selectedTechnician && (
              <div className="absolute right-0 top-0 z-[1000] h-full w-full sm:w-96">
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
            Última actualización: {new Date(data.data.updatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Reassign Job Dialog */}
      {showReassignDialog && jobToReassign && (
        <ReassignJobDialog
          isOpen={showReassignDialog}
          onClose={() => {
            setShowReassignDialog(false);
            setJobToReassign(null);
          }}
          job={{
            id: jobToReassign.id,
            jobNumber: jobToReassign.jobNumber,
            customerName: jobToReassign.customerName,
            currentTechnicianId: jobToReassign.technicianId,
            currentTechnicianName: jobToReassign.technicianName,
          }}
          onReassigned={() => {
            refetch();
            setShowReassignDialog(false);
            setJobToReassign(null);
          }}
        />
      )}

      {/* Coordinate Picker Dialog */}
      {showCoordinatePicker && entityForCoordinates && (
        <CoordinatePickerDialog
          isOpen={showCoordinatePicker}
          onClose={() => {
            setShowCoordinatePicker(false);
            setEntityForCoordinates(null);
          }}
          entityType={entityForCoordinates.type}
          entityId={entityForCoordinates.id}
          entityName={entityForCoordinates.name}
          currentLat={entityForCoordinates.lat}
          currentLng={entityForCoordinates.lng}
          address={entityForCoordinates.address}
          onSave={() => {
            refetch();
            setShowCoordinatePicker(false);
            setEntityForCoordinates(null);
          }}
        />
      )}

      {/* Add CSS animations */}
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
        @keyframes job-pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
        }
        .leaflet-popup-content {
          margin: 12px;
        }
        .leaflet-tooltip {
          font-family: inherit;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
