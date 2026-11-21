<?php
require __DIR__ . '/_razorpay.php';
json_api();

/*
 * Prices are recomputed here so the amount can't be changed in the browser.
 * Keep these in sync with src/data/product.ts and src/data/site.ts.
 */
const PRICE_PER_BOTTLE = 750;
const DISCOUNT_MIN_QUANTITY = 2;
const DISCOUNT_PERCENT = 10;
const SHIPPING_FEE = 0;
const MAX_QUANTITY_PER_LINE = 10;
const PRODUCT_NAME = 'Cloud Mist';
/** Variants that can be bought right now (sold-out ones are left out). */
const IN_STOCK_VARIANTS = [
    'vanilla-cake' => 'Vanilla Cake',
];

$data = require_post_json();

// --- Cart lines -------------------------------------------------------------
$lines = [];
foreach (array_slice((array) ($data['lines'] ?? []), 0, 10) as $line) {
    $id = (string) ($line['variantId'] ?? '');
    if (!isset(IN_STOCK_VARIANTS[$id])) {
        continue;
    }
    $qty = (int) floor((float) ($line['quantity'] ?? 0));
    $lines[] = ['variantId' => $id, 'quantity' => max(1, min(MAX_QUANTITY_PER_LINE, $qty))];
}
if (count($lines) === 0) {
    respond(['ok' => false, 'reason' => 'empty']);
}

$quantity = array_sum(array_column($lines, 'quantity'));
$subtotal = $quantity * PRICE_PER_BOTTLE;
$discount = $quantity >= DISCOUNT_MIN_QUANTITY ? (int) round($subtotal * DISCOUNT_PERCENT / 100) : 0;
$shipping = SHIPPING_FEE;
$total = $subtotal - $discount + $shipping;
$totals = compact('quantity', 'subtotal', 'discount', 'shipping', 'total');

// --- Customer ---------------------------------------------------------------
$customer = (array) ($data['customer'] ?? []);
$field = static fn (string $key, int $max) => mb_substr(trim((string) ($customer[$key] ?? '')), 0, $max);
$name = $field('name', 80);
$email = $field('email', 120);
$phone = $field('phone', 20);
$address = $field('address', 200);
$city = $field('city', 60);
$state = $field('state', 60);
$pincode = $field('pincode', 6);

if (
    mb_strlen($name) < 2
    || !filter_var($email, FILTER_VALIDATE_EMAIL)
    || !preg_match('/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/', $phone)
    || mb_strlen($address) < 5
    || mb_strlen($city) < 2
    || mb_strlen($state) < 2
    || !preg_match('/^[1-9]\d{5}$/', $pincode)
) {
    respond(['ok' => false, 'reason' => 'invalid'], 400);
}

$keys = razorpay_keys();
if ($keys === null) {
    respond(['ok' => false, 'reason' => 'not-configured', 'totals' => $totals]);
}

// --- Create the Razorpay order ---------------------------------------------
$items = implode(', ', array_map(
    static fn ($l) => PRODUCT_NAME . ' – ' . IN_STOCK_VARIANTS[$l['variantId']] . ' × ' . $l['quantity'],
    $lines,
));
$clip = static fn (string $value) => mb_substr($value, 0, 250);

$payload = json_encode([
    'amount' => $total * 100,
    'currency' => 'INR',
    'receipt' => 'ltc_' . round(microtime(true) * 1000),
    'notes' => [
        'items' => $clip($items),
        'customer_name' => $clip($name),
        'customer_email' => $clip($email),
        'customer_phone' => $clip($phone),
        'address' => $clip($address),
        'city_state' => $clip("$city, $state"),
        'pincode' => $pincode,
        'discount' => (string) $discount,
    ],
]);

$ch = curl_init('https://api.razorpay.com/v1/orders');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_USERPWD => $keys['keyId'] . ':' . $keys['keySecret'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
]);
$body = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$order = is_string($body) ? json_decode($body, true) : null;
if ($status < 200 || $status >= 300 || !isset($order['id'])) {
    error_log('Razorpay order creation failed: HTTP ' . $status . ' ' . (is_string($body) ? $body : ''));
    respond(['ok' => false, 'reason' => 'gateway-error', 'totals' => $totals]);
}

try {
    $now = now();
    $user = current_user();
    db()->prepare(
        "INSERT INTO orders (created_at, updated_at, status, razorpay_order_id, items, quantity, subtotal, discount,
            shipping, total, name, email, phone, address, city, state, pincode, user_id)
         VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )->execute([$now, $now, $order['id'], $items, $quantity, $subtotal, $discount, $shipping, $total,
        $name, $email, $phone, $address, $city, $state, $pincode, $user['id'] ?? null]);
    // Remember the delivery details for next time if the profile has none yet.
    if ($user && $user['address'] === '') {
        db()->prepare('UPDATE users SET phone = ?, address = ?, city = ?, state = ?, pincode = ? WHERE id = ?')
            ->execute([$phone, $address, $city, $state, $pincode, $user['id']]);
    }
} catch (Throwable $e) {
    // Payment can still go ahead; the webhook and Razorpay dashboard keep the record.
    error_log('LTC: could not save order ' . $order['id'] . ': ' . $e->getMessage());
}

respond([
    'ok' => true,
    'keyId' => $keys['keyId'],
    'orderId' => $order['id'],
    'amount' => $order['amount'],
    'currency' => $order['currency'],
    'totals' => $totals,
]);
