/**
 * Marker Animation Utilities
 * ==========================
 *
 * Phase 9.9: Customer Live Tracking System
 * Provides smooth marker animations for live tracking maps.
 */

export interface Position {
  lat: number;
  lng: number;
}

export interface AnimationOptions {
  duration?: number;
  easing?: 'linear' | 'easeInOut' | 'easeOut';
}

/**
 * Easing functions for smooth animations
 */
const easingFunctions = {
  linear: (t: number) => t,
  easeInOut: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
};

/**
 * Calculate intermediate position for animation
 */
export function interpolatePosition(
  start: Position,
  end: Position,
  progress: number,
  easing: keyof typeof easingFunctions = 'easeOut'
): Position {
  const easedProgress = easingFunctions[easing](progress);

  return {
    lat: start.lat + (end.lat - start.lat) * easedProgress,
    lng: start.lng + (end.lng - start.lng) * easedProgress,
  };
}

/**
 * Calculate bearing (direction) between two points
 */
export function calculateBearing(from: Position, to: Position): number {
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return bearing;
}

/**
 * Animate marker from one position to another
 */
export function animateMarker(
  startPosition: Position,
  endPosition: Position,
  onUpdate: (position: Position, bearing: number) => void,
  onComplete?: () => void,
  options: AnimationOptions = {}
): () => void {
  const { duration = 1000, easing = 'easeOut' } = options;

  const startTime = performance.now();
  const bearing = calculateBearing(startPosition, endPosition);
  let animationFrame: number;

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const currentPosition = interpolatePosition(
      startPosition,
      endPosition,
      progress,
      easing
    );

    onUpdate(currentPosition, bearing);

    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }
  };

  animationFrame = requestAnimationFrame(animate);

  // Return cancel function
  return () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  };
}

/**
 * Smooth position tracking with prediction
 * Uses velocity to predict next position for smoother updates
 */
export class PositionTracker {
  private positions: Array<{ position: Position; timestamp: number }> = [];
  private maxHistory = 5;

  addPosition(position: Position): void {
    this.positions.push({
      position,
      timestamp: Date.now(),
    });

    // Keep only recent history
    if (this.positions.length > this.maxHistory) {
      this.positions.shift();
    }
  }

  /**
   * Get estimated current position based on velocity
   */
  getEstimatedPosition(): Position | null {
    if (this.positions.length < 2) {
      return this.positions[0]?.position || null;
    }

    const lastTwo = this.positions.slice(-2);
    const [prev, current] = lastTwo;

    const timeDelta = (Date.now() - current.timestamp) / 1000; // seconds
    const historyTimeDelta = (current.timestamp - prev.timestamp) / 1000;

    if (historyTimeDelta <= 0 || timeDelta > 30) {
      // Don't predict if too much time has passed
      return current.position;
    }

    // Calculate velocity
    const velocityLat =
      (current.position.lat - prev.position.lat) / historyTimeDelta;
    const velocityLng =
      (current.position.lng - prev.position.lng) / historyTimeDelta;

    // Predict position (max 10 seconds into future)
    const predictionTime = Math.min(timeDelta, 10);

    return {
      lat: current.position.lat + velocityLat * predictionTime,
      lng: current.position.lng + velocityLng * predictionTime,
    };
  }

  /**
   * Calculate current speed in km/h
   */
  getSpeed(): number {
    if (this.positions.length < 2) {
      return 0;
    }

    const lastTwo = this.positions.slice(-2);
    const [prev, current] = lastTwo;

    const timeDelta = (current.timestamp - prev.timestamp) / 1000 / 3600; // hours
    if (timeDelta <= 0) return 0;

    const distance = haversineDistance(prev.position, current.position);
    return distance / timeDelta;
  }

  /**
   * Get current heading (bearing)
   */
  getHeading(): number {
    if (this.positions.length < 2) {
      return 0;
    }

    const lastTwo = this.positions.slice(-2);
    return calculateBearing(lastTwo[0].position, lastTwo[1].position);
  }

  clear(): void {
    this.positions = [];
  }
}

/**
 * Calculate distance between two positions using Haversine formula
 */
function haversineDistance(from: Position, to: Position): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function toDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

/**
 * Create a pulsing effect for markers
 */
export function createPulseAnimation(
  onPulse: (scale: number, opacity: number) => void,
  intervalMs: number = 1500
): () => void {
  const startTime = performance.now();
  let animationFrame: number;

  const animate = (currentTime: number) => {
    const elapsed = (currentTime - startTime) % intervalMs;
    const progress = elapsed / intervalMs;

    // Scale from 1 to 1.5 and back
    const scale = 1 + Math.sin(progress * Math.PI) * 0.5;

    // Opacity from 1 to 0.3 and back
    const opacity = 1 - Math.sin(progress * Math.PI) * 0.7;

    onPulse(scale, opacity);
    animationFrame = requestAnimationFrame(animate);
  };

  animationFrame = requestAnimationFrame(animate);

  return () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  };
}

/**
 * Generate marker rotation style for vehicle heading
 */
export function getRotationStyle(bearing: number): React.CSSProperties {
  return {
    transform: `rotate(${bearing}deg)`,
    transition: 'transform 0.5s ease-out',
  };
}
