/**
 * Thin, typed fetch helper for the Call2Kitchen Express backend.
 *
 * The backend is a separate process (default port 3000) and is not bundled
 * with this frontend. The base URL is configured through an environment
 * variable so no secrets are baked into the client bundle.
 */
export const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

interface RequestOptions extends Omit<RequestInit, "body" | "headers"> {
  body?: Json;
  headers?: Record<string, string>;
}

async function parseResponse<T = Json>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `Unexpected backend response: ${response.status} ${text.slice(0, 200)}`,
    );
  }
  return (await response.json()) as T;
}

export async function apiRequest<T = Json>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; status: number; ok: boolean }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  let body: string | undefined;
  if (options.body !== undefined) {
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    body,
    cache: "no-store",
  });

  let data: T;
  try {
    data = await parseResponse<T>(response);
  } catch {
    data = null as unknown as T;
  }

  return { data, status: response.status, ok: response.ok };
}

