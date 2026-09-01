import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Image, Animated, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';
import { C } from '../constants/theme';

const logo = require('../assets/logo.png');
const { height: SCREEN_H } = Dimensions.get('window');

export default function LoginScreen() {
  const [companyCode, setCompanyCode] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [focused, setFocused]         = useState(null);

  const { setAuth, token } = useAuthStore();
  const { showToast }      = useToastStore();

  const slideUp  = useRef(new Animated.Value(60)).current;
  const fadeIn   = useRef(new Animated.Value(0)).current;
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoUp   = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (token) router.replace('/(main)/(tabs)/home');
  }, [token]);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(logoUp,   { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeIn,  { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!companyCode.trim() || !email.trim() || !password.trim()) {
      showToast('Please fill in all fields.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        company_code: companyCode.trim().toLowerCase(),
        email: email.trim(),
        password,
      });
      const { token: tok, user } = res.data;
      await setAuth(user, tok);
      router.replace('/(main)/(tabs)/home');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />

      {/* ── Top Brand Section ── */}
      <View style={styles.brand}>
        {/* Subtle ring decoration */}
        <View style={styles.ring1} />
        <View style={styles.ring2} />

        <Animated.View style={[styles.brandInner, {
          opacity: logoFade,
          transform: [{ translateY: logoUp }],
        }]}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image source={logo} style={styles.logoImg} resizeMode="contain" />
          </View>
          <Text style={styles.appName}>Abyte ERP Waiter</Text>
          <Text style={styles.appTagline}>Restaurant Order Management</Text>

          {/* Pill badges */}
          <View style={styles.pills}>
            <View style={styles.pill}>
              <Ionicons name="restaurant-outline" size={12} color="rgba(255,255,255,0.75)" />
              <Text style={styles.pillText}>POS System</Text>
            </View>
            <View style={styles.pillSep} />
            <View style={styles.pill}>
              <Ionicons name="shield-checkmark-outline" size={12} color="rgba(255,255,255,0.75)" />
              <Text style={styles.pillText}>Secure Login</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* ── Bottom Sheet ── */}
      <Animated.View style={[styles.sheet, {
        opacity: fadeIn,
        transform: [{ translateY: slideUp }],
      }]}>
        <ScrollView
          contentContainerStyle={styles.sheetScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Sheet handle */}
          <View style={styles.handle} />

          <Text style={styles.sheetTitle}>Welcome Back 👋</Text>
          <Text style={styles.sheetSub}>Sign in to start taking orders</Text>

          {/* Fields */}
          <View style={styles.fields}>
            <InputField
              label="Company Code"
              icon="business-outline"
              placeholder="e.g. abyte"
              value={companyCode}
              onChangeText={setCompanyCode}
              focused={focused === 'company'}
              onFocus={() => setFocused('company')}
              onBlur={() => setFocused(null)}
              autoCapitalize="none"
              returnKeyType="next"
            />
            <InputField
              label="Email Address"
              icon="mail-outline"
              placeholder="waiter@restaurant.com"
              value={email}
              onChangeText={setEmail}
              focused={focused === 'email'}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
            <InputField
              label="Password"
              icon="lock-closed-outline"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              focused={focused === 'password'}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              secureTextEntry={!showPw}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              rightSlot={
                <TouchableOpacity onPress={() => setShowPw(s => !s)} style={styles.eyeBtn}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.t3} />
                </TouchableOpacity>
              }
            />
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.btnText}>Signing In…</Text>
              </>
            ) : (
              <>
                <Text style={styles.btnText}>Sign In</Text>
                <View style={styles.btnArrow}>
                  <Ionicons name="arrow-forward" size={16} color={C.primaryHd} />
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerLine} />
            <View style={styles.footerCenter}>
              <Ionicons name="shield-checkmark" size={12} color={C.t3} />
              <Text style={styles.footerText}>Abyte ERP  ·  v1.0</Text>
            </View>
            <View style={styles.footerLine} />
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function InputField({
  label, icon, placeholder, value, onChangeText,
  focused, onFocus, onBlur, rightSlot, ...rest
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, focused && styles.fieldLabelOn]}>{label}</Text>
      <View style={[styles.fieldBox, focused && styles.fieldBoxOn]}>
        <View style={styles.fieldIconWrap}>
          <Ionicons name={icon} size={17} color={focused ? C.primary : C.t3} />
        </View>
        <TextInput
          style={styles.fieldInput}
          placeholder={placeholder}
          placeholderTextColor={C.t3}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          autoCorrect={false}
          {...rest}
        />
        {rightSlot}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primaryHd },

  // Brand top section
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ring1: {
    position: 'absolute',
    width: 320, height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    top: -80, right: -60,
  },
  ring2: {
    position: 'absolute',
    width: 200, height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    bottom: 20, left: -40,
  },
  brandInner: { alignItems: 'center', paddingBottom: 8 },
  logoWrap: {
    width: 100, height: 100,
    backgroundColor: '#fff',
    borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  logoImg: { width: 72, height: 72 },
  appName:    { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 5 },
  appTagline: { fontSize: 13, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.2, marginBottom: 16 },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  pillText: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  pillSep:  { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },

  // Bottom sheet
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: SCREEN_H * 0.56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetScroll: {
    paddingHorizontal: 26,
    paddingTop: 10,
    paddingBottom: 32,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 22,
  },
  sheetTitle: { fontSize: 24, fontWeight: '800', color: C.t1, letterSpacing: -0.5, marginBottom: 4 },
  sheetSub:   { fontSize: 13, color: C.t3, marginBottom: 26 },

  // Fields
  fields: { gap: 14, marginBottom: 22 },
  fieldWrap: {},
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: C.t3,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 7,
  },
  fieldLabelOn: { color: C.primary },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border,
    borderRadius: 14, backgroundColor: C.surface,
    height: 52,
  },
  fieldBoxOn: {
    borderColor: C.primary,
    backgroundColor: '#F0FDF9',
  },
  fieldIconWrap: { paddingLeft: 14, paddingRight: 10 },
  fieldInput: {
    flex: 1, height: 52,
    fontSize: 14, color: C.t1,
    paddingRight: 8,
  },
  eyeBtn: { paddingHorizontal: 14 },

  // Button
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
    backgroundColor: C.primaryHd,
    height: 56, borderRadius: 16,
    shadowColor: C.primaryHd,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 8,
  },
  btnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  btnArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginTop: 24,
  },
  footerLine: { flex: 1, height: 1, backgroundColor: C.border },
  footerCenter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 11, color: C.t3, letterSpacing: 0.3 },
});
