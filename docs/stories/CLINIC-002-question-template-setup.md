# User Story: Question Template Setup — Configure a department's intake questions on mobile

**Story ID:** CLINIC-002
**Epic:** Configuration
**Feature:** Admin/clinic-staff configure the ordered set of intake questions per department on a mobile settings screen
**Priority:** P1 (High)
**Effort:** 2.5 days (20 hours)
**Sprint:** Phase 1 — POC Build
**Status:** Ready for Development
**Depends On:** CLINIC-001 (backend bootstrap, PostgreSQL, `departments` / `question_templates` / `questions` tables + seed data, and `GET /api/templates` / `PUT /api/templates/:id` endpoints)

---

## Story Overview

**As an** admin / clinic-staff user
**I want** to select a department, see its active template's questions in order, and add, edit, delete, and reorder those questions before saving
**So that** the attender's intake flow asks the right questions for that department without a developer changing code

**As a** clinic owner / doctor
**I want** the intake questions for my department to be configurable and persisted reliably
**So that** every patient is asked a consistent, clinically relevant set of questions, and changes I make survive an app reload

---

## Why This Feature?

### Current Gap:
- The intake questions are hard-coded inside the static HTML mockup (`clinic-flow.html`, screen S-01) and the attender flow — there is no way to change them without editing source.
- Different departments (General, Pediatrics, etc.) need different question sets, but no per-department configuration exists.
- There is no persistence: the mockup shows a list and a "Save Template" button that does nothing.
- No ordering control — the attender flow assumes a fixed Q1..Q5 order with no way to reorder.

### Real-World Use Case (Clinic adds a "fever follow-up" question for General):
The General department's senior nurse decides every fever patient should also be asked "Any travel in the last 14 days?" before the doctor sees them. Today she would have to call the developer. With this feature she opens the ClinicAI app, taps **Settings > Question Setup**, picks **Department: General**, taps **+ Add Question**, types the new question, drag-reorders it to position 2 (right after "Main complaint today?"), and taps **Save Template**. The next attender who opens a General visit immediately sees the updated, reordered question list.
- She selects the department from a picker.
- She sees the 5 existing active questions in `order_index` order.
- She adds, edits, deletes, and reorders questions inline.
- She saves; the order is persisted via `order_index`.

This cannot be done with the current implementation (static mockup, no backend wiring).

### Solution:
Build the **Question Setup** settings screen in the React Native (Expo) app shell (the same APK the attender uses) to support:
- **Department selection** — choose which department's active template to edit.
- **Load template** — fetch the active template + its ordered questions via `GET /api/templates?departmentId=`.
- **Edit operations** — add, inline-edit, and delete questions in local state.
- **Drag reorder** — reorder questions; positions persist as `order_index` on save.
- **Save** — persist the full question set via `PUT /api/templates/:id` (last-write-wins).
- **Validation + feedback** — required, length-bounded question text; at least one question; clear save success/failure feedback.

---

## User Personas

### Primary: Anitha — The Clinic Admin / Senior Attender
- **Role:** Front-desk lead who owns intake quality and trains other attenders.
- **Goal:** Keep each department's intake questions correct and well-ordered without involving a developer.
- **Pain Point:** "When the doctor wants a new question added, I have to wait days for someone technical. I should be able to just type it in and save."

### Secondary: Dr. Ramesh — The Department Doctor
- **Role:** General physician who reviews patient intake before consultation.
- **Goal:** Ensure the attender always captures the clinically relevant answers in a sensible order.
- **Pain Point:** "Sometimes the most important question is buried at the bottom. I want my team to reorder them in seconds and have it stick."

---

## Detailed Sub-Stories

### Sub-Story 1: Settings entry + Department picker + load template

**Story ID:** CLINIC-002.1
**Points:** 3 | **Effort:** 4 hours

```gherkin
As an admin/clinic-staff user
I want to open Settings > Question Setup and pick a department
So that I can load that department's active template and its questions in order
```

### Sub-Story 2: Render ordered question list (with empty state)

**Story ID:** CLINIC-002.2
**Points:** 2 | **Effort:** 3 hours

```gherkin
As an admin/clinic-staff user
I want to see the active template's questions numbered in order_index order
So that I can understand and review the current intake set, including when it is empty
```

### Sub-Story 3: Add / edit / delete a question (local state + validation)

**Story ID:** CLINIC-002.3
**Points:** 5 | **Effort:** 5 hours

```gherkin
As an admin/clinic-staff user
I want to add a new question, edit existing question text, and delete a question
So that I can shape the intake set, with validation preventing empty or over-long text
```

### Sub-Story 4: Drag-reorder questions (persisted via order_index)

**Story ID:** CLINIC-002.4
**Points:** 3 | **Effort:** 4 hours

```gherkin
As an admin/clinic-staff user
I want to drag questions into a new order
So that the saved order_index reflects the order I set and reloads correctly
```

### Sub-Story 5: Save template + success/failure feedback (last-write-wins)

**Story ID:** CLINIC-002.5
**Points:** 3 | **Effort:** 4 hours

```gherkin
As an admin/clinic-staff user
I want to save the whole question set and get clear success or failure feedback
So that I know my changes were persisted (last-write-wins on concurrent edits)
```

---

## Acceptance Criteria

### AC1: Department selection loads the active template
```gherkin
GIVEN I am on the Settings > Question Setup screen as an admin/attender
WHEN I select "General" from the department picker
THEN the app calls GET /api/templates?departmentId={generalId}
AND the active template's questions are displayed numbered in order_index order
```

### AC2: Questions render in order_index order
```gherkin
GIVEN the General template has questions with order_index 0..4
WHEN the screen finishes loading
THEN questions appear top-to-bottom as 1..5 matching ascending order_index
AND each row shows a drag handle, position number, question text, and edit affordance
```

### AC3: Empty-template state
```gherkin
GIVEN the selected department's active template has zero questions
WHEN the screen finishes loading
THEN an empty-state message is shown (e.g. "No questions yet — add your first question")
AND the "+ Add Question" control is visible
AND the "Save Template" action is disabled until at least one valid question exists
```

### AC4: Add a question
```gherkin
GIVEN I am viewing a loaded template
WHEN I tap "+ Add Question" and enter "Any travel in the last 14 days?"
THEN a new question row is appended in local state with the next order_index
AND the new row is editable and counts toward the saved set on Save
```

### AC5: Edit a question inline
```gherkin
GIVEN a question row exists
WHEN I tap its edit affordance and change the text to a valid value
THEN the updated text is held in local state
AND the change is reflected in the list immediately (not yet persisted)
```

### AC6: Delete a question
```gherkin
GIVEN the template has more than one question
WHEN I delete a question row
THEN the row is removed from local state
AND the remaining rows renumber 1..N
AND the change is reflected in the list immediately (not yet persisted)
```

### AC7: Question text required + length-bounded
```gherkin
GIVEN I am adding or editing a question
WHEN the text is empty/whitespace OR shorter than 3 characters OR longer than 200 characters
THEN an inline validation error is shown on that row
AND the "Save Template" action is blocked until all rows are valid
```

### AC8: At least one question per template
```gherkin
GIVEN I delete questions until none remain
WHEN I attempt to save
THEN saving is blocked with the message "A template must have at least one question"
AND no PUT /api/templates/:id request is sent
```

### AC9: Reorder persists via order_index
```gherkin
GIVEN questions are in order Q1, Q2, Q3
WHEN I drag Q3 above Q1 and tap "Save Template"
THEN PUT /api/templates/:id is sent with questions carrying order_index 0,1,2 in the new visual order
AND on reload via GET /api/templates?departmentId= the new order is returned
```

### AC10: Add/edit/delete reflected after reload
```gherkin
GIVEN I added, edited, and deleted questions then saved successfully
WHEN I leave the screen and reopen Settings > Question Setup for the same department
THEN the persisted question set (text + order) matches exactly what I saved
```

### AC11: Save success feedback
```gherkin
GIVEN all questions are valid and at least one exists
WHEN I tap "Save Template" and PUT /api/templates/:id returns 200
THEN a success confirmation is shown (e.g. toast "Template saved")
AND the screen reflects the saved, server-confirmed question set
```

### AC12: Save failure feedback + last-write-wins note
```gherkin
GIVEN I tap "Save Template"
WHEN PUT /api/templates/:id fails (network error or non-2xx)
THEN a non-blocking error is shown (e.g. "Could not save — try again") and my local edits are preserved
AND on success the request overwrites the server's question set entirely (last-write-wins; concurrent edits from another user may be overwritten without merge in this POC)
```

---

## Technical Implementation

Phase mock/real rules applied: backend, DB, and visit-status sync are **REAL**; speech-to-text and AI summary are out of scope for this story. This story touches **no** audio/STT/summary code. No real auth — the user's role is passed via an `x-role` header (`admin` / `attender`), read by the backend.

### Part 1: Backend — templates read/write (6 hours)

#### Task 1.1: Templates route

**File:** `backend/src/routes/templates.routes.js` — **NEW**

Wire the canonical endpoints to the controller (CLINIC-001 may have stubbed these; this story finalizes the read-with-questions and full-replace write).

```javascript
// backend/src/routes/templates.routes.js
// Purpose: REST routes for question templates (read active template + questions, replace question set).
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/templates.controller');

router.get('/templates', ctrl.getTemplateByDepartment);   // GET /api/templates?departmentId=
router.put('/templates/:id', ctrl.updateTemplate);        // PUT /api/templates/:id

module.exports = router;
```

#### Task 1.2: Templates controller (thin: input -> service -> output)

**File:** `backend/src/controllers/templates.controller.js` — **NEW**

```javascript
// backend/src/controllers/templates.controller.js
// Purpose: Validate request shape, delegate to service, map result/errors to HTTP.
const templatesService = require('../services/templates.service');

async function getTemplateByDepartment(req, res, next) {
  try {
    const departmentId = Number(req.query.departmentId);
    if (!departmentId) return res.status(400).json({ error: 'departmentId is required' });
    const template = await templatesService.getActiveTemplateWithQuestions(departmentId);
    if (!template) return res.status(404).json({ error: 'No active template for department' });
    return res.json(template);
  } catch (err) { return next(err); }
}

async function updateTemplate(req, res, next) {
  try {
    const templateId = Number(req.params.id);
    const { questions } = req.body; // [{ id?, text, order_index }]
    const saved = await templatesService.replaceQuestions(templateId, questions);
    return res.json(saved);
  } catch (err) { return next(err); }
}

module.exports = { getTemplateByDepartment, updateTemplate };
```

#### Task 1.3: Templates service (business logic + validation)

**File:** `backend/src/services/templates.service.js` — **NEW**

All validation and the full-replace (last-write-wins) logic live here, not in the controller.

```javascript
// backend/src/services/templates.service.js
// Purpose: Business rules for question templates.
// Input: departmentId | (templateId, questions[]). Output: { id, department_id, questions[] }.
const templatesRepo = require('../repositories/templates.repository');
const { validateQuestions } = require('../utils/questionValidation');

async function getActiveTemplateWithQuestions(departmentId) {
  const template = await templatesRepo.findActiveByDepartment(departmentId);
  if (!template) return null;
  const questions = await templatesRepo.findQuestionsByTemplate(template.id); // ordered by order_index
  return { ...template, questions };
}

// Last-write-wins: the incoming list fully replaces the stored questions for this template.
async function replaceQuestions(templateId, questions) {
  validateQuestions(questions); // throws 422 on empty set / bad text
  const normalised = questions.map((q, i) => ({ text: q.text.trim(), order_index: i }));
  return templatesRepo.replaceQuestions(templateId, normalised); // transactional in repo
}

module.exports = { getActiveTemplateWithQuestions, replaceQuestions };
```

#### Task 1.4: Templates repository (transactional replace on `questions`)

**File:** `backend/src/repositories/templates.repository.js` — **NEW**

```javascript
// backend/src/repositories/templates.repository.js
// Purpose: Data access for question_templates + questions tables.
const db = require('../config/db');

const findActiveByDepartment = (departmentId) =>
  db.one(
    `SELECT id, department_id, name, is_active, created_at
       FROM question_templates
      WHERE department_id = $1 AND is_active = TRUE
      ORDER BY created_at DESC LIMIT 1`, [departmentId]
  ).catch(() => null);

const findQuestionsByTemplate = (templateId) =>
  db.any(
    `SELECT id, template_id, order_index, text
       FROM questions WHERE template_id = $1 ORDER BY order_index ASC`, [templateId]
  );

// Full replace inside a transaction → last-write-wins.
const replaceQuestions = (templateId, questions) =>
  db.tx(async (t) => {
    await t.none(`DELETE FROM questions WHERE template_id = $1`, [templateId]);
    for (const q of questions) {
      await t.none(
        `INSERT INTO questions (template_id, order_index, text) VALUES ($1, $2, $3)`,
        [templateId, q.order_index, q.text]
      );
    }
    const rows = await t.any(
      `SELECT id, template_id, order_index, text FROM questions
        WHERE template_id = $1 ORDER BY order_index ASC`, [templateId]);
    return { id: templateId, questions: rows };
  });

module.exports = { findActiveByDepartment, findQuestionsByTemplate, replaceQuestions };
```

#### Task 1.5: Shared question validation util

**File:** `backend/src/utils/questionValidation.js` — **NEW**

```javascript
// backend/src/utils/questionValidation.js
// Purpose: Validate a question set. Input: questions[]. Output: void (throws on invalid).
const MIN = 3, MAX = 200;

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    const e = new Error('A template must have at least one question'); e.status = 422; throw e;
  }
  for (const q of questions) {
    const text = (q.text || '').trim();
    if (text.length < MIN || text.length > MAX) {
      const e = new Error(`Question text must be ${MIN}-${MAX} characters`); e.status = 422; throw e;
    }
  }
}

module.exports = { validateQuestions, MIN, MAX };
```

### Part 2: React Native — Question Setup screen (10 hours)

#### Task 2.1: API client for templates

**File:** `mobile/src/api/templates.api.js` — **NEW**

```javascript
// mobile/src/api/templates.api.js
// Purpose: Typed calls to the templates endpoints. Role passed via x-role header (no real auth).
import { apiClient } from './client'; // axios instance with baseURL + x-role

export const getTemplateByDepartment = (departmentId) =>
  apiClient.get(`/templates`, { params: { departmentId } }).then((r) => r.data);

export const saveTemplateQuestions = (templateId, questions) =>
  apiClient.put(`/templates/${templateId}`, { questions }).then((r) => r.data);

export const getDepartments = () => apiClient.get(`/departments`).then((r) => r.data);
```

#### Task 2.2: useQuestionTemplate hook (load, mutate, save state)

**File:** `mobile/src/hooks/useQuestionTemplate.js` — **NEW**

```javascript
// mobile/src/hooks/useQuestionTemplate.js
// Purpose: Own the local editable question list, loading/saving state, and validation flags.
import { useCallback, useState } from 'react';
import { getTemplateByDepartment, saveTemplateQuestions } from '../api/templates.api';
import { isQuestionValid } from '../utils/questionValidation';

export function useQuestionTemplate() {
  const [templateId, setTemplateId] = useState(null);
  const [questions, setQuestions] = useState([]); // [{ key, id?, text }]
  const [status, setStatus] = useState('idle');   // idle|loading|saving|error

  const load = useCallback(async (departmentId) => {
    setStatus('loading');
    try {
      const t = await getTemplateByDepartment(departmentId);
      setTemplateId(t.id);
      setQuestions(t.questions.map((q) => ({ key: String(q.id), id: q.id, text: q.text })));
      setStatus('idle');
    } catch (e) { setStatus('error'); throw e; }
  }, []);

  const addQuestion = () =>
    setQuestions((qs) => [...qs, { key: `new-${Date.now()}`, text: '' }]);
  const editQuestion = (key, text) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, text } : q)));
  const deleteQuestion = (key) =>
    setQuestions((qs) => qs.filter((q) => q.key !== key));
  const reorder = (next) => setQuestions(next); // DraggableFlatList gives reordered array

  const canSave = questions.length > 0 && questions.every((q) => isQuestionValid(q.text));

  const save = useCallback(async () => {
    setStatus('saving');
    const payload = questions.map((q, i) => ({ id: q.id, text: q.text.trim(), order_index: i }));
    try {
      const saved = await saveTemplateQuestions(templateId, payload); // last-write-wins
      setQuestions(saved.questions.map((q) => ({ key: String(q.id), id: q.id, text: q.text })));
      setStatus('idle');
      return true;
    } catch (e) { setStatus('error'); return false; }
  }, [templateId, questions]);

  return { questions, status, canSave, load, addQuestion, editQuestion, deleteQuestion, reorder, save };
}
```

#### Task 2.3: Shared front-end validation util

**File:** `mobile/src/utils/questionValidation.js` — **NEW**

```javascript
// mobile/src/utils/questionValidation.js
// Purpose: Mirror backend bounds for instant inline feedback. Input: text. Output: boolean / message.
export const MIN = 3, MAX = 200;
export const isQuestionValid = (text) => {
  const t = (text || '').trim();
  return t.length >= MIN && t.length <= MAX;
};
export const questionError = (text) => {
  const t = (text || '').trim();
  if (t.length < MIN) return 'Question is too short';
  if (t.length > MAX) return `Max ${MAX} characters`;
  return null;
};
```

#### Task 2.4: QuestionRow component (drag handle, edit, delete, inline error)

**File:** `mobile/src/components/QuestionRow.js` — **NEW**

Reuses the S-01 visual language (`.sq-item` row, navy position chip, drag handle, edit affordance) ported to RN styles.

```jsx
// mobile/src/components/QuestionRow.js
// Purpose: One editable question row used inside the draggable list.
import React from 'react';
import { View, TextInput, Text, Pressable } from 'react-native';
import { questionError } from '../utils/questionValidation';
import { styles } from '../styles/questionSetup.styles';

export function QuestionRow({ index, value, onChangeText, onDelete, onDragStart, drag }) {
  const error = questionError(value);
  return (
    <View style={styles.row}>
      <Pressable onLongPress={drag} style={styles.dragHandle}><Text>⠿</Text></Pressable>
      <View style={styles.numChip}><Text style={styles.numText}>{index + 1}</Text></View>
      <View style={styles.rowBody}>
        <TextInput value={value} onChangeText={onChangeText} placeholder="Question text"
          style={[styles.input, error && styles.inputError]} multiline />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
      <Pressable onPress={onDelete} hitSlop={8}><Text style={styles.deleteIcon}>🗑</Text></Pressable>
    </View>
  );
}
```

#### Task 2.5: QuestionSetupScreen (department picker, list, save)

**File:** `mobile/src/screens/settings/QuestionSetupScreen.js` — **NEW**

```jsx
// mobile/src/screens/settings/QuestionSetupScreen.js
// Purpose: Settings > Question Setup. Pick department, edit/reorder questions, save template.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { useQuestionTemplate } from '../../hooks/useQuestionTemplate';
import { DepartmentPicker } from '../../components/DepartmentPicker';
import { QuestionRow } from '../../components/QuestionRow';
import { showToast } from '../../utils/toast';
import { styles } from '../../styles/questionSetup.styles';

export default function QuestionSetupScreen() {
  const [departmentId, setDepartmentId] = useState(null);
  const { questions, status, canSave, load, addQuestion, editQuestion,
          deleteQuestion, reorder, save } = useQuestionTemplate();

  useEffect(() => { if (departmentId) load(departmentId).catch(() => showToast('Could not load template')); }, [departmentId]);

  const onSave = async () => {
    const ok = await save();
    showToast(ok ? 'Template saved' : 'Could not save — try again');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}><Text style={styles.headerLabel}>Configuration</Text>
        <Text style={styles.headerTitle}>Question Template</Text></View>
      <DepartmentPicker value={departmentId} onChange={setDepartmentId} />
      {status === 'loading' ? <ActivityIndicator /> : null}
      {status !== 'loading' && questions.length === 0 ? (
        <Text style={styles.emptyState}>No questions yet — add your first question</Text>
      ) : (
        <DraggableFlatList
          data={questions}
          keyExtractor={(q) => q.key}
          onDragEnd={({ data }) => reorder(data)}
          renderItem={({ item, getIndex, drag }) => (
            <QuestionRow index={getIndex()} value={item.text} drag={drag}
              onChangeText={(t) => editQuestion(item.key, t)}
              onDelete={() => deleteQuestion(item.key)} />
          )}
        />
      )}
      <Pressable style={styles.addQ} onPress={addQuestion}><Text style={styles.addQText}>+ Add Question</Text></Pressable>
      <Pressable disabled={!canSave || status === 'saving'} onPress={onSave}
        style={[styles.saveBtn, (!canSave || status === 'saving') && styles.saveBtnDisabled]}>
        <Text style={styles.saveBtnText}>{status === 'saving' ? 'Saving…' : 'Save Template'}</Text>
      </Pressable>
    </View>
  );
}
```

#### Task 2.6: DepartmentPicker component

**File:** `mobile/src/components/DepartmentPicker.js` — **NEW**

```jsx
// mobile/src/components/DepartmentPicker.js
// Purpose: Render departments from GET /api/departments as a picker pill (S-01 dept-pill style).
import React, { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getDepartments } from '../api/templates.api';

export function DepartmentPicker({ value, onChange }) {
  const [departments, setDepartments] = useState([]);
  useEffect(() => { getDepartments().then((d) => {
    setDepartments(d);
    if (!value && d.length) onChange(d[0].id); // default to first (seeded "General")
  }); }, []);
  return (
    <Picker selectedValue={value} onValueChange={onChange}>
      {departments.map((d) => <Picker.Item key={d.id} label={d.name} value={d.id} />)}
    </Picker>
  );
}
```

### Part 3: Navigation + styles wiring (4 hours)

#### Task 3.1: Register Settings route in the app shell

**File:** `mobile/src/navigation/SettingsStack.js` — **NEW**

```jsx
// mobile/src/navigation/SettingsStack.js
// Purpose: Settings area stack; exposes the Question Setup screen.
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import QuestionSetupScreen from '../screens/settings/QuestionSetupScreen';

const Stack = createNativeStackNavigator();
export function SettingsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="QuestionSetup" component={QuestionSetupScreen}
        options={{ title: 'Question Setup' }} />
    </Stack.Navigator>
  );
}
```

#### Task 3.2: Question Setup styles (port S-01 look)

**File:** `mobile/src/styles/questionSetup.styles.js` — **NEW**

Ports the mockup palette (`--navy #1a3050`, `--teal #0a8f8f`), `.sq-item` rows, navy `.sq-num` chip, dashed `.add-q` button, and navy `.mbtn-navy` Save button into a RN `StyleSheet`.

```javascript
// mobile/src/styles/questionSetup.styles.js
// Purpose: RN StyleSheet mirroring the S-01 Question Setup mockup visuals.
import { StyleSheet } from 'react-native';
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f8fa' },
  header: { backgroundColor: '#1a3050', padding: 14 },
  numChip: { width: 20, height: 20, borderRadius: 5, backgroundColor: '#1a3050',
    alignItems: 'center', justifyContent: 'center' },
  addQ: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#c0cdd8', borderRadius: 10,
    padding: 10, alignItems: 'center', margin: 12 },
  saveBtn: { backgroundColor: '#1a3050', borderRadius: 10, padding: 12, margin: 12, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#d1d8e0' },
  // ...row, input, inputError, errorText, emptyState, deleteIcon, etc.
});
```

---

## File Summary

| File | Action | Approximate Lines |
|------|--------|-------------------|
| `backend/src/routes/templates.routes.js` | **NEW** | ~12 lines |
| `backend/src/controllers/templates.controller.js` | **NEW** | ~30 lines |
| `backend/src/services/templates.service.js` | **NEW** | ~30 lines |
| `backend/src/repositories/templates.repository.js` | **NEW** | ~45 lines |
| `backend/src/utils/questionValidation.js` | **NEW** | ~22 lines |
| `mobile/src/api/templates.api.js` | **NEW** | ~15 lines |
| `mobile/src/hooks/useQuestionTemplate.js` | **NEW** | ~55 lines |
| `mobile/src/utils/questionValidation.js` | **NEW** | ~18 lines |
| `mobile/src/components/QuestionRow.js` | **NEW** | ~30 lines |
| `mobile/src/components/DepartmentPicker.js` | **NEW** | ~22 lines |
| `mobile/src/screens/settings/QuestionSetupScreen.js` | **NEW** | ~60 lines |
| `mobile/src/navigation/SettingsStack.js` | **NEW** | ~15 lines |
| `mobile/src/styles/questionSetup.styles.js` | **NEW** | ~45 lines |
| `mobile/src/utils/toast.js` | **NEW** | ~10 lines |

**Backend impact: REAL — uses the existing `question_templates` and `questions` tables and the canonical `GET /api/templates` / `PUT /api/templates/:id` endpoints from CLINIC-001. No new tables or columns; no schema migration required by this story (the `order_index` column already exists). No audio / STT / AI-summary code is touched.**

---

## UI Test Setup

| Field | Value |
|-------|-------|
| **App URL** | Expo dev build on Android emulator (Pixel AVD) — `exp://<host>:8081`, backend at `http://10.0.2.2:3000/api` |
| **Test Route** | Settings > Question Setup screen (`SettingsStack` > `QuestionSetup`) |
| **Login as** | admin/attender — no real auth; role chosen via `x-role: admin` request header |
| **Test Data** | Seeded "General" department with one active `question_templates` row and 5 seeded `questions` (order_index 0..4) from CLINIC-001 seeds (`db/seeds`). A second department with an empty active template is needed to verify the empty-state (AC3) |
| **Non-testable ACs** | AC12 last-write-wins overwrite semantics — concurrency cannot be reliably reproduced via single-session UI; verify in backend integration test. The "last-write-wins" note in AC12 is behavioral/back-end and not UI-observable in one session |
