import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  Star,
  MapPin,
  Phone,
  MessageCircle,
  Shield,
  CheckCircle,
  Clock,
  Briefcase,
  Quote,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const profile = await prisma.businessPublicProfile.findFirst({
    where: {
      OR: [{ organizationId: slug }],
      isActive: true,
    },
    select: {
      displayName: true,
      description: true,
      logo: true,
      categories: true,
    },
  });

  if (!profile) {
    return {
      title: 'Perfil no encontrado | CampoTech',
    };
  }

  return {
    title: `${profile.displayName} | CampoTech`,
    description: profile.description || `${profile.displayName} en CampoTech - Servicios de ${profile.categories.join(', ')}`,
    openGraph: {
      title: profile.displayName,
      description: profile.description || undefined,
      images: profile.logo ? [{ url: profile.logo }] : undefined,
    },
  };
}

export default async function PublicBusinessProfilePage({ params }: PageProps) {
  const { slug } = await params;

  // Fetch profile data
  const profile = await prisma.businessPublicProfile.findFirst({
    where: {
      OR: [{ organizationId: slug }],
      isActive: true,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          verificationStatus: true,
        },
      },
    },
  });

  if (!profile) {
    notFound();
  }

  // Fetch recent reviews (only submitted reviews with ratings)
  const reviews = await prisma.review.findMany({
    where: {
      organizationId: profile.organization.id,
      rating: { not: null },
      submittedAt: { not: null }, // Only show submitted reviews
    },
    orderBy: { submittedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      rating: true,
      comment: true,
      submittedAt: true,
      customer: {
        select: {
          name: true,
        },
      },
      job: {
        select: {
          serviceType: true,
        },
      },
    },
  });

  // Phase 3.2: Use tracked redirect link for attribution
  const whatsappLink = `/wa-redirect/${profile.slug || profile.organizationId}`;

  // Parse services from JSON
  const services = (profile.services as { name: string; description?: string; priceRange?: string }[]) || [];

  // Format response time
  const formatResponseTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 hora' : `${hours} horas`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover Photo */}
      {profile.coverPhoto ? (
        <div className="h-48 md:h-64 w-full bg-gradient-to-r from-primary-600 to-primary-800">
          <img
            src={profile.coverPhoto}
            alt={profile.displayName}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="h-48 md:h-64 w-full bg-gradient-to-r from-primary-600 to-primary-800" />
      )}

      <div className="mx-auto max-w-4xl px-4 pb-12">
        {/* Profile Header */}
        <div className="relative -mt-16 mb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            {/* Logo */}
            <div className="flex-shrink-0">
              {profile.logo ? (
                <img
                  src={profile.logo}
                  alt={profile.displayName}
                  className="h-32 w-32 rounded-xl border-4 border-white bg-white object-cover shadow-lg"
                />
              ) : (
                <div className="h-32 w-32 rounded-xl border-4 border-white bg-primary-600 flex items-center justify-center shadow-lg">
                  <span className="text-4xl font-bold text-white">
                    {profile.displayName.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* Name and badges */}
            <div className="flex-1 bg-white rounded-xl p-4 shadow-sm md:ml-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{profile.displayName}</h1>
                {profile.organization.verificationStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle className="h-3 w-3" />
                    Verificado
                  </span>
                )}
              </div>

              {/* Rating and stats */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {profile.totalReviews > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{profile.averageRating.toFixed(1)}</span>
                    <span className="text-gray-500">({profile.totalReviews} reseñas)</span>
                  </div>
                )}
                {profile.totalJobs > 0 && (
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4 text-gray-400" />
                    <span>{profile.totalJobs} trabajos</span>
                  </div>
                )}
                {profile.responseTime > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>Responde en {formatResponseTime(profile.responseTime)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {profile.description && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Sobre nosotros</h2>
                <p className="text-gray-600 whitespace-pre-line">{profile.description}</p>
              </div>
            )}

            {/* Services */}
            {services.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Servicios</h2>
                <div className="space-y-3">
                  {services.map((service, idx) => (
                    <div key={idx} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{service.name}</p>
                        {service.description && (
                          <p className="text-sm text-gray-500">{service.description}</p>
                        )}
                      </div>
                      {service.priceRange && (
                        <span className="text-sm text-primary-600 font-medium">{service.priceRange}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Reseñas de clientes ({profile.totalReviews})
                </h2>
                <div className="space-y-4">
                  {reviews.map((review: typeof reviews[number]) => (
                    <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${i < (review.rating || 0)
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                                  }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {review.customer?.name || 'Cliente'}
                          </span>
                        </div>
                        {review.job?.serviceType && (
                          <span className="text-xs text-gray-400 capitalize">
                            {review.job.serviceType.toLowerCase().replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      {review.comment ? (
                        <p className="text-gray-600 text-sm">
                          <Quote className="h-3 w-3 inline mr-1 text-gray-400" />
                          {review.comment}
                        </p>
                      ) : (
                        <p className="text-gray-400 text-sm italic">
                          Sin comentario
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contacto</h2>

              {/* WhatsApp Button - Primary CTA */}
              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors mb-4"
                >
                  <MessageCircle className="h-5 w-5" />
                  Contactar por WhatsApp
                </a>
              )}

              {/* Phone */}
              {profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  <Phone className="h-5 w-5 text-gray-400" />
                  <span>{profile.phone}</span>
                </a>
              )}

              {/* Address */}
              {profile.address && (
                <div className="flex items-start gap-2 p-3 text-gray-700">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <span>{profile.address}</span>
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Verificaciones</h2>
              <div className="space-y-3">
                {profile.cuitVerified && (
                  <div className="flex items-center gap-2 text-green-700">
                    <Shield className="h-5 w-5" />
                    <span className="text-sm">CUIT/CUIL verificado</span>
                  </div>
                )}
                {profile.insuranceVerified && (
                  <div className="flex items-center gap-2 text-green-700">
                    <Shield className="h-5 w-5" />
                    <span className="text-sm">Seguro verificado</span>
                  </div>
                )}
                {profile.organization.verificationStatus === 'verified' && (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm">Negocio verificado</span>
                  </div>
                )}
                {!profile.cuitVerified && !profile.insuranceVerified && profile.organization.verificationStatus !== 'verified' && (
                  <p className="text-sm text-gray-500">Sin verificaciones aún</p>
                )}
              </div>
            </div>

            {/* Categories */}
            {profile.categories.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Especialidades</h2>
                <div className="flex flex-wrap gap-2">
                  {(profile.categories as string[]).map((cat: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Perfil de negocio en{' '}
            <a href="https://campo.tech" className="text-primary-600 hover:underline">
              CampoTech
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
