importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
    apiKey: "AIzaSyAovfm0PWP5f6rvSmDva5ZQLOAcOdDNCgk",
    authDomain: "dashboard-operaciones-a9996.firebaseapp.com",
    projectId: "dashboard-operaciones-a9996",
    storageBucket: "dashboard-operaciones-a9996.appspot.com",
    messagingSenderId: "788099450381",
    appId: "1:788099450381:web:95cd9fa3e96ec9397a3744"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
    const { notification, data } = payload;
    const title = notification?.title || 'DashSY';
    const body = notification?.body || '';
    const tag = data?.tag || 'dashsy-default';
    self.registration.showNotification(title, {
        body,
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-192x192.png',
        vibrate: [200, 100, 200],
        tag,
        data: data || {}
    });
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const urlToOpen = new URL('./', self.location.origin);
    event.waitUntil(clients.openWindow(urlToOpen.toString()));
});
