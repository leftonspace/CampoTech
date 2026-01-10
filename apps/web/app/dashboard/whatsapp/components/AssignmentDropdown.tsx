'use client';

/**
 * Phase 6.2: Conversation Assignment Dropdown
 * ============================================
 * 
 * Allows admins/owners to assign conversations to team members.
 * Shows current assignee and allows quick reassignment.
 */

import { useState } from 'react';
import { User, ChevronDown, Check, X, Loader2, UserMinus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface TeamMember {
    id: string;
    name: string;
    role: string;
    activeConversations: number;
}

interface AssignmentDropdownProps {
    conversationId: string;
    currentAssigneeId: string | null;
    currentAssigneeName: string | null;
    onAssigned?: (assigneeId: string, assigneeName: string) => void;
    onUnassigned?: () => void;
    disabled?: boolean;
    compact?: boolean;
}

export default function AssignmentDropdown({
    conversationId,
    currentAssigneeId,
    currentAssigneeName,
    onAssigned,
    onUnassigned,
    disabled = false,
    compact = false,
}: AssignmentDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();

    // Fetch team members
    const { data: teamData, isLoading: isLoadingTeam } = useQuery<{ team: TeamMember[] }>({
        queryKey: ['shared-inbox-team'],
        queryFn: async () => {
            const res = await fetch('/api/whatsapp/shared-inbox?action=team');
            if (!res.ok) throw new Error('Failed to fetch team');
            return res.json();
        },
        enabled: isOpen,
        staleTime: 60000, // Cache for 1 minute
    });

    // Assign mutation
    const assignMutation = useMutation({
        mutationFn: async ({ assignedToId }: { assignedToId: string }) => {
            const res = await fetch('/api/whatsapp/shared-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'assign',
                    conversationId,
                    assignedToId,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to assign');
            }
            return res.json();
        },
        onSuccess: (_, variables) => {
            setIsOpen(false);
            const member = teamData?.team?.find((m) => m.id === variables.assignedToId);
            if (member && onAssigned) {
                onAssigned(member.id, member.name);
            }
            queryClient.invalidateQueries({ queryKey: ['shared-inbox'] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
    });

    // Unassign mutation
    const unassignMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/whatsapp/shared-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'unassign',
                    conversationId,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to unassign');
            }
            return res.json();
        },
        onSuccess: () => {
            setIsOpen(false);
            onUnassigned?.();
            queryClient.invalidateQueries({ queryKey: ['shared-inbox'] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
    });

    const isLoading = assignMutation.isPending || unassignMutation.isPending;

    const team = teamData?.team || [];

    if (compact) {
        return (
            <div className="relative">
                <button
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled || isLoading}
                    className={`
                        flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors
                        ${currentAssigneeId
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-gray-100 text-gray-600'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-teal-200 cursor-pointer'}
                    `}
                    title={currentAssigneeName || 'Sin asignar'}
                >
                    {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <User className="h-3 w-3" />
                    )}
                    <span className="max-w-[80px] truncate">
                        {currentAssigneeName || 'Asignar'}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsOpen(false)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border z-20 py-1">
                            {isLoadingTeam ? (
                                <div className="px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Cargando equipo...
                                </div>
                            ) : (
                                <>
                                    {/* Unassign option */}
                                    {currentAssigneeId && (
                                        <button
                                            onClick={() => unassignMutation.mutate()}
                                            className="w-full px-3 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2 border-b"
                                        >
                                            <UserMinus className="h-4 w-4" />
                                            Quitar asignación
                                        </button>
                                    )}

                                    {/* Team members */}
                                    {team.map((member) => (
                                        <button
                                            key={member.id}
                                            onClick={() => assignMutation.mutate({ assignedToId: member.id })}
                                            className={`
                                                w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between
                                                ${member.id === currentAssigneeId ? 'bg-teal-50' : ''}
                                            `}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                                    <User className="h-3 w-3 text-gray-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{member.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {member.activeConversations} conv. activas
                                                    </p>
                                                </div>
                                            </div>
                                            {member.id === currentAssigneeId && (
                                                <Check className="h-4 w-4 text-teal-600" />
                                            )}
                                        </button>
                                    ))}

                                    {team.length === 0 && (
                                        <p className="px-3 py-2 text-sm text-gray-500">
                                            No hay miembros del equipo
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Full size version
    return (
        <div className="relative">
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled || isLoading}
                className={`
                    flex items-center justify-between gap-2 px-3 py-2 w-full text-sm rounded-lg border transition-colors
                    ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-teal-500 cursor-pointer'}
                `}
            >
                <div className="flex items-center gap-2">
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : (
                        <User className={`h-4 w-4 ${currentAssigneeId ? 'text-teal-600' : 'text-gray-400'}`} />
                    )}
                    <span className={currentAssigneeId ? 'text-gray-900' : 'text-gray-500'}>
                        {currentAssigneeName || 'Asignar a miembro del equipo'}
                    </span>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-20 py-1 max-h-64 overflow-y-auto">
                        {isLoadingTeam ? (
                            <div className="px-3 py-4 text-sm text-gray-500 flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando equipo...
                            </div>
                        ) : (
                            <>
                                {/* Unassign option */}
                                {currentAssigneeId && (
                                    <button
                                        onClick={() => unassignMutation.mutate()}
                                        className="w-full px-3 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2 border-b"
                                    >
                                        <X className="h-4 w-4" />
                                        Quitar asignación (mover a cola)
                                    </button>
                                )}

                                {/* Team members */}
                                {team.map((member) => (
                                    <button
                                        key={member.id}
                                        onClick={() => assignMutation.mutate({ assignedToId: member.id })}
                                        className={`
                                            w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between
                                            ${member.id === currentAssigneeId ? 'bg-teal-50' : ''}
                                        `}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                                <User className="h-4 w-4 text-gray-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{member.name}</p>
                                                <p className="text-xs text-gray-500">
                                                    {member.role} · {member.activeConversations} conv. activas
                                                </p>
                                            </div>
                                        </div>
                                        {member.id === currentAssigneeId && (
                                            <Check className="h-4 w-4 text-teal-600" />
                                        )}
                                    </button>
                                ))}

                                {team.length === 0 && (
                                    <p className="px-3 py-4 text-sm text-gray-500 text-center">
                                        No hay miembros del equipo disponibles
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
