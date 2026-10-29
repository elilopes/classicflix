
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// CONFIGURAÇÃO DO SEU MYSQL LOCAL
const dbConfig = {
    host: 'localhost',
    user: 'root',      // Altere se necessário
    password: '',      // Altere se necessário
    database: 'classicflix'
};

let pool;

async function initDb() {
    try {
        pool = mysql.createPool(dbConfig);
        console.log('✅ Conectado ao MySQL em localhost');
    } catch (err) {
        console.error('❌ Erro ao conectar ao MySQL:', err.message);
    }
}

// Endpoints da API
app.get('/api/movies', async (req, res) => {
    try {
        const [movies] = await pool.query(`
            SELECT m.*, d.*, t.*, i.* 
            FROM movies m
            LEFT JOIN descriptions d ON m.wikidataid = d.wikidataid
            LEFT JOIN technicaldetails t ON m.wikidataid = t.wikidataid
            LEFT JOIN identifiers i ON m.wikidataid = i.wikidataid
        `);
        res.json(movies);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/movies', async (req, res) => {
    const movie = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const cleanJson = (val) => JSON.stringify(Array.isArray(val) ? val : []);
        
        await connection.execute(
            `INSERT INTO movies (id, wikidataid, title, titlept, originaltitle, year, language, hassubtitles, posterurl, videourl, awards, themes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [movie.id, movie.wikidataId, movie.title, movie.titlePt, movie.originalTitle, movie.year, movie.language, movie.hasSubtitles, movie.posterUrl, movie.videoUrl, cleanJson(movie.awards), cleanJson(movie.themes)]
        );

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    initDb();
    console.log(`🚀 Ponte MySQL rodando em http://localhost:${PORT}`);
});
