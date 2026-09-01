import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import useAuthStore from '../../../store/authStore';
import { C, shadow } from '../../../constants/theme';

const ORDER_TYPE_LABEL = { dine_in: 'Dine In', takeaway: 'Takeaway', on_spot: 'Walk-in' };
const ORDER_TYPE_COLOR = {
  dine_in:  { color: C.primary, bg: C.primaryLt, border: C.primaryBd, icon: 'restaurant' },
  takeaway: { color: C.amber,   bg: C.amberBg,   border: C.amberBd,   icon: 'bag-handle' },
  on_spot:  { color: C.blue,    bg: C.blueBg,     border: C.blueBd,    icon: 'walk'       },
};

const PAY_ICON = { cash: 'cash-outline', card: 'card-outline', online: 'phone-portrait-outline' };

export default function ReportScreen() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/sales/today');
      const all = Array.isArray(res.data) ? res.data : [];
      const myId = user?.user_id;
      const orders = myId ? all.filter((o) => Number(o.user_id) === Number(myId)) : all;

      const totalRevenue  = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
      const totalDiscount = orders.reduce((s, o) => s + parseFloat(o.discount || 0), 0);
      const avgValue      = orders.length > 0 ? totalRevenue / orders.length : 0;

      // Order type breakdown
      const byType = {};
      for (const o of orders) {
        const t = o.order_type || 'on_spot';
        byType[t] = (byType[t] || 0) + 1;
      }

      // Payment method breakdown
      const byPayment = {};
      for (const o of orders) {
        const p = o.payment_method || 'cash';
        byPayment[p] = (byPayment[p] || { count: 0, revenue: 0 });
        byPayment[p].count++;
        byPayment[p].revenue += parseFloat(o.total_amount || 0);
      }

      // Hourly distribution (0-23)
      const byHour = Array(24).fill(0);
      for (const o of orders) {
        if (o.sale_date) {
          const h = new Date(o.sale_date).getHours();
          byHour[h]++;
        }
      }
      const peakHour = byHour.indexOf(Math.max(...byHour));
      const peakCount = byHour[peakHour];

      setData({ orders, totalRevenue, totalDiscount, avgValue, byType, byPayment, byHour, peakHour, peakCount });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const todayStr = new Date().toLocaleDateString('en-PK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>Loading report...</Text>
      </View>
    );
  }

  if (!data || data.orders.length === 0) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.emptyWrap}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[C.primary]} />}
      >
        <View style={styles.emptyIcon}>
          <Ionicons name="bar-chart-outline" size={38} color={C.t3} />
        </View>
        <Text style={styles.emptyTitle}>No Sales Today</Text>
        <Text style={styles.emptySub}>Your completed orders will appear here</Text>
        <Text style={styles.emptySub2}>{todayStr}</Text>
      </ScrollView>
    );
  }

  const maxHourCount = Math.max(...data.byHour, 1);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[C.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Date header */}
      <View style={styles.dateHeader}>
        <View style={styles.dateLeft}>
          <Text style={styles.dateTitle}>My Shift Report</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.5)" />
            <Text style={styles.dateStr}>{todayStr}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => { setRefreshing(true); load(); }}
        >
          <Ionicons name="refresh-outline" size={18} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      {/* Key metrics */}
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, styles.metricCardPrimary]}>
          <Ionicons name="receipt-outline" size={22} color={C.primary} />
          <Text style={styles.metricNum}>{data.orders.length}</Text>
          <Text style={styles.metricLabel}>Total Orders</Text>
        </View>
        <View style={[styles.metricCard, styles.metricCardGreen]}>
          <Ionicons name="cash-outline" size={22} color="#059669" />
          <Text style={[styles.metricNum, { color: '#059669' }]}>
            {data.totalRevenue >= 1000
              ? `${(data.totalRevenue / 1000).toFixed(1)}k`
              : data.totalRevenue.toFixed(0)}
          </Text>
          <Text style={styles.metricLabel}>Revenue (PKR)</Text>
        </View>
        <View style={[styles.metricCard, styles.metricCardBlue]}>
          <Ionicons name="trending-up-outline" size={22} color={C.blue} />
          <Text style={[styles.metricNum, { color: C.blue }]}>
            {data.avgValue >= 1000
              ? `${(data.avgValue / 1000).toFixed(1)}k`
              : data.avgValue.toFixed(0)}
          </Text>
          <Text style={styles.metricLabel}>Avg. Order</Text>
        </View>
        {data.totalDiscount > 0 && (
          <View style={[styles.metricCard, styles.metricCardAmber]}>
            <Ionicons name="pricetag-outline" size={22} color={C.amber} />
            <Text style={[styles.metricNum, { color: C.amber }]}>
              {data.totalDiscount.toFixed(0)}
            </Text>
            <Text style={styles.metricLabel}>Total Disc.</Text>
          </View>
        )}
      </View>

      {/* Order Type Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>By Order Type</Text>
        <View style={styles.typeCards}>
          {Object.entries(ORDER_TYPE_COLOR).map(([type, style]) => {
            const count = data.byType[type] || 0;
            const pct   = data.orders.length > 0 ? Math.round((count / data.orders.length) * 100) : 0;
            return (
              <View key={type} style={[styles.typeCard, { borderColor: style.border, backgroundColor: style.bg }]}>
                <View style={[styles.typeIcon, { backgroundColor: style.color + '20' }]}>
                  <Ionicons name={style.icon} size={18} color={style.color} />
                </View>
                <Text style={[styles.typeNum, { color: style.color }]}>{count}</Text>
                <Text style={styles.typeName}>{ORDER_TYPE_LABEL[type]}</Text>
                <Text style={[styles.typePct, { color: style.color }]}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Payment Method Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Methods</Text>
        <View style={styles.payList}>
          {Object.entries(data.byPayment).map(([method, stats]) => {
            const pct = data.orders.length > 0 ? (stats.count / data.orders.length) * 100 : 0;
            return (
              <View key={method} style={styles.payRow}>
                <View style={styles.payLeft}>
                  <View style={styles.payIconWrap}>
                    <Ionicons name={PAY_ICON[method] || 'wallet-outline'} size={16} color={C.primary} />
                  </View>
                  <View>
                    <Text style={styles.payMethod}>{method.charAt(0).toUpperCase() + method.slice(1)}</Text>
                    <Text style={styles.payCount}>{stats.count} order{stats.count !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <View style={styles.payRight}>
                  <Text style={styles.payRevenue}>PKR {stats.revenue.toFixed(0)}</Text>
                  <View style={styles.payBarWrap}>
                    <View style={[styles.payBar, { width: `${pct}%` }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Hourly Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Hourly Activity</Text>
          {data.peakCount > 0 && (
            <View style={styles.peakBadge}>
              <Ionicons name="flash" size={11} color={C.amber} />
              <Text style={styles.peakBadgeText}>
                Peak: {data.peakHour}:00 ({data.peakCount} orders)
              </Text>
            </View>
          )}
        </View>
        <View style={styles.hourChart}>
          {data.byHour.map((count, h) => {
            const barH = maxHourCount > 0 ? (count / maxHourCount) * 60 : 0;
            const isActive = count > 0;
            const isPeak   = h === data.peakHour && count > 0;
            return (
              <View key={h} style={styles.hourCol}>
                <View style={styles.hourBarWrap}>
                  {isActive && (
                    <View style={[styles.hourBar, { height: barH, backgroundColor: isPeak ? C.amber : C.primary }]} />
                  )}
                </View>
                {h % 3 === 0 ? (
                  <Text style={styles.hourLabel}>{h}</Text>
                ) : (
                  <Text style={styles.hourLabelEmpty}> </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 32 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: C.t2, fontSize: 14 },

  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.t1 },
  emptySub:   { fontSize: 13, color: C.t2 },
  emptySub2:  { fontSize: 12, color: C.t3, marginTop: 4 },

  // Date header
  dateHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.primaryHd,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22,
  },
  dateLeft:  { flex: 1 },
  dateTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4, marginBottom: 4 },
  dateRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateStr:   { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Metrics
  metricsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 16, marginTop: -14, marginBottom: 4,
  },
  metricCard: {
    flex: 1, minWidth: '43%',
    backgroundColor: C.card, borderRadius: 18,
    padding: 16, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: C.border, ...shadow.md,
  },
  metricCardPrimary: { borderColor: C.primaryBd },
  metricCardGreen:   { borderColor: '#6EE7B7' },
  metricCardBlue:    { borderColor: C.blueBd },
  metricCardAmber:   { borderColor: C.amberBd },
  metricNum:   { fontSize: 26, fontWeight: '800', color: C.primary, letterSpacing: -1 },
  metricLabel: { fontSize: 11, color: C.t3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

  // Sections
  section: {
    marginHorizontal: 16, marginTop: 20,
    backgroundColor: C.card, borderRadius: 20,
    padding: 16, borderWidth: 1, borderColor: C.border, ...shadow.sm,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: C.t1, letterSpacing: -0.2, marginBottom: 14 },

  // Order type cards
  typeCards: { flexDirection: 'row', gap: 10 },
  typeCard: {
    flex: 1, borderRadius: 16, borderWidth: 1.5,
    padding: 12, alignItems: 'center', gap: 4,
  },
  typeIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  typeNum:  { fontSize: 22, fontWeight: '800', letterSpacing: -1 },
  typeName: { fontSize: 10, color: C.t3, fontWeight: '600', textAlign: 'center' },
  typePct:  { fontSize: 12, fontWeight: '700' },

  // Payment
  payList: { gap: 10 },
  payRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 14,
    padding: 12, gap: 10,
  },
  payLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  payIconWrap: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: C.primaryLt, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.primaryBd,
  },
  payMethod:  { fontSize: 13, fontWeight: '700', color: C.t1 },
  payCount:   { fontSize: 11, color: C.t3, marginTop: 1 },
  payRight:   { alignItems: 'flex-end', gap: 5, minWidth: 80 },
  payRevenue: { fontSize: 13, fontWeight: '800', color: C.t1 },
  payBarWrap: { width: 72, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  payBar:     { height: 4, backgroundColor: C.primary, borderRadius: 2 },

  // Hourly chart
  peakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.amberBg, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: C.amberBd,
  },
  peakBadgeText: { fontSize: 10, fontWeight: '700', color: C.amber },
  hourChart: {
    flexDirection: 'row', alignItems: 'flex-end',
    height: 80, gap: 2,
  },
  hourCol:    { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  hourBarWrap: { height: 60, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  hourBar:    { width: '80%', borderRadius: 3, minHeight: 3 },
  hourLabel:  { fontSize: 8, color: C.t3, marginTop: 3, fontWeight: '600' },
  hourLabelEmpty: { fontSize: 8, color: 'transparent', marginTop: 3 },
});
