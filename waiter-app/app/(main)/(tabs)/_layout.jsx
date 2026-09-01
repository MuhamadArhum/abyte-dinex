import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../../../store/authStore';
import Sidebar from '../../../components/Sidebar';
import { C, shadow } from '../../../constants/theme';

export default function TabsLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [token]);

  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: C.primaryHd }}>
      <StatusBar barStyle="light-content" backgroundColor={C.primaryHd} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarH + 10, paddingBottom: 14 }]}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.menuBtn} activeOpacity={0.7}>
          <Ionicons name="menu-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerBrand}>
            <Ionicons name="restaurant" size={17} color={C.primaryBd} />
            <Text style={styles.headerTitle}>Abyte ERP Waiter</Text>
          </View>
          <Text style={styles.headerSub}>Restaurant Order System</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Tabs */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: C.primary,
          tabBarInactiveTintColor: C.t3,
          tabBarStyle: {
            backgroundColor: C.card,
            borderTopWidth: 1,
            borderTopColor: C.border,
            height: 62 + insets.bottom,
            paddingBottom: insets.bottom + 6,
            paddingTop: 8,
            ...shadow.md,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.3,
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'New Order',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={24} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="running"
          options={{
            title: 'Running',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={24} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'time' : 'time-outline'} size={24} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="occupancy"
          options={{
            title: 'Tables',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="report"
          options={{
            title: 'My Report',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
                <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={24} color={color} />
              </View>
            ),
          }}
        />
      </Tabs>

      <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primaryHd,
    paddingHorizontal: 16,
  },
  menuBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerTitle: {
    fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2, letterSpacing: 0.3,
  },
  tabIcon: {
    width: 52, height: 30, alignItems: 'center', justifyContent: 'center',
    borderRadius: 15,
  },
  tabIconActive: {
    backgroundColor: C.primaryLt,
  },
});
