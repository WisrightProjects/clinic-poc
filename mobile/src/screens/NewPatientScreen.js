// Purpose: New patient form — captures fields, validates, creates a visit, then
// navigates to QuestionListScreen. Uses single-flight guard to prevent duplicate creates.
// AC9: client-side validation before calling API.
// AC10: offline / 5xx shows retry banner; field values preserved.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { createVisit } from '../api/visitApi';
import { apiClient } from '../api/client';
import { withSingleFlight } from '../utils/retry';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

// Single-flight wrapper — prevents duplicate visit creates on double-tap / retry race
const createVisitOnce = withSingleFlight(createVisit);

export default function NewPatientScreen() {
  const navigation = useNavigation();

  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [departmentId, setDepartmentId] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [deptError, setDeptError] = useState(null);

  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient.get('/departments')
      .then(res => setDepartments(res.data))
      .catch(() => setDeptError('Could not load departments. Please restart.'));
  }, []);

  // AC9: client-side validation — returns errors object, empty means valid
  const validate = useCallback(() => {
    const errs = {};
    if (!patientName.trim()) errs.patientName = 'Patient name is required';
    if (!departmentId) errs.departmentId = 'Department is required';
    const ageNum = age !== '' ? Number(age) : null;
    if (age !== '' && (isNaN(ageNum) || ageNum < 0 || ageNum > 120)) {
      errs.age = 'Age must be between 0 and 120';
    }
    if (sex && !['M', 'F', 'O'].includes(sex)) errs.sex = 'Select a valid option';
    return errs;
  }, [patientName, age, sex, departmentId]);

  const handleSubmit = useCallback(async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSubmitError(null);
    setSubmitting(true);

    const body = {
      patientName: patientName.trim(),
      age: age !== '' ? Number(age) : undefined,
      sex: sex || undefined,
      departmentId,
    };

    try {
      // AC10: single-flight prevents duplicate on retry race; fields are preserved in state
      const visit = await createVisitOnce(body);
      navigation.navigate('QuestionList', { visitId: visit.id });
    } catch (err) {
      // AC10: show retry banner; field values remain in state
      const msg =
        err?.response?.data?.error?.message ??
        err?.message ??
        'Could not create visit. Please retry.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [validate, patientName, age, sex, departmentId, navigation]);

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>New Patient</Text>

        {submitError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{submitError}</Text>
            <TouchableOpacity onPress={handleSubmit}>
              <Text style={styles.retryLink}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Patient Name */}
        <Text style={styles.label}>Patient Name *</Text>
        <TextInput
          style={[styles.input, fieldErrors.patientName && styles.inputError]}
          value={patientName}
          onChangeText={setPatientName}
          placeholder="e.g. Lakshmi K."
          autoCapitalize="words"
        />
        {fieldErrors.patientName && <Text style={styles.fieldError}>{fieldErrors.patientName}</Text>}

        {/* Age */}
        <Text style={styles.label}>Age</Text>
        <TextInput
          style={[styles.input, fieldErrors.age && styles.inputError]}
          value={age}
          onChangeText={setAge}
          placeholder="0–120"
          keyboardType="numeric"
          maxLength={3}
        />
        {fieldErrors.age && <Text style={styles.fieldError}>{fieldErrors.age}</Text>}

        {/* Sex */}
        <Text style={styles.label}>Sex</Text>
        <View style={[styles.pickerWrap, fieldErrors.sex && styles.inputError]}>
          <Picker selectedValue={sex} onValueChange={setSex}>
            <Picker.Item label="Select…" value="" />
            <Picker.Item label="Male (M)" value="M" />
            <Picker.Item label="Female (F)" value="F" />
            <Picker.Item label="Other (O)" value="O" />
          </Picker>
        </View>
        {fieldErrors.sex && <Text style={styles.fieldError}>{fieldErrors.sex}</Text>}

        {/* Department */}
        <Text style={styles.label}>Department *</Text>
        {deptError && <Text style={styles.fieldError}>{deptError}</Text>}
        <View style={[styles.pickerWrap, fieldErrors.departmentId && styles.inputError]}>
          <Picker
            selectedValue={departmentId}
            onValueChange={(val) => setDepartmentId(val || null)}
          >
            <Picker.Item label="Select department…" value={null} />
            {departments.map((d) => (
              <Picker.Item key={d.id} label={d.name} value={d.id} />
            ))}
          </Picker>
        </View>
        {fieldErrors.departmentId && <Text style={styles.fieldError}>{fieldErrors.departmentId}</Text>}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>Start Visit</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  form: { padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: NAVY, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: NAVY, marginBottom: 4, marginTop: 14 },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c9d6df',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a2332',
  },
  inputError: { borderColor: '#c0392b' },
  pickerWrap: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c9d6df',
    borderRadius: 8,
    overflow: 'hidden',
  },
  fieldError: { fontSize: 12, color: '#c0392b', marginTop: 3 },
  errorBanner: {
    backgroundColor: '#fdecea',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBannerText: { color: '#c0392b', fontSize: 13, flex: 1 },
  retryLink: { color: NAVY, fontWeight: '700', marginLeft: 10, fontSize: 13 },
  submitBtn: {
    backgroundColor: TEAL,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnDisabled: { backgroundColor: '#8ecece' },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
