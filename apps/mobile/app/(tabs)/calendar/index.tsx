/**
 * Calendar/Schedule Screen - Enhanced for Dispatchers
 * ====================================================
 *
 * Phase 2.4.3: Schedule Overview
 * - Day/Week view toggle
 * - Visual time grid with jobs
 * - Technician color coding
 * - Job assignment/reassignment
 * - Week stats summary
 */

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  User,
  AlertCircle,
  Calendar,
  LayoutGrid,
  X,
  Check,
  Users,
} from 'lucide-react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../../lib/db';
import { Job } from '../../../lib/db/models/Job';
import { useAuth } from '../../../lib/providers/auth';
import { useSyncQueue } from '../../../lib/hooks/use-offline';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Technician colors for visual distinction
const TECHNICIAN_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_FULL_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Working hours for time grid
const WORK_HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 - 18:00

interface Technician {
  id: string;
  name: string;
  color: string;
}

// Mock technicians - in production from WatermelonDB
const MOCK_TECHNICIANS: Technician[] = [
  { id: 'tech1', name: 'Carlos R.', color: TECHNICIAN_COLORS[0] },
  { id: 'tech2', name: 'Miguel S.', color: TECHNICIAN_COLORS[1] },
  { id: 'tech3', name: 'Juan P.', color: TECHNICIAN_COLORS[2] },
  { id: 'tech4', name: 'Diego M.', color: TECHNICIAN_COLORS[3] },
];

type ViewMode = 'day' | 'week';

interface ScheduleScreenProps {
  jobs: Job[];
}

function ScheduleScreen({ jobs }: ScheduleScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { enqueueOperation } = useSyncQueue();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [technicians] = useState<Technician[]>(MOCK_TECHNICIANS);

  // Get week start (Monday)
  const weekStart = useMemo(() => {
    const date = new Date(selectedDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }, [selectedDate]);

  // Get week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });
  }, [weekStart]);

  // Filter jobs for selected date/week
  const filteredJobs = useMemo(() => {
    if (viewMode === 'day') {
      return jobs.filter((job) => {
        const jobDate = new Date(job.scheduledDate);
        return (
          jobDate.getDate() === selectedDate.getDate() &&
          jobDate.getMonth() === selectedDate.getMonth() &&
          jobDate.getFullYear() === selectedDate.getFullYear()
        );
      });
    } else {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return jobs.filter((job) => {
        const jobDate = new Date(job.scheduledDate);
        return jobDate >= weekStart && jobDate < weekEnd;
      });
    }
  }, [jobs, selectedDate, viewMode, weekStart]);

  // Jobs by day for week view
  const jobsByDay = useMemo(() => {
    const map: Record<string, Job[]> = {};
    weekDays.forEach((day) => {
      const key = day.toISOString().split('T')[0];
      map[key] = filteredJobs.filter((job) => {
        const jobDate = new Date(job.scheduledDate);
        return (
          jobDate.getDate() === day.getDate() &&
          jobDate.getMonth() === day.getMonth() &&
          jobDate.getFullYear() === day.getFullYear()
        );
      });
    });
    return map;
  }, [weekDays, filteredJobs]);

  // Week stats
  const weekStats = useMemo(() => {
    const allWeekJobs = Object.values(jobsByDay).flat();
    return {
      total: allWeekJobs.length,
      assigned: allWeekJobs.filter((j) => j.assignedToId).length,
      unassigned: allWeekJobs.filter((j) => !j.assignedToId).length,
      completed: allWeekJobs.filter((j) => j.status === 'completed').length,
    };
  }, [jobsByDay]);

  const isToday = useCallback((date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }, []);

  const isSelected = useCallback((date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  }, [selectedDate]);

  const formattedDate = useMemo(() => {
    const day = DAYS_ES[selectedDate.getDay()];
    const date = selectedDate.getDate();
    const month = MONTHS_ES[selectedDate.getMonth()];
    return `${day} ${date} ${month}`;
  }, [selectedDate]);

  const formattedWeek = useMemo(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startMonth = MONTHS_ES[weekStart.getMonth()];
    const endMonth = MONTHS_ES[weekEnd.getMonth()];
    if (startMonth === endMonth) {
      return `${weekStart.getDate()} - ${weekEnd.getDate()} ${startMonth}`;
    }
    return `${weekStart.getDate()} ${startMonth} - ${weekEnd.getDate()} ${endMonth}`;
  }, [weekStart]);

  const navigate = (direction: number) => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else {
      newDate.setDate(newDate.getDate() + direction * 7);
    }
    setSelectedDate(newDate);
  };

  const goToToday = () => setSelectedDate(new Date());

  const handleCreateJob = () => router.push('/jobs/create');

  const handleJobPress = (job: Job) => {
    router.push(`/jobs/${job.id}`);
  };

  const handleAssignJob = (job: Job) => {
    setSelectedJob(job);
    setShowAssignModal(true);
  };

  const assignTechnician = async (technicianId: string) => {
    if (!selectedJob) return;

    try {
      await database.write(async () => {
        await selectedJob.update((j) => {
          j.assignedToId = technicianId;
        });
      });

      enqueueOperation({
        type: 'UPDATE',
        table: 'jobs',
        recordId: selectedJob.id,
        data: { assigned_to_id: technicianId },
      });
    } catch (error) {
      console.error('Failed to assign technician:', error);
    }

    setShowAssignModal(false);
    setSelectedJob(null);
  };

  const getTechnicianColor = (techId: string | null): string => {
    if (!techId) return '#9ca3af';
    const tech = technicians.find((t) => t.id === techId);
    return tech?.color || '#9ca3af';
  };

  const getTechnicianName = (techId: string | null): string => {
    if (!techId) return 'Sin asignar';
    const tech = technicians.find((t) => t.id === techId);
    return tech?.name || 'Desconocido';
  };

  const getJobTime = (job: Job): string => {
    const date = new Date(job.scheduledDate);
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const getJobHour = (job: Job): number => {
    const date = new Date(job.scheduledDate);
    return date.getHours();
  };

  // Render time grid for day view
  const renderTimeGrid = () => {
    return (
      <View style={styles.timeGrid}>
        {WORK_HOURS.map((hour) => {
          const hourJobs = filteredJobs.filter((j) => getJobHour(j) === hour);
          return (
            <View key={hour} style={styles.timeRow}>
              <View style={styles.timeLabel}>
                <Text style={styles.timeLabelText}>
                  {hour.toString().padStart(2, '0')}:00
                </Text>
              </View>
              <View style={styles.timeSlot}>
                {hourJobs.map((job) => (
                  <TouchableOpacity
                    key={job.id}
                    style={[
                      styles.timeSlotJob,
                      { borderLeftColor: getTechnicianColor(job.assignedToId) },
                    ]}
                    onPress={() => handleJobPress(job)}
                    onLongPress={() => handleAssignJob(job)}
                  >
                    <View style={styles.timeSlotJobHeader}>
                      <Text style={styles.timeSlotJobTime}>{getJobTime(job)}</Text>
                      {!job.assignedToId && (
                        <AlertCircle size={14} color="#f59e0b" />
                      )}
                    </View>
                    <Text style={styles.timeSlotJobTitle} numberOfLines={1}>
                      {job.serviceType}
                    </Text>
                    <Text style={styles.timeSlotJobTech}>
                      {getTechnicianName(job.assignedToId)}
                    </Text>
                  </TouchableOpacity>
                ))}
                {hourJobs.length === 0 && (
                  <View style={styles.emptySlot} />
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Render week view
  const renderWeekView = () => {
    return (
      <View style={styles.weekView}>
        {/* Week header */}
        <View style={styles.weekHeader}>
          {weekDays.map((day, index) => {
            const dayKey = day.toISOString().split('T')[0];
            const dayJobs = jobsByDay[dayKey] || [];
            const hasUnassigned = dayJobs.some((j) => !j.assignedToId);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekDay,
                  isSelected(day) && styles.weekDaySelected,
                  isToday(day) && styles.weekDayToday,
                ]}
                onPress={() => setSelectedDate(day)}
              >
                <Text
                  style={[
                    styles.weekDayName,
                    isSelected(day) && styles.weekDayTextSelected,
                  ]}
                >
                  {DAYS_ES[day.getDay()]}
                </Text>
                <Text
                  style={[
                    styles.weekDayNumber,
                    isSelected(day) && styles.weekDayTextSelected,
                    isToday(day) && styles.weekDayNumberToday,
                  ]}
                >
                  {day.getDate()}
                </Text>
                <View style={styles.weekDayIndicators}>
                  {dayJobs.length > 0 && (
                    <View style={styles.weekDayJobCount}>
                      <Text style={styles.weekDayJobCountText}>
                        {dayJobs.length}
                      </Text>
                    </View>
                  )}
                  {hasUnassigned && (
                    <View style={styles.weekDayWarning} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day jobs */}
        <ScrollView style={styles.weekDayJobs}>
          <Text style={styles.weekDayTitle}>
            {DAYS_FULL_ES[selectedDate.getDay()]} {selectedDate.getDate()}
          </Text>

          {filteredJobs
            .filter((job) => {
              const jobDate = new Date(job.scheduledDate);
              return isSelected(jobDate);
            })
            .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
            .map((job) => (
              <TouchableOpacity
                key={job.id}
                style={[
                  styles.weekJobCard,
                  { borderLeftColor: getTechnicianColor(job.assignedToId) },
                ]}
                onPress={() => handleJobPress(job)}
                onLongPress={() => handleAssignJob(job)}
              >
                <View style={styles.weekJobHeader}>
                  <Text style={styles.weekJobTime}>{getJobTime(job)}</Text>
                  <Text style={styles.weekJobDuration}>
                    {job.estimatedDuration || 60} min
                  </Text>
                </View>
                <Text style={styles.weekJobTitle}>{job.serviceType}</Text>
                <View style={styles.weekJobFooter}>
                  <View
                    style={[
                      styles.weekJobTechBadge,
                      { backgroundColor: getTechnicianColor(job.assignedToId) + '20' },
                    ]}
                  >
                    <User size={12} color={getTechnicianColor(job.assignedToId)} />
                    <Text
                      style={[
                        styles.weekJobTechText,
                        { color: getTechnicianColor(job.assignedToId) },
                      ]}
                    >
                      {getTechnicianName(job.assignedToId)}
                    </Text>
                  </View>
                  {!job.assignedToId && (
                    <TouchableOpacity
                      style={styles.quickAssignButton}
                      onPress={() => handleAssignJob(job)}
                    >
                      <Text style={styles.quickAssignText}>Asignar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}

          {filteredJobs.filter((job) => {
            const jobDate = new Date(job.scheduledDate);
            return isSelected(jobDate);
          }).length === 0 && (
            <View style={styles.noJobsDay}>
              <Clock size={32} color="#d1d5db" />
              <Text style={styles.noJobsDayText}>Sin trabajos este día</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // Render job card for day list view
  const renderJobCard = ({ item: job }: { item: Job }) => {
    return (
      <TouchableOpacity
        style={[
          styles.jobCard,
          { borderLeftColor: getTechnicianColor(job.assignedToId) },
        ]}
        onPress={() => handleJobPress(job)}
        onLongPress={() => handleAssignJob(job)}
      >
        <View style={styles.jobTime}>
          <Text style={styles.jobTimeText}>{getJobTime(job)}</Text>
          <Text style={styles.jobDuration}>
            {job.estimatedDuration || 60} min
          </Text>
        </View>

        <View style={styles.jobContent}>
          <View style={styles.jobHeader}>
            <Text style={styles.jobTitle}>{job.serviceType}</Text>
            {!job.assignedToId && (
              <View style={styles.warningBadge}>
                <AlertCircle size={12} color="#f59e0b" />
              </View>
            )}
          </View>

          <View style={styles.jobDetail}>
            <MapPin size={12} color="#6b7280" />
            <Text style={styles.jobDetailText} numberOfLines={1}>
              {job.address || 'Sin dirección'}
            </Text>
          </View>

          <View style={styles.jobAssignment}>
            <View
              style={[
                styles.technicianBadge,
                { backgroundColor: getTechnicianColor(job.assignedToId) + '20' },
              ]}
            >
              <User size={12} color={getTechnicianColor(job.assignedToId)} />
              <Text
                style={[
                  styles.technicianText,
                  { color: getTechnicianColor(job.assignedToId) },
                ]}
              >
                {getTechnicianName(job.assignedToId)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.reassignButton}
              onPress={() => handleAssignJob(job)}
            >
              <Users size={14} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.dateNav}>
          <TouchableOpacity style={styles.navButton} onPress={() => navigate(-1)}>
            <ChevronLeft size={24} color="#374151" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.dateButton} onPress={goToToday}>
            <Text style={styles.dateText}>
              {viewMode === 'day' ? formattedDate : formattedWeek}
            </Text>
            {isToday(selectedDate) && viewMode === 'day' && (
              <Text style={styles.todayBadge}>Hoy</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.navButton} onPress={() => navigate(1)}>
            <ChevronRight size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          {/* View Toggle */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[
                styles.viewToggleButton,
                viewMode === 'day' && styles.viewToggleButtonActive,
              ]}
              onPress={() => setViewMode('day')}
            >
              <Calendar size={16} color={viewMode === 'day' ? '#fff' : '#6b7280'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewToggleButton,
                viewMode === 'week' && styles.viewToggleButtonActive,
              ]}
              onPress={() => setViewMode('week')}
            >
              <LayoutGrid size={16} color={viewMode === 'week' ? '#fff' : '#6b7280'} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.addButton} onPress={handleCreateJob}>
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {viewMode === 'day' ? filteredJobs.length : weekStats.total}
          </Text>
          <Text style={styles.statLabel}>Trabajos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {viewMode === 'day'
              ? filteredJobs.filter((j) => j.assignedToId).length
              : weekStats.assigned}
          </Text>
          <Text style={styles.statLabel}>Asignados</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, styles.statWarning]}>
            {viewMode === 'day'
              ? filteredJobs.filter((j) => !j.assignedToId).length
              : weekStats.unassigned}
          </Text>
          <Text style={styles.statLabel}>Sin asignar</Text>
        </View>
        {viewMode === 'week' && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, styles.statSuccess]}>
                {weekStats.completed}
              </Text>
              <Text style={styles.statLabel}>Completados</Text>
            </View>
          </>
        )}
      </View>

      {/* Content */}
      {viewMode === 'day' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {filteredJobs.length === 0 ? (
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
            renderTimeGrid()
          )}
          <View style={styles.bottomPadding} />
        </ScrollView>
      ) : (
        renderWeekView()
      )}

      {/* Technician Legend */}
      <View style={styles.legend}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {technicians.map((tech) => (
            <View key={tech.id} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: tech.color }]} />
              <Text style={styles.legendText}>{tech.name}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9ca3af' }]} />
            <Text style={styles.legendText}>Sin asignar</Text>
          </View>
        </ScrollView>
      </View>

      {/* Assignment Modal */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Asignar técnico</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowAssignModal(false)}
              >
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedJob && (
              <View style={styles.modalJobInfo}>
                <Text style={styles.modalJobTitle}>{selectedJob.serviceType}</Text>
                <Text style={styles.modalJobTime}>
                  {new Date(selectedJob.scheduledDate).toLocaleDateString('es-AR')} - {getJobTime(selectedJob)}
                </Text>
              </View>
            )}

            <ScrollView style={styles.technicianList}>
              {technicians.map((tech) => (
                <TouchableOpacity
                  key={tech.id}
                  style={styles.technicianOption}
                  onPress={() => assignTechnician(tech.id)}
                >
                  <View style={styles.technicianOptionLeft}>
                    <View
                      style={[
                        styles.technicianAvatar,
                        { backgroundColor: tech.color },
                      ]}
                    >
                      <Text style={styles.technicianAvatarText}>
                        {tech.name.charAt(0)}
                      </Text>
                    </View>
                    <Text style={styles.technicianOptionName}>{tech.name}</Text>
                  </View>
                  {selectedJob?.assignedToId === tech.id && (
                    <Check size={20} color="#059669" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedJob?.assignedToId && (
              <TouchableOpacity
                style={styles.unassignButton}
                onPress={() => assignTechnician('')}
              >
                <Text style={styles.unassignButtonText}>Quitar asignación</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// WatermelonDB enhancement
const enhance = withObservables([], () => ({
  jobs: database
    .get<Job>('jobs')
    .query(Q.sortBy('scheduled_date', Q.asc))
    .observe(),
}));

const EnhancedScheduleScreen = enhance(ScheduleScreen);

// Wrapper for auth context
export default function ScheduleScreenWrapper() {
  return <EnhancedScheduleScreen />;
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
    flex: 1,
  },
  navButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 16,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  viewToggleButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  viewToggleButtonActive: {
    backgroundColor: '#059669',
  },
  addButton: {
    width: 36,
    height: 36,
    backgroundColor: '#059669',
    borderRadius: 18,
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
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statWarning: {
    color: '#f59e0b',
  },
  statSuccess: {
    color: '#059669',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
  },
  content: {
    flex: 1,
  },
  // Time grid styles
  timeGrid: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  timeRow: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  timeLabel: {
    width: 50,
    paddingTop: 8,
  },
  timeLabelText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  timeSlot: {
    flex: 1,
    paddingVertical: 4,
    gap: 4,
  },
  emptySlot: {
    flex: 1,
  },
  timeSlotJob: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    padding: 8,
    marginRight: 8,
  },
  timeSlotJobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeSlotJobTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  timeSlotJobTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    marginTop: 2,
  },
  timeSlotJobTech: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  // Week view styles
  weekView: {
    flex: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDaySelected: {
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  weekDayToday: {
    borderWidth: 2,
    borderColor: '#059669',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  weekDayName: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 2,
  },
  weekDayNumberToday: {
    color: '#059669',
  },
  weekDayTextSelected: {
    color: '#059669',
  },
  weekDayIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  weekDayJobCount: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  weekDayJobCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  weekDayWarning: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  weekDayJobs: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  weekDayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  weekJobCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 8,
  },
  weekJobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekJobTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  weekJobDuration: {
    fontSize: 12,
    color: '#9ca3af',
  },
  weekJobTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginTop: 4,
  },
  weekJobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  weekJobTechBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  weekJobTechText: {
    fontSize: 12,
    fontWeight: '500',
  },
  quickAssignButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickAssignText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  noJobsDay: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noJobsDayText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  // Job card styles (day list view)
  jobCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  jobTime: {
    width: 65,
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobTimeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  jobDuration: {
    fontSize: 10,
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
    fontSize: 15,
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
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  jobAssignment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  technicianBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  technicianText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reassignButton: {
    width: 28,
    height: 28,
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Legend
  legend: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6b7280',
  },
  // Empty state
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalJobInfo: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalJobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  modalJobTime: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  technicianList: {
    padding: 16,
  },
  technicianOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  technicianOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  technicianAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  technicianAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  technicianOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  unassignButton: {
    margin: 16,
    paddingVertical: 14,
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    alignItems: 'center',
  },
  unassignButtonText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
});
