import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceModal } from '../../printing/InvoiceView';
import * as agentPrinter from '../../printing/agentPrinter';

vi.mock('../../printing/agentPrinter', () => ({
  rasterizeLogoForEscPos: vi.fn().mockResolvedValue(null),
  printInvoice: vi.fn().mockResolvedValue({ success: true }),
}));

describe('InvoiceModal', () => {
  it('sends the receipt to the printer agent without creating a browser print iframe', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <InvoiceModal
        data={{
          docType: 'sale',
          docNumber: 'INV-1001',
          storeName: 'Abyte Dinex',
          storeAddress: 'Main Street',
          storePhone: '0300-1234567',
          date: '2026-09-19',
          cashierName: 'Admin',
          customerName: 'Ali',
          items: [
            { name: 'Burger', quantity: 2, price: 250 },
            { name: 'Tea', quantity: 1, price: 100 },
          ],
          subtotal: 600,
          discount: 0,
          taxAmount: 60,
          taxPercent: 10,
          chargesAmount: 0,
          totalAmount: 660,
          amountPaid: 660,
          paymentMethod: 'cash',
          changeDue: 0,
          footer: 'Thank you',
          currencySymbol: 'Rs.',
        }}
        onClose={() => {}}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /print bill/i }));

    await waitFor(() => {
      expect(agentPrinter.printInvoice).toHaveBeenCalledTimes(1);
    });

    expect(document.querySelector('iframe')).toBeNull();
    expect(printSpy).not.toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
