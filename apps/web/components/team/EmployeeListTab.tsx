'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn, getInitials, formatPhone } from '@/lib/utils';
import {
    Users,
    Calendar,
    Mail,
    Phone,
    Star,
    MoreHorizontal,
    Briefcase,
    Eye,
    Trash2,
} from 'lucide-react';
import type { TeamMember, UserLiveStatus } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const ROLE_CONFIG = {
    OWNER: {
        label: 'Dueño',
        color: 'bg-amber-100 text-amber-700 border-amber-200',
    },
    DISPATCHER: {
        label: 'Despachador',
        color: 'bg-rose-100 text-rose-700 border-rose-200',
    },
    TECHNICIAN: {
        label: 'Técnico',
        color: 'bg-teal-100 text-teal-700 border-teal-200',
    },
};

// Live status configuration matching Standby business rules
export const LIVE_STATUS_CONFIG = {
    // Priority 1: 🔴 Exception (Sick/Vacation)
    UNAVAILABLE: {
        label: 'No Disponible',
        emoji: '🔴',
        color: 'bg-red-100 text-red-700 border-red-200',
    },
    // Priority 2: ⚪ Outside hours or no schedule
    OFF_SHIFT: {
        label: 'Fuera de Turno',
        emoji: '⚪',
        color: 'bg-gray-100 text-gray-500 border-gray-200',
    },
    // Priority 3: 🟡 Has active IN_PROGRESS job
    BUSY: {
        label: 'Ocupado',
        emoji: '🟡',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    },
    // Priority 4: 🟢 Within hours + no active job
    AVAILABLE: {
        label: 'Disponible',
        emoji: '🟢',
        color: 'bg-green-100 text-green-700 border-green-200',
    },
    // Fallback for inactive users
    INACTIVE: {
        label: 'Inactivo',
        emoji: '⚫',
        color: 'bg-gray-200 text-gray-600 border-gray-300',
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE LIST TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface EmployeeListTabProps {
    members: TeamMember[];
    loading: boolean;
    canEdit: boolean;
    onEdit: (member: TeamMember) => void;
    onDelete: (member: TeamMember) => void;
    onCardClick: (member: TeamMember) => void;
    currentUserId?: string;
}

export function EmployeeListTab({ members, loading, canEdit, onEdit: _onEdit, onDelete, onCardClick, currentUserId }: EmployeeListTabProps) {
    const [menuOpen, setMenuOpen] = useState<string | null>(null);

    // Fetch live status for all users
    const { data: liveStatusData } = useQuery({
        queryKey: ['user-live-status'],
        queryFn: async () => {
            const res = await fetch('/api/users/live-status');
            if (!res.ok) return { success: false, data: { statuses: {} } };
            return res.json();
        },
        refetchInterval: 30000, // Refresh every 30 seconds
        staleTime: 15000, // Consider data stale after 15 seconds
    });

    const liveStatuses: Record<string, UserLiveStatus> = liveStatusData?.data?.statuses || {};

    // Get live status config for a member
    const getLiveStatusConfig = (memberId: string, isActive: boolean) => {
        if (!isActive) {
            return LIVE_STATUS_CONFIG.INACTIVE;
        }
        const liveStatus = liveStatuses[memberId];
        if (liveStatus) {
            return LIVE_STATUS_CONFIG[liveStatus.status] || LIVE_STATUS_CONFIG.AVAILABLE;
        }
        // Default to available if no status yet
        return LIVE_STATUS_CONFIG.AVAILABLE;
    };

    // Get status tooltip (for UNAVAILABLE shows reason, for BUSY shows job number)
    const getStatusTooltip = (memberId: string): string => {
        const liveStatus = liveStatuses[memberId];
        if (!liveStatus) return '';
        if (liveStatus.status === 'UNAVAILABLE' && liveStatus.reason) {
            return liveStatus.reason;
        }
        if (liveStatus.status === 'BUSY' && liveStatus.jobNumber) {
            return `Trabajo #${liveStatus.jobNumber}`;
        }
        return '';
    };

    if (loading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="card p-5 animate-pulse">
                        <div className="flex items-start gap-3">
                            <div className="h-12 w-12 rounded-full bg-gray-200" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-24 bg-gray-200 rounded" />
                                <div className="h-3 w-16 bg-gray-200 rounded" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (members.length === 0) {
        return (
            <div className="card p-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-gray-500">No hay miembros en el equipo</p>
            </div>
        );
    }

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => {
                const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.TECHNICIAN;
                const statusConfig = getLiveStatusConfig(member.id, member.isActive);
                const statusTooltip = getStatusTooltip(member.id);
                const isCurrentUser = member.id === currentUserId;

                return (
                    <div
                        key={member.id}
                        className="card p-5 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={(e) => {
                            // Don't open modal if clicking on menu
                            if ((e.target as HTMLElement).closest('.menu-container')) return;
                            onCardClick(member);
                        }}
                    >
                        {/* Header row */}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <div className="h-12 w-12 rounded-full bg-teal-500 flex items-center justify-center text-white font-semibold text-lg">
                                    {getInitials(member.name)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">
                                        {member.name}
                                        {isCurrentUser && (
                                            <span className="ml-1 text-xs text-gray-400">(vos)</span>
                                        )}
                                    </h3>
                                    {/* Role & Live Status Badges */}
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full border', roleConfig.color)}>
                                            {roleConfig.label}
                                        </span>
                                        <span
                                            className={cn('px-2 py-0.5 text-xs font-medium rounded-full border inline-flex items-center gap-1', statusConfig.color)}
                                            title={statusTooltip}
                                        >
                                            <span>{statusConfig.emoji}</span>
                                            {statusConfig.label}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Menu */}
                            {canEdit && (
                                <div className="relative menu-container">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuOpen(menuOpen === member.id ? null : member.id);
                                        }}
                                        className="p-1 rounded hover:bg-gray-100"
                                    >
                                        <MoreHorizontal className="h-5 w-5 text-gray-400" />
                                    </button>
                                    {menuOpen === member.id && (
                                        <div className="absolute right-0 mt-1 w-40 bg-white border rounded-lg shadow-lg z-10">
                                            <button
                                                onClick={() => {
                                                    setMenuOpen(null);
                                                    onCardClick(member);
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                            >
                                                <Eye className="h-4 w-4" />
                                                Ver Detalles
                                            </button>
                                            <button
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                            >
                                                <Calendar className="h-4 w-4" />
                                                Ver Horario
                                            </button>
                                            {/* Only show delete for non-owners and not the current user */}
                                            {member.role !== 'OWNER' && member.id !== currentUserId && (
                                                <>
                                                    <div className="border-t my-1" />
                                                    <button
                                                        onClick={() => {
                                                            setMenuOpen(null);
                                                            onDelete(member);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Eliminar empleado
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Contact info */}
                        <div className="space-y-2 mt-4">
                            {member.email && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Mail className="h-4 w-4 text-gray-400" />
                                    <span className="truncate">{member.email}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span>{formatPhone(member.phone)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span>Desde: {formatDate(member.createdAt)}</span>
                            </div>
                        </div>

                        {/* Footer stats */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Briefcase className="h-4 w-4" />
                                <span>{member.jobCount} {member.jobCount === 1 ? 'trabajo' : 'trabajos'}</span>
                            </div>
                            {member.avgRating !== null ? (
                                <div className="flex items-center gap-1 text-sm">
                                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                                    <span className="font-medium">{member.avgRating}</span>
                                    <span className="text-gray-400 text-xs">({member.reviewCount})</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-sm text-gray-400">
                                    <Star className="h-4 w-4" />
                                    <span>Sin calificaciones</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default EmployeeListTab;
