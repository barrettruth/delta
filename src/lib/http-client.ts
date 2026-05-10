interface ApiErrorResponse {
  error?: string;
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json().catch(() => null)) as
    | ApiErrorResponse
    | T
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body ? body.error : null;
    throw new Error(typeof message === "string" ? message : "Request failed");
  }

  return body as T;
}
