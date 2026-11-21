/**
 * Tiny fetch wrapper for the FastAPI backend.
 *
 * In production the site calls `/api/*` on its own domain and Vercel rewrites it to the API
 * project (see vercel.json), so cookies stay first-party. VITE_API_BASE_URL is only needed
 * when the API must be called on another origin.
 */
const BASE = String(import.meta.env["VITE_API_BASE_URL"] ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
};

export async function api<T>(path: string, { method, body, form }: Options = {}): Promise<T> {
  let response: Response;
  try {
    const init: RequestInit = {
      method: method ?? (body !== undefined || form ? "POST" : "GET"),
      credentials: "include",
      headers: body !== undefined ? { "content-type": "application/json" } : {},
    };
    if (form) init.body = form;
    else if (body !== undefined) init.body = JSON.stringify(body);
    response = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError("Couldn't reach the server. Please check your connection and try again.", 0);
  }
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => null)) as
    (T & { detail?: unknown; errors?: { field: string; message: string }[] }) | null;
  if (!response.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : response.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : "Something went wrong. Please try again.";
    throw new ApiError(message, response.status, data?.errors ?? []);
  }
  return data as T;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  return error instanceof Error && error.message ? error.message : fallback;
}
