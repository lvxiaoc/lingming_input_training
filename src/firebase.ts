import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAIL = 'harryli@gmail.com';
export const CORRECTION_REPORTS_COLLECTION = 'correctionReports';

export function isFirebaseAdminUser(user: User | null): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      user.email &&
      user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

// Validate connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type CorrectionIssueType =
  | 'stroke_color'
  | 'radical_split'
  | 'code_error'
  | 'short_code'
  | 'other';

export type CorrectionReportStatus = 'open' | 'reviewed' | 'resolved';
export type CorrectionReportSource = 'home' | 'huangting';

export interface CorrectionReportRecord {
  id: string;
  char: string;
  issueType: CorrectionIssueType;
  currentCode: string;
  suggestedCode: string;
  currentRoots: string;
  suggestedRoots: string;
  suggestedStrokeIndices: string;
  description: string;
  status: CorrectionReportStatus;
  reporterUid: string;
  reporterName: string;
  source: CorrectionReportSource;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CreateCorrectionReportInput {
  char: string;
  issueType: CorrectionIssueType;
  currentCode?: string;
  suggestedCode?: string;
  currentRoots?: string;
  suggestedRoots?: string;
  suggestedStrokeIndices?: string;
  description: string;
  source: CorrectionReportSource;
}

const VALID_ISSUE_TYPES: ReadonlySet<string> = new Set([
  'stroke_color',
  'radical_split',
  'code_error',
  'short_code',
  'other',
]);

const VALID_SOURCES: ReadonlySet<string> = new Set(['home', 'huangting']);

function generateSafeReportId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `rep_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (
    val &&
    typeof val === 'object' &&
    'toMillis' in val &&
    typeof (val as { toMillis: unknown }).toMillis === 'function'
  ) {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function submitCorrectionReport(
  input: CreateCorrectionReportInput
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('AUTH_REQUIRED');
  }

  const charClean = input.char.trim().slice(0, 4);
  const descClean = input.description.trim().slice(0, 500);
  if (!charClean || !descClean) {
    throw new Error('INVALID_INPUT');
  }

  const issueType: CorrectionIssueType = VALID_ISSUE_TYPES.has(input.issueType)
    ? input.issueType
    : 'other';
  const source: CorrectionReportSource = VALID_SOURCES.has(input.source)
    ? input.source
    : 'home';

  const reportId = generateSafeReportId();
  const docPath = `${CORRECTION_REPORTS_COLLECTION}/${reportId}`;
  const reporterName = (user.displayName || '道場學人').trim().slice(0, 80) || '道場學人';

  const payload = {
    char: charClean,
    issueType,
    currentCode: (input.currentCode || '').trim().slice(0, 16),
    suggestedCode: (input.suggestedCode || '').trim().slice(0, 16),
    currentRoots: (input.currentRoots || '').trim().slice(0, 64),
    suggestedRoots: (input.suggestedRoots || '').trim().slice(0, 64),
    suggestedStrokeIndices: (input.suggestedStrokeIndices || '').trim().slice(0, 120),
    description: descClean,
    status: 'open' as const,
    reporterUid: user.uid,
    reporterName,
    source,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, CORRECTION_REPORTS_COLLECTION, reportId), payload);
    return reportId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export function subscribeCorrectionReports(
  user: User,
  onData: (reports: CorrectionReportRecord[]) => void,
  onFatalError?: (err: Error) => void
): Unsubscribe {
  const admin = isFirebaseAdminUser(user);
  const colRef = collection(db, CORRECTION_REPORTS_COLLECTION);

  // Non-admins MUST filter by reporterUid to satisfy Secure List Query rule without requiring a composite index
  const q = admin
    ? query(colRef, orderBy('createdAt', 'desc'), limit(80))
    : query(colRef, where('reporterUid', '==', user.uid), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CorrectionReportRecord[] = snapshot.docs.map((snap) => {
        const d = snap.data();
        return {
          id: snap.id,
          char: typeof d.char === 'string' ? d.char : '',
          issueType: VALID_ISSUE_TYPES.has(d.issueType)
            ? (d.issueType as CorrectionIssueType)
            : 'other',
          currentCode: typeof d.currentCode === 'string' ? d.currentCode : '',
          suggestedCode: typeof d.suggestedCode === 'string' ? d.suggestedCode : '',
          currentRoots: typeof d.currentRoots === 'string' ? d.currentRoots : '',
          suggestedRoots: typeof d.suggestedRoots === 'string' ? d.suggestedRoots : '',
          suggestedStrokeIndices:
            typeof d.suggestedStrokeIndices === 'string' ? d.suggestedStrokeIndices : '',
          description: typeof d.description === 'string' ? d.description : '',
          status:
            d.status === 'reviewed' || d.status === 'resolved' ? d.status : 'open',
          reporterUid: typeof d.reporterUid === 'string' ? d.reporterUid : '',
          reporterName: typeof d.reporterName === 'string' ? d.reporterName : '道場學人',
          source: d.source === 'huangting' ? 'huangting' : 'home',
          createdAtMs: timestampToMs(d.createdAt),
          updatedAtMs: timestampToMs(d.updatedAt),
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, CORRECTION_REPORTS_COLLECTION);
      } catch (wrapped) {
        if (onFatalError && wrapped instanceof Error) {
          onFatalError(wrapped);
        }
      }
    }
  );
}

export async function updateCorrectionReportStatus(
  reportId: string,
  status: CorrectionReportStatus
): Promise<void> {
  const docPath = `${CORRECTION_REPORTS_COLLECTION}/${reportId}`;
  try {
    await updateDoc(doc(db, CORRECTION_REPORTS_COLLECTION, reportId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteCorrectionReport(reportId: string): Promise<void> {
  const docPath = `${CORRECTION_REPORTS_COLLECTION}/${reportId}`;
  try {
    await deleteDoc(doc(db, CORRECTION_REPORTS_COLLECTION, reportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
