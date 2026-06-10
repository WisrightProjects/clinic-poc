import { StyleSheet } from 'react-native';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';
const BG = '#f5f8fa';
const BORDER = '#c0cdd8';
const ERROR = '#c0392b';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    backgroundColor: NAVY,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerLabel: {
    color: '#8ab0cc',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dragHandle: {
    paddingRight: 8,
    paddingTop: 2,
  },
  dragIcon: {
    fontSize: 18,
    color: '#8ab0cc',
  },
  numChip: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  numText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
  },
  input: {
    fontSize: 14,
    color: '#1a2a3a',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  inputError: {
    borderBottomColor: ERROR,
  },
  errorText: {
    color: ERROR,
    fontSize: 11,
    marginTop: 2,
  },
  deleteIcon: {
    fontSize: 18,
    paddingLeft: 8,
    paddingTop: 2,
    color: '#c0cdd8',
  },
  emptyState: {
    textAlign: 'center',
    color: '#8ab0cc',
    fontSize: 14,
    marginTop: 40,
    paddingHorizontal: 24,
  },
  addQ: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  addQText: {
    color: TEAL,
    fontWeight: '600',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: NAVY,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#d1d8e0',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
