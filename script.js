
/* ==========================================
   ABREUZIN SERVICES
   FORMULÁRIOS, API, CLIENTES E ACOMPANHAMENTO
========================================== */

"use strict";

const API = "https://abreuzin-services.onrender.com";
const CHAVE_TOKEN_CLIENTE = "clienteToken";

/* ==========================================
   UTILITÁRIOS
========================================== */

function obterElemento(id) {
    return document.getElementById(id);
}

function obterValor(id) {
    const elemento = obterElemento(id);
    return elemento ? elemento.value.trim() : "";
}

function mostrarMensagem(elemento, mensagem, tipo = "erro") {
    if (!elemento) return;

    elemento.textContent = mensagem;
    elemento.style.display = "block";
    elemento.dataset.tipo = tipo;
    elemento.setAttribute("role", tipo === "erro" ? "alert" : "status");
}

function ocultarElemento(elemento) {
    if (elemento) elemento.style.display = "none";
}

function obterTokenCliente() {
    try {
        return sessionStorage.getItem(CHAVE_TOKEN_CLIENTE);
    } catch {
        return null;
    }
}

function limparTokenCliente() {
    try {
        sessionStorage.removeItem(CHAVE_TOKEN_CLIENTE);
    } catch (erro) {
        console.warn("Não foi possível limpar a sessão:", erro);
    }
}

function normalizarStatus(status) {
    return String(status || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s-]+/g, "_");
}

function formatarStatus(status) {
    const statusNormalizado = normalizarStatus(status);

    const statusConhecidos = {
        pendente: "Pendente",
        recebida: "Recebida",
        em_analise: "Em análise",
        em_andamento: "Em andamento",
        em_execucao: "Em execução",
        concluido: "Concluído",
        concluida: "Concluída",
        cancelado: "Cancelado"
    };

    return statusConhecidos[statusNormalizado] ||
        (String(status || "").trim() || "Não informado");
}

function formatarData(data) {
    if (!data) return "Não informado";

    const dataConvertida = new Date(data);

    if (Number.isNaN(dataConvertida.getTime())) {
        return "Data indisponível";
    }

    return dataConvertida.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

async function lerResposta(resposta) {
    const texto = await resposta.text();

    if (!texto) return {};

    try {
        return JSON.parse(texto);
    } catch {
        return { mensagem: texto };
    }
}

async function requisitarAPI(caminho, opcoes = {}) {
    let resposta;

    try {
        resposta = await fetch(`${API}${caminho}`, opcoes);
    } catch {
        throw new Error(
            "Não foi possível conectar à API. Verifique sua conexão e tente novamente."
        );
    }

    const resultado = await lerResposta(resposta);

    if (!resposta.ok) {
        if (resposta.status === 401) {
            throw new Error(
                resultado.mensagem ||
                resultado.erro ||
                "Sua sessão expirou ou você não está autorizado."
            );
        }

        if (resposta.status === 404) {
            throw new Error(
                resultado.mensagem ||
                resultado.erro ||
                "Registro não encontrado."
            );
        }

        if (resposta.status >= 500) {
            throw new Error(
                resultado.mensagem ||
                resultado.erro ||
                "O servidor encontrou um problema. Tente novamente mais tarde."
            );
        }

        throw new Error(
            resultado.mensagem ||
            resultado.erro ||
            "Não foi possível concluir a operação."
        );
    }

    return resultado;
}

function obterCabecalhosJSON(comToken = false) {
    const cabecalhos = {
        "Content-Type": "application/json"
    };

    const token = comToken ? obterTokenCliente() : null;

    if (token) {
        cabecalhos.Authorization = `Bearer ${token}`;
    }

    return cabecalhos;
}

/* ==========================================
   NAVEGAÇÃO E SELEÇÃO DE SERVIÇOS
========================================== */

function abrirFormulario(servico) {
    const secao = obterElemento("formulario");

    if (!secao) {
        console.error("Seção do formulário não encontrada.");
        return;
    }

    const linkFormulario = document.querySelector(
        '[data-tab="formulario"]'
    );

    if (linkFormulario) {
        linkFormulario.click();
    } else {
        document.querySelectorAll(".page-section").forEach(item => {
            item.classList.remove("active-section");
        });

        secao.classList.add("active-section");
    }

    const selectServico = obterElemento("servico");

    if (selectServico && servico) {
        const escolhido = String(servico).trim();

        const opcao = Array.from(selectServico.options).find(item =>
            item.value.trim() === escolhido ||
            item.textContent.trim() === escolhido
        );

        if (opcao) {
            selectServico.value = opcao.value;
        }
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

/* ==========================================
   SESSÃO E DADOS DO CLIENTE
========================================== */

async function carregarDadosCliente() {
    const token = obterTokenCliente();

    if (!token) return null;

    try {
        const resultado = await requisitarAPI("/api/clientes/me", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!resultado.sucesso || !resultado.cliente) {
            return null;
        }

        const cliente = resultado.cliente;

        preencherSeVazio("nome", cliente.nome);
        preencherSeVazio("email", cliente.email);
        preencherSeVazio(
            "whatsapp",
            cliente.whatsapp || cliente.telefone
        );

        const aviso = obterElemento("clienteSessaoAviso");

        if (aviso) {
            aviso.hidden = false;
        }

        const linkEntrar = document.querySelector(
            '.account-nav-link[href="login.html"]'
        );

        const linkCadastro = document.querySelector(
            '.account-nav-link[href="cadastro.html"]'
        );

        if (linkEntrar) {
            linkEntrar.href = "cliente.html";
            linkEntrar.textContent = "Minha conta";
        }

        if (linkCadastro) {
            linkCadastro.hidden = true;
        }

        return cliente;
    } catch (erro) {
        console.warn("Não foi possível carregar os dados do cliente:", erro.message);

        /*
         * Não removemos o token automaticamente em qualquer erro de rede.
         * Uma indisponibilidade temporária da API não significa que o token
         * esteja inválido.
         */
        if (/sessão expirou|não está autorizado/i.test(erro.message)) {
            limparTokenCliente();
        }

        return null;
    }
}

function preencherSeVazio(id, valor) {
    const elemento = obterElemento(id);

    if (
        elemento &&
        valor !== undefined &&
        valor !== null &&
        !elemento.value.trim()
    ) {
        elemento.value = String(valor);
    }
}

/* ==========================================
   LINHA DO TEMPO
========================================== */

function atualizarLinhaDoTempo(status) {
    const timeline = obterElemento("trackingTimeline");

    if (!timeline) return;

    const etapas = Array.from(
        timeline.querySelectorAll(".tracking-timeline-item")
    );

    const statusAtual = normalizarStatus(status);

    const etapaPorStatus = {
        pendente: "recebida",
        recebida: "recebida",
        em_analise: "analise",
        em_andamento: "execucao",
        em_execucao: "execucao",
        concluido: "concluida",
        concluida: "concluida"
    };

    const etapaAtual = etapaPorStatus[statusAtual];

    etapas.forEach(etapa => {
        etapa.classList.remove(
            "is-complete",
            "is-current",
            "is-cancelled"
        );

        etapa.removeAttribute("aria-current");
    });

    if (statusAtual === "cancelado") {
        etapas.forEach(etapa => {
            etapa.classList.add("is-cancelled");
        });

        return;
    }

    if (!etapaAtual) return;

    const ordemEtapas = [
        "recebida",
        "analise",
        "execucao",
        "concluida"
    ];

    const indiceAtual = ordemEtapas.indexOf(etapaAtual);

    etapas.forEach(etapa => {
        const indiceEtapa = ordemEtapas.indexOf(etapa.dataset.step);

        if (indiceEtapa === -1) return;

        if (statusAtual === "concluido" || statusAtual === "concluida") {
            etapa.classList.add("is-complete");
        } else if (indiceEtapa < indiceAtual) {
            etapa.classList.add("is-complete");
        } else if (indiceEtapa === indiceAtual) {
            etapa.classList.add("is-current");
            etapa.setAttribute("aria-current", "step");
        }
    });
}

/* ==========================================
   MENSAGEM DE ACOMPANHAMENTO
========================================== */

function obterMensagemStatus(status) {
    const mensagens = {
        pendente:
            "Sua solicitação foi recebida e está aguardando análise.",
        recebida:
            "Sua solicitação foi recebida e está registrada no sistema.",
        em_analise:
            "Sua solicitação está sendo analisada.",
        em_andamento:
            "Sua solicitação está em andamento.",
        em_execucao:
            "O serviço está em execução.",
        concluido:
            "Sua solicitação foi concluída.",
        concluida:
            "Sua solicitação foi concluída.",
        cancelado:
            "Esta solicitação está marcada como cancelada. Entre em contato para obter esclarecimentos."
    };

    return mensagens[normalizarStatus(status)] ||
        "Não há uma mensagem disponível para este status.";
}

/* ==========================================
   LIMPAR RESULTADOS DA CONSULTA
========================================== */

function limparResultadoConsulta() {
    ocultarElemento(obterElemento("resultadoConsulta"));
    ocultarElemento(obterElemento("erroConsulta"));

    const placeholder = obterElemento("trackingPlaceholder");

    if (placeholder) {
        placeholder.style.display = "flex";
    }

    const timeline = obterElemento("trackingTimeline");

    if (timeline) {
        timeline.querySelectorAll(".tracking-timeline-item").forEach(etapa => {
            etapa.classList.remove(
                "is-complete",
                "is-current",
                "is-cancelled"
            );

            etapa.removeAttribute("aria-current");
        });
    }
}

function preencherTexto(id, valor) {
    const elemento = obterElemento(id);

    if (elemento) {
        elemento.textContent = valor ?? "Não informado";
    }
}

/* ==========================================
   ENVIO DA SOLICITAÇÃO
========================================== */

const formularioContratacao = obterElemento("contratacaoForm");

if (formularioContratacao) {
    formularioContratacao.addEventListener("submit", async event => {
        event.preventDefault();

        const botao = formularioContratacao.querySelector(
            'button[type="submit"]'
        );

        if (botao?.disabled) return;

        const textoOriginal = botao?.innerHTML || "";
        const mensagem = obterElemento("mensagemContratacao");

        ocultarElemento(mensagem);

        const dados = {
            nome: obterValor("nome"),
            whatsapp: obterValor("whatsapp"),
            email: obterValor("email"),
            servico: obterValor("servico"),
            descricao: obterValor("descricao"),
            orcamento: obterValor("orcamento"),
            prazo: obterValor("prazo")
        };

        if (
            !dados.nome ||
            !dados.whatsapp ||
            !dados.email ||
            !dados.servico ||
            !dados.descricao
        ) {
            const texto = "Preencha todos os campos obrigatórios.";

            if (mensagem) {
                mostrarMensagem(mensagem, texto, "erro");
            } else {
                alert(texto);
            }

            return;
        }

        try {
            if (botao) {
                botao.disabled = true;
                botao.textContent = "Enviando...";
            }

            const resultado = await requisitarAPI("/api/solicitacoes", {
                method: "POST",
                headers: obterCabecalhosJSON(true),
                body: JSON.stringify(dados)
            });

            const solicitacao = resultado.solicitacao || resultado;
            const protocolo = solicitacao.protocolo;

            if (resultado.sucesso === false || !protocolo) {
                throw new Error(
                    resultado.mensagem ||
                    "O servidor não confirmou a criação do protocolo."
                );
            }

            const protocoloGerado = String(protocolo);

            formularioContratacao.reset();
            limparResultadoConsulta();

            const campoProtocolo = obterElemento("protocolo");

            if (campoProtocolo) {
                campoProtocolo.value = protocoloGerado;
            }

            /*
             * Repõe os dados do cliente depois de limpar o formulário.
             */
            if (obterTokenCliente()) {
                await carregarDadosCliente();
            }

            const mensagemSucesso =
                `Solicitação enviada com sucesso! Protocolo: ${protocoloGerado}. Guarde esse número para acompanhar seu projeto.`;

            if (mensagem) {
                mostrarMensagem(mensagem, mensagemSucesso, "sucesso");
            } else {
                alert(mensagemSucesso);
            }

            const linkAcompanhar = document.querySelector(
                '[data-tab="acompanhar"]'
            );

            if (linkAcompanhar) {
                linkAcompanhar.click();
            }

        } catch (erro) {
            console.error("Erro ao enviar solicitação:", erro);

            if (mensagem) {
                mostrarMensagem(
                    mensagem,
                    erro.message || "Não foi possível enviar a solicitação.",
                    "erro"
                );
            } else {
                alert(erro.message || "Não foi possível enviar a solicitação.");
            }
        } finally {
            if (botao) {
                botao.disabled = false;
                botao.innerHTML = textoOriginal;
            }
        }
    });
}

/* ==========================================
   CONSULTA POR PROTOCOLO
========================================== */

const formularioConsulta = obterElemento("consultaForm");

if (formularioConsulta) {
    formularioConsulta.addEventListener("submit", async event => {
        event.preventDefault();

        const campoProtocolo = obterElemento("protocolo");
        const resultadoConsulta = obterElemento("resultadoConsulta");
        const erroConsulta = obterElemento("erroConsulta");
        const placeholder = obterElemento("trackingPlaceholder");

        const botao = formularioConsulta.querySelector(
            'button[type="submit"]'
        );

        if (botao?.disabled) return;

        const textoOriginal = botao?.innerHTML || "";

        const protocolo = campoProtocolo
            ? campoProtocolo.value.trim().toUpperCase()
            : "";

        ocultarElemento(resultadoConsulta);
        ocultarElemento(erroConsulta);

        if (!protocolo) {
            mostrarMensagem(erroConsulta, "Digite o número do protocolo.");
            return;
        }

        try {
            if (botao) {
                botao.disabled = true;
                botao.textContent = "Consultando...";
            }

            const resultado = await requisitarAPI(
                `/api/solicitacoes/protocolo/${encodeURIComponent(protocolo)}`
            );

            const solicitacao = resultado.solicitacao;

            if (resultado.sucesso === false || !solicitacao) {
                throw new Error(
                    resultado.mensagem ||
                    "Não foi possível encontrar os dados da solicitação."
                );
            }

            if (!resultadoConsulta) {
                throw new Error("A área de resultado não foi encontrada no HTML.");
            }

            const status = solicitacao.status || "pendente";

            preencherTexto(
                "consultaProtocolo",
                solicitacao.protocolo || protocolo
            );

            preencherTexto(
                "consultaServico",
                solicitacao.servico || "Não informado"
            );

            preencherTexto("consultaStatus", formatarStatus(status));
            preencherTexto("consultaCriado", formatarData(solicitacao.criado_em));
            preencherTexto("consultaAtualizado", formatarData(solicitacao.atualizado_em));
            preencherTexto("consultaMensagem", obterMensagemStatus(status));

            const statusElemento = obterElemento("consultaStatus");

            if (statusElemento) {
                statusElemento.dataset.status = normalizarStatus(status);
            }

            atualizarLinhaDoTempo(status);
            resultadoConsulta.style.display = "block";
            ocultarElemento(erroConsulta);

            if (placeholder) {
                placeholder.style.display = "none";
            }

        } catch (erro) {
            console.error("Erro ao consultar protocolo:", erro);

            mostrarMensagem(
                erroConsulta,
                erro.message || "Não foi possível consultar a solicitação."
            );
        } finally {
            if (botao) {
                botao.disabled = false;
                botao.innerHTML = textoOriginal;
            }
        }
    });

    formularioConsulta.addEventListener("input", () => {
        ocultarElemento(obterElemento("erroConsulta"));
    });
}

/* ==========================================
   INICIALIZAÇÃO
========================================== */

document.addEventListener("DOMContentLoaded", () => {
    carregarDadosCliente();

    console.log("Abreuzin Services: script.js carregado.");
});
