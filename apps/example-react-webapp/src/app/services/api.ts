import type { ApiResponse } from '../types/api';

export async function fetchApi<T>(
  path: string,
  token?: string,
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const response = await fetch(path, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = (await response.json()) as T;
  return { data, status: response.status };
}
