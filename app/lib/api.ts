import { data, redirect } from "react-router";
import type { Profile } from "../../shared/types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function api<T>(
  path: string,
  options?: RequestInit,
  redirectOnUnauthorized?: boolean,
): Promise<T>;
export async function api(
  path: string,
  options: RequestInit = {},
  redirectOnUnauthorized = true,
): Promise<unknown> {
  const headers = new Headers(options.headers);
  headers.set("X-Requested-With", "pineanddandy");
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers,
  });
  if (response.status === 401 && redirectOnUnauthorized) {
    throw redirect("/auth/login");
  }
  if (!response.ok) {
    const responseBody = await response.text();
    let body: unknown;
    try {
      body = responseBody ? JSON.parse(responseBody) : undefined;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : responseBody.trim() || `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? undefined : await response.json();
}

export function formError(error: unknown) {
  if (error instanceof ApiError) {
    return data({ error: error.message }, { status: error.status });
  }
  throw error;
}

export async function currentProfile() {
  try {
    return await api<Profile>("/profile", {}, false);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
