const firebaseConfig = {
    apiKey: "AIzaSyAovfm0PWP5f6rvSmDva5ZQLOAcOdDNCgk",
    authDomain: "dashboard-operaciones-a9996.firebaseapp.com",
    projectId: "dashboard-operaciones-a9996",
    storageBucket: "dashboard-operaciones-a9996.appspot.com",
    messagingSenderId: "788099450381",
    appId: "1:788099450381:web:95cd9fa3e96ec9397a3744"
};
firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const db = firebase.firestore();
