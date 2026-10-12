const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARES
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// POSTGRESQL
// ==========================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
});

// ==========================================
// CONFIGURAR BANCO
// ==========================================

async function configurarBanco() {

    try {

        // Criar coluna status
        await pool.query(`
            ALTER TABLE solicitacoes
            ADD COLUMN IF NOT EXISTS status
            VARCHAR(20)
            DEFAULT 'pendente'
        `);

        // Criar coluna protocolo
        await pool.query(`
            ALTER TABLE solicitacoes
            ADD COLUMN IF NOT EXISTS protocolo
            VARCHAR(50)
        `);

        // Criar coluna de atualização
        await pool.query(`
            ALTER TABLE solicitacoes
            ADD COLUMN IF NOT EXISTS atualizado_em
            TIMESTAMP
            DEFAULT CURRENT_TIMESTAMP
        `);

        // Garantir status nas solicitações antigas
        await pool.query(`
            UPDATE solicitacoes
            SET status = 'pendente'
            WHERE status IS NULL
        `);

        // Criar protocolos nas solicitações antigas
        const antigas = await pool.query(`
            SELECT id
            FROM solicitacoes
            WHERE protocolo IS NULL
        `);

        for (const solicitacao of antigas.rows) {

            const protocolo =
                `ABS-${String(solicitacao.id).padStart(6, "0")}`;

            await pool.query(
                `
                UPDATE solicitacoes
                SET protocolo = $1
                WHERE id = $2
                `,
                [
                    protocolo,
                    solicitacao.id
                ]
            );
        }

        console.log(
            "✅ Banco configurado!"
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao configurar banco:",
            erro.message
        );

    }
}

// ==========================================
// TESTAR CONEXÃO
// ==========================================

pool.query(
    "SELECT NOW()",
    async (erro, resultado) => {

        if (erro) {

            console.error(
                "❌ Erro ao conectar ao PostgreSQL:",
                erro.message
            );

            return;
        }

        console.log(
            "✅ PostgreSQL conectado!"
        );

        console.log(
            "🕐 Banco respondeu em:",
            resultado.rows[0].now
        );

        await configurarBanco();

    }
);

// ==========================================
// LOGIN ADMINISTRADOR
// ==========================================

app.post(
    "/api/admin/login",
    async (req, res) => {

        try {

            const {
                usuario,
                senha
            } = req.body;

            const usuarioAdmin =
                process.env.ADMIN_USER;

            const senhaAdmin =
                process.env.ADMIN_PASSWORD;

            if (!usuario || !senha) {

                return res.status(400).json({

                    sucesso: false,

                    mensagem:
                        "Informe usuário e senha."

                });

            }

            if (
                usuario !== usuarioAdmin ||
                senha !== senhaAdmin
            ) {

                return res.status(401).json({

                    sucesso: false,

                    mensagem:
                        "Usuário ou senha inválidos."

                });

            }

            const token =
                jwt.sign(
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

                mensagem:
                    "Erro interno no servidor."

            });

        }

    }
);

// ==========================================
// AUTENTICAÇÃO ADMIN
// ==========================================

function verificarAdmin(
    req,
    res,
    next
) {

    const autorizacao =
        req.headers.authorization;

    if (!autorizacao) {

        return res.status(401).json({

            sucesso: false,

            mensagem:
                "Acesso não autorizado."

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

            mensagem:
                "Token inválido."

        });

    }

    const token =
        partes[1];

    try {

        const dados =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        if (
            dados.tipo !== "admin"
        ) {

            return res.status(403).json({

                sucesso: false,

                mensagem:
                    "Acesso negado."

            });

        }

        req.admin =
            dados;

        next();

    } catch (erro) {

        return res.status(401).json({

            sucesso: false,

            mensagem:
                "Sessão expirada ou inválida."

        });

    }

}

// ==========================================
// ROTA PRINCIPAL
// ==========================================

app.get(
    "/",
    (req, res) => {

        res.json({

            mensagem:
                "Abreuzin Services API está funcionando 🚀"

        });

    }
);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get(
    "/healthz",
    (req, res) => {

        res.json({

            status: "ok"

        });

    }
);

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

            if (
                !nome ||
                !whatsapp ||
                !email ||
                !servico
            ) {

                return res.status(400).json({

                    sucesso: false,

                    mensagem:
                        "Preencha os campos obrigatórios."

                });

            }

            // Primeiro criamos a solicitação
            const resultado =
                await pool.query(
                    `
                    INSERT INTO solicitacoes
                    (
                        nome,
                        whatsapp,
                        email,
                        servico,
                        descricao,
                        orcamento,
                        prazo,
                        status
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        'pendente'
                    )
                    RETURNING *
                    `,
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

            const solicitacao =
                resultado.rows[0];

            // Criar protocolo baseado no ID
            const protocolo =
                `ABS-${String(
                    solicitacao.id
                ).padStart(6, "0")}`;

            // Salvar protocolo
            const atualizada =
                await pool.query(
                    `
                    UPDATE solicitacoes
                    SET
                        protocolo = $1,
                        atualizado_em = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING *
                    `,
                    [
                        protocolo,
                        solicitacao.id
                    ]
                );

            console.log(
                "✅ Nova solicitação:"
            );

            console.log(
                atualizada.rows[0]
            );

            res.status(201).json({

                sucesso: true,

                mensagem:
                    "Solicitação criada com sucesso!",

                protocolo,

                solicitacao:
                    atualizada.rows[0]

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
// BUSCAR TODAS AS SOLICITAÇÕES
// ADMIN
// ==========================================

app.get(
    "/api/solicitacoes",
    verificarAdmin,
    async (req, res) => {

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT *
                    FROM solicitacoes
                    ORDER BY id DESC
                    `
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
// BUSCAR SOLICITAÇÕES PENDENTES
// ADMIN
// ==========================================

app.get(
    "/api/solicitacoes/pendentes",
    verificarAdmin,
    async (req, res) => {

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT *
                    FROM solicitacoes
                    WHERE status != 'concluido'
                    ORDER BY id DESC
                    `
                );

            res.json({

                sucesso: true,

                solicitacoes:
                    resultado.rows

            });

        } catch (erro) {

            console.error(
                "❌ Erro ao buscar pendentes:",
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
// HISTÓRICO DE CONCLUÍDOS
// ADMIN
// ==========================================

app.get(
    "/api/solicitacoes/concluidas",
    verificarAdmin,
    async (req, res) => {

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT *
                    FROM solicitacoes
                    WHERE status = 'concluido'
                    ORDER BY id DESC
                    `
                );

            res.json({

                sucesso: true,

                solicitacoes:
                    resultado.rows

            });

        } catch (erro) {

            console.error(
                "❌ Erro ao buscar histórico:",
                erro
            );

            res.status(500).json({

                sucesso: false,

                mensagem:
                    "Erro ao buscar histórico."

            });

        }

    }
);

// ==========================================
// ALTERAR STATUS
// ADMIN
// ==========================================

app.patch(
    "/api/solicitacoes/:id/status",
    verificarAdmin,
    async (req, res) => {

        try {

            const {
                id
            } = req.params;

            const {
                status
            } = req.body;

            const statusPermitidos = [
                "pendente",
                "em_andamento",
                "concluido"
            ];

            if (
                !statusPermitidos.includes(
                    status
                )
            ) {

                return res.status(400).json({

                    sucesso: false,

                    mensagem:
                        "Status inválido."

                });

            }

            const resultado =
                await pool.query(
                    `
                    UPDATE solicitacoes
                    SET
                        status = $1,
                        atualizado_em = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING *
                    `,
                    [
                        status,
                        id
                    ]
                );

            if (
                resultado.rows.length === 0
            ) {

                return res.status(404).json({

                    sucesso: false,

                    mensagem:
                        "Solicitação não encontrada."

                });

            }

            res.json({

                sucesso: true,

                mensagem:
                    "Status atualizado com sucesso!",

                solicitacao:
                    resultado.rows[0]

            });

        } catch (erro) {

            console.error(
                "❌ Erro ao alterar status:",
                erro
            );

            res.status(500).json({

                sucesso: false,

                mensagem:
                    "Erro ao alterar status."

            });

        }

    }
);

// ==========================================
// CONSULTAR PELO PROTOCOLO
// CLIENTE
// ==========================================

app.get(
    "/api/solicitacoes/protocolo/:protocolo",
    async (req, res) => {

        try {

            const {
                protocolo
            } = req.params;

            const resultado =
                await pool.query(
                    `
                    SELECT
                        protocolo,
                        nome,
                        servico,
                        status,
                        criado_em,
                        atualizado_em
                    FROM solicitacoes
                    WHERE protocolo = $1
                    `,
                    [
                        protocolo
                    ]
                );

            if (
                resultado.rows.length === 0
            ) {

                return res.status(404).json({

                    sucesso: false,

                    mensagem:
                        "Protocolo não encontrado."

                });

            }

            res.json({

                sucesso: true,

                solicitacao:
                    resultado.rows[0]

            });

        } catch (erro) {

            console.error(
                "❌ Erro ao consultar protocolo:",
                erro
            );

            res.status(500).json({

                sucesso: false,

                mensagem:
                    "Erro ao consultar protocolo."

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