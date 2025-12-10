'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Key, Webhook, BarChart3, Settings, Plus, Copy, Eye, EyeOff, Trash2 } from 'lucide-react';

interface Application {
  id: string;
  name: string;
  createdAt: string;
  apiKeysCount: number;
  webhooksCount: number;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsed: string | null;
}

// Mock data for demonstration
const mockApps: Application[] = [
  {
    id: 'app_1',
    name: 'Mi App de Producción',
    createdAt: '2025-01-01',
    apiKeysCount: 2,
    webhooksCount: 3,
  },
  {
    id: 'app_2',
    name: 'App de Desarrollo',
    createdAt: '2025-01-05',
    apiKeysCount: 1,
    webhooksCount: 0,
  },
];

const mockApiKeys: ApiKey[] = [
  {
    id: 'key_1',
    name: 'Production Server',
    prefix: 'ct_live_abc...',
    scopes: ['read:customers', 'write:customers', 'read:jobs', 'write:jobs'],
    createdAt: '2025-01-01',
    lastUsed: '2025-01-10',
  },
  {
    id: 'key_2',
    name: 'Development',
    prefix: 'ct_test_xyz...',
    scopes: ['read:customers', 'read:jobs'],
    createdAt: '2025-01-05',
    lastUsed: null,
  },
];

export default function ConsolePage() {
  const [activeTab, setActiveTab] = useState<'apps' | 'keys' | 'webhooks' | 'usage'>('apps');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-xl font-bold text-primary-600">
                CampoTech
              </Link>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600 dark:text-slate-400">Consola de desarrollador</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/docs" className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Docs
              </Link>
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 font-medium">
                U
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-white dark:bg-slate-800 rounded-lg p-1 inline-flex">
          <TabButton
            active={activeTab === 'apps'}
            onClick={() => setActiveTab('apps')}
            icon={<Settings className="w-4 h-4" />}
            label="Aplicaciones"
          />
          <TabButton
            active={activeTab === 'keys'}
            onClick={() => setActiveTab('keys')}
            icon={<Key className="w-4 h-4" />}
            label="API Keys"
          />
          <TabButton
            active={activeTab === 'webhooks'}
            onClick={() => setActiveTab('webhooks')}
            icon={<Webhook className="w-4 h-4" />}
            label="Webhooks"
          />
          <TabButton
            active={activeTab === 'usage'}
            onClick={() => setActiveTab('usage')}
            icon={<BarChart3 className="w-4 h-4" />}
            label="Uso"
          />
        </div>

        {/* Content */}
        {activeTab === 'apps' && <ApplicationsSection apps={mockApps} />}
        {activeTab === 'keys' && <ApiKeysSection keys={mockApiKeys} />}
        {activeTab === 'webhooks' && <WebhooksSection />}
        {activeTab === 'usage' && <UsageSection />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
      }`}
    >
      {icon}
      <span className="ml-2">{label}</span>
    </button>
  );
}

function ApplicationsSection({ apps }: { apps: Application[] }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Mis aplicaciones</h2>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Nueva aplicación
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {apps.map((app) => (
          <div
            key={app.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
          >
            <h3 className="font-semibold text-lg mb-2">{app.name}</h3>
            <p className="text-sm text-slate-500 mb-4">Creada el {app.createdAt}</p>
            <div className="flex space-x-4 text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                <Key className="w-4 h-4 inline mr-1" />
                {app.apiKeysCount} API keys
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                <Webhook className="w-4 h-4 inline mr-1" />
                {app.webhooksCount} webhooks
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApiKeysSection({ keys }: { keys: ApiKey[] }) {
  const [showKey, setShowKey] = useState<string | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">API Keys</h2>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Crear API Key
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Nombre</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Key</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Scopes</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Último uso</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-slate-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {keys.map((key) => (
              <tr key={key.id}>
                <td className="px-6 py-4">
                  <span className="font-medium">{key.name}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <code className="text-sm bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                      {showKey === key.id ? 'ct_live_abcdefghij...' : key.prefix}
                    </code>
                    <button
                      onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showKey === key.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button className="text-slate-400 hover:text-slate-600">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.slice(0, 2).map((scope) => (
                      <span
                        key={scope}
                        className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 px-2 py-0.5 rounded"
                      >
                        {scope}
                      </span>
                    ))}
                    {key.scopes.length > 2 && (
                      <span className="text-xs text-slate-500">+{key.scopes.length - 2} más</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {key.lastUsed || 'Nunca'}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WebhooksSection() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Webhooks</h2>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Crear Webhook
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
        <Webhook className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="font-medium mb-2">No hay webhooks configurados</h3>
        <p className="text-slate-500 text-sm mb-4">
          Crea un webhook para recibir notificaciones cuando ocurran eventos.
        </p>
        <button className="text-primary-600 hover:text-primary-700 font-medium text-sm">
          Crear tu primer webhook →
        </button>
      </div>
    </div>
  );
}

function UsageSection() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Uso de la API</h2>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Requests este mes" value="2,847" change="+12%" />
        <StatCard label="Requests exitosos" value="99.2%" change="+0.3%" />
        <StatCard label="Tiempo promedio" value="142ms" change="-8%" positive />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="font-semibold mb-4">Requests por día (últimos 7 días)</h3>
        <div className="h-64 flex items-end justify-between space-x-2">
          {[65, 78, 92, 45, 88, 120, 95].map((value, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-primary-500 rounded-t"
                style={{ height: `${(value / 120) * 100}%` }}
              ></div>
              <span className="text-xs text-slate-500 mt-2">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][idx]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  positive = true,
}: {
  label: string;
  value: string;
  change: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className={`text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>{change}</p>
    </div>
  );
}
