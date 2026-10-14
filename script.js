/* ==========================================
   ABREUZIN SERVICES
   FORMULÁRIOS, API E ACOMPANHAMENTO
========================================== */

"use strict";

const API = "https://abreuzin-services.onrender.com";

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

function mostrarMensagem(elemento, mensagem) {
    if (!elemento) return;

    elemento.textContent = mensagem;
    elemento.style.display = "block";
}

function ocultarElemento(elemento) {
    if (elemento) {
        elemento.style.display = "none";
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
        em_analise: "Em análise",
        em_andamento: "Em andamento",
        em_execucao: "Em execução",
        concluido: "Concluído",
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
    } catch (erro) {
        throw new Error(
            "Não foi possível conectar à API. Verifique sua conexão e se o servidor está disponível."
        );
    }

    const resultado = await lerResposta(resposta);

    if (!resposta.ok) {
        if (resposta.status === 404) {
            throw new Error(
                resultado.mensagem || "Registro não encontrado."
            );
        }

        if (resposta.status >= 500) {
            throw new Error(
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

/* ==========================================
   NAVEGAÇÃO
   O index.html JÁ CONTROLA AS ABAS
========================================== */

function abrirFormulario(servico) {
    const selectServico = obterElemento("servico");

    if (selectServico && servico) {
        const opcaoExiste = Array.from(selectServico.options)
            .some(opcao => opcao.value === servico);

        if (opcaoExiste) {
            selectServico.value = servico;
        }
    }

    const linkFormulario = document.querySelector(
        '[data-tab="formulario"]'
    );

    if (linkFormulario) {
        linkFormulario.click();
        return;
    }

    const secao = obterElemento("formulario");

    if (secao) {
        document.querySelectorAll(".page-section")
            .forEach(item => {
                item.classList.remove("active-section");
            });

        secao.classList.add("active-section");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
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

    /*
     * Os nomes abaixo correspondem aos data-step
     * presentes no HTML:
     * recebida, analise, execucao e concluida.
     */

    const etapaPorStatus = {
        pendente: "recebida",
        em_analise: "analise",
        em_andamento: "execucao",
        em_execucao: "execucao",
        concluido: "concluida"
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
        const nomeEtapa = etapa.dataset.step;
        const indiceEtapa = ordemEtapas.indexOf(nomeEtapa);

        if (indiceEtapa === -1) return;

        if (statusAtual === "concluido") {
            etapa.classList.add("is-complete");
            return;
        }

        if (indiceEtapa < indiceAtual) {
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

        em_analise:
            "Sua solicitação está sendo analisada.",

        em_andamento:
            "Sua solicitação está em andamento.",

        em_execucao:
            "O serviço está em execução.",

        concluido:
            "Sua solicitação foi concluída.",

        cancelado:
            "Esta solicitação está marcada como cancelada. Entre em contato para obter esclarecimentos."
    };

    return mensagens[normalizarStatus(status)] ||
        "Não há uma mensagem disponível para este status.";
}

/* ==========================================
   LIMPAR E MOSTRAR RESULTADOS
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
        timeline.querySelectorAll(".tracking-timeline-item")
            .forEach(etapa => {
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
        elemento.textContent = valor;
    }
}

/* ==========================================
   ENVIO DA SOLICITAÇÃO
========================================== */

const formularioContratacao = obterElemento("contratacaoForm");

if (formularioContratacao) {
    formularioContratacao.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const botao = formularioContratacao.querySelector(
                'button[type="submit"]'
            );

            if (botao && botao.disabled) return;

            const textoOriginal = botao
                ? botao.innerHTML
                : "";

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
                alert("Preencha todos os campos obrigatórios.");
                return;
            }

            try {
                if (botao) {
                    botao.disabled = true;
                    botao.textContent = "Enviando...";
                }

                const resultado = await requisitarAPI(
                    "/api/solicitacoes",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(dados)
                    }
                );

                const solicitacao =
                    resultado.solicitacao || resultado;

                const protocolo = solicitacao.protocolo;

                if (!resultado.sucesso || !protocolo) {
                    throw new Error(
                        resultado.mensagem ||
                        "O servidor não confirmou a criação do protocolo."
                    );
                }

                const protocoloGerado = String(protocolo);

                formularioContratacao.reset();

                limparResultadoConsulta();

                /*
                 * O campo protocolo pertence ao formulário
                 * de consulta. Ele recebe o protocolo criado.
                 */
                const campoProtocolo = obterElemento("protocolo");

                if (campoProtocolo) {
                    campoProtocolo.value = protocoloGerado;
                }

                alert(
                    "Solicitação enviada com sucesso!\n\n" +
                    "Protocolo: " + protocoloGerado +
                    "\n\nGuarde esse número para acompanhar sua solicitação."
                );

                const linkAcompanhar = document.querySelector(
                    '[data-tab="acompanhar"]'
                );

                if (linkAcompanhar) {
                    linkAcompanhar.click();
                }

            } catch (erro) {
                console.error(
                    "Erro ao enviar solicitação:",
                    erro
                );

                alert(
                    erro.message ||
                    "Não foi possível enviar a solicitação."
                );
            } finally {
                if (botao) {
                    botao.disabled = false;
                    botao.innerHTML = textoOriginal;
                }
            }
        }
    );
}

/* ==========================================
   CONSULTA POR PROTOCOLO
========================================== */

const formularioConsulta = obterElemento("consultaForm");

if (formularioConsulta) {
    formularioConsulta.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const campoProtocolo = obterElemento("protocolo");
            const resultadoConsulta =
                obterElemento("resultadoConsulta");
            const erroConsulta = obterElemento("erroConsulta");
            const placeholder =
                obterElemento("trackingPlaceholder");

            const botao = formularioConsulta.querySelector(
                'button[type="submit"]'
            );

            if (botao && botao.disabled) return;

            const textoOriginal = botao
                ? botao.innerHTML
                : "";

            const protocolo = campoProtocolo
                ? campoProtocolo.value.trim().toUpperCase()
                : "";

            ocultarElemento(resultadoConsulta);
            ocultarElemento(erroConsulta);

            if (!protocolo) {
                mostrarMensagem(
                    erroConsulta,
                    "Digite o número do protocolo."
                );
                return;
            }

            try {
                if (botao) {
                    botao.disabled = true;
                    botao.textContent = "Consultando...";
                }

                const resultado = await requisitarAPI(
                    "/api/solicitacoes/protocolo/" +
                    encodeURIComponent(protocolo)
                );

                const solicitacao = resultado.solicitacao;

                if (!resultado.sucesso || !solicitacao) {
                    throw new Error(
                        resultado.mensagem ||
                        "Não foi possível encontrar os dados da solicitação."
                    );
                }

                if (!resultadoConsulta) {
                    throw new Error(
                        "O elemento resultadoConsulta não existe no HTML."
                    );
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

                preencherTexto(
                    "consultaStatus",
                    formatarStatus(status)
                );

                preencherTexto(
                    "consultaCriado",
                    formatarData(solicitacao.criado_em)
                );

                preencherTexto(
                    "consultaAtualizado",
                    formatarData(solicitacao.atualizado_em)
                );

                preencherTexto(
                    "consultaMensagem",
                    obterMensagemStatus(status)
                );

                const statusElemento = obterElemento(
                    "consultaStatus"
                );

                if (statusElemento) {
                    statusElemento.dataset.status =
                        normalizarStatus(status);
                }

                atualizarLinhaDoTempo(status);

                resultadoConsulta.style.display = "block";

                ocultarElemento(erroConsulta);

                if (placeholder) {
                    placeholder.style.display = "none";
                }

            } catch (erro) {
                console.error(
                    "Erro ao consultar protocolo:",
                    erro
                );

                mostrarMensagem(
                    erroConsulta,
                    erro.message ||
                    "Não foi possível consultar a solicitação."
                );
            } finally {
                if (botao) {
                    botao.disabled = false;
                    botao.innerHTML = textoOriginal;
                }
            }
        }
    );

    formularioConsulta.addEventListener("input", () => {
        ocultarElemento(obterElemento("erroConsulta"));
    });
}

/* ==========================================
   INICIALIZAÇÃO
========================================== */

console.log("Abreuzin Services: script.js carregado.");
