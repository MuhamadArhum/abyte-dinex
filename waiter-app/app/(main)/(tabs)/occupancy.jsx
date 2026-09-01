import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Animated, Vibration, ScrollView,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import useCartStore from '../../../store/cartStore';
import { C, shadow } from '../../../constants/theme';

const haptic = () => Vibration.vibrate(8);

// ─── helpers ─────────────────────────────────────────────────────────────────
function getElapsed(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getElapsedMins(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function getUrgencyColor(mins) {
  if (mins >= 45) return { color: C.red,   bg: '#FEF2F2', border: '#FECACA', dot: C.red   };
  if (mins >= 20) return { color: C.amber,  bg: C.amberBg, border: C.amberBd, dot: C.amber };
  return              { color: C.primary, bg: C.primaryLt, border: C.primaryBd, dot: '#4ADE80' };
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function SkeletonBox({ style }) {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ backgroundColor: '#E2E8F0', borderRadius: 10 }, style, { opacity: op }]} />;
}

function OccupancySkeleton({ viewMode = 'card' }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={sk.summaryBar}>
        <SkeletonBox style={{ width: 120, height: 14, borderRadius: 7 }} />
        <SkeletonBox style={{ width: 80, height: 14, borderRadius: 7 }} />
      </View>
      <View style={sk.chipRow}>
        {[0,1,2].map((i) => <SkeletonBox key={i} style={{ width: 70, height: 32, borderRadius: 20 }} />)}
      </View>
      {viewMode === 'card' ? (
        <View style={sk.grid}>
          {[0,1,2,3,4,5].map((i) => (
            <View key={i} style={sk.card}>
              <SkeletonBox style={{ width: 44, height: 44, borderRadius: 14, marginBottom: 10 }} />
              <SkeletonBox style={{ width: 80, height: 14, marginBottom: 6 }} />
              <SkeletonBox style={{ width: 55, height: 11, marginBottom: 10 }} />
              <SkeletonBox style={{ width: 90, height: 28, borderRadius: 14 }} />
            </View>
          ))}
        </View>
      ) : (
        <View style={sk.listWrap}>
          {[0,1,2,3,4,5].map((i) => (
            <View key={i} style={sk.listRow}>
              <SkeletonBox style={{ width: 44, height: 44, borderRadius: 13 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBox style={{ width: '50%', height: 14 }} />
                <SkeletonBox style={{ width: '30%', height: 11 }} />
              </View>
              <SkeletonBox style={{ width: 70, height: 26, borderRadius: 20 }} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const sk = StyleSheet.create({
  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.card, paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  chipRow: { flexDirection: 'row', gap: 8, padding: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 14, gap: 12 },
  card: {
    flex: 1, minWidth: '44%', backgroundColor: C.card,
    borderRadius: 20, padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border, ...shadow.md,
  },
  listWrap: { padding: 14, gap: 10 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OccupancyScreen() {
  const [tables, setTables]         = useState([]);
  const [orderMap, setOrderMap]     = useState({});
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFloor, setActiveFloor] = useState('All');
  const [viewMode, setViewMode]     = useState('card');
  const [tick, setTick]             = useState(0);
  const [updatingId, setUpdatingId] = useState(null);
  const { setTable }                = useCartStore();

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const [tablesRes, pendingRes] = await Promise.allSettled([
        api.get('/restaurant/tables'),
        api.get('/sales/pending'),
      ]);
      const allTables    = tablesRes.status === 'fulfilled' ? (tablesRes.value.data || []) : [];
      const pendingSales = pendingRes.status === 'fulfilled'
        ? (pendingRes.value.data?.data || pendingRes.value.data || []) : [];
      const map = {};
      (Array.isArray(pendingSales) ? pendingSales : []).forEach((sale) => {
        if (sale.table_id) map[sale.table_id] = sale;
      });
      setTables(Array.isArray(allTables) ? allTables : []);
      setOrderMap(map);
    } catch (err) {
      console.error('occupancy load error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]));

  const updateTableStatus = async (tableId, status) => {
    haptic();
    setUpdatingId(tableId);
    try {
      await api.patch(`/restaurant/tables/${tableId}/status`, { status });
      setTables((prev) => prev.map((t) => t.table_id === tableId ? { ...t, status } : t));
    } catch {
      // silently ignore — next auto-refresh will correct state
    } finally {
      setUpdatingId(null);
    }
  };

  const floors = ['All', ...Array.from(new Set(tables.map((t) => t.floor || 'Main').filter(Boolean))).sort()];
  const visibleTables = activeFloor === 'All' ? tables : tables.filter((t) => (t.floor || 'Main') === activeFloor);

  const freeCount     = tables.filter((t) => !orderMap[t.table_id] && Number(t.has_pending_order) === 0 && t.status !== 'needs_cleaning').length;
  const occupiedCount = tables.filter((t) => !!orderMap[t.table_id] || Number(t.has_pending_order) > 0).length;
  const cleaningCount = tables.filter((t) => t.status === 'needs_cleaning' && !orderMap[t.table_id] && Number(t.has_pending_order) === 0).length;

  const handleFreePress = (table) => {
    haptic();
    setTable(table.table_id, table.table_name, null);
    router.push(`/(main)/order/${table.table_id}?name=${encodeURIComponent(table.table_name)}&orderType=dine_in`);
  };

  const handleOccupiedPress = (table, sale) => {
    haptic();
    setTable(table.table_id, table.table_name, sale.sale_id);
    router.push(`/(main)/order/${table.table_id}?saleId=${sale.sale_id}&name=${encodeURIComponent(table.table_name)}`);
  };

  const getTableState = (table) => {
    const sale     = orderMap[table.table_id];
    const occupied = !!sale || Number(table.has_pending_order) > 0;
    const cleaning = !occupied && table.status === 'needs_cleaning';
    const free     = !occupied && !cleaning;
    return { sale, occupied, cleaning, free };
  };

  if (loading) return <OccupancySkeleton viewMode={viewMode} />;

  return (
    <View style={styles.root}>
      {/* ── Summary Bar ── */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryLeft}>
          <View style={styles.summaryChip}>
            <View style={[styles.summaryDot, { backgroundColor: C.primary }]} />
            <Text style={styles.summaryChipText}>{freeCount} Free</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <View style={[styles.summaryDot, { backgroundColor: C.red }]} />
            <Text style={[styles.summaryChipText, { color: C.red }]}>{occupiedCount} Busy</Text>
          </View>
          {cleaningCount > 0 && (
            <View style={[styles.summaryChip, { backgroundColor: C.purpleBg, borderColor: C.purpleBd }]}>
              <View style={[styles.summaryDot, { backgroundColor: C.purple }]} />
              <Text style={[styles.summaryChipText, { color: C.purple }]}>{cleaningCount} Cleaning</Text>
            </View>
          )}
        </View>

        <View style={styles.summaryRight}>
          <View style={styles.autoRefreshBadge}>
            <Ionicons name="sync-outline" size={11} color={C.primary} />
            <Text style={styles.autoRefreshText}>Auto 30s</Text>
          </View>
          {/* View toggle */}
          <View style={styles.toggleWrap}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'card' && styles.toggleBtnActive]}
              onPress={() => setViewMode('card')} activeOpacity={0.75}
            >
              <Ionicons name="grid-outline" size={15} color={viewMode === 'card' ? '#fff' : C.t3} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
              onPress={() => setViewMode('list')} activeOpacity={0.75}
            >
              <Ionicons name="list-outline" size={15} color={viewMode === 'list' ? '#fff' : C.t3} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => { haptic(); setRefreshing(true); load(); }}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color={C.t2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Floor filter chips ── */}
      {floors.length > 2 && (
        <View style={styles.floorWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floorScroll}>
            {floors.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.floorChip, activeFloor === f && styles.floorChipActive]}
                onPress={() => setActiveFloor(f)}
                activeOpacity={0.7}
              >
                <Text style={[styles.floorChipText, activeFloor === f && styles.floorChipTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Tables ── */}
      {visibleTables.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyCircle}>
            <Ionicons name="restaurant-outline" size={38} color={C.t3} />
          </View>
          <Text style={styles.emptyTitle}>No Tables Found</Text>
          <Text style={styles.emptySub}>Add tables from the admin panel</Text>
        </View>
      ) : viewMode === 'card' ? (

        // ── Card View ──
        <FlatList
          key="card-view"
          data={visibleTables}
          keyExtractor={(item) => String(item.table_id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[C.primary]} />}
          extraData={tick}
          renderItem={({ item: table }) => {
            const { sale, occupied, cleaning, free } = getTableState(table);
            const isUpdating = updatingId === table.table_id;

            if (cleaning) {
              return (
                <View style={[styles.card, styles.cardCleaning]}>
                  <View style={[styles.statusDot, { backgroundColor: C.purple, borderColor: C.purpleBg }]} />
                  <View style={[styles.cardIconWrapOccupied, { backgroundColor: C.purpleBg }]}>
                    <Ionicons name="brush-outline" size={22} color={C.purple} />
                  </View>
                  <Text style={[styles.tableName, { color: C.purple }]}>{table.table_name}</Text>
                  <View style={[styles.elapsedBadge, { backgroundColor: C.purpleBg, borderColor: C.purpleBd }]}>
                    <Ionicons name="brush" size={11} color={C.purple} />
                    <Text style={[styles.elapsedText, { color: C.purple }]}>Needs Cleaning</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.cleanBtn, isUpdating && { opacity: 0.5 }]}
                    onPress={() => updateTableStatus(table.table_id, 'available')}
                    disabled={isUpdating}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle-outline" size={13} color={C.primary} />
                    <Text style={styles.cleanBtnText}>Mark Clean</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            if (free) {
              return (
                <TouchableOpacity style={[styles.card, styles.cardFree]} onPress={() => handleFreePress(table)} activeOpacity={0.8}>
                  <View style={[styles.statusDot, { backgroundColor: '#4ADE80', borderColor: C.card }]} />
                  <View style={styles.cardIconWrap}>
                    <Ionicons name="restaurant" size={26} color={C.primary} />
                  </View>
                  <Text style={styles.tableName}>{table.table_name}</Text>
                  {table.floor && table.floor !== 'Main' && (
                    <View style={styles.floorTag}>
                      <Ionicons name="location-outline" size={10} color={C.t3} />
                      <Text style={styles.floorTagText}>{table.floor}</Text>
                    </View>
                  )}
                  {table.capacity ? (
                    <View style={styles.capRow}>
                      <Ionicons name="people-outline" size={11} color={C.t3} />
                      <Text style={styles.capText}>{table.capacity} seats</Text>
                    </View>
                  ) : null}
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeText}>Tap to assign</Text>
                  </View>
                </TouchableOpacity>
              );
            }

            const mins    = sale ? getElapsedMins(sale.sale_date) : 0;
            const urgency = getUrgencyColor(mins);
            const elapsed = sale ? getElapsed(sale.sale_date) : '—';
            const amount  = sale ? parseFloat(sale.total_amount || 0).toFixed(0) : '—';
            const token   = sale?.token_no || (sale ? `#${sale.sale_id}` : '—');
            return (
              <TouchableOpacity style={[styles.card, { borderColor: urgency.border, backgroundColor: urgency.bg }]} onPress={() => sale && handleOccupiedPress(table, sale)} activeOpacity={0.85}>
                <View style={[styles.statusDot, { backgroundColor: urgency.dot, borderColor: urgency.bg }]} />
                <View style={[styles.cardIconWrapOccupied, { backgroundColor: urgency.color + '18' }]}>
                  <Ionicons name="restaurant" size={22} color={urgency.color} />
                </View>
                <Text style={[styles.tableName, { color: urgency.color }]}>{table.table_name}</Text>
                {sale && <View style={[styles.tokenChip, { backgroundColor: urgency.color + '15', borderColor: urgency.border }]}><Text style={[styles.tokenText, { color: urgency.color }]}>{token}</Text></View>}
                {sale && <Text style={[styles.occupiedAmt, { color: urgency.color }]}>PKR {amount}</Text>}
                <View style={[styles.elapsedBadge, { backgroundColor: urgency.color + '18', borderColor: urgency.border }]}>
                  <Ionicons name="time-outline" size={11} color={urgency.color} />
                  <Text style={[styles.elapsedText, { color: urgency.color }]}>{elapsed}</Text>
                </View>
                {sale && (
                  <View style={styles.occupiedActions}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.blueBg, borderColor: C.blueBd }]} onPress={() => handleOccupiedPress(table, sale)} activeOpacity={0.8}>
                      <Ionicons name="create-outline" size={13} color={C.blue} />
                      <Text style={[styles.actionBtnText, { color: C.blue }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: C.purpleBg, borderColor: C.purpleBd }, isUpdating && { opacity: 0.5 }]}
                      onPress={() => updateTableStatus(table.table_id, 'needs_cleaning')}
                      disabled={isUpdating}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="brush-outline" size={13} color={C.purple} />
                      <Text style={[styles.actionBtnText, { color: C.purple }]}>Dirty</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />

      ) : (

        // ── List View ──
        <FlatList
          key="list-view"
          data={visibleTables}
          keyExtractor={(item) => String(item.table_id)}
          contentContainerStyle={styles.listGrid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[C.primary]} />}
          extraData={tick}
          renderItem={({ item: table }) => {
            const { sale, occupied, cleaning, free } = getTableState(table);
            const mins     = sale ? getElapsedMins(sale.sale_date) : 0;
            const urgency  = occupied ? getUrgencyColor(mins) : null;
            const elapsed  = sale ? getElapsed(sale.sale_date) : null;
            const amount   = sale ? parseFloat(sale.total_amount || 0).toFixed(0) : null;
            const isUpdating = updatingId === table.table_id;

            const barColor  = cleaning ? C.purple : occupied ? urgency.dot : '#4ADE80';
            const iconBg    = cleaning ? C.purpleBg : occupied ? urgency.color + '18' : C.primaryLt;
            const iconColor = cleaning ? C.purple : occupied ? urgency.color : C.primary;
            const iconName  = cleaning ? 'brush-outline' : 'restaurant';

            return (
              <TouchableOpacity
                style={[
                  styles.listItem,
                  occupied && { borderColor: urgency.border, backgroundColor: urgency.bg },
                  cleaning && { borderColor: C.purpleBd, backgroundColor: C.purpleBg },
                ]}
                onPress={() => {
                  if (cleaning) return;
                  occupied && sale ? handleOccupiedPress(table, sale) : handleFreePress(table);
                }}
                activeOpacity={cleaning ? 1 : 0.8}
              >
                <View style={[styles.listStatusBar, { backgroundColor: barColor }]} />
                <View style={[styles.listIcon, { backgroundColor: iconBg }]}>
                  <Ionicons name={iconName} size={20} color={iconColor} />
                </View>
                <View style={styles.listInfo}>
                  <Text style={[styles.listName, (occupied || cleaning) && { color: cleaning ? C.purple : urgency.color }]}>
                    {table.table_name}
                  </Text>
                  <View style={styles.listMeta}>
                    {table.floor ? <><Ionicons name="layers-outline" size={11} color={C.t3} /><Text style={styles.listMetaText}>{table.floor}</Text></> : null}
                    {table.capacity ? <><View style={styles.metaDot} /><Ionicons name="people-outline" size={11} color={C.t3} /><Text style={styles.listMetaText}>{table.capacity}</Text></> : null}
                    {occupied && elapsed ? <><View style={styles.metaDot} /><Ionicons name="time-outline" size={11} color={urgency.color} /><Text style={[styles.listMetaText, { color: urgency.color, fontWeight: '700' }]}>{elapsed}</Text></> : null}
                  </View>
                </View>
                <View style={styles.listRight}>
                  {cleaning ? (
                    <>
                      <TouchableOpacity
                        style={[styles.listCleanBtn, isUpdating && { opacity: 0.5 }]}
                        onPress={() => updateTableStatus(table.table_id, 'available')}
                        disabled={isUpdating}
                      >
                        <Ionicons name="checkmark-circle" size={14} color={C.primary} />
                        <Text style={styles.listCleanBtnText}>Clean</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.listDirtyBtn}
                        onPress={() => updateTableStatus(table.table_id, 'needs_cleaning')}
                        disabled
                      >
                        <Text style={[styles.listBadgeText, { color: C.purple }]}>Cleaning</Text>
                      </TouchableOpacity>
                    </>
                  ) : occupied ? (
                    <>
                      {amount && <Text style={[styles.listAmt, { color: urgency.color }]}>PKR {amount}</Text>}
                      <TouchableOpacity
                        style={[styles.listDirtyBtn, { backgroundColor: C.purpleBg, borderColor: C.purpleBd }, isUpdating && { opacity: 0.5 }]}
                        onPress={() => updateTableStatus(table.table_id, 'needs_cleaning')}
                        disabled={isUpdating}
                      >
                        <Ionicons name="brush-outline" size={12} color={C.purple} />
                      </TouchableOpacity>
                      <View style={[styles.listBadge, { backgroundColor: urgency.color + '18', borderColor: urgency.border }]}>
                        <Text style={[styles.listBadgeText, { color: urgency.color }]}>Busy</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.listBadge}>
                      <Text style={styles.listBadgeText}>Free</Text>
                    </View>
                  )}
                  {!cleaning && <Ionicons name="chevron-forward" size={16} color={occupied ? urgency.color : C.t3} />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.card,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  summaryLeft: { flexDirection: 'row', gap: 8 },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.primaryLt, paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: C.primaryBd,
  },
  summaryDot: { width: 7, height: 7, borderRadius: 4 },
  summaryChipText: { fontSize: 12, fontWeight: '700', color: C.primary },
  summaryRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  toggleBtn: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleBtnActive: { backgroundColor: C.primary },
  autoRefreshBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.primaryLt, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: C.primaryBd,
  },
  autoRefreshText: { fontSize: 10, fontWeight: '700', color: C.primary },
  refreshBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },

  floorWrap: {
    backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  floorScroll: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  floorChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
  },
  floorChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  floorChipText: { fontSize: 13, color: C.t2, fontWeight: '600' },
  floorChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.t1 },
  emptySub: { fontSize: 13, color: C.t2 },

  grid: { padding: 14, paddingBottom: 30 },
  gridRow: { gap: 12, marginBottom: 12 },

  // Card base
  card: {
    flex: 1, borderRadius: 20, padding: 14,
    alignItems: 'center', borderWidth: 1.5,
    position: 'relative',
    ...shadow.md,
  },

  // Free card
  cardFree: {
    backgroundColor: C.card, borderColor: C.border,
  },

  // Cleaning card
  cardCleaning: {
    backgroundColor: C.purpleBg, borderColor: C.purpleBd,
  },
  cleanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.primaryLt, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: C.primaryBd, marginTop: 6,
  },
  cleanBtnText: { fontSize: 12, fontWeight: '700', color: C.primary },
  cardIconWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: C.primaryLt,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },

  // Occupied card
  cardIconWrapOccupied: {
    width: 48, height: 48, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },

  // Status dot (top-right corner)
  statusDot: {
    position: 'absolute', top: 10, right: 10,
    width: 11, height: 11, borderRadius: 6,
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 3, elevation: 2,
  },

  tableName: {
    fontSize: 15, fontWeight: '800', color: C.t1,
    marginBottom: 4, textAlign: 'center', letterSpacing: -0.2,
  },

  // Free card extras
  floorTag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3 },
  floorTagText: { fontSize: 10, color: C.t3 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 10 },
  capText: { fontSize: 11, color: C.t3 },
  freeBadge: {
    backgroundColor: C.primaryLt, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: C.primaryBd, marginTop: 2,
  },
  freeBadgeText: { fontSize: 11, fontWeight: '700', color: C.primary },

  // Occupied card extras
  tokenChip: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1, marginBottom: 4,
  },
  tokenText: { fontSize: 11, fontWeight: '800' },
  occupiedAmt: {
    fontSize: 16, fontWeight: '800', letterSpacing: -0.3, marginBottom: 6,
  },
  elapsedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  elapsedText: { fontSize: 11, fontWeight: '700' },

  occupiedActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },

  // ── List View
  listGrid: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 30 },
  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 8, overflow: 'hidden', ...shadow.sm,
  },
  listStatusBar: { width: 4, alignSelf: 'stretch' },
  listIcon: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 4,
  },
  listInfo: { flex: 1, paddingVertical: 12 },
  listName: { fontSize: 15, fontWeight: '800', color: C.t1, marginBottom: 3 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  listMetaText: { fontSize: 11, color: C.t3 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.t3 },
  listRight: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12 },
  listAmt: { fontSize: 13, fontWeight: '800' },
  listBadge: {
    backgroundColor: C.primaryLt, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1, borderColor: C.primaryBd,
  },
  listBadgeText: { fontSize: 10, fontWeight: '700', color: C.primary },
  listCleanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.primaryLt, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1, borderColor: C.primaryBd,
  },
  listCleanBtnText: { fontSize: 11, fontWeight: '700', color: C.primary },
  listDirtyBtn: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
});
