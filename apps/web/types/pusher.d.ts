/**
 * Pusher Type Declarations
 * ========================
 *
 * Fallback type declarations for the 'pusher' module when TypeScript
 * cannot resolve the module from node_modules (e.g., when compiling
 * files from outside the apps/web directory).
 */

declare module 'pusher' {
  interface PusherConfig {
    appId: string;
    key: string;
    secret: string;
    cluster: string;
    useTLS?: boolean;
    encrypted?: boolean;
    host?: string;
    port?: number;
    timeout?: number;
  }

  interface TriggerParams {
    socket_id?: string;
    info?: string;
  }

  interface AuthResponse {
    auth: string;
    channel_data?: string;
    shared_secret?: string;
  }

  interface ChannelInfo {
    occupied?: boolean;
    user_count?: number;
    subscription_count?: number;
  }

  interface Response {
    status: number;
  }

  class Pusher {
    constructor(config: PusherConfig);

    trigger(
      channel: string | string[],
      event: string,
      data: any,
      params?: TriggerParams
    ): Promise<Response>;

    triggerBatch(
      batch: Array<{
        channel: string;
        name: string;
        data: any;
      }>
    ): Promise<Response>;

    authorizeChannel(
      socketId: string,
      channel: string,
      data?: any
    ): AuthResponse;

    authenticateUser(
      socketId: string,
      userData: { id: string; [key: string]: any }
    ): AuthResponse;

    get(options: { path: string; params?: any }): Promise<any>;

    webhook(request: { headers: any; rawBody: string }): {
      isValid: () => boolean;
      getData: () => any;
      getEvents: () => any[];
      getTime: () => Date;
    };
  }

  export = Pusher;
}
