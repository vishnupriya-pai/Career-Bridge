export const DEMO_PAYMENT_PLAN = Object.freeze({ name: 'CareerBridge Plus demo', amountPaise: 49900, currency: 'INR' });
export const formatDemoAmount = (amountPaise = DEMO_PAYMENT_PLAN.amountPaise) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: DEMO_PAYMENT_PLAN.currency, minimumFractionDigits: 2 }).format(amountPaise / 100);
export const getPaymentStatusLabel = (status) => ({
  idle: 'Not started',
  created: 'Order created · awaiting payment',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
  opening: 'Opening secure test checkout…',
  verifying: 'Payment submitted · verifying with Razorpay…',
  awaiting_admin: 'Payment received · awaiting admin confirmation',
  paid: 'Paid · confirmed by CareerBridge',
  authorized: 'Authorized · awaiting capture confirmation',
  pending: 'Pending · awaiting server confirmation',
  failed: 'Failed · no confirmed payment',
  cancelled: 'Cancelled · checkout closed',
  error: 'Could not start test checkout',
})[status] || 'Payment status unavailable';
