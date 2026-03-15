<?php
require_once 'db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Listar usuarios
        $stmt = $pdo->query('SELECT id, username, name, role, created_at FROM users');
        jsonResponse($stmt->fetchAll());
        break;

    case 'POST':
        // Crear usuario
        $data = getJsonInput();
        if (!isset($data['username']) || !isset($data['password']) || !isset($data['name'])) {
            jsonResponse(['error' => 'Datos incompletos'], 400);
        }

        $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
        
        try {
            $stmt = $pdo->prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)');
            $stmt->execute([
                $data['username'],
                $hashedPassword,
                $data['name'],
                isset($data['role']) ? $data['role'] : 'user'
            ]);
            jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()], 201);
        } catch (PDOException $e) {
            jsonResponse(['error' => 'Error al crear usuario. Posible nombre de usuario duplicado.', 'details' => $e->getMessage()], 400);
        }
        break;

    case 'PUT':
        // Actualizar usuario
        $data = getJsonInput();
        if (!isset($data['id'])) {
            jsonResponse(['error' => 'Falta el ID del usuario'], 400);
        }

        // Si se envía nueva contraseña, se actualiza, si no, se mantiene
        if (isset($data['password']) && !empty($data['password'])) {
            $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
            $stmt = $pdo->prepare('UPDATE users SET username=?, password=?, name=?, role=? WHERE id=?');
            $stmt->execute([
                $data['username'],
                $hashedPassword,
                $data['name'],
                $data['role'],
                $data['id']
            ]);
        } else {
            $stmt = $pdo->prepare('UPDATE users SET username=?, name=?, role=? WHERE id=?');
            $stmt->execute([
                $data['username'],
                $data['name'],
                $data['role'],
                $data['id']
            ]);
        }
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        // Eliminar usuario
        $data = getJsonInput();
        if (!isset($data['id'])) {
            jsonResponse(['error' => 'Falta el ID del usuario'], 400);
        }
        
        $stmt = $pdo->prepare('DELETE FROM users WHERE id=?');
        $stmt->execute([$data['id']]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Método no soportado'], 405);
}
?>