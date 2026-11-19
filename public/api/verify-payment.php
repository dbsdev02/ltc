<?php
require __DIR__ . '/_razorpay.php';

$data = require_post_json();
$orderId = (string) ($data['razorpay_order_id'] ?? '');
$paymentId = (string) ($data['razorpay_payment_id'] ?? '');
$signature = (string) ($data['razorpay_signature'] ?? '');

$keys = razorpay_keys();
if ($keys === null || $orderId === '' || $paymentId === '' || $signature === '') {
    respond(['verified' => false]);
}

$expected = hash_hmac('sha256', $orderId . '|' . $paymentId, $keys['keySecret']);
respond(['verified' => hash_equals($expected, $signature)]);
