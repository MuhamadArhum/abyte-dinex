import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  TouchableWithoutFeedback, StatusBar, Platform, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import useAuthStore from '../store/authStore';
import useRefreshStore from '../store/refreshStore';
import { C } from '../constants/theme';

const logo = require('../assets/logo.png');


export default function Sidebar({ visible, onClose }) {
  const { user, logout } = useAuthStore();
  const { startRefresh, endRefresh } = useRefreshStore();
  const slideX  = useRef(new Animated.Value(-310)).current;
  const overlay = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideX,  { toValue: 0,    tension: 70, friction: 12, useNativeDriver: true }),
        Animated.timing(overlay, { toValue: 1,    duration: 230, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX,  { toValue: -310, duration: 250, useNativeDriver: true }),
        Animated.timing(overlay, { toValue: 0,    duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleLogout = async () => { onClose(); await logout(); router.replace('/login'); };
  const handleRefresh = () => {
    onClose(); startRefresh();
    router.replace('/(main)/(tabs)/home');
    setTimeout(endRefresh, 1800);
  };
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;
  const initial    = (user?.name || user?.username || 'W').charAt(0).toUpperCase();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: overlay }]} />
      </TouchableWithoutFeedback>

      {/* Drawer */}
      <Animated.View style={[styles.drawer, { paddingTop: statusBarH, transform: [{ translateX: slideX }] }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          {/* Decorative rings */}
          <View style={styles.ring1} />
          <View style={styles.ring2} />

          {/* Logo watermark */}
          <Image source={logo} style={styles.watermark} resizeMode="contain" />

          {/* Avatar */}
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
          <View style={styles.onlineDot} />

          {/* User info */}
          <Text style={styles.userName}>{user?.name || 'Waiter'}</Text>
          <Text style={styles.userRole}>{user?.role_name || 'Waiter'}</Text>

          {/* Branch chip */}
          <View style={styles.branchChip}>
            <Ionicons name="location" size={11} color={C.primaryBd} />
            <Text style={styles.branchText}>{user?.branch_name || 'Main Branch'}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

          {/* ── Account Info ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.infoCard}>
              <InfoRow icon="person-outline"     label="Full Name" value={user?.name} />
              <InfoRow icon="at-outline"         label="Username"  value={user?.username} />
              <InfoRow icon="mail-outline"       label="Email"     value={user?.email} />
              <InfoRow icon="shield-outline"     label="Role"      value={user?.role_name || 'Waiter'} last />
            </View>
          </View>

        </ScrollView>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          {/* Branding */}
          <View style={styles.brand}>
            <Image source={logo} style={styles.brandLogo} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.brandName}>Abyte ERP Waiter</Text>
              <Text style={styles.brandVer}>POS System  ·  v1.0</Text>
            </View>
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          <View style={styles.footerDivider} />

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionRefresh} onPress={handleRefresh} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={17} color={C.blue} />
              <Text style={styles.actionRefreshText}>Refresh</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionLogout} onPress={handleLogout} activeOpacity={0.8}>
              <Ionicons name="log-out-outline" size={17} color="#fff" />
              <Text style={styles.actionLogoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </View>
  );
}

function InfoRow({ icon, label, value, last }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={14} color={C.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,10,22,0.55)',
  },

  drawer: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 295,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },

  // ── Header
  header: {
    backgroundColor: C.primaryHd,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 26,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  ring1: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    top: -80, right: -60,
  },
  ring2: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    bottom: -30, left: -30,
  },
  watermark: {
    position: 'absolute', top: 14, right: 14,
    width: 28, height: 28, opacity: 0.3,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarLetter: { fontSize: 32, fontWeight: '800', color: '#fff' },
  onlineDot: {
    position: 'absolute',
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#34D399',
    borderWidth: 2.5, borderColor: C.primaryHd,
    top: 20 + 76 - 8, left: '50%',
    marginLeft: 22,
  },
  userName:   { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  userRole:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3, marginBottom: 12 },
  branchChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  branchText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  // ── Sections
  section: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: C.t3,
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginBottom: 10, paddingLeft: 4,
  },

  // Info card
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 11, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  infoIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { fontSize: 10, color: C.t3, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 13, color: C.t1, fontWeight: '600', marginTop: 1 },

  // ── Footer
  footer: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 22,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  brand: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 10,
  },
  brandLogo: { width: 32, height: 32 },
  brandName: { fontSize: 13, fontWeight: '800', color: C.t1 },
  brandVer:  { fontSize: 10, color: C.t3, marginTop: 1 },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  liveDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary },
  liveText: { fontSize: 10, fontWeight: '700', color: C.primary },

  footerDivider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },

  actions: { flexDirection: 'row', gap: 10 },
  actionRefresh: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, borderRadius: 13,
    backgroundColor: '#EFF6FF',
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  actionRefreshText: { fontSize: 13, fontWeight: '700', color: C.blue },
  actionLogout: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, borderRadius: 13,
    backgroundColor: C.red,
  },
  actionLogoutText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
