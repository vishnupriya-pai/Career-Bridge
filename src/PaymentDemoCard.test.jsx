// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
vi.mock('./lib/supabase', () => ({ supabase: null }));
import PaymentDemoCard from './PaymentDemoCard';
import { DEMO_PAYMENT_PLAN, formatDemoAmount, getPaymentStatusLabel } from './lib/payment-demo';

afterEach(cleanup);

describe('Razorpay test-payment demo', () => {
  it('shows the fixed INR demo order and test-only label', () => {
    render(<PaymentDemoCard profile={{ id: 'demo-candidate', full_name: 'Demo Candidate', role: 'candidate' }} />);
    expect(screen.getByText('DEMO — TEST PAYMENTS ONLY')).toBeTruthy();
    expect(screen.getByText('₹499.00')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pay Now/ })).toBeTruthy();
    expect(DEMO_PAYMENT_PLAN.amountPaise).toBe(49900);
  });

  it('fails closed for local demo accounts instead of opening checkout', () => {
    render(<PaymentDemoCard profile={{ id: 'demo-candidate', role: 'candidate' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Pay Now/ }));
    expect(screen.getByText('Could not start test checkout')).toBeTruthy();
    expect(screen.getByText(/Local demo accounts cannot create payment orders/)).toBeTruthy();
  });

  it('formats the INR amount and describes server-verified status', () => {
    expect(formatDemoAmount(49900)).toBe('₹499.00');
    expect(getPaymentStatusLabel('paid')).toBe('Paid · confirmed by CareerBridge');
    expect(getPaymentStatusLabel('awaiting_admin')).toBe('Payment received · awaiting admin confirmation');
    expect(getPaymentStatusLabel('cancelled')).toBe('Cancelled · checkout closed');
    expect(getPaymentStatusLabel('created')).toBe('Order created · awaiting payment');
  });
});
