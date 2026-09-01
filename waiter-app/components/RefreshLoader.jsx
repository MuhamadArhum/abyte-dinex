import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet,
  Animated, Image,
} from 'react-native';
import useRefreshStore from '../store/refreshStore';
import { C } from '../constants/theme';

const logo = require('../assets/logo.png');

export default function RefreshLoader() {
  const { refreshing } = useRefreshStore();
  const [modalVisible, setModalVisible] = useState(false);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale       = useRef(new Animated.Value(0.88)).current;
  const cardOpacity     = useRef(new Animated.Value(0)).current;
  const logoPulse       = useRef(new Animated.Value(1)).current;
  const ringRotate      = useRef(new Animated.Value(0)).current;
  const ringRotate2     = useRef(new Animated.Value(0)).current;
  const textOpacity     = useRef(new Animated.Value(0)).current;
  const textY           = useRef(new Animated.Value(10)).current;

  const spinLoopRef  = useRef(null);
  const spinLoopRef2 = useRef(null);
  const pulseLoop    = useRef(null);

  useEffect(() => {
    if (refreshing) {
      setModalVisible(true);
      logoPulse.setValue(1);
      ringRotate.setValue(0);
      ringRotate2.setValue(0);
      textOpacity.setValue(0);
      textY.setValue(10);

      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(cardScale,  { toValue: 1,  tension: 80, friction: 8, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();

      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(textY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
        ]),
      ]).start();

      // Outer ring — clockwise
      spinLoopRef.current = Animated.loop(
        Animated.timing(ringRotate, { toValue: 1, duration: 1400, useNativeDriver: true })
      );
      spinLoopRef.current.start();

      // Inner ring — counter-clockwise, different speed
      spinLoopRef2.current = Animated.loop(
        Animated.timing(ringRotate2, { toValue: 1, duration: 2200, useNativeDriver: true })
      );
      spinLoopRef2.current.start();

      // Logo pulse
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(logoPulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(logoPulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();

    } else {
      spinLoopRef.current?.stop();
      spinLoopRef2.current?.stop();
      pulseLoop.current?.stop();

      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(cardOpacity,     { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0.92, duration: 280, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setModalVisible(false);
      });
    }

    return () => {
      spinLoopRef.current?.stop();
      spinLoopRef2.current?.stop();
      pulseLoop.current?.stop();
    };
  }, [refreshing]);

  const spin  = ringRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg',  '360deg'] });
  const spin2 = ringRotate2.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>

        {/* Decorative background blobs */}
        <View style={[styles.blob, styles.blobTL]} />
        <View style={[styles.blob, styles.blobBR]} />

        <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>

          {/* Spinning rings + logo */}
          <View style={styles.logoWrap}>
            {/* Outer ring */}
            <Animated.View style={[styles.ring, styles.ringOuter, { transform: [{ rotate: spin }] }]}>
              <View style={styles.ringDot} />
            </Animated.View>

            {/* Inner ring */}
            <Animated.View style={[styles.ring, styles.ringInner, { transform: [{ rotate: spin2 }] }]}>
              <View style={[styles.ringDot, styles.ringDotSmall]} />
            </Animated.View>

            {/* Logo */}
            <Animated.Image
              source={logo}
              style={[styles.logo, { transform: [{ scale: logoPulse }] }]}
              resizeMode="contain"
            />
          </View>

          {/* Text */}
          <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textY }], alignItems: 'center' }}>
            <Text style={styles.brand}>Abyte ERP Waiter</Text>
            <Text style={styles.sub}>Refreshing app data...</Text>

            {/* Animated dots */}
            <View style={styles.dotsRow}>
              <Dot delay={0}   color={C.primary} />
              <Dot delay={200} color={C.primary} />
              <Dot delay={400} color={C.primary} />
            </View>
          </Animated.View>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function Dot({ delay, color }) {
  const anim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1,    duration: 380, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.25, duration: 380, useNativeDriver: true }),
        Animated.delay(400 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return <Animated.View style={[styles.dot, { backgroundColor: color, opacity: anim }]} />;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,62,46,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  blobTL: { width: 260, height: 260, top: -80,  left: -80  },
  blobBR: { width: 200, height: 200, bottom: -60, right: -60 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingTop: 36,
    paddingBottom: 32,
    paddingHorizontal: 44,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.35,
    shadowRadius: 48,
    elevation: 28,
  },

  logoWrap: {
    width: 120, height: 120,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderStyle: 'dashed',
  },
  ringOuter: {
    width: 116, height: 116,
    borderWidth: 2.5,
    borderColor: C.primary,
    opacity: 0.35,
  },
  ringInner: {
    width: 90, height: 90,
    borderWidth: 2,
    borderColor: C.primaryBd,
    opacity: 0.55,
  },
  ringDot: {
    position: 'absolute',
    top: -4, left: '50%',
    marginLeft: -4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.primary,
  },
  ringDotSmall: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.primaryBd,
    top: -3, marginLeft: -3,
  },
  logo: {
    width: 70, height: 70,
  },

  brand: {
    fontSize: 22, fontWeight: '800', color: C.t1,
    letterSpacing: -0.5, marginBottom: 5,
  },
  sub: {
    fontSize: 13, color: C.t3,
    letterSpacing: 0.2, marginBottom: 18,
  },
  dotsRow: {
    flexDirection: 'row', gap: 7, alignItems: 'center',
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
  },
});
