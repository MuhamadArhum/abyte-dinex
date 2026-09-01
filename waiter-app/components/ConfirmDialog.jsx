import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Animated, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useConfirmStore from '../store/confirmStore';
import { C, shadow } from '../constants/theme';

const TYPE_CONFIGS = {
  confirm: { icon: 'help-circle',   accent: C.primary, iconBg: '#ECFDF5' },
  danger:  { icon: 'warning',       accent: C.red,     iconBg: '#FEF2F2' },
  info:    { icon: 'information-circle', accent: C.blue, iconBg: '#EFF6FF' },
};

export default function ConfirmDialog() {
  const {
    visible, title, message, confirmText, cancelText,
    confirmColor, dialogType = 'confirm', onConfirm, hide,
  } = useConfirmStore();

  const [modalVisible, setModalVisible] = useState(false);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scale           = useRef(new Animated.Value(0.82)).current;
  const translateY      = useRef(new Animated.Value(30)).current;
  const iconScale       = useRef(new Animated.Value(0)).current;
  const iconRotate      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      iconScale.setValue(0);
      iconRotate.setValue(0);
      scale.setValue(0.82);
      translateY.setValue(30);
      backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale,     { toValue: 1,  tension: 70, friction: 8,  useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0,  tension: 70, friction: 8,  useNativeDriver: true }),
      ]).start();

      Animated.sequence([
        Animated.delay(140),
        Animated.spring(iconScale, { toValue: 1.15, tension: 120, friction: 5, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1,    tension: 120, friction: 6, useNativeDriver: true }),
      ]).start();

    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scale,    { toValue: 0.88, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY,{ toValue: 20,  duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setModalVisible(false);
      });
    }
  }, [visible]);

  const handleConfirm = () => {
    hide();
    onConfirm?.();
  };

  const cfg = TYPE_CONFIGS[dialogType] || TYPE_CONFIGS.confirm;
  const accentColor = confirmColor || cfg.accent;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={hide}
    >
      <TouchableWithoutFeedback onPress={hide}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableWithoutFeedback>
            <Animated.View style={[
              styles.dialog,
              { transform: [{ scale }, { translateY }] },
            ]}>

              {/* Colored header strip */}
              <View style={[styles.headerStrip, { backgroundColor: accentColor + '12' }]}>
                {/* Decorative rings */}
                <View style={[styles.ring, styles.ringOuter, { borderColor: accentColor + '18' }]} />
                <View style={[styles.ring, styles.ringInner, { borderColor: accentColor + '28' }]} />

                {/* Icon */}
                <Animated.View style={[
                  styles.iconWrap,
                  { backgroundColor: cfg.iconBg, transform: [{ scale: iconScale }] },
                ]}>
                  <View style={[styles.iconInner, { backgroundColor: accentColor + '18' }]}>
                    <Ionicons name={cfg.icon} size={34} color={accentColor} />
                  </View>
                </Animated.View>
              </View>

              {/* Body */}
              <View style={styles.body}>
                <Text style={styles.title}>{title}</Text>
                {!!message && <Text style={styles.message}>{message}</Text>}
              </View>

              {/* Buttons */}
              <View style={styles.btnGroup}>
                <TouchableOpacity style={styles.cancelBtn} onPress={hide} activeOpacity={0.75}>
                  <Ionicons name="close-outline" size={18} color={C.t2} />
                  <Text style={styles.cancelText}>{cancelText || 'Cancel'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: accentColor }]}
                  onPress={handleConfirm}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark" size={18} color="#FFF" />
                  <Text style={styles.confirmText}>{confirmText || 'Confirm'}</Text>
                </TouchableOpacity>
              </View>

            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,10,22,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  dialog: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    overflow: 'hidden',
    ...shadow.lg,
  },

  headerStrip: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  ringOuter: { width: 120, height: 120 },
  ringInner: { width: 88,  height: 88  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  iconInner: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },

  body: {
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 19, fontWeight: '800', color: C.t1,
    textAlign: 'center', letterSpacing: -0.4, marginBottom: 8,
  },
  message: {
    fontSize: 14, color: C.t2, textAlign: 'center',
    lineHeight: 21, letterSpacing: 0.1,
  },

  btnGroup: {
    flexDirection: 'row',
    paddingHorizontal: 20, paddingBottom: 22, gap: 10,
  },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  cancelText: {
    fontSize: 15, fontWeight: '700', color: C.t2,
  },
  confirmBtn: {
    flex: 1, height: 50, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmText: {
    fontSize: 15, fontWeight: '800', color: '#FFFFFF',
  },
});
