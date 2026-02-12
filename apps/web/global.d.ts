// Global type declarations

// Augment axios module exports
declare module 'axios' {
  function create(config?: AxiosRequestConfig): AxiosInstance;

  export interface AxiosInstance {
    defaults: AxiosDefaults;
    interceptors: {
      request: AxiosInterceptorManager<any>;
      response: AxiosInterceptorManager<any>;
    };
    request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    head<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    options<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    getUri(config?: AxiosRequestConfig): string;
  }

  export interface AxiosDefaults {
    headers: any;
    baseURL?: string;
    timeout?: number;
    [key: string]: any;
  }

  export interface AxiosInterceptorManager<V> {
    use(onFulfilled?: (value: V) => V | Promise<V>, onRejected?: (error: any) => any): number;
    eject(id: number): void;
    clear(): void;
  }

  export interface AxiosRequestConfig {
    url?: string;
    method?: string;
    baseURL?: string;
    headers?: any;
    params?: any;
    data?: any;
    timeout?: number;
    withCredentials?: boolean;
    responseType?: string;
    validateStatus?: (status: number) => boolean;
    [key: string]: any;
  }

  export interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: AxiosRequestConfig;
    request?: any;
  }

  export interface AxiosError<T = any> extends Error {
    config?: AxiosRequestConfig;
    code?: string;
    request?: any;
    response?: AxiosResponse<T>;
    isAxiosError: boolean;
    toJSON: () => object;
  }
}

// Prisma type augmentation for enums not generated due to network issues
declare module '@prisma/client' {
  export const JobStatus: {
    PENDING: 'PENDING';
    ASSIGNED: 'ASSIGNED';
    SCHEDULED: 'SCHEDULED';
    EN_ROUTE: 'EN_ROUTE';
    IN_PROGRESS: 'IN_PROGRESS';
    ON_HOLD: 'ON_HOLD';
    COMPLETED: 'COMPLETED';
    CANCELLED: 'CANCELLED';
    NEEDS_REVISIT: 'NEEDS_REVISIT';
  };
  export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

  export const TransferType: {
    JOB_ASSIGNMENT: 'JOB_ASSIGNMENT';
    TECHNICIAN_LOAN: 'TECHNICIAN_LOAN';
    CUSTOMER_REFERRAL: 'CUSTOMER_REFERRAL';
    RESOURCE_SHARE: 'RESOURCE_SHARE';
    FINANCIAL: 'FINANCIAL';
  };
  export type TransferType = (typeof TransferType)[keyof typeof TransferType];

  export const TransferStatus: {
    PENDING: 'PENDING';
    APPROVED: 'APPROVED';
    IN_PROGRESS: 'IN_PROGRESS';
    COMPLETED: 'COMPLETED';
    REJECTED: 'REJECTED';
    CANCELLED: 'CANCELLED';
  };
  export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

  export const UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN';
    OWNER: 'OWNER';
    ADMIN: 'ADMIN';
    TECHNICIAN: 'TECHNICIAN';
  };
  export type UserRole = (typeof UserRole)[keyof typeof UserRole];

  export const MovementType: {
    IN: 'IN';
    OUT: 'OUT';
    TRANSFER: 'TRANSFER';
    SALE: 'SALE';
    USE: 'USE';
    CONSUMPTION: 'CONSUMPTION';
    ADJUSTMENT: 'ADJUSTMENT';
  };
  export type MovementType = (typeof MovementType)[keyof typeof MovementType];

  export namespace Prisma {
    export type InputJsonValue = string | number | boolean | null | InputJsonObject | InputJsonArray;
    interface InputJsonObject { [key: string]: InputJsonValue; }
    interface InputJsonArray extends Array<InputJsonValue> { }

    export interface ProductWhereInput { [key: string]: any; }
    export interface ProductOrderByWithRelationInput { [key: string]: 'asc' | 'desc' | any; }
    export interface JobWhereInput { [key: string]: any; }
    export interface LocationWhereInput { [key: string]: any; }
    export interface LocationUpdateInput { [key: string]: any; }
    export interface ZoneWhereInput { [key: string]: any; }
    export interface InterLocationTransferWhereInput { [key: string]: any; }
    export interface InterLocationTransferUpdateInput { [key: string]: any; }
    export interface StockMovementWhereInput { [key: string]: any; }
    export interface InventoryCountWhereInput { [key: string]: any; }
  }
}
