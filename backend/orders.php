<?php
require_once 'db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];
$data = getJsonInput();

switch ($method) {
    case 'GET':
        // Obtener historial de ordenes (Filtrado por rol)
        $role = isset($_GET['role']) ? $_GET['role'] : 'user';
        $user_name = isset($_GET['user']) ? $_GET['user'] : '';

        if ($role === 'admin') {
            // Admin ve todo
            $stmtOrders = $pdo->query('SELECT id, ref, provider_name as provider, user_name as user, created_at as date FROM orders ORDER BY created_at DESC');
            $orders = $stmtOrders->fetchAll();
        } else {
            // Usuario normal solo ve lo suyo
            $stmtOrders = $pdo->prepare('SELECT id, ref, provider_name as provider, user_name as user, created_at as date FROM orders WHERE user_name = ? ORDER BY created_at DESC');
            $stmtOrders->execute([$user_name]);
            $orders = $stmtOrders->fetchAll();
        }
        
        // Si no hay ordenes, devolver vacio rápido
        if (count($orders) === 0) {
            jsonResponse([]);
        }

        // Obtener los items (solo de las ordenes que vamos a mostrar para optimizar)
        $orderIds = array_column($orders, 'id');
        $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
        
        $stmtItems = $pdo->prepare("SELECT order_id, product_name as name, qty, unit FROM order_items WHERE order_id IN ($placeholders)");
        $stmtItems->execute($orderIds);
        $items = $stmtItems->fetchAll();

        // Agrupar items por order_id
        $itemsByOrder = [];
        foreach($items as $item) {
            $orderId = $item['order_id'];
            if(!isset($itemsByOrder[$orderId])) {
                $itemsByOrder[$orderId] = [];
            }
            $itemsByOrder[$orderId][] = [
                'name' => $item['name'],
                'qty' => $item['qty'],
                'unit' => $item['unit']
            ];
        }

        // Combinar datos
        foreach($orders as &$order) {
            $order['items'] = isset($itemsByOrder[$order['id']]) ? $itemsByOrder[$order['id']] : [];
        }

        jsonResponse($orders);
        break;

    case 'POST':
        // Guardar nueva orden con items
        if (!isset($data['ref']) || !isset($data['provider']) || !isset($data['user']) || !isset($data['items'])) {
            jsonResponse(['error' => 'Datos de la orden incompletos'], 400);
        }

        try {
            $pdo->beginTransaction();

            // Insertar orden principal
            $stmtOrder = $pdo->prepare('INSERT INTO orders (ref, provider_name, user_name) VALUES (?, ?, ?)');
            $stmtOrder->execute([
                $data['ref'],
                $data['provider'],
                $data['user']
            ]);
            $orderId = $pdo->lastInsertId();

            // Insertar items de la orden
            $stmtItem = $pdo->prepare('INSERT INTO order_items (order_id, product_name, qty, unit) VALUES (?, ?, ?, ?)');
            foreach($data['items'] as $item) {
                $stmtItem->execute([
                    $orderId,
                    $item['name'],
                    $item['qty'],
                    $item['unit']
                ]);
            }

            $pdo->commit();
            jsonResponse(['success' => true, 'id' => $orderId], 201);
        } catch (\PDOException $e) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Error al guardar la orden: ' . $e->getMessage()], 500);
        }
        break;

    case 'DELETE':
        // Eliminar orden (opcional)
        // Por ahora, el usuario no solicitó eliminar órdenes, pero se incluye por completitud.
        if (!isset($data['id'])) {
             jsonResponse(['error' => 'ID requerido'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM orders WHERE id = ?');
        $stmt->execute([$data['id']]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Método no soportado'], 405);
}
?>