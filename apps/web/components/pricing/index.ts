/**
 * Pricing Components
 * 
 * Phase 2-6 - Dynamic Pricing UI (Jan 2026)
 * 
 * Components for multi-currency pricing, inflation support, and notifications in CampoTech.
 */

// Phase 2: Currency Input
export { PriceCurrencyInput, usePriceCurrency } from './PriceCurrencyInput';
export type { PriceCurrencyInputProps, Currency } from './PriceCurrencyInput';

// Phase 2: Exchange Rate Display
export { ExchangeRateDisplay, ExchangeRateBadge } from './ExchangeRateDisplay';

// Phase 3: Rate History Chart
export { RateHistoryChart } from './RateHistoryChart';

// Phase 5: Inflation Adjustment
export { InflationAdjustmentModal } from './InflationAdjustmentModal';
export type { AdjustmentSubmission, PriceItem as InflationPriceItem } from './InflationAdjustmentModal';

// Phase 5: Adjustment History
export { PriceAdjustmentHistory } from './PriceAdjustmentHistory';

// Phase 6: Notifications & Warnings
export { InflationAlertWidget } from './InflationAlertWidget';
export { QuoteValidityWarning } from './QuoteValidityWarning';
export { ItemsExcludedWarning } from './ItemsExcludedWarning';
export type { ExcludedItem } from './ItemsExcludedWarning';
