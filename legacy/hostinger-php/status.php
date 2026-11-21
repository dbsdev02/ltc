<?php
/** Setup check: shows which parts are ready, never any secret values. */
require __DIR__ . '/_razorpay.php';
json_api();

$c = config();
$database = false;
try {
    db()->query('SELECT 1 FROM orders LIMIT 1');
    $database = true;
} catch (Throwable $e) {
    error_log('LTC status: database error: ' . $e->getMessage());
}

respond([
    'configFound' => config_path() !== null,
    'razorpayKeys' => razorpay_keys() !== null,
    'liveMode' => str_starts_with($c['key_id'], 'rzp_live_'),
    'webhookSecret' => $c['webhook_secret'] !== '',
    'adminPassword' => strlen($c['admin_password']) >= 10,
    'database' => $database,
]);
