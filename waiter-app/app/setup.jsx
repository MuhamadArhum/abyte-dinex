import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Animated, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import useServerStore from '../store/serverStore';
import { C } from '../constants/theme';

const PLACEHOLDER = 'http://192.168.1.1:5000/api';

export default function SetupScreen() {
  const { saveServerUrl } = useServerStore();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState('choice'); // 'choice' | 'scan' | 'manual'
  const [manualUrl, setManualUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanned, setScanned] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [mode]);

  const handleQrScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const parsed = JSON.parse(data);
      if (parsed?.app !== 'abyte-waiter' || !parsed?.url) {
        Alert.alert('Invalid QR', 'This QR code is not from an AByte ERP system.', [
          { text: 'Try Again', onPress: () => setScanned(false) },
        ]);
        return;
      }
      await saveServerUrl(parsed.url);
      router.replace('/login');
    } catch {
      Alert.alert('Invalid QR', 'Could not read QR code. Please try again.', [
        { text: 'Try Again', onPress: () => setScanned(false) },
      ]);
    }
  };

  const handleManualSave = async () => {
    const url = manualUrl.trim();
    if (!url.startsWith('http')) {
      Alert.alert('Invalid URL', 'URL must start with http:// or https://');
      return;
    }
    setSaving(true);
    try {
      await saveServerUrl(url);
      router.replace('/login');
    } finally {
      setSaving(false);
    }
  };

  const switchMode = (next) => {
    fadeAnim.setValue(0);
    setMode(next);
    setScanned(false);
  };

  // ── QR Scanner ──
  if (mode === 'scan') {
    if (!permission?.granted) {
      return (
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={56} color={C.t3} />
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permSub}>The app needs camera access to scan the QR code.</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => switchMode('choice')}>
            <Text style={styles.linkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.scanRoot}>
        <StatusBar style="light" />
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleQrScanned}
        />

        {/* Overlay */}
        <View style={styles.scanOverlay}>
          {/* Top bar */}
          <View style={styles.scanTopBar}>
            <TouchableOpacity onPress={() => switchMode('choice')} style={styles.scanBackBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.scanTitle}>Scan QR Code</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Viewfinder */}
          <View style={styles.viewfinderWrap}>
            <View style={styles.viewfinder}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.scanHint}>
              Point at the QR code shown in{'\n'}Settings → Waiter App on the main POS
            </Text>
          </View>

          {/* Manual fallback */}
          <TouchableOpacity style={styles.scanManualBtn} onPress={() => switchMode('manual')}>
            <Ionicons name="keypad-outline" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.scanManualText}>Enter IP Manually Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Manual Entry ──
  if (mode === 'manual') {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.manualScroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity onPress={() => switchMode('choice')} style={styles.backRow}>
              <Ionicons name="arrow-back" size={20} color={C.t2} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.iconWrap}>
              <Ionicons name="server-outline" size={32} color={C.primary} />
            </View>
            <Text style={styles.manualTitle}>Enter Server Address</Text>
            <Text style={styles.manualSub}>
              Type the server URL exactly as shown on the POS under Settings → Waiter App.
            </Text>

            <Text style={styles.fieldLabel}>Server URL</Text>
            <TextInput
              style={styles.textInput}
              value={manualUrl}
              onChangeText={setManualUrl}
              placeholder={PLACEHOLDER}
              placeholderTextColor={C.t3}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleManualSave}
            />
            <Text style={styles.inputHint}>
              Example: http://192.168.1.105:5000/api
            </Text>

            <TouchableOpacity
              style={[styles.btn, (!manualUrl.trim() || saving) && styles.btnDisabled]}
              onPress={handleManualSave}
              disabled={!manualUrl.trim() || saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Connect</Text>
              }
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Choice Screen (default) ──
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="restaurant" size={32} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>AByte Waiter</Text>
        <Text style={styles.headerSub}>Connect to your POS Server</Text>
      </View>

      {/* Cards */}
      <View style={styles.cardsWrap}>
        <Text style={styles.cardsLabel}>Choose connection method</Text>

        {/* QR Scan */}
        <TouchableOpacity
          style={styles.methodCard}
          onPress={async () => {
            if (!permission?.granted) await requestPermission();
            switchMode('scan');
          }}
          activeOpacity={0.85}
        >
          <View style={[styles.methodIcon, { backgroundColor: C.primaryLt }]}>
            <Ionicons name="qr-code-outline" size={28} color={C.primary} />
          </View>
          <View style={styles.methodBody}>
            <Text style={styles.methodTitle}>Scan QR Code</Text>
            <Text style={styles.methodDesc}>Fastest — open Settings → Waiter App on the POS and scan the QR code</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.t3} />
        </TouchableOpacity>

        {/* Manual */}
        <TouchableOpacity
          style={styles.methodCard}
          onPress={() => switchMode('manual')}
          activeOpacity={0.85}
        >
          <View style={[styles.methodIcon, { backgroundColor: C.blueBg }]}>
            <Ionicons name="keypad-outline" size={28} color={C.blue} />
          </View>
          <View style={styles.methodBody}>
            <Text style={styles.methodTitle}>Enter IP Manually</Text>
            <Text style={styles.methodDesc}>Type the server URL shown on the POS settings page</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.t3} />
        </TouchableOpacity>

        <View style={styles.note}>
          <Ionicons name="wifi-outline" size={14} color={C.t3} />
          <Text style={styles.noteText}>
            Make sure the phone is on the same WiFi network as the POS server.
          </Text>
        </View>
      </View>
    </View>
  );
}

const CORNER_SIZE = 22;
const CORNER_THICK = 3;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' },

  // Header
  header: {
    backgroundColor: C.primaryHd,
    paddingTop: 72, paddingBottom: 40,
    alignItems: 'center', gap: 8,
  },
  headerIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },

  // Cards
  cardsWrap: { flex: 1, padding: 24, gap: 12 },
  cardsLabel: { fontSize: 11, fontWeight: '700', color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: C.border,
    borderRadius: 16, padding: 16,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  methodIcon: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  methodBody: { flex: 1 },
  methodTitle: { fontSize: 15, fontWeight: '700', color: C.t1, marginBottom: 3 },
  methodDesc: { fontSize: 12, color: C.t3, lineHeight: 17 },

  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 8, paddingHorizontal: 4 },
  noteText: { fontSize: 12, color: C.t3, flex: 1, lineHeight: 17 },

  // Permissions
  permTitle: { fontSize: 18, fontWeight: '700', color: C.t1, marginTop: 16, marginBottom: 8 },
  permSub: { fontSize: 13, color: C.t2, textAlign: 'center', marginBottom: 28, lineHeight: 20 },

  // QR Scanner
  scanRoot: { flex: 1, backgroundColor: '#000' },
  scanOverlay: { flex: 1, justifyContent: 'space-between' },
  scanTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanBackBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  viewfinderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  viewfinder: {
    width: 240, height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderColor: '#fff',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderBottomRightRadius: 4 },

  scanHint: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 },
  scanManualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 20, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanManualText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  // Manual
  manualScroll: { padding: 24, paddingTop: 56 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 32 },
  backText: { fontSize: 15, color: C.t2 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: C.primaryLt, borderWidth: 1.5, borderColor: C.primaryBd,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  manualTitle: { fontSize: 22, fontWeight: '800', color: C.t1, marginBottom: 8 },
  manualSub: { fontSize: 13, color: C.t2, lineHeight: 20, marginBottom: 28 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  textInput: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: C.t1, backgroundColor: C.surface,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inputHint: { fontSize: 11, color: C.t3, marginTop: 6, marginBottom: 28 },

  // Shared button
  btn: {
    backgroundColor: C.primaryHd,
    height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primaryHd,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  linkBtn: { marginTop: 16, alignItems: 'center' },
  linkText: { fontSize: 14, color: C.t2 },
});
