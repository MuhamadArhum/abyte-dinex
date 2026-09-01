import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useCartStore from '../../../store/cartStore';
import useAuthStore from '../../../store/authStore';
import useOfflineQueue from '../../../store/offlineQueue';
import api from '../../../services/api';
import { C, shadow } from '../../../constants/theme';

const { width } = Dimensions.get('window');

const ORDER_TYPES = [
  {
    value: 'dine_in',  label: 'Dine In',  icon: 'restaurant',
    color: C.primary, bg: C.primaryLt, border: C.primaryBd,
    desc: 'Select a free table',
  },
  {
    value: 'takeaway', label: 'Takeaway', icon: 'bag-handle',
    color: C.amber,   bg: C.amberBg,   border: C.amberBd,
    desc: 'Counter pickup',
  },
  {
    value: 'on_spot',  label: 'Walk-in',  icon: 'walk',
    color: C.blue,    bg: C.blueBg,    border: C.blueBd,
    desc: 'Immediate service',
  },
];

export default function HomeScreen() {
  const { clearCart, setTable } = useCartStore();
  const { user } = useAuthStore();
  const { queue, failedIds, syncing, syncQueue: syncNow, clearFailed } = useOfflineQueue();

  const [stats, setStats] = useState({ running: 0, todayOrders: 0, todayRevenue: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const load = async () => {
      setStatsLoading(true);
      try {
        const [pendingRes, todayRes] = await Promise.allSettled([
          api.get('/sales/pending'),
          api.get('/sales/today'),
        ]);
        if (cancelled) return;

        const myId = user?.user_id;
        const pending = pendingRes.status === 'fulfilled'
          ? (pendingRes.value.data?.data || pendingRes.value.data || [])
          : [];
        const myPending = myId ? pending.filter((o) => Number(o.user_id) === Number(myId)) : pending;

        const today = todayRes.status === 'fulfilled'
          ? (Array.isArray(todayRes.value.data) ? todayRes.value.data : [])
          : [];
        const myToday = myId ? today.filter((o) => Number(o.user_id) === Number(myId)) : today;
        const todayRevenue = myToday.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);

        setStats({ running: myPending.length, todayOrders: myToday.length, todayRevenue });
      } catch {
        // silently ignore — stats are optional
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]));

  const handleSelect = (type) => {
    clearCart();
    if (type.value === 'dine_in') {
      router.push(`/(main)/tables?orderType=dine_in`);
    } else {
      setTable(null, type.label, null);
      router.push(`/(main)/order/0?orderType=${type.value}&name=${encodeURIComponent(type.label)}`);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateStr = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });

  const pendingQueueCount = queue.length;
  const failedQueueCount  = failedIds.length;
  const hasQueueActivity  = pendingQueueCount > 0 || failedQueueCount > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Welcome Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerRing1} pointerEvents="none" />
        <View style={styles.bannerRing2} pointerEvents="none" />

        <View style={styles.bannerLeft}>
          <Text style={styles.bannerGreeting}>{greeting}</Text>
          <Text style={styles.bannerName}>{user?.name?.split(' ')[0] || 'Waiter'}</Text>
          <View style={styles.bannerDateRow}>
            <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.5)" />
            <Text style={styles.bannerDate}>{dateStr}</Text>
          </View>
        </View>
        <View style={styles.bannerAvatarWrap}>
          <View style={styles.bannerAvatar}>
            <Text style={styles.bannerAvatarText}>
              {(user?.name || user?.username || 'W')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.bannerOnlineDot} />
        </View>
      </View>

      {/* Shift Stats Row */}
      <View style={styles.statsRow}>
        {statsLoading ? (
          <View style={styles.statsLoading}>
            <ActivityIndicator size="small" color={C.primary} />
          </View>
        ) : (
          <>
            <View style={styles.statCard}>
              <Ionicons name="time-outline" size={18} color={C.amber} />
              <Text style={styles.statNum}>{stats.running}</Text>
              <Text style={styles.statLabel}>Running</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Ionicons name="receipt-outline" size={18} color={C.primary} />
              <Text style={styles.statNum}>{stats.todayOrders}</Text>
              <Text style={styles.statLabel}>Today's Sales</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Ionicons name="cash-outline" size={18} color="#059669" />
              <Text style={[styles.statNum, { fontSize: stats.todayRevenue >= 10000 ? 14 : 17 }]}>
                {stats.todayRevenue >= 1000
                  ? `${(stats.todayRevenue / 1000).toFixed(1)}k`
                  : stats.todayRevenue.toFixed(0)}
              </Text>
              <Text style={styles.statLabel}>Today's Rev.</Text>
            </View>
          </>
        )}
      </View>

      {/* Offline Queue Card */}
      {hasQueueActivity && (
        <View style={[styles.queueCard, failedQueueCount > 0 && styles.queueCardWarn]}>
          <View style={styles.queueCardLeft}>
            <Ionicons
              name={failedQueueCount > 0 ? 'warning-outline' : 'cloud-upload-outline'}
              size={20}
              color={failedQueueCount > 0 ? C.amber : C.primary}
            />
            <View>
              <Text style={styles.queueCardTitle}>
                {failedQueueCount > 0 ? 'Some orders failed to sync' : 'Orders pending sync'}
              </Text>
              <Text style={styles.queueCardSub}>
                {pendingQueueCount > 0 ? `${pendingQueueCount} queued` : ''}
                {pendingQueueCount > 0 && failedQueueCount > 0 ? '  •  ' : ''}
                {failedQueueCount > 0 ? `${failedQueueCount} failed` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.queueCardBtns}>
            {failedQueueCount > 0 && (
              <TouchableOpacity style={styles.queueClearBtn} onPress={clearFailed}>
                <Text style={styles.queueClearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.queueSyncBtn, syncing && { opacity: 0.6 }]}
              onPress={() => syncNow(api)}
              disabled={syncing}
            >
              {syncing
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <><Ionicons name="sync-outline" size={13} color="#FFFFFF" /><Text style={styles.queueSyncBtnText}>Sync</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Section heading */}
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>New Order</Text>
          <Text style={styles.sectionSub}>Choose how the customer will be served</Text>
        </View>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{ORDER_TYPES.length} types</Text>
        </View>
      </View>

      {/* Order Type Cards */}
      <View style={styles.grid}>
        {ORDER_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[styles.card, { borderColor: type.border }]}
            onPress={() => handleSelect(type)}
            activeOpacity={0.8}
          >
            <View style={[styles.cardIcon, { backgroundColor: type.color }]}>
              <Ionicons name={type.icon} size={26} color="#fff" />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardLabel, { color: type.color }]}>{type.label}</Text>
              <Text style={styles.cardDesc}>{type.desc}</Text>
            </View>
            <View style={[styles.cardArrow, { backgroundColor: type.bg }]}>
              <Ionicons name="arrow-forward" size={16} color={type.color} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 32 },

  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.primaryHd, overflow: 'hidden',
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 26,
  },
  bannerRing1: {
    position: 'absolute', right: -30, top: -30,
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bannerRing2: {
    position: 'absolute', right: 40, bottom: -50,
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  bannerLeft: { flex: 1 },
  bannerGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500', marginBottom: 3 },
  bannerName: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.6 },
  bannerDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  bannerDate: { fontSize: 12, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.2 },
  bannerAvatarWrap: { position: 'relative' },
  bannerAvatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  bannerAvatarText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  bannerOnlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#4ADE80',
    borderWidth: 2, borderColor: C.primaryHd,
  },

  // Shift stats
  statsRow: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: C.card, marginHorizontal: 16, marginTop: -1,
    borderRadius: 18, borderWidth: 1, borderColor: C.border,
    marginBottom: 2, ...shadow.md,
    overflow: 'hidden',
  },
  statsLoading: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 18,
  },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14, gap: 3,
  },
  statDivider: {
    width: 1, backgroundColor: C.borderLt, marginVertical: 10,
  },
  statNum: { fontSize: 17, fontWeight: '800', color: C.t1, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: C.t3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Offline queue card
  queueCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.primaryLt, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.primaryBd,
    marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  queueCardWarn: {
    backgroundColor: C.amberBg, borderColor: C.amberBd,
  },
  queueCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  queueCardTitle: { fontSize: 13, fontWeight: '700', color: C.t1 },
  queueCardSub: { fontSize: 11, color: C.t2, marginTop: 2 },
  queueCardBtns: { flexDirection: 'row', gap: 6 },
  queueClearBtn: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  queueClearBtnText: { fontSize: 12, fontWeight: '700', color: C.t2 },
  queueSyncBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, backgroundColor: C.primary,
  },
  queueSyncBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 14,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: C.t1, letterSpacing: -0.4 },
  sectionSub: { fontSize: 13, color: C.t2, marginTop: 3 },
  sectionBadge: {
    backgroundColor: C.primaryLt, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: C.primaryBd,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: C.primary },

  grid: {
    paddingHorizontal: 16, gap: 12,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.card,
    borderRadius: 18, borderWidth: 1.5,
    paddingVertical: 16, paddingHorizontal: 16,
    ...shadow.md,
  },
  cardIcon: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardLabel: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, marginBottom: 3 },
  cardDesc: { fontSize: 12, color: C.t3, lineHeight: 16 },
  cardArrow: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
});
