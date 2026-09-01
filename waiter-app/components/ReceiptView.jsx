import React from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, shadow } from '../constants/theme';

// ── Label maps ────────────────────────────────────────────────

const DOC_LABELS = {
  sale:        'SALES RECEIPT',
  quotation:   'QUOTATION',
  credit_sale: 'CREDIT SALE',
  return:      'RETURN RECEIPT',
  kot:         'KITCHEN ORDER',
};

const DOC_COLORS = {
  sale:        { bg: C.primaryLt,  border: C.primaryBd,  text: C.primary  },
  quotation:   { bg: C.blueBg,     border: C.blueBd,     text: C.blue     },
  credit_sale: { bg: C.amberBg,    border: C.amberBd,    text: C.amber    },
  return:      { bg: C.redBg,      border: C.redBd,      text: C.red      },
  kot:         { bg: '#FFF7ED',    border: '#FED7AA',    text: '#EA580C'  },
};

// ── Helpers ───────────────────────────────────────────────────

function fmt(n, cs = 'Rs.') {
  if (n == null) return '';
  return `${cs} ${Number(n).toFixed(2)}`;
}

function Divider() {
  return <View style={styles.divider} />;
}

function MetaRow({ label, value, bold }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={[styles.metaValue, bold && styles.metaValueBold]}>{value}</Text>
    </View>
  );
}

function AmountRow({ label, value, cs, bold, color }) {
  if (value == null || value === 0) return null;
  return (
    <View style={styles.amountRow}>
      <Text style={[styles.amountLabel, bold && styles.amountBold, color && { color }]}>{label}</Text>
      <Text style={[styles.amountValue, bold && styles.amountBold, color && { color }]}>{fmt(value, cs)}</Text>
    </View>
  );
}

function KOTItems({ items }) {
  const groups = {};
  for (const item of items) {
    const cat = item.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return (
    <View style={styles.itemsWrap}>
      {Object.entries(groups).map(([cat, catItems]) => (
        <View key={cat} style={styles.kotGroup}>
          <Text style={styles.kotCatLabel}>{cat.toUpperCase()}</Text>
          {catItems.map((item, i) => (
            <View key={i} style={styles.kotItem}>
              <Text style={styles.kotQty}>{item.quantity}x</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.kotName}>{item.name}</Text>
                {item.note ? <Text style={styles.itemNote}>* {item.note}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── ReceiptView ───────────────────────────────────────────────

export function ReceiptView({ data }) {
  const cs = data.currencySymbol || 'Rs.';
  const isKOT = data.docType === 'kot';
  const docColor = DOC_COLORS[data.docType] || DOC_COLORS.sale;

  return (
    <View style={styles.receipt}>

      {/* Logo */}
      {data.logoUrl ? (
        <View style={styles.logoWrap}>
          <Image source={{ uri: data.logoUrl }} style={styles.logo} resizeMode="contain" />
        </View>
      ) : null}

      {/* Store header */}
      <View style={styles.storeHeader}>
        <Text style={styles.storeName}>{(data.storeName || '').toUpperCase()}</Text>
        {data.storeAddress ? <Text style={styles.storeSub}>{data.storeAddress}</Text> : null}
        {data.storePhone   ? <Text style={styles.storeSub}>Tel: {data.storePhone}</Text> : null}
      </View>

      <Divider />

      {/* Doc type badge */}
      <View style={styles.badgeWrap}>
        <View style={[styles.badge, { backgroundColor: docColor.bg, borderColor: docColor.border }]}>
          <Text style={[styles.badgeText, { color: docColor.text }]}>
            {DOC_LABELS[data.docType] || data.docType.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Meta info */}
      <View style={styles.metaWrap}>
        <MetaRow
          label={data.docType === 'quotation' ? 'Quote #' : data.docType === 'return' ? 'Return #' : 'Invoice'}
          value={data.docNumber}
        />
        {data.status ? (
          <MetaRow label="Status" value={data.status.toUpperCase()} />
        ) : null}
        <MetaRow label="Token"    value={data.tokenNo}     bold />
        <MetaRow label="Date"     value={data.date} />
        <MetaRow label="Cashier"  value={data.cashierName} />
        <MetaRow label="Customer" value={data.customerName} />
        <MetaRow label="Table"    value={data.tableNo} />
        <MetaRow label="Type"     value={data.orderType} />
        <MetaRow label="Rider"    value={data.riderName} />
        <MetaRow label="Due Date" value={data.dueDate} />
        <MetaRow label="Reason"   value={data.reason} />
      </View>

      <Divider />

      {/* Items */}
      {isKOT ? (
        <KOTItems items={data.items} />
      ) : (
        <View style={styles.itemsWrap}>
          {/* Column header */}
          <View style={styles.itemHeader}>
            <Text style={[styles.itemHeaderText, { flex: 1 }]}>Item</Text>
            <Text style={[styles.itemHeaderText, { width: 32, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.itemHeaderText, { width: 80, textAlign: 'right' }]}>Price</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i}>
              <View style={styles.itemRow}>
                <Text style={[styles.itemName, { flex: 1 }]}>{item.name}</Text>
                <Text style={[styles.itemQty, { width: 32, textAlign: 'center' }]}>{item.quantity}</Text>
                <Text style={[styles.itemPrice, { width: 80, textAlign: 'right' }]}>
                  {item.price != null ? fmt(item.price, cs) : '—'}
                </Text>
              </View>
              {item.note ? <Text style={styles.itemNote}>* {item.note}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <Divider />

      {/* Totals (not for KOT) */}
      {!isKOT && (
        <View style={styles.totalsWrap}>
          <AmountRow label="Subtotal"                              value={data.subtotal}      cs={cs} />
          {data.discount    ? <AmountRow label="Discount"         value={-data.discount}     cs={cs} /> : null}
          {data.taxAmount   ? <AmountRow label={`Tax (${data.taxPercent ?? 0}%)`} value={data.taxAmount} cs={cs} /> : null}
          {data.chargesAmount ? <AmountRow label="Charges"        value={data.chargesAmount} cs={cs} /> : null}

          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{fmt(data.totalAmount, cs)}</Text>
          </View>

          {/* Payment */}
          {data.paymentMethod ? (
            <View style={styles.paymentBlock}>
              <AmountRow
                label={`Paid (${data.paymentMethod.toUpperCase()})`}
                value={data.amountPaid}
                cs={cs}
              />
              {(data.changeDue ?? 0) > 0
                ? <AmountRow label="Change Due" value={data.changeDue} cs={cs} />
                : null}
            </View>
          ) : null}

          {/* Credit balance */}
          {data.balanceDue != null ? (
            <View style={styles.paymentBlock}>
              <View style={styles.amountRow}>
                <Text style={[styles.amountLabel, styles.amountBold, { color: C.red }]}>Balance Due</Text>
                <Text style={[styles.amountValue, styles.amountBold, { color: C.red }]}>{fmt(data.balanceDue, cs)}</Text>
              </View>
            </View>
          ) : null}

          {/* Return refund */}
          {data.refundAmount != null ? (
            <View style={styles.paymentBlock}>
              <View style={styles.amountRow}>
                <Text style={[styles.amountLabel, styles.amountBold, { color: C.primary }]}>
                  Refund ({data.refundMethod || 'Cash'})
                </Text>
                <Text style={[styles.amountValue, styles.amountBold, { color: C.primary }]}>
                  {fmt(data.refundAmount, cs)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* Footer */}
      {data.footer ? (
        <>
          <Divider />
          <Text style={styles.footer}>{data.footer}</Text>
        </>
      ) : null}
    </View>
  );
}

// ── ReceiptModal ──────────────────────────────────────────────

export function ReceiptModal({ data, onClose, onPrint }) {
  const [printing, setPrinting] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const docColor = DOC_COLORS[data.docType] || DOC_COLORS.sale;

  const handlePrint = async () => {
    if (!onPrint) return;
    setPrinting(true);
    setMsg('');
    try {
      const result = await onPrint(data);
      setMsg(result?.success ? '✓ Sent to printer' : `✗ ${result?.error || 'Print failed'}`);
    } catch (e) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>

          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={[styles.badge, { backgroundColor: docColor.bg, borderColor: docColor.border }]}>
              <Text style={[styles.badgeText, { color: docColor.text }]}>
                {DOC_LABELS[data.docType] || data.docType.toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={C.t2} />
            </TouchableOpacity>
          </View>

          {/* Receipt scroll area */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ReceiptView data={data} />
          </ScrollView>

          {/* Footer actions */}
          <View style={styles.modalFooter}>
            {msg ? (
              <Text style={[styles.printMsg, msg.startsWith('✓') ? styles.printMsgOk : styles.printMsgErr]}>
                {msg}
              </Text>
            ) : null}
            <View style={styles.footerBtns}>
              <TouchableOpacity onPress={onClose} style={styles.btnClose} activeOpacity={0.7}>
                <Text style={styles.btnCloseText}>Close</Text>
              </TouchableOpacity>
              {onPrint ? (
                <TouchableOpacity
                  onPress={handlePrint}
                  disabled={printing}
                  style={[styles.btnPrint, printing && { opacity: 0.6 }]}
                  activeOpacity={0.8}
                >
                  {printing
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Ionicons name="print-outline" size={16} color="#FFFFFF" />
                  }
                  <Text style={styles.btnPrintText}>{printing ? 'Printing…' : 'Print'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ReceiptView
  receipt: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 260,
  },
  logoWrap: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 120, height: 60 },

  storeHeader: { alignItems: 'center', marginBottom: 10 },
  storeName: { fontSize: 15, fontWeight: '800', color: '#0F172A', letterSpacing: 1, textAlign: 'center' },
  storeSub:  { fontSize: 11, color: '#94A3B8', marginTop: 2, textAlign: 'center' },

  divider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', marginVertical: 6 },

  badgeWrap: { alignItems: 'center', marginVertical: 8 },
  badge: {
    paddingHorizontal: 14, paddingVertical: 3, borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },

  metaWrap: { gap: 3, marginBottom: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metaLabel: { fontSize: 11, color: '#94A3B8', flex: 1 },
  metaValue: { fontSize: 11, color: '#475569', flex: 2, textAlign: 'right' },
  metaValueBold: { fontSize: 14, fontWeight: '800', color: '#0F172A' },

  itemsWrap: { marginVertical: 8, gap: 4 },
  itemHeader: {
    flexDirection: 'row', paddingBottom: 6,
    borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1',
    marginBottom: 4,
  },
  itemHeaderText: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemName:  { fontSize: 12, color: '#1E293B', lineHeight: 18 },
  itemQty:   { fontSize: 12, color: '#475569' },
  itemPrice: { fontSize: 12, color: '#1E293B' },
  itemNote:  { fontSize: 10, color: '#94A3B8', paddingLeft: 8, lineHeight: 16 },

  kotGroup:    { marginBottom: 10 },
  kotCatLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
  kotItem:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 },
  kotQty:      { width: 28, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  kotName:     { fontSize: 14, color: '#1E293B' },

  totalsWrap: { marginVertical: 6, gap: 3 },
  amountRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 },
  amountLabel: { fontSize: 12, color: '#475569' },
  amountValue: { fontSize: 12, color: '#1E293B' },
  amountBold:  { fontWeight: '800', fontSize: 13 },

  totalDivider: { borderTopWidth: 2, borderColor: '#0F172A', marginTop: 4, marginBottom: 4 },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  totalValue: { fontSize: 16, fontWeight: '800', color: '#0F172A' },

  paymentBlock: {
    borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1',
    paddingTop: 5, marginTop: 4, gap: 2,
  },

  footer: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 8, lineHeight: 16 },

  // ReceiptModal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: C.card, borderRadius: 24,
    width: '100%', maxWidth: 400,
    maxHeight: '90%',
    ...shadow.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  scrollArea: { maxHeight: 480 },
  scrollContent: { padding: 4 },

  modalFooter: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: C.border,
    gap: 8,
  },
  printMsg: { fontSize: 12, textAlign: 'center', fontWeight: '600' },
  printMsgOk:  { color: C.primary },
  printMsgErr: { color: C.red },
  footerBtns: { flexDirection: 'row', gap: 10 },
  btnClose: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center',
  },
  btnCloseText: { fontSize: 14, fontWeight: '700', color: C.t2 },
  btnPrint: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    backgroundColor: C.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnPrintText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
