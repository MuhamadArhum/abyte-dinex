import { Redirect } from 'expo-router';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import useAuthStore from '../store/authStore';
import useServerStore from '../store/serverStore';
import { C } from '../constants/theme';

const logo = require('../assets/logo.png');

export default function Index() {
  const { token, isLoading: authLoading } = useAuthStore();
  const { serverUrl, isLoaded: serverLoaded } = useServerStore();

  if (authLoading || !serverLoaded) {
    return (
      <View style={styles.loader}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <ActivityIndicator color="rgba(255,255,255,0.7)" size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  // No server configured yet — go to setup
  if (!serverUrl) return <Redirect href="/setup" />;

  if (token) return <Redirect href="/(main)/(tabs)/home" />;
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: C.primaryHd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 90, height: 90,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
});
