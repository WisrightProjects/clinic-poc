// Purpose: Root stack navigator for the attender app.
// Registers all top-level screens; CLINIC-002 Settings flow is preserved unchanged.
// CLINIC-004 (Recording) and CLINIC-005 (Review) screens are forward-declared as
// null placeholders until those stories are implemented.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsStack } from './SettingsStack';
import NewPatientScreen from '../screens/NewPatientScreen';
import QuestionListScreen from '../screens/QuestionListScreen';

// Forward declarations — replaced by CLINIC-004 and CLINIC-005 respectively
const RecordingPlaceholder = () => null;
const ReviewPlaceholder = () => null;

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Settings"
      screenOptions={{
        headerStyle: { backgroundColor: '#1a3050' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      {/* CLINIC-002 — settings / question template setup */}
      <Stack.Screen
        name="Settings"
        component={SettingsStack}
        options={{ headerShown: false }}
      />

      {/* CLINIC-003 — new patient form */}
      <Stack.Screen
        name="NewPatient"
        component={NewPatientScreen}
        options={{ title: 'New Patient' }}
      />

      {/* CLINIC-003 — intake question list */}
      <Stack.Screen
        name="QuestionList"
        component={QuestionListScreen}
        options={{ title: 'Patient Intake' }}
      />

      {/* CLINIC-004 placeholder — voice recording */}
      <Stack.Screen
        name="Recording"
        component={RecordingPlaceholder}
        options={{ headerShown: false }}
      />

      {/* CLINIC-005 placeholder — attender review */}
      <Stack.Screen
        name="Review"
        component={ReviewPlaceholder}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
