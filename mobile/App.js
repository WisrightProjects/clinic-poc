import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppNavigator } from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import { loadSession, useSession } from './src/auth/authStore';

export default function App() {
  const { loaded, session } = useSession();

  useEffect(() => {
    loadSession();
  }, []);

  let content;
  if (!loaded) {
    content = (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#1a3050" />
      </View>
    );
  } else if (!session) {
    content = <LoginScreen />;
  } else {
    // Keyed by user so a different login always starts with a fresh navigation state.
    content = (
      <NavigationContainer key={session.user?.id}>
        <AppNavigator />
      </NavigationContainer>
    );
  }

  return <GestureHandlerRootView style={styles.root}>{content}</GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f8fa' },
});
