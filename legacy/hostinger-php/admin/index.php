<?php
/**
 * Orders admin: https://littletodds.club/admin/
 * Log in with admin_password from razorpay-config.php.
 */
require dirname(__DIR__) . '/api/_razorpay.php';

header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

session_set_cookie_params(['lifetime' => 0, 'path' => '/admin/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
session_name('ltc_admin');
session_start();

$password = config()['admin_password'];
$h = static fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
$self = strtok($_SERVER['REQUEST_URI'] ?? '/admin/', '?');

function page(string $title, string $body): void
{
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<meta name="robots" content="noindex"><title>' . htmlspecialchars($title) . '</title><style>'
        . ':root{--bg:#fbf7ef;--card:#fff;--ink:#3b2a20;--muted:#8a7a6e;--line:#eadfce;--accent:#e08a5f}'
        . '*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--ink)}'
        . '.wrap{max-width:1100px;margin:0 auto;padding:20px 16px}h1{font-size:22px;margin:0}a{color:var(--accent)}'
        . '.top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:16px}'
        . '.tabs a{display:inline-block;padding:6px 12px;border-radius:999px;text-decoration:none;color:var(--ink);border:1px solid var(--line);margin:2px}'
        . '.tabs a.on{background:var(--ink);color:#fff;border-color:var(--ink)}'
        . '.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:12px}'
        . '.row{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:space-between}.muted{color:var(--muted);font-size:13px}'
        . '.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase}'
        . '.paid{background:#fde7c8}.shipped{background:#d8ecd9}.pending{background:#eee}.failed,.cancelled{background:#f8d4d4}'
        . 'input,button{font:inherit;padding:8px 12px;border-radius:10px;border:1px solid var(--line)}button{background:var(--ink);color:#fff;border:0;cursor:pointer}'
        . 'button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}form.inline{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}'
        . '.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}.stats b{display:block;font-size:22px}'
        . '.msg{padding:10px 14px;border-radius:12px;background:#d8ecd9;margin-bottom:12px}'
        . '</style></head><body><div class="wrap">' . $body . '</div></body></html>';
    exit;
}

// --- Not set up yet ---------------------------------------------------------
if (strlen($password) < 10) {
    page('Admin', '<div class="card"><h1>Admin not set up</h1><p>Add an <code>admin_password</code> (at least 10 characters) to razorpay-config.php to use this page.</p></div>');
}

// --- Login / logout ---------------------------------------------------------
if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: ' . $self);
    exit;
}
if (empty($_SESSION['ok'])) {
    $error = '';
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
        if (hash_equals($password, (string) ($_POST['password'] ?? ''))) {
            session_regenerate_id(true);
            $_SESSION['ok'] = true;
            $_SESSION['csrf'] = bin2hex(random_bytes(16));
            header('Location: ' . $self);
            exit;
        }
        sleep(2); // slows down password guessing
        $error = '<p style="color:#b33">Wrong password.</p>';
    }
    page('Admin login', '<div class="card" style="max-width:360px;margin:60px auto"><h1>Little Todds Club</h1><p class="muted">Orders admin</p>'
        . $error . '<form method="post" class="inline"><input type="password" name="password" placeholder="Password" autofocus required style="flex:1"><button>Log in</button></form></div>');
}

$csrf = $_SESSION['csrf'];
$pdo = db();

// --- Actions ----------------------------------------------------------------
$message = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    if (!hash_equals($csrf, (string) ($_POST['csrf'] ?? ''))) {
        http_response_code(400);
        page('Admin', '<div class="card">Session expired. <a href="' . $h($self) . '">Reload</a></div>');
    }
    $id = (int) ($_POST['id'] ?? 0);
    $action = (string) ($_POST['action'] ?? '');
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt->execute([$id]);
    $order = $stmt->fetch();
    if ($order && $action === 'ship' && in_array($order['status'], ['paid', 'shipped'], true)) {
        $tracking = mb_substr(trim((string) ($_POST['tracking'] ?? '')), 0, 200);
        $pdo->prepare("UPDATE orders SET status = 'shipped', tracking = ?, shipped_at = COALESCE(shipped_at, ?), updated_at = ? WHERE id = ?")
            ->execute([$tracking, now(), now(), $id]);
        $order['tracking'] = $tracking;
        if (!empty($_POST['notify'])) {
            send_shipped_email($order);
        }
        $message = order_number($order) . ' marked as shipped' . (!empty($_POST['notify']) ? ' and the customer was emailed.' : '.');
    } elseif ($order && $action === 'cancel') {
        $pdo->prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?")->execute([now(), $id]);
        $message = order_number($order) . ' cancelled. Refund it from the Razorpay Dashboard if it was paid.';
    }
    $_SESSION['flash'] = $message;
    header('Location: ' . $self . '?' . http_build_query(['status' => $_GET['status'] ?? 'paid']));
    exit;
}

// --- CSV export -------------------------------------------------------------
if (isset($_GET['export'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="ltc-orders-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // Excel-friendly UTF-8
    fputcsv($out, ['Order', 'Date', 'Status', 'Items', 'Qty', 'Total', 'Name', 'Phone', 'Email', 'Address', 'City', 'State', 'PIN', 'Tracking', 'Razorpay payment']);
    foreach ($pdo->query("SELECT * FROM orders WHERE status != 'pending' ORDER BY id DESC") as $o) {
        fputcsv($out, [order_number($o), $o['created_at'], $o['status'], $o['items'], $o['quantity'], $o['total'], $o['name'],
            $o['phone'], $o['email'], $o['address'], $o['city'], $o['state'], $o['pincode'], $o['tracking'], $o['razorpay_payment_id']]);
    }
    exit;
}

// --- List -------------------------------------------------------------------
$tabs = ['paid' => 'To ship', 'shipped' => 'Shipped', 'all' => 'All paid', 'pending' => 'Unpaid / abandoned', 'cancelled' => 'Cancelled'];
$status = array_key_exists($_GET['status'] ?? '', $tabs) ? $_GET['status'] : 'paid';
$where = match ($status) {
    'all' => "status IN ('paid', 'shipped')",
    'pending' => "status IN ('pending', 'failed')",
    default => 'status = ' . $pdo->quote($status),
};
$orders = $pdo->query("SELECT * FROM orders WHERE $where ORDER BY id DESC LIMIT 300")->fetchAll();

$stats = $pdo->query("SELECT
    SUM(status = 'paid') AS to_ship,
    SUM(status IN ('paid','shipped')) AS paid_orders,
    COALESCE(SUM(CASE WHEN status IN ('paid','shipped') THEN total END), 0) AS revenue,
    COALESCE(SUM(CASE WHEN status IN ('paid','shipped') THEN quantity END), 0) AS bottles
    FROM orders")->fetch();

$flash = $_SESSION['flash'] ?? '';
unset($_SESSION['flash']);

$html = '<div class="top"><h1>Orders</h1><div><a href="?export=1">Download CSV</a> · <a href="?logout=1">Log out</a></div></div>';
if ($flash) {
    $html .= '<div class="msg">' . $h($flash) . '</div>';
}
$html .= '<div class="stats">'
    . '<div class="card"><span class="muted">To ship</span><b>' . (int) $stats['to_ship'] . '</b></div>'
    . '<div class="card"><span class="muted">Paid orders</span><b>' . (int) $stats['paid_orders'] . '</b></div>'
    . '<div class="card"><span class="muted">Bottles sold</span><b>' . (int) $stats['bottles'] . '</b></div>'
    . '<div class="card"><span class="muted">Revenue</span><b>' . $h(rupees((int) $stats['revenue'])) . '</b></div></div>';
$html .= '<div class="tabs" style="margin-bottom:12px">';
foreach ($tabs as $key => $label) {
    $html .= '<a class="' . ($key === $status ? 'on' : '') . '" href="?status=' . $key . '">' . $h($label) . '</a>';
}
$html .= '</div>';

if (!$orders) {
    $html .= '<div class="card muted">No orders here yet.</div>';
}
foreach ($orders as $o) {
    $html .= '<div class="card"><div class="row"><div><b>' . $h(order_number($o)) . '</b> <span class="pill ' . $h($o['status']) . '">' . $h($o['status']) . '</span>'
        . '<div class="muted">' . $h($o['created_at']) . ($o['razorpay_payment_id'] ? ' · ' . $h($o['razorpay_payment_id']) : '') . '</div></div>'
        . '<div style="text-align:right"><b>' . $h(rupees((int) $o['total'])) . '</b><div class="muted">' . $h($o['items']) . '</div></div></div>'
        . '<p style="margin:10px 0 0"><b>' . $h($o['name']) . '</b> · <a href="tel:' . $h($o['phone']) . '">' . $h($o['phone']) . '</a> · <a href="mailto:' . $h($o['email']) . '">' . $h($o['email']) . '</a><br>'
        . $h($o['address']) . ', ' . $h($o['city']) . ', ' . $h($o['state']) . ' ' . $h($o['pincode']) . '</p>';
    if ($o['tracking']) {
        $html .= '<p class="muted" style="margin:6px 0 0">Tracking: ' . $h($o['tracking']) . ' · shipped ' . $h($o['shipped_at']) . '</p>';
    }
    if (in_array($o['status'], ['paid', 'shipped'], true)) {
        $html .= '<form method="post" class="inline" action="?status=' . $h($status) . '">'
            . '<input type="hidden" name="csrf" value="' . $h($csrf) . '"><input type="hidden" name="id" value="' . (int) $o['id'] . '"><input type="hidden" name="action" value="ship">'
            . '<input name="tracking" placeholder="Courier + tracking number" value="' . $h($o['tracking']) . '" style="flex:1;min-width:200px">'
            . '<label class="muted" style="display:flex;align-items:center;gap:6px"><input type="checkbox" name="notify" value="1"' . ($o['status'] === 'paid' ? ' checked' : '') . '> Email customer</label>'
            . '<button>' . ($o['status'] === 'paid' ? 'Mark shipped' : 'Update tracking') . '</button></form>';
    }
    if ($o['status'] === 'paid') {
        $html .= '<form method="post" class="inline" action="?status=' . $h($status) . '" onsubmit="return confirm(\'Cancel this order?\')">'
            . '<input type="hidden" name="csrf" value="' . $h($csrf) . '"><input type="hidden" name="id" value="' . (int) $o['id'] . '"><input type="hidden" name="action" value="cancel">'
            . '<button class="ghost">Cancel order</button></form>';
    }
    $html .= '</div>';
}

page('Orders · Little Todds Club', $html);
