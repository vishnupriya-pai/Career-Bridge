import { describe, expect, it } from 'vitest';
import { advanceStatus, deliveryStatus } from './delivery-status';

describe('Twilio delivery status', () => {
  it('maps WhatsApp read to delivered and terminal failure statuses', () => {
    expect(deliveryStatus('read')).toBe('delivered');
    expect(deliveryStatus('failed')).toBe('failed');
    expect(deliveryStatus('undelivered')).toBe('undelivered');
  });

  it('does not let out-of-order callbacks move delivery backwards', () => {
    expect(advanceStatus('delivered', deliveryStatus('sent'))).toBe('delivered');
    expect(advanceStatus('failed', deliveryStatus('queued'))).toBe('failed');
  });

  it('advances accepted messages as provider status progresses', () => {
    expect(advanceStatus('queued', deliveryStatus('sent'))).toBe('sent');
    expect(advanceStatus('sent', deliveryStatus('delivered'))).toBe('delivered');
  });
});
