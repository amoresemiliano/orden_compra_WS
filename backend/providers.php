<?php
require_once 'db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];
$data = getJsonInput();

switch ($method) {
    case 'GET':
        // Obtener todos los proveedores
        $stmt = $pdo->query('SELECT id, name, phone, email, cif, address, city, contact, family, payment, created_at FROM providers');
        jsonResponse($stmt->fetchAll());
        break;

    case 'POST':
        // Crear proveedor
        if (!isset($data['name']) || !isset($data['phone'])) {
            jsonResponse(['error' => 'Nombre y teléfono son requeridos'], 400);
        }

        $stmt = $pdo->prepare('INSERT INTO providers (name, phone, email, cif, address, city, contact, family, payment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $data['name'],
            $data['phone'],
            $data['email'] ?? null,
            $data['cif'] ?? null,
            $data['address'] ?? null,
            $data['city'] ?? null,
            $data['contact'] ?? null,
            $data['family'] ?? null,
            $data['payment'] ?? null
        ]);
        
        jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()], 201);
        break;

    case 'PUT':
        // Actualizar proveedor
        if (!isset($data['id'])) {
            jsonResponse(['error' => 'ID del proveedor es requerido'], 400);
        }

        $stmt = $pdo->prepare('UPDATE providers SET name=?, phone=?, email=?, cif=?, address=?, city=?, contact=?, family=?, payment=? WHERE id=?');
        $stmt->execute([
            $data['name'],
            $data['phone'],
            $data['email'] ?? null,
            $data['cif'] ?? null,
            $data['address'] ?? null,
            $data['city'] ?? null,
            $data['contact'] ?? null,
            $data['family'] ?? null,
            $data['payment'] ?? null,
            $data['id']
        ]);
        
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        // Eliminar proveedor
        if (!isset($data['id'])) {
            jsonResponse(['error' => 'ID del proveedor es requerido'], 400);
        }

        $stmt = $pdo->prepare('DELETE FROM providers WHERE id=?');
        $stmt->execute([$data['id']]);
        
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Método no soportado'], 405);
}
?>