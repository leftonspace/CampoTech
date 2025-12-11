/**
 * Service Types API Route
 * Returns available service types for the organization
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Placeholder service types - these should come from database
    const serviceTypes = [
      { id: 'plomeria', name: 'Plomería', color: '#3B82F6' },
      { id: 'electricidad', name: 'Electricidad', color: '#F59E0B' },
      { id: 'gas', name: 'Gas', color: '#EF4444' },
      { id: 'calefaccion', name: 'Calefacción', color: '#8B5CF6' },
      { id: 'refrigeracion', name: 'Refrigeración', color: '#06B6D4' },
      { id: 'albanileria', name: 'Albañilería', color: '#84CC16' },
      { id: 'pintura', name: 'Pintura', color: '#EC4899' },
      { id: 'carpinteria', name: 'Carpintería', color: '#F97316' },
      { id: 'otro', name: 'Otro', color: '#6B7280' },
    ];

    return NextResponse.json({
      success: true,
      data: serviceTypes,
    });
  } catch (error) {
    console.error('Service types error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service types' },
      { status: 500 }
    );
  }
}
