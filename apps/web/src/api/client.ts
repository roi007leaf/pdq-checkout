const API_BASE = "/api";

export interface ApiError {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  traceId: string;
  errors?: Array<{ field: string; message: string }>;
}

export class ApiException extends Error {
  constructor(public readonly error: ApiError) {
    super(error.detail || error.title);
    this.name = "ApiException";
  }
}

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (
      contentType?.includes("application/problem+json") ||
      contentType?.includes("application/json")
    ) {
      const error = await response.json();
      throw new ApiException(error);
    }
    throw new ApiException({
      title: "Request Failed",
      status: response.status,
      code: "REQUEST_FAILED",
      traceId: "unknown",
      detail: `HTTP ${response.status}: ${response.statusText}`,
    });
  }
  return response.json();
}

export async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  return handleResponse<T>(response);
}

export async function post<T>(
  path: string,
  body: unknown,
  options?: { idempotencyKey?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options?.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export { generateIdempotencyKey };
