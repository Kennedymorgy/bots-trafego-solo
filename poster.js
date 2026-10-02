import axios from 'axios';
import { google } from 'googleapis';

const BLOG_ID = '2435792559888581201';
const FIREBASE_BASE_URL = 'https://meublog-apks-default-rtdb.firebaseio.com';
const WORKER_BASE = 'https://orange-star-d066.claudiokennedymorgy.workers.dev';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Configuração do OAuth2 para o Blogger
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN,
});

const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

// Notificação para Google Indexing API
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
    console.log(`📡 Google Indexing notificada para: ${urlPost}`);
  } catch (err) {
    console.error(`❌ Erro Google Indexing:`, err.message);
  }
}

// Mapeamento Inteligente de Categorias e Modos (Online / Offline)
function analisarModoEGrupo(nomeJogo, categoriaFirebase) {
  const nomeLower = (nomeJogo || '').toLowerCase();
  
  // Identificação de Jogos Online
  const jogosOnline = ['8 ball pool', 'clash of clans', 'free fire', 'roblox', 'avakin life', 'eFootball', 'brawl stars', 'pubg'];
  const eOnline = jogosOnline.some(j => nomeLower.includes(j));
  const modoJogo = eOnline ? 'Online' : 'Offline';

  // Identificação de Categoria
  let categoria = categoriaFirebase || 'Jogos';
  if (nomeLower.includes('fr legends') || nomeLower.includes('racing') || nomeLower.includes('car')) categoria = 'Corrida';
  else if (nomeLower.includes('pool') || nomeLower.includes('football') || nomeLower.includes('soccer')) categoria = 'Esportes';
  else if (nomeLower.includes('clash') || nomeLower.includes('strategy')) categoria = 'Estratégia';
  else if (nomeLower.includes('tekken') || nomeLower.includes('fight') || nomeLower.includes('naruto')) categoria = 'Luta';
  else if (nomeLower.includes('subway') || nomeLower.includes('run')) categoria = 'Ação';

  return { modoJogo, categoria };
}

// Extração Inteligente de Recursos do MOD por Jogo
function obterRecursosInteligentes(jogo, nomeJogo) {
  // 1. Se já existirem recursos específicos cadastrados no Firebase para o jogo
  if (jogo.recursos_mod) {
    if (Array.isArray(jogo.recursos_mod) && jogo.recursos_mod.length > 0) {
      return jogo.recursos_mod;
    }
    if (typeof jogo.recursos_mod === 'string' && jogo.recursos_mod.trim() !== '') {
      return jogo.recursos_mod.split(',').map(s => s.trim());
    }
  }

  // 2. Análise inteligente por nome de jogo caso o Firebase não tenha o campo
  const n = (nomeJogo || '').toLowerCase();

  if (n.includes('fr legends')) {
    return ['Dinheiro Ilimitado / Infinite Money', 'Todos os Carros Desbloqueados', 'Pistas Liberadas', 'Mod Menu Ativo'];
  }
  if (n.includes('8 ball pool')) {
    return ['Linha Guia Longa (Mira Estendida)', 'Anti-Ban Integrado', 'Sem Anúncios', 'Mod Menu Atualizado'];
  }
  if (n.includes('subway surfers')) {
    return ['Chaves e Moedas Ilimitadas', 'Pulo Infinito (Multi-Jump)', 'Todos os Personagens Liberados', 'Pranchas Desbloqueadas'];
  }
  if (n.includes('football league') || n.includes('soccer')) {
    return ['Jogadores e Times Desbloqueados', 'Sem Anúncios', 'Recursos Ilimitados', 'Mod Menu Funcional'];
  }
  if (n.includes('clash of clans')) {
    return ['Gemas e Ouro Ilimitados', 'Servidor Privado / Private Server', 'Elixir Infinito', 'Comandos do Mod Ativos'];
  }
  if (n.includes('avakin life')) {
    return ['Mod Menu Ativo', 'Roupas / Itens Visíveis Unlocked', 'XP Booster', 'Anti-Ban Atualizado'];
  }

  // Fallback com visual limpo
  return [
    'Mod Menu com Funções Ativas',
    'Recursos / Dinheiro Ilimitado',
    'Sem Anúncios (No Ads)',
    'Proteção Anti-Ban Integrada'
  ];
}

// Gerador de Título Otimizado e Humanizado
function gerarTituloInteligente(nomeJogo, versao, recursos) {
  let vFormatada = (versao || '').toString().trim();
  if (vFormatada && !vFormatada.toLowerCase().startsWith('v')) {
    vFormatada = 'v' + vFormatada;
  }

  const destaqueMod = recursos[0] || 'Mod Menu';
  const segundoDestaque = recursos[1] || 'Atualizado';

  return `${nomeJogo} MOD APK ${vFormatada} (${destaqueMod} / ${segundoDestaque})`;
}

function gerarModTagsHTML(recursos) {
  return recursos.map(rec => `  <span class="mod-feature-tag">${rec}</span>`).join('\n');
}

function gerarScreenshotsHTML(screenshots) {
  if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) return '';
  return screenshots.map((screen, idx) => `  <img src="${screen}" alt="Gameplay ${idx + 1}" />`).join('\n');
}

function construirHTMLPost(jogo, idJogo, recursos, modoJogo, categoria) {
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
<p>Baixe agora a versão mais recente do <strong>${nomeJogo} MOD APK</strong> totalmente atualizada para Android. Esta modificação conta com recursos exclusivos, desempenho otimizado e jogabilidade (${modoJogo}) liberada.</p>

<div class="seo-alert-box">
<strong>Dica Importante:</strong> Caso tenha a versão original instalada, desinstale-a antes de realizar a instalação deste arquivo MOD para garantir o funcionamento correto.
</div>

<h2>Destaques do Mod Menu</h2>
<ul>
${recursos.map(rec => `<li><strong>${rec}:</strong> Recurso ativo e totalmente funcional.</li>`).join('\n')}
</ul>

<h2>Informações Técnicas & Como Instalar</h2>
<p>O aplicativo pesa cerca de <strong>${peso}</strong>, roda em modo <strong>${modoJogo}</strong> e é compatível com Android 5.0 ou superior.</p>
<ol>
<li>Clique no botão de download acima para baixar o arquivo APK.</li>
<li>Permita a instalação de <em>Fontes Desconhecidas</em> nas configurações do dispositivo.</li>
<li>Abra o instalador, conclua a instalação e aproveite o jogo!</li>
</ol>

<h2>Perguntas Frequentes</h2>
<p><strong>É necessário acesso Root?</strong><br/>
Não. O jogo funciona perfeitamente em dispositivos padrão sem Root.</p>

<p><strong>Como receber novas atualizações?</strong><br/>
Guarde o nosso site nos seus favoritos para baixar novas versões assim que forem lançadas!</p>

</div>`;
}

async function executarPostagem() {
  try {
    console.log('📡 Buscando lista de jogos no Firebase...');
    const res = await axios.get(`${FIREBASE_BASE_URL}/jogos.json`);
    const jogos = res.data;

    if (!jogos) {
      console.log('⚠️ Nenhum jogo pendente para postagem.');
      return;
    }

    for (const idJogo in jogos) {
      const jogo = jogos[idJogo];

      if (jogo.postado_blogger) {
        console.log(`⏭️ Jogo "${idJogo}" já foi postado. Pulando...`);
        continue;
      }

      const nomeJogo = jogo.nome || idJogo.replace(/-/g, ' ');
      console.log(`\n🤖 Processando postagem inteligente para: "${nomeJogo}"...`);

      // 1. Análise de Categoria e Modo de Jogo
      const { modoJogo, categoria } = analisarModoEGrupo(nomeJogo, jogo.categoria);

      // 2. Extração Dinâmica de Recursos do Mod
      const recursos = obterRecursosInteligentes(jogo, nomeJogo);

      // 3. Geração do Título SEO
      const tituloPost = gerarTituloInteligente(nomeJogo, jogo.versao, recursos);

      // 4. Criação Dinâmica de Marcadores (Labels)
      const marcadoresSet = new Set([
        nomeJogo,
        categoria,
        modoJogo,
        'MOD APK',
        'Mod Menu',
        'Android'
      ]);
      const labels = Array.from(marcadoresSet);

      // 5. Construção do HTML do Post
      const htmlPost = construirHTMLPost(jogo, idJogo, recursos, modoJogo, categoria);

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
        console.log(`🚀 Post Criado com Sucesso!`);
        console.log(`📌 Título: ${tituloPost}`);
        console.log(`🏷️ Marcadores: ${labels.join(', ')}`);
        console.log(`🔗 URL: ${urlPublicada}`);

        // 6. Indexação no Google
        await notificarGoogleIndexing(urlPublicada);

        // 7. Atualização no Firebase
        await axios.patch(`${FIREBASE_BASE_URL}/jogos/${idJogo}.json`, {
          postado_blogger: true,
          blogger_post_id: response.data.id,
          post_url: urlPublicada
        });

        console.log(`✅ Registro salvo no Firebase para "${idJogo}".`);

      } catch (errBlogger) {
        if (errBlogger.response && errBlogger.response.status === 429) {
          console.error(`⚠️ Cota da API do Blogger atingida (429). Interrompendo execução temporariamente.`);
          break;
        } else {
          console.error(`❌ Erro ao postar "${idJogo}":`, errBlogger.message);
        }
      }

      console.log('⏳ Aguardando 5 segundos antes da próxima postagem...');
      await sleep(5000);
    }

    console.log('\n🎉 Todas as postagens foram finalizadas com sucesso!');

  } catch (error) {
    console.error('❌ Erro geral no robô de postagem:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

executarPostagem();
