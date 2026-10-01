/** A problem with one field of an API request. */
export interface FieldIssue {
  field: string
  message: string
}

export type ApiErrorCode =
  | 'ValidationError'
  | 'InvalidJSON'
  | 'Unauthorized'
  | 'NotFound'
  | 'MethodNotAllowed'
  | 'PayloadTooLarge'
  | 'UnsupportedMediaType'
  | 'TooManyRequests'
  | 'ServiceUnavailable'
  | 'InternalError'

/**
 * An error that is safe to show to API consumers: a status code, a stable
 * machine-readable code and a human message. Never carries stack traces,
 * file paths or secrets.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details?: FieldIssue[]
  readonly headers?: Record<string, string>

  constructor(status: number, code: ApiErrorCode, message: string, details?: FieldIssue[], headers?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.headers = headers
  }

  toJSON(requestId?: string) {
    return {
      error: this.code,
      message: this.message,
      ...(this.details?.length ? { details: this.details } : {}),
      ...(requestId ? { requestId } : {}),
    }
  }
}

/** Thrown by image decoders for a single field; collected into a ValidationError. */
export class FieldError extends Error {
  readonly field: string
  /** HTTP status to use if this is the only problem (e.g. 413 for oversized images). */
  readonly status: number

  constructor(field: string, message: string, status = 400) {
    super(message)
    this.name = 'FieldError'
    this.field = field
    this.status = status
  }
}

export function validationError(issues: FieldIssue[]): ApiError {
  return new ApiError(400, 'ValidationError', issues[0]?.message ?? 'The request is invalid.', issues)
}
