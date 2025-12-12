'use client';

import { useState } from 'react';
import {
  Layers,
  MapPin,
  Users,
  Wrench,
  ChevronDown,
  ChevronRight,
  EyeOff,
  UserCheck,
  UserX,
} from 'lucide-react';

export interface MapLayerState {
  customers: boolean;
  customersWithActiveJob: boolean;
  technicians: boolean;
  techniciansActive: boolean;  // Groups: online, en_camino, trabajando
  techniciansInactive: boolean; // Groups: offline
  techniciansOnline: boolean;
  techniciansEnRoute: boolean;
  techniciansWorking: boolean;
  techniciansOffline: boolean;
  jobs: boolean;
  jobsPending: boolean;
  jobsInProgress: boolean;
  jobsCompleted: boolean;
}

interface LayerStats {
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
}

interface MapLayerControlsProps {
  layers: MapLayerState;
  onLayerChange: (layers: MapLayerState) => void;
  stats: LayerStats;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface LayerItemProps {
  label: string;
  count: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ReactNode;
  color?: string;
  indent?: boolean;
  indentLevel?: number;
}

function LayerItem({
  label,
  count,
  checked,
  onChange,
  icon,
  color,
  indent = false,
  indentLevel = 1,
}: LayerItemProps) {
  const marginLeft = indent ? `${indentLevel * 16}px` : '0';

  return (
    <label
      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-gray-50 cursor-pointer"
      style={{ marginLeft }}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        {icon && <span className={color}>{icon}</span>}
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
        {count}
      </span>
    </label>
  );
}

interface LayerGroupProps {
  label: string;
  icon: React.ReactNode;
  color: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  allChecked: boolean;
  onToggleAll: (checked: boolean) => void;
  totalCount: number;
  children: React.ReactNode;
}

function LayerGroup({
  label,
  icon,
  color,
  isExpanded,
  onToggleExpand,
  allChecked,
  onToggleAll,
  totalCount,
  children,
}: LayerGroupProps) {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between py-2 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExpand}
            className="p-0.5 hover:bg-gray-100 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => onToggleAll(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className={color}>{icon}</span>
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {totalCount}
        </span>
      </div>
      {isExpanded && <div className="pb-2">{children}</div>}
    </div>
  );
}

interface SubGroupProps {
  label: string;
  icon: React.ReactNode;
  color: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  allChecked: boolean;
  onToggleAll: (checked: boolean) => void;
  totalCount: number;
  children: React.ReactNode;
}

function SubGroup({
  label,
  icon,
  color,
  isExpanded,
  onToggleExpand,
  allChecked,
  onToggleAll,
  totalCount,
  children,
}: SubGroupProps) {
  return (
    <div className="ml-4">
      <div className="flex items-center justify-between py-1.5 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExpand}
            className="p-0.5 hover:bg-gray-100 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-gray-400" />
            ) : (
              <ChevronRight className="h-3 w-3 text-gray-400" />
            )}
          </button>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => onToggleAll(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className={color}>{icon}</span>
          <span className="text-xs font-medium text-gray-600">{label}</span>
        </div>
        <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
          {totalCount}
        </span>
      </div>
      {isExpanded && <div className="pb-1">{children}</div>}
    </div>
  );
}

export function MapLayerControls({
  layers,
  onLayerChange,
  stats,
  isCollapsed = false,
  onToggleCollapse,
}: MapLayerControlsProps) {
  const [expandedGroups, setExpandedGroups] = useState({
    customers: false,
    technicians: true,
    techniciansActive: true,
    techniciansInactive: false,
    jobs: true,
  });

  const toggleGroup = (group: keyof typeof expandedGroups) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const updateLayer = (key: keyof MapLayerState, value: boolean) => {
    onLayerChange({ ...layers, [key]: value });
  };

  // Calculate active technicians count
  const activeTechniciansCount = stats.techniciansOnline + stats.techniciansEnRoute + stats.techniciansWorking;

  // Toggle all sublayers when parent is toggled
  const toggleCustomers = (checked: boolean) => {
    onLayerChange({
      ...layers,
      customers: checked,
      customersWithActiveJob: checked,
    });
  };

  const toggleTechnicians = (checked: boolean) => {
    onLayerChange({
      ...layers,
      technicians: checked,
      techniciansActive: checked,
      techniciansInactive: checked,
      techniciansOnline: checked,
      techniciansEnRoute: checked,
      techniciansWorking: checked,
      techniciansOffline: checked,
    });
  };

  const toggleActiveTechnicians = (checked: boolean) => {
    onLayerChange({
      ...layers,
      techniciansActive: checked,
      techniciansOnline: checked,
      techniciansEnRoute: checked,
      techniciansWorking: checked,
    });
  };

  const toggleInactiveTechnicians = (checked: boolean) => {
    onLayerChange({
      ...layers,
      techniciansInactive: checked,
      techniciansOffline: checked,
    });
  };

  const toggleJobs = (checked: boolean) => {
    onLayerChange({
      ...layers,
      jobs: checked,
      jobsPending: checked,
      jobsInProgress: checked,
      jobsCompleted: checked,
    });
  };

  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="bg-white rounded-lg shadow-md p-2 hover:bg-gray-50"
        title="Mostrar capas"
      >
        <Layers className="h-5 w-5 text-gray-600" />
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md w-64 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Capas del Mapa
          </span>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-gray-200 rounded"
            title="Ocultar"
          >
            <EyeOff className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Layer Groups */}
      <div className="max-h-96 overflow-y-auto">
        {/* Customers */}
        <LayerGroup
          label="Clientes"
          icon={<MapPin className="h-4 w-4" />}
          color="text-blue-500"
          isExpanded={expandedGroups.customers}
          onToggleExpand={() => toggleGroup('customers')}
          allChecked={layers.customers}
          onToggleAll={toggleCustomers}
          totalCount={stats.customersWithLocation}
        >
          <LayerItem
            label="Con trabajo activo"
            count={stats.todayJobsTotal}
            checked={layers.customersWithActiveJob}
            onChange={(v) => updateLayer('customersWithActiveJob', v)}
            indent
          />
        </LayerGroup>

        {/* Technicians */}
        <LayerGroup
          label="Técnicos"
          icon={<Users className="h-4 w-4" />}
          color="text-green-500"
          isExpanded={expandedGroups.technicians}
          onToggleExpand={() => toggleGroup('technicians')}
          allChecked={layers.technicians}
          onToggleAll={toggleTechnicians}
          totalCount={stats.totalTechnicians}
        >
          {/* Active Technicians Sub-Group */}
          <SubGroup
            label="Técnicos Activos"
            icon={<UserCheck className="h-3.5 w-3.5" />}
            color="text-green-600"
            isExpanded={expandedGroups.techniciansActive}
            onToggleExpand={() => toggleGroup('techniciansActive')}
            allChecked={layers.techniciansActive}
            onToggleAll={toggleActiveTechnicians}
            totalCount={activeTechniciansCount}
          >
            <LayerItem
              label="En línea"
              count={stats.techniciansOnline}
              checked={layers.techniciansOnline}
              onChange={(v) => updateLayer('techniciansOnline', v)}
              icon={<div className="h-2 w-2 rounded-full bg-green-500" />}
              indent
              indentLevel={2}
            />
            <LayerItem
              label="En camino"
              count={stats.techniciansEnRoute}
              checked={layers.techniciansEnRoute}
              onChange={(v) => updateLayer('techniciansEnRoute', v)}
              icon={<div className="h-2 w-2 rounded-full bg-blue-500" />}
              indent
              indentLevel={2}
            />
            <LayerItem
              label="Trabajando"
              count={stats.techniciansWorking}
              checked={layers.techniciansWorking}
              onChange={(v) => updateLayer('techniciansWorking', v)}
              icon={<div className="h-2 w-2 rounded-full bg-amber-500" />}
              indent
              indentLevel={2}
            />
          </SubGroup>

          {/* Inactive Technicians Sub-Group */}
          <SubGroup
            label="Técnicos Inactivos"
            icon={<UserX className="h-3.5 w-3.5" />}
            color="text-gray-500"
            isExpanded={expandedGroups.techniciansInactive}
            onToggleExpand={() => toggleGroup('techniciansInactive')}
            allChecked={layers.techniciansInactive}
            onToggleAll={toggleInactiveTechnicians}
            totalCount={stats.techniciansOffline}
          >
            <LayerItem
              label="Sin conexión"
              count={stats.techniciansOffline}
              checked={layers.techniciansOffline}
              onChange={(v) => updateLayer('techniciansOffline', v)}
              icon={<div className="h-2 w-2 rounded-full bg-gray-400" />}
              indent
              indentLevel={2}
            />
          </SubGroup>
        </LayerGroup>

        {/* Jobs */}
        <LayerGroup
          label="Trabajos de Hoy"
          icon={<Wrench className="h-4 w-4" />}
          color="text-orange-500"
          isExpanded={expandedGroups.jobs}
          onToggleExpand={() => toggleGroup('jobs')}
          allChecked={layers.jobs}
          onToggleAll={toggleJobs}
          totalCount={stats.todayJobsTotal}
        >
          <LayerItem
            label="Pendientes"
            count={stats.todayJobsPending}
            checked={layers.jobsPending}
            onChange={(v) => updateLayer('jobsPending', v)}
            icon={<div className="h-2 w-2 rounded-full bg-gray-400" />}
            indent
          />
          <LayerItem
            label="En progreso"
            count={stats.todayJobsInProgress}
            checked={layers.jobsInProgress}
            onChange={(v) => updateLayer('jobsInProgress', v)}
            icon={<div className="h-2 w-2 rounded-full bg-orange-500" />}
            indent
          />
          <LayerItem
            label="Completados"
            count={stats.todayJobsCompleted}
            checked={layers.jobsCompleted}
            onChange={(v) => updateLayer('jobsCompleted', v)}
            icon={<div className="h-2 w-2 rounded-full bg-green-500" />}
            indent
          />
        </LayerGroup>
      </div>
    </div>
  );
}

export default MapLayerControls;
