import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvailabilityCell } from '@/pages/admin/AdminCalendarPage';
import type { AdminCalendarDay } from '@/types';

const soldOutDay: AdminCalendarDay = {
  date: '2099-10-10',
  inventory: 2,
  booked: 2,
  remaining: 0,
  sellableRemaining: 0,
  status: 'open',
  availabilityState: 'sold_out',
  rate: 109,
  updatedAt: null,
};

describe('AvailabilityCell', () => {
  it('allows a sold-out date to be clicked for manual closure', () => {
    const onClick = vi.fn();
    render(<AvailabilityCell day={soldOutDay} disabled={false} saving={false} onClick={onClick} />);

    const button = screen.getByRole('button', { name: /sold out/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps sold-out dates disabled for read-only users or past dates', () => {
    render(<AvailabilityCell day={soldOutDay} disabled saving={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sold out/i })).toBeDisabled();
  });
});
