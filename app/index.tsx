// app/index.tsx  –  Entry: redirect to startup or sign-in
import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { isAuthenticated } = useAuth();
  return <Redirect href={isAuthenticated ? '/(tabs)/startup' : '/(auth)/sign-in'} />;
}
