import { HttpClient } from './http-client';
import { defineAuthApi } from './auth';
import { defineConsultationsApi, definePatientsApi } from './clinical';
import { defineDashboardApi } from './dashboard';
import { defineAnalyticsApi } from './analytics';
import { defineAdminApi } from './admin';
import { defineMediaApi } from './media';
import { defineIntegrationsApi, defineOperationsApi } from './integrations';

export type ApiClient = HttpClient &
  ReturnType<typeof defineAuthApi> &
  ReturnType<typeof defineConsultationsApi> &
  ReturnType<typeof definePatientsApi> &
  ReturnType<typeof defineDashboardApi> &
  ReturnType<typeof defineAnalyticsApi> &
  ReturnType<typeof defineAdminApi> &
  ReturnType<typeof defineMediaApi> &
  ReturnType<typeof defineIntegrationsApi> &
  ReturnType<typeof defineOperationsApi>;

function createApiClient(): ApiClient {
  const client = new HttpClient();
  // define*Api metodlari client ga merge qilinadi — client.method() chaqirmang (rekursiya xavfi).
  return Object.assign(
    client,
    defineAuthApi(client),
    defineConsultationsApi(client),
    definePatientsApi(client),
    defineDashboardApi(client),
    defineAnalyticsApi(client),
    defineAdminApi(client),
    defineMediaApi(client),
    defineIntegrationsApi(client),
    defineOperationsApi(client),
  ) as ApiClient;
}

export const api = createApiClient();

export { UT_ACTIVE_CONSULTATION_KEY } from './constants';
export * from './types';
