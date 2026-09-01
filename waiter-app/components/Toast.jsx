import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, StyleSheet, Text, TouchableOpacity,
  View, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useToastStore from '../store/toastStore';
import { C } from '../constants/theme';

const CONFIGS = {
  success: {
    bg: '#FFFFFF',
    accent: '#059669',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    icon: 'checkmark-circle',
    label: 'Success',
    shadow: '#059669',
  },
  error: {
    bg: '#FFFFFF',
    accent: '#DC2626',
    iconBg: '#FEF2F2',
    iconColor: '#DC2626',
    icon: 'close-circle',
    label: 'Error',
    shadow: '#DC2626',
  },
  warning: {
    bg: '#FFFFFF',
    accent: '#D97706',
    iconBg: '#FFFBEB',
    iconColor: '#D97706',
    icon: 'warning',
    label: 'Warning',
    shadow: '#D97706',
  },
  info: {
    bg: '#FFFFFF',
    accent: '#2563EB',
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
    icon: 'information-circle',
    label: 'Info',
    shadow: '#2563EB',
  },
};

const DURATION = 3500;

export default function Toast() {
  const { visible, message, type, hideToast } = useToastStore();
  const [modalVisible, setModalVisible] = useState(false);

  const translateY = useRef(new Animated.Value(160)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(0.92)).current;
  const progress   = useRef(new Animated.Value(1)).current;
  const iconScale  = useRef(new Animated.Value(0)).current;
  const timerRef   = useRef(null);
  const progressAnim = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (progressAnim.current) {
      progressAnim.current.stop();
    }

    if (visible) {
      progress.setValue(1);
      setModalVisible(true);

      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(opacity,    { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale,      { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }),
      ]).start();

      Animated.spring(iconScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 7, delay: 100 }).start();

      progressAnim.current = Animated.timing(progress, {
        toValue: 0, duration: DURATION, useNativeDriver: false,
      });
      progressAnim.current.start();

      timerRef.current = setTimeout(hideToast, DURATION);
    } else {
      iconScale.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 160, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,   duration: 240, useNativeDriver: true }),
        Animated.timing(scale,      { toValue: 0.92, duration: 260, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setModalVisible(false);
      });
    }

    return () => {
      clearTimeout(timerRef.current);
      if (progressAnim.current) progressAnim.current.stop();
    };
  }, [visible]);

  const cfg = CONFIGS[type] || CONFIGS.info;

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={hideToast}
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View style={[
          styles.wrapper,
          {
            opacity,
            transform: [{ translateY }, { scale }],
            shadowColor: cfg.shadow,
          }
        ]}>

          {/* Colored top stripe */}
          <View style={[styles.stripe, { backgroundColor: cfg.accent }]} />

          <View style={[styles.card, { backgroundColor: cfg.bg }]}>

            {/* Icon */}
            <Animated.View style={[
              styles.iconBox,
              { backgroundColor: cfg.iconBg, transform: [{ scale: iconScale }] },
            ]}>
              <Ionicons name={cfg.icon} size={26} color={cfg.iconColor} />
            </Animated.View>

            {/* Text */}
            <View style={styles.body}>
              <Text style={[styles.label, { color: cfg.accent }]}>{cfg.label}</Text>
              <Text style={styles.message} numberOfLines={3}>{message}</Text>
            </View>

            {/* Close */}
            <TouchableOpacity onPress={hideToast} style={styles.closeBtn} activeOpacity={0.7}>
              <View style={styles.closeInner}>
                <Ionicons name="close" size={15} color={C.t3} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View style={[
              styles.progressFill,
              { width: progressWidth, backgroundColor: cfg.accent },
            ]} />
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 96,
    paddingHorizontal: 14,
  },
  wrapper: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 14,
  },
  stripe: {
    height: 4,
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 13,
  },
  iconBox: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1 },
  label: {
    fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3,
  },
  message: {
    fontSize: 13.5, color: C.t1, fontWeight: '500', lineHeight: 19,
  },
  closeBtn: { flexShrink: 0 },
  closeInner: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#F1F5F9',
    width: '100%',
  },
  progressFill: {
    height: 3,
  },
});
