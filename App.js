import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/hooks/useAuth';
import { UnreadMessagesProvider } from './src/contexts/UnreadMessagesContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UnreadMessagesProvider>
          <AppNavigator />
          <StatusBar style="dark" />
        </UnreadMessagesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
