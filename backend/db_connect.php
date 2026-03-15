<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// Configuración de la base de datos (BlueHost u otro servidor)
$host = 'localhost'; // En BlueHost suele ser 'localhost'
$db   = 'athcomar_comprasWS'; // EL NOMBRE DE TU BASE DE DATOS EN C-PANEL
$user = 'athcomar_comprasWS';      // TU USUARIO DE LA BASE DE DATOS
$pass = 'V,HaZP5cd8E}';          // TU CONTRASEÑA
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    echo json_encode(['error' => 'Error de conexión: ' . $e->getMessage()]);
    exit;
}

// Función para enviar respuestas JSON
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// Obtener datos del cuerpo de la petición (JSON)
function getJsonInput() {
    return json_decode(file_get_contents('php://input'), true);
}
?>