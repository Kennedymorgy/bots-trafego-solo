const gplay = require('google-play-scraper');
const axios = require('axios');

// URL do teu Firebase Realtime Database
const FIREBASE_URL = 'https://meublog-apks-default-rtdb.firebaseio.com';

/**
 * Mapeamento rápido de IDs para Pacotes da Play Store
 * Adiciona aqui os novos jogos conforme fores precisando!
 */
const MAPEAMENTO_JOGOS = {
  '8-ball-pool': {
    packageId: 'com.miniclip.eightballpool',
    tipoMod: 'Cheto MOD APK',
    modoConexao: 'Online',
    recursos: [
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
  },
  'fr-legends': {
    packageId: 'com.fengling.frlegends',
    tipoMod: 'MOD Menu',
    modoConexao: 'Offline',
    recursos: [
      'Dinheiro Infinito',
      'Moedas de Ouro Ilimitadas',
      'Todos os Carros Desbloqueados',
      'Motor Maximizados'
    ]
  },
  'subway-surfers': {
    packageId: 'com.kiloo.subwaysurf',
    tipoMod: 'MOD APK',
    modoConexao: 'Offline',
    recursos: [
      'Moedas Infinitas',
      'Chaves Infinitas',
      'Pulo Infinito',
      'Pranchas Desbloqueadas'
    ]
  }
};

/**
 * Função inteligente para extrair e enriquecer os dados do jogo no Firebase
 */
async function extrairECompletarFirebase(idJogo) {
  const configJogo = MAPEAMENTO_JOGOS[idJogo];

  if (!configJogo) {
    console.error(`❌ ERRO: O ID "${idJogo}" não foi configurado no mapeamento do scraper.js.`);
    return;
  }

  console.log(`\n==================================================`);
  console.log(`🤖 ROBÔ EXTRATOR INICIADO PARA: ${idJogo}`);
  console.log(`📦 Package ID: ${configJogo.packageId}`);
  console.log(`==================================================`);

  try {
    // 1. Busca dados completos na Play Store em PT-BR
    const appData = await gplay.app({ appId: configJogo.packageId, lang: 'pt', country: 'br' });

    // 2. Formata screenshots (pega as 4 primeiras em alta resolução)
    const screenshotsList = (appData.screenshots || []).slice(0, 4);

    // 3. Organiza os Marcadores/Tags inteligentes para o Blogger
    const marcadores = [
      appData.title,
      appData.genre || 'Jogos',
      'Mod APK',
      configJogo.tipoMod,
      configJogo.modoConexao
    ].filter((val, index, self) => val && self.indexOf(val) === index); // Remove duplicados

    // 4. Monta o pacote completo para OTIMIZAR o Firebase
    const dadosOtimizados = {
      nome_oficial: appData.title,
      foto: appData.icon,                          // Foto REAL do jogo (ícone HD)
      peso: appData.size || '178 MB',               // Tamanho do APK
      categoria: appData.genre || 'Jogos',         // Categoria real
      tipo_mod: configJogo.tipoMod,               // Ex: Cheto MOD APK, MOD Menu
      modo_conexao: configJogo.modoConexao,       // Online / Offline / App
      playstore_link: appData.url,                // Link oficial Play Store
      recursos_mod: configJogo.recursos,          // Lista de recursos
      screenshots: screenshotsList,               // Capturas de tela reais
      marcadores_sugeridos: marcadores,           // Tags preparadas
      extracao_status: 'COMPLETO',
      ultima_extracao: new Date().toISOString()
    };

    console.log(`✅ DADOS EXTRAÍDOS COM SUCESSO DA PLAY STORE:`);
    console.log(`   🖼️ Foto Real: ${dadosOtimizados.foto}`);
    console.log(`   📂 Categoria: ${dadosOtimizados.categoria}`);
    console.log(`   📦 Peso: ${dadosOtimizados.peso}`);
    console.log(`   📸 Screenshots: ${screenshotsList.length} salvas`);
    console.log(`   🏷️ Marcadores: ${marcadores.join(', ')}`);

    // 5. Atualização via PATCH para NÃO apagar links ou dados existentes no Firebase
    console.log(`🚀 Atualizando chave /jogos/${idJogo}.json no Firebase...`);
    await axios.patch(`${FIREBASE_URL}/jogos/${idJogo}.json`, dadosOtimizados);

    console.log(`🎉 SUCESSO! O Firebase do jogo "${idJogo}" está 100% completo e enriquecido!`);

  } catch (err) {
    console.error(`❌ ERRO na extração do jogo (${idJogo}):`, err.message);
  }
}

// =========================================================================
// EXECUÇÃO INTELIGENTE (Via parâmetro do terminal ou do GitHub Actions)
// =========================================================================
const idJogoTarget = process.env.ID_JOGO || process.argv[2] || '8-ball-pool';
extrairECompletarFirebase(idJogoTarget);
