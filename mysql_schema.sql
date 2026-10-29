
CREATE DATABASE IF NOT EXISTS classicflix;
USE classicflix;

CREATE TABLE IF NOT EXISTS movies (
    id VARCHAR(50) PRIMARY KEY,
    wikidataid VARCHAR(50) UNIQUE,
    title VARCHAR(255) NOT NULL,
    titlept VARCHAR(255),
    originaltitle VARCHAR(255),
    year INT,
    language VARCHAR(50),
    hassubtitles BOOLEAN DEFAULT FALSE,
    posterurl TEXT,
    videourl TEXT,
    awards JSON,
    themes JSON,
    popularity INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS descriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wikidataid VARCHAR(50) UNIQUE,
    descriptionen TEXT,
    descriptionpt TEXT,
    FOREIGN KEY (wikidataid) REFERENCES movies(wikidataid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS technicaldetails (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wikidataid VARCHAR(50) UNIQUE,
    genres JSON,
    director VARCHAR(255),
    castmembers JSON,
    rating VARCHAR(10),
    FOREIGN KEY (wikidataid) REFERENCES movies(wikidataid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
