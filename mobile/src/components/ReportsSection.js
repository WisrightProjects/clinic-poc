// Purpose: "Previous reports" strip on the intake screen (CLINIC-011): an Add report
// button (camera or gallery), thumbnails of the uploaded photos, and a remove button on
// each. Photos are not read by any AI here — the doctor just sees them on the dashboard.
// `editable` is false once the visit is submitted: the backend rejects adds/removes then.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useReports } from '../hooks/useReports';
import { fetchReportImage } from '../api/reportApi';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

function Thumbnail({ report, editable, disabled, onRemove }) {
  // 'loading' | 'failed' | the image's data URL
  const [image, setImage] = useState('loading');

  useEffect(() => {
    let alive = true;
    fetchReportImage(report.id)
      .then((dataUrl) => alive && setImage(dataUrl))
      .catch(() => alive && setImage('failed'));
    return () => {
      alive = false;
    };
  }, [report.id]);

  const loaded = image !== 'loading' && image !== 'failed';

  return (
    <View style={styles.thumbWrap}>
      {loaded ? (
        <Image source={{ uri: image }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          {image === 'failed' ? <Text style={styles.thumbFail}>!</Text> : <ActivityIndicator size="small" color={NAVY} />}
        </View>
      )}
      {editable ? (
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={onRemove}
          disabled={disabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Remove report photo"
        >
          <Text style={styles.removeText}>×</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ReportsSection({ visitId, editable }) {
  const { reports, remaining, busy, error, addFromCamera, addFromGallery, remove } = useReports(visitId);

  const onAdd = () =>
    Alert.alert('Add report', 'Photograph the patient\'s previous reports or pick them from the gallery.', [
      { text: 'Take photo', onPress: addFromCamera },
      { text: 'Choose from gallery', onPress: addFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const onRemove = (report) =>
    Alert.alert('Remove this photo?', 'It will be deleted from the patient\'s reports.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove(report.id) },
    ]);

  if (!editable && reports.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Previous reports{reports.length ? ` (${reports.length})` : ''}</Text>
        {busy ? <ActivityIndicator size="small" color={TEAL} style={styles.spinner} /> : null}
        {editable ? (
          <TouchableOpacity style={styles.addBtn} onPress={onAdd} disabled={busy || remaining <= 0}>
            <Text style={[styles.addText, (busy || remaining <= 0) && styles.addTextDisabled]}>+ Add report</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {reports.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {reports.map((r) => (
            <Thumbnail key={r.id} report={r} editable={editable} disabled={busy} onRemove={() => onRemove(r)} />
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.hint}>Optional — add photos of any old reports the patient brought.</Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e8edf2',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: NAVY },
  spinner: { marginLeft: 8 },
  addBtn: { marginLeft: 'auto', minHeight: 44, justifyContent: 'center', paddingLeft: 12 },
  addText: { fontSize: 14, fontWeight: '700', color: TEAL },
  addTextDisabled: { opacity: 0.4 },
  strip: { paddingTop: 4, paddingBottom: 4 },
  thumbWrap: { marginRight: 10, paddingTop: 8 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#eef2f6' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbFail: { fontSize: 20, fontWeight: '800', color: '#c0392b' },
  removeBtn: {
    position: 'absolute',
    top: 0,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#c0392b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#ffffff', fontSize: 16, lineHeight: 18, fontWeight: '800' },
  hint: { fontSize: 12.5, color: '#6b7c93', paddingBottom: 6 },
  error: { fontSize: 13, color: '#c0392b', paddingTop: 4, paddingBottom: 2 },
});
