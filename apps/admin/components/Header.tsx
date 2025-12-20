'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminAlert, AdminSearchResult } from '@/types';

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminSearchResult | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAlerts, setShowAlerts] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  // Fetch alerts on mount
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setShowAlerts(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults(null);
      setShowSearchResults(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function fetchAlerts() {
    try {
      const res = await fetch('/api/admin/alerts?limit=10');
      const data = await res.json();
      if (data.success) {
        setAlerts(data.data.alerts);
        setUnreadCount(data.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }

  async function performSearch(query: string) {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  }

  async function markAllAlertsRead() {
    try {
      await fetch('/api/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking alerts read:', error);
    }
  }

  function handleSearchResultClick(type: string, id: string, orgId?: string) {
    setShowSearchResults(false);
    setSearchQuery('');

    switch (type) {
      case 'organization':
        router.push(`/dashboard/negocios/${id}`);
        break;
      case 'user':
        if (orgId) router.push(`/dashboard/negocios/${orgId}`);
        break;
      case 'payment':
        router.push(`/dashboard/subscriptions?payment=${id}`);
        break;
      case 'verification':
        router.push(`/dashboard/verificaciones/${id}`);
        break;
    }
  }

  function handleAlertClick(alert: AdminAlert) {
    setShowAlerts(false);

    switch (alert.entityType) {
      case 'organization':
        router.push(`/dashboard/negocios/${alert.entityId}`);
        break;
      case 'subscription':
        if (alert.organizationId) {
          router.push(`/dashboard/subscriptions/${alert.organizationId}`);
        }
        break;
      case 'verification':
        router.push(`/dashboard/verificaciones/${alert.entityId}`);
        break;
      case 'payment':
        router.push(`/dashboard/subscriptions?payment=${alert.entityId}`);
        break;
    }
  }

  const hasResults =
    searchResults &&
    (searchResults.organizations.length > 0 ||
      searchResults.users.length > 0 ||
      searchResults.payments.length > 0 ||
      searchResults.verifications.length > 0);

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      {/* Title */}
      {title && <h1 className="text-xl font-semibold text-slate-900">{title}</h1>}

      {/* Search and Alerts */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Global Search */}
        <div ref={searchRef} className="relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar organizaciones, usuarios, pagos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-80 pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-slate-200 z-50 max-h-96 overflow-auto">
              {!hasResults ? (
                <div className="p-4 text-center text-slate-500 text-sm">
                  No se encontraron resultados para "{searchQuery}"
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {/* Organizations */}
                  {searchResults.organizations.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase">
                        Organizaciones
                      </div>
                      {searchResults.organizations.map((org) => (
                        <button
                          key={org.id}
                          onClick={() => handleSearchResultClick('organization', org.id)}
                          className="w-full flex items-center gap-3 px-2 py-2 hover:bg-slate-50 rounded text-left"
                        >
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-slate-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {org.name}
                            </p>
                            <p className="text-xs text-slate-500">{org.cuit || org.ownerEmail}</p>
                          </div>
                          {org.isBlocked && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                              Bloqueado
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Users */}
                  {searchResults.users.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase">
                        Usuarios
                      </div>
                      {searchResults.users.map((user) => (
                        <button
                          key={user.id}
                          onClick={() =>
                            handleSearchResultClick('user', user.id, user.organizationId)
                          }
                          className="w-full flex items-center gap-3 px-2 py-2 hover:bg-slate-50 rounded text-left"
                        >
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-slate-600">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {user.email} • {user.organizationName}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Payments */}
                  {searchResults.payments.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase">
                        Pagos
                      </div>
                      {searchResults.payments.map((payment) => (
                        <button
                          key={payment.id}
                          onClick={() => handleSearchResultClick('payment', payment.id)}
                          className="w-full flex items-center gap-3 px-2 py-2 hover:bg-slate-50 rounded text-left"
                        >
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-slate-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">
                              ${payment.amount} {payment.currency}
                            </p>
                            <p className="text-xs text-slate-500">
                              {payment.organizationName} • MP: {payment.mpPaymentId || 'N/A'}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              payment.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : payment.status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {payment.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Verifications */}
                  {searchResults.verifications.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase">
                        Verificaciones
                      </div>
                      {searchResults.verifications.map((verification) => (
                        <button
                          key={verification.id}
                          onClick={() =>
                            handleSearchResultClick('verification', verification.id)
                          }
                          className="w-full flex items-center gap-3 px-2 py-2 hover:bg-slate-50 rounded text-left"
                        >
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-slate-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {verification.requirementName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {verification.organizationName}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              verification.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : verification.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {verification.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/search?filter=blocked"
            className="text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-full hover:bg-red-100"
          >
            Bloqueados
          </Link>
          <Link
            href="/dashboard/search?filter=pending"
            className="text-xs px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-full hover:bg-yellow-100"
          >
            Pendientes
          </Link>
        </div>

        {/* Alerts Bell */}
        <div ref={alertsRef} className="relative">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Alerts Dropdown */}
          {showAlerts && (
            <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <h3 className="font-medium text-slate-900">Notificaciones</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAlertsRead}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Marcar todas como leídas
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-auto">
                {alerts.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    No hay notificaciones
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {alerts.map((alert) => (
                      <button
                        key={alert.id}
                        onClick={() => handleAlertClick(alert)}
                        className={`w-full flex items-start gap-3 p-4 hover:bg-slate-50 text-left ${
                          !alert.isRead ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            alert.severity === 'error'
                              ? 'bg-red-100'
                              : alert.severity === 'warning'
                              ? 'bg-yellow-100'
                              : alert.severity === 'success'
                              ? 'bg-green-100'
                              : 'bg-blue-100'
                          }`}
                        >
                          {alert.severity === 'error' ? (
                            <svg
                              className="w-4 h-4 text-red-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          ) : alert.severity === 'warning' ? (
                            <svg
                              className="w-4 h-4 text-yellow-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          ) : alert.severity === 'success' ? (
                            <svg
                              className="w-4 h-4 text-green-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4 text-blue-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{alert.message}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(alert.createdAt).toLocaleString('es-AR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        {!alert.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-slate-200">
                <Link
                  href="/dashboard/settings/notifications"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Configurar notificaciones
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
