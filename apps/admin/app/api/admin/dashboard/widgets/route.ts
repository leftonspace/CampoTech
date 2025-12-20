/**
 * Admin Dashboard Widgets API
 * ===========================
 *
 * GET /api/admin/dashboard/widgets - Get admin's dashboard layout
 * PUT /api/admin/dashboard/widgets - Save dashboard layout
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { AdminDashboardLayout, DashboardWidgetConfig } from '@/types';

// Default widget configuration
const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  {
    id: 'revenue_summary',
    type: 'revenue_summary',
    title: 'Resumen de Ingresos',
    position: { x: 0, y: 0 },
    size: { width: 2, height: 1 },
    visible: true,
  },
  {
    id: 'tier_distribution',
    type: 'tier_distribution',
    title: 'Distribución por Plan',
    position: { x: 2, y: 0 },
    size: { width: 1, height: 1 },
    visible: true,
  },
  {
    id: 'mrr_trend',
    type: 'mrr_trend',
    title: 'Tendencia MRR',
    position: { x: 3, y: 0 },
    size: { width: 1, height: 1 },
    visible: true,
  },
  {
    id: 'verification_queue',
    type: 'verification_queue',
    title: 'Cola de Verificación',
    position: { x: 0, y: 1 },
    size: { width: 2, height: 1 },
    visible: true,
  },
  {
    id: 'recent_activity',
    type: 'recent_activity',
    title: 'Actividad Reciente',
    position: { x: 2, y: 1 },
    size: { width: 2, height: 1 },
    visible: true,
  },
  {
    id: 'pending_actions',
    type: 'pending_actions',
    title: 'Acciones Pendientes',
    position: { x: 0, y: 2 },
    size: { width: 4, height: 1 },
    visible: true,
  },
  {
    id: 'subscription_funnel',
    type: 'subscription_funnel',
    title: 'Embudo de Conversión',
    position: { x: 0, y: 3 },
    size: { width: 2, height: 1 },
    visible: false,
  },
  {
    id: 'system_health',
    type: 'system_health',
    title: 'Estado del Sistema',
    position: { x: 2, y: 3 },
    size: { width: 2, height: 1 },
    visible: false,
  },
];

// In-memory storage for demo (in production, use database)
const adminLayouts: Map<string, AdminDashboardLayout> = new Map();

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create layout for this admin
    let layout = adminLayouts.get(session.id);
    if (!layout) {
      layout = {
        adminId: session.id,
        widgets: DEFAULT_WIDGETS,
        updatedAt: new Date().toISOString(),
      };
      adminLayouts.set(session.id, layout);
    }

    return NextResponse.json({
      success: true,
      data: layout,
    });
  } catch (error) {
    console.error('Get dashboard layout error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching layout' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { widgets } = body;

    if (!widgets || !Array.isArray(widgets)) {
      return NextResponse.json(
        { success: false, error: 'Invalid widgets configuration' },
        { status: 400 }
      );
    }

    // Validate widgets
    const validatedWidgets: DashboardWidgetConfig[] = widgets.map((w: DashboardWidgetConfig) => ({
      id: w.id,
      type: w.type,
      title: w.title,
      position: {
        x: typeof w.position?.x === 'number' ? w.position.x : 0,
        y: typeof w.position?.y === 'number' ? w.position.y : 0,
      },
      size: {
        width: typeof w.size?.width === 'number' ? w.size.width : 1,
        height: typeof w.size?.height === 'number' ? w.size.height : 1,
      },
      visible: typeof w.visible === 'boolean' ? w.visible : true,
    }));

    const layout: AdminDashboardLayout = {
      adminId: session.id,
      widgets: validatedWidgets,
      updatedAt: new Date().toISOString(),
    };

    adminLayouts.set(session.id, layout);

    return NextResponse.json({
      success: true,
      data: layout,
      message: 'Dashboard layout saved',
    });
  } catch (error) {
    console.error('Save dashboard layout error:', error);
    return NextResponse.json(
      { success: false, error: 'Error saving layout' },
      { status: 500 }
    );
  }
}
