'use client';

/**
 * Phase 7.5: Organization Switcher
 * =================================
 * 
 * Dropdown component that allows users to switch between organizations
 * when they belong to multiple (e.g., work at a company AND have their own business).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Building2,
    ChevronDown,
    Check,
    Plus,
    Loader2,
    Settings,
} from 'lucide-react';

interface OrganizationMembership {
    id: string;
    organizationId: string;
    organizationName: string;
    organizationLogo: string | null;
    role: string;
    isDefault: boolean;
}

interface OrgSwitcherData {
    currentOrganization: OrganizationMembership | null;
    organizations: OrganizationMembership[];
    hasMultipleOrgs: boolean;
}

interface OrgSwitcherProps {
    compact?: boolean;
}

function getRoleBadge(role: string): { text: string; className: string } {
    switch (role) {
        case 'OWNER':
            return { text: 'Dueño', className: 'bg-amber-100 text-amber-700' };
        case 'DISPATCHER':
            return { text: 'Admin', className: 'bg-blue-100 text-blue-700' };
        case 'TECHNICIAN':
            return { text: 'Técnico', className: 'bg-gray-100 text-gray-600' };
        default:
            return { text: role, className: 'bg-gray-100 text-gray-600' };
    }
}

export default function OrgSwitcher({ compact = false }: OrgSwitcherProps) {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const queryClient = useQueryClient();

    // Fetch user's organizations
    const { data, isLoading, error } = useQuery<OrgSwitcherData>({
        queryKey: ['user-organizations'],
        queryFn: async () => {
            const res = await fetch('/api/auth/switch-org');
            if (!res.ok) throw new Error('Failed to fetch organizations');
            return res.json();
        },
        staleTime: 60000, // Cache for 1 minute
    });

    // Switch organization mutation
    const switchMutation = useMutation({
        mutationFn: async (organizationId: string) => {
            const res = await fetch('/api/auth/switch-org', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ organizationId }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to switch organization');
            }
            return res.json();
        },
        onSuccess: () => {
            setIsOpen(false);
            // Invalidate all queries to refresh data with new org context
            queryClient.invalidateQueries();
            // Refresh the page to get new session
            router.refresh();
        },
    });

    // Don't render if user only has one org or loading
    if (isLoading || error || !data) {
        return null;
    }

    // Don't show if only one organization (but still log for debugging)
    if (!data.hasMultipleOrgs) {
        return null;
    }

    const currentOrg = data.currentOrganization;
    const orgs = data.organizations;

    if (compact) {
        return (
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title={currentOrg?.organizationName || 'Seleccionar organización'}
                >
                    <div className="w-6 h-6 rounded bg-teal-100 flex items-center justify-center">
                        {currentOrg?.organizationLogo ? (
                            <img
                                src={currentOrg.organizationLogo}
                                alt=""
                                className="w-6 h-6 rounded object-cover"
                            />
                        ) : (
                            <Building2 className="h-3.5 w-3.5 text-teal-600" />
                        )}
                    </div>
                    <ChevronDown className="h-3 w-3 text-gray-400" />
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border z-50 py-2">
                            <OrgDropdownContent
                                currentOrg={currentOrg}
                                organizations={orgs}
                                isLoading={switchMutation.isPending}
                                onSwitch={(orgId) => switchMutation.mutate(orgId)}
                                onClose={() => setIsOpen(false)}
                            />
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
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border hover:border-teal-500 hover:shadow-sm transition-all"
            >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0">
                    {currentOrg?.organizationLogo ? (
                        <img
                            src={currentOrg.organizationLogo}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover"
                        />
                    ) : (
                        <Building2 className="h-5 w-5 text-white" />
                    )}
                </div>
                <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                        {currentOrg?.organizationName || 'Seleccionar'}
                    </p>
                    {currentOrg && (
                        <p className="text-xs text-gray-500">
                            {orgs.length} organizaciones
                        </p>
                    )}
                </div>
                <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''
                        }`}
                />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border z-50 py-2 max-h-96 overflow-y-auto">
                        <OrgDropdownContent
                            currentOrg={currentOrg}
                            organizations={orgs}
                            isLoading={switchMutation.isPending}
                            onSwitch={(orgId) => switchMutation.mutate(orgId)}
                            onClose={() => setIsOpen(false)}
                        />
                    </div>
                </>
            )}
        </div>
    );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DROPDOWN CONTENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface OrgDropdownContentProps {
    currentOrg: OrganizationMembership | null;
    organizations: OrganizationMembership[];
    isLoading: boolean;
    onSwitch: (orgId: string) => void;
    onClose: () => void;
}

function OrgDropdownContent({
    currentOrg,
    organizations,
    isLoading,
    onSwitch,
}: OrgDropdownContentProps) {
    const router = useRouter();

    return (
        <>
            {/* Header */}
            <div className="px-3 pb-2 mb-2 border-b">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Tus organizaciones
                </p>
            </div>

            {/* Organization list */}
            {organizations.map((org) => {
                const isActive = org.organizationId === currentOrg?.organizationId;
                const roleBadge = getRoleBadge(org.role);

                return (
                    <button
                        key={org.id}
                        onClick={() => !isActive && onSwitch(org.organizationId)}
                        disabled={isLoading || isActive}
                        className={`
                            w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
                            ${isActive ? 'bg-teal-50' : 'hover:bg-gray-50'}
                            ${isLoading ? 'opacity-50 cursor-wait' : ''}
                        `}
                    >
                        <div
                            className={`
                                w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                                ${isActive ? 'bg-teal-100' : 'bg-gray-100'}
                            `}
                        >
                            {org.organizationLogo ? (
                                <img
                                    src={org.organizationLogo}
                                    alt=""
                                    className="w-9 h-9 rounded-lg object-cover"
                                />
                            ) : (
                                <Building2
                                    className={`h-4 w-4 ${isActive ? 'text-teal-600' : 'text-gray-400'
                                        }`}
                                />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p
                                className={`font-medium truncate ${isActive ? 'text-teal-700' : 'text-gray-900'
                                    }`}
                            >
                                {org.organizationName}
                            </p>
                            <span
                                className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${roleBadge.className}`}
                            >
                                {roleBadge.text}
                            </span>
                        </div>

                        {isActive && <Check className="h-4 w-4 text-teal-600 flex-shrink-0" />}
                        {isLoading && !isActive && (
                            <Loader2 className="h-4 w-4 text-gray-400 animate-spin flex-shrink-0" />
                        )}
                    </button>
                );
            })}

            {/* Actions */}
            <div className="mt-2 pt-2 border-t">
                <button
                    onClick={() => router.push('/dashboard/settings/organization')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    <Settings className="h-4 w-4" />
                    Configuración
                </button>

                <button
                    onClick={() => router.push('/register?mode=new-org')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-teal-600 hover:bg-teal-50 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Crear nueva empresa
                </button>
            </div>
        </>
    );
}
