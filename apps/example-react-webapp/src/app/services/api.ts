import type { ApiResponse } from '../types/api';

export async function fetchApi<T>(path: string): Promise<ApiResponse<T>> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = (await response.json()) as T;
  return { data, status: response.status };
}
