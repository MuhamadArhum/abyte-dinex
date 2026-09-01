import React, { Component, useEffect, useRef } from 'react';
import { AppState, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import useAuthStore from '../store/authStore';
import useOfflineQueue from '../store/offlineQueue';
import api from '../services/api';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import RefreshLoader from '../components/RefreshLoader';

SplashScreen.preventAutoHideAsync();

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] App crash:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.title}>Something went wrong</Text>
          <Text style={ebStyles.msg}>{this.state.error?.message || 'Unknown error'}</Text>
          <TouchableOpacity
            style={ebStyles.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={ebStyles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const ebStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', color: '#dc2626', marginBottom: 8 },
  msg: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#f97316', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});

export default function RootLayout() {
  const { loadAuth } = useAuthStore();
  const { loadQueue, syncQueue } = useOfflineQueue();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    loadAuth().finally(() => SplashScreen.hideAsync());
    loadQueue();
  }, []);

  // When app comes to foreground, try to sync offline orders
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        syncQueue(api);
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(main)" />
        </Stack>
        <Toast />
        <ConfirmDialog />
        <RefreshLoader />
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
