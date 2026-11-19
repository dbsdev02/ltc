<?php
/**
 * Shared helpers for the Razorpay endpoints.
 *
 * Keys are read from razorpay-config.php, which must live OUTSIDE public_html
 * (one folder above it) so it can never be downloaded from the website.
 */

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    http_response_code(404);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function require_post_json(): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        respond(['error' => 'method-not-allowed'], 405);
    }
    $raw = file_get_contents('php://input', false, null, 0, 20000);
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) {
        respond(['error' => 'bad-request'], 400);
    }
    return $data;
}

/** @return array{keyId: string, keySecret: string}|null */
function razorpay_keys(): ?array
{
    $candidates = [
        dirname(__DIR__, 2) . '/razorpay-config.php', // .../domains/your-site/razorpay-config.php
        dirname(__DIR__, 3) . '/razorpay-config.php',
    ];
    foreach ($candidates as $path) {
        if (is_file($path)) {
            $config = require $path;
            $id = trim((string) ($config['key_id'] ?? ''));
            $secret = trim((string) ($config['key_secret'] ?? ''));
            if ($id !== '' && $secret !== '') {
                return ['keyId' => $id, 'keySecret' => $secret];
            }
        }
    }
    return null;
}
