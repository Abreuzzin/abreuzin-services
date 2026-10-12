function abrirFormulario(servico) {
    const formulario = document.getElementById("formulario");

    formulario.scrollIntoView({
        behavior: "smooth"
    });

    const selectServico = document.getElementById("servico");

    if (selectServico) {
        selectServico.value = servico;
    }
}

const formulario = document.querySelector("form");

if (formulario) {
    formulario.addEventListener("submit", async function (event) {
        event.preventDefault();

        const dados = {
            nome: document.getElementById("nome").value,
            whatsapp: document.getElementById("whatsapp").value,
            email: document.getElementById("email").value,
            servico: document.getElementById("servico").value,
            descricao: document.getElementById("descricao").value,
            orcamento: document.getElementById("orcamento").value,
            prazo: document.getElementById("prazo").value
        };

console.log("🔥 SCRIPT.JS FOI CARREGADO!");
        try {
            const resposta = await fetch(
                "https://abreuzin-services.onrender.com/api/solicitacoes",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                }
            );

            const resultado = await resposta.json();

            console.log("📥 Resposta do servidor:", resultado);

            if (resposta.ok) {
                alert("✅ Solicitação enviada com sucesso!");

                formulario.reset();
            } else {
                alert("❌ Erro ao enviar solicitação.");
            }

        } catch (erro) {
            console.error("❌ Erro:", erro);

            alert(
                "❌ Não foi possível conectar ao servidor. Verifique se o backend está rodando."
            );
        }
    });
}