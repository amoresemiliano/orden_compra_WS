<?php
require_once 'db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];
$data = getJsonInput();

switch ($method) {
    case 'GET':
        $role = isset($_GET['role']) ? $_GET['role'] : 'user';
        $user_name = isset($_GET['user']) ? $_GET['user'] : '';

        if ($role === 'admin') {
            $stmtOrders = $pdo->query('SELECT id, ref, provider_name as provider, user_name as user, created_at as date FROM orders ORDER BY created_at DESC');
            $orders = $stmtOrders->fetchAll();
        } else {
            $stmtOrders = $pdo->prepare('SELECT id, ref, provider_name as provider, user_name as user, created_at as date FROM orders WHERE user_name = ? ORDER BY created_at DESC');
            $stmtOrders->execute([$user_name]);
            $orders = $stmtOrders->fetchAll();
        }
        
        if (count($orders) === 0) {
            jsonResponse([]);
        }

        $orderIds = array_column($orders, 'id');
        $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
        
        $stmtItems = $pdo->prepare("SELECT order_id, product_name as name, qty, unit FROM order_items WHERE order_id IN ($placeholders)");
        $stmtItems->execute($orderIds);
        $items = $stmtItems->fetchAll();

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

        foreach($orders as &$order) {
            $order['items'] = isset($itemsByOrder[$order['id']]) ? $itemsByOrder[$order['id']] : [];
        }

        jsonResponse($orders);
        break;

    case 'POST':
        // Guardar nueva orden
        if (!isset($data['provider']) || !isset($data['user']) || !isset($data['items'])) {
            jsonResponse(['error' => 'Datos de la orden incompletos'], 400);
        }

        try {
            $pdo->beginTransaction();

            // Insertar orden principal con un ref temporal
            $stmtOrder = $pdo->prepare('INSERT INTO orders (ref, provider_name, user_name) VALUES (?, ?, ?)');
            $stmtOrder->execute([
                'TEMP',
                $data['provider'],
                $data['user']
            ]);
            $orderId = $pdo->lastInsertId();

            // Actualizar la referencia ahora que tenemos el ID cronológico (Ej: ORD-0005)
            $newRef = 'ORD-' . str_pad($orderId, 4, '0', STR_PAD_LEFT);
            $stmtUpdateRef = $pdo->prepare('UPDATE orders SET ref = ? WHERE id = ?');
            $stmtUpdateRef->execute([$newRef, $orderId]);

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
            jsonResponse(['success' => true, 'id' => $orderId, 'ref' => $newRef], 201);
        } catch (\PDOException $e) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Error al guardar la orden: ' . $e->getMessage()], 500);
        }
        break;

    case 'PUT':
        // Actualizar una orden existente
        if (!isset($data['id']) || !isset($data['provider']) || !isset($data['items'])) {
            jsonResponse(['error' => 'Datos incompletos para actualizar'], 400);
        }
        
        try {
            $pdo->beginTransaction();

            $stmtOrder = $pdo->prepare('UPDATE orders SET provider_name = ? WHERE id = ?');
            $stmtOrder->execute([$data['provider'], $data['id']]);

            $stmtDel = $pdo->prepare('DELETE FROM order_items WHERE order_id = ?');
            $stmtDel->execute([$data['id']]);

            $stmtItem = $pdo->prepare('INSERT INTO order_items (order_id, product_name, qty, unit) VALUES (?, ?, ?, ?)');
            foreach($data['items'] as $item) {
                $stmtItem->execute([
                    $data['id'],
                    $item['name'],
                    $item['qty'],
                    $item['unit']
                ]);
            }

            $pdo->commit();
            jsonResponse(['success' => true]);
        } catch (\PDOException $e) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Error al actualizar orden: ' . $e->getMessage()], 500);
        }
        break;

    case 'DELETE':
        // Eliminar orden
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