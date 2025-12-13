'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Search, Check, User } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

interface AssignTechniciansModalProps {
  open: boolean;
  onClose: () => void;
  zoneId: string;
  zoneName: string;
  currentTechnicianIds: string[];
}

export function AssignTechniciansModal({
  open,
  onClose,
  zoneId,
  zoneName,
  currentTechnicianIds,
}: AssignTechniciansModalProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentTechnicianIds));
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Fetch all technicians in organization
  const { data: techniciansData } = useQuery({
    queryKey: ['technicians-for-zone'],
    queryFn: async () => {
      const res = await fetch('/api/team?role=TECHNICIAN');
      return res.json();
    },
    enabled: open,
  });

  const technicians = techniciansData?.data?.users as User[] | undefined;

  // Reset selected when modal opens with current technicians
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(currentTechnicianIds));
      setSearch('');
      setError('');
    }
  }, [open, currentTechnicianIds]);

  const assignMutation = useMutation({
    mutationFn: async (technicianIds: string[]) => {
      const res = await fetch(`/api/locations/${zoneId}/technicians`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianIds }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al asignar técnicos');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const filteredTechnicians = technicians?.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTechnician = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSave = () => {
    assignMutation.mutate(Array.from(selectedIds));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Asignar técnicos a {zoneName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar técnico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>

        {/* Technicians list */}
        <div className="mt-4 max-h-[300px] overflow-y-auto divide-y">
          {filteredTechnicians?.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <User className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm">No se encontraron técnicos</p>
            </div>
          ) : (
            filteredTechnicians?.map((tech) => (
              <div
                key={tech.id}
                onClick={() => toggleTechnician(tech.id)}
                className={cn(
                  'flex items-center gap-3 p-3 cursor-pointer transition-colors',
                  selectedIds.has(tech.id)
                    ? 'bg-primary-50'
                    : 'hover:bg-gray-50'
                )}
              >
                <div
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded border transition-colors',
                    selectedIds.has(tech.id)
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-gray-300'
                  )}
                >
                  {selectedIds.has(tech.id) && <Check className="h-3 w-3" />}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 font-medium">
                  {getInitials(tech.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{tech.name}</p>
                  <p className="text-xs text-gray-500 truncate">{tech.phone || tech.email}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {selectedIds.size} técnico(s) seleccionado(s)
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={assignMutation.isPending}
              className="btn-primary"
            >
              {assignMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
