import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Smartphone, Check, Loader2, Printer, Tag, Star, BookOpen, Percent, CloudUpload, Truck, FileText, MessageCircle, Send, CheckCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import api from '../utils/api';
import { localToday } from '../utils/dateUtils';
import { printBillWithTax } from '../printing/receiptPrinter';
import { printKOT, printInvoice, rasterizeLogoForEscPos } from '../printing/agentPrinter';
import { ReceiptModal } from '../printing/ReceiptView';
import { buildSaleReceipt } from '../printing/receiptBuilder';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pendingSale?: any;
  selectedCustomer?: any;
  appliedBundles?: any[];
  deliveryId?: number;
  deliveryCharges?: number;
}

const r = (n: number) => Math.round(n);

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess, pendingSale, selectedCustomer, appliedBundles = [], deliveryId, deliveryCharges = 0 }) => {
  const { cart, subtotal, clearCart, additionalRate, bundleDiscount } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'online' | 'split' | 'credit'>('cash');

  const [amountPaid, setAmountPaid] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successSale, setSuccessSale] = useState<any>(null);
  const [showReceiptView, setShowReceiptView] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  // Pending sale items & rates
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [pendingTaxRate, setPendingTaxRate] = useState(0);
  const [pendingAdditionalRate, setPendingAdditionalRate] = useState(0);
  const [pendingItemsLoading, setPendingItemsLoading] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // Loyalty state
  const [loyaltyInfo, setLoyaltyInfo] = useState<any>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState('');

  // Credit sale state
  const [creditDueDate, setCreditDueDate] = useState('');

  // Sync to tax dept
  const [syncLoading, setSyncLoading] = useState(false);
  const [synced, setSynced] = useState(false);

  // WhatsApp state
  const [waEnabled, setWaEnabled] = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [waSent, setWaSent] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [showWaInput, setShowWaInput] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSuccessSale(null);
      setAmountPaid('');
      setSplitCash('');
      setSplitCard('');
      setDiscount('');
      setNote('');
      setPaymentMethod('cash');
      setCouponCode('');
      setAppliedCoupon(null);
      setCouponError('');
      setRedeemPoints(false);
      setPointsToRedeem('');
      setCreditDueDate('');
      setPendingItems([]);
      setPendingTaxRate(0);
      setWaPhone('');
      setWaSent(false);
      setShowWaInput(false);
      // For cart sales, initialize charges from CartContext immediately
      if (!pendingSale || pendingSale.isCartEdit) {
        setPendingAdditionalRate(additionalRate);
      } else {
        setPendingAdditionalRate(0);
      }
      fetchSettings();
      if (selectedCustomer && selectedCustomer.customer_id !== 1) {
        fetchLoyaltyInfo(selectedCustomer.customer_id);
      } else {
        setLoyaltyInfo(null);
      }
      // If paying a pending sale (not cart-edit mode), fetch its items
      if (pendingSale?.sale_id && !pendingSale.isCartEdit) {
        fetchPendingSaleDetails(pendingSale.sale_id);
      }
    }
  }, [isOpen]);

  // Reset amountPaid when payment method changes so the updated total is shown
  useEffect(() => {
    setAmountPaid('');
  }, [paymentMethod]);


  const fetchPendingSaleDetails = async (saleId: number) => {
    setPendingItemsLoading(true);
    try {
      const res = await api.get(`/sales/${saleId}`);
      const saleData = res.data;
      setPendingItems(saleData.items || []);
      // Initial rate = cash rate from settings (payment default is cash); user can override manually
      setPendingTaxRate(parseFloat(settings?.tax_on_cash ?? 16));
      setPendingAdditionalRate(parseFloat(saleData.additional_charges_percent || 0));
    } catch (err) {
      console.error('Failed to fetch pending sale details', err);
    } finally {
      setPendingItemsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
      // For cart sales, initialize tax rate from settings (cash default)
      if (!pendingSale || pendingSale.isCartEdit) {
        setPendingTaxRate(parseFloat(res.data?.tax_on_cash ?? 16));
      }
    } catch (error) {
      console.error('Failed to fetch settings', error);
    }
    try {
      const waRes = await api.get('/whatsapp/settings');
      setWaEnabled(waRes.data.whatsapp_enabled);
    } catch { /* silent — whatsapp may not be configured */ }
  };

  const fetchLoyaltyInfo = async (customerId: number) => {
    try {
      const [configRes, pointsRes] = await Promise.all([
        api.get('/loyalty/config'),
        api.get(`/loyalty/customer/${customerId}`)
      ]);
      if (configRes.data?.is_active) {
        setLoyaltyInfo({
          config: configRes.data,
          points: pointsRes.data?.loyalty_points || 0
        });
      } else {
        setLoyaltyInfo(null);
      }
    } catch {
      setLoyaltyInfo(null);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    setCouponError('');
    try {
      const res = await api.post('/coupons/validate', {
        code: couponCode.trim(),
        order_total: baseTotal
      });
      setAppliedCoupon(res.data);
      setCouponError('');
    } catch (err: any) {
      setCouponError(err.response?.data?.message || 'Invalid coupon');
      setAppliedCoupon(null);
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  // When user clicks a payment method button, also sync pendingTaxRate for pending sales
  // (skip if original DB tax was 0 — those are 0-tax order types like TA)
  const handleSetPaymentMethod = (method: 'cash' | 'card' | 'online' | 'split' | 'credit') => {
    setPaymentMethod(method);
    const rate =
      method === 'card'    ? parseFloat(settings?.tax_on_card   ?? 5)
      : method === 'online' ? parseFloat(settings?.tax_on_online ?? 5)
      : parseFloat(settings?.tax_on_cash ?? 16);
    setPendingTaxRate(rate);
  };

  // GST derived from paymentMethod + settings (each method has its own configured rate)
  const taxOnCash   = parseFloat(settings?.tax_on_cash   ?? 16);
  const taxOnCard   = parseFloat(settings?.tax_on_card   ?? 5);
  const taxOnOnline = parseFloat(settings?.tax_on_online ?? 5);

  // Unified: for pending sales use pendingItems; for cart use cart items
  const isPendingMode = !!(pendingSale && !pendingSale.isCartEdit);
  const pendingSubtotal = pendingItems.reduce(
    (sum: number, item: any) => sum + parseFloat(item.unit_price) * parseFloat(item.quantity), 0
  );
  const effectiveSubtotal = isPendingMode ? pendingSubtotal : subtotal;
  const effectiveTaxAmount = effectiveSubtotal * pendingTaxRate / 100;
  const effectiveChargesAmount = effectiveSubtotal * pendingAdditionalRate / 100;

  const baseTotal = effectiveSubtotal + effectiveTaxAmount + effectiveChargesAmount
    + (isPendingMode ? deliveryCharges : 0)
    - (isPendingMode ? 0 : bundleDiscount);

  const discountValue = parseFloat(discount) || 0;
  const couponDiscount = appliedCoupon ? parseFloat(appliedCoupon.discount_amount) : 0;

  // Loyalty redemption calculation
  let loyaltyDiscount = 0;
  if (redeemPoints && loyaltyInfo) {
    const pts = parseInt(pointsToRedeem) || 0;
    const maxPts = Math.min(pts, loyaltyInfo.points, loyaltyInfo.config.min_redeem_points ? Math.max(pts, 0) : pts);
    loyaltyDiscount = maxPts * parseFloat(loyaltyInfo.config.amount_per_point || 0);
  }

  const finalTotal = Math.round(Math.max(0, baseTotal - discountValue - couponDiscount - loyaltyDiscount));
  const effectiveAmountPaid = parseFloat(amountPaid) || 0;
  const changeDue = (paymentMethod === 'split' || paymentMethod === 'credit' || amountPaid === '')
    ? 0
    : Math.max(0, effectiveAmountPaid - finalTotal);

  const handleCheckout = async (withSync: boolean = false) => {
    // Validate credit sale
    if (paymentMethod === 'credit') {
      if (!selectedCustomer || selectedCustomer.customer_id === 1) {
        toast.error('Credit sales require a named customer (not Walk-in).');
        return;
      }
      if (!creditDueDate) {
        toast.error('Please set a due date for the credit sale.');
        return;
      }
    }

    setIsProcessing(true);
    try {
      let finalAmountPaid = parseFloat(amountPaid) || finalTotal;
      let paymentMethodStr: string = paymentMethod;
      let noteStr = note;

      if (paymentMethod === 'split') {
        const cash = parseFloat(splitCash) || 0;
        const card = parseFloat(splitCard) || 0;
        if (Math.abs((cash + card) - finalTotal) > 0.01) {
          toast.error(`Split amounts (Rs. ${r(cash + card)}) do not match Total (Rs. ${r(finalTotal)})`);
          setIsProcessing(false);
          return;
        }
        finalAmountPaid = finalTotal;
        noteStr = `${note ? note + ' | ' : ''}Split: Cash Rs. ${cash.toFixed(0)}, Card Rs. ${card.toFixed(0)}`;
      }

      if (paymentMethod === 'credit') {
        finalAmountPaid = 0;
        paymentMethodStr = 'credit';
      }

      if (pendingSale) {
        await api.put(`/sales/${pendingSale.sale_id}/complete`, {
          payment_method: paymentMethodStr,
          amount_paid: finalAmountPaid,
          discount: discountValue,
          total_amount: finalTotal,
          note: noteStr,
          tax_percent: pendingTaxRate,
          additional_charges_percent: pendingAdditionalRate
        });
        if (deliveryId) {
          await api.patch(`/deliveries/${deliveryId}/status`, { status: 'delivered' });
        }
        const fullSaleRes = await api.get(`/sales/${pendingSale.sale_id}`);
        const completedSale = fullSaleRes.data;
        if (withSync) {
          await api.post(`/sales/${pendingSale.sale_id}/sync-tax`).catch(() => {});
          setSynced(true);
        } else {
          setSynced(false);
        }
        setSuccessSale(completedSale);
        if (selectedCustomer?.phone || selectedCustomer?.customer_phone) {
          setWaPhone(selectedCustomer.phone || selectedCustomer.customer_phone || '');
        }
        setWaSent(false);
        setShowWaInput(false);
        if (settings?.auto_print_receipt) setTimeout(() => doPrint(completedSale), 300);
        // KOT for dine-in/takeaway completed orders
        const ot = pendingSale?.order_type;
        if (ot === 'dine_in' || ot === 'takeaway') setTimeout(() => doKOT(completedSale), 400);
      } else {
        // Build loyalty redeem points
        let loyaltyRedeemPts = 0;
        if (redeemPoints && loyaltyInfo) {
          loyaltyRedeemPts = parseInt(pointsToRedeem) || 0;
          loyaltyRedeemPts = Math.min(loyaltyRedeemPts, loyaltyInfo.points);
        }

        const payload: any = {
          items: cart.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.price,
            variant_id: item.variant_id || null,
            variant_name: item.variant_name || null
          })),
          customer_id: selectedCustomer?.customer_id || 1,
          discount: discountValue,
          total_amount: finalTotal,
          payment_method: paymentMethodStr,
          amount_paid: finalAmountPaid,
          user_id: user?.user_id,
          status: 'completed',
          tax_percent: pendingTaxRate,
          additional_charges_percent: pendingAdditionalRate,
          note: noteStr,
          applied_bundles: appliedBundles || []
        };

        // Coupon
        if (appliedCoupon) {
          payload.coupon_code = couponCode.trim();
          payload.coupon_discount = couponDiscount;
        }

        // Loyalty
        if (loyaltyRedeemPts > 0) {
          payload.loyalty_redeem_points = loyaltyRedeemPts;
        }

        // Credit sale
        if (paymentMethod === 'credit') {
          payload.is_credit = true;
          payload.credit_due_date = creditDueDate;
        }

        const res = await api.post('/sales', payload);
        const newSale = { ...res.data, sale_id: res.data.sale_id || res.data.id, amount_paid: finalAmountPaid };
        if (withSync) {
          const newSaleId = newSale.sale_id;
          if (newSaleId) await api.post(`/sales/${newSaleId}/sync-tax`).catch(() => {});
          setSynced(true);
        } else {
          setSynced(false);
        }
        setSuccessSale(newSale);
        if (selectedCustomer?.phone || selectedCustomer?.customer_phone) {
          setWaPhone(selectedCustomer.phone || selectedCustomer.customer_phone || '');
        }
        setWaSent(false);
        setShowWaInput(false);
        if (settings?.auto_print_receipt) setTimeout(() => doPrint(newSale), 300);

        clearCart();
      }

      onSuccess();
    } catch (error: any) {
      console.error('Checkout failed', error);
      toast.error(error.response?.data?.message || 'Checkout failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const doPrint = async (sale: any) => {
    if (!sale) return;
    const parseNum = (v: any) => typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;
    const totalAmount   = parseNum(sale.total_amount);
    const taxAmount     = parseNum(sale.tax_amount);
    const chargesAmount = parseNum(sale.additional_charges_amount);
    const discountAmt   = parseNum(sale.discount);
    const amountPaid    = parseNum(sale.amount_paid);

    const paperWidth: 58 | 80 = settings?.receipt_paper_width === '58mm' ? 58 : 80;
    const logoUrl = settings?.receipt_logo
      ? `${window.location.origin}${settings.receipt_logo}`
      : null;
    const logoEscPosData = logoUrl
      ? await rasterizeLogoForEscPos(logoUrl, paperWidth).catch(() => null)
      : null;

    const invoiceData = {
      storeName:      settings?.store_name || 'AByte ERP',
      storeAddress:   settings?.address    || '',
      storePhone:     settings?.phone      || '',
      ...(logoEscPosData ? { logoEscPosData } : {}),
      saleId:         sale.sale_id,
      invoiceNo:      sale.invoice_no,
      tokenNo:        sale.token_no,
      tableNo:        sale.table_name      || undefined,
      date:           sale.sale_date ? new Date(sale.sale_date).toLocaleString() : new Date().toLocaleString(),
      cashierName:    user?.name || 'Staff',
      customerName:   selectedCustomer?.customer_name || '',
      currencySymbol: settings?.currency_symbol || 'Rs.',
      items: (sale.items || []).map((item: any) => ({
        name:     item.product_name || item.name,
        quantity: item.quantity,
        price:    parseNum(item.unit_price ?? item.price),
        note:     item.note || undefined,
      })),
      subtotal:      totalAmount - taxAmount - chargesAmount + discountAmt,
      discount:      discountAmt,
      taxAmount,
      taxPercent:    parseNum(sale.tax_percent),
      chargesAmount,
      totalAmount,
      amountPaid,
      changeDue:     Math.max(0, amountPaid - totalAmount),
      paymentMethod: sale.payment_method,
      status:        'PAID',
      footer:        settings?.receipt_footer || 'Thank you for shopping!',
    };

    await printInvoice(invoiceData);
  };

  const doKOT = async (sale: any) => {
    if (!sale) return;
    await printKOT({
      tokenNo:     sale.token_no   || undefined,
      tableNo:     sale.table_name || undefined,
      date:        new Date().toLocaleString(),
      cashierName: user?.name || 'Staff',
      items: (sale.items || cart).map((item: any) => ({
        name:          item.product_name || item.name,
        quantity:      item.quantity,
        category_id:   item.category_id,
        category_name: item.category_name,
      })),
    });
  };

  const handlePrintWithTax = (taxType: 'cash' | 'card', taxRate: number) => {
    if (!successSale) return;
    printBillWithTax(successSale, settings, user?.name || 'Staff', selectedCustomer?.customer_name, taxType, taxRate).catch(console.error);
  };

  // F6 = Print Cash, F7 = Print Card — active only while success screen is shown
  useEffect(() => {
    if (!successSale || !settings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F6') { e.preventDefault(); handlePrintWithTax('cash', taxOnCash); }
      if (e.key === 'F7') { e.preventDefault(); handlePrintWithTax('card', taxOnCard); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [successSale, settings]);

  const handleSyncTax = async (saleId: number) => {
    setSyncLoading(true);
    try {
      await api.post(`/fbr/post-invoice`, { sale_id: saleId });
      await api.post(`/sales/${saleId}/sync-tax`).catch(() => {});
      setSynced(true);
      toast.success('Invoice posted to FBR successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'FBR sync failed');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!waPhone.trim()) return;
    setWaSending(true);
    try {
      await api.post('/whatsapp/send-invoice', { sale_id: successSale.sale_id, phone: waPhone });
      setWaSent(true);
      setShowWaInput(false);
      toast.success('Invoice sent via WhatsApp!');
    } catch (err: any) {
      setWaSent(false);
      toast.error(err.response?.data?.message || 'WhatsApp send failed');
    } finally { setWaSending(false); }
  };

  if (!isOpen) return null;

  if (successSale) {
    const changeDueAmount = paymentMethod === 'credit' ? 0 : Math.max(0, parseFloat(successSale.amount_paid || 0) - parseFloat(successSale.total_amount || 0));
    return (
      <>
      {showReceiptView && (
        <ReceiptModal
          data={buildSaleReceipt(successSale, settings, user?.name || 'Staff', selectedCustomer?.customer_name)}
          onClose={() => setShowReceiptView(false)}
        />
      )}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <Check size={32} />
          </div>
          <h2 className="text-base font-semibold text-gray-800 mb-2">
            {paymentMethod === 'credit' ? 'Credit Sale Recorded!' : 'Payment Successful!'}
          </h2>

          {successSale.invoice_no && (
            <div className="mb-3 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl inline-block">
              <p className="text-xs text-emerald-600 font-medium">Invoice Number</p>
              <p className="text-xl font-black text-emerald-700">{successSale.invoice_no}</p>
            </div>
          )}


          {paymentMethod === 'credit' ? (
            <p className="text-gray-500 mb-8">
              Amount Due: <span className="font-bold text-orange-600">Rs. {r(finalTotal)}</span>
              <br />
              <span className="text-sm">Due: {creditDueDate}</span>
            </p>
          ) : (
            <p className="text-gray-500 mb-8">
              Change Due: <span className="font-bold text-emerald-600">Rs. {r(changeDueAmount)}</span>
            </p>
          )}

          {successSale.loyalty_points_earned > 0 && (
            <p className="text-amber-600 text-sm mb-4">
              <Star size={14} className="inline mr-1" />
              {successSale.loyalty_points_earned} loyalty points earned!
            </p>
          )}

          {settings?.auto_print_receipt && (
            <p className="text-xs text-gray-400 mb-3 flex items-center justify-center gap-1">
              <Printer size={12} /> Receipt auto-printed
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { onClose(); setSuccessSale(null); }}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl transition-colors"
            >
              Done
            </button>
            <button
              onClick={() => setShowReceiptView(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition-colors border border-emerald-200"
              title="View Receipt"
            >
              <FileText size={16} /> View
            </button>
            <button
              onClick={() => handlePrintWithTax('cash', taxOnCash)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold rounded-xl transition-colors border border-orange-200"
              title="Print Cash Bill (F6)"
            >
              <Banknote size={16} /> Cash <kbd className="ml-1 text-xs bg-orange-100 px-1 rounded">F6</kbd>
            </button>
            <button
              onClick={() => handlePrintWithTax('card', taxOnCard)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl transition-colors border border-blue-200"
              title="Print Card Bill (F7)"
            >
              <CreditCard size={16} /> Card <kbd className="ml-1 text-xs bg-blue-100 px-1 rounded">F7</kbd>
            </button>
            <button
              onClick={() => handleSyncTax(successSale.sale_id)}
              disabled={syncLoading || synced}
              className={`flex items-center justify-center gap-2 px-4 py-3 font-bold rounded-xl transition-colors border ${
                synced
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
              }`}
            >
              {syncLoading ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
              {synced ? 'Synced!' : 'Sync FBR'}
            </button>
            {waEnabled && (
              <>
                {showWaInput ? (
                  <div className="w-full flex gap-2 mt-1">
                    <input
                      type="tel"
                      value={waPhone}
                      onChange={e => setWaPhone(e.target.value)}
                      placeholder="03001234567"
                      className="flex-1 px-3 py-2 border-2 border-green-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500"
                      onKeyDown={e => e.key === 'Enter' && handleSendWhatsApp()}
                      autoFocus
                    />
                    <button onClick={handleSendWhatsApp} disabled={waSending || !waPhone.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition disabled:opacity-50 text-sm">
                      {waSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Send
                    </button>
                    <button onClick={() => setShowWaInput(false)} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowWaInput(true)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 font-bold rounded-xl transition-colors border ${waSent ? 'bg-green-50 text-green-700 border-green-200' : 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200'}`}>
                    {waSent ? <CheckCircle size={16} /> : <MessageCircle size={16} />}
                    {waSent ? 'Sent!' : 'WhatsApp'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h2 className="text-base font-semibold text-gray-800">Checkout</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">

          {/* Items table — always shown for all checkout types */}
          <div className="space-y-2">
            {isPendingMode && pendingItemsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin text-emerald-500" size={20} />
                <span className="ml-2 text-sm text-gray-500">Loading items...</span>
              </div>
            ) : (
              <>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Order Items
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-t border-gray-100">
                      <tr>
                        <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Item</th>
                        <th className="px-3 py-1.5 text-center text-gray-500 font-medium">Qty</th>
                        <th className="px-3 py-1.5 text-right text-gray-500 font-medium">Price</th>
                        <th className="px-3 py-1.5 text-right text-gray-500 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(isPendingMode ? pendingItems : cart).map((item: any, idx: number) => {
                        const price = parseFloat(item.unit_price ?? item.price ?? 0);
                        const qty   = parseFloat(item.quantity ?? 1);
                        return (
                          <tr key={idx}>
                            <td className="px-3 py-1.5 text-xs">
                              <p className="text-gray-800 font-medium">{item.product_name}</p>
                              {item.variant_name && <p className="text-gray-400">{item.variant_name}</p>}
                            </td>
                            <td className="px-3 py-1.5 text-center text-gray-600 text-xs">{qty}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600 text-xs">Rs. {r(price)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-gray-800 text-xs">Rs. {r(price * qty)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Editable Tax % and Charges % — same for all checkout types */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <label className="text-xs font-semibold text-gray-500 flex items-center gap-1 mb-1.5">
                      <Percent size={11} /> Tax %
                    </label>
                    <input
                      type="number"
                      value={pendingTaxRate}
                      onChange={e => setPendingTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                      step="0.1" min="0"
                    />
                    {pendingTaxRate > 0 && (
                      <p className="text-xs text-gray-400 mt-1 text-center">Rs. {r(effectiveTaxAmount)}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <label className="text-xs font-semibold text-gray-500 flex items-center gap-1 mb-1.5">
                      <Tag size={11} /> Charges %
                    </label>
                    <input
                      type="number"
                      value={pendingAdditionalRate}
                      onChange={e => setPendingAdditionalRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                      step="0.1" min="0"
                    />
                    {pendingAdditionalRate > 0 && (
                      <p className="text-xs text-gray-400 mt-1 text-center">Rs. {r(effectiveChargesAmount)}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Price Summary */}
          <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex justify-between items-center text-gray-600 text-sm">
              <span>Subtotal</span>
              <span>Rs. {r(effectiveSubtotal)}</span>
            </div>
            {pendingTaxRate > 0 && (
              <div className={`flex justify-between items-center text-sm font-semibold ${paymentMethod === 'card' || paymentMethod === 'online' ? 'text-blue-600' : 'text-orange-600'}`}>
                <span className="flex items-center gap-1">
                  <Percent size={12} />
                  Tax ({pendingTaxRate}%)
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${paymentMethod === 'card' || paymentMethod === 'online' ? 'bg-blue-100' : 'bg-orange-100'}`}>
                    {paymentMethod === 'card' ? 'Card' : paymentMethod === 'online' ? 'Online' : paymentMethod === 'split' ? 'Split' : paymentMethod === 'credit' ? 'Credit' : 'Cash'}
                  </span>
                </span>
                <span>+ Rs. {r(effectiveTaxAmount)}</span>
              </div>
            )}
            {pendingAdditionalRate > 0 && (
              <div className="flex justify-between items-center text-gray-500 text-sm">
                <span>Charges ({pendingAdditionalRate}%)</span>
                <span>+ Rs. {r(effectiveChargesAmount)}</span>
              </div>
            )}
            {!isPendingMode && bundleDiscount > 0 && (
              <div className="flex justify-between items-center text-green-600 text-sm">
                <span>Bundle Discount</span>
                <span>- Rs. {r(bundleDiscount)}</span>
              </div>
            )}
            {deliveryCharges > 0 && (
              <div className="flex justify-between items-center text-blue-600 text-sm">
                <span className="flex items-center gap-1"><Truck size={12} /> Delivery Charges</span>
                <span>+ Rs. {r(deliveryCharges)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-gray-600">
               <span className="flex items-center gap-1">Discount <span className="text-xs text-gray-400">(Optional)</span></span>
               <div className="flex items-center gap-1 w-28">
                 <span className="text-gray-400">- Rs.</span>
                 <input
                   type="number"
                   value={discount}
                   onChange={(e) => setDiscount(e.target.value)}
                   className="w-full px-2 py-1 border border-gray-200 rounded text-right focus:border-emerald-500 outline-none"
                   placeholder="0.00"
                 />
               </div>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between items-center text-green-600">
                <span className="flex items-center gap-1"><Tag size={14} /> Coupon</span>
                <span>- Rs. {r(couponDiscount)}</span>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between items-center text-amber-600">
                <span className="flex items-center gap-1"><Star size={14} /> Points</span>
                <span>- Rs. {r(loyaltyDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg pt-2 border-t border-gray-200">
              <div>
                <span className="font-bold text-gray-800">Net Payable</span>
                {pendingTaxRate > 0 && (
                  <div className={`text-xs font-semibold mt-0.5 ${paymentMethod === 'card' || paymentMethod === 'online' ? 'text-blue-600' : 'text-orange-600'}`}>
                    incl. Tax {pendingTaxRate}%
                  </div>
                )}
              </div>
              <span className="font-bold text-2xl text-emerald-600">Rs. {r(finalTotal)}</span>
            </div>
          </div>

          {/* Coupon Section */}
          {!pendingSale && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1"><Tag size={14} /> Coupon Code</label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                  <div>
                    <span className="font-bold text-green-700">{couponCode}</span>
                    <span className="text-green-600 text-sm ml-2">-Rs. {r(couponDiscount)} off</span>
                  </div>
                  <button onClick={removeCoupon} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
                    placeholder="Enter code"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={applyingCoupon || !couponCode.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm"
                  >
                    {applyingCoupon ? '...' : 'Apply'}
                  </button>
                </div>
              )}
              {couponError && <p className="text-red-500 text-xs">{couponError}</p>}
            </div>
          )}

          {/* Loyalty Points Section */}
          {loyaltyInfo && !pendingSale && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-800 flex items-center gap-1"><Star size={14} /> Loyalty Points</span>
                <span className="font-bold text-amber-700">{loyaltyInfo.points} pts</span>
              </div>
              {loyaltyInfo.points >= (loyaltyInfo.config.min_redeem_points || 0) && loyaltyInfo.points > 0 && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-amber-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={redeemPoints}
                      onChange={(e) => {
                        setRedeemPoints(e.target.checked);
                        if (!e.target.checked) setPointsToRedeem('');
                      }}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    Redeem
                  </label>
                  {redeemPoints && (
                    <input
                      type="number"
                      value={pointsToRedeem}
                      onChange={(e) => {
                        const val = Math.min(parseInt(e.target.value) || 0, loyaltyInfo.points);
                        setPointsToRedeem(val > 0 ? String(val) : '');
                      }}
                      max={loyaltyInfo.points}
                      className="w-24 px-2 py-1 border border-amber-300 rounded text-right focus:ring-amber-500 outline-none text-sm"
                      placeholder={`Max ${loyaltyInfo.points}`}
                    />
                  )}
                  {redeemPoints && loyaltyDiscount > 0 && (
                    <span className="text-xs text-amber-600">= Rs. {r(loyaltyDiscount)} off</span>
                  )}
                </div>
              )}
              {loyaltyInfo.points < (loyaltyInfo.config.min_redeem_points || 0) && (
                <p className="text-xs text-amber-600">Min {loyaltyInfo.config.min_redeem_points} points to redeem</p>
              )}
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Payment Method</label>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${paymentMethod === 'card' || paymentMethod === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                Tax: {pendingTaxRate}% — Rs. {r(effectiveTaxAmount)}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleSetPaymentMethod('cash')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Banknote size={20} />
                <span className="text-xs font-medium">Cash</span>
                <span className="text-[10px] font-bold text-orange-500">GST {taxOnCash}%</span>
              </button>
              <button
                onClick={() => handleSetPaymentMethod('card')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'card'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <CreditCard size={20} />
                <span className="text-xs font-medium">Card</span>
                <span className="text-[10px] font-bold text-blue-500">GST {taxOnCard}%</span>
              </button>
              <button
                onClick={() => handleSetPaymentMethod('online')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'online'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Smartphone size={20} />
                <span className="text-xs font-medium">Online</span>
                <span className="text-[10px] font-bold text-blue-500">GST {taxOnOnline}%</span>
              </button>
              <button
                onClick={() => handleSetPaymentMethod('credit')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'credit'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <BookOpen size={20} />
                <span className="text-xs font-medium">Credit</span>
              </button>
            </div>
            <button
                onClick={() => handleSetPaymentMethod('split')}
                className={`w-full mt-1 p-2 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'split'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <span className="font-bold text-lg">½</span>
                <span className="text-sm font-medium">Split Payment (Cash + Card)</span>
            </button>
          </div>

          {/* Note */}
          <div className="space-y-2">
             <label className="text-sm font-medium text-gray-700">Note <span className="text-xs text-gray-400 font-normal">(Optional)</span></label>
             <textarea
               value={note}
               onChange={(e) => setNote(e.target.value)}
               placeholder="Add a note to this sale..."
               className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none h-16"
             />
          </div>

          {/* Credit Due Date */}
          {paymentMethod === 'credit' && (
            <div className="space-y-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
              <label className="text-sm font-medium text-orange-800">Due Date *</label>
              <input
                type="date"
                value={creditDueDate}
                onChange={(e) => setCreditDueDate(e.target.value)}
                min={localToday()}
                className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              />
              {selectedCustomer?.customer_id === 1 || !selectedCustomer ? (
                <p className="text-xs text-red-600">Select a named customer for credit sales</p>
              ) : null}
            </div>
          )}

          {/* Payment Input */}
          {paymentMethod === 'split' ? (
             <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash (Rs.)</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card (Rs.)</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                  value={splitCard}
                  onChange={(e) => setSplitCard(e.target.value)}
                  placeholder="0.00"
                />
              </div>
             </div>
          ) : paymentMethod === 'credit' ? (
            <div className="text-center text-orange-700 text-sm font-medium py-2">
              Full amount of Rs. {r(finalTotal)} will be recorded as credit
            </div>
          ) : (
             <div className="space-y-2">
               <label className="text-sm font-medium text-gray-700">Amount Paid</label>
               <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">Rs.</span>
                 <input
                   type="number"
                   value={amountPaid}
                   onChange={(e) => setAmountPaid(e.target.value)}
                   className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-bold text-lg"
                   placeholder="Enter amount..."
                 />
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-gray-500">Change Due</span>
                 <span className="font-bold text-gray-800">Rs. {r(changeDue)}</span>
               </div>
             </div>
          )}

          {paymentMethod === 'credit' ? (
            <button
              onClick={() => handleCheckout(false)}
              disabled={isProcessing}
              className="w-full font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 shadow-orange-600/20 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={22} /> : <Check size={22} />}
              Record Credit Sale
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Complete Payment — no FBR sync */}
              <button
                onClick={() => handleCheckout(false)}
                disabled={isProcessing || (paymentMethod !== 'split' && (amountPaid === '' || parseFloat(amountPaid) < finalTotal))}
                className="font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                <span className="text-sm">Complete Payment</span>
              </button>
              {/* Pay + Sync FBR — pays and auto-syncs invoice */}
              <button
                onClick={() => handleCheckout(true)}
                disabled={isProcessing || (paymentMethod !== 'split' && (amountPaid === '' || parseFloat(amountPaid) < finalTotal))}
                className="font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 shadow-purple-600/20 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CloudUpload size={20} />}
                <span className="text-sm">Pay + Sync FBR</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
