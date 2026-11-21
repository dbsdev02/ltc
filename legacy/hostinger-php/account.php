<?php
/**
 * Customer accounts. GET ?action=me|orders, POST ?action=signup|login|logout|
 * update-profile|forgot|reset with a JSON body.
 */
require __DIR__ . '/_razorpay.php';
json_api();

$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

const MIN_PASSWORD = 8;
const MAX_FAILED_LOGINS = 8;      // per email + IP …
const FAILED_LOGIN_WINDOW = 900;  // … in 15 minutes

if ($method === 'POST') {
    // Cross-site forms can't send JSON without a CORS preflight, which we never allow.
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        respond(['error' => 'bad-request'], 400);
    }
    $data = require_post_json();
} elseif (!in_array($action, ['me', 'orders'], true)) {
    respond(['error' => 'method-not-allowed'], 405);
}

$str = static fn (string $key, int $max) => mb_substr(trim((string) ($data[$key] ?? '')), 0, $max);

function profile_errors(array $p): ?string
{
    if (mb_strlen($p['name']) < 2) {
        return 'Please enter your full name.';
    }
    if ($p['phone'] !== '' && !preg_match('/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/', $p['phone'])) {
        return 'Please enter a valid 10-digit Indian mobile number.';
    }
    if ($p['pincode'] !== '' && !preg_match('/^[1-9]\d{5}$/', $p['pincode'])) {
        return 'Please enter a valid 6-digit PIN code.';
    }
    return null;
}

function too_many_attempts(string $key): bool
{
    $pdo = db();
    $pdo->prepare('DELETE FROM login_attempts WHERE at < ?')->execute([time() - FAILED_LOGIN_WINDOW]);
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE key = ?');
    $stmt->execute([$key]);
    return (int) $stmt->fetchColumn() >= MAX_FAILED_LOGINS;
}

function log_in(array $user): void
{
    start_customer_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
}

try {
    switch ($action) {
        case 'me':
            $user = current_user();
            respond(['user' => $user ? public_user($user) : null]);

        case 'signup':
            $email = mb_strtolower($str('email', 120));
            $password = (string) ($data['password'] ?? '');
            $profile = ['name' => $str('name', 80), 'phone' => $str('phone', 20), 'pincode' => ''];
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                respond(['error' => 'Please enter a valid email address.'], 400);
            }
            if (strlen($password) < MIN_PASSWORD || strlen($password) > 200) {
                respond(['error' => 'Password must be at least ' . MIN_PASSWORD . ' characters.'], 400);
            }
            if ($error = profile_errors($profile)) {
                respond(['error' => $error], 400);
            }
            $exists = db()->prepare('SELECT 1 FROM users WHERE email = ?');
            $exists->execute([$email]);
            if ($exists->fetchColumn()) {
                respond(['error' => 'An account with this email already exists. Please log in.'], 409);
            }
            db()->prepare('INSERT INTO users (created_at, email, password_hash, name, phone) VALUES (?, ?, ?, ?, ?)')
                ->execute([now(), $email, password_hash($password, PASSWORD_DEFAULT), $profile['name'], $profile['phone']]);
            $user = ['id' => (int) db()->lastInsertId()];
            // Link earlier guest orders placed with this email.
            db()->prepare('UPDATE orders SET user_id = ? WHERE user_id IS NULL AND email = ? COLLATE NOCASE')
                ->execute([$user['id'], $email]);
            log_in($user);
            respond(['user' => public_user(current_user())]);

        case 'login':
            $email = mb_strtolower($str('email', 120));
            $password = (string) ($data['password'] ?? '');
            $key = hash('sha256', $email . '|' . ($_SERVER['REMOTE_ADDR'] ?? ''));
            if (too_many_attempts($key)) {
                respond(['error' => 'Too many attempts. Please wait 15 minutes or reset your password.'], 429);
            }
            $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            if (!$user || !password_verify($password, $user['password_hash'])) {
                db()->prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)')->execute([$key, time()]);
                usleep(400000);
                respond(['error' => 'Wrong email or password.'], 401);
            }
            if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
                db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                    ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
            }
            db()->prepare('DELETE FROM login_attempts WHERE key = ?')->execute([$key]);
            log_in($user);
            respond(['user' => public_user($user)]);

        case 'logout':
            start_customer_session();
            $_SESSION = [];
            session_destroy();
            setcookie('ltc_session', '', ['expires' => time() - 3600, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
            respond(['ok' => true]);

        case 'update-profile':
            $user = current_user() ?? respond(['error' => 'Please log in again.'], 401);
            $profile = [
                'name' => $str('name', 80),
                'phone' => $str('phone', 20),
                'address' => $str('address', 200),
                'city' => $str('city', 60),
                'state' => $str('state', 60),
                'pincode' => $str('pincode', 6),
            ];
            if ($error = profile_errors($profile)) {
                respond(['error' => $error], 400);
            }
            db()->prepare('UPDATE users SET name = ?, phone = ?, address = ?, city = ?, state = ?, pincode = ? WHERE id = ?')
                ->execute([...array_values($profile), $user['id']]);
            $newPassword = (string) ($data['newPassword'] ?? '');
            if ($newPassword !== '') {
                if (!password_verify((string) ($data['currentPassword'] ?? ''), $user['password_hash'])) {
                    respond(['error' => 'Your current password is not correct.'], 400);
                }
                if (strlen($newPassword) < MIN_PASSWORD) {
                    respond(['error' => 'New password must be at least ' . MIN_PASSWORD . ' characters.'], 400);
                }
                db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                    ->execute([password_hash($newPassword, PASSWORD_DEFAULT), $user['id']]);
            }
            respond(['user' => public_user(current_user())]);

        case 'orders':
            $user = current_user() ?? respond(['error' => 'Please log in again.'], 401);
            $stmt = db()->prepare(
                "SELECT * FROM orders WHERE status IN ('paid', 'shipped', 'cancelled')
                 AND (user_id = ? OR (user_id IS NULL AND email = ? COLLATE NOCASE)) ORDER BY id DESC LIMIT 100",
            );
            $stmt->execute([$user['id'], $user['email']]);
            $orders = array_map(static fn ($o) => [
                'number' => order_number($o),
                'date' => $o['paid_at'] ?: $o['created_at'],
                'status' => $o['status'],
                'items' => $o['items'],
                'total' => (int) $o['total'],
                'tracking' => $o['tracking'],
                'shippedAt' => $o['shipped_at'],
                'address' => $o['address'] . ', ' . $o['city'] . ', ' . $o['state'] . ' ' . $o['pincode'],
            ], $stmt->fetchAll());
            respond(['orders' => $orders]);

        case 'forgot':
            $email = mb_strtolower($str('email', 120));
            $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            // Same answer whether or not the account exists, so emails can't be probed.
            if ($user && (int) $user['reset_expires_at'] < time() + 3300) { // at most one email per 5 minutes
                $token = bin2hex(random_bytes(32));
                db()->prepare('UPDATE users SET reset_token_hash = ?, reset_expires_at = ? WHERE id = ?')
                    ->execute([hash('sha256', $token), time() + 3600, $user['id']]);
                $first = explode(' ', $user['name'])[0];
                send_mail(
                    $user['email'],
                    'Reset your Little Todds Club password',
                    "Hi $first,\n\nWe got a request to reset your password. Open this link within 1 hour to choose a new one:\n\n"
                    . STORE_URL . '/reset-password?token=' . $token
                    . "\n\nIf you didn't ask for this, you can ignore this email.\n\nLittle Todds Club\n",
                );
            }
            respond(['ok' => true]);

        case 'reset':
            $token = (string) ($data['token'] ?? '');
            $password = (string) ($data['password'] ?? '');
            if (strlen($password) < MIN_PASSWORD || strlen($password) > 200) {
                respond(['error' => 'Password must be at least ' . MIN_PASSWORD . ' characters.'], 400);
            }
            $stmt = db()->prepare('SELECT * FROM users WHERE reset_token_hash = ? AND reset_expires_at > ?');
            $stmt->execute([hash('sha256', $token), time()]);
            $user = $stmt->fetch();
            if (!$user || $token === '') {
                respond(['error' => 'This reset link has expired. Please request a new one.'], 400);
            }
            db()->prepare('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_expires_at = NULL WHERE id = ?')
                ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
            log_in($user);
            respond(['user' => public_user($user)]);

        default:
            respond(['error' => 'not-found'], 404);
    }
} catch (Throwable $e) {
    error_log('LTC account error (' . $action . '): ' . $e->getMessage());
    respond(['error' => 'Something went wrong. Please try again.'], 500);
}
