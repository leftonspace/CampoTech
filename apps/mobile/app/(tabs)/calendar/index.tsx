/**
 * Calendar/Schedule Screen
 * ========================
 *
 * Phase 9.10: Mobile-First Architecture
 * Day view calendar with job scheduling
 */

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  User,
  AlertCircle,
} from 'lucide-react-native';

// Mock job data
const MOCK_JOBS = [
  {
    id: '1',
    time: '09:00',
    duration: 120,
    title: 'Instalación split',
    customer: 'María López',
    address: 'Av. Santa Fe 1234, Palermo',
    technician: 'Carlos R.',
    status: 'scheduled',
  },
  {
    id: '2',
    time: '12:00',
    duration: 60,
    title: 'Reparación aire',
    customer: 'Pedro García',
    address: 'Calle Florida 567, Belgrano',
    technician: null,
    status: 'pending',
  },
  {
    id: '3',
    time: '16:00',
    duration: 90,
    title: 'Mantenimiento preventivo',
    customer: 'Ana Ruiz',
    address: 'Juncal 890, Recoleta',
    technician: 'Carlos R.',
    status: 'scheduled',
  },
];

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Job {
  id: string;
  time: string;
  duration: number;
  title: string;
  customer: string;
  address: string;
  technician: string | null;
  status: string;
}

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [jobs] = useState<Job[]>(MOCK_JOBS);

  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  const formattedDate = useMemo(() => {
    const day = DAYS_ES[selectedDate.getDay()];
    const date = selectedDate.getDate();
    const month = MONTHS_ES[selectedDate.getMonth()];
    return `${day} ${date} ${month}`;
  }, [selectedDate]);

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleCreateJob = () => {
    router.push('/jobs/create');
  };

  const handleJobPress = (jobId: string) => {
    router.push(`/jobs/${jobId}`);
  };

  const handleAssignToMe = (jobId: string) => {
    // In production, this would call the API
    console.log('Assign to me:', jobId);
  };

  const renderJob = (job: Job) => {
    const hasNoTechnician = !job.technician;

    return (
      <TouchableOpacity
        key={job.id}
        style={styles.jobCard}
        onPress={() => handleJobPress(job.id)}
      >
        <View style={styles.jobTime}>
          <Text style={styles.jobTimeText}>{job.time}</Text>
          <Text style={styles.jobDuration}>{job.duration} min</Text>
        </View>

        <View style={styles.jobContent}>
          <View style={styles.jobHeader}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            {hasNoTechnician && (
              <View style={styles.warningBadge}>
                <AlertCircle size={12} color="#f59e0b" />
              </View>
            )}
          </View>

          <View style={styles.jobDetail}>
            <User size={12} color="#6b7280" />
            <Text style={styles.jobDetailText}>{job.customer}</Text>
          </View>

          <View style={styles.jobDetail}>
            <MapPin size={12} color="#6b7280" />
            <Text style={styles.jobDetailText} numberOfLines={1}>
              {job.address}
            </Text>
          </View>

          {job.technician ? (
            <View style={styles.technicianBadge}>
              <Text style={styles.technicianText}>{job.technician}</Text>
            </View>
          ) : (
            <View style={styles.assignButtons}>
              <TouchableOpacity
                style={styles.assignButton}
                onPress={() => handleAssignToMe(job.id)}
              >
                <Text style={styles.assignButtonText}>Asignarme</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.assignOtherButton}>
                <Text style={styles.assignOtherButtonText}>Asignar otro</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.dateNav}>
          <TouchableOpacity style={styles.navButton} onPress={goToPreviousDay}>
            <ChevronLeft size={24} color="#374151" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.dateButton} onPress={goToToday}>
            <Text style={styles.dateText}>{formattedDate}</Text>
            {isToday && <Text style={styles.todayBadge}>Hoy</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.navButton} onPress={goToNextDay}>
            <ChevronRight size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleCreateJob}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{jobs.length}</Text>
          <Text style={styles.statLabel}>Trabajos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {jobs.filter((j) => j.technician).length}
          </Text>
          <Text style={styles.statLabel}>Asignados</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, styles.statWarning]}>
            {jobs.filter((j) => !j.technician).length}
          </Text>
          <Text style={styles.statLabel}>Sin asignar</Text>
        </View>
      </View>

      {/* Jobs List */}
      <ScrollView style={styles.jobsList} showsVerticalScrollIndicator={false}>
        {jobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Sin trabajos</Text>
            <Text style={styles.emptySubtitle}>
              No hay trabajos programados para este día
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleCreateJob}
            >
              <Plus size={16} color="#fff" />
              <Text style={styles.emptyButtonText}>Nuevo trabajo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          jobs.map(renderJob)
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Quick Navigation */}
      <View style={styles.quickNav}>
        <TouchableOpacity style={styles.quickNavButton} onPress={goToPreviousDay}>
          <ChevronLeft size={16} color="#374151" />
          <Text style={styles.quickNavText}>Ayer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickNavButton, isToday && styles.quickNavButtonActive]}
          onPress={goToToday}
        >
          <Text
            style={[
              styles.quickNavText,
              isToday && styles.quickNavTextActive,
            ]}
          >
            Hoy
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickNavButton} onPress={goToNextDay}>
          <Text style={styles.quickNavText}>Mañana</Text>
          <ChevronRight size={16} color="#374151" />
        </TouchableOpacity>
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  todayBadge: {
    backgroundColor: '#059669',
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: '#059669',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statWarning: {
    color: '#f59e0b',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
  },
  jobsList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  jobCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  jobTime: {
    width: 70,
    backgroundColor: '#f9fafb',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  jobTimeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  jobDuration: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  jobContent: {
    flex: 1,
    padding: 12,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  warningBadge: {
    width: 20,
    height: 20,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  jobDetailText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  technicianBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  technicianText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  assignButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  assignButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  assignOtherButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  assignOtherButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  bottomPadding: {
    height: 80,
  },
  quickNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  quickNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickNavButtonActive: {
    backgroundColor: '#059669',
  },
  quickNavText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  quickNavTextActive: {
    color: '#fff',
  },
});
