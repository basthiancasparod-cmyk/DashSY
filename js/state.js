import { auth, db, messaging } from './firebase-init.js';
export { auth, db, messaging };

const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;

export const state = {
    auth,
    currentUserId: null,
    currentDate: todayStr,
    currentWallyDate: todayStr,
    operations: [],
    wallyOperations: [],
    userRatings: {},
    userProfiles: {},
    userConfig: {},
    editingIndex: -1,
    editingWallyIndex: -1,
    lastSavedUser: '',
    lastSavedOperationType: '',
    initialLoadCounter: 0,
    currentDayCapital: null,
    currentProfileUserOps: { ves: [], usd: [] },
    currentProfileUserName: '',
    weeklyChartInstance: null,
    monthlyChartInstance: null,
    usdWeeklyChartInstance: null,
    usdWeeklyPaymentMethodChartInstance: null,
    usdWeeklyP2pPlatformChartInstance: null,
    usdMonthlyChartInstance: null,
    usdMonthlyPaymentMethodChartInstance: null,
    usdMonthlyP2pPlatformChartInstance: null,
    currentUsdAnalysisTab: 'weekly',
    confirmAction: null,
    moveAction: null,
    sortableTableInstance: null,
    sortableListInstance: null,
    ratingsCurrentPage: 1,
    currentRatingUser: '',
    selectedRatings: { transaction: 0, speed: 0 },
    currentLotsData: new Map(),
    currentPendingData: { recompra: 0, reventa: 0 },
};

export const USERS_PER_PAGE = 20;
export const TOTAL_INITIAL_LOADS = 5;
export const defaultProfitGoals = { ves: 1000.00, crypto: 50.00, usd: 50.00 };
export const defaultDashboardGoals = { ves: true, crypto: false, usd: false };

export function setCurrentDate(val) { state.currentDate = val; }
export function setCurrentWallyDate(val) { state.currentWallyDate = val; }
