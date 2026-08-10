export class TelegramDeliveryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly permanent: boolean,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'TelegramDeliveryError';
  }
}
