// Purpose: New patient form — captures fields, validates, creates a visit, then
// navigates to QuestionListScreen. Uses single-flight guard to prevent duplicate creates.
// AC9: client-side validation before calling API.
// AC10: offline / 5xx shows retry banner; field values preserved.
// CLINIC-023: also mobile, weight, height and New / Follow-up (client Section 1), all optional
// except the type (default New). The server checks them again (utils/visitValidation.js).
// CLINIC-027: Mobile comes first — a number seen before lists its patients ("Seen before");
// picking one fills name, sex, age and height and sets Follow-up (all still editable).

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { createVisit } from '../api/visitApi';
import { apiClient } from '../api/client';
import { withSingleFlight } from '../utils/retry';
import { fieldErrorsOf, CHECK_FIELDS_MESSAGE } from '../utils/apiError';
import { NumberField } from '../components/NumberField';
import { ChoiceButtons } from '../components/ChoiceButtons';
import { SeenBefore } from '../components/SeenBefore';
import { usePatientLookup } from '../hooks/usePatientLookup';
import { mobileDigits, isValidMobile } from '../utils/mobile';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

// Single-flight wrapper — prevents duplicate visit creates on double-tap / retry race
const createVisitOnce = withSingleFlight(createVisit);

const PATIENT_TYPES = [
  { value: 'new', label: 'New' },
  { value: 'follow_up', label: 'Follow-up' },
];

// A blank, or a number in [min, max] with at most one decimal (weight / height).
const badMeasurement = (text, min, max) => {
  if (text.trim() === '') return false;
  const n = Number(text);
  return !Number.isFinite(n) || n < min || n > max || Math.round(n * 10) !== n * 10;
};

export default function NewPatientScreen() {
  const navigation = useNavigation();

  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [patientMobile, setPatientMobile] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [patientType, setPatientType] = useState('new');
  const [departmentId, setDepartmentId] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [deptError, setDeptError] = useState(null);

  // CLINIC-027: the patients seen before on this number, and the one picked (by name).
  const lookup = usePatientLookup(patientMobile);
  const [returning, setReturning] = useState(null);

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
    if (patientMobile !== '' && !isValidMobile(patientMobile)) {
      errs.patientMobile = 'Enter a 10-digit mobile number starting 6–9';
    }
    if (badMeasurement(weightKg, 1, 300)) errs.weightKg = 'Weight must be 1–300 kg';
    if (badMeasurement(heightCm, 30, 250)) errs.heightCm = 'Height must be 30–250 cm';
    return errs;
  }, [patientName, age, sex, departmentId, patientMobile, weightKg, heightCm]);

  // A returning patient fills the form from their latest visit; weight is today's, so it is
  // left as typed. The name is copied exactly, so this visit joins their history.
  const pickReturning = useCallback((p) => {
    setPatientName(p.name);
    setAge(p.age != null ? String(p.age) : '');
    setSex(p.sex ?? '');
    setHeightCm(p.height_cm != null ? String(Number(p.height_cm)) : '');
    setPatientType('follow_up');
    setReturning(p.name);
  }, []);

  // Change: the wrong patient was picked — empty what the pick filled and go back to New.
  const clearReturning = useCallback(() => {
    setPatientName('');
    setAge('');
    setSex('');
    setHeightCm('');
    setPatientType('new');
    setReturning(null);
  }, []);

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
      // Sent as typed: the server treats blanks as empty and converts the numbers.
      patientMobile,
      weightKg,
      heightCm,
      patientType,
    };

    try {
      // AC10: single-flight prevents duplicate on retry race; fields are preserved in state
      const visit = await createVisitOnce(body);
      navigation.navigate('QuestionList', { visitId: visit.id });
    } catch (err) {
      // AC10: show retry banner; field values remain in state
      // A field the server refused (CLINIC-024) is shown under that field.
      const fields = fieldErrorsOf(err);
      if (Object.keys(fields).length) {
        setFieldErrors(fields);
        setSubmitError(CHECK_FIELDS_MESSAGE);
        return;
      }
      const msg =
        err?.response?.data?.error?.message ??
        err?.message ??
        'Could not create visit. Please retry.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [validate, patientName, age, sex, departmentId, patientMobile, weightKg, heightCm, patientType, navigation]);

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
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

        {/* CLINIC-023 — Mobile (digits only; never shown in the queue). First (CLINIC-027): a
            number seen before lists its patients. Changing the number or the name forgets the pick. */}
        <Text style={styles.label}>Mobile</Text>
        <TextInput
          style={[styles.input, fieldErrors.patientMobile && styles.inputError]}
          value={patientMobile}
          onChangeText={(t) => { setPatientMobile(mobileDigits(t)); setReturning(null); }}
          placeholder="10 digits"
          keyboardType="number-pad"
        />
        {fieldErrors.patientMobile && <Text style={styles.fieldError}>{fieldErrors.patientMobile}</Text>}
        <SeenBefore patients={lookup.patients} failed={lookup.failed} picked={returning} onPick={pickReturning} onClear={clearReturning} />

        {/* Patient Name */}
        <Text style={styles.label}>Patient Name *</Text>
        <TextInput
          style={[styles.input, fieldErrors.patientName && styles.inputError]}
          value={patientName}
          onChangeText={(t) => { setPatientName(t); setReturning(null); }}
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
          <Picker selectedValue={sex} onValueChange={setSex} style={styles.picker} dropdownIconColor={NAVY}>
            <Picker.Item label="Select…" value="" />
            <Picker.Item label="Male (M)" value="M" />
            <Picker.Item label="Female (F)" value="F" />
            <Picker.Item label="Other (O)" value="O" />
          </Picker>
        </View>
        {fieldErrors.sex && <Text style={styles.fieldError}>{fieldErrors.sex}</Text>}

        {/* CLINIC-023 — Weight / Height */}
        <View style={styles.row}>
          <NumberField label="Weight (kg)" value={weightKg} onChangeText={setWeightKg} placeholder="e.g. 72" error={fieldErrors.weightKg} decimal style={styles.half} />
          <NumberField label="Height (cm)" value={heightCm} onChangeText={setHeightCm} placeholder="e.g. 165" error={fieldErrors.heightCm} decimal style={styles.half} />
        </View>

        {/* CLINIC-023 — New / Follow-up */}
        <Text style={styles.label}>Patient type</Text>
        <View style={styles.row}>
          <ChoiceButtons options={PATIENT_TYPES} value={patientType} onChange={setPatientType} />
        </View>

        {/* Department */}
        <Text style={styles.label}>Department *</Text>
        {deptError && <Text style={styles.fieldError}>{deptError}</Text>}
        <View style={[styles.pickerWrap, fieldErrors.departmentId && styles.inputError]}>
          <Picker
            selectedValue={departmentId}
            onValueChange={(val) => setDepartmentId(val || null)}
            style={styles.picker}
            dropdownIconColor={NAVY}
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
  // A minimum, not a fixed height: with a large phone font a fixed 50 cut the text off.
  picker: { minHeight: 50, color: NAVY },
  fieldError: { fontSize: 12, color: '#c0392b', marginTop: 3 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
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
  retryLink: { color: TEAL, fontWeight: '700', marginLeft: 10, fontSize: 13 },
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
