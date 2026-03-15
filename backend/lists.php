<?php
require_once 'db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];
$data = getJsonInput();

switch ($method) {
    case 'GET':
        // Obtener listas dinámicas
        if(isset($_GET['type'])) {
            $type = $_GET['type'];
            $stmt = $pdo->prepare('SELECT id, value as name FROM list_options WHERE list_type = ?');
            $stmt->execute([$type]);
            jsonResponse($stmt->fetchAll());
        } else {
            // Obtener todas agrupadas
            $stmt = $pdo->query('SELECT list_type, id, value as name FROM list_options');
            $all = $stmt->fetchAll();
            $grouped = [];
            foreach($all as $row) {
                if(!isset($grouped[$row['list_type']])) {
                    $grouped[$row['list_type']] = [];
                }
                $grouped[$row['list_type']][] = ['id' => $row['id'], 'name' => $row['name']];
            }
            jsonResponse($grouped);
        }
        break;

    case 'POST':
        // Crear nueva opción en la lista
        if (!isset($data['list_type']) || !isset($data['value'])) {
            jsonResponse(['error' => 'Tipo de lista y valor son requeridos'], 400);
        }

        try {
            $stmt = $pdo->prepare('INSERT INTO list_options (list_type, value) VALUES (?, ?)');
            $stmt->execute([
                $data['list_type'],
                $data['value']
            ]);
            jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()], 201);
        } catch (\PDOException $e) {
            // Ignorar duplicados o devolver error
            jsonResponse(['error' => 'Error al añadir valor, posiblemente duplicado'], 400);
        }
        break;

    case 'DELETE':
        // Eliminar opción (e.g. forma de pago)
        if (!isset($data['id'])) {
            jsonResponse(['error' => 'ID es requerido'], 400);
        }

        $stmt = $pdo->prepare('DELETE FROM list_options WHERE id = ?');
        $stmt->execute([$data['id']]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Método no soportado'], 405);
}
?>