const firebaseConfig = {
    apiKey: "AIzaSyAovfm0PWP5f6rvSmDva5ZQLOAcOdDNCgk",
    authDomain: "dashboard-operaciones-a9996.firebaseapp.com",
    projectId: "dashboard-operaciones-a9996",
    storageBucket: "dashboard-operaciones-a9996.appspot.com",
    messagingSenderId: "788099450381",
    appId: "1:788099450381:web:95cd9fa3e96ec9397a3744"
};
firebase.initializeApp(firebaseConfig);

const dbInstance = firebase.firestore();

// Enable Firestore offline persistence (IndexedDB) for true PWA offline support.
// This allows the app to read from local cache when offline and syncs when online.
dbInstance.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence: multiple tabs open. Offline cache only in first tab.');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not supported by this browser.');
    }
});

let messagingInstance = null;
try {
    if (firebase.messaging) messagingInstance = firebase.messaging();
} catch (e) {
    console.warn('FCM not available:', e.message);
}

export const auth = firebase.auth();
export const db = dbInstance;
export const messaging = messagingInstance;
