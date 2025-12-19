'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Search,
  MapPin,
  MessageCircle,
  Phone,
  User,
  RefreshCw,
  ExternalLink,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api-client';

interface Contact {
  id: string;
  name: string;
  phone: string;
  address?: string;
  city?: string;
  province?: string;
  customerId?: string;
  lastContactedAt?: string;
  hasConversation: boolean;
}

interface ContactsPanelProps {
  onClose: () => void;
  onStartConversation: (phone: string) => void;
}

function generateGoogleMapsUrl(address: string, city?: string, province?: string): string {
  const fullAddress = [address, city, province].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
}

export default function ContactsPanel({ onClose, onStartConversation }: ContactsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch contacts (synced from clients)
  const { data: contactsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['whatsapp-contacts'],
    queryFn: () => api.whatsapp.contacts.search({ limit: 100 }),
    staleTime: 60000,
  });

  const contacts = (contactsData?.data || []) as Contact[];

  // Filter contacts based on search
  const filteredContacts = contacts.filter((contact) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.name.toLowerCase().includes(searchLower) ||
      contact.phone.includes(searchTerm) ||
      contact.address?.toLowerCase().includes(searchLower) ||
      contact.city?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="w-80 border-l bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            <h3 className="font-semibold text-gray-900">Contactos</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"
              title="Sincronizar contactos"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar contacto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Contacts list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span>Cargando contactos...</span>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">
              {searchTerm ? 'No se encontraron contactos' : 'No hay contactos'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {searchTerm
                ? 'Intenta con otro término de búsqueda'
                : 'Los clientes se sincronizan automáticamente como contactos'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredContacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onStartConversation={onStartConversation}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with count */}
      <div className="p-3 border-t bg-gray-50 text-center text-xs text-gray-500">
        {contacts.length} contacto{contacts.length !== 1 ? 's' : ''} sincronizado{contacts.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

interface ContactCardProps {
  contact: Contact;
  onStartConversation: (phone: string) => void;
}

function ContactCard({ contact, onStartConversation }: ContactCardProps) {
  const initials = contact.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const hasAddress = contact.address || contact.city;
  const mapsUrl = hasAddress
    ? generateGoogleMapsUrl(contact.address || '', contact.city, contact.province)
    : null;

  return (
    <div className="p-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-medium text-sm flex-shrink-0">
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 truncate">{contact.name}</h4>
            {contact.hasConversation && (
              <span className="flex-shrink-0 w-2 h-2 bg-teal-500 rounded-full" title="Tiene conversación" />
            )}
          </div>

          {/* Phone */}
          <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
            <Phone className="h-3 w-3" />
            <span>{contact.phone}</span>
          </div>

          {/* Address with Google Maps link */}
          {hasAddress && mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800 hover:underline mt-1 group"
            >
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {[contact.address, contact.city].filter(Boolean).join(', ')}
              </span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </a>
          )}
        </div>
      </div>

      {/* Action button */}
      <div className="mt-2 pl-13">
        <button
          onClick={() => onStartConversation(contact.phone)}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          {contact.hasConversation ? 'Ver conversación' : 'Iniciar conversación'}
        </button>
      </div>
    </div>
  );
}
