import { Redirect } from 'expo-router';

export default function AuthIndex() {
  // With anonymous auth, redirect to main app
  return <Redirect href="/(tabs)" />;
}
