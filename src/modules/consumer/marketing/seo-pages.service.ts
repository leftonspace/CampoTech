/**
 * SEO Pages Service
 * =================
 *
 * Dynamic SEO landing page generator for marketplace.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SeoPageData {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  content: string;
  breadcrumbs: Array<{ label: string; href: string }>;
  type: 'category' | 'city' | 'service' | 'city_category' | 'city_service';
}

export interface CategoryLandingPage extends SeoPageData {
  category: {
    id: string;
    name: string;
    icon: string;
    description: string;
    popularServices: string[];
  };
  featuredBusinesses: Array<{
    id: string;
    displayName: string;
    slug: string;
    logoUrl: string | null;
    rating: number;
    reviewCount: number;
    badges: string[];
  }>;
  topCities: Array<{
    name: string;
    businessCount: number;
    slug: string;
  }>;
  faq: Array<{ question: string; answer: string }>;
  stats: {
    totalBusinesses: number;
    avgRating: number;
    totalReviews: number;
  };
}

export interface CityLandingPage extends SeoPageData {
  city: {
    name: string;
    province: string;
    description: string;
  };
  categories: Array<{
    id: string;
    name: string;
    icon: string;
    businessCount: number;
    slug: string;
  }>;
  featuredBusinesses: Array<{
    id: string;
    displayName: string;
    slug: string;
    logoUrl: string | null;
    category: string;
    rating: number;
  }>;
  neighborhoods: Array<{
    name: string;
    businessCount: number;
  }>;
  stats: {
    totalBusinesses: number;
    totalCategories: number;
    avgRating: number;
  };
}

export interface ServiceLandingPage extends SeoPageData {
  service: {
    name: string;
    category: string;
    description: string;
    priceRange: { min: number; max: number } | null;
  };
  topBusinesses: Array<{
    id: string;
    displayName: string;
    slug: string;
    logoUrl: string | null;
    rating: number;
    reviewCount: number;
    priceRange: { min: number; max: number } | null;
  }>;
  relatedServices: string[];
  cities: Array<{
    name: string;
    businessCount: number;
    slug: string;
  }>;
  howItWorks: Array<{ step: number; title: string; description: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class SeoPagesService {
  private readonly ARGENTINA_PROVINCES: Record<string, string> = {
    'buenos-aires': 'Buenos Aires',
    caba: 'Ciudad Autónoma de Buenos Aires',
    cordoba: 'Córdoba',
    mendoza: 'Mendoza',
    rosario: 'Santa Fe',
    'mar-del-plata': 'Buenos Aires',
    'la-plata': 'Buenos Aires',
  };

  private readonly CATEGORY_FAQS: Record<string, Array<{ question: string; answer: string }>> = {
    plomeria: [
      {
        question: '¿Cuánto cuesta un plomero en Argentina?',
        answer: 'Los precios de plomería varían según el trabajo. Una reparación simple puede costar entre $3,000-$8,000 ARS, mientras que instalaciones más complejas pueden superar los $25,000 ARS.',
      },
      {
        question: '¿Los plomeros trabajan los fines de semana?',
        answer: 'Muchos plomeros ofrecen servicios de emergencia 24/7, incluyendo fines de semana y feriados. El costo puede ser mayor fuera del horario laboral.',
      },
    ],
    electricidad: [
      {
        question: '¿Necesito un electricista matriculado?',
        answer: 'Sí, para garantizar seguridad y cumplimiento normativo, recomendamos contratar electricistas matriculados. En CampoTech verificamos las credenciales de los profesionales.',
      },
    ],
    limpieza: [
      {
        question: '¿Cuánto cobra una persona de limpieza por hora?',
        answer: 'El precio promedio por hora de limpieza doméstica oscila entre $1,500-$3,000 ARS dependiendo de la zona y el tipo de servicio.',
      },
    ],
  };

  constructor(private pool: Pool) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // CATEGORY LANDING PAGES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate category landing page data
   */
  async getCategoryPage(categorySlug: string): Promise<CategoryLandingPage | null> {
    // Get category info
    const categoryName = this.getCategoryName(categorySlug);
    if (!categoryName) return null;

    // Get stats and businesses
    const [stats, businesses, topCities] = await Promise.all([
      this.getCategoryStats(categorySlug),
      this.getFeaturedBusinessesForCategory(categorySlug),
      this.getTopCitiesForCategory(categorySlug),
    ]);

    const title = `${categoryName} en Argentina | Mejores Profesionales | CampoTech`;
    const metaDescription = `Encuentra los mejores profesionales de ${categoryName.toLowerCase()} en Argentina. ${stats.totalBusinesses} profesionales verificados con calificación promedio de ${stats.avgRating.toFixed(1)}★. Cotizaciones gratis.`;

    return {
      slug: categorySlug,
      title,
      metaDescription,
      h1: `Profesionales de ${categoryName} en Argentina`,
      content: this.generateCategoryContent(categoryName, stats),
      breadcrumbs: [
        { label: 'Inicio', href: '/' },
        { label: 'Servicios', href: '/servicios' },
        { label: categoryName, href: `/servicios/${categorySlug}` },
      ],
      type: 'category',
      category: {
        id: categorySlug,
        name: categoryName,
        icon: this.getCategoryIcon(categorySlug),
        description: this.getCategoryDescription(categorySlug),
        popularServices: this.getPopularServices(categorySlug),
      },
      featuredBusinesses: businesses,
      topCities,
      faq: this.CATEGORY_FAQS[categorySlug] || [],
      stats,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CITY LANDING PAGES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate city landing page data
   */
  async getCityPage(citySlug: string): Promise<CityLandingPage | null> {
    const cityName = this.getCityName(citySlug);
    if (!cityName) return null;

    const province = this.ARGENTINA_PROVINCES[citySlug] || 'Argentina';

    const [stats, categories, businesses, neighborhoods] = await Promise.all([
      this.getCityStats(cityName),
      this.getCategoriesInCity(cityName),
      this.getFeaturedBusinessesInCity(cityName),
      this.getNeighborhoodsInCity(cityName),
    ]);

    const title = `Servicios para el Hogar en ${cityName} | CampoTech`;
    const metaDescription = `Encuentra los mejores profesionales para servicios del hogar en ${cityName}, ${province}. ${stats.totalBusinesses} profesionales en ${stats.totalCategories} categorías. Cotizaciones gratis.`;

    return {
      slug: citySlug,
      title,
      metaDescription,
      h1: `Servicios para el Hogar en ${cityName}`,
      content: this.generateCityContent(cityName, province, stats),
      breadcrumbs: [
        { label: 'Inicio', href: '/' },
        { label: 'Ciudades', href: '/ciudades' },
        { label: cityName, href: `/ciudades/${citySlug}` },
      ],
      type: 'city',
      city: {
        name: cityName,
        province,
        description: `Encuentra profesionales verificados para todo tipo de servicios del hogar en ${cityName}.`,
      },
      categories,
      featuredBusinesses: businesses,
      neighborhoods,
      stats,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CITY + CATEGORY COMBO PAGES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate city + category combo page
   */
  async getCityCategoryPage(
    citySlug: string,
    categorySlug: string
  ): Promise<CategoryLandingPage | null> {
    const cityName = this.getCityName(citySlug);
    const categoryName = this.getCategoryName(categorySlug);

    if (!cityName || !categoryName) return null;

    const [stats, businesses] = await Promise.all([
      this.getCityCategoryStats(cityName, categorySlug),
      this.getBusinessesInCityCategory(cityName, categorySlug),
    ]);

    const title = `${categoryName} en ${cityName} | Mejores Profesionales | CampoTech`;
    const metaDescription = `Los mejores profesionales de ${categoryName.toLowerCase()} en ${cityName}. ${stats.totalBusinesses} profesionales verificados. Calificación promedio ${stats.avgRating.toFixed(1)}★. Pide cotizaciones gratis.`;

    return {
      slug: `${citySlug}/${categorySlug}`,
      title,
      metaDescription,
      h1: `${categoryName} en ${cityName}`,
      content: this.generateCityCategoryContent(categoryName, cityName, stats),
      breadcrumbs: [
        { label: 'Inicio', href: '/' },
        { label: cityName, href: `/ciudades/${citySlug}` },
        { label: categoryName, href: `/ciudades/${citySlug}/${categorySlug}` },
      ],
      type: 'city_category',
      category: {
        id: categorySlug,
        name: categoryName,
        icon: this.getCategoryIcon(categorySlug),
        description: this.getCategoryDescription(categorySlug),
        popularServices: this.getPopularServices(categorySlug),
      },
      featuredBusinesses: businesses,
      topCities: [],
      faq: this.CATEGORY_FAQS[categorySlug] || [],
      stats,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SITEMAP GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate sitemap URLs
   */
  async getSitemapUrls(): Promise<Array<{ url: string; lastmod: string; priority: number }>> {
    const urls: Array<{ url: string; lastmod: string; priority: number }> = [];
    const today = new Date().toISOString().split('T')[0];

    // Static pages
    urls.push(
      { url: '/', lastmod: today, priority: 1.0 },
      { url: '/servicios', lastmod: today, priority: 0.9 },
      { url: '/ciudades', lastmod: today, priority: 0.9 }
    );

    // Category pages
    const categories = this.getAllCategories();
    for (const cat of categories) {
      urls.push({
        url: `/servicios/${cat.slug}`,
        lastmod: today,
        priority: 0.8,
      });
    }

    // City pages
    const cities = await this.getActiveCities();
    for (const city of cities) {
      urls.push({
        url: `/ciudades/${city.slug}`,
        lastmod: today,
        priority: 0.8,
      });

      // City + category combos
      for (const cat of categories) {
        urls.push({
          url: `/ciudades/${city.slug}/${cat.slug}`,
          lastmod: today,
          priority: 0.7,
        });
      }
    }

    // Business profile pages
    const businessSlugs = await this.getBusinessSlugs();
    for (const slug of businessSlugs) {
      urls.push({
        url: `/profesional/${slug}`,
        lastmod: today,
        priority: 0.6,
      });
    }

    return urls;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private async getCategoryStats(categorySlug: string): Promise<{
    totalBusinesses: number;
    avgRating: number;
    totalReviews: number;
  }> {
    const result = await this.pool.query<{
      total_businesses: string;
      avg_rating: string | null;
      total_reviews: string;
    }>(
      `SELECT
        COUNT(DISTINCT bp.id) as total_businesses,
        AVG(bpp.overall_rating) as avg_rating,
        SUM(bpp.rating_count) as total_reviews
       FROM business_profiles bp
       JOIN consumer.business_public_profiles bpp ON bpp.business_profile_id = bp.id
       WHERE $1 = ANY(bpp.categories)`,
      [categorySlug]
    );

    return {
      totalBusinesses: parseInt(result.rows[0].total_businesses, 10),
      avgRating: parseFloat(result.rows[0].avg_rating || '0'),
      totalReviews: parseInt(result.rows[0].total_reviews || '0', 10),
    };
  }

  private async getCityStats(cityName: string): Promise<{
    totalBusinesses: number;
    totalCategories: number;
    avgRating: number;
  }> {
    const result = await this.pool.query<{
      total_businesses: string;
      total_categories: string;
      avg_rating: string | null;
    }>(
      `SELECT
        COUNT(DISTINCT bp.id) as total_businesses,
        COUNT(DISTINCT unnest(bpp.categories)) as total_categories,
        AVG(bpp.overall_rating) as avg_rating
       FROM business_profiles bp
       JOIN consumer.business_public_profiles bpp ON bpp.business_profile_id = bp.id
       WHERE $1 = ANY(bpp.service_areas)`,
      [cityName]
    );

    return {
      totalBusinesses: parseInt(result.rows[0].total_businesses, 10),
      totalCategories: parseInt(result.rows[0].total_categories, 10),
      avgRating: parseFloat(result.rows[0].avg_rating || '0'),
    };
  }

  private async getCityCategoryStats(
    cityName: string,
    categorySlug: string
  ): Promise<{
    totalBusinesses: number;
    avgRating: number;
    totalReviews: number;
  }> {
    const result = await this.pool.query<{
      total_businesses: string;
      avg_rating: string | null;
      total_reviews: string;
    }>(
      `SELECT
        COUNT(DISTINCT bp.id) as total_businesses,
        AVG(bpp.overall_rating) as avg_rating,
        SUM(bpp.rating_count) as total_reviews
       FROM business_profiles bp
       JOIN consumer.business_public_profiles bpp ON bpp.business_profile_id = bp.id
       WHERE $1 = ANY(bpp.categories) AND $2 = ANY(bpp.service_areas)`,
      [categorySlug, cityName]
    );

    return {
      totalBusinesses: parseInt(result.rows[0].total_businesses, 10),
      avgRating: parseFloat(result.rows[0].avg_rating || '0'),
      totalReviews: parseInt(result.rows[0].total_reviews || '0', 10),
    };
  }

  private async getFeaturedBusinessesForCategory(categorySlug: string): Promise<Array<{
    id: string;
    displayName: string;
    slug: string;
    logoUrl: string | null;
    rating: number;
    reviewCount: number;
    badges: string[];
  }>> {
    const result = await this.pool.query<{
      id: string;
      display_name: string;
      slug: string;
      logo_url: string | null;
      overall_rating: number;
      rating_count: number;
      badges: string[];
    }>(
      `SELECT
        bp.id,
        bpp.display_name,
        bpp.slug,
        bpp.logo_url,
        bpp.overall_rating,
        bpp.rating_count,
        bpp.badges
       FROM business_profiles bp
       JOIN consumer.business_public_profiles bpp ON bpp.business_profile_id = bp.id
       WHERE $1 = ANY(bpp.categories)
       ORDER BY bpp.overall_rating DESC, bpp.rating_count DESC
       LIMIT 12`,
      [categorySlug]
    );

    return result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      slug: row.slug,
      logoUrl: row.logo_url,
      rating: row.overall_rating,
      reviewCount: row.rating_count,
      badges: row.badges || [],
    }));
  }

  private async getTopCitiesForCategory(categorySlug: string): Promise<Array<{
    name: string;
    businessCount: number;
    slug: string;
  }>> {
    const result = await this.pool.query<{
      city: string;
      count: string;
    }>(
      `SELECT
        unnest(bpp.service_areas) as city,
        COUNT(*) as count
       FROM consumer.business_public_profiles bpp
       WHERE $1 = ANY(bpp.categories)
       GROUP BY city
       ORDER BY count DESC
       LIMIT 10`,
      [categorySlug]
    );

    return result.rows.map((row) => ({
      name: row.city,
      businessCount: parseInt(row.count, 10),
      slug: this.slugify(row.city),
    }));
  }

  private async getCategoriesInCity(cityName: string): Promise<Array<{
    id: string;
    name: string;
    icon: string;
    businessCount: number;
    slug: string;
  }>> {
    const result = await this.pool.query<{
      category: string;
      count: string;
    }>(
      `SELECT
        unnest(bpp.categories) as category,
        COUNT(*) as count
       FROM consumer.business_public_profiles bpp
       WHERE $1 = ANY(bpp.service_areas)
       GROUP BY category
       ORDER BY count DESC`,
      [cityName]
    );

    return result.rows.map((row) => ({
      id: row.category,
      name: this.getCategoryName(row.category) || row.category,
      icon: this.getCategoryIcon(row.category),
      businessCount: parseInt(row.count, 10),
      slug: row.category,
    }));
  }

  private async getFeaturedBusinessesInCity(cityName: string): Promise<Array<{
    id: string;
    displayName: string;
    slug: string;
    logoUrl: string | null;
    category: string;
    rating: number;
  }>> {
    const result = await this.pool.query<{
      id: string;
      display_name: string;
      slug: string;
      logo_url: string | null;
      categories: string[];
      overall_rating: number;
    }>(
      `SELECT
        bp.id,
        bpp.display_name,
        bpp.slug,
        bpp.logo_url,
        bpp.categories,
        bpp.overall_rating
       FROM business_profiles bp
       JOIN consumer.business_public_profiles bpp ON bpp.business_profile_id = bp.id
       WHERE $1 = ANY(bpp.service_areas)
       ORDER BY bpp.overall_rating DESC
       LIMIT 12`,
      [cityName]
    );

    return result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      slug: row.slug,
      logoUrl: row.logo_url,
      category: row.categories[0] || '',
      rating: row.overall_rating,
    }));
  }

  private async getNeighborhoodsInCity(cityName: string): Promise<Array<{
    name: string;
    businessCount: number;
  }>> {
    const result = await this.pool.query<{
      neighborhood: string;
      count: string;
    }>(
      `SELECT
        bp.neighborhood,
        COUNT(*) as count
       FROM business_profiles bp
       WHERE bp.city = $1 AND bp.neighborhood IS NOT NULL
       GROUP BY bp.neighborhood
       ORDER BY count DESC
       LIMIT 15`,
      [cityName]
    );

    return result.rows.map((row) => ({
      name: row.neighborhood,
      businessCount: parseInt(row.count, 10),
    }));
  }

  private async getBusinessesInCityCategory(cityName: string, categorySlug: string): Promise<Array<{
    id: string;
    displayName: string;
    slug: string;
    logoUrl: string | null;
    rating: number;
    reviewCount: number;
    badges: string[];
  }>> {
    const result = await this.pool.query<{
      id: string;
      display_name: string;
      slug: string;
      logo_url: string | null;
      overall_rating: number;
      rating_count: number;
      badges: string[];
    }>(
      `SELECT
        bp.id,
        bpp.display_name,
        bpp.slug,
        bpp.logo_url,
        bpp.overall_rating,
        bpp.rating_count,
        bpp.badges
       FROM business_profiles bp
       JOIN consumer.business_public_profiles bpp ON bpp.business_profile_id = bp.id
       WHERE $1 = ANY(bpp.categories) AND $2 = ANY(bpp.service_areas)
       ORDER BY bpp.overall_rating DESC
       LIMIT 20`,
      [categorySlug, cityName]
    );

    return result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      slug: row.slug,
      logoUrl: row.logo_url,
      rating: row.overall_rating,
      reviewCount: row.rating_count,
      badges: row.badges || [],
    }));
  }

  private async getActiveCities(): Promise<Array<{ name: string; slug: string }>> {
    const result = await this.pool.query<{ city: string }>(
      `SELECT DISTINCT unnest(service_areas) as city
       FROM consumer.business_public_profiles
       ORDER BY city`
    );

    return result.rows.map((row) => ({
      name: row.city,
      slug: this.slugify(row.city),
    }));
  }

  private async getBusinessSlugs(): Promise<string[]> {
    const result = await this.pool.query<{ slug: string }>(
      `SELECT slug FROM consumer.business_public_profiles WHERE slug IS NOT NULL`
    );
    return result.rows.map((row) => row.slug);
  }

  private getCategoryName(slug: string): string | null {
    const categories: Record<string, string> = {
      plomeria: 'Plomería',
      electricidad: 'Electricidad',
      limpieza: 'Limpieza',
      pintura: 'Pintura',
      carpinteria: 'Carpintería',
      gasista: 'Gas',
      cerrajeria: 'Cerrajería',
      jardineria: 'Jardinería',
      mudanzas: 'Mudanzas',
      refrigeracion: 'Refrigeración',
      albanileria: 'Albañilería',
      'reparacion-electrodomesticos': 'Reparación de Electrodomésticos',
      fumigacion: 'Fumigación',
      seguridad: 'Seguridad',
      techista: 'Techista',
      vidriero: 'Vidriero',
      tapiceria: 'Tapicería',
      piscinas: 'Piscinas',
    };
    return categories[slug] || null;
  }

  private getCategoryIcon(slug: string): string {
    const icons: Record<string, string> = {
      plomeria: '🔧',
      electricidad: '⚡',
      limpieza: '🧹',
      pintura: '🎨',
      carpinteria: '🪚',
      gasista: '🔥',
      cerrajeria: '🔑',
      jardineria: '🌱',
      mudanzas: '📦',
      refrigeracion: '❄️',
      albanileria: '🧱',
      'reparacion-electrodomesticos': '🔌',
      fumigacion: '🪳',
      seguridad: '🔒',
      techista: '🏠',
      vidriero: '🪟',
      tapiceria: '🛋️',
      piscinas: '🏊',
    };
    return icons[slug] || '🔨';
  }

  private getCategoryDescription(slug: string): string {
    const descriptions: Record<string, string> = {
      plomeria: 'Servicios de plomería para instalación, reparación y mantenimiento de sistemas de agua y desagüe.',
      electricidad: 'Electricistas profesionales para instalaciones, reparaciones y emergencias eléctricas.',
      limpieza: 'Servicios de limpieza profesional para hogares y oficinas.',
      pintura: 'Pintores profesionales para interiores, exteriores y trabajos decorativos.',
    };
    return descriptions[slug] || 'Profesionales verificados listos para ayudarte.';
  }

  private getPopularServices(slug: string): string[] {
    const services: Record<string, string[]> = {
      plomeria: ['Destapaciones', 'Reparación de pérdidas', 'Instalación de termotanque', 'Cambio de grifería'],
      electricidad: ['Instalación de tomas', 'Cambio de llave térmica', 'Instalación de aire acondicionado', 'Reparación de cortocircuitos'],
      limpieza: ['Limpieza profunda', 'Limpieza de mudanza', 'Limpieza de alfombras', 'Limpieza post obra'],
      pintura: ['Pintura de interiores', 'Pintura de exteriores', 'Pintura decorativa', 'Impermeabilización'],
    };
    return services[slug] || [];
  }

  private getCityName(slug: string): string | null {
    const cities: Record<string, string> = {
      'buenos-aires': 'Buenos Aires',
      caba: 'Ciudad de Buenos Aires',
      cordoba: 'Córdoba',
      mendoza: 'Mendoza',
      rosario: 'Rosario',
      'mar-del-plata': 'Mar del Plata',
      'la-plata': 'La Plata',
      tucuman: 'Tucumán',
      salta: 'Salta',
    };
    return cities[slug] || null;
  }

  private getAllCategories(): Array<{ slug: string; name: string }> {
    return [
      { slug: 'plomeria', name: 'Plomería' },
      { slug: 'electricidad', name: 'Electricidad' },
      { slug: 'limpieza', name: 'Limpieza' },
      { slug: 'pintura', name: 'Pintura' },
      { slug: 'carpinteria', name: 'Carpintería' },
      { slug: 'gasista', name: 'Gas' },
      { slug: 'cerrajeria', name: 'Cerrajería' },
      { slug: 'jardineria', name: 'Jardinería' },
      { slug: 'mudanzas', name: 'Mudanzas' },
      { slug: 'refrigeracion', name: 'Refrigeración' },
      { slug: 'albanileria', name: 'Albañilería' },
      { slug: 'reparacion-electrodomesticos', name: 'Reparación de Electrodomésticos' },
      { slug: 'fumigacion', name: 'Fumigación' },
      { slug: 'seguridad', name: 'Seguridad' },
      { slug: 'techista', name: 'Techista' },
      { slug: 'vidriero', name: 'Vidriero' },
      { slug: 'tapiceria', name: 'Tapicería' },
      { slug: 'piscinas', name: 'Piscinas' },
    ];
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private generateCategoryContent(categoryName: string, stats: { totalBusinesses: number; avgRating: number }): string {
    return `Encuentra los mejores profesionales de ${categoryName.toLowerCase()} en Argentina. Con más de ${stats.totalBusinesses} profesionales verificados y una calificación promedio de ${stats.avgRating.toFixed(1)} estrellas, CampoTech te conecta con expertos confiables para resolver cualquier necesidad de ${categoryName.toLowerCase()}. Solicita cotizaciones gratis y compara precios antes de contratar.`;
  }

  private generateCityContent(cityName: string, province: string, stats: { totalBusinesses: number; totalCategories: number }): string {
    return `Descubre los mejores profesionales para servicios del hogar en ${cityName}, ${province}. Con ${stats.totalBusinesses} profesionales en ${stats.totalCategories} categorías diferentes, encontrarás el experto que necesitas para cualquier trabajo. Todos los profesionales están verificados y puedes comparar precios antes de contratar.`;
  }

  private generateCityCategoryContent(categoryName: string, cityName: string, stats: { totalBusinesses: number; avgRating: number }): string {
    return `¿Buscas ${categoryName.toLowerCase()} en ${cityName}? Tenemos ${stats.totalBusinesses} profesionales verificados con una calificación promedio de ${stats.avgRating.toFixed(1)} estrellas. Compara precios, lee reseñas de otros clientes y solicita cotizaciones gratis. Encuentra el profesional ideal para tu proyecto hoy.`;
  }
}
