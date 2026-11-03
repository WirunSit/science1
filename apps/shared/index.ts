// Entry for every lab: fonts (Thai + Latin subsets only, inlined at build), tokens, component styles.
import '@fontsource/ibm-plex-sans-thai-looped/thai-400.css';
import '@fontsource/ibm-plex-sans-thai-looped/latin-400.css';
import '@fontsource/ibm-plex-sans-thai-looped/thai-600.css';
import '@fontsource/ibm-plex-sans-thai-looped/latin-600.css';
import '@fontsource/ibm-plex-sans-thai/thai-600.css';
import '@fontsource/ibm-plex-sans-thai/latin-600.css';
import './tokens.css';
import './lab.css';

export { h, s, safeStore, prefersReducedMotion } from './dom';
export { t } from './i18n';
export * from './format';
export { readStudent, saveStudent, type Student } from './student';
export { isTeacher, mountLabSteps, type LabSteps, type LabStepsOptions } from './components/LabSteps';
export { cellKey, mountStation, type StationAsk, type StationCtx, type StationParts, type StationSpec, type StationTable } from './components/Station';
export { mountLabApp, type Experiment } from './components/LabApp';
export { createAskRunner, createMissionUi, type AskRunner, type AskStep, type MissionUi } from './components/Mission';
export { createResultTable, type CellValue, type ResultColumn, type ResultTable } from './components/ResultTable';
export { createQuizRunner, createReview, evidenceList, LETTERS, scoreOf, type Answers, type CellEvidence, type Evidence, type QuizItem, type RunEvidence } from './components/QuizRunner';
export { setupQuizAndScore, type QuizAndScoreOptions, type QuizScoreState } from './components/QuizAndScore';
export { renderScoreCard, safeName, shareImage, toast, type ScoreCard } from './components/Export';
export { createThermometer, tempColor, formatTemp } from './components/Thermometer';
export { createScaleZoom, type ScaleZoom } from './components/ScaleZoom';
export { readingOptions, thermometerReading } from './reading';
export { createLineChart, type Series } from './components/Chart';
// Teacher mode (PLAN §4.3, Phase 1): free controls for the projector.
export { createSlider, createSelect } from './components/Slider';
export { createDataTable, type Column, type Row } from './components/DataTable';
export { createWorkSteps } from './components/WorkSteps';
