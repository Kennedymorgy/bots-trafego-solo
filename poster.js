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

// Remove repetições de MOD e garante espaçamento correto
function limparNomeJogo(nome) {
  if (!nome) return '';
  return nome
    .toString()
    .replace(/MOD\s*(APK|MENU)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

// Trata os Recursos do Jogo
function obterRecursosDoJogo(jogo) {
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

// Define Marcadores Sem Repetição
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

// Gerador de Título com Espaço Corrigido
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

// Chamada para API com fallback de modelos estáveis
async function chamarGeminiComFallbackModelos(prompt) {
  const rawKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || '';
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

  if (!apiKey) {
    console.log('⚠️ Secret GEMINI_API_KEY não encontrada no GitHub Secrets!');
    return null;
  }

  // Lista de modelos padrão estáveis da API do Gemini
  const modelos = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro'
  ];

  for (const modelo of modelos) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
      const res = await axios.post(
        url,
        { contents: [{ parts: [{ text: prompt }] }] },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      const texto = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (texto) {
        console.log(`✨ IA respondeu via modelo: ${modelo}`);
        return texto;
      }
    } catch (err) {
      const status = err.response?.status || 'Erro';
      console.log(`⚠️️ Modelo "${modelo}" indisponível (${status}). Tentando próximo...`);
    }
  }

  return null;
}

// Descrição de Pesquisa (SEO)
async function gerarDescricaoPesquisaComIA(nomeJogo, versao, recursos, ehModMenu) {
  let vFormatada = (versao || '').toString().trim();
  if (vFormatada && !vFormatada.toLowerCase().startsWith('v')) {
    vFormatada = 'v' + vFormatada;
  }

  const nomeLimpo = limparNomeJogo(nomeJogo);
  const tagMod = ehModMenu ? 'MOD MENU' : 'MOD APK';

  const prompt = `Crie uma Meta Descrição SEO com no máximo 145 caracteres para "${nomeLimpo}" ${tagMod} ${vFormatada}.`;

  const respostaIA = await chamarGeminiComFallbackModelos(prompt);

  if (respostaIA) {
    let textoDesc = respostaIA.replace(/[\r\n"']/g, '').replace(/\s+/g, ' ').trim();
    if (textoDesc.length > 150) {
      textoDesc = textoDesc.substring(0, 147) + '...';
    }
    return textoDesc;
  }

  // Bot Fallback (Sem IA)
  console.log('🤖 Gerando Descrição SEO via Bot...');
  const funcoesStr = recursos.slice(0, 2).join(' e ');
  let fallback = `Baixar ${nomeLimpo} ${tagMod} ${vFormatada} com ${funcoesStr} para Android. Download grátis e seguro!`;
  fallback = fallback.replace(/\s+/g, ' ').trim();
  if (fallback.length > 150) {
    fallback = fallback.substring(0, 147) + '...';
  }
  return fallback;
}

// Bloco SEO de Conteúdo
async function gerarConteudoSEOComIA(nomeJogo, peso, recursos) {
  const nomeLimpo = limparNomeJogo(nomeJogo);

  const prompt = `Gere um bloco HTML <div class="seo-content-box"> simples e direto para o jogo "${nomeLimpo}" no Android.
Tamanho: ${peso}
Recursos: ${recursos.join(', ')}`;

  const respostaIA = await chamarGeminiComFallbackModelos(prompt);

  if (respostaIA) {
    return respostaIA.replace(/```html/gi, '').replace(/```/g, '').trim();
  }

  // Bot Fallback (Sem IA) - Estrutura Dinâmica e Automatizada
  console.log('🤖 Gerando Conteúdo SEO via Bot...');
  return gerarSEOTextoFallback(nomeLimpo, peso, recursos);
}

// Gerador Automático Local (Bot)
function gerarSEOTextoFallback(nomeJogo, peso, recursos) {
  const nomeLimpo = limparNomeJogo(nomeJogo);
  
  const listaRecursosFormatada = recursos.map(rec => {
    return `<li><strong>${rec}:</strong> Recurso totalmente desbloqueado para garantir a melhor experiência no jogo.</li>`;
  }).join('\n');

  return `<div class="seo-content-box">

<h2>Sobre o ${nomeLimpo} MOD APK <span class="cyanPostVersionDisplay"></span></h2>
<p>Se você procura a versão mais recente e otimizada do <strong>${nomeLimpo} MOD APK</strong> para Android, está no lugar certo. Esta modificação melhora o desempenho e libera opções para uma experiência completa no seu dispositivo.</p>
<p>Aproveite todas as vantagens e recursos exclusivos totalmente liberados para o seu celular.</p>

<div class="seo-alert-box">
<strong>Dica de Instalação:</strong> Certifique-se de desinstalar qualquer versão anterior do ${nomeLimpo} antes de instalar esta modificação para evitar erros de conflito.
</div>

<h2>Principais Recursos do Mod Menu</h2>
<p>Confira as vantagens ativas nesta versão modificada do ${nomeLimpo}:</p>
<ul>
${listaRecursosFormatada}
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

async function construirHTMLPost(jogo, idJogo, recursos) {
  const nomeJogo = jogo.nome || idJogo.replace(/-/g, ' ');
  const nomeLimpo = limparNomeJogo(nomeJogo);
  const capa = jogo.foto || '';
  const playstore = jogo.playstore_link || '';
  const downloadLink = `${WORKER_BASE}?id=${idJogo}`;
  const peso = jogo.peso || 'Varia com o dispositivo';
  const screenshots = jogo.screenshots || [];

  const blocoSEO = await gerarConteudoSEOComIA(nomeLimpo, peso, recursos);

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
      console.log('⚠️ Nenhum jogo encontrado no Firebase.');
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

      const descricaoPesquisa = await gerarDescricaoPesquisaComIA(nomeJogo, jogo.versao, recursos, ehModMenu);

      const htmlPost = await construirHTMLPost(jogo, idJogo, recursos);

      try {
        let response;

        if (jogo.blogger_post_id) {
          try {
            console.log(`🔄 Atualizando post existente no Blogger (ID: ${jogo.blogger_post_id})...`);
            response = await blogger.posts.update({
              blogId: BLOG_ID,
              postId: jogo.blogger_post_id,
              requestBody: {
                title: tituloPost,
                content: htmlPost,
                labels: labels,
                searchDescription: descricaoPesquisa
              }
            });
          } catch (errUpdate) {
            const isNotFound = errUpdate.status === 404 ||
                               (errUpdate.response && errUpdate.response.status === 404) ||
                               (errUpdate.message && errUpdate.message.includes('Requested entity was not found'));

            if (isNotFound) {
              console.log(`⚠️ Post ID ${jogo.blogger_post_id} foi APAGADO do Blogger! Criando um NOVO post do zero...`);
              response = await blogger.posts.insert({
                blogId: BLOG_ID,
                requestBody: {
                  title: tituloPost,
                  content: htmlPost,
                  labels: labels,
                  searchDescription: descricaoPesquisa
                }
              });
            } else {
              throw errUpdate;
            }
          }
        } else {
          console.log(`🆕 Criando novo post no Blogger...`);
          response = await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
              title: tituloPost,
              content: htmlPost,
              labels: labels,
              searchDescription: descricaoPesquisa
            }
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
