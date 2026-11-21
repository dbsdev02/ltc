<?php
/**
 * Razorpay webhook: records payments even when the customer closes the browser
 * before returning to the site. Set it up in Razorpay Dashboard → Settings →
 * Webhooks with URL https://littletodds.club/api/webhook.php, events
 * "order.paid" and "payment.failed", and the same secret as webhook_secret.
 */
require __DIR__ . '/_razorpay.php';
json_api();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(['error' => 'method-not-allowed'], 405);
}

$secret = config()['webhook_secret'];
$body = file_get_contents('php://input', false, null, 0, 200000) ?: '';
$signature = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';

if ($secret === '' || $signature === '' || !hash_equals(hash_hmac('sha256', $body, $secret), $signature)) {
    respond(['error' => 'invalid-signature'], 400);
}

$event = json_decode($body, true);
$type = (string) ($event['event'] ?? '');
$payment = $event['payload']['payment']['entity'] ?? [];
$orderId = (string) ($event['payload']['order']['entity']['id'] ?? $payment['order_id'] ?? '');

try {
    if ($orderId !== '' && in_array($type, ['order.paid', 'payment.captured'], true)) {
        mark_order_paid($orderId, (string) ($payment['id'] ?? ''));
    } elseif ($orderId !== '' && $type === 'payment.failed') {
        db()->prepare("UPDATE orders SET status = 'failed', updated_at = ? WHERE razorpay_order_id = ? AND status = 'pending'")
            ->execute([now(), $orderId]);
    }
} catch (Throwable $e) {
    error_log('LTC webhook error: ' . $e->getMessage());
    respond(['error' => 'server-error'], 500); // Razorpay retries later
}

respond(['ok' => true]);
