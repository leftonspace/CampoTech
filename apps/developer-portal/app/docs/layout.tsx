'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Book, Key, Webhook, Code, Zap, Settings, HelpCircle } from 'lucide-react';

const sidebarItems = [
  {
    title: 'Comenzar',
    items: [
      { href: '/docs', label: 'Introducción', icon: Book },
      { href: '/docs/quickstart', label: 'Inicio rápido', icon: Zap },
    ],
  },
  {
    title: 'Autenticación',
    items: [
      { href: '/docs/authentication', label: 'Visión general', icon: Key },
      { href: '/docs/api-keys', label: 'API Keys', icon: Key },
      { href: '/docs/oauth', label: 'OAuth 2.0', icon: Key },
    ],
  },
  {
    title: 'Guías',
    items: [
      { href: '/docs/webhooks', label: 'Webhooks', icon: Webhook },
      { href: '/docs/sdks', label: 'SDKs', icon: Code },
      { href: '/docs/pagination', label: 'Paginación', icon: Settings },
      { href: '/docs/errors', label: 'Manejo de errores', icon: HelpCircle },
    ],
  },
  {
    title: 'Integraciones',
    items: [
      { href: '/docs/google-calendar', label: 'Google Calendar', icon: Settings },
      { href: '/docs/quickbooks', label: 'QuickBooks', icon: Settings },
      { href: '/docs/zapier', label: 'Zapier', icon: Zap },
    ],
  },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hidden lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto py-6 px-4">
          <Link href="/" className="text-lg font-bold text-primary-600 block mb-6">
            CampoTech API
          </Link>
          <nav className="space-y-6">
            {sidebarItems.map((group) => (
              <div key={group.title}>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {group.title}
                </h4>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-10">
          <div className="px-6 h-14 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="lg:hidden text-lg font-bold text-primary-600">
                CampoTech
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/reference" className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                API Reference
              </Link>
              <Link href="/playground" className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Playground
              </Link>
              <Link
                href="/console"
                className="text-sm bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700"
              >
                Consola
              </Link>
            </div>
          </div>
        </header>
        <div className="px-6 py-8 max-w-4xl mx-auto">
          <article className="mdx-content">{children}</article>
        </div>
      </main>
    </div>
  );
}
