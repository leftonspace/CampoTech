/**
 * State Machine
 * =============
 *
 * Generic state machine implementation for domain entities.
 * Used by Job, Invoice, and Payment modules.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface StateTransition<TState extends string, TContext = any> {
  from: TState | TState[];
  to: TState;
  guard?: (context: TContext) => boolean | Promise<boolean>;
  onTransition?: (context: TContext) => void | Promise<void>;
}

export interface StateMachineConfig<TState extends string, TContext = any> {
  initialState: TState;
  transitions: StateTransition<TState, TContext>[];
  onEnter?: Partial<Record<TState, (context: TContext) => void | Promise<void>>>;
  onExit?: Partial<Record<TState, (context: TContext) => void | Promise<void>>>;
}

export interface TransitionResult<TState extends string> {
  success: boolean;
  previousState: TState;
  currentState: TState;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

export class StateMachine<TState extends string, TContext = any> {
  private config: StateMachineConfig<TState, TContext>;
  private currentState: TState;

  constructor(config: StateMachineConfig<TState, TContext>, initialState?: TState) {
    this.config = config;
    this.currentState = initialState ?? config.initialState;
  }

  /**
   * Get current state
   */
  getState(): TState {
    return this.currentState;
  }

  /**
   * Check if transition is allowed
   */
  canTransition(toState: TState): boolean {
    return this.findTransition(toState) !== undefined;
  }

  /**
   * Get all valid transitions from current state
   */
  getValidTransitions(): TState[] {
    return this.config.transitions
      .filter(t => {
        if (Array.isArray(t.from)) {
          return t.from.includes(this.currentState);
        }
        return t.from === this.currentState;
      })
      .map(t => t.to);
  }

  /**
   * Attempt state transition
   */
  async transition(toState: TState, context: TContext): Promise<TransitionResult<TState>> {
    const previousState = this.currentState;

    // Find valid transition
    const transition = this.findTransition(toState);
    if (!transition) {
      return {
        success: false,
        previousState,
        currentState: this.currentState,
        error: `Invalid transition from ${previousState} to ${toState}`,
      };
    }

    // Check guard condition
    if (transition.guard) {
      const allowed = await transition.guard(context);
      if (!allowed) {
        return {
          success: false,
          previousState,
          currentState: this.currentState,
          error: `Transition guard rejected: ${previousState} → ${toState}`,
        };
      }
    }

    // Execute onExit for current state
    if (this.config.onExit?.[this.currentState]) {
      await this.config.onExit[this.currentState]!(context);
    }

    // Execute transition callback
    if (transition.onTransition) {
      await transition.onTransition(context);
    }

    // Update state
    this.currentState = toState;

    // Execute onEnter for new state
    if (this.config.onEnter?.[toState]) {
      await this.config.onEnter[toState]!(context);
    }

    return {
      success: true,
      previousState,
      currentState: this.currentState,
    };
  }

  /**
   * Find transition configuration
   */
  private findTransition(toState: TState): StateTransition<TState, TContext> | undefined {
    return this.config.transitions.find(t => {
      const fromMatches = Array.isArray(t.from)
        ? t.from.includes(this.currentState)
        : t.from === this.currentState;
      return fromMatches && t.to === toState;
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

import { Job, JobStatus } from '../types/domain.types';

export interface JobTransitionContext {
  job: Job;
  userId: string;
  reason?: string;
  photos?: string[];
  signature?: string;
  notes?: string;
}

export const createJobStateMachine = (initialState: JobStatus = 'pending') => {
  return new StateMachine<JobStatus, JobTransitionContext>(
    {
      initialState: 'pending',
      transitions: [
        // From pending
        { from: 'pending', to: 'scheduled' },
        { from: 'pending', to: 'cancelled' },

        // From scheduled
        { from: 'scheduled', to: 'en_camino' },
        { from: 'scheduled', to: 'pending' }, // Reschedule
        { from: 'scheduled', to: 'cancelled' },

        // From en_camino
        { from: 'en_camino', to: 'working' },
        { from: 'en_camino', to: 'scheduled' }, // Back to scheduled if unable
        { from: 'en_camino', to: 'cancelled' },

        // From working
        {
          from: 'working',
          to: 'completed',
          guard: (ctx) => {
            // Require at least notes for completion
            return !!ctx.notes || !!ctx.signature;
          },
        },
        { from: 'working', to: 'cancelled' },
      ],
    },
    initialState
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

import { Invoice, InvoiceStatus } from '../types/domain.types';

export interface InvoiceTransitionContext {
  invoice: Invoice;
  userId: string;
  cae?: string;
  caeExpiry?: Date;
  error?: string;
}

export const createInvoiceStateMachine = (initialState: InvoiceStatus = 'draft') => {
  return new StateMachine<InvoiceStatus, InvoiceTransitionContext>(
    {
      initialState: 'draft',
      transitions: [
        // From draft
        { from: 'draft', to: 'pending_cae' },

        // From pending_cae
        {
          from: 'pending_cae',
          to: 'issued',
          guard: (ctx) => !!ctx.cae && !!ctx.caeExpiry,
        },
        { from: 'pending_cae', to: 'cae_failed' },
        { from: 'pending_cae', to: 'draft' }, // Retry preparation

        // From cae_failed
        { from: 'cae_failed', to: 'pending_cae' }, // Retry
        { from: 'cae_failed', to: 'draft' }, // Edit and retry

        // From issued
        { from: 'issued', to: 'sent' },
        { from: 'issued', to: 'paid' },
        { from: 'issued', to: 'voided' },

        // From sent
        { from: 'sent', to: 'paid' },
        { from: 'sent', to: 'voided' },

        // Paid is terminal (no transitions out except voided for corrections)
        { from: 'paid', to: 'voided' },
      ],
    },
    initialState
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

import { Payment, PaymentStatus } from '../types/domain.types';

export interface PaymentTransitionContext {
  payment: Payment;
  userId: string;
  reason?: string;
  refundAmount?: number;
}

export const createPaymentStateMachine = (initialState: PaymentStatus = 'pending') => {
  return new StateMachine<PaymentStatus, PaymentTransitionContext>(
    {
      initialState: 'pending',
      transitions: [
        // From pending
        { from: 'pending', to: 'approved' },
        { from: 'pending', to: 'rejected' },
        { from: 'pending', to: 'cancelled' },

        // From approved
        {
          from: 'approved',
          to: 'refunded',
          guard: (ctx) => !!ctx.reason,
        },
        {
          from: 'approved',
          to: 'partial_refund',
          guard: (ctx) => !!ctx.reason && !!ctx.refundAmount && ctx.refundAmount < ctx.payment.amount,
        },
        { from: 'approved', to: 'disputed' },

        // From disputed
        { from: 'disputed', to: 'approved' }, // Dispute resolved in favor
        { from: 'disputed', to: 'refunded' }, // Dispute resolved for customer
        { from: 'disputed', to: 'partial_refund' }, // Partial refund after dispute

        // Refunded, partial_refund, rejected, cancelled are terminal
      ],
    },
    initialState
  );
};
