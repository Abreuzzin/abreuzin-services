const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

// ==========================================
// TESTAR CONEXÃO COM O BANCO
// ==========================================

pool.query("SELECT NOW()", (erro, resultado) => {
    if (erro) {
        console.error(
            "❌ Erro ao conectar ao PostgreSQL:",
            erro.message
        );
    } else {
        console.log("✅ PostgreSQL conectado!");
        console.log(
            "🕐 Banco respondeu em:",
            resultado.rows[0].now
        );
    }
});

// ==========================================
// LOGIN DO ADMINISTRADOR
// ==========================================

app.post("/api/admin/login", async (req, res) => {
    try {
        const { usuario, senha } = req.body;

        const usuarioAdmin =
            process.env.ADMIN_USER;

        const senhaAdmin =
            process.env.ADMIN_PASSWORD;

        if (!usuario || !senha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Informe usuário e senha."
            });
        }

        if (
            usuario !== usuarioAdmin ||
            senha !== senhaAdmin
        ) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Usuário ou senha inválidos."
            });
        }

        const token = jwt.sign(
            {
                usuario: usuarioAdmin,
                tipo: "admin"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        res.json({
            sucesso: true,
            token
        });

    } catch (erro) {

        console.error(
            "❌ Erro no login:",
            erro
        );

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor."
        });
    }
});

// ==========================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ==========================================

function verificarAdmin(req, res, next) {

    const autorizacao =
        req.headers.authorization;

    if (!autorizacao) {

        return res.status(401).json({
            sucesso: false,
            mensagem: "Acesso não autorizado."
        });

    }

    const partes =
        autorizacao.split(" ");

    if (
        partes.length !== 2 ||
        partes[0] !== "Bearer"
    ) {

        return res.status(401).json({
            sucesso: false,
            mensagem: "Token inválido."
        });

    }

    const token = partes[1];

    try {

        const dados =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        if (dados.tipo !== "admin") {

            return res.status(403).json({
                sucesso: false,
                mensagem: "Acesso negado."
            });

        }

        req.admin = dados;

        next();

    } catch (erro) {

        return res.status(401).json({
            sucesso: false,
            mensagem: "Sessão expirada ou inválida."
        });

    }
}

// ==========================================
// ROTA PRINCIPAL
// ==========================================

app.get("/", (req, res) => {

    res.json({
        mensagem:
            "Abreuzin Services API está funcionando 🚀"
    });

});

// ==========================================
// CRIAR SOLICITAÇÃO
// ==========================================

app.post(
    "/api/solicitacoes",
    async (req, res) => {

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

            const resultado =
                await pool.query(
                    `INSERT INTO solicitacoes
                    (
                        nome,
                        whatsapp,
                        email,
                        servico,
                        descricao,
                        orcamento,
                        prazo
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7
                    )
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

            console.log(
                "✅ Nova solicitação salva:"
            );

            console.log(
                resultado.rows[0]
            );

            res.status(201).json({

                sucesso: true,

                mensagem:
                    "Solicitação salva com sucesso!",

                solicitacao:
                    resultado.rows[0]

            });

        } catch (erro) {

            console.error(
                "❌ Erro ao salvar solicitação:",
                erro
            );

            res.status(500).json({

                sucesso: false,

                mensagem:
                    "Erro ao salvar solicitação."

            });

        }

    }
);

// ==========================================
// BUSCAR SOLICITAÇÕES
// PROTEGIDO PELO LOGIN
// ==========================================

app.get(
    "/api/solicitacoes",
    verificarAdmin,
    async (req, res) => {

        try {

            const resultado =
                await pool.query(
                    `SELECT *
                     FROM solicitacoes
                     ORDER BY id DESC`
                );

            res.json({

                sucesso: true,

                solicitacoes:
                    resultado.rows

            });

        } catch (erro) {

            console.error(
                "❌ Erro ao buscar solicitações:",
                erro
            );

            res.status(500).json({

                sucesso: false,

                mensagem:
                    "Erro ao buscar solicitações."

            });

        }

    }
);

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(
    PORT,
    () => {

        console.log(
            `🚀 Servidor iniciado na porta ${PORT}`
        );

    }
);