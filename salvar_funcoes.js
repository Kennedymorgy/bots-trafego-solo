import axios from 'axios';

const FIREBASE_BASE_URL = 'https://meublog-apks-default-rtdb.firebaseio.com';

// 1. Digite o ID EXATO do jogo no Firebase (ex: "football-league-2026", "fr-legends", "roblox")
const ID_JOGO = 'football-league-2026';

// 2. Escreva as funções reais e testadas na caixinha, separadas por vírgula
const CAIXINHA_DE_FUNCOES = "Mod Menu Atualizado, Dinheiro / Moedas Ilimitadas, Todos os Times Liberados, Sem Anúncios (No Ads), Anti-Ban Integrado";

// 3. Coloque o peso/tamanho exato do APK
const PESO_MB = "145 MB";

async function atualizarDadosJogo() {
  try {
    // Transforma a caixinha em uma lista limpa
    const listaFuncoes = CAIXINHA_DE_FUNCOES
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    console.log(`📡 Atualizando dados no Firebase para o ID: "${ID_JOGO}"...`);

    await axios.patch(`${FIREBASE_BASE_URL}/jogos/${ID_JOGO}.json`, {
      recursos_mod: listaFuncoes,
      peso: PESO_MB,
      postado_blogger: false // Força o robô a repostar/postar com as novas funções
    });

    console.log(`✅ Sucesso! As ${listaFuncoes.length} funções e o peso (${PESO_MB}) foram salvos no ID "${ID_JOGO}".`);
  } catch (error) {
    console.error(`❌ Erro ao salvar no Firebase:`, error.message);
  }
}

atualizarDadosJogo();
