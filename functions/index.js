const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Sends a push notification to all FCM tokens of a user
 * when a lot is closed (sale fully matched).
 */
async function sendPushToUser(userId, title, body, tag) {
    const tokensSnap = await admin.firestore()
        .collection('users').doc(userId)
        .collection('fcmTokens').get();

    if (tokensSnap.empty) return;

    const tokens = tokensSnap.docs.map(d => d.data().token);
    const message = {
        notification: { title, body },
        data: { tag: tag || 'dashsy-lot-closed' }
    };

    const results = await admin.messaging().sendEachForMulticast({ ...message, tokens });

    // Clean up invalid tokens
    const batch = admin.firestore().batch();
    results.responses.forEach((resp, i) => {
        if (!resp.success && resp.error?.code === 'messaging/invalid-registration-token') {
            batch.delete(tokensSnap.docs[i].ref);
        }
    });
    if (batch._ops?.length > 0) await batch.commit();
}

/**
 * Triggered when any user's operations document changes.
 * Detects lot closures and sends a push notification.
 */
exports.onOperationUpdate = functions.firestore
    .document('users/{userId}/operations/{opId}')
    .onWrite(async (change, context) => {
        const { userId } = context.params;
        const after = change.after?.data();

        // Only notify when lote is assigned (FIFO matched) and gain > 0
        if (!after || !after.lote || !after.ves || after.ves <= 0) return;

        const title = '✅ Lote cerrado';
        const body = `Ganancia: ${after.ves.toFixed(2)} VES (${after.usdc?.toFixed(4) || '0'} USDC) — ${after.usuario}`;
        await sendPushToUser(userId, title, body, `lot-${after.lote}`);
    });

/**
 * Sent when a Wally operation completes.
 */
exports.onWallyOperationUpdate = functions.firestore
    .document('users/{userId}/wallyOperations/{opId}')
    .onWrite(async (change, context) => {
        const { userId } = context.params;
        const after = change.after?.data();

        if (!after || !after.gananciaUsdc || after.gananciaUsdc <= 0) return;

        const title = '📊 Ganancia Wally';
        const body = `Ganancia: ${after.gananciaUsdc.toFixed(4)} USDC — ${after.usuario || 'Wally'}`;
        await sendPushToUser(userId, title, body, `wally-${after.id}`);
    });
