<?php
require __DIR__ . '/_razorpay.php';
json_api();

$data = require_post_json();
$orderId = (string) ($data['razorpay_order_id'] ?? '');
$paymentId = (string) ($data['razorpay_payment_id'] ?? '');
$signature = (string) ($data['razorpay_signature'] ?? '');

$keys = razorpay_keys();
if ($keys === null || $orderId === '' || $paymentId === '' || $signature === '') {
    respond(['verified' => false]);
}

$expected = hash_hmac('sha256', $orderId . '|' . $paymentId, $keys['keySecret']);
if (!hash_equals($expected, $signature)) {
    respond(['verified' => false]);
}

$orderNumber = null;
try {
    $order = mark_order_paid($orderId, $paymentId);
    $orderNumber = $order ? order_number($order) : null;
} catch (Throwable $e) {
    error_log('LTC: could not update order ' . $orderId . ': ' . $e->getMessage());
}

respond(['verified' => true, 'orderNumber' => $orderNumber]);
