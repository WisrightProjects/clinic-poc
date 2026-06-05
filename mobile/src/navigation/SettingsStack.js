import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import QuestionSetupScreen from '../screens/settings/QuestionSetupScreen';

const Stack = createNativeStackNavigator();

export function SettingsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1a3050' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen
        name="QuestionSetup"
        component={QuestionSetupScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
