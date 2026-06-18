// Entry point: import all modules and export functions to window for HTML onclick handlers
import { showPage, openModal, closeModal, closeConfirmModal, executeConfirmAction, cancelMoveAction, executeMoveAction, openBankBreachModal, closeBankBreachModal, openLotDetailsModal, closeLotDetailsModal, openPendingDetailsModal, closePendingDetailsModal } from './ui.js';
import { calculateAll, clearForm, getLocalDate, checkInitialLoadComplete, getRatingIndicator, calculateAverageRating, renderBankBreachesCards, renderLotDetailsCards, renderPendingDetails } from './utils.js';
import { saveOperation, editOperation, deleteOperation, renderOperations, openGainsSummaryModal, closeGainsSummaryModal } from './operations.js';
import { openWallyModal, closeWallyModal, updateWallyFormFields, updateWallyCalculations, saveWallyOperation, deleteWallyOperation, renderWallyTables, openWallyGainsSummaryModal, closeWallyGainsSummaryModal } from './wally.js';
import { openConfigModal, closeConfigModal, saveConfig, addPaymentMethod, deletePaymentMethod, addUsdPaymentMethod, deleteUsdPaymentMethod, addOrUpdateP2PPlatform, editP2PPlatform, deleteP2PPlatform, setDefaultP2PPlatform } from './config.js';
import { openInitialCapitalModal, closeInitialCapitalModal, saveInitialCapital, addManagedAccount, deleteManagedAccount } from './capital.js';
import { openRatingModal, closeRatingModal, submitRating, renderRatingsPage, openUserProfileModal, closeUserProfileModal, saveProfileNotes, switchProfileTab } from './ratings.js';
import { openWeeklyAnalysisModal, closeWeeklyAnalysisModal, openMonthlyAnalysisModal, closeMonthlyAnalysisModal, runMonthlyAnalysis } from './analysis.js';
import { openUsdAnalysisModal, closeUsdAnalysisModal, switchUsdAnalysisTab, renderUsdAnalysis } from './usd-analysis.js';
import { enableAudio } from './notifications.js';
import { pasteSpecial, pasteSpecialWally } from './paste.js';
import { registerUser, loginUser, logoutUser, toggleAuthForms } from './auth.js';
import { handleDragEnd } from './operations.js';

// Assign each function to window
// Auth
window.showPage = showPage;
window.loginUser = loginUser;
window.registerUser = registerUser;
window.toggleAuthForms = toggleAuthForms;
window.logoutUser = logoutUser;
// Operations modal
window.openModal = openModal;
window.closeModal = closeModal;
window.saveOperation = saveOperation;
window.editOperation = editOperation;
window.deleteOperation = deleteOperation;
window.calculateAll = calculateAll;
window.clearForm = clearForm;
// Config
window.openConfigModal = openConfigModal;
window.closeConfigModal = closeConfigModal;
window.saveConfig = saveConfig;
window.addPaymentMethod = addPaymentMethod;
window.deletePaymentMethod = deletePaymentMethod;
window.addUsdPaymentMethod = addUsdPaymentMethod;
window.deleteUsdPaymentMethod = deleteUsdPaymentMethod;
window.editP2PPlatform = editP2PPlatform;
window.deleteP2PPlatform = deleteP2PPlatform;
window.setDefaultP2PPlatform = setDefaultP2PPlatform;
// Config (add platform)
window.addOrUpdateP2PPlatform = addOrUpdateP2PPlatform;
// Render
window.renderOperations = renderOperations;
window.renderWallyTables = renderWallyTables;
window.renderRatingsPage = renderRatingsPage;
window.renderBankBreachesCards = renderBankBreachesCards;
window.renderLotDetailsCards = renderLotDetailsCards;
window.renderPendingDetails = renderPendingDetails;
// Confirm modals
window.closeConfirmModal = closeConfirmModal;
window.executeConfirmAction = executeConfirmAction;
window.cancelMoveAction = cancelMoveAction;
window.executeMoveAction = executeMoveAction;
// Gains summary
window.openGainsSummaryModal = openGainsSummaryModal;
window.closeGainsSummaryModal = closeGainsSummaryModal;
window.openWallyGainsSummaryModal = openWallyGainsSummaryModal;
window.closeWallyGainsSummaryModal = closeWallyGainsSummaryModal;
// Wally
window.openWallyModal = openWallyModal;
window.closeWallyModal = closeWallyModal;
window.updateWallyFormFields = updateWallyFormFields;
window.updateWallyCalculations = updateWallyCalculations;
window.saveWallyOperation = saveWallyOperation;
window.deleteWallyOperation = deleteWallyOperation;
// Paste
window.pasteSpecial = pasteSpecial;
window.pasteSpecialWally = pasteSpecialWally;
// Ratings
window.openRatingModal = openRatingModal;
window.closeRatingModal = closeRatingModal;
window.submitRating = submitRating;
window.openUserProfileModal = openUserProfileModal;
window.closeUserProfileModal = closeUserProfileModal;
window.saveProfileNotes = saveProfileNotes;
window.switchProfileTab = switchProfileTab;
// Capital
window.openInitialCapitalModal = openInitialCapitalModal;
window.closeInitialCapitalModal = closeInitialCapitalModal;
window.saveInitialCapital = saveInitialCapital;
window.addManagedAccount = addManagedAccount;
window.deleteManagedAccount = deleteManagedAccount;
// Analysis VES
window.openWeeklyAnalysisModal = openWeeklyAnalysisModal;
window.closeWeeklyAnalysisModal = closeWeeklyAnalysisModal;
window.openMonthlyAnalysisModal = openMonthlyAnalysisModal;
window.closeMonthlyAnalysisModal = closeMonthlyAnalysisModal;
window.runMonthlyAnalysis = runMonthlyAnalysis;
// Analysis USD
window.openUsdAnalysisModal = openUsdAnalysisModal;
window.closeUsdAnalysisModal = closeUsdAnalysisModal;
window.switchUsdAnalysisTab = switchUsdAnalysisTab;
window.renderUsdAnalysis = renderUsdAnalysis;
// Audio
window.enableAudio = enableAudio;
// Utilities
window.checkInitialLoadComplete = checkInitialLoadComplete;
window.getDate = getLocalDate;
window.getRatingIndicator = getRatingIndicator;
window.calculateAverageRating = calculateAverageRating;
// Modal openers
window.openBankBreachModal = openBankBreachModal;
window.closeBankBreachModal = closeBankBreachModal;
window.openLotDetailsModal = openLotDetailsModal;
window.closeLotDetailsModal = closeLotDetailsModal;
window.openPendingDetailsModal = openPendingDetailsModal;
window.closePendingDetailsModal = closePendingDetailsModal;
// Drag & drop
window.handleDragEnd = handleDragEnd;
