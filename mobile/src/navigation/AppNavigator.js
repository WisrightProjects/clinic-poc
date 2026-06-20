// Purpose: Root stack navigator for the attender app.
// Registers all top-level screens; CLINIC-002 Settings flow is preserved unchanged.
// CLINIC-004 (Recording) and CLINIC-005 (Review) screens are forward-declared as
// null placeholders until those stories are implemented.

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsStack } from './SettingsStack';
import HomeScreen from '../screens/HomeScreen';
import NewPatientScreen from '../screens/NewPatientScreen';
import QuestionListScreen from '../screens/QuestionListScreen';
import RecordingScreen from '../screens/RecordingScreen';
import ReviewSubmitScreen from '../screens/ReviewSubmitScreen';
import SentScreen from '../screens/SentScreen';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#1a3050' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      {/* Home / patient queue — attender landing screen (links into CLINIC-003) */}
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'ClinicAI',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 20 }}>⚙</Text>
            </TouchableOpacity>
          ),
        })}
      />

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

      {/* CLINIC-004 — voice recording */}
      <Stack.Screen
        name="Recording"
        component={RecordingScreen}
        options={{ title: 'Record Answer' }}
      />

      {/* CLINIC-005 — attender review & submit */}
      <Stack.Screen
        name="Review"
        component={ReviewSubmitScreen}
        options={{ title: 'Review & Submit' }}
      />

      {/* CLINIC-005 — sent confirmation */}
      <Stack.Screen
        name="Sent"
        component={SentScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
