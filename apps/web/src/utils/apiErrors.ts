import { ApiException } from "../api/client";

export type FormErrors = Record<string, string>;

export interface ParsedFieldErrors {
  formErrors: FormErrors;
  unmapped: Array<{ field: string; message: string }>;
  generalMessage?: string;
}

function normalizeKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\./g, " ") // keep word boundaries for nested paths
    .replace(/[^a-z0-9]+/g, " ") // collapse separators
    .trim()
    .replace(/\s+/g, "");
}

function lastPathSegment(field: string): string {
  const parts = field.split(".").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : field;
}

export function parseApiFieldErrors(
  error: unknown,
  options: {
    fieldMap: Record<string, string>;
    preferLastPathSegment?: boolean;
    generalMessage?: string;
  }
): ParsedFieldErrors {
  const formErrors: FormErrors = {};
  const unmapped: Array<{ field: string; message: string }> = [];

  if (!(error instanceof ApiException)) {
    return {
      formErrors,
      unmapped,
      generalMessage:
        options.generalMessage || "An error occurred. Please try again.",
    };
  }

  const errors = error.error.errors;
  if (!errors || !Array.isArray(errors) || errors.length === 0) {
    return {
      formErrors,
      unmapped,
      generalMessage:
        error.error.detail || error.error.title || options.generalMessage,
    };
  }

  for (const e of errors) {
    const rawField = options.preferLastPathSegment
      ? lastPathSegment(e.field)
      : e.field;
    const mappedKey = options.fieldMap[normalizeKey(rawField)];

    if (mappedKey) {
      formErrors[mappedKey] = e.message;
    } else {
      unmapped.push({ field: e.field, message: e.message });
    }
  }

  return {
    formErrors,
    unmapped,
    generalMessage:
      unmapped.length > 0
        ? options.generalMessage || "Please fix the highlighted fields."
        : undefined,
  };
}
