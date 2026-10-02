const axios = require('axios');
const { google } = require('googleapis');

const BLOG_ID = '2435792559888581201';
const FIREBASE_BASE_URL = 'https://meublog-apks-default-rtdb.firebaseio.com';
const WORKER_BASE = 'https://orange-star-d066.claudiokennedymorgy.workers.dev';

// Configuração do OAuth2 do Google para o Blogger
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN,
});

const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

// Função para notificar a Google Indexing API
async function notificarGoogleIndexing(urlPost) {
  try {
    if (!process.env.GOOGLE_INDEXING_CREDENTIALS) {
      console.log('⚠️️ Secret GOOGLE_INDEXING_CREDENTIALS não configurada.');
      return;
    }

    const serviceAccountKey = JSON.parse(process.env.GOOGLE_INDEXING_CREDENTIALS);

    const jwtClient = new google.auth.JWT(
      serviceAccountKey.client_email,
      null,
      serviceAccountKey.private_key,
      ['https://www.googleapis.com/auth/indexing'],
      null
    );

    await jwtClient.authorize();

    const response = await axios.post(
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      {
        url: urlPost,
        type: 'URL_UPDATED',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtClient.credentials.access_token}`,
        },
      }
    );

    console.log(`📡 Google Indexing API notificada para: ${urlPost} (Status: ${response.status})`);
  } catch (err) {
    console.error(`❌ Erro ao notificar Google Indexing API para ${urlPost}:`, err.response ? err.response.data : err.message);
  }
}

// Tratamento dos recursos do Mod (Personalizado vs Automático)
function obterRecursosMod(jogo) {
  if (jogo.recursos_mod) {
    if (Array.isArray(jogo.recursos_mod)) {
      return jogo.recursos_mod;
    }
    if (typeof jogo.recursos_mod === 'string') {
      return jogo.recursos_mod.split(',').map(item => item.trim());
    }
  }
  // Fallback automático caso não tenha preenchido no Firebase
  return [
    'Mod Menu Atualizado',
    'Recursos / Dinheiro Ilimitado',
    'Sem Anúncios (No Ads)',
    'Proteção Anti-Ban Integrada'
  ];
}

function gerarModTagsHTML(recursos) {
  return recursos.map(rec => `  <span class="mod-feature-tag">${rec}</span>`).join('\n');
}

function gerarScreenshotsHTML(screenshots) {
  if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) return '';
  return screenshots.map((screen, idx) => `  <img src="${screen}" alt="Gameplay ${idx + 1}" />`).join('\n');
}

function construirHTMLPost(jogo, idJogo) {
  const nomeJogo = jogo.nome || idJogo.replace(/-/g, ' ');
  const versao = jogo.versao || '';
  const capa = jogo.foto || '';
  const playstore = jogo.playstore_link || '';
  const downloadLink = `${WORKER_BASE}?id=${idJogo}`;
  const peso = jogo.peso || 'Varia com o dispositivo';
  const recursos = obterRecursosMod(jogo);
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
<!-- 2. CONTEUDO VISIVEL OTIMIZADO PARA GOOGLE  -->
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
<p>O arquivo possui <strong>${peso}</strong> e requer Android 5.0 ou superior. Siga os passos:</p>
<ol>
<li>Faça o download do arquivo no botão de download acima.</li>
<li>Ative a opção <em>Fontes Desconhecidas</em> nas configurações do seu celular.</li>
<li>Instale o APK baixado e abra o jogo.</li>
</ol>

<h2>Perguntas Frequentes (FAQ)</h2>
<p><strong>O Mod precisa de Root?</strong><br/>
Não! Funciona perfeitamente em qualquer celular Android sem necessidade de Root.</p>

<p><strong>Como atualizar o jogo no futuro?</strong><br/>
Salve o nosso site nos seus favoritos para baixar as novas atualizações assim que forem lançadas.</p>

</div>`;
}

async function executarPostagem() {
  try {
    console.log('📡 Lendo lista de jogos do Firebase...');
    const res = await axios.get(`${FIREBASE_BASE_URL}/jogos.json`);
    const jogos = res.data;

    if (!jogos) {
      console.log('⚠️ Nenhum jogo encontrado no Firebase.');
      return;
    }

    for (const idJogo in jogos) {
      const jogo = jogos[idJogo];

      // Se o jogo já tiver sido postado no Blogger, ignora para não duplicar
      if (jogo.postado_blogger) {
        console.log(`⏭️ Jogo "${idJogo}" já foi postado no Blogger. Pulando...`);
        continue;
      }

      console.log(`\n📝 Criando novo post no Blogger para: "${idJogo}"...`);
      const htmlPost = construirHTMLPost(jogo, idJogo);
      
      let vFormatada = (jogo.versao || '').toString().trim();
      if (vFormatada && !vFormatada.toLowerCase().startsWith('v')) {
        vFormatada = 'v' + vFormatada;
      }

      const tituloPost = `${jogo.nome || idJogo} MOD APK ${vFormatada} (Mod Menu / Atualizado)`;

      const response = await blogger.posts.insert({
        blogId: BLOG_ID,
        requestBody: {
          title: tituloPost,
          content: htmlPost,
          labels: [jogo.categoria || 'Jogos', 'Android', 'MOD APK']
        }
      });

      const urlPublicada = response.data.url;
      console.log(`🚀 Publicado com sucesso! URL: ${urlPublicada}`);

      // Notifica o Google Indexing API imediatamente após criar o post
      await notificarGoogleIndexing(urlPublicada);

      // Atualiza o Firebase marcando que o post foi criado
      await axios.patch(`${FIREBASE_BASE_URL}/jogos/${idJogo}.json`, {
        postado_blogger: true,
        blogger_post_id: response.data.id,
        post_url: urlPublicada
      });

      console.log(`✅ Firebase atualizado para o jogo "${idJogo}".`);
    }

    console.log('\n🎉 Processo de postagem finalizado!');

  } catch (error) {
    console.error('❌ Erro ao executar postagem:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

executarPostagem();
