<?php
require_once 'db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];
$data = getJsonInput();

// Try to create product_providers table if it doesn't exist
try {
    $stmt = $pdo->query("SHOW TABLES LIKE 'product_providers'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("CREATE TABLE `product_providers` (
            `product_id` int(11) NOT NULL,
            `provider_id` int(11) NOT NULL,
            PRIMARY KEY (`product_id`, `provider_id`),
            FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
            FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // Migrate existing data if any
        $pdo->exec("INSERT INTO `product_providers` (`product_id`, `provider_id`) 
                    SELECT id, provider_id FROM products WHERE provider_id IS NOT NULL;");
    }
} catch (Exception $e) {}

switch ($method) {
    case 'GET':
        // Obtener todos los productos (ahora con soporte a multiples proveedores usando GROUP_CONCAT)
        $sql = 'SELECT p.id, p.name, p.family, p.category, p.subcategory, p.unit, p.price, 
                GROUP_CONCAT(pp.provider_id) as provider_ids,
                GROUP_CONCAT(pr.name SEPARATOR ", ") as provider_name 
                FROM products p 
                LEFT JOIN product_providers pp ON p.id = pp.product_id
                LEFT JOIN providers pr ON pp.provider_id = pr.id
                GROUP BY p.id';
        $stmt = $pdo->query($sql);
        
        $products = $stmt->fetchAll();
        // Fallback for older data that hasn't been migrated properly
        foreach($products as &$p) {
            if (!empty($p['provider_ids'])) {
                $p['provider_id'] = $p['provider_ids'];
                $p['provider_ids_array'] = explode(',', $p['provider_ids']);
            } else {
                $p['provider_ids_array'] = [];
            }
        }
        
        jsonResponse($products);
        break;

    case 'POST':
        // Crear producto
        if (!isset($data['name']) || !isset($data['unit'])) {
            jsonResponse(['error' => 'Nombre y Unidad son requeridos'], 400);
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO products (name, family, category, subcategory, unit, price) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([
                $data['name'],
                $data['family'] ?? null,
                $data['category'] ?? null,
                $data['subcategory'] ?? null,
                $data['unit'],
                $data['price'] ?? 0.00
            ]);
            
            $productId = $pdo->lastInsertId();

            if (!empty($data['provider_ids']) && is_array($data['provider_ids'])) {
                $stmt_pp = $pdo->prepare('INSERT IGNORE INTO product_providers (product_id, provider_id) VALUES (?, ?)');
                foreach ($data['provider_ids'] as $pid) {
                    $stmt_pp->execute([$productId, $pid]);
                }
            } else if (!empty($data['provider_id'])) {
                // Fallback for single provider passed
                $stmt_pp = $pdo->prepare('INSERT IGNORE INTO product_providers (product_id, provider_id) VALUES (?, ?)');
                $stmt_pp->execute([$productId, $data['provider_id']]);
            }

            $pdo->commit();
            jsonResponse(['success' => true, 'id' => $productId], 201);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Error al crear producto: ' . $e->getMessage()], 500);
        }
        break;

    case 'PUT':
        // Actualizar producto
        if (!isset($data['id'])) {
            jsonResponse(['error' => 'ID del producto es requerido'], 400);
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('UPDATE products SET name=?, family=?, category=?, subcategory=?, unit=?, price=? WHERE id=?');
            $stmt->execute([
                $data['name'],
                $data['family'] ?? null,
                $data['category'] ?? null,
                $data['subcategory'] ?? null,
                $data['unit'],
                $data['price'] ?? 0.00,
                $data['id']
            ]);

            // Delete old providers mappings
            $stmt_del = $pdo->prepare('DELETE FROM product_providers WHERE product_id=?');
            $stmt_del->execute([$data['id']]);

            // Insert new mappings
            if (!empty($data['provider_ids']) && is_array($data['provider_ids'])) {
                $stmt_pp = $pdo->prepare('INSERT IGNORE INTO product_providers (product_id, provider_id) VALUES (?, ?)');
                foreach ($data['provider_ids'] as $pid) {
                    if(!empty($pid)) {
                        $stmt_pp->execute([$data['id'], $pid]);
                    }
                }
            } else if (!empty($data['provider_id'])) {
                $stmt_pp = $pdo->prepare('INSERT IGNORE INTO product_providers (product_id, provider_id) VALUES (?, ?)');
                $stmt_pp->execute([$data['id'], $data['provider_id']]);
            }

            $pdo->commit();
            jsonResponse(['success' => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Error al actualizar producto: ' . $e->getMessage()], 500);
        }
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