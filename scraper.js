import gplay from 'google-play-scraper';
import axios from 'axios';

// URL do teu Firebase Realtime Database
const FIREBASE_URL = 'https://meublog-apks-default-rtdb.firebaseio.com';

// User-Agent simulando Samsung S23 5G real
const USER_AGENT_S23 = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36';

/**
 * Lista de jogos para extrair por NOME REAL da Play Store.
 * Podes adicionar mais jogos a esta lista quando quiseres!
 */
const JOGOS_PARA_EXTRAIR = [
  {
    nomePlayStore: '8 ball pool',
    idFirebase: '8-ball-pool',
    tipoMod: 'Cheto MOD APK',
    modoConexao: 'Online', // Online, Offline, Online/Offline ou App
    recursosCustom: [
      'Mod Menu',
      'Desenhar Linhas Guia',
      'Ajuste de Espessura da Linha',
      'Modo Jogada Automática (Auto Play / Cheto)',
      'Previsão Após a Tacada',
      'Desativar Anúncios',
      'Ativar Fila Automática de Partidas',
      'Fixar Mesa',
      'Ajuste de Percentual de Aposta'
    ]
  }
];

async function extrairEAtualizarFirebase() {
  for (const item of JOGOS_PARA_EXTRAIR) {
    console.log(`\n==================================================`);
    console.log(`🔎 Buscando jogo: "${item.nomePlayStore}" na Play Store...`);
    console.log(`📱 Simulando acesso via Samsung S23 5G...`);
    console.log(`==================================================`);

    try {
      // 1. Busca pelo nome exato na Play Store simulando celular S23
      const busca = await gplay.search({
        term: item.nomePlayStore,
        num: 1,
        country: 'br',
        lang: 'pt',
        requestOptions: {
          headers: { 'User-Agent': USER_AGENT_S23 }
        }
      });

      if (!busca || busca.length === 0) {
        console.error(`❌ Nenhum jogo encontrado para: ${item.nomePlayStore}`);
        continue;
      }

      const jogoEncontrado = busca[0];

      // 2. Extrai os detalhes completos da página do jogo
      const detalhes = await gplay.app({
        appId: jogoEncontrado.appId,
        country: 'br',
        lang: 'pt'
      });

      // 3. Organiza screenshots (pega as 4 primeiras em alta resolução)
      const screenshotsList = (detalhes.screenshots || []).slice(0, 4);

      // 4. Monta os Marcadores/Tags inteligentes para o Blogger
      const marcadores = [
        detalhes.title,
        detalhes.genre || 'Jogos',
        'Mod APK',
        item.tipoMod,
        item.modoConexao
      ].filter((val, index, self) => val && self.indexOf(val) === index);

      // 5. Estrutura os dados perfeitos para o Firebase
      const dadosOtimizados = {
        nome_oficial: detalhes.title,
        foto: detalhes.icon,                         // Foto REAL do jogo (ícone HD)
        peso: detalhes.size || '178 MB',              // Tamanho real do jogo
        categoria: detalhes.genre || 'Jogos',        // Categoria real
        tipo_mod: item.tipoMod,                      // Ex: Cheto MOD APK, MOD Menu
        modo_conexao: item.modoConexao,              // Online / Offline / App
        playstore_link: detalhes.url,               // Link oficial
        package_id: detalhes.appId,                  // ex: com.miniclip.eightballpool
        recursos_mod: item.recursosCustom,          // Recursos definidos por ti
        screenshots: screenshotsList,              // Capturas de tela reais
        marcadores_sugeridos: marcadores,          // Tags prontas
        extracao_status: 'COMPLETO',
        ultima_atualizacao: new Date().toISOString()
      };

      console.log(`✅ DADOS EXTRAÍDOS COM SUCESSO:`);
      console.log(`   📛 Nome: ${dadosOtimizados.nome_oficial}`);
      console.log(`   🖼️ Foto Real: ${dadosOtimizados.foto}`);
      console.log(`   📂 Categoria: ${dadosOtimizados.categoria}`);
      console.log(`   📦 Peso: ${dadosOtimizados.peso}`);
      console.log(`   📸 Screenshots: ${screenshotsList.length} salvas`);

      // 6. Atualização via PATCH no Firebase sob o ID limpo (ex: 8-ball-pool)
      console.log(`🚀 Atualizando nó /jogos/${item.idFirebase}.json no Firebase...`);
      await axios.patch(`${FIREBASE_URL}/jogos/${item.idFirebase}.json`, dadosOtimizados);

      console.log(`🎉 SUCESSO! O Firebase do ID "${item.idFirebase}" foi atualizado com a foto real e dados completos!`);

    } catch (err) {
      console.error(`❌ Erro ao extrair "${item.nomePlayStore}":`, err.message);
    }
  }
}

extrairEAtualizarFirebase();
