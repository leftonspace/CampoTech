/**
 * Analytics Reports API Route
 * ===========================
 *
 * Phase 10: Advanced Analytics & Reporting
 * Generate and export reports.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

import { generateReport, ReportData } from '../../../../../../src/analytics/reports/report-generator';
import { generatePDF } from '../../../../../../src/analytics/reports/exporters/pdf-exporter';
import { generateExcel } from '../../../../../../src/analytics/reports/exporters/excel-exporter';
import { generateCSV } from '../../../../../../src/analytics/reports/exporters/csv-exporter';
import { getAvailableTemplates, getDateRangeFromPreset } from '../../../../../../src/analytics/reports/templates/report-templates';

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/reports
// Returns available report templates
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = getAvailableTemplates();

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        availableFormats: t.availableFormats,
      })),
    });
  } catch (error) {
    console.error('Report templates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/analytics/reports
// Generate a report
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const body = await req.json();
    const {
      templateId,
      format = 'json',
      dateRangePreset = 'month',
      startDate,
      endDate,
    } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID required' },
        { status: 400 }
      );
    }

    // Determine date range
    let dateRange;
    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    } else {
      dateRange = getDateRangeFromPreset(dateRangePreset);
    }

    // Generate report
    const reportData = await generateReport({
      templateId,
      organizationId,
      dateRange,
    });

    // Return based on format
    switch (format) {
      case 'pdf': {
        const pdfBuffer = await generatePDF(reportData);
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'text/html',
            'Content-Disposition': `attachment; filename="${reportData.templateName}.html"`,
          },
        });
      }

      case 'excel': {
        const excelBuffer = await generateExcel(reportData);
        return new NextResponse(excelBuffer, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${reportData.templateName}.json"`,
          },
        });
      }

      case 'csv': {
        const csvBuffer = await generateCSV(reportData);
        return new NextResponse(csvBuffer, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${reportData.templateName}.csv"`,
          },
        });
      }

      default:
        return NextResponse.json(reportData);
    }
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
