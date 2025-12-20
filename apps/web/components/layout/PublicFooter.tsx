import Link from 'next/link';

/**
 * Public Footer Component
 * =======================
 *
 * Footer for public-facing pages with legal links.
 */
export function PublicFooter() {
  return (
    <footer className="bg-gray-900 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="text-center md:text-left">
            <Link href="/" className="text-2xl font-bold text-white">
              CampoTech
            </Link>
            <p className="mt-2 text-sm text-gray-400">
              Gestión de servicios técnicos para Argentina
            </p>
          </div>

          <div className="mt-6 md:mt-0 flex flex-wrap justify-center md:justify-end gap-6 text-sm text-gray-400">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Política de Privacidad
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Términos de Servicio
            </Link>
            <Link
              href="/arrepentimiento"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <span className="text-danger-400">●</span>
              Botón de Arrepentimiento
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} CampoTech. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
