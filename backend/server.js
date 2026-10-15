
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

require("dotenv").config({
    path: require("path").join(__dirname, "..", ".env")
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "20kb" }));

// ==========================================
// POSTGRESQL
// ==========================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
});

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("❌ Configure JWT_SECRET nas variáveis de ambiente.");
    process.exit(1);
}

// ==========================================
// CONFIGURAR BANCO
// ==========================================

async function configurarBanco() {
    // A tabela solicitacoes já precisa existir.
    await pool.query(`
        ALTER TABLE solicitacoes
        ADD COLUMN IF NOT EXISTS status VARCHAR(20)
        DEFAULT 'pendente'
    `);

    await pool.query(`
        ALTER TABLE solicitacoes
        ADD COLUMN IF NOT EXISTS protocolo VARCHAR(50)
    `);

    await pool.query(`
        ALTER TABLE solicitacoes
        ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
    `);

    await pool.query(`
        UPDATE solicitacoes
        SET status = 'pendente'
        WHERE status IS NULL
    `);

    const antigas = await pool.query(`
        SELECT id FROM solicitacoes
        WHERE protocolo IS NULL
    `);

    for (const item of antigas.rows) {
        const protocolo = `ABS-${String(item.id).padStart(6, "0")}`;

        await pool.query(
            `UPDATE solicitacoes SET protocolo = $1 WHERE id = $2`,
            [protocolo, item.id]
        );
    }

    // Tabela exclusiva para contas de clientes.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS clientes (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(120) NOT NULL,
            email VARCHAR(255) NOT NULL,
            whatsapp VARCHAR(30),
            senha_hash TEXT NOT NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS clientes_email_unico
        ON clientes (LOWER(email))
    `);

    // Vincula novas solicitações a uma conta, quando autenticada.
    // Solicitações antigas continuam preservadas.
    await pool.query(`
        ALTER TABLE solicitacoes
        ADD COLUMN IF NOT EXISTS cliente_id INTEGER
        REFERENCES clientes(id) ON DELETE SET NULL
    `);

    console.log("✅ Banco configurado!");
}

// ==========================================
// MIDDLEWARE: TOKEN JWT
// ==========================================

function lerToken(req) {
    const autorizacao = req.headers.authorization || "";
    const partes = autorizacao.split(" ");

    if (partes.length !== 2 || partes[0] !== "Bearer") {
        return null;
    }

    try {
        return jwt.verify(partes[1], JWT_SECRET);
    } catch {
        return null;
    }
}

// ==========================================
// AUTENTICAÇÃO ADMINISTRATIVA
// ==========================================

function verificarAdmin(req, res, next) {
    const dados = lerToken(req);

    if (!dados) {
        return res.status(401).json({
            sucesso: false,
            mensagem: "Token ausente, inválido ou expirado."
        });
    }

    if (dados.tipo !== "admin") {
        return res.status(403).json({
            sucesso: false,
            mensagem: "Acesso exclusivo para administradores."
        });
    }

    req.admin = dados;
    next();
}

// ==========================================
// AUTENTICAÇÃO DE CLIENTES
// ==========================================

function verificarCliente(req, res, next) {
    const dados = lerToken(req);

    if (!dados) {
        return res.status(401).json({
            sucesso: false,
            mensagem: "Faça login para continuar."
        });
    }

    if (dados.tipo !== "cliente" || !Number.isInteger(dados.id)) {
        return res.status(403).json({
            sucesso: false,
            mensagem: "Acesso exclusivo para clientes."
        });
    }

    req.cliente = { id: dados.id };
    next();
}

// Aceita a solicitação pública existente e também
// identifica o cliente se ele enviar um token válido.
function clienteOpcional(req, res, next) {
    const autorizacao = req.headers.authorization;

    if (!autorizacao) {
        req.cliente = null;
        return next();
    }

    const dados = lerToken(req);

    if (!dados || dados.tipo !== "cliente" ||
        !Number.isInteger(dados.id)) {
        return res.status(401).json({
            sucesso: false,
            mensagem: "Token inválido ou expirado."
        });
    }

    req.cliente = { id: dados.id };
    next();
}

// ==========================================
// LOGIN ADMINISTRATIVO
// ==========================================

app.post("/api/admin/login", async (req, res) => {
    try {
        const { usuario, senha } = req.body;
        const usuarioAdmin = process.env.ADMIN_USER;
        const senhaAdmin = process.env.ADMIN_PASSWORD;

        if (!usuario || !senha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Informe usuário e senha."
            });
        }

        if (!usuarioAdmin || !senhaAdmin ||
            usuario !== usuarioAdmin || senha !== senhaAdmin) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Usuário ou senha inválidos."
            });
        }

        const token = jwt.sign(
            { usuario: usuarioAdmin, tipo: "admin" },
            JWT_SECRET,
            { expiresIn: "8h" }
        );

        return res.json({ sucesso: true, token });
    } catch (erro) {
        console.error("Erro no login administrativo:", erro.message);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor."
        });
    }
});

// ==========================================
// CADASTRO DE CLIENTES
// POST /api/clientes/cadastro
// ==========================================

app.post("/api/clientes/cadastro", async (req, res) => {
    try {
        const { nome, email, whatsapp, senha } = req.body;

        if (
            typeof nome !== "string" ||
            typeof email !== "string" ||
            typeof senha !== "string" ||
            !nome.trim() ||
            !email.trim() ||
            !senha
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Informe nome, e-mail e senha."
            });
        }

        const nomeLimpo = nome.trim();
        const emailLimpo = email.trim().toLowerCase();

        if (nomeLimpo.length > 120) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "O nome deve ter até 120 caracteres."
            });
        }

        if (
            emailLimpo.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Informe um e-mail válido."
            });
        }

        if (senha.length < 8 || Buffer.byteLength(senha, "utf8") > 72) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "A senha deve ter ao menos 8 caracteres e no máximo 72 bytes."
            });
        }

        if (
            whatsapp !== undefined &&
            whatsapp !== null &&
            (typeof whatsapp !== "string" || whatsapp.length > 30)
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "WhatsApp inválido."
            });
        }

        const senhaHash = await bcrypt.hash(senha, 12);

        const resultado = await pool.query(
            `
            INSERT INTO clientes (nome, email, whatsapp, senha_hash)
            VALUES ($1, $2, $3, $4)
            RETURNING id, nome, email, whatsapp, criado_em
            `,
            [
                nomeLimpo,
                emailLimpo,
                whatsapp ? whatsapp.trim() : null,
                senhaHash
            ]
        );

        return res.status(201).json({
            sucesso: true,
            mensagem: "Cadastro realizado com sucesso!",
            cliente: resultado.rows[0]
        });
    } catch (erro) {
        if (erro.code === "23505") {
            return res.status(409).json({
                sucesso: false,
                mensagem: "Este e-mail já está cadastrado."
            });
        }

        console.error("Erro no cadastro:", erro.message);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Não foi possível realizar o cadastro."
        });
    }
});

// ==========================================
// LOGIN DE CLIENTES
// POST /api/clientes/login
// ==========================================

app.post("/api/clientes/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (
            typeof email !== "string" ||
            typeof senha !== "string" ||
            !email.trim() ||
            !senha
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Informe e-mail e senha."
            });
        }

        const resultado = await pool.query(
            `
            SELECT id, nome, email, whatsapp, senha_hash
            FROM clientes
            WHERE LOWER(email) = LOWER($1)
            `,
            [email.trim()]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "E-mail ou senha inválidos."
            });
        }

        const cliente = resultado.rows[0];
        const senhaValida = await bcrypt.compare(
            senha,
            cliente.senha_hash
        );

        if (!senhaValida) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "E-mail ou senha inválidos."
            });
        }

        const token = jwt.sign(
            { id: cliente.id, tipo: "cliente" },
            JWT_SECRET,
            { expiresIn: "8h" }
        );

        return res.json({
            sucesso: true,
            mensagem: "Login realizado com sucesso!",
            token,
            cliente: {
                id: cliente.id,
                nome: cliente.nome,
                email: cliente.email,
                whatsapp: cliente.whatsapp
            }
        });
    } catch (erro) {
        console.error("Erro no login do cliente:", erro.message);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor."
        });
    }
});

// ==========================================
// DADOS DO CLIENTE AUTENTICADO
// GET /api/clientes/me
// ==========================================

app.get("/api/clientes/me", verificarCliente, async (req, res) => {
    try {
        const resultado = await pool.query(
            `
            SELECT id, nome, email, whatsapp, criado_em
            FROM clientes
            WHERE id = $1
            `,
            [req.cliente.id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Conta não encontrada."
            });
        }

        return res.json({
            sucesso: true,
            cliente: resultado.rows[0]
        });
    } catch (erro) {
        console.error("Erro ao buscar cliente:", erro.message);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar os dados da conta."
        });
    }
});

// ==========================================
// SOLICITAÇÕES DO CLIENTE AUTENTICADO
// GET /api/clientes/me/solicitacoes
// ==========================================

app.get(
    "/api/clientes/me/solicitacoes",
    verificarCliente,
    async (req, res) => {
        try {
            const resultado = await pool.query(
                `
                SELECT id, protocolo, servico, descricao, status,
                       criado_em, atualizado_em
                FROM solicitacoes
                WHERE cliente_id = $1
                ORDER BY id DESC
                `,
                [req.cliente.id]
            );

            return res.json({
                sucesso: true,
                solicitacoes: resultado.rows
            });
        } catch (erro) {
            console.error("Erro nas solicitações do cliente:", erro.message);
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao buscar suas solicitações."
            });
        }
    }
);

// ==========================================
// ROTA PRINCIPAL E HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
    res.json({
        mensagem: "Abreuzin Services API está funcionando 🚀"
    });
});

app.get("/healthz", (req, res) => {
    res.json({ status: "ok" });
});

// ==========================================
// CRIAR SOLICITAÇÃO
// Mantém o formulário público existente.
// Se autenticado, vincula à conta do cliente.
// ==========================================

app.post("/api/solicitacoes", clienteOpcional, async (req, res) => {
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
            !nome || !whatsapp || !email || !servico ||
            typeof nome !== "string" ||
            typeof email !== "string" ||
            typeof servico !== "string"
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Preencha os campos obrigatórios."
            });
        }

        const resultado = await pool.query(
            `
            INSERT INTO solicitacoes
            (
                nome, whatsapp, email, servico, descricao,
                orcamento, prazo, status, cliente_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendente', $8)
            RETURNING *
            `,
            [
                nome.trim(),
                whatsapp,
                email.trim(),
                servico,
                descricao || null,
                orcamento || null,
                prazo || null,
                req.cliente ? req.cliente.id : null
            ]
        );

        const solicitacao = resultado.rows[0];
        const protocolo = `ABS-${String(solicitacao.id).padStart(6, "0")}`;

        const atualizada = await pool.query(
            `
            UPDATE solicitacoes
            SET protocolo = $1, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
            `,
            [protocolo, solicitacao.id]
        );

        console.log("✅ Nova solicitação:", protocolo);

        return res.status(201).json({
            sucesso: true,
            mensagem: "Solicitação criada com sucesso!",
            protocolo,
            solicitacao: atualizada.rows[0]
        });
    } catch (erro) {
        console.error("Erro ao salvar solicitação:", erro.message);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao salvar solicitação."
        });
    }
});

// ==========================================
// TODAS AS SOLICITAÇÕES - ADMIN
// ==========================================

app.get("/api/solicitacoes", verificarAdmin, async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT * FROM solicitacoes ORDER BY id DESC"
        );

        return res.json({
            sucesso: true,
            solicitacoes: resultado.rows
        });
    } catch (erro) {
        console.error("Erro ao buscar solicitações:", erro.message);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar solicitações."
        });
    }
});

// ==========================================
// SOLICITAÇÕES PENDENTES - ADMIN
// ==========================================

app.get(
    "/api/solicitacoes/pendentes",
    verificarAdmin,
    async (req, res) => {
        try {
            const resultado = await pool.query(
                `
                SELECT * FROM solicitacoes
                WHERE status IS DISTINCT FROM 'concluido'
                ORDER BY id DESC
                `
            );

            return res.json({
                sucesso: true,
                solicitacoes: resultado.rows
            });
        } catch (erro) {
            console.error("Erro ao buscar pendentes:", erro.message);
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao buscar solicitações."
            });
        }
    }
);

// ==========================================
// HISTÓRICO DE CONCLUÍDOS - ADMIN
// ==========================================

app.get(
    "/api/solicitacoes/concluidas",
    verificarAdmin,
    async (req, res) => {
        try {
            const resultado = await pool.query(
                `
                SELECT * FROM solicitacoes
                WHERE status = 'concluido'
                ORDER BY id DESC
                `
            );

            return res.json({
                sucesso: true,
                solicitacoes: resultado.rows
            });
        } catch (erro) {
            console.error("Erro ao buscar histórico:", erro.message);
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao buscar histórico."
            });
        }
    }
);

// ==========================================
// ALTERAR STATUS - ADMIN
// ==========================================

app.patch(
    "/api/solicitacoes/:id/status",
    verificarAdmin,
    async (req, res) => {
        try {
            const id = Number(req.params.id);
            const { status } = req.body;

            const permitidos = [
                "pendente",
                "em_andamento",
                "concluido"
            ];

            if (!Number.isInteger(id) || id < 1) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "ID inválido."
                });
            }

            if (!permitidos.includes(status)) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "Status inválido."
                });
            }

            const resultado = await pool.query(
                `
                UPDATE solicitacoes
                SET status = $1, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
                `,
                [status, id]
            );

            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: "Solicitação não encontrada."
                });
            }

            return res.json({
                sucesso: true,
                mensagem: "Status atualizado com sucesso!",
                solicitacao: resultado.rows[0]
            });
        } catch (erro) {
            console.error("Erro ao alterar status:", erro.message);
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao alterar status."
            });
        }
    }
);

// ==========================================
// CONSULTAR PROTOCOLO
// Mantém a rota pública existente.
// ==========================================

app.get(
    "/api/solicitacoes/protocolo/:protocolo",
    async (req, res) => {
        try {
            const resultado = await pool.query(
                `
                SELECT protocolo, nome, servico, status,
                       criado_em, atualizado_em
                FROM solicitacoes
                WHERE protocolo = $1
                `,
                [req.params.protocolo]
            );

            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: "Protocolo não encontrado."
                });
            }

            return res.json({
                sucesso: true,
                solicitacao: resultado.rows[0]
            });
        } catch (erro) {
            console.error("Erro ao consultar protocolo:", erro.message);
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao consultar protocolo."
            });
        }
    }
);

// ==========================================
// INICIALIZAÇÃO
// ==========================================

async function iniciarServidor() {
    try {
        await pool.query("SELECT NOW()");
        console.log("✅ PostgreSQL conectado!");

        await configurarBanco();

        app.listen(PORT, () => {
            console.log(`🚀 Servidor iniciado na porta ${PORT}`);
        });
    } catch (erro) {
        console.error("❌ Não foi possível iniciar:", erro.message);
        process.exit(1);
    }
}

iniciarServidor();
