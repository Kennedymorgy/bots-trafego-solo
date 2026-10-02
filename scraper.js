import gplay from 'google-play-scraper';
import axios from 'axios';

// URL base do Realtime Database
const FIREBASE_BASE_URL = 'https://meublog-apks-default-rtdb.firebaseio.com';
const FIREBASE_AUTH_SECRET = process.env.FIREBASE_SECRET || '';

const USER_AGENT_S23 = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36';

function getFirebaseUrl(path) {
  const authParam = FIREBASE_AUTH_SECRET ? `?auth=${FIREBASE_AUTH_SECRET}` : '';
  return `${FIREBASE_BASE_URL}${path}.json${authParam}`;
}

function extrairPackageId(itemBusca) {
  if (itemBusca.id) return itemBusca.id;
  if (itemBusca.appId) return itemBusca.appId;
  if (itemBusca.url) {
    const match = itemBusca.url.match(/id=([^&]+)/);
    if (match) return match[1];
  }
  return null;
}

// Verifica se o jogo já tem todas as informações essenciais preenchidas
function estaCompleto(jogo) {
  return (
    jogo.foto &&
    jogo.screenshots &&
    jogo.screenshots.length > 0 &&
    jogo.categoria &&
    jogo.peso &&
    jogo.peso !== 'Varia com o dispositivo' &&
    jogo.package_id
  );
}

async function extrairEAtualizarFirebase() {
  try {
    console.log(`📡 Conectando ao Firebase...`);
    
    const res = await axios.get(getFirebaseUrl('/jogos'));
    const jogosFirebase = res.data;

    if (!jogosFirebase) {
      console.log(`⚠️ Nenhum jogo encontrado no Firebase.`);
      return;
    }

    const idsJogos = Object.keys(jogosFirebase);
    console.log(`📋 Encontrados ${idsJogos.length} jogos no Firebase para verificar.\n`);

    for (const idJogo of idsJogos) {
      const jogoLocal = jogosFirebase[idJogo];

      // REGRA: Se o jogo já tiver tudo 100% preenchido, pula para não gastar recursos
      if (estaCompleto(jogoLocal)) {
        console.log(`⏭️ Jogo "${idJogo}" já tem todas as informações completas no Firebase. Pulando...`);
        continue;
      }

      const termoBusca = jogoLocal.nome_playstore || jogoLocal.nome || idJogo.replace(/-/g, ' ');

      console.log(`==================================================`);
      console.log(`🔎 Processando ID: "${idJogo}"`);
      console.log(`🔍 Termo de Busca: "${termoBusca}"`);
      console.log(`==================================================`);

      try {
        const busca = await gplay.search({
          term: termoBusca,
          num: 1,
          country: 'br',
          lang: 'pt',
          requestOptions: {
            headers: { 'User-Agent': USER_AGENT_S23 }
          }
        });

        if (!busca || busca.length === 0) {
          console.error(`❌ Nenhum resultado na Play Store para: "${termoBusca}"`);
          continue;
        }

        const targetAppId = extrairPackageId(busca[0]);

        if (!targetAppId) {
          console.error(`❌ Não foi possível determinar o Package ID de "${termoBusca}"`);
          continue;
        }

        const detalhes = await gplay.app({
          appId: targetAppId,
          country: 'br',
          lang: 'pt'
        });

        const screenshotsList = (detalhes.screenshots || []).slice(0, 4);

        // Tratamento para o Peso: se a Play Store não der em MB, define um padrão útil ou limpo
        let pesoFinal = detalhes.size;
        if (!pesoFinal || pesoFinal === 'Varia com o dispositivo') {
          pesoFinal = jogoLocal.peso && jogoLocal.peso !== 'Varia com o dispositivo' ? jogoLocal.peso : 'Varia (Android)';
        }

        const dadosAtualizados = {
          foto: jogoLocal.foto || detalhes.icon || '',
          screenshots: (jogoLocal.screenshots && jogoLocal.screenshots.length > 0) ? jogoLocal.screenshots : screenshotsList,
          peso: pesoFinal,
          categoria: jogoLocal.categoria || detalhes.genre || 'Jogos',
          package_id: jogoLocal.package_id || detalhes.appId,
          playstore_link: jogoLocal.playstore_link || detalhes.url || '',
          ultima_extracao: new Date().toISOString()
        };

        console.log(`✅ Atualizando: ${detalhes.title}`);
        console.log(`   📦 Peso final: ${dadosAtualizados.peso}`);

        // Atualização PATCH no Firebase
        await axios.patch(getFirebaseUrl(`/jogos/${idJogo}`), dadosAtualizados);
        console.log(`🚀 Sucesso! Nó /jogos/${idJogo} atualizado no Firebase.\n`);

      } catch (errJogo) {
        console.error(`❌ Erro em "${termoBusca}":`, errJogo.response?.data || errJogo.message, '\n');
      }
    }

    console.log(`🎉 VERIFICAÇÃO E EXTRAÇÃO CONCLUÍDAS COM SUCESSO!`);

  } catch (err) {
    console.error(`❌ Erro geral no Firebase:`, err.response?.data || err.message);
  }
}

extrairEAtualizarFirebase();
