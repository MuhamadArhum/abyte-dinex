import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Modal,
  TextInput, Dimensions, Vibration,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api, { BASE_URL } from '../../../services/api';
import useCartStore from '../../../store/cartStore';
import useToastStore from '../../../store/toastStore';
import useConfirmStore from '../../../store/confirmStore';
import useOfflineQueue from '../../../store/offlineQueue';
import { C, shadow } from '../../../constants/theme';
import { ReceiptModal } from '../../../components/ReceiptView';

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash',   icon: 'cash-outline',           color: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
  { value: 'card',   label: 'Card',   icon: 'card-outline',           color: '#2563EB', bg: '#EFF6FF', border: '#93C5FD' },
  { value: 'online', label: 'Online', icon: 'phone-portrait-outline', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
];

const { height: SCREEN_H } = Dimensions.get('window');
const haptic = () => Vibration.vibrate(8);

const ORDER_TYPE_LABEL = {
  dine_in: 'Dine In',
  takeaway: 'Takeaway',
  on_spot: 'Walk-in',
};

const NEEDS_CUSTOMER_INFO = ['takeaway'];

export default function OrderScreen() {
  const { id: tableId, name, saleId, orderType: orderTypeParam } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const tableName = name ? decodeURIComponent(name) : 'Order';
  const isEditMode = !!saleId;

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [orderType, setOrderType] = useState(orderTypeParam || 'dine_in');
  const [settings, setSettings] = useState(null);
  const [saleInfo, setSaleInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedPayMethod, setSelectedPayMethod] = useState('cash');
  const [receiptModalData, setReceiptModalData] = useState(null);
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [openNoteId, setOpenNoteId] = useState(null);
  const [kotModalData, setKotModalData] = useState(null);

  const {
    items, addItem, incrementItem, decrementItem, removeItem,
    setItems, clearCart, existingSaleId,
    updateItemNote, customerName, customerPhone, setCustomerInfo,
    guestCount, setGuestCount,
  } = useCartStore();
  const { showToast } = useToastStore();
  const { show: showConfirm } = useConfirmStore();
  const { addToQueue } = useOfflineQueue();

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  const getCatKey = (ot) => ot === 'on_spot' ? 'walk_in' : (ot || 'dine_in');

  const taxPercent = React.useMemo(() => {
    if (!settings) return 0;
    const s = settings;
    if (s.pos_mode === 'category' && s.pos_tax_config) {
      const cat = s.pos_tax_config[getCatKey(orderType)] || {};
      if (!cat.tax_enabled) return 0;
    }
    if (selectedPayMethod === 'card')   return parseFloat(s.tax_on_card   || s.tax_rate || 0);
    if (selectedPayMethod === 'online') return parseFloat(s.tax_on_online || s.tax_rate || 0);
    return parseFloat(s.tax_on_cash || s.tax_rate || 0);
  }, [settings, orderType, selectedPayMethod]);

  const additionalPercent = React.useMemo(() => {
    if (!settings?.pos_tax_config) return 0;
    const cat = settings.pos_tax_config[getCatKey(orderType)] || {};
    const service = cat.service_enabled ? parseFloat(cat.service_rate || 0) : 0;
    const other   = cat.other_enabled   ? parseFloat(cat.other_rate   || 0) : 0;
    return service + other;
  }, [settings, orderType]);

  const taxAmount        = Math.round((subtotal * taxPercent)        / 100 * 100) / 100;
  const additionalAmount = Math.round((subtotal * additionalPercent) / 100 * 100) / 100;
  const totalAmount      = Math.round((subtotal + taxAmount + additionalAmount) * 100) / 100;

  const displayProducts = React.useMemo(() => {
    let list = selectedCat ? products.filter((p) => p.category_id === selectedCat) : products;
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter((p) => p.product_name.toLowerCase().includes(q));
    return list;
  }, [products, selectedCat, searchQuery]);

  const loadData = useCallback(async () => {
    try {
      const requests = [
        api.get('/products/categories?type=finished_good'),
        api.get('/products?type=finished_good'),
        api.get('/settings'),
      ];
      if (saleId) requests.push(api.get(`/sales/${saleId}`));

      const results = await Promise.allSettled(requests);

      const catRes  = results[0].status === 'fulfilled' ? results[0].value : null;
      const prodRes = results[1].status === 'fulfilled' ? results[1].value : null;
      const setRes  = results[2].status === 'fulfilled' ? results[2].value : null;
      const saleRes = results[3]?.status === 'fulfilled' ? results[3].value : null;

      // If products failed to load, show an error — menu can't work without them
      if (results[1].status === 'rejected') {
        showToast('Failed to load menu items. Check your connection and go back to retry.', 'error');
      }

      const cats  = Array.isArray(catRes?.data?.data)  ? catRes.data.data
                  : Array.isArray(catRes?.data)         ? catRes.data : [];
      const prods = Array.isArray(prodRes?.data?.data) ? prodRes.data.data
                  : Array.isArray(prodRes?.data)        ? prodRes.data : [];

      setCategories(cats);
      setProducts(prods);
      setSelectedCat(null);

      if (setRes?.data) {
        const s = setRes.data;
        if (s.pos_tax_config && typeof s.pos_tax_config === 'string') {
          try { s.pos_tax_config = JSON.parse(s.pos_tax_config); } catch { s.pos_tax_config = null; }
        }
        setSettings(s);
      }

      if (saleRes?.data) {
        const saleData = saleRes.data;
        setSaleInfo(saleData);
        if (saleData.order_type) setOrderType(saleData.order_type);

        const details = saleData?.items || saleData?.details || [];
        const cartItems = details.map((d) => {
          const matched = prods.find((p) => p.product_id === d.product_id);
          return {
            product_id: d.product_id,
            product_name: d.product_name || matched?.product_name || 'Item',
            unit_price: parseFloat(d.unit_price || d.selling_price || matched?.selling_price || 0),
            quantity: d.quantity,
            variant_id: d.variant_id || null,
            note: d.note || '',
          };
        });
        setItems(cartItems);
      }
    } catch (err) {
      console.error('loadData error:', err.message);
      showToast('Failed to load menu. Please go back and try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    loadData();
    // clearCart is called explicitly in handleBack, submitOrder success, and offline queue path
    // Do NOT clear on unmount to avoid losing cart if user temporarily navigates away
  }, []);

  const handleBack = () => {
    clearCart();
    router.back();
  };

  const handleSendOrder = async () => {
    if (items.length === 0) {
      showToast('Please add at least one item to the cart.', 'warning');
      return;
    }

    const title   = isEditMode ? 'Update Order?' : 'Send to Kitchen?';
    const message = isEditMode
      ? `Save changes to this order?\n${totalItems} item(s) • PKR ${totalAmount.toFixed(0)}`
      : `Send order for ${tableName} to kitchen?\n${totalItems} item(s) • PKR ${totalAmount.toFixed(0)}`;

    showConfirm({
      title,
      message,
      confirmText: isEditMode ? 'Update' : 'Send',
      onConfirm: submitOrder,
    });
  };

  const submitOrder = async () => {
    setSending(true);
    try {
      if (isEditMode) {
        await api.put(`/sales/${saleId}/items`, {
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: parseFloat(i.unit_price || 0),
            variant_id: i.variant_id || null,
            note: i.note || null,
          })),
          total_amount: totalAmount,
          tax_percent: parseFloat(taxPercent.toFixed(2)),
          additional_charges_percent: parseFloat(additionalPercent.toFixed(2)),
        });

        showToast('Order has been updated successfully.', 'success');
        setKotModalData(buildKOTData(saleInfo?.token_no));
      } else {
        const res = await api.post('/sales', {
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            variant_id: i.variant_id || null,
            note: i.note || null,
          })),
          table_id: parseInt(tableId) || null,
          order_type: orderType,
          status: 'pending',
          payment_method: 'cash',
          tax_percent: parseFloat(taxPercent.toFixed(2)),
          additional_charges_percent: parseFloat(additionalPercent.toFixed(2)),
          discount: 0,
          note: note.trim() || null,
          customer_name: NEEDS_CUSTOMER_INFO.includes(orderType) && customerName.trim() ? customerName.trim() : null,
          customer_phone: NEEDS_CUSTOMER_INFO.includes(orderType) && customerPhone.trim() ? customerPhone.trim() : null,
          covers: orderType === 'dine_in' ? (guestCount || 1) : null,
        });

        const token = res.data?.token_no || res.data?.sale?.token_no;
        showToast(`Order sent! Token: ${token || '—'}`, 'success');
        setKotModalData(buildKOTData(token));
      }
    } catch (err) {
      // Network error (no response) — save to offline queue
      if (!err.response && !isEditMode) {
        const payload = {
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            variant_id: i.variant_id || null,
            note: i.note || null,
          })),
          table_id: parseInt(tableId) || null,
          order_type: orderType,
          status: 'pending',
          payment_method: 'cash',
          tax_percent: parseFloat(taxPercent.toFixed(2)),
          additional_charges_percent: parseFloat(additionalPercent.toFixed(2)),
          discount: 0,
          note: note.trim() || null,
          customer_name: NEEDS_CUSTOMER_INFO.includes(orderType) && customerName.trim() ? customerName.trim() : null,
          customer_phone: NEEDS_CUSTOMER_INFO.includes(orderType) && customerPhone.trim() ? customerPhone.trim() : null,
          covers: orderType === 'dine_in' ? (guestCount || 1) : null,
        };
        await addToQueue({ payload, tableName, orderType });
        showToast(`No internet. Order saved — will sync when online.`, 'warning');
        clearCart();
        router.back();
      } else {
        const msg = err.response?.data?.message || 'Failed to send order. Try again.';
        showToast(msg, 'error');
      }
    } finally {
      setSending(false);
    }
  };

  const buildOrderReceiptData = (payMethod) => {
    const s = settings || {};
    const apiBase = BASE_URL.replace(/\/api$/, '');
    const logoUrl = s.receipt_logo ? `${apiBase}${s.receipt_logo}` : undefined;
    const taxPct = (() => {
      if (s.pos_mode === 'category' && s.pos_tax_config) {
        const cat = s.pos_tax_config[getCatKey(orderType)] || {};
        if (!cat.tax_enabled) return 0;
      }
      if (payMethod === 'card')   return parseFloat(s.tax_on_card   || s.tax_rate || 0);
      if (payMethod === 'online') return parseFloat(s.tax_on_online || s.tax_rate || 0);
      return parseFloat(s.tax_on_cash || s.tax_rate || 0);
    })();
    const taxAmt = Math.round(subtotal * taxPct / 100 * 100) / 100;
    const addAmt = Math.round(subtotal * additionalPercent / 100 * 100) / 100;
    const total  = Math.round((subtotal + taxAmt + addAmt) * 100) / 100;
    const isPaid = saleInfo?.status === 'completed';
    return {
      docType:        'sale',
      docNumber:      saleInfo?.invoice_no,
      tokenNo:        saleInfo?.token_no,
      date:           saleInfo?.sale_date ? new Date(saleInfo.sale_date).toLocaleString('en-PK') : new Date().toLocaleString('en-PK'),
      storeName:      s.store_name || 'Restaurant',
      storeAddress:   s.address,
      storePhone:     s.phone,
      logoUrl,
      currencySymbol: s.currency_symbol || 'Rs.',
      footer:         s.receipt_footer,
      cashierName:    saleInfo?.cashier_name,
      customerName:   saleInfo?.customer_name || (NEEDS_CUSTOMER_INFO.includes(orderType) ? customerName : undefined),
      tableNo:        saleInfo?.table_name || tableName,
      orderType:      ORDER_TYPE_LABEL[orderType] || orderType,
      status:         isPaid ? 'PAID' : 'UNPAID',
      items:          items.map((i) => ({ name: i.product_name, quantity: i.quantity, price: i.unit_price, note: i.note || undefined })),
      subtotal,
      taxAmount:      taxAmt || undefined,
      taxPercent:     taxPct || undefined,
      chargesAmount:  addAmt || undefined,
      totalAmount:    total,
      amountPaid:     isPaid ? total : undefined,
      paymentMethod:  payMethod,
    };
  };

  const buildKOTData = (token) => {
    const s = settings || {};
    return {
      docType:   'kot',
      tokenNo:   token || saleInfo?.token_no || '—',
      tableNo:   tableName,
      orderType: ORDER_TYPE_LABEL[orderType] || orderType,
      date:      new Date().toLocaleString('en-PK'),
      storeName: s.store_name || 'Restaurant',
      items: items.map((i) => ({ name: i.product_name, quantity: i.quantity, note: i.note || undefined })),
    };
  };

  const handleKOTPrint = async (data) => {
    try {
      await api.post('/settings/print-queue', {
        type: 'kot',
        receiptData: {
          storeName:  data.storeName,
          tokenNo:    data.tokenNo,
          tableName:  data.tableNo || '',
          orderType:  data.orderType || '',
          date:       data.date,
          items:      data.items.map((i) => ({ name: i.name, quantity: i.quantity, note: i.note || '' })),
        },
      });
      haptic();
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.response?.data?.message || 'Could not reach printer' };
    }
  };

  const handleKOTClose = () => {
    setKotModalData(null);
    clearCart();
    router.back();
  };

  const handlePrintFromModal = async (data) => {
    try {
      await api.post('/settings/print-queue', {
        type: 'invoice',
        receiptData: {
          storeName:      data.storeName,
          storeAddress:   data.storeAddress || '',
          storePhone:     data.storePhone || '',
          saleId:         saleInfo?.sale_id,
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

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>Loading menu...</Text>
      </View>
    );
  }

  const showCustomerInfo = NEEDS_CUSTOMER_INFO.includes(orderType) && !isEditMode;
  const showGuestCount   = orderType === 'dine_in' && !isEditMode;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTable}>{tableName}</Text>
          <Text style={styles.headerSub}>
            {ORDER_TYPE_LABEL[orderType] || orderType}
            {isEditMode ? '  •  Editing order' : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {(isEditMode || items.length > 0) && (
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => { haptic(); setCartVisible(false); setPayModalVisible(true); }}
              activeOpacity={0.7}
            >
              <Ionicons name="receipt-outline" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cartIconBtn} onPress={() => { haptic(); setCartVisible(true); }} activeOpacity={0.7}>
            <Ionicons name="cart-outline" size={23} color="#FFFFFF" />
            {totalItems > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Edit mode notice */}
      {isEditMode && (
        <View style={styles.editBar}>
          <Ionicons name="create-outline" size={14} color={C.amber} />
          <Text style={styles.editBarText}>
            Editing order — tap + or − to adjust quantities, or trash to remove items
          </Text>
        </View>
      )}

      {/* Category tabs */}
      <View style={styles.catBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
          <TouchableOpacity
            style={[styles.catTab, selectedCat === null && styles.catTabActive]}
            onPress={() => setSelectedCat(null)}
          >
            <Text style={[styles.catTabText, selectedCat === null && styles.catTabTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.category_id}
              style={[styles.catTab, selectedCat === cat.category_id && styles.catTabActive]}
              onPress={() => setSelectedCat(cat.category_id)}
            >
              <Text style={[styles.catTabText, selectedCat === cat.category_id && styles.catTabTextActive]}>
                {cat.category_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={17} color={C.t3} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search menu items..."
          placeholderTextColor={C.t3}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={17} color={C.t3} />
          </TouchableOpacity>
        )}
      </View>

      {/* Product grid */}
      <FlatList
        data={displayProducts}
        keyExtractor={(item) => String(item.product_id)}
        numColumns={2}
        contentContainerStyle={[
          styles.productGrid,
          { paddingBottom: totalItems > 0 ? 100 : 24 },
        ]}
        columnWrapperStyle={styles.productRow}
        ListEmptyComponent={
          <View style={styles.searchEmpty}>
            <Ionicons name="search-outline" size={36} color={C.t3} />
            <Text style={styles.searchEmptyTitle}>No items found</Text>
            <Text style={styles.searchEmptySub}>Try a different name or category</Text>
          </View>
        }
        renderItem={({ item }) => {
          const inCart = items.find((i) => i.product_id === item.product_id);
          const price = parseFloat(item.selling_price || item.price || 0);
          return (
            <TouchableOpacity
              style={[styles.prodCard, inCart && styles.prodCardActive]}
              onPress={() => { haptic(); addItem(item); }}
              activeOpacity={0.85}
            >
              {inCart && (
                <View style={styles.prodCheckBadge}>
                  <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                </View>
              )}
              {inCart?.note ? (
                <View style={styles.prodNoteDot}>
                  <Ionicons name="chatbubble" size={7} color="#FFFFFF" />
                </View>
              ) : null}
              <Text style={[styles.prodName, inCart && styles.prodNameActive]} numberOfLines={2}>
                {item.product_name}
              </Text>
              <Text style={[styles.prodPrice, inCart && styles.prodPriceActive]}>
                PKR {price.toFixed(0)}
              </Text>
              {inCart ? (
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => { haptic(); decrementItem(item.product_id); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="remove" size={15} color={C.primary} />
                  </TouchableOpacity>
                  <Text style={styles.qtyNum}>{inCart.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => { haptic(); incrementItem(item.product_id); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="add" size={15} color={C.primary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.addRow}>
                  <Ionicons name="add-circle-outline" size={22} color={C.primary} />
                  <Text style={styles.addText}>Add</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Bottom bar */}
      {totalItems > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <View>
            <Text style={styles.bottomCount}>
              {totalItems} item(s){taxPercent > 0 ? `  •  Tax ${taxPercent.toFixed(1)}%` : ''}
            </Text>
            <Text style={styles.bottomTotal}>PKR {totalAmount.toFixed(0)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, { flex: 0, paddingHorizontal: 20 }]}
            onPress={() => { haptic(); handleSendOrder(); }}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="send" size={17} color="#FFFFFF" />
                <Text style={styles.sendBtnText}>
                  {isEditMode ? 'Update Order' : 'Send to Kitchen'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Payment Method Modal */}
      <Modal
        visible={payModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPayModalVisible(false)}
      >
        <View style={styles.modalWrap}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setPayModalVisible(false)} />
          <View style={[styles.cartSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Payment Type</Text>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setPayModalVisible(false)}>
                <Ionicons name="close" size={18} color={C.t2} />
              </TouchableOpacity>
            </View>
            <Text style={styles.paySubText}>
              How will the customer pay? This will appear on the bill.
            </Text>
            <View style={styles.payGrid}>
              {PAYMENT_METHODS.map((pm) => (
                <TouchableOpacity
                  key={pm.value}
                  style={[styles.payCard, { backgroundColor: pm.bg, borderColor: pm.border }]}
                  onPress={() => {
                    haptic();
                    setSelectedPayMethod(pm.value);
                    setPayModalVisible(false);
                    setReceiptModalData(buildOrderReceiptData(pm.value));
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

      {/* Cart modal */}
      <Modal
        visible={cartVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCartVisible(false)}
      >
        <View style={styles.modalWrap}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setCartVisible(false)} />
          <View style={[styles.cartSheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Cart</Text>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setCartVisible(false)}>
                <Ionicons name="close" size={18} color={C.t2} />
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <View style={styles.cartEmpty}>
                <Ionicons name="cart-outline" size={52} color={C.t3} />
                <Text style={styles.cartEmptyText}>Cart is empty</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: SCREEN_H * 0.52 }} keyboardShouldPersistTaps="handled">

                {/* Customer info section for takeaway/delivery */}
                {showCustomerInfo && (
                  <View style={styles.customerSection}>
                    <View style={styles.customerSectionHeader}>
                      <Ionicons name="person-circle-outline" size={16} color={C.t2} />
                      <Text style={styles.customerSectionTitle}>Customer Info</Text>
                      <Text style={styles.customerSectionSub}>(Optional)</Text>
                    </View>
                    <View style={styles.customerFieldRow}>
                      <View style={[styles.customerField, { flex: 1.4 }]}>
                        <Ionicons name="person-outline" size={14} color={C.t3} style={styles.customerFieldIcon} />
                        <TextInput
                          style={styles.customerFieldInput}
                          placeholder="Customer name"
                          placeholderTextColor={C.t3}
                          value={customerName}
                          onChangeText={(v) => setCustomerInfo(v, customerPhone)}
                          autoCorrect={false}
                          returnKeyType="next"
                        />
                      </View>
                      <View style={[styles.customerField, { flex: 1 }]}>
                        <Ionicons name="call-outline" size={14} color={C.t3} style={styles.customerFieldIcon} />
                        <TextInput
                          style={styles.customerFieldInput}
                          placeholder="Phone"
                          placeholderTextColor={C.t3}
                          value={customerPhone}
                          onChangeText={(v) => setCustomerInfo(customerName, v)}
                          keyboardType="phone-pad"
                          returnKeyType="done"
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* Guest count (dine-in only) */}
                {showGuestCount && (
                  <View style={styles.customerSection}>
                    <View style={styles.customerSectionHeader}>
                      <Ionicons name="people-outline" size={16} color={C.t2} />
                      <Text style={styles.customerSectionTitle}>Covers / Guests</Text>
                    </View>
                    <View style={styles.guestCountRow}>
                      <TouchableOpacity
                        style={styles.guestBtn}
                        onPress={() => setGuestCount(Math.max(1, guestCount - 1))}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="remove" size={16} color={C.primary} />
                      </TouchableOpacity>
                      <View style={styles.guestCountBox}>
                        <Text style={styles.guestCountNum}>{guestCount}</Text>
                        <Text style={styles.guestCountLabel}>guest{guestCount !== 1 ? 's' : ''}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.guestBtn}
                        onPress={() => setGuestCount(guestCount + 1)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="add" size={16} color={C.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Cart items */}
                {items.map((item) => (
                  <View key={item.product_id} style={styles.cartItemWrap}>
                    <View style={styles.cartItem}>
                      <TouchableOpacity
                        style={styles.cartTrashBtn}
                        onPress={() => showConfirm({
                          title: `Remove "${item.product_name}"?`,
                          message: 'This item will be removed from your cart.',
                          onConfirm: () => { haptic(); removeItem(item.product_id); },
                        })}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="trash-outline" size={14} color={C.red} />
                      </TouchableOpacity>
                      <Text style={styles.cartItemName} numberOfLines={2}>{item.product_name}</Text>
                      <View style={styles.cartItemRight}>
                        <View style={styles.qtyRow}>
                          <TouchableOpacity style={styles.qtyBtn} onPress={() => decrementItem(item.product_id)}>
                            <Ionicons name="remove" size={15} color={C.primary} />
                          </TouchableOpacity>
                          <Text style={styles.qtyNum}>{item.quantity}</Text>
                          <TouchableOpacity style={styles.qtyBtn} onPress={() => incrementItem(item.product_id)}>
                            <Ionicons name="add" size={15} color={C.primary} />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.cartItemTotal}>
                          PKR {(item.unit_price * item.quantity).toFixed(0)}
                        </Text>
                      </View>
                    </View>

                    {/* Per-item note toggle */}
                    <TouchableOpacity
                      style={styles.itemNoteToggle}
                      onPress={() => setOpenNoteId(openNoteId === item.product_id ? null : item.product_id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={item.note ? 'chatbubble' : 'chatbubble-outline'}
                        size={12}
                        color={item.note ? C.primary : C.t3}
                      />
                      <Text style={[styles.itemNoteToggleText, item.note && { color: C.primary }]}>
                        {item.note ? item.note : 'Add note'}
                      </Text>
                      <Ionicons
                        name={openNoteId === item.product_id ? 'chevron-up' : 'chevron-down'}
                        size={12}
                        color={C.t3}
                      />
                    </TouchableOpacity>

                    {openNoteId === item.product_id && (
                      <View style={styles.itemNoteInputWrap}>
                        <TextInput
                          style={styles.itemNoteInput}
                          placeholder="e.g. no onion, extra spicy..."
                          placeholderTextColor={C.t3}
                          value={item.note || ''}
                          onChangeText={(v) => updateItemNote(item.product_id, v)}
                          multiline={false}
                          returnKeyType="done"
                          onSubmitEditing={() => setOpenNoteId(null)}
                          autoFocus
                        />
                      </View>
                    )}
                  </View>
                ))}

                {/* Order-level note */}
                {!isEditMode && (
                  <View style={styles.noteWrap}>
                    <Text style={styles.noteLabel}>Order Note (optional)</Text>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Special instructions for the whole order..."
                      placeholderTextColor={C.t3}
                      value={note}
                      onChangeText={setNote}
                      multiline
                    />
                  </View>
                )}
              </ScrollView>
            )}

            {items.length > 0 && (
              <View style={styles.sheetFooter}>
                <View style={styles.sheetTotals}>
                  <View style={styles.taxRow}>
                    <Text style={styles.taxLabel}>Subtotal</Text>
                    <Text style={styles.taxValue}>PKR {subtotal.toFixed(0)}</Text>
                  </View>
                  {taxPercent > 0 && (
                    <View style={styles.taxRow}>
                      <Text style={styles.taxLabel}>Tax ({taxPercent.toFixed(1)}%)</Text>
                      <Text style={styles.taxValue}>PKR {taxAmount.toFixed(0)}</Text>
                    </View>
                  )}
                  <View style={[styles.taxRow, { marginTop: 4 }]}>
                    <Text style={styles.sheetTotalLabel}>Total</Text>
                    <Text style={styles.sheetTotalAmount}>PKR {totalAmount.toFixed(0)}</Text>
                  </View>
                </View>
                <View style={styles.sheetBtns}>
                  <TouchableOpacity
                    style={styles.viewBillBtn}
                    onPress={() => { haptic(); setCartVisible(false); setPayModalVisible(true); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="receipt-outline" size={16} color={C.purple} />
                    <Text style={styles.viewBillBtnText}>View Bill</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={() => { setCartVisible(false); handleSendOrder(); }}
                    disabled={sending}
                  >
                    {sending ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="send" size={17} color="#FFFFFF" />
                        <Text style={styles.sendBtnText}>
                          {isEditMode ? 'Update Order' : 'Send to Kitchen'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* KOT Modal — shown after order sent/updated */}
      {kotModalData && (
        <ReceiptModal
          data={kotModalData}
          onClose={handleKOTClose}
          onPrint={handleKOTPrint}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg, gap: 12,
  },
  loadingText: { color: C.t2, fontSize: 14, marginTop: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.primaryHd, paddingHorizontal: 14,
    paddingVertical: 14, gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTable: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  cartIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: C.red, minWidth: 16, height: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: C.primaryHd,
  },
  cartBadgeText: { fontSize: 9, color: '#FFF', fontWeight: '800' },

  editBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.amberBg, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.amberBd,
  },
  editBarText: { fontSize: 12, color: C.amber, flex: 1, fontWeight: '500' },

  catBar: {
    backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  catScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catTab: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
  },
  catTabActive: { backgroundColor: C.primary, borderColor: C.primary },
  catTabText: { fontSize: 13, color: C.t2, fontWeight: '600' },
  catTabTextActive: { color: '#FFFFFF', fontWeight: '700' },

  productGrid: { padding: 12 },
  productRow: { gap: 10 },
  prodCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 18,
    padding: 14, marginBottom: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border,
    ...shadow.sm,
  },
  prodCardActive: {
    borderColor: C.primary, backgroundColor: C.primaryLt,
    borderWidth: 2,
  },
  prodCheckBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  prodNoteDot: {
    position: 'absolute', top: 8, left: 8,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center',
  },
  prodName: {
    fontSize: 13, fontWeight: '700', color: C.t1,
    textAlign: 'center', marginBottom: 5, minHeight: 36, lineHeight: 18,
  },
  prodNameActive: { color: C.primaryDk },
  prodPrice: { fontSize: 15, fontWeight: '800', color: C.primary, marginBottom: 10, letterSpacing: -0.3 },
  prodPriceActive: { color: C.primaryDk },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.primaryLt, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.primaryBd,
  },
  qtyNum: { fontSize: 15, fontWeight: '800', color: C.t1, minWidth: 22, textAlign: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addText: { fontSize: 13, color: C.primary, fontWeight: '700' },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: C.border,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 8,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  bottomCount: { fontSize: 12, color: C.t3, marginBottom: 2 },
  bottomTotal: { fontSize: 22, fontWeight: '800', color: C.t1, letterSpacing: -0.5 },
  sendBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, paddingVertical: 14,
    borderRadius: 14,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  sendBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  cartSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: SCREEN_H * 0.88,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginTop: 12,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderLt,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: C.t1, letterSpacing: -0.3 },
  sheetCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  cartEmpty: { alignItems: 'center', padding: 48, gap: 10 },
  cartEmptyText: { color: C.t2, fontSize: 15, fontWeight: '600' },

  // Customer info
  customerSection: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    padding: 12,
  },
  customerSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  customerSectionTitle: { fontSize: 13, fontWeight: '700', color: C.t1 },
  customerSectionSub: { fontSize: 11, color: C.t3, fontWeight: '500' },
  customerFieldRow: { flexDirection: 'row', gap: 8 },
  customerField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border,
    height: 40, paddingRight: 10,
  },
  customerFieldIcon: { paddingHorizontal: 10 },
  customerFieldInput: { flex: 1, fontSize: 13, color: C.t1, height: 40 },

  // Guest count
  guestCountRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  guestBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.primaryLt, borderWidth: 1.5, borderColor: C.primaryBd,
    alignItems: 'center', justifyContent: 'center',
  },
  guestCountBox: { alignItems: 'center' },
  guestCountNum: { fontSize: 28, fontWeight: '800', color: C.t1, letterSpacing: -1 },
  guestCountLabel: { fontSize: 11, color: C.t3, fontWeight: '500', marginTop: -2 },

  // Cart items
  cartItemWrap: {
    borderBottomWidth: 1, borderBottomColor: C.borderLt,
  },
  cartItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 20, gap: 12,
  },
  cartTrashBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#FCA5A5',
    flexShrink: 0,
  },
  cartItemName: { flex: 1, fontSize: 14, fontWeight: '600', color: C.t1, lineHeight: 20 },
  cartItemRight: { alignItems: 'flex-end', gap: 6 },
  cartItemTotal: { fontSize: 13, fontWeight: '800', color: C.primary },

  // Per-item note
  itemNoteToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  itemNoteToggleText: {
    flex: 1, fontSize: 11.5, color: C.t3, fontStyle: 'italic',
  },
  itemNoteInputWrap: {
    paddingHorizontal: 20, paddingBottom: 10,
  },
  itemNoteInput: {
    borderWidth: 1.5, borderColor: C.primaryBd, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 13, color: C.t1,
    backgroundColor: C.primaryLt,
  },

  noteWrap: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  noteLabel: {
    fontSize: 11, fontWeight: '700', color: C.t3,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    padding: 12, fontSize: 14, color: C.t1,
    minHeight: 64, backgroundColor: C.surface, textAlignVertical: 'top',
  },
  sheetFooter: {
    flexDirection: 'column',
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: C.borderLt,
  },
  sheetTotalLabel: { fontSize: 13, fontWeight: '700', color: C.t1 },
  sheetTotalAmount: { fontSize: 20, fontWeight: '800', color: C.t1, letterSpacing: -0.4 },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  taxLabel: { fontSize: 12, color: C.t3 },
  taxValue: { fontSize: 12, color: C.t2, fontWeight: '600' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: 12, marginTop: 10, marginBottom: 2,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    paddingRight: 10, height: 44,
    ...shadow.sm,
  },
  searchIcon: { paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, color: C.t1, height: 44 },
  searchClear: { padding: 4 },

  searchEmpty: {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 60, gap: 8,
  },
  searchEmptyTitle: { fontSize: 16, fontWeight: '700', color: C.t1 },
  searchEmptySub: { fontSize: 13, color: C.t3 },

  // Header actions
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Cart sheet footer
  sheetTotals: { flex: 1 },
  sheetBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  viewBillBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: 14,
    backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#C4B5FD',
  },
  viewBillBtnText: { fontSize: 13, fontWeight: '700', color: C.purple },

  // Payment modal
  paySubText: {
    fontSize: 13, color: C.t2, textAlign: 'center',
    paddingHorizontal: 20, marginBottom: 20, lineHeight: 20,
  },
  payGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
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
});
