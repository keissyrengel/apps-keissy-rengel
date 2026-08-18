<?php

declare(strict_types=1);

const WORKSPACE_ID = 'default';
const MAX_STATE_BYTES = 2097152;

$allowedOrigins = [
    'https://apps.keissyrengel.com',
    'https://service-delivery-os.morning-hall-4207.workers.dev',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, X-SDO-Request');
    header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
    header('Vary: Origin');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(in_array($origin, $allowedOrigins, true) ? 204 : 403);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(array $body, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function requireAllowedOrigin(string $origin, array $allowedOrigins): void
{
    if (!in_array($origin, $allowedOrigins, true) || ($_SERVER['HTTP_X_SDO_REQUEST'] ?? '') !== 'browser') {
        respond(['error' => 'Forbidden'], 403);
    }
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    respond(['error' => 'API not configured'], 503);
}
$config = require $configPath;

session_name('sdo_session');
session_set_cookie_params([
    'lifetime' => 60 * 60 * 24 * 30,
    'path' => '/',
    'domain' => '.keissyrengel.com',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

$action = $_GET['action'] ?? 'health';

if ($action === 'health') {
    respond(['ok' => true, 'service' => 'service-delivery-os']);
}

requireAllowedOrigin($origin, $allowedOrigins);

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $password = is_array($body) ? (string) ($body['password'] ?? '') : '';
    if (!password_verify($password, (string) $config['app_password_hash'])) {
        usleep(250000);
        respond(['error' => 'Invalid credentials'], 401);
    }
    session_regenerate_id(true);
    $_SESSION['authenticated'] = true;
    respond(['authenticated' => true]);
}

if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $_SESSION = [];
    session_destroy();
    respond(['authenticated' => false]);
}

if (empty($_SESSION['authenticated'])) {
    respond(['error' => 'Unauthorized'], 401);
}

try {
    $pdo = new PDO(
        'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4',
        $config['db_user'],
        $config['db_password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    $pdo->exec('CREATE TABLE IF NOT EXISTS workspace_state (
        workspace_id VARCHAR(64) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        revision INT UNSIGNED NOT NULL DEFAULT 1,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
} catch (Throwable $error) {
    error_log('Service Delivery OS database error: ' . $error->getMessage());
    respond(['error' => 'Database unavailable'], 503);
}

if ($action !== 'state') {
    respond(['error' => 'Not found'], 404);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $statement = $pdo->prepare('SELECT data, revision, updated_at FROM workspace_state WHERE workspace_id = ?');
    $statement->execute([WORKSPACE_ID]);
    $row = $statement->fetch();
    if (!$row) {
        respond(['initialized' => false, 'revision' => 0, 'data' => null]);
    }
    respond([
        'initialized' => true,
        'revision' => (int) $row['revision'],
        'updatedAt' => $row['updated_at'],
        'data' => json_decode($row['data'], true),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $raw = file_get_contents('php://input');
    if (strlen($raw) > MAX_STATE_BYTES) {
        respond(['error' => 'State is too large'], 413);
    }
    $body = json_decode($raw, true);
    if (!is_array($body) || !isset($body['data']) || !is_array($body['data'])) {
        respond(['error' => 'Invalid state'], 400);
    }

    $pdo->beginTransaction();
    $statement = $pdo->prepare('SELECT revision FROM workspace_state WHERE workspace_id = ? FOR UPDATE');
    $statement->execute([WORKSPACE_ID]);
    $current = $statement->fetch();
    $currentRevision = $current ? (int) $current['revision'] : 0;
    if ((int) ($body['revision'] ?? -1) !== $currentRevision) {
        $pdo->rollBack();
        respond(['error' => 'Revision conflict', 'revision' => $currentRevision], 409);
    }

    $nextRevision = $currentRevision + 1;
    $statement = $pdo->prepare('INSERT INTO workspace_state (workspace_id, data, revision)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE data = VALUES(data), revision = VALUES(revision)');
    $statement->execute([WORKSPACE_ID, json_encode($body['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $nextRevision]);
    $pdo->commit();
    respond(['initialized' => true, 'revision' => $nextRevision]);
}

respond(['error' => 'Method not allowed'], 405);
