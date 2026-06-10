import React from 'react';
import { View, TextInput, Text, Pressable } from 'react-native';
import { questionError } from '../utils/questionValidation';
import { styles } from '../styles/questionSetup.styles';

export function QuestionRow({ index, value, onChangeText, onDelete, drag }) {
  const error = questionError(value);
  return (
    <View style={styles.row}>
      <Pressable onLongPress={drag} style={styles.dragHandle}>
        <Text style={styles.dragIcon}>⠿</Text>
      </Pressable>
      <View style={styles.numChip}>
        <Text style={styles.numText}>{index + 1}</Text>
      </View>
      <View style={styles.rowBody}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Question text"
          placeholderTextColor="#aab8c8"
          style={[styles.input, error && styles.inputError]}
          multiline
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Text style={styles.deleteIcon}>🗑</Text>
      </Pressable>
    </View>
  );
}
