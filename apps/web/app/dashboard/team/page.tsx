'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { normalizeForSearch } from '@/lib/text.utils';

// Import extracted components from components/team
import {
  EmployeeListTab,
  TeamMemberModal,
  DeleteConfirmationModal,
  DisponibilidadTab,
  MyScheduleTab,
  type TeamMember,
  type TeamStats,
  type TabType,
} from '@/components/team';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  const [activeTab, setActiveTab] = useState<TabType>('employees');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const userRole = user?.role?.toUpperCase() || 'TECHNICIAN';
  const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'ADMIN';
  const isTechnician = userRole === 'TECHNICIAN';

  // Fetch ALL team members (always include inactive for accurate tab counts)
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await fetch('/api/users?includeInactive=true');
      if (!res.ok) throw new Error('Error fetching team');
      return res.json();
    },
  });

  // Split members into active and inactive for display
  const allMembers = useMemo(() => {
    return (teamData?.data as TeamMember[]) || [];
  }, [teamData?.data]);

  // Apply search filter with accent-insensitive matching
  const filteredBySearch = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return allMembers;
    const normalizedQuery = normalizeForSearch(searchQuery);
    return allMembers.filter(m => {
      const searchableTexts = [m.name || '', m.email || ''];
      return searchableTexts.some(text =>
        normalizeForSearch(text).includes(normalizedQuery)
      );
    });
  }, [allMembers, searchQuery]);

  const members = showInactive
    ? filteredBySearch.filter(m => !m.isActive)
    : filteredBySearch.filter(m => m.isActive !== false);

  // Fetch team stats
  const { data: statsData, isLoading: _statsLoading } = useQuery({
    queryKey: ['team-stats'],
    queryFn: async () => {
      const res = await fetch('/api/users/stats');
      if (!res.ok) {
        // Return mock data if endpoint doesn't exist
        return {
          success: true,
          data: {
            totalEmployees: members.length,
            activeTechnicians: members.filter(m => m.role === 'TECHNICIAN' && m.isActive).length,
            inProgressCount: 2,
            averageRating: 4.7,
          },
        };
      }
      return res.json();
    },
    enabled: members.length > 0,
  });

  const _stats: TeamStats = statsData?.data || {
    totalEmployees: members.length,
    activeTechnicians: members.filter(m => m.role === 'TECHNICIAN' && m.isActive).length,
    inProgressCount: 2,
    averageRating: 4.7,
  };

  // Determine available tabs based on role
  const availableTabs = useMemo(() => {
    if (isTechnician) {
      return [
        { id: 'employees' as TabType, label: 'Lista de Empleados' },
        { id: 'my-schedule' as TabType, label: 'Mi Horario' },
      ];
    }
    return [
      { id: 'employees' as TabType, label: 'Lista de Empleados' },
      { id: 'availability' as TabType, label: 'Disponibilidad' },
    ];
  }, [isTechnician]);

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setShowAddModal(true);
  };

  const handleDeleteMember = (member: TeamMember) => {
    setDeletingMember(member);
  };

  const handleConfirmDelete = async () => {
    if (!deletingMember) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deletingMember.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar');
      }

      // Refresh the team list
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      setDeletingMember(null);
    } catch (error) {
      console.error('Delete error:', error);
      // You could add toast notification here
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Equipo</h1>
          <p className="page-subtitle">Gestioná tu equipo de trabajo</p>
        </div>
        {isOwnerOrAdmin && (
          <button
            onClick={() => {
              setEditingMember(null);
              setShowAddModal(true);
            }}
            className="btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar Empleado
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1" aria-label="Tabs">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium rounded-t-lg transition-colors',
                activeTab === tab.id
                  ? 'bg-white border border-b-white border-gray-200 text-gray-900 -mb-px'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'employees' && (
          <>
            {/* Archive Filter Toggle */}
            {isOwnerOrAdmin && (
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowInactive(false)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                      !showInactive
                        ? "bg-teal-100 text-teal-700 border border-teal-200"
                        : "text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    Activos ({allMembers.filter(m => m.isActive !== false).length})
                  </button>
                  <button
                    onClick={() => setShowInactive(true)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                      showInactive
                        ? "bg-gray-200 text-gray-700 border border-gray-300"
                        : "text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    📁 Inactivos ({allMembers.filter(m => !m.isActive).length})
                  </button>
                </div>
                {showInactive && (
                  <p className="text-xs text-gray-500">
                    Vista de archivo • Los usuarios inactivos no pueden iniciar sesión
                  </p>
                )}
              </div>
            )}
            <EmployeeListTab
              members={members}
              loading={teamLoading}
              canEdit={isOwnerOrAdmin}
              onEdit={handleEditMember}
              onDelete={handleDeleteMember}
              onCardClick={handleEditMember}
              currentUserId={user?.id}
            />
          </>
        )}

        {activeTab === 'availability' && isOwnerOrAdmin && (
          <DisponibilidadTab canEdit={isOwnerOrAdmin} members={members} />
        )}

        {activeTab === 'my-schedule' && isTechnician && (
          <MyScheduleTab userId={user?.id} />
        )}
      </div>

      {/* Unified Member Modal - Create/View/Edit */}
      {showAddModal && (
        <TeamMemberModal
          member={editingMember}
          currentUserId={user?.id}
          currentUserRole={userRole}
          onClose={() => {
            setShowAddModal(false);
            setEditingMember(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['team-members'] });
            queryClient.invalidateQueries({ queryKey: ['team-stats'] });
            setShowAddModal(false);
            setEditingMember(null);
          }}
          onDelete={handleDeleteMember}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingMember && (
        <DeleteConfirmationModal
          member={deletingMember}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingMember(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
