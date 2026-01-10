/**
 * Phase 4.5: Launch Gate Service
 * ===============================
 * 
 * Critical safety gate for Growth Engine outreach.
 * Prevents any outbound messages until owner explicitly approves.
 * 
 * Key Features:
 * - Pre-launch checklist validation
 * - Owner-only approval requirement
 * - Audit logging of launch approvals
 * - Blocking of all send operations until launched
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LaunchChecklist {
    // Business Prerequisites
    bankAccountConfigured: boolean;
    mercadoPagoConnected: boolean;
    legalEntityRegistered: boolean;
    afipRegistrationComplete: boolean;

    // Technical Prerequisites
    whatsappApiConfigured: boolean;
    emailProviderConfigured: boolean;
    templateSubmittedToMeta: boolean;
    templateApprovedByMeta: boolean;
    testCampaignSent: boolean;

    // Confirmation
    understandsMessageVolume: boolean;
    paymentProcessingVerified: boolean;
    readyForInquiries: boolean;
}

export interface GrowthEngineSettings {
    launched: boolean;
    launchedAt: string | null;
    launchedBy: string | null;
    checklist: LaunchChecklist | null;
}

export interface LaunchGateStatus {
    isLaunched: boolean;
    launchedAt: string | null;
    launchedBy: string | null;
    canLaunch: boolean;
    checklistComplete: boolean;
    checklist: ChecklistItem[];
}

export interface ChecklistItem {
    key: keyof LaunchChecklist;
    label: string;
    category: 'business' | 'technical' | 'confirmation';
    checked: boolean;
    required: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CHECKLIST_ITEMS: Omit<ChecklistItem, 'checked'>[] = [
    // Business Prerequisites
    {
        key: 'bankAccountConfigured',
        label: 'Cuenta bancaria Argentina configurada',
        category: 'business',
        required: true,
    },
    {
        key: 'mercadoPagoConnected',
        label: 'Cuenta Mercado Pago Business conectada',
        category: 'business',
        required: true,
    },
    {
        key: 'legalEntityRegistered',
        label: 'Entidad legal registrada (SAS/SRL) con CUIT',
        category: 'business',
        required: true,
    },
    {
        key: 'afipRegistrationComplete',
        label: 'Inscripción AFIP completa (Monotributo/RI)',
        category: 'business',
        required: true,
    },
    // Technical Prerequisites
    {
        key: 'whatsappApiConfigured',
        label: 'WhatsApp Business API configurada',
        category: 'technical',
        required: false, // Only for WhatsApp campaigns
    },
    {
        key: 'emailProviderConfigured',
        label: 'Proveedor de email configurado (SendGrid/Resend)',
        category: 'technical',
        required: true,
    },
    {
        key: 'templateSubmittedToMeta',
        label: 'Template WhatsApp enviado a Meta',
        category: 'technical',
        required: false, // Only for WhatsApp campaigns
    },
    {
        key: 'templateApprovedByMeta',
        label: 'Template aprobado por Meta (UTILITY)',
        category: 'technical',
        required: false, // Only for WhatsApp campaigns
    },
    {
        key: 'testCampaignSent',
        label: 'Campaña de prueba enviada a 10 perfiles',
        category: 'technical',
        required: true,
    },
    // Confirmation
    {
        key: 'understandsMessageVolume',
        label: 'Entiendo que esto enviará 1,000+ mensajes por día',
        category: 'confirmation',
        required: true,
    },
    {
        key: 'paymentProcessingVerified',
        label: 'Verifiqué que el procesamiento de pagos funciona',
        category: 'confirmation',
        required: true,
    },
    {
        key: 'readyForInquiries',
        label: 'Estoy listo para atender consultas entrantes',
        category: 'confirmation',
        required: true,
    },
];

// Required items that must be checked for email-only launch
const EMAIL_REQUIRED_ITEMS: (keyof LaunchChecklist)[] = [
    'bankAccountConfigured',
    'mercadoPagoConnected',
    'legalEntityRegistered',
    'afipRegistrationComplete',
    'emailProviderConfigured',
    'testCampaignSent',
    'understandsMessageVolume',
    'paymentProcessingVerified',
    'readyForInquiries',
];

// ═══════════════════════════════════════════════════════════════════════════════
// LAUNCH GATE SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class LaunchGateService {

    /**
     * Get the current launch status for an organization
     */
    async getStatus(organizationId: string): Promise<LaunchGateStatus> {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { settings: true },
        });

        const settings = this.parseSettings(org?.settings);
        const checklist = this.buildChecklist(settings.checklist);
        const checklistComplete = this.isChecklistComplete(settings.checklist);

        return {
            isLaunched: settings.launched,
            launchedAt: settings.launchedAt,
            launchedBy: settings.launchedBy,
            canLaunch: checklistComplete && !settings.launched,
            checklistComplete,
            checklist,
        };
    }

    /**
     * Update checklist items
     */
    async updateChecklist(
        organizationId: string,
        updates: Partial<LaunchChecklist>
    ): Promise<LaunchGateStatus> {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { settings: true },
        });

        const currentSettings = this.parseSettings(org?.settings);

        // Can't update checklist after launch
        if (currentSettings.launched) {
            throw new Error('Cannot modify checklist after launch');
        }

        const updatedChecklist: LaunchChecklist = {
            ...(currentSettings.checklist || this.getDefaultChecklist()),
            ...updates,
        };

        // Parse existing settings safely
        const existingSettings = typeof org?.settings === 'object' && org.settings !== null
            ? org.settings as Record<string, unknown>
            : {};

        await prisma.organization.update({
            where: { id: organizationId },
            data: {
                settings: {
                    ...existingSettings,
                    growthEngine: {
                        launched: false,
                        launchedAt: null,
                        launchedBy: null,
                        checklist: updatedChecklist,
                    },
                },
            },
        });

        return this.getStatus(organizationId);
    }

    /**
     * Check if all required prerequisites are met
     */
    canLaunch(checklist: LaunchChecklist | null): boolean {
        if (!checklist) return false;

        return EMAIL_REQUIRED_ITEMS.every(key => checklist[key] === true);
    }

    /**
     * Approve launch - OWNER ONLY
     * This is the critical gate that enables all outreach
     */
    async approveLaunch(
        organizationId: string,
        userId: string,
        checklist: LaunchChecklist
    ): Promise<void> {
        // Verify checklist is complete
        if (!this.canLaunch(checklist)) {
            throw new Error('Cannot launch: checklist incomplete');
        }

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { settings: true },
        });

        const currentSettings = this.parseSettings(org?.settings);

        if (currentSettings.launched) {
            throw new Error('Growth Engine already launched');
        }

        const existingSettings = typeof org?.settings === 'object' && org.settings !== null
            ? org.settings as Record<string, unknown>
            : {};

        await prisma.organization.update({
            where: { id: organizationId },
            data: {
                settings: {
                    ...existingSettings,
                    growthEngine: {
                        launched: true,
                        launchedAt: new Date().toISOString(),
                        launchedBy: userId,
                        checklist: checklist,
                    },
                },
            },
        });

        // Log the approval for audit
        console.log(
            `[Launch Gate] 🚀 Growth Engine APPROVED for org ${organizationId} by user ${userId} at ${new Date().toISOString()}`
        );

        // Create audit log entry
        await prisma.auditLog.create({
            data: {
                organizationId,
                userId,
                action: 'GROWTH_ENGINE_LAUNCHED',
                entityType: 'ORGANIZATION',
                entityId: organizationId,
                changes: {
                    launched: true,
                    launchedAt: new Date().toISOString(),
                    checklist,
                },
            },
        });
    }

    /**
     * Check if growth engine is launched (quick check for send operations)
     */
    async isLaunched(organizationId: string): Promise<boolean> {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { settings: true },
        });

        const settings = this.parseSettings(org?.settings);
        return settings.launched;
    }

    /**
     * Guard function - throws if not launched
     * Use this before any send operation
     */
    async requireLaunched(organizationId: string): Promise<void> {
        const isLaunched = await this.isLaunched(organizationId);

        if (!isLaunched) {
            throw new Error(
                '🔒 Growth Engine not launched. Owner approval required before sending any messages.'
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    private parseSettings(settings: unknown): GrowthEngineSettings {
        const defaultSettings: GrowthEngineSettings = {
            launched: false,
            launchedAt: null,
            launchedBy: null,
            checklist: null,
        };

        if (typeof settings !== 'object' || settings === null) {
            return defaultSettings;
        }

        const obj = settings as Record<string, unknown>;
        const growthEngine = obj.growthEngine as Record<string, unknown> | undefined;

        if (!growthEngine) {
            return defaultSettings;
        }

        return {
            launched: growthEngine.launched === true,
            launchedAt: typeof growthEngine.launchedAt === 'string' ? growthEngine.launchedAt : null,
            launchedBy: typeof growthEngine.launchedBy === 'string' ? growthEngine.launchedBy : null,
            checklist: growthEngine.checklist as LaunchChecklist | null,
        };
    }

    private getDefaultChecklist(): LaunchChecklist {
        return {
            bankAccountConfigured: false,
            mercadoPagoConnected: false,
            legalEntityRegistered: false,
            afipRegistrationComplete: false,
            whatsappApiConfigured: false,
            emailProviderConfigured: false,
            templateSubmittedToMeta: false,
            templateApprovedByMeta: false,
            testCampaignSent: false,
            understandsMessageVolume: false,
            paymentProcessingVerified: false,
            readyForInquiries: false,
        };
    }

    private buildChecklist(saved: LaunchChecklist | null): ChecklistItem[] {
        const current = saved || this.getDefaultChecklist();

        return CHECKLIST_ITEMS.map(item => ({
            ...item,
            checked: current[item.key] || false,
        }));
    }

    private isChecklistComplete(checklist: LaunchChecklist | null): boolean {
        if (!checklist) return false;
        return EMAIL_REQUIRED_ITEMS.every(key => checklist[key] === true);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

let launchGateServiceInstance: LaunchGateService | null = null;

export function getLaunchGateService(): LaunchGateService {
    if (!launchGateServiceInstance) {
        launchGateServiceInstance = new LaunchGateService();
    }
    return launchGateServiceInstance;
}

export default LaunchGateService;
