import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, SafeAreaView } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { useQuestionTemplate } from '../../hooks/useQuestionTemplate';
import { DepartmentPicker } from '../../components/DepartmentPicker';
import { QuestionRow } from '../../components/QuestionRow';
import { showToast } from '../../utils/toast';
import { styles } from '../../styles/questionSetup.styles';

export default function QuestionSetupScreen() {
  const [departmentId, setDepartmentId] = useState(null);
  const {
    questions,
    status,
    canSave,
    load,
    addQuestion,
    editQuestion,
    deleteQuestion,
    reorder,
    save,
  } = useQuestionTemplate();

  useEffect(() => {
    if (departmentId) {
      load(departmentId).catch(() => showToast('Could not load template'));
    }
  }, [departmentId, load]);

  const onSave = async () => {
    const ok = await save();
    showToast(ok ? 'Template saved' : 'Could not save — try again');
  };

  const isBusy = status === 'loading' || status === 'saving';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Configuration</Text>
        <Text style={styles.headerTitle}>Question Template</Text>
      </View>

      <DepartmentPicker value={departmentId} onChange={setDepartmentId} />

      {status === 'loading' ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1a3050" />
      ) : questions.length === 0 ? (
        <Text style={styles.emptyState}>
          No questions yet — add your first question
        </Text>
      ) : (
        <DraggableFlatList
          data={questions}
          keyExtractor={(q) => q.key}
          onDragEnd={({ data }) => reorder(data)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, getIndex, drag, isActive }) => (
            <QuestionRow
              index={getIndex()}
              value={item.text}
              drag={drag}
              onChangeText={(t) => editQuestion(item.key, t)}
              onDelete={() => deleteQuestion(item.key)}
            />
          )}
        />
      )}

      <Pressable style={styles.addQ} onPress={addQuestion}>
        <Text style={styles.addQText}>+ Add Question</Text>
      </Pressable>

      <Pressable
        disabled={!canSave || isBusy}
        onPress={onSave}
        style={[styles.saveBtn, (!canSave || isBusy) && styles.saveBtnDisabled]}
      >
        <Text style={styles.saveBtnText}>
          {status === 'saving' ? 'Saving…' : 'Save Template'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
