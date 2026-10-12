const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Conexão com PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
});

// Testar conexão com o banco
pool.query("SELECT NOW()", (erro, resultado) => {
    if (erro) {
        console.error("❌ Erro ao conectar ao PostgreSQL:", erro.message);
    } else {
        console.log("✅ PostgreSQL conectado!");
        console.log("🕐 Banco respondeu em:", resultado.rows[0].now);
    }
});

// Rota principal
app.get("/", (req, res) => {
    res.json({
        mensagem: "Abreuzin Services API está funcionando 🚀"
    });
});

// Criar solicitação
app.post("/api/solicitacoes", async (req, res) => {
    try {
        const {
            nome,
            whatsapp,
            email,
            servico,
            descricao,
            orcamento,
            prazo
        } = req.body;

        const resultado = await pool.query(
            `INSERT INTO solicitacoes
            (nome, whatsapp, email, servico, descricao, orcamento, prazo)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                nome,
                whatsapp,
                email,
                servico,
                descricao,
                orcamento,
                prazo
            ]
        );

        console.log("✅ Nova solicitação salva no banco:");
        console.log(resultado.rows[0]);

        res.status(201).json({
            sucesso: true,
            mensagem: "Solicitação salva com sucesso!",
            solicitacao: resultado.rows[0]
        });

    } catch (erro) {
        console.error("❌ Erro ao salvar solicitação:", erro);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao salvar solicitação."
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado na porta ${PORT}`);
});