-- phpMyAdmin SQL Dump
-- Database: `orden_compra_db`

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- Table structure for table `users`
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(100) NOT NULL,
  `role` enum('admin','user') DEFAULT 'user',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user (password: '123' hashed with password_hash)
INSERT INTO `users` (`username`, `password`, `name`, `role`) VALUES
('admin', '$2y$10$wTfD6.yL6u0kO9N8M8bEoeVd9G8hM2N2N8M8bEoeVd9G8hM2N2N8M', 'Administrador', 'admin');

-- Table structure for table `providers`
CREATE TABLE `providers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `cif` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `contact` varchar(100) DEFAULT NULL,
  `family` varchar(100) DEFAULT NULL,
  `payment` varchar(100) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `products`
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `provider_id` int(11) DEFAULT NULL,
  `family` varchar(100) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `subcategory` varchar(100) DEFAULT NULL,
  `unit` varchar(20) NOT NULL,
  `price` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `orders`
CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ref` varchar(20) NOT NULL,
  `provider_name` varchar(100) NOT NULL,
  `user_name` varchar(100) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ref` (`ref`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `order_items`
CREATE TABLE `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_name` varchar(100) NOT NULL,
  `qty` decimal(10,2) NOT NULL,
  `unit` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tables for dynamic lists (Options)
CREATE TABLE `list_options` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `list_type` enum('families','categories','subcategories','units','payment_methods') NOT NULL,
  `value` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `list_type_value` (`list_type`, `value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default list options
INSERT INTO `list_options` (`list_type`, `value`) VALUES
('families', 'Frutas'),
('families', 'Verduras'),
('families', 'Lácteos'),
('families', 'Carnes'),
('families', 'Abarrotes'),
('categories', 'Cítricos'),
('categories', 'Tropical'),
('categories', 'Hoja Verde'),
('categories', 'Tubérculos'),
('categories', 'Quesos'),
('categories', 'Res'),
('categories', 'Cerdo'),
('categories', 'Secos'),
('subcategories', 'Frescos'),
('subcategories', 'Congelados'),
('subcategories', 'Envasados'),
('units', 'kg'),
('units', 'ud'),
('units', 'Cajas'),
('units', 'Manojos'),
('units', 'Grs'),
('units', 'Litros'),
('units', 'Packs'),
('payment_methods', 'Por pedido'),
('payment_methods', 'Mensual'),
('payment_methods', 'Semana de por medio');

COMMIT;