// ==========================================
// ABREUZIN SERVICES
// SCRIPT PRINCIPAL
// ==========================================


// ==========================================
// CONFIGURAÇÃO DA API
// ==========================================

const API = "https://abreuzin-services.onrender.com";


// ==========================================
// NAVEGAÇÃO ENTRE ABAS
// ==========================================

function abrirAba(nomeAba) {

    const secoes =
        document.querySelectorAll(".page-section");

    const linksMenu =
        document.querySelectorAll(".nav-link");


    // Esconde todas as seções

    secoes.forEach(function (secao) {

        secao.classList.remove(
            "active-section"
        );

    });


    // Encontra a seção escolhida

    const secaoAtiva =
        document.getElementById(nomeAba);


    if (secaoAtiva) {

        secaoAtiva.classList.add(
            "active-section"
        );

    }


    // Atualiza o menu

    linksMenu.forEach(function (link) {

        link.classList.remove("active");


        if (
            link.dataset.tab === nomeAba
        ) {

            link.classList.add("active");

        }

    });


    // Volta para o topo

    window.scrollTo({

        top: 0,
        behavior: "smooth"

    });


    // Atualiza a URL

    history.replaceState(
        null,
        "",
        "#" + nomeAba
    );

}


// ==========================================
// ABRIR FORMULÁRIO
// ==========================================

function abrirFormulario(servico) {

    // Abre diretamente a aba de orçamento

    abrirAba("formulario");


    // Seleciona automaticamente o serviço

    const selectServico =
        document.getElementById("servico");


    if (
        selectServico &&
        servico
    ) {

        selectServico.value = servico;

    }

}


// ==========================================
// CONFIGURAÇÃO DOS BOTÕES data-tab
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const elementosAbas =
            document.querySelectorAll(
                "[data-tab]"
            );


        elementosAbas.forEach(
            function (elemento) {

                elemento.addEventListener(
                    "click",
                    function (event) {

                        const aba =
                            elemento.dataset.tab;


                        if (!aba) {

                            return;

                        }


                        event.preventDefault();


                        abrirAba(aba);

                    }
                );

            }
        );


        // Verifica se existe uma aba na URL

        const hash =
            window.location.hash.replace(
                "#",
                ""
            );


        const secaoInicial =
            document.getElementById(hash);


        if (
            hash &&
            secaoInicial &&
            secaoInicial.classList.contains(
                "page-section"
            )
        ) {

            abrirAba(hash);

        } else {

            abrirAba("inicio");

        }

    }
);


// ==========================================
// ENVIO DA SOLICITAÇÃO
// ==========================================

const formulario =
    document.getElementById(
        "contratacaoForm"
    );


if (formulario) {

    formulario.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            // ==================================
            // PEGAR DADOS DO FORMULÁRIO
            // ==================================

            const dados = {

                nome:
                    document.getElementById(
                        "nome"
                    ).value.trim(),

                whatsapp:
                    document.getElementById(
                        "whatsapp"
                    ).value.trim(),

                email:
                    document.getElementById(
                        "email"
                    ).value.trim(),

                servico:
                    document.getElementById(
                        "servico"
                    ).value,

                descricao:
                    document.getElementById(
                        "descricao"
                    ).value.trim(),

                orcamento:
                    document.getElementById(
                        "orcamento"
                    ).value.trim(),

                prazo:
                    document.getElementById(
                        "prazo"
                    ).value.trim()

            };


            console.log(
                "📤 Enviando solicitação:",
                dados
            );


            // ==================================
            // VALIDAÇÃO
            // ==================================

            if (
                !dados.nome ||
                !dados.whatsapp ||
                !dados.email ||
                !dados.servico ||
                !dados.descricao
            ) {

                alert(
                    "⚠️ Preencha todos os campos obrigatórios."
                );

                return;

            }


            try {

                // ==================================
                // ENVIAR PARA O BACKEND
                // ==================================

                const resposta =
                    await fetch(
                        `${API}/api/solicitacoes`,
                        {

                            method: "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify(
                                    dados
                                )

                        }
                    );


                const resultado =
                    await resposta.json();


                console.log(
                    "📥 Resposta do servidor:",
                    resultado
                );


                // ==================================
                // SUCESSO
                // ==================================

                if (resposta.ok) {

                    alert(
                        "✅ Solicitação enviada com sucesso!\n\n" +
                        "Seu protocolo é: " +
                        resultado.protocolo +
                        "\n\n" +
                        "Guarde esse número para acompanhar sua solicitação."
                    );


                    // Limpa formulário

                    formulario.reset();


                    // ==================================
                    // COLOCAR PROTOCOLO NO CAMPO
                    // ==================================

                    const campoProtocolo =
                        document.getElementById(
                            "protocolo"
                        );


                    if (campoProtocolo) {

                        campoProtocolo.value =
                            resultado.protocolo;

                    }


                    // ==================================
                    // ABRIR ACOMPANHAMENTO
                    // ==================================

                    setTimeout(
                        function () {

                            abrirAba(
                                "acompanhar"
                            );

                        },
                        500
                    );


                } else {

                    alert(
                        "❌ Erro ao enviar solicitação.\n\n" +
                        (
                            resultado.mensagem ||
                            resultado.erro ||
                            "Tente novamente."
                        )
                    );

                }


            } catch (erro) {

                console.error(
                    "❌ Erro ao enviar solicitação:",
                    erro
                );


                alert(
                    "❌ Não foi possível conectar ao servidor.\n\n" +
                    "Verifique sua conexão ou tente novamente."
                );

            }

        }
    );

}


// ==========================================
// CONSULTAR SOLICITAÇÃO POR PROTOCOLO
// ==========================================

const consultaForm =
    document.getElementById(
        "consultaForm"
    );


if (consultaForm) {

    consultaForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            // ==================================
            // PEGAR PROTOCOLO
            // ==================================

            const campoProtocolo =
                document.getElementById(
                    "protocolo"
                );


            const protocolo =
                campoProtocolo.value
                    .trim()
                    .toUpperCase();


            const resultadoConsulta =
                document.getElementById(
                    "resultadoConsulta"
                );


            const erroConsulta =
                document.getElementById(
                    "erroConsulta"
                );


            // ==================================
            // LIMPAR RESULTADOS ANTERIORES
            // ==================================

            if (resultadoConsulta) {

                resultadoConsulta.style.display =
                    "none";

            }


            if (erroConsulta) {

                erroConsulta.style.display =
                    "none";

            }


            // ==================================
            // VALIDAR PROTOCOLO
            // ==================================

            if (!protocolo) {

                alert(
                    "⚠️ Digite o número do protocolo."
                );

                return;

            }


            try {

                console.log(
                    "🔎 Consultando protocolo:",
                    protocolo
                );


                // ==================================
                // CONSULTAR BACKEND
                // ==================================

                const resposta =
                    await fetch(
                        `${API}/api/solicitacoes/protocolo/${encodeURIComponent(
                            protocolo
                        )}`
                    );


                const resultado =
                    await resposta.json();


                console.log(
                    "📥 Resultado da consulta:",
                    resultado
                );


                // ==================================
                // PROTOCOLO ENCONTRADO
                // ==================================

                if (resposta.ok) {

                    const solicitacao =
                        resultado.solicitacao;


                    // ==================================
                    // PROTOCOLO
                    // ==================================

                    const elementoProtocolo =
                        document.getElementById(
                            "consultaProtocolo"
                        );


                    if (elementoProtocolo) {

                        elementoProtocolo.textContent =
                            solicitacao.protocolo;

                    }


                    // ==================================
                    // SERVIÇO
                    // ==================================

                    const elementoServico =
                        document.getElementById(
                            "consultaServico"
                        );


                    if (elementoServico) {

                        elementoServico.textContent =
                            solicitacao.servico;

                    }


                    // ==================================
                    // STATUS
                    // ==================================

                    const statusElemento =
                        document.getElementById(
                            "consultaStatus"
                        );


                    let statusTexto = "";


                    if (
                        solicitacao.status ===
                        "pendente"
                    ) {

                        statusTexto =
                            "🟡 Pendente";

                    } else if (
                        solicitacao.status ===
                        "em_andamento"
                    ) {

                        statusTexto =
                            "🔵 Em andamento";

                    } else if (
                        solicitacao.status ===
                        "concluido"
                    ) {

                        statusTexto =
                            "🟢 Concluído";

                    } else {

                        statusTexto =
                            solicitacao.status ||
                            "Não informado";

                    }


                    if (statusElemento) {

                        statusElemento.textContent =
                            statusTexto;

                    }


                    // ==================================
                    // DATA DE CRIAÇÃO
                    // ==================================

                    const elementoCriado =
                        document.getElementById(
                            "consultaCriado"
                        );


                    if (elementoCriado) {

                        elementoCriado.textContent =
                            formatarData(
                                solicitacao.criado_em
                            );

                    }


                    // ==================================
                    // DATA DE ATUALIZAÇÃO
                    // ==================================

                    const elementoAtualizado =
                        document.getElementById(
                            "consultaAtualizado"
                        );


                    if (elementoAtualizado) {

                        elementoAtualizado.textContent =
                            formatarData(
                                solicitacao.atualizado_em
                            );

                    }


                    // ==================================
                    // MENSAGEM DO STATUS
                    // ==================================

                    const mensagem =
                        document.getElementById(
                            "consultaMensagem"
                        );


                    if (mensagem) {

                        if (
                            solicitacao.status ===
                            "pendente"
                        ) {

                            mensagem.textContent =
                                "📨 Recebemos sua solicitação e ela está aguardando análise.";

                        } else if (
                            solicitacao.status ===
                            "em_andamento"
                        ) {

                            mensagem.textContent =
                                "🛠️ Nossa equipe está trabalhando na sua solicitação.";

                        } else if (
                            solicitacao.status ===
                            "concluido"
                        ) {

                            mensagem.textContent =
                                "✅ Sua solicitação foi concluída.";

                        } else {

                            mensagem.textContent =
                                "";

                        }

                    }


                    // ==================================
                    // MOSTRAR RESULTADO
                    // ==================================

                    if (resultadoConsulta) {

                        resultadoConsulta.style.display =
                            "block";

                    }


                } else {

                    // ==================================
                    // PROTOCOLO NÃO ENCONTRADO
                    // ==================================

                    if (erroConsulta) {

                        erroConsulta.style.display =
                            "block";

                    }

                }


            } catch (erro) {

                console.error(
                    "❌ Erro ao consultar protocolo:",
                    erro
                );


                if (erroConsulta) {

                    erroConsulta.style.display =
                        "block";

                }

            }

        }
    );

}


// ==========================================
// FORMATAR DATA
// ==========================================

function formatarData(data) {

    if (!data) {

        return "Não informado";

    }


    const dataConvertida =
        new Date(data);


    if (
        Number.isNaN(
            dataConvertida.getTime()
        )
    ) {

        return "Data inválida";

    }


    return dataConvertida.toLocaleString(
        "pt-BR",
        {

            day: "2-digit",

            month: "2-digit",

            year: "numeric",

            hour: "2-digit",

            minute: "2-digit"

        }
    );

}


// ==========================================
// TESTE
// ==========================================

console.log(
    "🔥 SCRIPT.JS FOI CARREGADO!"
);