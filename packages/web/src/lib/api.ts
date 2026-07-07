// La implementacion vive en `@core/lib/api` para que mobile pueda reusarla.
// Este archivo solo re-exporta para que las rutas `@/lib/api` existentes
// sigan funcionando.

export { authFetch, api, ApiClientError, configureApi, getApiBaseUrl } from '@core/lib/api';
