/**
 * WhatsApp Client Tests
 * =====================
 *
 * Integration tests for WhatsApp Cloud API client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { WhatsAppClient } from '@/src/integrations/whatsapp/client';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      defaults: { headers: {} },
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
    })),
    get: vi.fn(),
  },
}));

describe('WhatsAppClient', () => {
  let client: WhatsAppClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      defaults: { headers: { Authorization: 'Bearer test_token' } },
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
    };

    (axios.create as any).mockReturnValue(mockAxiosInstance);

    client = new WhatsAppClient({
      accessToken: 'test_access_token',
      phoneNumberId: 'PHONE_NUMBER_ID',
      businessAccountId: 'BUSINESS_ACCOUNT_ID',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sendTextMessage', () => {
    it('should send a text message successfully', async () => {
      const mockResponse = {
        data: {
          messaging_product: 'whatsapp',
          contacts: [{ input: '5491112345678', waId: '5491112345678' }],
          messages: [{ id: 'wamid.123' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await client.sendTextMessage('5491112345678', 'Hello World');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/PHONE_NUMBER_ID/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '5491112345678',
        type: 'text',
        text: {
          body: 'Hello World',
          preview_url: false,
        },
      });

      expect(result.messages[0].id).toBe('wamid.123');
    });

    it('should send text message with URL preview', async () => {
      const mockResponse = {
        data: {
          messaging_product: 'whatsapp',
          contacts: [{ input: '5491112345678', waId: '5491112345678' }],
          messages: [{ id: 'wamid.124' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await client.sendTextMessage('5491112345678', 'Check https://example.com', {
        previewUrl: true,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/PHONE_NUMBER_ID/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '5491112345678',
        type: 'text',
        text: {
          body: 'Check https://example.com',
          preview_url: true,
        },
      });
    });
  });

  describe('sendTemplateMessage', () => {
    it('should send a template message', async () => {
      const mockResponse = {
        data: {
          messaging_product: 'whatsapp',
          contacts: [{ input: '5491112345678', waId: '5491112345678' }],
          messages: [{ id: 'wamid.125' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await client.sendTemplateMessage('5491112345678', 'hello_world');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/PHONE_NUMBER_ID/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '5491112345678',
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'es_AR' },
        },
      });

      expect(result.messages[0].id).toBe('wamid.125');
    });

    it('should send template with components', async () => {
      const mockResponse = {
        data: {
          messaging_product: 'whatsapp',
          contacts: [{ input: '5491112345678', waId: '5491112345678' }],
          messages: [{ id: 'wamid.126' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const components = client.buildTemplateComponents(
        ['John', 'Order #123'],
        ['Welcome!']
      );

      await client.sendTemplateMessage('5491112345678', 'order_confirmation', {
        components,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/PHONE_NUMBER_ID/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '5491112345678',
        type: 'template',
        template: {
          name: 'order_confirmation',
          language: { code: 'es_AR' },
          components: expect.arrayContaining([
            expect.objectContaining({ type: 'header' }),
            expect.objectContaining({ type: 'body' }),
          ]),
        },
      });
    });
  });

  describe('sendButtonMessage', () => {
    it('should send an interactive button message', async () => {
      const mockResponse = {
        data: {
          messaging_product: 'whatsapp',
          contacts: [{ input: '5491112345678', waId: '5491112345678' }],
          messages: [{ id: 'wamid.127' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const buttons = [
        { id: 'btn_yes', title: 'Yes' },
        { id: 'btn_no', title: 'No' },
      ];

      await client.sendButtonMessage('5491112345678', 'Do you confirm?', buttons);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/PHONE_NUMBER_ID/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '5491112345678',
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Do you confirm?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'btn_yes', title: 'Yes' } },
              { type: 'reply', reply: { id: 'btn_no', title: 'No' } },
            ],
          },
        },
      });
    });

    it('should throw error if more than 3 buttons', async () => {
      const buttons = [
        { id: 'btn_1', title: 'One' },
        { id: 'btn_2', title: 'Two' },
        { id: 'btn_3', title: 'Three' },
        { id: 'btn_4', title: 'Four' },
      ];

      await expect(
        client.sendButtonMessage('5491112345678', 'Choose', buttons)
      ).rejects.toThrow('Maximum 3 buttons allowed');
    });
  });

  describe('sendListMessage', () => {
    it('should send a list message', async () => {
      const mockResponse = {
        data: {
          messaging_product: 'whatsapp',
          contacts: [{ input: '5491112345678', waId: '5491112345678' }],
          messages: [{ id: 'wamid.128' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const sections = [
        {
          title: 'Services',
          rows: [
            { id: 'svc_1', title: 'Plumbing', description: 'Fix leaks' },
            { id: 'svc_2', title: 'Electric', description: 'Fix wiring' },
          ],
        },
      ];

      await client.sendListMessage(
        '5491112345678',
        'Select a service',
        'View options',
        sections
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/PHONE_NUMBER_ID/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '5491112345678',
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: 'Select a service' },
          action: {
            button: 'View options',
            sections: expect.any(Array),
          },
        },
      });
    });

    it('should throw error if more than 10 total rows', async () => {
      const sections = [
        {
          rows: Array(11).fill({ id: 'row', title: 'Item' }).map((r, i) => ({
            ...r,
            id: `row_${i}`,
          })),
        },
      ];

      await expect(
        client.sendListMessage('5491112345678', 'Choose', 'Options', sections)
      ).rejects.toThrow('Maximum 10 total rows allowed');
    });
  });

  describe('sendMediaMessage', () => {
    it('should send an image message with ID', async () => {
      const mockResponse = {
        data: {
          messaging_product: 'whatsapp',
          contacts: [{ input: '5491112345678', waId: '5491112345678' }],
          messages: [{ id: 'wamid.129' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await client.sendMediaMessage('5491112345678', 'image', 'MEDIA_ID_123', {
        caption: 'Check this out!',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/PHONE_NUMBER_ID/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '5491112345678',
        type: 'image',
        image: {
          id: 'MEDIA_ID_123',
          caption: 'Check this out!',
        },
      });
    });

    it('should send an image message with URL', async () => {
      const mockResponse = {
        data: {
          messaging_product: 'whatsapp',
          contacts: [{ input: '5491112345678', waId: '5491112345678' }],
          messages: [{ id: 'wamid.130' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await client.sendMediaMessage(
        '5491112345678',
        'image',
        'https://example.com/image.jpg'
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/PHONE_NUMBER_ID/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '5491112345678',
        type: 'image',
        image: {
          link: 'https://example.com/image.jpg',
        },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark a message as read', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: { success: true } });

      await client.markAsRead('wamid.123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/PHONE_NUMBER_ID/messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: 'wamid.123',
      });
    });
  });

  describe('getTemplates', () => {
    it('should fetch templates', async () => {
      const mockResponse = {
        data: {
          data: [
            { name: 'hello_world', language: 'es', status: 'APPROVED' },
            { name: 'order_update', language: 'es', status: 'PENDING' },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const templates = await client.getTemplates();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/BUSINESS_ACCOUNT_ID/message_templates', {
        params: expect.objectContaining({
          limit: 100,
        }),
      });

      expect(templates).toHaveLength(2);
    });
  });

  describe('buildTemplateComponents', () => {
    it('should build components with body params only', () => {
      const components = client.buildTemplateComponents(['John', 'Order #123']);

      expect(components).toHaveLength(1);
      expect(components[0]).toEqual({
        type: 'body',
        parameters: [
          { type: 'text', text: 'John' },
          { type: 'text', text: 'Order #123' },
        ],
      });
    });

    it('should build components with header and body', () => {
      const components = client.buildTemplateComponents(
        ['Body text'],
        ['Header text']
      );

      expect(components).toHaveLength(2);
      expect(components[0].type).toBe('header');
      expect(components[1].type).toBe('body');
    });
  });
});
