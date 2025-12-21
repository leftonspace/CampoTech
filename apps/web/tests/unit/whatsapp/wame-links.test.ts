/**
 * WhatsApp wa.me Links Unit Tests
 * ================================
 *
 * Tests for phone number normalization and wa.me link generation.
 * These utilities support the INICIAL tier wa.me link integration.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  generateWhatsAppLink,
  generateInvoiceWhatsAppLink,
  generateJobWhatsAppLink,
  generateCustomerWhatsAppLink,
  generateBusinessProfileWhatsAppLink,
  isValidWhatsAppNumber,
  formatPhoneForDisplay,
} from '@/lib/whatsapp-links';

describe('normalizePhoneNumber', () => {
  describe('Argentine mobile numbers', () => {
    it('should normalize full international format', () => {
      expect(normalizePhoneNumber('+54 9 11 5555-1234')).toBe('5491155551234');
    });

    it('should add country code and 9 prefix for 10-digit mobile numbers', () => {
      expect(normalizePhoneNumber('11 5555 1234')).toBe('5491155551234');
    });

    it('should remove leading 0 from local format', () => {
      expect(normalizePhoneNumber('011 5555-1234')).toBe('5491155551234');
    });

    it('should handle numbers with various separators', () => {
      expect(normalizePhoneNumber('+54-9-11-5555-1234')).toBe('5491155551234');
      expect(normalizePhoneNumber('(011) 5555.1234')).toBe('5491155551234');
      expect(normalizePhoneNumber('011.5555.1234')).toBe('5491155551234');
    });

    it('should handle Córdoba area code', () => {
      expect(normalizePhoneNumber('351 555 1234')).toBe('5493515551234');
    });

    it('should add 9 prefix if missing from 54 prefix', () => {
      expect(normalizePhoneNumber('+54 11 5555 1234')).toBe('5491155551234');
    });
  });

  describe('International numbers', () => {
    it('should handle US numbers', () => {
      expect(normalizePhoneNumber('+1 555 123 4567')).toBe('15551234567');
    });

    it('should handle Brazilian numbers', () => {
      expect(normalizePhoneNumber('+55 11 9 1234 5678')).toBe('5511912345678');
    });

    it('should preserve already formatted international numbers', () => {
      expect(normalizePhoneNumber('+44 20 7946 0958')).toBe('442079460958');
    });
  });

  describe('Edge cases', () => {
    it('should handle numbers with spaces only', () => {
      expect(normalizePhoneNumber('5491155551234')).toBe('5491155551234');
    });

    it('should strip all non-digit characters', () => {
      expect(normalizePhoneNumber('Call +54 (9) 11-5555-1234!')).toBe('5491155551234');
    });
  });
});

describe('generateWhatsAppLink', () => {
  it('should generate basic wa.me link', () => {
    const link = generateWhatsAppLink('+54 11 5555-1234');
    expect(link).toBe('https://wa.me/5491155551234');
  });

  it('should include pre-filled message', () => {
    const link = generateWhatsAppLink('+54 11 5555-1234', 'Hola, tengo una consulta');
    expect(link).toBe('https://wa.me/5491155551234?text=Hola%2C%20tengo%20una%20consulta');
  });

  it('should properly encode special characters in message', () => {
    const link = generateWhatsAppLink('+54 11 5555-1234', 'Precio: $1.000 (20% desc.)');
    expect(link).toContain('text=');
    expect(link).toContain(encodeURIComponent('Precio: $1.000 (20% desc.)'));
  });

  it('should not include text param if message is empty', () => {
    const link = generateWhatsAppLink('+54 11 5555-1234', '');
    expect(link).toBe('https://wa.me/5491155551234');
  });
});

describe('generateInvoiceWhatsAppLink', () => {
  it('should generate link with invoice number', () => {
    const link = generateInvoiceWhatsAppLink('+54 11 5555-1234', 'A-0001-00012345');
    expect(link).toContain('wa.me/5491155551234');
    expect(link).toContain('Factura');
    expect(link).toContain('A-0001-00012345');
  });

  it('should support custom invoice type', () => {
    const link = generateInvoiceWhatsAppLink('+54 11 5555-1234', 'B-0002-00001111', 'Nota de Crédito');
    expect(link).toContain('Nota%20de%20Cr%C3%A9dito');
    expect(link).toContain('B-0002-00001111');
  });
});

describe('generateJobWhatsAppLink', () => {
  it('should generate link with job details', () => {
    const link = generateJobWhatsAppLink('+54 11 5555-1234', 'Juan', 'TRB-001');
    expect(link).toContain('wa.me/5491155551234');
    expect(link).toContain('Juan');
    expect(link).toContain('TRB-001');
  });

  it('should include scheduled date if provided', () => {
    const link = generateJobWhatsAppLink('+54 11 5555-1234', 'María', 'TRB-002', '15/12/2024');
    expect(link).toContain('15%2F12%2F2024');
    expect(link).toContain('programado');
  });

  it('should work without scheduled date', () => {
    const link = generateJobWhatsAppLink('+54 11 5555-1234', 'Pedro', 'TRB-003');
    expect(link).not.toContain('programado');
  });
});

describe('generateCustomerWhatsAppLink', () => {
  it('should generate greeting link for customer', () => {
    const link = generateCustomerWhatsAppLink('+54 11 5555-1234', 'Ana');
    expect(link).toContain('wa.me/5491155551234');
    expect(link).toContain('Hola%20Ana');
  });
});

describe('generateBusinessProfileWhatsAppLink', () => {
  it('should generate link with business name', () => {
    const link = generateBusinessProfileWhatsAppLink('+54 11 5555-1234', 'Climatización del Sur');
    expect(link).toContain('wa.me/5491155551234');
    expect(link).toContain('Climatizaci%C3%B3n%20del%20Sur');
    expect(link).toContain('CampoTech');
  });

  it('should work without business name', () => {
    const link = generateBusinessProfileWhatsAppLink('+54 11 5555-1234');
    expect(link).toContain('tu%20perfil%20en%20CampoTech');
  });
});

describe('isValidWhatsAppNumber', () => {
  it('should return true for valid Argentine mobile', () => {
    expect(isValidWhatsAppNumber('+54 9 11 5555-1234')).toBe(true);
  });

  it('should return true for valid US number', () => {
    expect(isValidWhatsAppNumber('+1 555 123 4567')).toBe(true);
  });

  it('should return false for too short number', () => {
    expect(isValidWhatsAppNumber('12345')).toBe(false);
  });

  it('should return false for too long number', () => {
    expect(isValidWhatsAppNumber('1234567890123456')).toBe(false);
  });

  it('should handle numbers at boundary lengths', () => {
    expect(isValidWhatsAppNumber('1234567890')).toBe(true); // 10 digits
    expect(isValidWhatsAppNumber('123456789012345')).toBe(true); // 15 digits
  });
});

describe('formatPhoneForDisplay', () => {
  it('should format Argentine mobile number', () => {
    const formatted = formatPhoneForDisplay('5491155551234');
    expect(formatted).toBe('+54 9 11 5555-1234');
  });

  it('should format Argentine landline number', () => {
    const formatted = formatPhoneForDisplay('541155551234');
    expect(formatted).toBe('+54 11 5555-1234');
  });

  it('should handle already formatted numbers', () => {
    const formatted = formatPhoneForDisplay('+54 9 11 5555-1234');
    // Should still work with already formatted input
    expect(formatted).toBe('+54 9 11 5555-1234');
  });

  it('should provide basic formatting for international numbers', () => {
    const formatted = formatPhoneForDisplay('15551234567');
    expect(formatted).toContain('+');
    expect(formatted).toContain('-');
  });
});
