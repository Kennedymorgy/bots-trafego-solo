import axios from 'axios';
import { google } from 'googleapis';

const BLOG_ID = '2435792559888581201';
const FIREBASE_BASE_URL = 'https://meublog-apks-default-rtdb.firebaseio.com';
const WORKER_BASE = 'https://orange-star-d066.claudiokennedymorgy.workers.dev';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const INPUT_ID_JOGO = process.env.INPUT_ID_JOGO ? process.env.INPUT_ID_JOGO.trim() : '';
const INPUT_FUNCOES_MOD = process.env.INPUT_FUNCOES_MOD ? process.env.INPUT_FUNCOES_MOD.trim() : '';
const INPUT_PESO_MB = process.env.INPUT_PESO_MB ? process.env.INPUT_PESO_MB.trim() : '';

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN,
});

const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

function limparNomeJogo(nome) {
  if (!nome) return '';
  return nome
    .toString()
    .replace(/MOD\s*(APK|MENU)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function obterRecursosDoJogo(jogo) {
  if (jogo.recursos_mod) {
    if (Array.isArray(jogo.recursos_mod) && jogo.recursos_mod.length > 0) {
      return jogo.recursos_mod.map(r => String(r).trim()).filter(r => r !== '');
    }
    if (typeof jogo.recursos_mod === 'string' && jogo.recursos_mod.trim() !== '') {
      return jogo.recursos_mod.split(',').map(r => r.trim()).filter(r => r !== '');
    }
  }
  return ['Mod Menu Atualizado', 'Recursos Ilimitados', 'Sem Anúncios'];
}

function definirMarcadoresInteligentes(nomeJogo, jogo, recursos) {
  const marcadores = new Set();
  const nomeLimpo = limparNomeJogo(nomeJogo);
  const textoCompleto = `${nomeLimpo} ${recursos.join(' ')}`.toLowerCase();

  marcadores.add(nomeLimpo);

  if (jogo.categoria) {
    marcadores.add(jogo.categoria.trim());
  } else {
    marcadores.add('Jogos');
  }

  const temModMenu = textoCompleto.includes('mod menu') || textoCompleto.includes('menu');
  if (temModMenu) {
    marcadores.add('MOD MENU');
  } else {
    marcadores.add('MOD APK');
  }

  const eOnline = ['online', 'multiplayer', 'pvp', 'server'].some(k => textoCompleto.includes(k));
  const eOffline = ['offline', 'sem internet', 'singleplayer'].some(k => textoCompleto.includes(k));

  if (eOnline && eOffline) {
    marcadores.add('Online');
    marcadores.add('Offline');
  } else if (eOnline) {
    marcadores.add('Online');
  } else {
    marcadores.add('Offline');
  }

  return Array.from(marcadores);
}

function gerarTituloInteligente(nomeJogo, versao, recursos, ehModMenu) {
  let vFormatada = (versao || '').toString().trim();
  if (vFormatada && !vFormatada.toLowerCase().startsWith('v')) {
    vFormatada = 'v' + vFormatada;
  }

  const nomeLimpo = limparNomeJogo(nomeJogo);
  const tagMod = ehModMenu ? 'MOD MENU' : 'MOD APK';
  const funcoesTitulo = recursos.slice(0, 10).join(' / ');

  const tituloCru = `${nomeLimpo} ${tagMod} ${vFormatada} (${funcoesTitulo})`;
  return tituloCru.replace(/\s+/g, ' ').trim();
}

function gerarModTagsHTML(recursos) {
  return recursos.map(rec => `  <span class="mod-feature-tag">${rec}</span>`).join('\n');
}

function gerarScreenshotsHTML(screenshots) {
  if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) return '';
  return screenshots.map((screen, idx) => `  <img src="${screen}" alt="Gameplay ${idx + 1}" />`).join('\n');
}

function gerarDescricaoPesquisaBot(nomeJogo, versao, recursos, ehModMenu) {
  let vFormatada = (versao || '').toString().trim();
  if (vFormatada && !vFormatada.toLowerCase().startsWith('v')) {
    vFormatada = 'v' + vFormatada;
  }

  const nomeLimpo = limparNomeJogo(nomeJogo);
  const tagMod = ehModMenu ? 'MOD MENU' : 'MOD APK';
  const funcoesStr = recursos.slice(0, 2).join(' e ');

  let desc = `Baixar ${nomeLimpo} ${tagMod} ${vFormatada} com ${funcoesStr} para Android. Versão atualizada, segura e com download direto!`;
  desc = desc.replace(/\s+/g, ' ').trim();
  if (desc.length > 150) {
    desc = desc.substring(0, 147) + '...';
  }
  return desc;
}

// Bot de SEO Hiper-Inteligente: Adapta 100% o contexto de acordo com o jogo e cada recurso
function interpretarRecursoParaSEO(recurso, nomeJogo) {
  const recLower = recurso.toLowerCase();
  const jogoLower = nomeJogo.toLowerCase();

  // Contexto para jogos de corrida / veículos (NFS, FR Legends, etc.)
  const eCorrida = ['nfs', 'need for speed', 'fr legends', 'asphalt', 'real racing', 'carro', 'corrida'].some(k => jogoLower.includes(k));

  if (recLower.includes('dinheiro') || recLower.includes('ouro') || recLower.includes('coins') || recLower.includes('grana') || recLower.includes('gemas')) {
    if (eCorrida) {
      return `Garanta recursos financeiros ilimitados para comprar carros potentes, fazer tunagem completa e adquirir qualquer peça na oficina do ${nomeJogo} sem se preocupar com o preço.`;
    }
    return `Tenha saldo ilimitado para comprar todos os itens, melhorias e desbloqueios da loja do ${nomeJogo} de forma totalmente livre.`;
  }

  if (recLower.includes('compra') || recLower.includes('in-app') || recLower.includes('gratuita')) {
    return `Sistema de pagamentos interno modificado para você adquirir pacotes e itens premium totalmente de graça, sem gastar dinheiro real.`;
  }

  if (recLower.includes('carro') || recLower.includes('veículo')) {
    return `Todos os carros, modelos e veículos do ${nomeJogo} já vêm completamente desbloqueados e disponíveis na garagem desde o primeiro acesso.`;
  }

  if (recLower.includes('mapa') || recLower.includes('pista') || recLower.includes('fase') || recLower.includes('mundo')) {
    return `Todas as pistas, mapas e fases do ${nomeJogo} estão abertas para você explorar e competir sem restrições ou bloqueios de progresso.`;
  }

  if (recLower.includes('anúncio') || recLower.includes('ads') || recLower.includes('sem anúncios')) {
    return `Anúncios chatos e pop-ups removidos por completo, permitindo que você jogue ${nomeJogo} com máxima fluidez e foco total na diversão.`;
  }

  if (recLower.includes('menu') || recLower.includes('mod menu')) {
    return `Painel flutuante exclusivo integrado ao ${nomeJogo}, permitindo ativar e desativar várias vantagens diretamente na tela durante as partidas.`;
  }

  if (recLower.includes('munição') || recLower.includes('tiro') || recLower.includes('arma')) {
    return `Munição infinita e armamento liberado para dominar os confrontos sem risco de ficar desarmado no ${nomeJogo}.`;
  }

  if (recLower.includes('vida') || recLower.includes('imortal') || recLower.includes('god mode') || recLower.includes('energia')) {
    return `Modo imortal e energia infinita ativados para garantir que seu personagem suporte qualquer dano ou obstáculo no ${nomeJogo}.`;
  }

  if (recLower.includes('desbloqueado') || recLower.includes('all unlocked')) {
    return `Conteúdo premium totalmente liberado para você aproveitar tudo que o ${nomeJogo} tem a oferecer sem precisar passar horas jogando para desbloquear.`;
  }

  // Fallback inteligente customizado para qualquer outro mod específico
  return `Vantagem exclusiva de "${recurso}" aplicada de forma otimizada para turbinar sua gameplay em ${nomeJogo}.`;
}

function gerarConteudoSEOBot(nomeJogo, peso, recursos, ehModMenu) {
  const nomeLimpo = limparNomeJogo(nomeJogo);
  const tipoModStr = ehModMenu ? 'Mod Menu' : 'Mod APK';

  const listaRecursosFormatada = recursos.map(rec => {
    const explicacao = interpretarRecursoParaSEO(rec, nomeLimpo);
    return `<li><strong>${rec}:</strong> ${explicacao}</li>`;
  }).join('\n');

  return `<div class="seo-content-box">

<h2>Sobre o ${nomeLimpo} ${tipoModStr} <span class="cyanPostVersionDisplay"></span></h2>
<p>Procurando a versão mais recente e otimizada do <strong>${nomeLimpo} ${tipoModStr}</strong> para Android? Aqui você baixa com segurança, velocidade e total estabilidade. Esta modificação aprimora o desempenho do jogo e remove barreiras chatas para elevar sua experiência.</p>
<p>Aproveite gráficos ajustados, comandos otimizados e recursos exclusivos liberados para curtir o ${nomeLimpo} ao máximo no seu smartphone.</p>

<div class="seo-alert-box">
<strong>Dica de Instalação:</strong> Para evitar conflitos ou erros de pacote no ${nomeLimpo}, lembre-se de desinstalar qualquer versão anterior que esteja instalada no seu celular antes de aplicar este update.
</div>

<h2>Principais Recursos do ${tipoModStr}</h2>
<p>Veja em detalhes o que foi modificado e otimizado nesta versão do ${nomeLimpo}:</p>
<ul>
${listaRecursosFormatada}
</ul>

<h2>Requisitos e Como Instalar no Android</h2>
<p>O arquivo APK pesa aproximadamente <strong>${peso}</strong> e foi testado para rodar perfeitamente em dispositivos com Android 5.0 ou superior. Siga o passo a passo para instalar:</p>
<ol>
<li>Toque no botão de download localizado acima para baixar o arquivo atualizado.</li>
<li>Permita a instalação nas configurações do seu celular ativando a opção de <em>Fontes Desconhecidas</em>, caso solicitado.</li>
<li>Abra o arquivo baixado, conclua a instalação e divirta-se sem limites!</li>
</ol>

<h2>Perguntas Frequentes (FAQ)</h2>
<p><strong>É necessário ter Root no Android para jogar o ${nomeLimpo}?</strong><br/>
Não! O jogo roda perfeitamente em aparelhos padrão sem necessidade de root.</p>

<p><strong>Como recebo novas atualizações do ${nomeLimpo}?</strong><br/>
Salve o nosso site nos favoritos do seu navegador para retornar e baixar novas versões sempre que forem lançadas.</p>

</div>`;
}

async function construirHTMLPost(jogo, idJogo, recursos) {
  const nomeJogo = jogo.nome || idJogo.replace(/-/g, ' ');
  const nomeLimpo = limparNomeJogo(nomeJogo);
  const capa = jogo.foto || '';
  const playstore = jogo.playstore_link || '';
  const downloadLink = `${WORKER_BASE}?id=${idJogo}`;
  const peso = jogo.peso || 'Varia com o dispositivo';
  const screenshots = jogo.screenshots || [];

  const labelsTemp = definirMarcadoresInteligentes(nomeJogo, jogo, recursos);
  const ehModMenu = labelsTemp.includes('MOD MENU');

  const blocoSEO = gerarConteudoSEOBot(nomeLimpo, peso, recursos, ehModMenu);

  return `<!--more-->
<!-- ======================================================== -->
<!-- 1. DADOS OCULTOS LIDOS AUTOMATICAMENTE PELO TEMA         -->
<!-- ======================================================== -->

<span id="cyanPostName" style="display:none;">${nomeLimpo}</span>

<div class="post-cover-wrapper" style="display:none;">
  <img src="${capa}" alt="${nomeLimpo} Mod APK" />
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
${blocoSEO}`;
}

async function executarPostagem() {
  try {
    if (INPUT_ID_JOGO) {
      console.log(`📝 Dados recebidos na execução para o ID: "${INPUT_ID_JOGO}"`);
      const updateData = {};

      if (INPUT_FUNCOES_MOD) {
        updateData.recursos_mod = INPUT_FUNCOES_MOD.split(',').map(f => f.trim()).filter(f => f.length > 0);
      }
      if (INPUT_PESO_MB) {
        updateData.peso = INPUT_PESO_MB;
      }
      updateData.postado_blogger = false;

      console.log(`📡 Salvando novas funções e peso no Firebase para "${INPUT_ID_JOGO}"...`);
      await axios.patch(`${FIREBASE_BASE_URL}/jogos/${INPUT_ID_JOGO}.json`, updateData);
      console.log(`✅ Firebase atualizado com sucesso!`);
    }

    console.log('📡 Buscando lista de jogos no Firebase...');
    const res = await axios.get(`${FIREBASE_BASE_URL}/jogos.json`);
    const jogos = res.data;

    if (!jogos) {
      console.log('⚠️️ Nenhum jogo encontrado no Firebase.');
      return;
    }

    for (const idJogo in jogos) {
      const jogo = jogos[idJogo];

      if (INPUT_ID_JOGO && idJogo !== INPUT_ID_JOGO) {
        continue;
      }

      if (jogo.postado_blogger) {
        console.log(`⏭ Jogo "${idJogo}" já foi postado. Pulando...`);
        continue;
      }

      const nomeJogo = jogo.nome || idJogo.replace(/-/g, ' ');
      console.log(`\n🤖 Processando postagem para: "${idJogo}"...`);

      const recursos = obterRecursosDoJogo(jogo);
      const labels = definirMarcadoresInteligentes(nomeJogo, jogo, recursos);
      const ehModMenu = labels.includes('MOD MENU');
      const tituloPost = gerarTituloInteligente(nomeJogo, jogo.versao, recursos, ehModMenu);

      const descricaoPesquisa = gerarDescricaoPesquisaBot(nomeJogo, jogo.versao, recursos, ehModMenu);
      const htmlPost = await construirHTMLPost(jogo, idJogo, recursos);

      // Objeto enviado para a API do Blogger com o campo correto 'searchDescription'
      const postBody = {
        title: tituloPost,
        content: htmlPost,
        labels: labels,
        searchDescription: descricaoPesquisa
      };

      try {
        let response;

        if (jogo.blogger_post_id) {
          try {
            console.log(`🔄 Atualizando post existente no Blogger (ID: ${jogo.blogger_post_id})...`);
            response = await blogger.posts.update({
              blogId: BLOG_ID,
              postId: jogo.blogger_post_id,
              requestBody: postBody
            });
          } catch (errUpdate) {
            const isNotFound = errUpdate.status === 404 ||
                               (errUpdate.response && errUpdate.response.status === 404) ||
                               (errUpdate.message && errUpdate.message.includes('Requested entity was not found'));

            if (isNotFound) {
              console.log(`⚠️️ Post ID ${jogo.blogger_post_id} foi APAGADO do Blogger! Criando um NOVO post do zero...`);
              response = await blogger.posts.insert({
                blogId: BLOG_ID,
                requestBody: postBody
              });
            } else {
              throw errUpdate;
            }
          }
        } else {
          console.log(`🆕 Criando novo post no Blogger...`);
          response = await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: postBody
          });
        }

        const urlPublicada = response.data.url;
        console.log(`🚀 Post Publicado/Atualizado com Sucesso!`);
        console.log(`📌 Título: ${tituloPost}`);
        console.log(`🏷️ Marcadores: ${labels.join(', ')}`);
        console.log(`🔍 Descrição de Pesquisa (SEO): ${descricaoPesquisa}`);
        console.log(`🔗 URL: ${urlPublicada}`);

        await notificarGoogleIndexing(urlPublicada);

        await axios.patch(`${FIREBASE_BASE_URL}/jogos/${idJogo}.json`, {
          postado_blogger: true,
          blogger_post_id: response.data.id,
          post_url: urlPublicada
        });

        console.log(`✅ Marcado como publicado no Firebase.`);

      } catch (errBlogger) {
        if (errBlogger.response && errBlogger.response.status === 429) {
          console.error(`⚠ Cota da API do Blogger atingida (429). Interrompendo temporariamente.`);
          break;
        } else {
          console.error(`❌ Erro ao postar "${idJogo}":`, errBlogger.message);
        }
      }

      console.log('⏳ Aguardando 5 segundos...');
      await sleep(5000);
    }

    console.log('\n🎉 Processo finalizado com sucesso!');

  } catch (error) {
    console.error('❌ Erro geral no robô:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

executarPostagem();
