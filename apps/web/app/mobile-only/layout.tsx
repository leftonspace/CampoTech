import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acceso para Técnicos — CampoTech',
  description:
    'CampoTech para técnicos está disponible exclusivamente en la app móvil. ' +
    'Descargá la app para recibir y gestionar tus órdenes de trabajo.',
  robots: {
    index: false,   // No need to index a redirect/landing page
    follow: false,
  },
};

export default function MobileOnlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
