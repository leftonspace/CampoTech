// Event publishing utilities
import { EventBus, getEventBus } from './services/event-bus';

const eventBus = getEventBus();

export async function publishEvent(event: {
  type: string;
  data: Record<string, unknown>;
  orgId?: string;
}): Promise<void> {
  await eventBus.publish(event.type, event.data, { orgId: event.orgId });
}

export { eventBus, getEventBus, EventBus };
