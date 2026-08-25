// Purpose: Home / Patient Queue screen — the attender's landing screen.
// Shows visits grouped by date, newest day first (tap a row to resume its
// intake), and a "New Patient" button to start a fresh registration. This is the
// hub that links into the CLINIC-003 flow. Settings (question template) is
// reachable via the header gear configured in AppNavigator. Data comes from
// GET /visits via useVisitQueue.
//
// Tokens restart at 1 each day, so a flat list showed the same token number
// repeating with no context; grouping by visit_date makes each day read 1, 2, 3…

import React, { useState } from 'react';
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
// Use the safe-area-context SafeAreaView (not RN's deprecated one) so the bottom
// inset is applied on Android — otherwise the footer button hides behind the nav bar.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useVisitQueue } from '../hooks/useVisitQueue';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

// visit_status → pill colour. Keeps the queue scannable at a glance.
const STATUS_STYLE = {
  waiting: { bg: '#fff4e5', fg: '#b26a00', label: 'Waiting' },
  answering: { bg: '#e6f7f7', fg: TEAL, label: 'Answering' },
  answered: { bg: '#e8f0fe', fg: '#1a56c4', label: 'Answered' },
  summarised: { bg: '#ede7f6', fg: '#5e35b1', label: 'Summarised' },
  done: { bg: '#e6ffed', fg: '#38a169', label: 'Done' },
};

// Local calendar day as YYYY-MM-DD, so "Today"/"Yesterday" match the wall clock
// without a timezone shift.
function dayKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function todayKey() {
  return dayKey(new Date());
}
function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1); // JS rolls month/year back correctly
  return dayKey(d);
}

function formatDate(key) {
  if (!key || key === 'unknown') return 'No date';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d); // local construction — no tz shift
  return dt.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Compact "25 Aug" — appended to Today/Yesterday so the actual calendar date is
// still visible (otherwise the relative label hides which day it resolves to,
// and the Home header shows no date of its own).
function shortDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Bucket visits by visit_date (date part only), newest day first. Within a day,
// order by token so it reads 1, 2, 3… Shape matches SectionList's sections prop.
function buildSections(visits) {
  const buckets = new Map();
  for (const v of visits) {
    const key = (v.visit_date || '').slice(0, 10) || 'unknown';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(v);
  }
  return [...buckets.entries()]
    .sort((a, b) => {
      if (a[0] === b[0]) return 0;
      if (a[0] === 'unknown') return 1; // undated always last, whatever it sorts as
      if (b[0] === 'unknown') return -1;
      return a[0] < b[0] ? 1 : -1; // real dates newest first
    })
    .map(([key, items]) => ({
      key,
      title: formatDate(key),
      data: [...items].sort((x, y) => (x.token_number ?? 0) - (y.token_number ?? 0)),
    }));
}

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] ?? { bg: '#eceff3', fg: '#6b7c93', label: status ?? '—' };
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

// Intake progress for the answered/total badge. `idle` = nothing recorded,
// `done` = every template question answered, `live` = partway. Counts come from
// GET /visits (answered_count / total_questions).
function progress(v) {
  const answered = v.answered_count ?? 0;
  const total = v.total_questions ?? 0;
  const state = answered <= 0 ? 'idle' : answered >= total ? 'done' : 'live';
  // Fill reaches 100% only when actually complete; floor while partial so a
  // near-complete ratio (e.g. 199/200) can't fill the bar a question early.
  const pct = total <= 0 ? 0 : state === 'done' ? 100 : Math.min(99, Math.floor((answered / total) * 100));
  return { answered, total, pct, state };
}

// A slim fill + "answered/total", in the row's subtitle slot. Colour tracks the
// state; the badge is hidden entirely when the template has no questions.
function ProgressBadge({ visit }) {
  const { answered, total, pct, state } = progress(visit);
  if (total <= 0) return null;
  const fill = state === 'idle' ? '#b8c2d0' : state === 'done' ? '#2f855a' : TEAL;
  const num = state === 'live' ? TEAL : state === 'done' ? '#2f855a' : '#6b7c93';
  return (
    <View style={styles.progRow}>
      <View style={styles.progTrack}>
        <View style={[styles.progFill, { width: `${pct}%`, backgroundColor: fill }]} />
      </View>
      <Text style={[styles.progNum, { color: num }]}>{answered}/{total} answered</Text>
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { visits, loading, error, reload } = useVisitQueue();
  const today = todayKey();
  const yesterday = yesterdayKey();

  // A day is open by default if it's Today or Yesterday. Computed live each
  // render (not seeded once), so it stays correct across a midnight boundary —
  // the new day's section opens on its own instead of staying collapsed.
  const defaultOpen = (key) => key === today || key === yesterday;

  // Track only the user's explicit toggles (key -> open?), layered over the live
  // defaults above. Keeps the caret functional on every day (incl. today) with
  // no effect, and survives focus reloads (re-render, not remount).
  const [userToggled, setUserToggled] = useState({});
  const isOpen = (key) => (key in userToggled ? userToggled[key] : defaultOpen(key));
  const toggle = (key) =>
    setUserToggled((prev) => {
      const currentlyOpen = key in prev ? prev[key] : defaultOpen(key);
      return { ...prev, [key]: !currentlyOpen };
    });

  // Collapsed sections keep their header but render no rows (data: []). `count`
  // carries the real total so the header badge still shows it while collapsed.
  // Today/Yesterday keep the date alongside the relative label (see shortDate).
  const sections = buildSections(visits).map((s) => ({
    key: s.key,
    title:
      s.key === today
        ? `Today · ${shortDate(s.key)}`
        : s.key === yesterday
        ? `Yesterday · ${shortDate(s.key)}`
        : s.title,
    count: s.data.length,
    data: isOpen(s.key) ? s.data : [],
  }));

  const renderRow = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('QuestionList', { visitId: item.id })}
    >
      <View style={styles.tokenBadge}>
        <Text style={styles.tokenText}>{item.token_number}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.patientName} numberOfLines={1}>
          {item.patient_name}
        </Text>
        <ProgressBadge visit={item} />
      </View>
      <StatusPill status={item.status} />
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }) => {
    const open = isOpen(section.key);
    return (
      <TouchableOpacity
        style={styles.sectionHdr}
        activeOpacity={0.7}
        onPress={() => toggle(section.key)}
      >
        <Text style={styles.sectionCaret}>{open ? '▾' : '▸'}</Text>
        <Text style={styles.sectionDate}>{section.title}</Text>
        <Text style={styles.sectionCount}>{section.count}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Patient Queue</Text>
        <Text style={styles.subheading}>
          {visits.length} {visits.length === 1 ? 'patient' : 'patients'} in queue
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {error?.response?.data?.error?.message ?? error.message ?? 'Failed to load queue'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reload}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : visits.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No patients yet</Text>
          <Text style={styles.emptyBody}>Tap “New Patient” below to register the first visit.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRow}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.newBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('NewPatient')}
        >
          <Text style={styles.newBtnText}>+  New Patient</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  heading: { fontSize: 22, fontWeight: '700', color: NAVY },
  subheading: { fontSize: 13, color: '#6b7c93', marginTop: 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  sectionHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef4f4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 12,
  },
  sectionCaret: { fontSize: 12, color: '#6b7c93', width: 14, marginRight: 6 },
  sectionDate: { fontSize: 13, fontWeight: '700', color: NAVY },
  sectionCount: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7c93',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e8edf2',
  },
  tokenBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tokenText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  rowBody: { flex: 1, minWidth: 0 },
  patientName: { fontSize: 16, fontWeight: '600', color: NAVY },
  progRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  progTrack: { width: 60, height: 5, borderRadius: 3, backgroundColor: '#dde4ec', overflow: 'hidden', marginRight: 8 },
  progFill: { height: '100%', borderRadius: 3 },
  progNum: { fontSize: 12, fontWeight: '700' },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  errorText: { fontSize: 15, color: '#c0392b', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: NAVY, borderRadius: 6, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: NAVY, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#6b7c93', textAlign: 'center' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8edf2',
    backgroundColor: '#ffffff',
  },
  newBtn: {
    backgroundColor: TEAL,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  newBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
