import axios from 'axios';
import { google } from 'googleapis';

const BLOG_ID = '2435792559888581201';
const FIREBASE_BASE_URL = 'https://meublog-apks-default-rtdb.firebaseio.com';

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

function gerarDescricaoPesquisaBot(nomeJogo, versao, recursos, ehModMenu) {
  let vBruta = (versao || '1.0').toString().trim();
  let vFormatada = vBruta.toLowerCase().startsWith('v') ? 'V' + vBruta.substring(1) : 'V' + vBruta;

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

async function sincronizarDescricoesSEO() {
  try {
    console.log('📡 Buscando jogos no Firebase para atualizar SEO e versões ocultas...');
    const res = await axios.get(`${FIREBASE_BASE_URL}/jogos.json`);
    const jogos = res.data;

    if (!jogos) {
      console.log('⚠️ Nenhum jogo encontrado no Firebase.');
      return;
    }

    for (const idJogo in jogos) {
      const jogo = jogos[idJogo];

      if (!jogo.blogger_post_id) {
        continue;
      }

      const nomeJogo = jogo.nome || idJogo.replace(/-/g, ' ');
      const recursos = obterRecursosDoJogo(jogo);
      const textoCompleto = `${limparNomeJogo(nomeJogo)} ${recursos.join(' ')}`.toLowerCase();
      const ehModMenu = textoCompleto.includes('mod menu') || textoCompleto.includes('menu');
      
      const novaDescricao = gerarDescricaoPesquisaBot(nomeJogo, jogo.versao, recursos, ehModMenu);
      
      let vBruta = (jogo.versao || '1.0').toString().trim();
      let versaoNovaFormatada = vBruta.toLowerCase().startsWith('v') ? 'V' + vBruta.substring(1) : 'V' + vBruta;
      // Versão minuscula para o span do tema (ex: v1.3.128)
      let versaoMinuscula = vBruta.toLowerCase().startsWith('v') ? vBruta.toLowerCase() : 'v' + vBruta.toLowerCase();

      console.log(`\n🔄 Sincronizando dados para: "${idJogo}" (Versão: ${vBruta})`);

      try {
        const postAtual = await blogger.posts.get({
          blogId: BLOG_ID,
          postId: jogo.blogger_post_id
        });

        let htmlContent = postAtual.data.content || '';

        // 1. Atualização do HTML (Meta Tag Description)
        const metaTagRegex = /<meta\s+name=["']description["']\s+content=["'].*?["']\s*\/?>/i;
        const novaMetaTag = `<meta name="description" content="${novaDescricao}" />`;

        if (metaTagRegex.test(htmlContent)) {
          htmlContent = htmlContent.replace(metaTagRegex, novaMetaTag);
        } else {
          htmlContent = novaMetaTag + '\n' + htmlContent;
        }

        // 2. Atualização da tag oculta do tema (<span id="rawPostVersion"...>v1.3.128</span>)
        const spanVersaoRegex = /(<span\s+id=["']rawPostVersion["'][^>]*>)(.*?)(<\/span>)/i;
        if (spanVersaoRegex.test(htmlContent)) {
          htmlContent = htmlContent.replace(spanVersaoRegex, `$1${versaoMinuscula}$3`);
          console.log(`🏷️ Tag oculta rawPostVersion atualizada para: ${versaoMinuscula}`);
        } else {
          console.log(`⚠️ Tag rawPostVersion não encontrada no HTML deste post.`);
        }

        // 3. Atualização da Caixinha Lateral de Pesquisa (searchDescription)
        let descCaixaAtual = postAtual.data.searchDescription || '';
        let novaDescCaixa = descCaixaAtual;
        const regexVersao = /v\d+(\.\d+)*/gi;

        if (descCaixaAtual) {
          if (regexVersao.test(descCaixaAtual)) {
            novaDescCaixa = descCaixaAtual.replace(regexVersao, versaoNovaFormatada);
          } else {
            novaDescCaixa = `${descCaixaAtual.trim()} ${versaoNovaFormatada}`;
          }
        } else {
          novaDescCaixa = novaDescricao;
        }

        if (novaDescCaixa.length > 150) {
          novaDescCaixa = novaDescCaixa.substring(0, 147) + '...';
        }

        // Atualização completa no Blogger
        await blogger.posts.update({
          blogId: BLOG_ID,
          postId: jogo.blogger_post_id,
          requestBody: {
            title: postAtual.data.title,
            content: htmlContent,
            searchDescription: novaDescCaixa,
            labels: postAtual.data.labels || []
          }
        });

        console.log(`✅ Post atualizado com sucesso (Meta tag + rawPostVersion + Caixinha)!`);

      } catch (errPost) {
        if (errPost.code === 404 || (errPost.message && errPost.message.includes('not found'))) {
          console.warn(`⚠️ Post antigo removido no Blogger. Limpando referência no Firebase...`);
          await axios.patch(`${FIREBASE_BASE_URL}/jogos/${idJogo}.json`, {
            blogger_post_id: null,
            postado_blogger: false,
            post_url: null
          });
        } else {
          console.error(`❌ Erro no post "${idJogo}":`, errPost.message);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n🎉 Sincronização completa concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro geral no robô:', error.message);
  }
}

sincronizarDescricoesSEO();
