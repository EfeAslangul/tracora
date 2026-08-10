export type ChangeDetectionErrorCode =
  | 'CHANGEDETECTION_NOT_CONFIGURED'
  | 'CHANGEDETECTION_AUTH_FAILED'
  | 'CHANGEDETECTION_UNAVAILABLE'
  | 'CHANGEDETECTION_REQUEST_FAILED'
  | 'WATCH_CREATE_FAILED'
  | 'WATCH_NOT_FOUND'
  | 'RATE_LIMITED';

export class ChangeDetectionClientError extends Error {
  constructor(
    public readonly code: ChangeDetectionErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ChangeDetectionClientError';
  }
}
