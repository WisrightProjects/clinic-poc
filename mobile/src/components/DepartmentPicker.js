import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getDepartments } from '../api/templates.api';

export function DepartmentPicker({ value, onChange }) {
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    getDepartments().then((d) => {
      setDepartments(d);
      if (!value && d.length) onChange(d[0].id);
    }).catch(() => {});
  }, []);

  return (
    <View style={styles.container}>
      <Picker
        selectedValue={value}
        onValueChange={onChange}
        style={styles.picker}
      >
        {departments.map((d) => (
          <Picker.Item key={d.id} label={d.name} value={d.id} />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0eaf0',
  },
  picker: {
    height: 50,
    color: '#1a3050',
  },
});
