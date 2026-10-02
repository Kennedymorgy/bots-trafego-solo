import axios from 'axios';
import { google } from 'googleapis';

const BLOG_ID = '2435792559888581201';
const FIREBASE_BASE_URL = 'https://meublog-apks-default-rtdb.firebaseio.com';
const WORKER_BASE = 'https://orange-star-d066.claudiokennedymorgy.workers.dev';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Configuração do OAuth2 do Google
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN,
});

const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

// Google Indexing API
async function notificarGoogleIndexing(urlPost) {
  try {
    const credsRaw = process.env.GOOGLE_INDEXING_CREDENTIALS || process.env.GOOGLE_INDEXING;
    if (!credsRaw) return;

    const serviceAccountKey = JSON.parse(credsRaw);
    const jwtClient = new google.auth.JWT(
      serviceAccountKey.client_email,
      null,
      serviceAccountKey.private_key,
      ['https://www.googleapis.com/auth/indexing'],
      null
    );

    await jwtClient.authorize();

    await axios.post(
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      { url: urlPost, type: 'URL_UPDATED' },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtClient.credentials.access_token}`,
        },
      }
    );
    console.log(`📡 Google Indexing API notificada: ${urlPost}`);
  } catch (err) {
    console.error(`❌ Erro Google Indexing:`, err.message);
  }
}

// Trata os Recursos da Caixinha salvos no Firebase
function obterRecursosDoFirebase(jogo) {
  if (jogo.recursos_mod) {
    if (Array.isArray(jogo.recursos_mod) && jogo.recursos_mod.length > 0) {
      return jogo.recursos_mod.map(r => String(r).trim()).filter(r => r !== '');
    }
    if (typeof jogo.recursos_mod === 'string' && jogo.recursos_mod.trim() !== '') {
      return jogo.recursos_mod.split(',').map(r => r.trim()).filter(r => r !== '');
    }
  }
  return ['Mod Menu Atualizado', 'Recursos Ilimitados', 'Sem Anúncios', 'Anti-Ban Integrado'];
}

// Analisa e define Marcadores Únicos e Inteligentes
function definirMarcadoresInteligentes(nomeJogo, jogo, recursos) {
  const marcadores = new Set();
  const textoCompleto = `${nomeJogo} ${recursos.join(' ')}`.toLowerCase();

  // 1. Nome do Jogo
  marcadores.add(nomeJogo);

  // 2. Categoria / Gênero
  if (jogo.categoria) {
    marcadores.add(jogo.categoria.trim());
  } else {
    marcadores.add('Jogos');
  }

  // 3. Tipo de MOD (Apenas 1 Principal: MOD MENU ou MOD APK)
  const temModMenu = textoCompleto.includes('mod menu') || textoCompleto.includes('menu');
  if (temModMenu) {
    marcadores.add('MOD MENU');
  } else {
    marcadores.add('MOD APK');
  }

  // 4. Modo de Jogo (Offline ou Online)
  const eOnline = ['online', 'multiplayer', 'pvp', 'server'].some(k => textoCompleto.includes(k));
  const eOffline = ['offline', 'sem internet', 'singleplayer'].some(k => textoCompleto.includes(k));

  if (eOnline && eOffline) {
    marcadores.add('Online');
    marcadores.add('Offline');
  } else if (eOnline) {
    marcadores.add('Online');
  } else {
    marcadores.add('Offline'); // Padrão
  }

  return Array.from(marcadores);
}

// Gerador de Título Otimizado (Até 10 Funções no Título)
function gerarTituloInteligente(nomeJogo, versao, recursos, ehModMenu) {
  let vFormatada = (versao || '').toString().trim();
  if (vFormatada && !vFormatada.toLowerCase().startsWith('v')) {
    vFormatada = 'v' + vFormatada;
  }

  const tagMod = ehModMenu ? 'MOD MENU' : 'MOD APK';
  
  // Pega até 10 funções da caixinha para o título
  const funcoesTitulo = recursos.slice(0, 10).join(' / ');

  return `${nomeJogo} ${tagMod} ${vFormatada} (${funcoesTitulo})`;
}

function gerarModTagsHTML(recursos) {
  return recursos.map(rec => `  <span class="mod-feature-tag">${rec}</span>`).join('\n');
}

function gerarScreenshotsHTML(screenshots) {
  if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) return '';
  return screenshots.map((screen, idx) => `  <img src="${screen}" alt="Gameplay ${idx + 1}" />`).join('\n');
}

function construirHTMLPost(jogo, idJogo, recursos) {
  const nomeJogo = jogo.nome || idJogo.replace(/-/g, ' ');
  const versao = jogo.versao || '';
  const capa = jogo.foto || '';
  const playstore = jogo.playstore_link || '';
  const downloadLink = `${WORKER_BASE}?id=${idJogo}`;
  const peso = jogo.peso || 'Varia com o dispositivo';
  const screenshots = jogo.screenshots || [];

  return `<!--more-->
<!-- ======================================================== -->
<!-- 1. DADOS OCULTOS LIDOS AUTOMATICAMENTE PELO TEMA         -->
<!-- ======================================================== -->

<span id="cyanPostName" style="display:none;">${nomeJogo}</span>

<div class="post-cover-wrapper" style="display:none;">
  <img src="${capa}" alt="${nomeJogo} Mod APK" />
</div>
<span id="rawCoverImage" style="display:none;">${capa}</span>

<span id="rawPlayStoreLink" style="display:none;">${playstore}</span>

<input type="hidden" id="realDownloadLink" value="${downloadLink}" />

<span id="rawAppSize" style="display:none;">${peso}</span>

<!-- Tags de Recursos do Mod -->
<div class="mod-features-wrapper" style="display:none;">
${gerarModTagsHTML(recursos)}
</div>

<!-- Screenshots -->
<div class="raw-screenshots" style="display:none;">
${gerarScreenshotsHTML(screenshots)}
</div>

<!-- ========================================== -->
<!-- 2. CONTEÚDO VISÍVEL OTIMIZADO PARA GOOGLE  -->
<!-- ========================================== -->
<div class="seo-content-box">

<h2>Sobre o ${nomeJogo} MOD APK <span class="cyanPostVersionDisplay">${versao}</span></h2>
<p>Se você procura a versão atualizada do <strong>${nomeJogo} MOD APK</strong> para Android, chegou ao lugar certo. Baixe a versão com Mod Menu ativo e recursos liberados para garantir a melhor experiência de jogo.</p>

<div class="seo-alert-box">
<strong>Dica de Instalação:</strong> Certifique-se de desinstalar qualquer versão anterior do ${nomeJogo} antes de instalar esta modificação para evitar erros de conflito.
</div>

<h2>Principais Recursos do Mod Menu</h2>
<ul>
${recursos.map(rec => `<li><strong>${rec}:</strong> Recursos ativados e funcionais nesta versão.</li>`).join('\n')}
</ul>

<h2>Requisitos e Como Instalar no Android</h2>
<p>O arquivo possui tamanho aproximado de <strong>${peso}</strong> e requer Android 5.0 ou superior. Siga os passos para instalar:</p>
<ol>
<li>Faça o download do arquivo clicando no botão de download acima.</li>
<li>Ative a opção <em>Fontes Desconhecidas</em> nas configurações de segurança do seu celular.</li>
<li>Instale o arquivo APK baixado e divirta-se!</li>
</ol>

<h2>Perguntas Frequentes (FAQ)</h2>
<p><strong>O Mod precisa de Root no celular?</strong><br/>
Não! Funciona perfeitamente em qualquer dispositivo Android sem necessidade de Root.</p>

<p><strong>Como atualizar o jogo no futuro?</strong><br/>
Adicione o nosso site aos seus favoritos para baixar as novas atualizações assim que forem lançadas.</p>

</div>`;
}

async function executarPostagem() {
  try {
    console.log('📡 Buscando lista de jogos no Firebase...');
    const res = await axios.get(`${FIREBASE_BASE_URL}/jogos.json`);
    const jogos = res.data;

    if (!jogos) {
      console.log('⚠️ Nenhum jogo encontrado no Firebase.');
      return;
    }

    for (const idJogo in jogos) {
      const jogo = jogos[idJogo];

      if (jogo.postado_blogger) {
        console.log(`⏭️ Jogo "${idJogo}" já foi postado. Pulando...`);
        continue;
      }

      const nomeJogo = jogo.nome || idJogo.replace(/-/g, ' ');
      console.log(`\n🤖 Processando postagem para o ID Exato: "${idJogo}"...`);

      // 1. Obtém as funções reais vindas da sua caixinha no Firebase
      const recursos = obterRecursosDoFirebase(jogo);

      // 2. Define os marcadores sem repetir tags
      const labels = definirMarcadoresInteligentes(nomeJogo, jogo, recursos);
      const ehModMenu = labels.includes('MOD MENU');

      // 3. Cria o título puxando até 10 funções da caixinha
      const tituloPost = gerarTituloInteligente(nomeJogo, jogo.versao, recursos, ehModMenu);

      // 4. Monta o HTML com tags ocultas e h2
      const htmlPost = construirHTMLPost(jogo, idJogo, recursos);

      try {
        const response = await blogger.posts.insert({
          blogId: BLOG_ID,
          requestBody: {
            title: tituloPost,
            content: htmlPost,
            labels: labels
          }
        });

        const urlPublicada = response.data.url;
        console.log(`🚀 Post Publicado com Sucesso!`);
        console.log(`📌 Título: ${tituloPost}`);
        console.log(`🏷️ Marcadores: ${labels.join(', ')}`);
        console.log(`🔗 URL: ${urlPublicada}`);

        // Indexação no Google
        await notificarGoogleIndexing(urlPublicada);

        // Marca como postado no Firebase
        await axios.patch(`${FIREBASE_BASE_URL}/jogos/${idJogo}.json`, {
          postado_blogger: true,
          blogger_post_id: response.data.id,
          post_url: urlPublicada
        });

        console.log(`✅ Marcado como postado no Firebase para "${idJogo}".`);

      } catch (errBlogger) {
        if (errBlogger.response && errBlogger.response.status === 429) {
          console.error(`⚠️ Cota da API do Blogger atingida (429). Interrompendo execução.`);
          break;
        } else {
          console.error(`❌ Erro ao postar "${idJogo}":`, errBlogger.message);
        }
      }

      console.log('⏳ Aguardando 5 segundos antes da próxima postagem...');
      await sleep(5000);
    }

    console.log('\n🎉 Todas as postagens foram concluídas!');

  } catch (error) {
    console.error('❌ Erro geral no robô:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

executarPostagem();
