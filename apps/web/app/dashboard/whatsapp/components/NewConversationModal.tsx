'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  X,
  Search,
  Phone,
  User,
  MessageCircle,
  Plus,
} from 'lucide-react';
import { api } from '@/lib/api-client';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  hasConversation: boolean;
  conversationId: string | null;
}

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
}

export default function NewConversationModal({
  isOpen,
  onClose,
  onSelectConversation,
}: NewConversationModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-contacts', searchQuery],
    queryFn: () => api.whatsapp.contacts.search({ q: searchQuery }),
    enabled: isOpen && searchQuery.length > 0,
  });

  const contacts = (data?.data || []) as Contact[];

  const createMutation = useMutation({
    mutationFn: (data: { phone: string; name: string }) =>
      api.whatsapp.contacts.create(data),
    onSuccess: (result) => {
      if (result?.data?.conversationId) {
        onSelectConversation(result.data.conversationId);
        onClose();
      }
    },
  });

  const handleSelectContact = (contact: Contact) => {
    if (contact.conversationId) {
      onSelectConversation(contact.conversationId);
      onClose();
    } else {
      // Create conversation for existing customer
      createMutation.mutate({
        phone: contact.phone,
        name: contact.name,
      });
    }
  };

  const handleCreateNew = () => {
    if (!newPhone.trim()) return;
    createMutation.mutate({
      phone: newPhone.trim(),
      name: newName.trim() || 'Nuevo contacto',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nueva conversacion</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o telefono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* New contact form toggle */}
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 border-b"
          >
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Nuevo contacto</p>
              <p className="text-sm text-gray-500">Iniciar chat con un numero nuevo</p>
            </div>
          </button>

          {/* New contact form */}
          {showNewForm && (
            <div className="p-4 bg-gray-50 border-b space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Numero de telefono *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="11 1234-5678"
                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Nombre (opcional)
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre del contacto"
                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateNew}
                disabled={!newPhone.trim() || createMutation.isPending}
                className="w-full btn-primary"
              >
                {createMutation.isPending ? 'Creando...' : 'Iniciar conversacion'}
              </button>
            </div>
          )}

          {/* Contact results */}
          {searchQuery && (
            <div className="p-4">
              {isLoading ? (
                <div className="text-center py-4 text-gray-500">
                  Buscando...
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <User className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>No se encontraron contactos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleSelectContact(contact)}
                      className="w-full p-3 flex items-center gap-3 text-left rounded-lg hover:bg-gray-50 border"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                        {contact.name[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {contact.name}
                        </p>
                        <p className="text-sm text-gray-500">{contact.phone}</p>
                      </div>
                      {contact.hasConversation && (
                        <MessageCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
