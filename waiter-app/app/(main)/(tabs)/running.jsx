import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  Dimensions, Vibration, Animated, TextInput,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api, { BASE_URL } from '../../../services/api';
import useCartStore from '../../../store/cartStore';
import useAuthStore from '../../../store/authStore';
import useToastStore from '../../../store/toastStore';
import { C, shadow } from '../../../constants/theme';
import { ReceiptModal } from '../../../components/ReceiptView';

const { height: SCREEN_H } = Dimensions.get('window');
const round2 = (n) => Math.round(n * 100) / 100;
const haptic = () => Vibration.vibrate(8);

const ORDER_TYPE_LABEL = {
  dine_in: 'Dine In', takeaway: 'Takeaway', on_spot: 'Walk-in',
};

const ORDER_TYPE_COLOR = {
  dine_in:  { color: C.primary, bg: C.primaryLt, border: C.primaryBd },
  takeaway: { color: C.amber,   bg: C.amberBg,   border: C.amberBd   },
  on_spot:  { color: C.blue,    bg: C.blueBg,    border: C.blueBd    },
};

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash',   icon: 'cash-outline',           color: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
  { value: 'card',   label: 'Card',   icon: 'card-outline',           color: '#2563EB', bg: '#EFF6FF', border: '#93C5FD' },
  { value: 'online', label: 'Online', icon: 'phone-portrait-outline', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
];

function getCatKey(orderType) {
  return orderType === 'on_spot' ? 'walk_in' : (orderType || 'dine_in');
}

function calcAdditional(settings, orderType) {
  if (!settings?.pos_tax_config) return 0;
  const cat = settings.pos_tax_config[getCatKey(orderType)] || {};
  const service = cat.service_enabled ? parseFloat(cat.service_rate || 0) : 0;
  const other   = cat.other_enabled   ? parseFloat(cat.other_rate   || 0) : 0;
  return service + other;
}

// Skeleton helpers
function SkeletonBox({ style }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ backgroundColor: '#E2E8F0', borderRadius: 8 }, style, { opacity }]} />;
}

function OrderSkeleton() {
  return (
    <View style={{ padding: 14, gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[skStyles.card]}>
          <View style={skStyles.cardTop}>
            <SkeletonBox style={{ width: 64, height: 64, borderRadius: 14 }} />
            <View style={{ flex: 1, gap: 8, paddingLeft: 12 }}>
              <SkeletonBox style={{ width: '60%', height: 15 }} />
              <SkeletonBox style={{ width: '40%', height: 11 }} />
              <SkeletonBox style={{ width: '30%', height: 11 }} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <SkeletonBox style={{ width: 70, height: 18 }} />
              <SkeletonBox style={{ width: 50, height: 11 }} />
              <SkeletonBox style={{ width: 60, height: 22, borderRadius: 10 }} />
            </View>
          </View>
          <View style={skStyles.cardActions}>
            <SkeletonBox style={{ flex: 1, height: 44, borderRadius: 0 }} />
            <SkeletonBox style={{ flex: 1, height: 44, borderRadius: 0 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', ...shadow.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  cardActions: { flexDirection: 'row', gap: 1, borderTopWidth: 1, borderTopColor: C.borderLt },
});

export default function RunningScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [billData, setBillData] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [billStep, setBillStep] = useState('payment');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [billDiscount, setBillDiscount] = useState('');
  const [receiptModalData, setReceiptModalData] = useState(null);

  // Table swap state
  const [swapOrder, setSwapOrder] = useState(null);
  const [swapTables, setSwapTables] = useState([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapSaving, setSwapSaving] = useState(false);

  const { setTable } = useCartStore();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const failCountRef = React.useRef(0);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/sales/pending');
      failCountRef.current = 0; // reset on success
      const data = res.data?.data || res.data || [];
      const all = Array.isArray(data) ? data : [];
      const myId = user?.user_id;
      setOrders(myId ? all.filter((o) => Number(o.user_id) === Number(myId)) : all);
    } catch (err) {
      failCountRef.current++;
      console.error('fetchOrders error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Auto-refresh every 30s while screen is focused; skip poll after 5 consecutive failures
  useFocusEffect(useCallback(() => {
    failCountRef.current = 0;
    setLoading(true);
    fetchOrders();
    const interval = setInterval(() => {
      if (failCountRef.current < 5) fetchOrders();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]));

  const handleEdit = (order) => {
    haptic();
    setTable(order.table_id || 0, order.table_name || 'Order', order.sale_id);
    const name = encodeURIComponent(order.table_name || 'Order');
    router.push(`/(main)/order/${order.table_id || 0}?saleId=${order.sale_id}&name=${name}`);
  };

  const handleBillPress = async (order) => {
    haptic();
    setBillLoading(true);
    try {
      const [saleRes, settingsRes] = await Promise.all([
        api.get(`/sales/${order.sale_id}`),
        api.get('/settings'),
      ]);
      const sale = saleRes.data;
      const settings = settingsRes.data || {};
      if (settings.pos_tax_config && typeof settings.pos_tax_config === 'string') {
        try { settings.pos_tax_config = JSON.parse(settings.pos_tax_config); } catch { settings.pos_tax_config = null; }
      }
      const items = sale?.items || sale?.details || [];
      const orderType = sale.order_type || order.order_type;

      const storedAddPct   = parseFloat(sale.additional_charges_percent || 0);
      const storedAddAmt   = parseFloat(sale.additional_charges_amount  || 0);
      const storedSubtotal = parseFloat(sale.sub_total || 0);

      const subtotal   = storedSubtotal > 0
        ? storedSubtotal
        : round2(items.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0));
      const addPercent = storedAddPct > 0 ? storedAddPct : calcAdditional(settings, orderType);
      const addAmt     = storedAddAmt > 0 ? storedAddAmt : round2(subtotal * addPercent / 100);

      const tableName = sale.table_name || order.table_name || null;

      setBillData({ sale: { ...sale, table_name: tableName }, items, settings, orderType, subtotal, addPercent, addAmt });
      setSelectedPayment(null);
      setBillStep('payment');
    } catch (err) {
      showToast('Could not load bill details.', 'error');
    } finally {
      setBillLoading(false);
    }
  };

  const closeBill = () => {
    setBillData(null);
    setSelectedPayment(null);
    setBillStep('payment');
    setBillDiscount('');
  };

  const buildReceiptData = (bd, payMethod, discountOverride = 0) => {
    const s    = bd.settings || {};
    const sale = bd.sale || {};
    const apiBase = BASE_URL.replace(/\/api$/, '');
    const logoUrl = s.receipt_logo ? `${apiBase}${s.receipt_logo}` : undefined;

    const taxPct = (() => {
      if (s.pos_mode === 'category' && s.pos_tax_config) {
        const cat = s.pos_tax_config[getCatKey(bd.orderType)] || {};
        if (!cat.tax_enabled) return 0;
      }
      if (payMethod === 'card')   return parseFloat(s.tax_on_card   || s.tax_rate || 0);
      if (payMethod === 'online') return parseFloat(s.tax_on_online || s.tax_rate || 0);
      return parseFloat(s.tax_on_cash || s.tax_rate || 0);
    })();

    const sub        = bd.subtotal || 0;
    const taxAmt     = round2(sub * taxPct / 100);
    const addAmt     = bd.addAmt || 0;
    const discountAmt = discountOverride > 0 ? discountOverride : parseFloat(sale.discount || 0);
    const total      = round2(Math.max(0, sub + taxAmt + addAmt - discountAmt));

    return {
      docType:        'sale',
      docNumber:      sale.invoice_no,
      tokenNo:        sale.token_no || `#${sale.sale_id}`,
      date:           sale.sale_date ? new Date(sale.sale_date).toLocaleString('en-PK') : new Date().toLocaleString('en-PK'),
      storeName:      s.store_name || 'Restaurant',
      storeAddress:   s.address,
      storePhone:     s.phone,
      logoUrl,
      currencySymbol: s.currency_symbol || 'Rs.',
      footer:         s.receipt_footer,
      cashierName:    sale.cashier_name,
      customerName:   sale.customer_name,
      tableNo:        sale.table_name,
      orderType:      ORDER_TYPE_LABEL[sale.order_type] || sale.order_type,
      items: bd.items.map((i) => ({
        name:     i.product_name || 'Item',
        quantity: i.quantity,
        price:    parseFloat(i.unit_price || 0),
        note:     i.note,
      })),
      subtotal:      sub,
      discount:      discountAmt || undefined,
      taxAmount:     taxAmt || undefined,
      taxPercent:    taxPct || undefined,
      chargesAmount: addAmt || undefined,
      totalAmount:   total,
      amountPaid:    total,
      paymentMethod: payMethod,
      status:        'UNPAID',
    };
  };

  const handlePrintFromModal = async (data) => {
    const s    = billData?.settings || {};
    const sale = billData?.sale || {};
    try {
      await api.post('/settings/print-queue', {
        type: 'invoice',
        receiptData: {
          storeName:      data.storeName,
          storeAddress:   data.storeAddress || '',
          storePhone:     data.storePhone || '',
          saleId:         sale.sale_id,
          invoiceNo:      data.docNumber,
          tokenNo:        data.tokenNo,
          tableName:      data.tableNo || '',
          orderType:      data.orderType || '',
          date:           data.date,
          cashierName:    data.cashierName || '',
          customerName:   data.customerName || '',
          currencySymbol: data.currencySymbol || 'Rs.',
          footer:         data.footer || '',
          paymentMethod:  data.paymentMethod || 'cash',
          items:          data.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price ?? 0, note: i.note || '' })),
          subtotal:       data.subtotal || 0,
          discount:       data.discount || 0,
          taxPercent:     data.taxPercent || 0,
          taxAmount:      data.taxAmount || 0,
          chargesAmount:  data.chargesAmount || 0,
          totalAmount:    data.totalAmount,
          amountPaid:     data.amountPaid || data.totalAmount,
          changeDue:      0,
          status:         data.status || 'UNPAID',
        },
      });
      haptic();
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.response?.data?.message || 'Could not reach printer' };
    }
  };

  // Table swap handlers
  const handleSwapPress = async (order) => {
    haptic();
    setSwapOrder(order);
    setSwapLoading(true);
    try {
      const res = await api.get('/restaurant/tables');
      const all = res.data || [];
      setSwapTables(
        all.filter((t) => t.status === 'available' && Number(t.has_pending_order) === 0)
      );
    } catch {
      showToast('Could not load tables.', 'error');
      setSwapOrder(null);
    } finally {
      setSwapLoading(false);
    }
  };

  const handleSwapConfirm = async (table) => {
    haptic();
    setSwapSaving(true);
    try {
      await api.put(`/sales/${swapOrder.sale_id}/table`, { table_id: table.table_id });
      setOrders((prev) =>
        prev.map((o) =>
          o.sale_id === swapOrder.sale_id
            ? { ...o, table_id: table.table_id, table_name: table.table_name }
            : o
        )
      );
      setSwapOrder(null);
      showToast(`Table changed to ${table.table_name}`, 'success');
    } catch {
      showToast('Could not update table.', 'error');
    } finally {
      setSwapSaving(false);
    }
  };

  const getElapsed = (dateStr) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatTime = (d) =>
    new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) return <OrderSkeleton />;

  return (
    <View style={styles.container}>
      <View style={styles.subHeader}>
        <View style={styles.subHeaderLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.subHeaderText}>
            {orders.length} Running {orders.length === 1 ? 'Order' : 'Orders'}
          </Text>
        </View>
        <View style={styles.subHeaderRight}>
          <View style={styles.autoRefreshBadge}>
            <Ionicons name="sync-outline" size={11} color={C.primary} />
            <Text style={styles.autoRefreshText}>Auto 30s</Text>
          </View>
          <TouchableOpacity onPress={() => { haptic(); fetchOrders(); }} style={styles.refreshIcon}>
            <Ionicons name="refresh-outline" size={18} color={C.t2} />
          </TouchableOpacity>
        </View>
      </View>

      {orders.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="checkmark-circle" size={40} color="#059669" />
          </View>
          <Text style={styles.emptyTitle}>No Running Orders</Text>
          <Text style={styles.emptySub}>All orders have been completed</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => { haptic(); fetchOrders(); }}>
            <Ionicons name="refresh-outline" size={15} color="#FFFFFF" />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.sale_id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(); }}
              colors={[C.primary]} />
          }
          renderItem={({ item }) => {
            const otc = ORDER_TYPE_COLOR[item.order_type] || ORDER_TYPE_COLOR.dine_in;
            const isDineIn = item.order_type === 'dine_in';
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.tokenBox}>
                    <Text style={styles.tokenLabel}>TOKEN</Text>
                    <Text style={styles.tokenText}>{item.token_no || `#${item.sale_id}`}</Text>
                  </View>
                  <View style={styles.cardMid}>
                    <Text style={styles.cardTable}>{item.table_name || 'No Table'}</Text>
                    <View style={[styles.typeBadge, { backgroundColor: otc.bg, borderColor: otc.border }]}>
                      <Text style={[styles.typeBadgeText, { color: otc.color }]}>
                        {ORDER_TYPE_LABEL[item.order_type] || item.order_type || 'Dine In'}
                      </Text>
                    </View>
                    <Text style={styles.cardWaiter}>
                      <Ionicons name="person-outline" size={11} /> {item.cashier_name || 'Waiter'}
                    </Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.cardAmount}>PKR {parseFloat(item.total_amount || 0).toFixed(0)}</Text>
                    <Text style={styles.cardTime}>{formatTime(item.sale_date)}</Text>
                    <View style={styles.elapsedBadge}>
                      <Ionicons name="time-outline" size={10} color="#D97706" />
                      <Text style={styles.elapsedText}>{getElapsed(item.sale_date)}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)} activeOpacity={0.8}>
                    <Ionicons name="create-outline" size={15} color="#2563EB" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  {isDineIn && (
                    <TouchableOpacity style={styles.swapBtn} onPress={() => handleSwapPress(item)} activeOpacity={0.8}>
                      <Ionicons name="swap-horizontal-outline" size={15} color={C.amber} />
                      <Text style={styles.swapBtnText}>Swap Table</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.billBtn}
                    onPress={() => handleBillPress(item)}
                    disabled={billLoading}
                    activeOpacity={0.8}
                  >
                    {billLoading
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : (<><Ionicons name="print-outline" size={15} color="#FFFFFF" /><Text style={styles.billBtnText}>Bill</Text></>)
                    }
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Bill Modal */}
      <Modal visible={!!billData} transparent animationType="slide" onRequestClose={closeBill}>
        <View style={styles.modalWrap}>
          <TouchableOpacity style={styles.modalOverlay} onPress={closeBill} />
          <View style={styles.billSheet}>
            <View style={styles.sheetHandle} />

            {billStep === 'payment' && (
              <View style={styles.payStepWrap}>
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetTitle}>Bill</Text>
                  <TouchableOpacity onPress={closeBill} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Discount input */}
                <View style={styles.discountWrap}>
                  <View style={styles.discountLabelRow}>
                    <Ionicons name="pricetag-outline" size={14} color={C.t3} />
                    <Text style={styles.discountLabel}>Discount (optional)</Text>
                  </View>
                  <View style={styles.discountInputRow}>
                    <Text style={styles.discountCurrency}>PKR</Text>
                    <TextInput
                      style={styles.discountInput}
                      value={billDiscount}
                      onChangeText={(v) => setBillDiscount(v.replace(/[^0-9.]/g, ''))}
                      placeholder="0"
                      placeholderTextColor={C.t3}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                    />
                    {billDiscount.length > 0 && (
                      <TouchableOpacity onPress={() => setBillDiscount('')} style={styles.discountClear}>
                        <Ionicons name="close-circle" size={16} color={C.t3} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <Text style={styles.payStepSub}>
                  How will the customer pay? This will appear on the bill.
                </Text>
                <View style={styles.payGrid}>
                  {PAYMENT_METHODS.map((pm) => (
                    <TouchableOpacity
                      key={pm.value}
                      style={[styles.payCard, { backgroundColor: pm.bg, borderColor: pm.border }]}
                      onPress={() => {
                        haptic();
                        setSelectedPayment(pm.value);
                        const discAmt = parseFloat(billDiscount) || 0;
                        const rd = buildReceiptData(billData, pm.value, discAmt);
                        closeBill();
                        setReceiptModalData(rd);
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.payIconCircle, { backgroundColor: pm.color }]}>
                        <Ionicons name={pm.icon} size={26} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.payLabel, { color: pm.color }]}>{pm.label}</Text>
                      <Text style={styles.payDesc}>
                        {pm.value === 'cash' ? 'Physical cash' : pm.value === 'card' ? 'Debit / Credit' : 'Online transfer'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

          </View>
        </View>
      </Modal>

      {/* Receipt View Modal */}
      {receiptModalData && (
        <ReceiptModal
          data={receiptModalData}
          onClose={() => setReceiptModalData(null)}
          onPrint={handlePrintFromModal}
        />
      )}

      {/* Table Swap Modal */}
      <Modal visible={!!swapOrder} transparent animationType="slide" onRequestClose={() => setSwapOrder(null)}>
        <View style={styles.modalWrap}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setSwapOrder(null)} />
          <View style={styles.billSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Swap Table</Text>
              <TouchableOpacity onPress={() => setSwapOrder(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {swapOrder && (
              <Text style={styles.swapCurrentText}>
                Current: <Text style={{ color: C.t1, fontWeight: '700' }}>{swapOrder.table_name || 'No Table'}</Text>
              </Text>
            )}
            {swapLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={styles.loadingText}>Loading tables...</Text>
              </View>
            ) : swapTables.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center', gap: 8 }}>
                <Ionicons name="close-circle-outline" size={36} color={C.red} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.t1 }}>No Free Tables</Text>
                <Text style={{ fontSize: 13, color: C.t2 }}>All tables are currently occupied</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: SCREEN_H * 0.55 }} contentContainerStyle={styles.swapGrid}>
                {swapTables.map((t) => (
                  <TouchableOpacity
                    key={t.table_id}
                    style={styles.swapTableCard}
                    onPress={() => handleSwapConfirm(t)}
                    disabled={swapSaving}
                    activeOpacity={0.8}
                  >
                    <View style={styles.swapTableIcon}>
                      <Ionicons name="restaurant" size={22} color={C.primary} />
                    </View>
                    <Text style={styles.swapTableName}>{t.table_name}</Text>
                    {t.floor ? <Text style={styles.swapTableFloor}>{t.floor}</Text> : null}
                    {t.capacity ? (
                      <View style={styles.swapCapRow}>
                        <Ionicons name="people-outline" size={11} color={C.t3} />
                        <Text style={styles.swapCapText}>{t.capacity} seats</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {swapSaving && (
              <View style={{ padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={C.primary} />
                <Text style={{ color: C.t2, fontSize: 13 }}>Updating table...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: C.t2, fontSize: 14, marginTop: 8 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.primaryLt, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.t1 },
  emptySub: { fontSize: 13, color: C.t2 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.primary, paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 12, marginTop: 6,
  },
  refreshBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.card, paddingHorizontal: 18, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  subHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subHeaderText: { fontSize: 14, fontWeight: '700', color: C.t1 },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.primary,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 4, elevation: 2,
  },
  autoRefreshBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.primaryLt, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: C.primaryBd,
  },
  autoRefreshText: { fontSize: 10, fontWeight: '700', color: C.primary },
  refreshIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },

  list: { padding: 14, gap: 12, paddingBottom: 28 },
  card: {
    backgroundColor: C.card, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
    ...shadow.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  tokenBox: {
    backgroundColor: C.primaryLt, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.primaryBd,
    paddingHorizontal: 10, paddingVertical: 10, minWidth: 64, alignItems: 'center',
  },
  tokenLabel: { fontSize: 9, fontWeight: '700', color: C.primary, letterSpacing: 0.8, textTransform: 'uppercase' },
  tokenText: { fontSize: 14, fontWeight: '800', color: C.primaryDk, textAlign: 'center', marginTop: 2 },
  cardMid: { flex: 1, gap: 4 },
  cardTable: { fontSize: 15, fontWeight: '800', color: C.t1, letterSpacing: -0.2 },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  cardWaiter: { fontSize: 11.5, color: C.t3, marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 5 },
  cardAmount: { fontSize: 17, fontWeight: '800', color: C.t1, letterSpacing: -0.3 },
  cardTime: { fontSize: 11, color: C.t3 },
  elapsedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.amberBg, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: C.amberBd,
  },
  elapsedText: { fontSize: 10, color: C.amber, fontWeight: '700' },

  actionRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.borderLt },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 13, backgroundColor: C.blueBg,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: C.blue },
  swapBtn: {
    flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 13, backgroundColor: C.amberBg,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  swapBtnText: { fontSize: 12, fontWeight: '700', color: C.amber },
  viewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 12, borderRightWidth: 1, borderRightColor: C.borderLt,
    backgroundColor: '#F5F3FF',
  },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  billBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 13, backgroundColor: C.primary,
  },
  billBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  // Modal
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  billSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 10,
  },
  sheetHandle: {
    width: 44, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderLt,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: C.t1, flex: 1, textAlign: 'center', letterSpacing: -0.3 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },

  printingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 16 },
  printingText: { fontSize: 15, fontWeight: '600', color: C.t2 },
  // Discount input
  discountWrap: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border, padding: 12,
  },
  discountLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  discountLabel: { fontSize: 12, fontWeight: '700', color: C.t2, textTransform: 'uppercase', letterSpacing: 0.5 },
  discountInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.primaryBd, height: 44,
    paddingHorizontal: 12,
  },
  discountCurrency: { fontSize: 14, fontWeight: '700', color: C.t2, marginRight: 6 },
  discountInput: { flex: 1, fontSize: 18, fontWeight: '700', color: C.t1 },
  discountClear: { padding: 4 },

  payStepWrap: { paddingBottom: 28 },
  payStepSub: { fontSize: 13, color: C.t2, textAlign: 'center', paddingHorizontal: 20, marginTop: 12, marginBottom: 20, lineHeight: 20 },
  payGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  payCard: {
    flex: 1, borderRadius: 18, borderWidth: 1.5,
    padding: 16, alignItems: 'center', gap: 7,
    ...shadow.sm,
  },
  payIconCircle: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  payLabel: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  payDesc: { fontSize: 11, color: C.t3, textAlign: 'center', lineHeight: 15 },

  receiptHeader: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  receiptLogoCircle: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  receiptStoreName: { fontSize: 17, fontWeight: '800', color: C.t1, letterSpacing: -0.3 },
  receiptSubLabel: { fontSize: 10, letterSpacing: 2.5, fontWeight: '700', color: C.t3, marginTop: 3 },

  pmBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5,
  },
  pmBannerText: { fontSize: 13, fontWeight: '700' },

  receiptInfo: { paddingHorizontal: 20, paddingBottom: 4 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.borderLt,
  },
  infoLabel: { fontSize: 12, color: C.t3, fontWeight: '500' },
  infoValue: { fontSize: 12, color: C.t1, fontWeight: '700' },

  divider: { height: 1, backgroundColor: C.borderLt, marginHorizontal: 20, marginVertical: 8 },

  itemsSection: { paddingHorizontal: 20 },
  itemsHeader: {
    flexDirection: 'row', paddingBottom: 8,
    borderBottomWidth: 1.5, borderBottomColor: C.border, marginBottom: 4,
  },
  itemCol: { fontSize: 10, fontWeight: '700', color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8 },
  colCenter: { textAlign: 'center', width: 40 },
  colRight: { textAlign: 'right', width: 72 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  itemName: { fontSize: 13, color: C.t1, fontWeight: '500' },
  itemQty: { fontSize: 13, color: C.t2, width: 40, textAlign: 'center', fontWeight: '600' },
  itemAmt: { fontSize: 13, color: C.t1, fontWeight: '700', width: 72, textAlign: 'right' },
  itemNote: { fontSize: 11, color: C.t3, fontStyle: 'italic', paddingLeft: 4, paddingBottom: 4 },

  totalsSection: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 5,
  },
  totalLabel: { fontSize: 13, color: C.t2 },
  totalValue: { fontSize: 13, color: C.t1, fontWeight: '700' },
  grandTotalRow: {
    marginTop: 8, paddingTop: 12,
    borderTopWidth: 2, borderTopColor: C.border,
  },
  grandTotalLabel: { fontSize: 14, fontWeight: '800', color: C.t1, letterSpacing: 0.5 },
  grandTotalValue: { fontSize: 22, fontWeight: '800', color: C.primary, letterSpacing: -0.5 },

  pendingNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.amberBg, marginHorizontal: 16, marginTop: 10, marginBottom: 6,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.amberBd,
  },
  pendingNoteText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },

  billActionRow: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 16, marginTop: 6, marginBottom: 16,
  },
  printBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15,
    backgroundColor: '#059669', borderRadius: 14,
  },
  printBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  closeFullBtn: {
    flex: 1, paddingVertical: 15,
    backgroundColor: C.surface, borderRadius: 14,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  closeFullBtnText: { fontSize: 15, fontWeight: '700', color: C.t1 },

  // Swap table modal
  swapCurrentText: {
    fontSize: 13, color: C.t2, textAlign: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  swapGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 14, gap: 12 },
  swapTableCard: {
    flex: 1, minWidth: '42%', backgroundColor: C.card,
    borderRadius: 18, padding: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border, ...shadow.sm,
  },
  swapTableIcon: {
    width: 50, height: 50, borderRadius: 15,
    backgroundColor: C.primaryLt, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  swapTableName: { fontSize: 14, fontWeight: '800', color: C.t1, marginBottom: 2, textAlign: 'center' },
  swapTableFloor: { fontSize: 11, color: C.t3, marginBottom: 4 },
  swapCapRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swapCapText: { fontSize: 11, color: C.t3 },
});
