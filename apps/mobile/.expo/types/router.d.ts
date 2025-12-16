/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(auth)` | `/(auth)/login` | `/(tabs)` | `/(tabs)/calendar` | `/(tabs)/customers` | `/(tabs)/inventory` | `/(tabs)/inventory/replenish` | `/(tabs)/inventory/scan` | `/(tabs)/inventory/usage` | `/(tabs)/invoices` | `/(tabs)/jobs` | `/(tabs)/jobs/complete` | `/(tabs)/profile` | `/(tabs)/team` | `/(tabs)/team/add` | `/(tabs)/today` | `/_sitemap` | `/calendar` | `/customers` | `/inventory` | `/inventory/replenish` | `/inventory/scan` | `/inventory/usage` | `/invoices` | `/jobs` | `/jobs/complete` | `/login` | `/profile` | `/settings` | `/team` | `/team/add` | `/today`;
      DynamicRoutes: `/(auth)/invite/${Router.SingleRoutePart<T>}` | `/(tabs)/customers/${Router.SingleRoutePart<T>}` | `/(tabs)/jobs/${Router.SingleRoutePart<T>}` | `/customers/${Router.SingleRoutePart<T>}` | `/invite/${Router.SingleRoutePart<T>}` | `/jobs/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/(auth)/invite/[token]` | `/(tabs)/customers/[id]` | `/(tabs)/jobs/[id]` | `/customers/[id]` | `/invite/[token]` | `/jobs/[id]`;
    }
  }
}
