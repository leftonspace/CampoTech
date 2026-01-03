/**
 * Permissions Unit Tests
 * ======================
 * Tests for role-based field and module permissions
 */

// Using Jest globals
import {
  canViewField,
  canEditField,
  canAccessModule,
  getModuleAccess,
  filterSensitiveFields,
  validateFieldEdits,
  ORGANIZATION_FIELDS,
  USER_FIELDS,
  CUSTOMER_FIELDS,
  JOB_FIELDS,
  MODULE_ACCESS,
} from '@/lib/config/field-permissions';
import type { UserRole, FieldPermission } from '@/lib/config/field-permissions';

describe('Field Permissions', () => {
  describe('Organization Fields', () => {
    describe('Locked Fields (AFIP/Legal)', () => {
      it('CUIT should be locked and visible to all roles', () => {
        const field = ORGANIZATION_FIELDS.cuit;
        expect(field.status).toBe('locked');
        expect(field.visibleTo).toContain('OWNER');
        expect(field.visibleTo).toContain('DISPATCHER');
        expect(field.visibleTo).toContain('TECHNICIAN');
        expect(field.editableBy).toHaveLength(0);
      });

      it('Razon Social should be locked', () => {
        expect(ORGANIZATION_FIELDS.razonSocial.status).toBe('locked');
      });

      it('IVA Condition should be locked', () => {
        expect(ORGANIZATION_FIELDS.ivaCondition.status).toBe('locked');
      });
    });

    describe('Restricted Fields (Owner Only)', () => {
      it('CBU should only be visible to OWNER', () => {
        const field = ORGANIZATION_FIELDS.cbu;
        expect(field.status).toBe('restricted');
        expect(field.visibleTo).toEqual(['OWNER']);
        expect(field.encrypted).toBe(true);
      });

      it('AFIP Certificate should be restricted and encrypted', () => {
        const field = ORGANIZATION_FIELDS.afipCertificate;
        expect(field.status).toBe('restricted');
        expect(field.visibleTo).toEqual(['OWNER']);
        expect(field.encrypted).toBe(true);
      });
    });

    describe('Editable Fields', () => {
      it('Organization name should be editable by OWNER', () => {
        const field = ORGANIZATION_FIELDS.name;
        expect(field.status).toBe('editable');
        expect(field.editableBy).toContain('OWNER');
      });
    });
  });

  describe('User Fields', () => {
    it('CUIL should be locked (government assigned)', () => {
      expect(USER_FIELDS.cuil.status).toBe('locked');
    });

    it('DNI should be locked', () => {
      expect(USER_FIELDS.dni.status).toBe('locked');
    });

    it('Remuneration should be restricted and encrypted', () => {
      const field = USER_FIELDS.remuneracion;
      expect(field.status).toBe('restricted');
      expect(field.encrypted).toBe(true);
    });

    it('Role changes should require approval', () => {
      expect(USER_FIELDS.role.status).toBe('approval');
      expect(USER_FIELDS.role.requiresApproval).toBe(true);
    });
  });

  describe('Customer Fields', () => {
    it('Customer CUIT should be locked', () => {
      expect(CUSTOMER_FIELDS.cuit.status).toBe('locked');
    });

    it('Customer name should be editable by OWNER and DISPATCHER', () => {
      const field = CUSTOMER_FIELDS.name;
      expect(field.editableBy).toContain('OWNER');
      expect(field.editableBy).toContain('DISPATCHER');
      expect(field.editableBy).not.toContain('TECHNICIAN');
    });

    it('Customer phone should be editable by all roles', () => {
      const field = CUSTOMER_FIELDS.phone;
      expect(field.editableBy).toContain('OWNER');
      expect(field.editableBy).toContain('DISPATCHER');
      expect(field.editableBy).toContain('TECHNICIAN');
    });
  });

  describe('Job Fields', () => {
    it('Job number should be locked', () => {
      expect(JOB_FIELDS.jobNumber.status).toBe('locked');
    });

    it('Customer signature should be locked once captured', () => {
      expect(JOB_FIELDS.customerSignature.status).toBe('locked');
    });

    it('Job status should be editable by all roles', () => {
      const field = JOB_FIELDS.status;
      expect(field.editableBy).toContain('OWNER');
      expect(field.editableBy).toContain('DISPATCHER');
      expect(field.editableBy).toContain('TECHNICIAN');
    });

    it('Resolution should only be editable by TECHNICIAN', () => {
      const field = JOB_FIELDS.resolution;
      expect(field.editableBy).toContain('TECHNICIAN');
      expect(field.editableBy).not.toContain('OWNER');
      expect(field.editableBy).not.toContain('DISPATCHER');
    });
  });
});

describe('Permission Helper Functions', () => {
  describe('canViewField', () => {
    const ownerOnlyField: FieldPermission = {
      status: 'restricted',
      visibleTo: ['OWNER'],
      editableBy: ['OWNER'],
    };

    const allRolesField: FieldPermission = {
      status: 'editable',
      visibleTo: ['OWNER', 'DISPATCHER', 'TECHNICIAN'],
      editableBy: ['OWNER'],
    };

    it('OWNER should be able to view owner-only fields', () => {
      expect(canViewField(ownerOnlyField, 'OWNER')).toBe(true);
    });

    it('DISPATCHER should not be able to view owner-only fields', () => {
      expect(canViewField(ownerOnlyField, 'DISPATCHER')).toBe(false);
    });

    it('All roles should be able to view public fields', () => {
      expect(canViewField(allRolesField, 'OWNER')).toBe(true);
      expect(canViewField(allRolesField, 'DISPATCHER')).toBe(true);
      expect(canViewField(allRolesField, 'TECHNICIAN')).toBe(true);
    });

    it('Users can view their own data (except restricted)', () => {
      const editableField: FieldPermission = {
        status: 'editable',
        visibleTo: ['OWNER'],
        editableBy: ['OWNER'],
      };
      // isSelf = true allows viewing non-restricted fields
      expect(canViewField(editableField, 'TECHNICIAN', true)).toBe(true);
    });

    it('Users cannot view their own restricted data', () => {
      expect(canViewField(ownerOnlyField, 'TECHNICIAN', true)).toBe(false);
    });
  });

  describe('canEditField', () => {
    it('Nobody can edit locked fields', () => {
      const lockedField: FieldPermission = {
        status: 'locked',
        visibleTo: ['OWNER', 'DISPATCHER', 'TECHNICIAN'],
        editableBy: [],
      };
      expect(canEditField(lockedField, 'OWNER')).toBe(false);
      expect(canEditField(lockedField, 'DISPATCHER')).toBe(false);
      expect(canEditField(lockedField, 'TECHNICIAN')).toBe(false);
    });

    it('Only authorized roles can edit editable fields', () => {
      const ownerEditableField: FieldPermission = {
        status: 'editable',
        visibleTo: ['OWNER', 'DISPATCHER', 'TECHNICIAN'],
        editableBy: ['OWNER'],
      };
      expect(canEditField(ownerEditableField, 'OWNER')).toBe(true);
      expect(canEditField(ownerEditableField, 'DISPATCHER')).toBe(false);
      expect(canEditField(ownerEditableField, 'TECHNICIAN')).toBe(false);
    });

    it('Nobody can edit readonly fields', () => {
      const readonlyField: FieldPermission = {
        status: 'readonly',
        visibleTo: ['OWNER', 'DISPATCHER', 'TECHNICIAN'],
        editableBy: [],
      };
      expect(canEditField(readonlyField, 'OWNER')).toBe(false);
    });
  });

  describe('canAccessModule', () => {
    it('OWNER should have access to all modules', () => {
      expect(canAccessModule('dashboard', 'OWNER')).toBe(true);
      expect(canAccessModule('jobs', 'OWNER')).toBe(true);
      expect(canAccessModule('invoices', 'OWNER')).toBe(true);
      expect(canAccessModule('settings', 'OWNER')).toBe(true);
      expect(canAccessModule('analytics', 'OWNER')).toBe(true);
    });

    it('DISPATCHER should not have access to billing modules', () => {
      expect(canAccessModule('invoices', 'DISPATCHER')).toBe(false);
      expect(canAccessModule('payments', 'DISPATCHER')).toBe(false);
      expect(canAccessModule('settings', 'DISPATCHER')).toBe(false);
    });

    it('DISPATCHER should have access to operations modules', () => {
      expect(canAccessModule('jobs', 'DISPATCHER')).toBe(true);
      expect(canAccessModule('customers', 'DISPATCHER')).toBe(true);
      expect(canAccessModule('calendar', 'DISPATCHER')).toBe(true);
      expect(canAccessModule('whatsapp', 'DISPATCHER')).toBe(true);
    });

    it('TECHNICIAN should have limited access', () => {
      expect(canAccessModule('jobs', 'TECHNICIAN')).toBe(true);
      expect(canAccessModule('customers', 'TECHNICIAN')).toBe(true);
      expect(canAccessModule('invoices', 'TECHNICIAN')).toBe(false);
      expect(canAccessModule('settings', 'TECHNICIAN')).toBe(false);
      expect(canAccessModule('analytics', 'TECHNICIAN')).toBe(false);
    });
  });

  describe('getModuleAccess', () => {
    it('should return correct access levels', () => {
      expect(getModuleAccess('dashboard', 'OWNER')).toBe('full');
      expect(getModuleAccess('dashboard', 'DISPATCHER')).toBe('limited');
      expect(getModuleAccess('dashboard', 'TECHNICIAN')).toBe('own');
    });

    it('should return hidden for non-accessible modules', () => {
      expect(getModuleAccess('invoices', 'TECHNICIAN')).toBe('hidden');
      expect(getModuleAccess('settings', 'DISPATCHER')).toBe('hidden');
    });
  });

  describe('filterSensitiveFields', () => {
    const testData = {
      name: 'Test Org',
      cuit: '30-12345678-9',
      cbu: '1234567890',
      phone: '+5491100000000',
    };

    it('OWNER should see all fields', () => {
      const filtered = filterSensitiveFields(testData, ORGANIZATION_FIELDS, 'OWNER');
      expect(filtered.name).toBe('Test Org');
      expect(filtered.cuit).toBe('30-12345678-9');
      expect(filtered.cbu).toBe('1234567890');
    });

    it('TECHNICIAN should not see restricted fields like CBU', () => {
      const filtered = filterSensitiveFields(testData, ORGANIZATION_FIELDS, 'TECHNICIAN');
      expect(filtered.name).toBe('Test Org');
      expect(filtered.cuit).toBe('30-12345678-9');
      expect(filtered.cbu).toBeUndefined();
    });
  });

  describe('validateFieldEdits', () => {
    it('should allow valid edits', () => {
      const updates = { name: 'New Name', phone: '+5491100000001' };
      const result = validateFieldEdits(updates, ORGANIZATION_FIELDS, 'OWNER');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject edits to locked fields', () => {
      const updates = { cuit: '30-99999999-9' };
      const result = validateFieldEdits(updates, ORGANIZATION_FIELDS, 'OWNER');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject edits by unauthorized roles', () => {
      const updates = { name: 'New Name' };
      const result = validateFieldEdits(updates, ORGANIZATION_FIELDS, 'TECHNICIAN');
      expect(result.valid).toBe(false);
    });
  });
});

describe('Module Access Configuration', () => {
  it('should have correct module access for all 3 roles', () => {
    const roles: UserRole[] = ['OWNER', 'DISPATCHER', 'TECHNICIAN'];

    for (const module of Object.keys(MODULE_ACCESS)) {
      for (const role of roles) {
        const access = MODULE_ACCESS[module][role];
        expect(access).toBeDefined();
        expect(['full', 'limited', 'view', 'own', 'hidden']).toContain(access);
      }
    }
  });

  it('Schedule module should be accessible with correct levels', () => {
    expect(MODULE_ACCESS.schedule.OWNER).toBe('full');
    expect(MODULE_ACCESS.schedule.DISPATCHER).toBe('full');
    expect(MODULE_ACCESS.schedule.TECHNICIAN).toBe('own');
  });

  it('WhatsApp module should be hidden from TECHNICIAN', () => {
    expect(MODULE_ACCESS.whatsapp.TECHNICIAN).toBe('hidden');
  });
});
