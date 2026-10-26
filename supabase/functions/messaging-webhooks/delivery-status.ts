export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';

const deliveryRank: Record<DeliveryStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  failed: 3,
  undelivered: 3,
};

export const deliveryStatus = (status: string): DeliveryStatus => {
  if (status === 'delivered' || status === 'read') return 'delivered';
  if (status === 'undelivered') return 'undelivered';
  if (status === 'failed') return 'failed';
  if (status === 'sent') return 'sent';
  return 'queued';
};

export const advanceStatus = (current: string | null, next: DeliveryStatus): DeliveryStatus => {
  if (!current || !Object.hasOwn(deliveryRank, current)) return next;
  const currentStatus = current as DeliveryStatus;
  return deliveryRank[currentStatus] > deliveryRank[next] ? currentStatus : next;
};
