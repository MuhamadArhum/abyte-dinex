import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import useAuthStore from '../../store/authStore';

export default function MainLayout() {
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [token]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tables" />
      <Stack.Screen name="order/[id]" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
