<?php
require_once 'db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];
$data = getJsonInput();

switch ($method) {
    case 'GET':
        // Obtener todos los productos (con nombre del proveedor si está asignado)
        $sql = 'SELECT p.id, p.name, p.provider_id, p.family, p.category, p.subcategory, p.unit, p.price, pr.name as provider_name 
                FROM products p 
                LEFT JOIN providers pr ON p.provider_id = pr.id';
        $stmt = $pdo->query($sql);
        jsonResponse($stmt->fetchAll());
        break;

    case 'POST':
        // Crear producto
        if (!isset($data['name']) || !isset($data['unit'])) {
            jsonResponse(['error' => 'Nombre y Unidad son requeridos'], 400);
        }

        $stmt = $pdo->prepare('INSERT INTO products (name, provider_id, family, category, subcategory, unit, price) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $data['name'],
            !empty($data['provider_id']) ? $data['provider_id'] : null,
            $data['family'] ?? null,
            $data['category'] ?? null,
            $data['subcategory'] ?? null,
            $data['unit'],
            $data['price'] ?? 0.00
        ]);
        
        jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()], 201);
        break;

    case 'PUT':
        // Actualizar producto
        if (!isset($data['id'])) {
            jsonResponse(['error' => 'ID del producto es requerido'], 400);
        }

        $stmt = $pdo->prepare('UPDATE products SET name=?, provider_id=?, family=?, category=?, subcategory=?, unit=?, price=? WHERE id=?');
        $stmt->execute([
            $data['name'],
            !empty($data['provider_id']) ? $data['provider_id'] : null,
            $data['family'] ?? null,
            $data['category'] ?? null,
            $data['subcategory'] ?? null,
            $data['unit'],
            $data['price'] ?? 0.00,
            $data['id']
        ]);
        
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        // Eliminar producto
        if (!isset($data['id'])) {
            jsonResponse(['error' => 'ID del producto es requerido'], 400);
        }

        $stmt = $pdo->prepare('DELETE FROM products WHERE id=?');
        $stmt->execute([$data['id']]);
        
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Método no soportado'], 405);
}
?>