<?php
/**
 * Shared backend for Little Todds Club: settings, order database, emails and
 * Razorpay helpers. Included by the api/*.php endpoints and admin/index.php.
 *
 * Settings live in razorpay-config.php (see razorpay-config.example.php), kept
 * one folder above public_html, or in public_html/api/ where .htaccess blocks it.
 * Orders are stored in an SQLite file next to that config, in a blocked folder.
 */

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    http_response_code(404);
    exit;
}

const STORE_NAME = 'Little Todds Club';
const STORE_URL = 'https://littletodds.club';

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function json_api(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
}

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

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Full path of razorpay-config.php, or null when it hasn't been uploaded. */
function config_path(): ?string
{
    static $path = false;
    if ($path !== false) {
        return $path;
    }
    $candidates = [
        dirname(__DIR__, 2) . '/razorpay-config.php', // .../domains/your-site/razorpay-config.php (preferred)
        dirname(__DIR__, 3) . '/razorpay-config.php',
        dirname(__DIR__, 4) . '/razorpay-config.php',
        __DIR__ . '/razorpay-config.php', // public_html/api/ — blocked from download by api/.htaccess
    ];
    foreach ($candidates as $candidate) {
        if (is_file($candidate)) {
            return $path = $candidate;
        }
    }
    return $path = null;
}

function config(): array
{
    static $config = null;
    if ($config === null) {
        $path = config_path();
        $loaded = $path ? require $path : [];
        $config = (is_array($loaded) ? $loaded : []) + [
            'key_id' => '',
            'key_secret' => '',
            'webhook_secret' => '',
            'admin_password' => '',
            'notify_email' => 'littletoddsclub@gmail.com',
            'from_email' => 'orders@littletodds.club',
        ];
        $config = array_map(static fn ($v) => is_string($v) ? trim($v) : $v, $config);
    }
    return $config;
}

/** @return array{keyId: string, keySecret: string}|null */
function razorpay_keys(): ?array
{
    $c = config();
    return $c['key_id'] !== '' && $c['key_secret'] !== ''
        ? ['keyId' => $c['key_id'], 'keySecret' => $c['key_secret']]
        : null;
}

// ---------------------------------------------------------------------------
// Order database (SQLite)
// ---------------------------------------------------------------------------

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $base = config_path() ? dirname(config_path()) : dirname(__DIR__, 2);
    $dir = $base . '/ltc-data';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    // Belt and braces in case the folder ends up inside public_html.
    if (!is_file($dir . '/.htaccess')) {
        file_put_contents(
            $dir . '/.htaccess',
            "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n",
        );
    }
    $pdo = new PDO('sqlite:' . $dir . '/orders.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    $pdo->exec('CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT \'pending\',
        razorpay_order_id TEXT UNIQUE,
        razorpay_payment_id TEXT,
        items TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal INTEGER NOT NULL,
        discount INTEGER NOT NULL,
        shipping INTEGER NOT NULL,
        total INTEGER NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        pincode TEXT NOT NULL,
        tracking TEXT,
        paid_at TEXT,
        shipped_at TEXT,
        emails_sent INTEGER NOT NULL DEFAULT 0
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT \'\',
        address TEXT NOT NULL DEFAULT \'\',
        city TEXT NOT NULL DEFAULT \'\',
        state TEXT NOT NULL DEFAULT \'\',
        pincode TEXT NOT NULL DEFAULT \'\',
        reset_token_hash TEXT,
        reset_expires_at INTEGER
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS login_attempts (
        key TEXT NOT NULL,
        at INTEGER NOT NULL
    )');
    $columns = array_column($pdo->query('PRAGMA table_info(orders)')->fetchAll(), 'name');
    if (!in_array('user_id', $columns, true)) {
        $pdo->exec('ALTER TABLE orders ADD COLUMN user_id INTEGER');
    }
    return $pdo;
}

// ---------------------------------------------------------------------------
// Customer accounts
// ---------------------------------------------------------------------------

function start_customer_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    ini_set('session.gc_maxlifetime', (string) (60 * 60 * 24 * 30));
    session_name('ltc_session');
    session_start();
}

function current_user(): ?array
{
    start_customer_session();
    $id = (int) ($_SESSION['user_id'] ?? 0);
    if ($id <= 0) {
        return null;
    }
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function public_user(array $u): array
{
    return [
        'id' => (int) $u['id'],
        'email' => $u['email'],
        'name' => $u['name'],
        'phone' => $u['phone'],
        'address' => $u['address'],
        'city' => $u['city'],
        'state' => $u['state'],
        'pincode' => $u['pincode'],
    ];
}

function now(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('Asia/Kolkata')))->format('Y-m-d H:i:s');
}

function order_number(array $order): string
{
    return 'LTC-' . (1000 + (int) $order['id']);
}

function find_order_by_razorpay_id(string $razorpayOrderId): ?array
{
    $stmt = db()->prepare('SELECT * FROM orders WHERE razorpay_order_id = ?');
    $stmt->execute([$razorpayOrderId]);
    return $stmt->fetch() ?: null;
}

/**
 * Marks an order paid (safe to call twice: from the browser and from the
 * webhook) and sends the confirmation emails exactly once.
 */
function mark_order_paid(string $razorpayOrderId, string $paymentId): ?array
{
    $pdo = db();
    $pdo->prepare(
        "UPDATE orders SET status = 'paid', razorpay_payment_id = ?, paid_at = COALESCE(paid_at, ?), updated_at = ?
         WHERE razorpay_order_id = ? AND status IN ('pending', 'failed')",
    )->execute([$paymentId, now(), now(), $razorpayOrderId]);

    // Claim the email job atomically so two simultaneous calls can't both send.
    $claim = $pdo->prepare('UPDATE orders SET emails_sent = 1 WHERE razorpay_order_id = ? AND emails_sent = 0');
    $claim->execute([$razorpayOrderId]);
    $order = find_order_by_razorpay_id($razorpayOrderId);
    if ($order && $claim->rowCount() === 1) {
        send_order_emails($order);
    }
    return $order;
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

function send_mail(string $to, string $subject, string $body, ?string $replyTo = null): bool
{
    $from = config()['from_email'];
    $headers = [
        'From: ' . STORE_NAME . ' <' . $from . '>',
        'Reply-To: ' . ($replyTo ?: config()['notify_email']),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $ok = @mail($to, $encodedSubject, $body, implode("\r\n", $headers), '-f' . $from);
    if (!$ok) {
        error_log("LTC: could not send email '$subject' to $to");
    }
    return $ok;
}

function rupees(int $amount): string
{
    return '₹' . number_format($amount);
}

function order_summary_text(array $o): string
{
    $lines = [
        'Order: ' . order_number($o),
        'Items: ' . $o['items'],
        'Subtotal: ' . rupees((int) $o['subtotal']),
    ];
    if ((int) $o['discount'] > 0) {
        $lines[] = 'Multi-bottle discount: −' . rupees((int) $o['discount']);
    }
    $lines[] = 'Shipping: ' . ((int) $o['shipping'] === 0 ? 'Free' : rupees((int) $o['shipping']));
    $lines[] = 'Total paid: ' . rupees((int) $o['total']);
    $lines[] = '';
    $lines[] = 'Delivering to:';
    $lines[] = $o['name'];
    $lines[] = $o['address'];
    $lines[] = $o['city'] . ', ' . $o['state'] . ' ' . $o['pincode'];
    $lines[] = 'Phone: ' . $o['phone'];
    return implode("\n", $lines);
}

function send_order_emails(array $o): void
{
    $first = explode(' ', $o['name'])[0];
    send_mail(
        $o['email'],
        'Your Little Todds Club order ' . order_number($o) . ' is confirmed',
        "Hi $first,\n\nThank you for joining the club! Your payment was successful and your order is confirmed.\n\n"
        . order_summary_text($o)
        . "\n\nWe dispatch within 1–3 business days and will email you the tracking details as soon as it ships.\n\n"
        . "Questions? Just reply to this email or WhatsApp us on +91 98731 93332.\n\nWith love,\nLittle Todds Club\n" . STORE_URL . "\n",
    );
    send_mail(
        config()['notify_email'],
        'New order ' . order_number($o) . ' — ' . rupees((int) $o['total']) . ' from ' . $o['name'],
        "A new paid order just came in.\n\n" . order_summary_text($o)
        . "\nEmail: " . $o['email']
        . "\nRazorpay payment: " . $o['razorpay_payment_id']
        . "\n\nManage orders: " . STORE_URL . "/admin/\n",
        $o['email'],
    );
}

function send_shipped_email(array $o): void
{
    $first = explode(' ', $o['name'])[0];
    $tracking = trim((string) $o['tracking']);
    send_mail(
        $o['email'],
        'Your Little Todds Club order ' . order_number($o) . ' is on its way!',
        "Hi $first,\n\nGood news — your Cloud Mist has been dispatched!\n\n"
        . ($tracking !== '' ? "Tracking: $tracking\n\n" : '')
        . "It usually arrives within 3–7 business days.\n\n"
        . order_summary_text($o)
        . "\n\nWith love,\nLittle Todds Club\n" . STORE_URL . "\n",
    );
}
