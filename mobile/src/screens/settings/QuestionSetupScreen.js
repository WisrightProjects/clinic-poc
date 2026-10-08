import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { useQuestionTemplate } from '../../hooks/useQuestionTemplate';
import { DepartmentPicker } from '../../components/DepartmentPicker';
import { QuestionRow } from '../../components/QuestionRow';
import { showToast } from '../../utils/toast';
import { styles } from '../../styles/questionSetup.styles';

export default function QuestionSetupScreen() {
  const navigation = useNavigation();
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
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹  Back</Text>
        </Pressable>
        <Text style={styles.headerLabel}>Configuration</Text>
        <Text style={styles.headerTitle}>Question Template</Text>
      </View>

      <DepartmentPicker value={departmentId} onChange={setDepartmentId} />

      {status === 'loading' ? (
        <View style={styles.listArea}>
          <ActivityIndicator style={{ marginTop: 40 }} color="#1a3050" />
        </View>
      ) : (
        // containerStyle bounds the list to the space left on screen so it scrolls;
        // without it the list grows to its full content height and pushes
        // "Add Question" / "Save Template" off-screen on long templates.
        <DraggableFlatList
          data={questions}
          keyExtractor={(q) => q.key}
          onDragEnd={({ data }) => reorder(data)}
          containerStyle={styles.listArea}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyState}>
              No questions yet — add your first question
            </Text>
          }
          ListFooterComponent={
            <Pressable style={styles.addQ} onPress={addQuestion}>
              <Text style={styles.addQText}>+ Add Question</Text>
            </Pressable>
          }
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
