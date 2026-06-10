# Code Review Findings Triage

Run `node scripts/findings-rollup.mjs` to see all open findings.

---

## CLINIC-003 — Patient Intake & Question List

| # | Severity | File | Line | Finding | Status |
|---|---|---|---|---|---|
| R003-1 | Critical | mobile/src/hooks/useQuestionList.js | 31-40 | Double fetch on mount — both useEffect and useFocusEffect fire; fixed in this story | Fixed |
| R003-2 | Critical | mobile/src/screens/NewPatientScreen.js | 44 | Silent empty department list — catch swallows errors, wrong response normalisation; fixed in this story | Fixed |
| R003-3 | Major | mobile/src/utils/retry.js | 18-20 | withSingleFlight ignores args of concurrent callers — wrong result if reused with different args | Open |
| R003-4 | Major | backend/src/utils/visitValidation.js | 19-21 | age not coerced to Number before range check — string age bypasses validation silently | Open |
| R003-5 | Major | mobile/src/screens/QuestionListScreen.js | 54-66 | Empty-state guard has redundant !loading; no null-visit guard before it | Open |
| R003-6 | Minor | mobile/src/components/SendToDoctorButton.js | 18-20 | Uses onPress=undefined instead of native disabled prop — incorrect accessibility semantics | Open |
| R003-7 | Minor | mobile/src/components/ProgressBar.js | 22 | Percentage-string width may collapse on iOS without explicit parent width | Open |
| R003-8 | Suggestion | backend/src/utils/errors.js | — | Promote fields to AppError constructor param so validation field maps survive catch boundaries | Open |
