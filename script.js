// ==========================================
// ABREUZIN SERVICES
// SCRIPT PRINCIPAL
// ==========================================


// ==========================================
// CONFIGURAÇÃO DA API
// ==========================================

const API = "https://abreuzin-services.onrender.com";


// ==========================================
// ABRIR FORMULÁRIO
// ==========================================

function abrirFormulario(servico) {

    const formulario = document.getElementById("formulario");

    if (formulario) {

        formulario.scrollIntoView({
            behavior: "smooth"
        });

    }


    const selectServico =
        document.getElementById("servico");


    if (selectServico) {

        selectServico.value = servico;

    }

}


// ==========================================
// ENVIO DA SOLICITAÇÃO
// ==========================================

const formulario =
    document.getElementById("contratacaoForm");


if (formulario) {

    formulario.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const dados = {

                nome:
                    document.getElementById("nome").value,

                whatsapp:
                    document.getElementById("whatsapp").value,

                email:
                    document.getElementById("email").value,

                servico:
                    document.getElementById("servico").value,

                descricao:
                    document.getElementById("descricao").value,

                orcamento:
                    document.getElementById("orcamento").value,

                prazo:
                    document.getElementById("prazo").value

            };


            console.log(
                "📤 Enviando solicitação:",
                dados
            );


            try {

                const resposta = await fetch(
                    `${API}/api/solicitacoes`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(dados)
                    }
                );


                const resultado =
                    await resposta.json();


                console.log(
                    "📥 Resposta do servidor:",
                    resultado
                );


                if (resposta.ok) {

                    alert(
                        "✅ Solicitação enviada com sucesso!\n\n" +
                        "Seu protocolo é: " +
                        resultado.protocolo +
                        "\n\n" +
                        "Guarde esse número para acompanhar sua solicitação."
                    );


                    formulario.reset();


                    // Coloca o protocolo automaticamente
                    // no campo de acompanhamento

                    const campoProtocolo =
                        document.getElementById(
                            "protocolo"
                        );


                    if (campoProtocolo) {

                        campoProtocolo.value =
                            resultado.protocolo;

                    }


                    // Leva o cliente para
                    // a área de acompanhamento

                    const acompanhar =
                        document.getElementById(
                            "acompanhar"
                        );


                    if (acompanhar) {

                        setTimeout(() => {

                            acompanhar.scrollIntoView({
                                behavior: "smooth"
                            });

                        }, 500);

                    }

                } else {

                    alert(
                        "❌ Erro ao enviar solicitação.\n\n" +
                        (
                            resultado.mensagem ||
                            "Tente novamente."
                        )
                    );

                }


            } catch (erro) {

                console.error(
                    "❌ Erro:",
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
    document.getElementById("consultaForm");


if (consultaForm) {

    consultaForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


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


            // Esconde mensagens anteriores

            if (resultadoConsulta) {

                resultadoConsulta.style.display =
                    "none";

            }


            if (erroConsulta) {

                erroConsulta.style.display =
                    "none";

            }


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


                const resposta =
                    await fetch(
                        `${API}/api/solicitacoes/protocolo/${encodeURIComponent(protocolo)}`
                    );


                const resultado =
                    await resposta.json();


                console.log(
                    "📥 Resultado da consulta:",
                    resultado
                );


                if (resposta.ok) {

                    const solicitacao =
                        resultado.solicitacao;


                    // Protocolo

                    document.getElementById(
                        "consultaProtocolo"
                    ).textContent =
                        solicitacao.protocolo;


                    // Serviço

                    document.getElementById(
                        "consultaServico"
                    ).textContent =
                        solicitacao.servico;


                    // Status

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
                            solicitacao.status;

                    }


                    statusElemento.textContent =
                        statusTexto;


                    // Data de criação

                    document.getElementById(
                        "consultaCriado"
                    ).textContent =
                        formatarData(
                            solicitacao.criado_em
                        );


                    // Última atualização

                    document.getElementById(
                        "consultaAtualizado"
                    ).textContent =
                        formatarData(
                            solicitacao.atualizado_em
                        );


                    // Mensagem conforme o status

                    const mensagem =
                        document.getElementById(
                            "consultaMensagem"
                        );


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


                    // Mostra resultado

                    if (resultadoConsulta) {

                        resultadoConsulta.style.display =
                            "block";

                    }


                } else {

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