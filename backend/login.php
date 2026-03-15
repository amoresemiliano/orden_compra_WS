<?php
require_once 'db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

// Para BlueHost: si no tienes autorización para ver el body, o lo manejamos simple:
$data = getJsonInput();

if ($method === 'POST') {
    if (!isset($data['username']) || !isset($data['password'])) {
        jsonResponse(['success' => false, 'message' => 'Faltan credenciales'], 400);
    }

    $stmt = $pdo->prepare('SELECT id, username, password, name, role FROM users WHERE username = ?');
    $stmt->execute([$data['username']]);
    $user = $stmt->fetch();

    // Verificamos el password usando password_verify
    if ($user && password_verify($data['password'], $user['password'])) {
        // Autenticación correcta (para este ejemplo básico, sin JWT, solo devolvemos datos al frontend)
        unset($user['password']); // No enviar password de vuelta
        jsonResponse(['success' => true, 'user' => $user]);
    } else {
        jsonResponse(['success' => false, 'message' => 'Usuario o contraseña incorrectos'], 401);
    }
} else {
    jsonResponse(['error' => 'Método no soportado'], 405);
}
?>