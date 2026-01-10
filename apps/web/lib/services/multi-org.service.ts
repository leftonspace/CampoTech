/**
 * Phase 7.5: Multi-Organization Membership Service
 * =================================================
 * 
 * Enables users to belong to multiple organizations with different roles.
 * 
 * Use Case: A technician working at "AC Servicios S.A." wants to start
 * their own side business "Juan Servicios". With multi-org membership,
 * they can belong to both organizations with different roles:
 * - AC Servicios: role = TECHNICIAN
 * - Juan Servicios: role = OWNER
 * 
 * Key features:
 * - Get all organizations a user belongs to
 * - Switch active organization
 * - Add user to organization
 * - Remove user from organization
 * - Handle org invitations
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// Local type until prisma generate runs
type MembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'LEFT';
type UserRole = 'OWNER' | 'DISPATCHER' | 'TECHNICIAN';

export interface OrganizationMembership {
    id: string;
    organizationId: string;
    organizationName: string;
    organizationLogo: string | null;
    role: UserRole;
    isDefault: boolean;
    status: MembershipStatus;
    joinedAt: Date;
}

export interface AddMemberResult {
    success: boolean;
    membershipId?: string;
    error?: string;
}

export interface SwitchOrgResult {
    success: boolean;
    organizationId?: string;
    organizationName?: string;
    role?: string;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-ORG SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class MultiOrgService {

    // ─────────────────────────────────────────────────────────────────────────────
    // QUERY OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Get all organizations a user belongs to
     */
    async getUserOrganizations(userId: string): Promise<OrganizationMembership[]> {
        const memberships = await prisma.userOrganization.findMany({
            where: {
                userId,
                status: 'ACTIVE',
            },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                    },
                },
            },
            orderBy: [
                { isDefault: 'desc' },
                { joinedAt: 'asc' },
            ],
        });

        return memberships.map((m: {
            id: string;
            organizationId: string;
            organization: { id: string; name: string; logo: string | null };
            role: string;
            isDefault: boolean;
            status: string;
            joinedAt: Date;
        }) => ({
            id: m.id,
            organizationId: m.organizationId,
            organizationName: m.organization.name,
            organizationLogo: m.organization.logo,
            role: m.role as UserRole,
            isDefault: m.isDefault,
            status: m.status as MembershipStatus,
            joinedAt: m.joinedAt,
        }));
    }

    /**
     * Get the user's default organization
     */
    async getDefaultOrganization(userId: string): Promise<OrganizationMembership | null> {
        const membership = await prisma.userOrganization.findFirst({
            where: {
                userId,
                isDefault: true,
                status: 'ACTIVE',
            },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                    },
                },
            },
        });

        if (!membership) {
            // Fall back to the first active membership
            const firstMembership = await prisma.userOrganization.findFirst({
                where: {
                    userId,
                    status: 'ACTIVE',
                },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            logo: true,
                        },
                    },
                },
                orderBy: { joinedAt: 'asc' },
            });

            if (!firstMembership) return null;

            const m = firstMembership as {
                id: string;
                organizationId: string;
                organization: { id: string; name: string; logo: string | null };
                role: string;
                isDefault: boolean;
                status: string;
                joinedAt: Date;
            };

            return {
                id: m.id,
                organizationId: m.organizationId,
                organizationName: m.organization.name,
                organizationLogo: m.organization.logo,
                role: m.role as UserRole,
                isDefault: m.isDefault,
                status: m.status as MembershipStatus,
                joinedAt: m.joinedAt,
            };
        }

        const m = membership as {
            id: string;
            organizationId: string;
            organization: { id: string; name: string; logo: string | null };
            role: string;
            isDefault: boolean;
            status: string;
            joinedAt: Date;
        };

        return {
            id: m.id,
            organizationId: m.organizationId,
            organizationName: m.organization.name,
            organizationLogo: m.organization.logo,
            role: m.role as UserRole,
            isDefault: m.isDefault,
            status: m.status as MembershipStatus,
            joinedAt: m.joinedAt,
        };
    }

    /**
     * Check if user belongs to a specific organization
     */
    async isMemberOf(userId: string, organizationId: string): Promise<boolean> {
        const membership = await prisma.userOrganization.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                },
            },
        });

        return membership !== null && membership.status === 'ACTIVE';
    }

    /**
     * Get user's role in a specific organization
     */
    async getRoleInOrg(userId: string, organizationId: string): Promise<UserRole | null> {
        const membership = await prisma.userOrganization.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                },
            },
        });

        if (!membership || membership.status !== 'ACTIVE') return null;
        return membership.role as UserRole;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SWITCH ORGANIZATION
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Switch user's default/active organization
     */
    async switchOrganization(userId: string, organizationId: string): Promise<SwitchOrgResult> {
        try {
            // Verify user is a member of this org
            const membership = await prisma.userOrganization.findUnique({
                where: {
                    userId_organizationId: {
                        userId,
                        organizationId,
                    },
                },
                include: {
                    organization: {
                        select: { id: true, name: true },
                    },
                },
            });

            if (!membership) {
                return { success: false, error: 'User is not a member of this organization' };
            }

            if (membership.status !== 'ACTIVE') {
                return { success: false, error: 'Membership is not active' };
            }

            // Clear default from all other memberships
            await prisma.userOrganization.updateMany({
                where: {
                    userId,
                    isDefault: true,
                },
                data: { isDefault: false },
            });

            // Set this one as default
            await prisma.userOrganization.update({
                where: {
                    userId_organizationId: {
                        userId,
                        organizationId,
                    },
                },
                data: { isDefault: true },
            });

            return {
                success: true,
                organizationId: membership.organizationId,
                organizationName: membership.organization.name,
                role: membership.role,
            };
        } catch (error) {
            console.error('[MultiOrg] Error switching organization:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MEMBERSHIP OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Add a user to an organization
     */
    async addMember(
        userId: string,
        organizationId: string,
        role: UserRole = 'TECHNICIAN',
        invitedById?: string,
        setAsDefault: boolean = false
    ): Promise<AddMemberResult> {
        try {
            // Check if already a member
            const existing = await prisma.userOrganization.findUnique({
                where: {
                    userId_organizationId: {
                        userId,
                        organizationId,
                    },
                },
            });

            if (existing) {
                if (existing.status === 'ACTIVE') {
                    return { success: false, error: 'User is already a member of this organization' };
                }

                // Reactivate membership if they left
                await prisma.userOrganization.update({
                    where: { id: existing.id },
                    data: {
                        status: 'ACTIVE',
                        role,
                        isDefault: setAsDefault,
                        joinedAt: new Date(),
                    },
                });

                return { success: true, membershipId: existing.id };
            }

            // If setting as default, clear default from other memberships
            if (setAsDefault) {
                await prisma.userOrganization.updateMany({
                    where: { userId, isDefault: true },
                    data: { isDefault: false },
                });
            }

            // Create new membership
            const membership = await prisma.userOrganization.create({
                data: {
                    userId,
                    organizationId,
                    role,
                    invitedBy: invitedById,
                    isDefault: setAsDefault,
                    status: 'ACTIVE',
                },
            });

            return { success: true, membershipId: membership.id };
        } catch (error) {
            console.error('[MultiOrg] Error adding member:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Remove a user from an organization
     */
    async removeMember(userId: string, organizationId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const membership = await prisma.userOrganization.findUnique({
                where: {
                    userId_organizationId: {
                        userId,
                        organizationId,
                    },
                },
            });

            if (!membership) {
                return { success: false, error: 'Membership not found' };
            }

            // Soft delete by marking as LEFT
            await prisma.userOrganization.update({
                where: { id: membership.id },
                data: {
                    status: 'LEFT',
                    isDefault: false,
                },
            });

            // If this was their default, set another as default
            if (membership.isDefault) {
                const anotherMembership = await prisma.userOrganization.findFirst({
                    where: {
                        userId,
                        status: 'ACTIVE',
                    },
                    orderBy: { joinedAt: 'asc' },
                });

                if (anotherMembership) {
                    await prisma.userOrganization.update({
                        where: { id: anotherMembership.id },
                        data: { isDefault: true },
                    });
                }
            }

            return { success: true };
        } catch (error) {
            console.error('[MultiOrg] Error removing member:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Create a new organization and add the user as owner
     * This is called when an existing user registers a new business
     */
    async createOrganizationForExistingUser(
        userId: string,
        orgData: {
            name: string;
            phone?: string;
            email?: string;
            cuit?: string;
        }
    ): Promise<{ success: boolean; organizationId?: string; error?: string }> {
        try {
            // Create the organization
            const organization = await prisma.organization.create({
                data: {
                    name: orgData.name,
                    phone: orgData.phone,
                    email: orgData.email,
                    settings: orgData.cuit ? { cuit: orgData.cuit } : {},
                },
            });

            // Add user as owner and make it their default
            const memberResult = await this.addMember(
                userId,
                organization.id,
                'OWNER',
                undefined,
                true // Set as default since they're creating it
            );

            if (!memberResult.success) {
                // Rollback: delete the org
                await prisma.organization.delete({ where: { id: organization.id } });
                return { success: false, error: memberResult.error };
            }

            return { success: true, organizationId: organization.id };
        } catch (error) {
            console.error('[MultiOrg] Error creating organization:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // INVITATION OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Invite a user to an organization (by phone)
     */
    async inviteByPhone(
        phone: string,
        organizationId: string,
        role: UserRole,
        invitedById: string
    ): Promise<{ success: boolean; status: 'created' | 'invited' | 'existing'; error?: string }> {
        try {
            // Find user by phone
            const user = await prisma.user.findFirst({
                where: { phone },
            });

            if (!user) {
                // User doesn't exist - could create a pending invitation here
                // For now, return error
                return { success: false, status: 'invited', error: 'User with this phone not found' };
            }

            // Check if already a member
            const existing = await prisma.userOrganization.findUnique({
                where: {
                    userId_organizationId: {
                        userId: user.id,
                        organizationId,
                    },
                },
            });

            if (existing && existing.status === 'ACTIVE') {
                return { success: false, status: 'existing', error: 'User is already a member' };
            }

            // Add or reactivate membership
            if (existing) {
                await prisma.userOrganization.update({
                    where: { id: existing.id },
                    data: {
                        status: 'ACTIVE',
                        role,
                        invitedBy: invitedById,
                        joinedAt: new Date(),
                    },
                });
            } else {
                await prisma.userOrganization.create({
                    data: {
                        userId: user.id,
                        organizationId,
                        role,
                        invitedBy: invitedById,
                        status: 'ACTIVE',
                    },
                });
            }

            return { success: true, status: existing ? 'invited' : 'created' };
        } catch (error) {
            console.error('[MultiOrg] Error inviting user:', error);
            return {
                success: false,
                status: 'invited',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MIGRATION HELPER
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Migrate existing users to the new multi-org model
     * Creates UserOrganization records for all existing User records
     */
    async migrateExistingUsers(): Promise<{ migrated: number; errors: number }> {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                organizationId: true,
                role: true,
            },
        });

        let migrated = 0;
        let errors = 0;

        for (const user of users) {
            try {
                // Check if membership already exists
                const existing = await prisma.userOrganization.findUnique({
                    where: {
                        userId_organizationId: {
                            userId: user.id,
                            organizationId: user.organizationId,
                        },
                    },
                });

                if (!existing) {
                    await prisma.userOrganization.create({
                        data: {
                            userId: user.id,
                            organizationId: user.organizationId,
                            role: user.role as UserRole,
                            isDefault: true,
                            status: 'ACTIVE',
                        },
                    });
                    migrated++;
                }
            } catch (error) {
                console.error(`[MultiOrg] Error migrating user ${user.id}:`, error);
                errors++;
            }
        }

        return { migrated, errors };
    }
}

// Export singleton
export const multiOrgService = new MultiOrgService();
