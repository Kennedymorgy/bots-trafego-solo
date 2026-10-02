import gplay from 'google-play-scraper';
import axios from 'axios';

// URL do teu Firebase Realtime Database
const FIREBASE_URL = 'https://meublog-apks-default-rtdb.firebaseio.com';

// Simulação de navegação via Samsung S23 5G
const USER_AGENT_S23 = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36';

async function extrairEAtualizarFirebase() {
  try {
    console.log(`📡 Conectando ao Firebase para buscar a lista de jogos...`);
    
    // 1. Lê todos os jogos já cadastrados no teu Firebase
    const res = await axios.get(`${FIREBASE_URL}/jogos.json`);
    const jogosFirebase = res.data;

    if (!jogosFirebase) {
      console.log(`⚠️ Nenhum jogo encontrado no Firebase.`);
      return;
    }

    const idsJogos = Object.keys(jogosFirebase);
    console.log(`📋 Encontrados ${idsJogos.length} jogos no Firebase para atualizar.\n`);

    // 2. Percorre cada jogo dinamicamente
    for (const idJogo of idsJogos) {
      const jogoLocal = jogosFirebase[idJogo];
      
      // Usa o 'nome_playstore' se existir, ou o 'nome', ou ajusta o próprio ID
      const termoBusca = jogoLocal.nome_playstore || jogoLocal.nome || idJogo.replace(/-/g, ' ');

      console.log(`==================================================`);
      console.log(`🔎 Processando ID: "${idJogo}"`);
      console.log(`🔍 Termo de Busca na Play Store: "${termoBusca}"`);
      console.log(`==================================================`);

      try {
        // Busca na Play Store simulando S23 5G
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

        // Correção do ID retornado pela pesquisa
        const packageId = busca[0].id || busca[0].appId;

        // Pega detalhes completos da página do jogo
        const detalhes = await gplay.app({
          appId: packageId,
          country: 'br',
          lang: 'pt'
        });

        // Seleciona de 3 a 4 screenshots em HD
        const screenshotsList = (detalhes.screenshots || []).slice(0, 4);

        // Monta os dados atualizados para merge no Firebase
        const dadosAtualizados = {
          foto: detalhes.icon,                         // Capa / Ícone real HD
          screenshots: screenshotsList,               // 3 a 4 screenshots
          peso: detalhes.size || 'Varia com o dispositivo', // Peso real
          categoria: detalhes.genre || 'Jogos',        // Categoria real
          package_id: detalhes.appId,                  // Package oficial
          playstore_link: detalhes.url,               // Link oficial
          ultima_extracao: new Date().toISOString()
        };

        console.log(`✅ Dados Extraídos:`);
        console.log(`   📛 Jogo Encontrado: ${detalhes.title}`);
        console.log(`   🖼️ Capa HD: ${dadosAtualizados.foto}`);
        console.log(`   📸 Screenshots: ${screenshotsList.length} salvas`);
        console.log(`   📂 Categoria: ${dadosAtualizados.categoria}`);
        console.log(`   📦 Peso: ${dadosAtualizados.peso}`);

        // Atualiza apenas os campos extraídos no mesmo ID sem apagar teus recursos/mod/fatureseo
        await axios.patch(`${FIREBASE_URL}/jogos/${idJogo}.json`, dadosAtualizados);
        console.log(`🚀 Sucesso: Nó /jogos/${idJogo} atualizado no Firebase!\n`);

      } catch (errJogo) {
        console.error(`❌ Erro ao extrair "${termoBusca}":`, errJogo.message, '\n');
      }
    }

    console.log(`🎉 Processo de extração concluído para todos os jogos!`);

  } catch (err) {
    console.error(`❌ Erro geral na conexão com Firebase:`, err.message);
  }
}

extrairEAtualizarFirebase();
