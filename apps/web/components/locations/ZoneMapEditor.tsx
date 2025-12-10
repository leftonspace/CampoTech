'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Plus,
  Trash2,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  Layers,
} from 'lucide-react';

interface Point {
  lat: number;
  lng: number;
}

interface Zone {
  id: string;
  name: string;
  code: string;
  color: string;
  points: Point[];
  isActive: boolean;
}

interface ZoneMapEditorProps {
  zones: Zone[];
  center: Point;
  locationRadius?: number;
  onZoneUpdate?: (zoneId: string, points: Point[]) => void;
  onZoneCreate?: (points: Point[]) => void;
  selectedZoneId?: string;
  onZoneSelect?: (zoneId: string | null) => void;
  className?: string;
  readOnly?: boolean;
}

// Simple canvas-based zone editor
export function ZoneMapEditor({
  zones,
  center,
  locationRadius = 10,
  onZoneUpdate,
  onZoneCreate,
  selectedZoneId,
  onZoneSelect,
  className,
  readOnly = false,
}: ZoneMapEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<'select' | 'draw' | 'edit'>('select');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [newPoints, setNewPoints] = useState<Point[]>([]);
  const [showLabels, setShowLabels] = useState(true);

  // Convert lat/lng to canvas coordinates
  const toCanvasCoords = useCallback(
    (point: Point, canvasWidth: number, canvasHeight: number) => {
      const scale = Math.min(canvasWidth, canvasHeight) / (locationRadius * 2);
      const x = (point.lng - center.lng) * scale * zoom + canvasWidth / 2 + offset.x;
      const y = (center.lat - point.lat) * scale * zoom + canvasHeight / 2 + offset.y;
      return { x, y };
    },
    [center, locationRadius, zoom, offset]
  );

  // Convert canvas coordinates to lat/lng
  const toLatLng = useCallback(
    (x: number, y: number, canvasWidth: number, canvasHeight: number): Point => {
      const scale = Math.min(canvasWidth, canvasHeight) / (locationRadius * 2);
      const lng = (x - canvasWidth / 2 - offset.x) / (scale * zoom) + center.lng;
      const lat = center.lat - (y - canvasHeight / 2 - offset.y) / (scale * zoom);
      return { lat, lng };
    },
    [center, locationRadius, zoom, offset]
  );

  // Draw the map
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { width, height } = canvas;

    // Clear canvas
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridSize = 50 * zoom;
    for (let x = offset.x % gridSize; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = offset.y % gridSize; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw location center
    const centerCoords = toCanvasCoords(center, width, height);
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(centerCoords.x, centerCoords.y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw location radius circle
    const scale = Math.min(width, height) / (locationRadius * 2);
    const radiusPixels = locationRadius * scale * zoom * 0.001; // km to degrees approximation
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(centerCoords.x, centerCoords.y, radiusPixels * 111, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw zones
    zones.forEach((zone) => {
      if (zone.points.length < 2) return;

      const isSelected = zone.id === selectedZoneId;
      const coords = zone.points.map((p) => toCanvasCoords(p, width, height));

      // Fill
      ctx.fillStyle = zone.isActive
        ? `${zone.color}40`
        : '#9ca3af40';
      ctx.beginPath();
      ctx.moveTo(coords[0].x, coords[0].y);
      coords.slice(1).forEach((c) => ctx.lineTo(c.x, c.y));
      ctx.closePath();
      ctx.fill();

      // Stroke
      ctx.strokeStyle = isSelected ? '#1d4ed8' : zone.isActive ? zone.color : '#9ca3af';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(coords[0].x, coords[0].y);
      coords.slice(1).forEach((c) => ctx.lineTo(c.x, c.y));
      ctx.closePath();
      ctx.stroke();

      // Draw points if selected
      if (isSelected && !readOnly) {
        coords.forEach((c, i) => {
          ctx.fillStyle = '#1d4ed8';
          ctx.beginPath();
          ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw label
      if (showLabels) {
        const centroid = coords.reduce(
          (acc, c) => ({ x: acc.x + c.x / coords.length, y: acc.y + c.y / coords.length }),
          { x: 0, y: 0 }
        );
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1f2937';
        ctx.fillText(zone.name, centroid.x, centroid.y);
      }
    });

    // Draw new points being created
    if (newPoints.length > 0) {
      const coords = newPoints.map((p) => toCanvasCoords(p, width, height));

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(coords[0].x, coords[0].y);
      coords.slice(1).forEach((c) => ctx.lineTo(c.x, c.y));
      ctx.stroke();
      ctx.setLineDash([]);

      coords.forEach((c) => {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [zones, center, locationRadius, zoom, offset, selectedZoneId, newPoints, showLabels, readOnly, toCanvasCoords]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  // Redraw when dependencies change
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'select') {
      // Check if clicked on a zone
      for (const zone of zones) {
        if (zone.points.length < 3) continue;
        const coords = zone.points.map((p) => toCanvasCoords(p, canvas.width, canvas.height));
        if (isPointInPolygon({ x, y }, coords)) {
          onZoneSelect?.(zone.id);
          return;
        }
      }
      onZoneSelect?.(null);
    } else if (tool === 'draw' && !readOnly) {
      const point = toLatLng(x, y, canvas.width, canvas.height);
      setNewPoints([...newPoints, point]);
    }
  };

  // Handle mouse down for panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'select' && e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Helper: check if point is in polygon
  const isPointInPolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const handleZoom = (delta: number) => {
    setZoom((z) => Math.max(0.5, Math.min(3, z + delta)));
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleFinishDrawing = () => {
    if (newPoints.length >= 3) {
      onZoneCreate?.(newPoints);
    }
    setNewPoints([]);
    setTool('select');
  };

  const handleCancelDrawing = () => {
    setNewPoints([]);
    setTool('select');
  };

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center justify-between border-b bg-white p-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTool('select')}
              className={cn(
                'rounded-md p-2 text-sm',
                tool === 'select'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
              title="Seleccionar / Mover"
            >
              <Move className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTool('draw')}
              className={cn(
                'rounded-md p-2 text-sm',
                tool === 'draw'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
              title="Dibujar zona"
            >
              <Plus className="h-4 w-4" />
            </button>
            {selectedZoneId && (
              <button
                onClick={() => {
                  // Delete functionality would go here
                }}
                className="rounded-md p-2 text-red-600 hover:bg-red-50"
                title="Eliminar zona"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={cn(
                'rounded-md p-2 text-sm',
                showLabels ? 'text-primary-600' : 'text-gray-400'
              )}
              title="Mostrar etiquetas"
            >
              <Layers className="h-4 w-4" />
            </button>
            <div className="mx-2 h-4 w-px bg-gray-200" />
            <button
              onClick={() => handleZoom(-0.25)}
              className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
              title="Alejar"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-12 text-center text-sm text-gray-600">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => handleZoom(0.25)}
              className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
              title="Acercar"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={handleReset}
              className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
              title="Restablecer vista"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1 min-h-[400px]">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            'w-full h-full',
            tool === 'select' && 'cursor-grab',
            tool === 'draw' && 'cursor-crosshair',
            isDragging && 'cursor-grabbing'
          )}
        />

        {/* Drawing mode overlay */}
        {tool === 'draw' && newPoints.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-lg">
            <span className="text-sm text-gray-600">
              {newPoints.length} puntos - Mínimo 3 para crear zona
            </span>
            <button
              onClick={handleFinishDrawing}
              disabled={newPoints.length < 3}
              className="btn-primary text-sm py-1 px-3"
            >
              <Save className="mr-1 h-3 w-3" />
              Guardar
            </button>
            <button
              onClick={handleCancelDrawing}
              className="btn-secondary text-sm py-1 px-3"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Help text */}
        {!readOnly && tool === 'draw' && newPoints.length === 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-white/90 px-4 py-2 shadow-lg">
            <p className="text-sm text-gray-600">
              Haz clic en el mapa para agregar puntos de la zona
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      {zones.length > 0 && (
        <div className="border-t bg-white p-2">
          <div className="flex flex-wrap gap-3">
            {zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => onZoneSelect?.(zone.id === selectedZoneId ? null : zone.id)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1 text-sm',
                  zone.id === selectedZoneId
                    ? 'bg-gray-100 ring-2 ring-primary-500'
                    : 'hover:bg-gray-50'
                )}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: zone.color }}
                />
                <span className={cn(!zone.isActive && 'text-gray-400')}>
                  {zone.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ZoneMapEditor;
