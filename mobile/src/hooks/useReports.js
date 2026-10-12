// Purpose: Back the "Previous reports" section of the intake screen (CLINIC-011).
// Loads the visit's report photos, and adds (camera / gallery), resizes and uploads, and
// removes them. Loads on screen focus so a resumed visit shows what is already uploaded;
// after an add/remove the list is updated from the API's reply instead of reloaded.
// Output: { reports, remaining, busy, error, addFromCamera, addFromGallery, remove }

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { listReports, uploadReports, deleteReport } from '../api/reportApi';
import { errorMessage } from '../utils/apiError';

const MAX_REPORTS = 20; // backend limit per visit (MAX_REPORTS_PER_VISIT); the 422 is the real guard
const LONG_EDGE = 2000; // resize target (px) so photos stay well under the backend's 10 MB limit
const JPEG_QUALITY = 0.8;

// Resize to a long edge of ~2000px (never upscale) and re-encode as JPEG, whatever
// the source format (HEIC/PNG/WEBP). Returns the new local file URI.
async function prepareImage(asset) {
  let context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > LONG_EDGE) {
    context = context.resize(asset.width >= asset.height ? { width: LONG_EDGE } : { height: LONG_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return saved.uri;
}

export function useReports(visitId) {
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!visitId) return;
    try {
      setReports(await listReports(visitId));
    } catch (err) {
      setError(errorMessage(err, 'Could not load the reports.'));
    }
  }, [visitId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const remaining = Math.max(0, MAX_REPORTS - reports.length);

  // Runs one add/remove action with the busy flag and error message. On a failure the
  // list is reloaded, since the server may have accepted part of it or the visit moved on.
  async function run(action, fallback) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, fallback));
      await load();
    } finally {
      setBusy(false);
    }
  }

  // assets: picker results. Resizes each, then uploads them in one request.
  const upload = (assets) =>
    run(async () => {
      const uris = [];
      for (const asset of assets) uris.push(await prepareImage(asset));
      const created = await uploadReports(visitId, uris);
      setReports((prev) => [...prev, ...created]);
    }, 'Could not upload the photos. Please retry.');

  async function addFromCamera() {
    if (remaining <= 0) return setError(`A visit can have at most ${MAX_REPORTS} reports.`);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return setError('Camera access is turned off. Allow it in the phone settings to take photos.');
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled) await upload(result.assets);
  }

  async function addFromGallery() {
    if (remaining <= 0) return setError(`A visit can have at most ${MAX_REPORTS} reports.`);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });
    if (!result.canceled) await upload(result.assets);
  }

  const remove = (reportId) =>
    run(async () => {
      await deleteReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    }, 'Could not remove the photo. Please retry.');

  return { reports, remaining, busy, error, addFromCamera, addFromGallery, remove };
}
