import { Redirect } from 'expo-router';

export default function AuthLayout() {
  // With anonymous auth, we don't need login/register screens
  // Redirect to main app
  return <Redirect href="/(tabs)" />;
}
