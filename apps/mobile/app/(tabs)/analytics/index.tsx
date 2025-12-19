/**
 * Analytics Dashboard - Owner Only
 * =================================
 *
 * Phase 2.5.2: Analytics Dashboard
 * - Revenue overview with period comparison
 * - Job completion metrics
 * - Technician performance rankings
 * - Customer satisfaction trends
 * - Service type breakdown
 */

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  Clock,
  Star,
  Users,
  Briefcase,
  ChevronRight,
  Calendar,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
} from 'lucide-react-native';
import { useAuth } from '../../../lib/providers/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Time period options
type Period = 'week' | 'month' | 'quarter' | 'year';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Esta semana',
  month: 'Este mes',
  quarter: 'Este trimestre',
  year: 'Este año',
};

// Mock analytics data
const MOCK_ANALYTICS = {
  revenue: {
    current: 2450000,
    previous: 2180000,
    currency: 'ARS',
  },
  jobs: {
    completed: 156,
    scheduled: 42,
    cancelled: 8,
    avgCompletionTime: 95, // minutes
  },
  satisfaction: {
    avgRating: 4.7,
    totalReviews: 134,
    fiveStars: 98,
    fourStars: 28,
    threeOrLess: 8,
  },
  technicians: [
    { id: '1', name: 'Carlos R.', jobs: 48, rating: 4.8, revenue: 680000 },
    { id: '2', name: 'María G.', jobs: 42, rating: 4.6, revenue: 590000 },
    { id: '3', name: 'Juan P.', jobs: 38, rating: 4.5, revenue: 520000 },
    { id: '4', name: 'Diego M.', jobs: 28, rating: 4.3, revenue: 380000 },
  ],
  serviceTypes: [
    { type: 'Instalación', count: 45, revenue: 980000, color: '#3b82f6' },
    { type: 'Reparación', count: 62, revenue: 720000, color: '#10b981' },
    { type: 'Mantenimiento', count: 38, revenue: 480000, color: '#f59e0b' },
    { type: 'Diagnóstico', count: 11, revenue: 270000, color: '#8b5cf6' },
  ],
  weeklyTrend: [
    { day: 'Lun', jobs: 8, revenue: 180000 },
    { day: 'Mar', jobs: 12, revenue: 260000 },
    { day: 'Mié', jobs: 10, revenue: 220000 },
    { day: 'Jue', jobs: 14, revenue: 310000 },
    { day: 'Vie', jobs: 16, revenue: 380000 },
    { day: 'Sáb', jobs: 6, revenue: 140000 },
    { day: 'Dom', jobs: 2, revenue: 60000 },
  ],
};

export default function AnalyticsDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [refreshing, setRefreshing] = useState(false);

  const analytics = MOCK_ANALYTICS;

  // Calculate percentage change
  const revenueChange = useMemo(() => {
    const change =
      ((analytics.revenue.current - analytics.revenue.previous) /
        analytics.revenue.previous) *
      100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change >= 0,
    };
  }, [analytics.revenue]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get max value for bar chart scaling
  const maxWeeklyJobs = Math.max(...analytics.weeklyTrend.map((d) => d.jobs));
  const totalServiceJobs = analytics.serviceTypes.reduce((sum, s) => sum + s.count, 0);

  const onRefresh = async () => {
    setRefreshing(true);
    // In production, fetch fresh analytics data
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Analíticas</Text>
          <Text style={styles.subtitle}>Resumen del negocio</Text>
        </View>
        <View style={styles.periodSelector}>
          {(['week', 'month', 'quarter'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodButton, period === p && styles.periodButtonActive]}
              onPress={() => setPeriod(p)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  period === p && styles.periodButtonTextActive,
                ]}
              >
                {p === 'week' ? 'Sem' : p === 'month' ? 'Mes' : 'Trim'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
          />
        }
      >
        {/* Revenue Card */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueHeader}>
            <View style={styles.revenueIconContainer}>
              <DollarSign size={20} color="#059669" />
            </View>
            <Text style={styles.revenueLabel}>Ingresos totales</Text>
          </View>
          <View style={styles.revenueMain}>
            <Text style={styles.revenueAmount}>
              {formatCurrency(analytics.revenue.current)}
            </Text>
            <View
              style={[
                styles.changeIndicator,
                revenueChange.isPositive ? styles.changePositive : styles.changeNegative,
              ]}
            >
              {revenueChange.isPositive ? (
                <ArrowUpRight size={14} color="#059669" />
              ) : (
                <ArrowDownRight size={14} color="#dc2626" />
              )}
              <Text
                style={[
                  styles.changeText,
                  revenueChange.isPositive
                    ? styles.changeTextPositive
                    : styles.changeTextNegative,
                ]}
              >
                {revenueChange.value}%
              </Text>
            </View>
          </View>
          <Text style={styles.revenuePrevious}>
            vs {formatCurrency(analytics.revenue.previous)} período anterior
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#dbeafe' }]}>
              <CheckCircle2 size={18} color="#3b82f6" />
            </View>
            <Text style={styles.statValue}>{analytics.jobs.completed}</Text>
            <Text style={styles.statLabel}>Completados</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
              <Calendar size={18} color="#f59e0b" />
            </View>
            <Text style={styles.statValue}>{analytics.jobs.scheduled}</Text>
            <Text style={styles.statLabel}>Programados</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#fce7f3' }]}>
              <Star size={18} color="#ec4899" />
            </View>
            <Text style={styles.statValue}>{analytics.satisfaction.avgRating}</Text>
            <Text style={styles.statLabel}>Calificación</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#e0e7ff' }]}>
              <Clock size={18} color="#6366f1" />
            </View>
            <Text style={styles.statValue}>{analytics.jobs.avgCompletionTime}m</Text>
            <Text style={styles.statLabel}>Tiempo prom.</Text>
          </View>
        </View>

        {/* Weekly Trend */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tendencia semanal</Text>
            <BarChart3 size={18} color="#6b7280" />
          </View>
          <View style={styles.chartContainer}>
            <View style={styles.barChart}>
              {analytics.weeklyTrend.map((day, index) => (
                <View key={index} style={styles.barColumn}>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${(day.jobs / maxWeeklyJobs) * 100}%`,
                          backgroundColor:
                            index === analytics.weeklyTrend.length - 3
                              ? '#059669'
                              : '#d1d5db',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{day.day}</Text>
                </View>
              ))}
            </View>
            <View style={styles.chartLegend}>
              <Text style={styles.legendText}>
                Mejor día: Viernes ({analytics.weeklyTrend[4].jobs} trabajos)
              </Text>
            </View>
          </View>
        </View>

        {/* Service Type Breakdown */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Por tipo de servicio</Text>
            <PieChart size={18} color="#6b7280" />
          </View>
          <View style={styles.serviceList}>
            {analytics.serviceTypes.map((service, index) => (
              <View key={index} style={styles.serviceRow}>
                <View style={styles.serviceInfo}>
                  <View
                    style={[styles.serviceDot, { backgroundColor: service.color }]}
                  />
                  <Text style={styles.serviceName}>{service.type}</Text>
                </View>
                <View style={styles.serviceStats}>
                  <Text style={styles.serviceCount}>{service.count}</Text>
                  <View style={styles.serviceBarContainer}>
                    <View
                      style={[
                        styles.serviceBar,
                        {
                          width: `${(service.count / totalServiceJobs) * 100}%`,
                          backgroundColor: service.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.serviceRevenue}>
                    {formatCurrency(service.revenue)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Top Technicians */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top técnicos</Text>
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={() => router.push('/(tabs)/team')}
            >
              <Text style={styles.seeAllText}>Ver todos</Text>
              <ChevronRight size={16} color="#059669" />
            </TouchableOpacity>
          </View>
          <View style={styles.technicianList}>
            {analytics.technicians.map((tech, index) => (
              <View key={tech.id} style={styles.technicianRow}>
                <View style={styles.techRank}>
                  <Text
                    style={[
                      styles.techRankText,
                      index === 0 && styles.techRankFirst,
                    ]}
                  >
                    #{index + 1}
                  </Text>
                </View>
                <View style={styles.techInfo}>
                  <Text style={styles.techName}>{tech.name}</Text>
                  <View style={styles.techMeta}>
                    <View style={styles.techMetaItem}>
                      <Briefcase size={12} color="#6b7280" />
                      <Text style={styles.techMetaText}>{tech.jobs}</Text>
                    </View>
                    <View style={styles.techMetaItem}>
                      <Star size={12} color="#f59e0b" />
                      <Text style={styles.techMetaText}>{tech.rating}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.techRevenue}>{formatCurrency(tech.revenue)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Customer Satisfaction */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Satisfacción del cliente</Text>
            <Star size={18} color="#f59e0b" />
          </View>
          <View style={styles.satisfactionCard}>
            <View style={styles.satisfactionMain}>
              <Text style={styles.satisfactionScore}>
                {analytics.satisfaction.avgRating}
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={20}
                    color="#f59e0b"
                    fill={star <= Math.round(analytics.satisfaction.avgRating) ? '#f59e0b' : 'none'}
                  />
                ))}
              </View>
              <Text style={styles.reviewCount}>
                {analytics.satisfaction.totalReviews} reseñas
              </Text>
            </View>
            <View style={styles.satisfactionBreakdown}>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>5 estrellas</Text>
                <View style={styles.ratingBarContainer}>
                  <View
                    style={[
                      styles.ratingBar,
                      {
                        width: `${
                          (analytics.satisfaction.fiveStars /
                            analytics.satisfaction.totalReviews) *
                          100
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.ratingCount}>
                  {analytics.satisfaction.fiveStars}
                </Text>
              </View>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>4 estrellas</Text>
                <View style={styles.ratingBarContainer}>
                  <View
                    style={[
                      styles.ratingBar,
                      styles.ratingBarFour,
                      {
                        width: `${
                          (analytics.satisfaction.fourStars /
                            analytics.satisfaction.totalReviews) *
                          100
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.ratingCount}>
                  {analytics.satisfaction.fourStars}
                </Text>
              </View>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>3 o menos</Text>
                <View style={styles.ratingBarContainer}>
                  <View
                    style={[
                      styles.ratingBar,
                      styles.ratingBarLow,
                      {
                        width: `${
                          (analytics.satisfaction.threeOrLess /
                            analytics.satisfaction.totalReviews) *
                          100
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.ratingCount}>
                  {analytics.satisfaction.threeOrLess}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#059669',
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  // Revenue Card
  revenueCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revenueIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  revenueLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  revenueMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  revenueAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changePositive: {
    backgroundColor: '#ecfdf5',
  },
  changeNegative: {
    backgroundColor: '#fef2f2',
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  changeTextPositive: {
    color: '#059669',
  },
  changeTextNegative: {
    color: '#dc2626',
  },
  revenuePrevious: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'center',
  },
  // Section
  section: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#059669',
  },
  // Bar Chart
  chartContainer: {
    marginTop: 8,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 20,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    height: 80,
    width: 24,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 8,
  },
  chartLegend: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    alignItems: 'center',
  },
  legendText: {
    fontSize: 12,
    color: '#6b7280',
  },
  // Service Types
  serviceList: {
    gap: 12,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 100,
  },
  serviceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  serviceName: {
    fontSize: 13,
    color: '#374151',
  },
  serviceStats: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    width: 28,
    textAlign: 'center',
  },
  serviceBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  serviceBar: {
    height: '100%',
    borderRadius: 4,
  },
  serviceRevenue: {
    fontSize: 12,
    color: '#6b7280',
    width: 80,
    textAlign: 'right',
  },
  // Technicians
  technicianList: {
    gap: 12,
  },
  technicianRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  techRank: {
    width: 32,
  },
  techRankText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  techRankFirst: {
    color: '#f59e0b',
  },
  techInfo: {
    flex: 1,
  },
  techName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  techMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  techMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  techMetaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  techRevenue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  // Satisfaction
  satisfactionCard: {
    flexDirection: 'row',
    gap: 20,
  },
  satisfactionMain: {
    alignItems: 'center',
  },
  satisfactionScore: {
    fontSize: 48,
    fontWeight: '700',
    color: '#111827',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  satisfactionBreakdown: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#6b7280',
    width: 70,
  },
  ratingBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  ratingBarFour: {
    backgroundColor: '#34d399',
  },
  ratingBarLow: {
    backgroundColor: '#f59e0b',
  },
  ratingCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    width: 30,
    textAlign: 'right',
  },
  bottomPadding: {
    height: 100,
  },
});
