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

  // Trava rígida em 150 caracteres para o Google não cortar
  if (desc.length > 150) {
    desc = desc.substring(0, 147) + '...';
  }
  return desc;
}

async function sincronizarDescricoesSEO() {
  try {
    console.log('📡 Buscando jogos no Firebase para atualizar descrições de SEO...');
    const res = await axios.get(`${FIREBASE_BASE_URL}/jogos.json`);
    const jogos = res.data;

    if (!jogos) {
      console.log('⚠️ Nenhum jogo encontrado no Firebase.');
      return;
    }

    for (const idJogo in jogos) {
      const jogo = jogos[idJogo];

      if (!jogo.blogger_post_id) {
        continue; // Pula se ainda não foi postado
      }

      const nomeJogo = jogo.nome || idJogo.replace(/-/g, ' ');
      const recursos = obterRecursosDoJogo(jogo);
      const textoCompleto = `${limparNomeJogo(nomeJogo)} ${recursos.join(' ')}`.toLowerCase();
      const ehModMenu = textoCompleto.includes('mod menu') || textoCompleto.includes('menu');
      
      const novaDescricao = gerarDescricaoPesquisaBot(nomeJogo, jogo.versao, recursos, ehModMenu);

      console.log(`\n🔄 Atualizando SEO (Patch) para: "${idJogo}" (Versão: ${jogo.versao || '1.0'})`);

      try {
        // PATCH: Grava diretamente na caixinha de descrição de pesquisa do Blogger
        await blogger.posts.patch({
          blogId: BLOG_ID,
          postId: jogo.blogger_post_id,
          requestBody: {
            searchDescription: novaDescricao
          }
        });

        console.log(`✅ Caixinha de pesquisa preenchida (${novaDescricao.length} caracteres): ${novaDescricao}`);

      } catch (errPost) {
        // Se o post foi apagado do Blogger mas estava salvo no Firebase, limpa o ID automaticamente
        if (errPost.code === 404 || (errPost.message && errPost.message.includes('not found'))) {
          console.warn(`⚠️ Post ID ${jogo.blogger_post_id} não existe mais no Blogger. Limpando referência no Firebase...`);
          await axios.patch(`${FIREBASE_BASE_URL}/jogos/${idJogo}.json`, {
            blogger_post_id: null,
            postado_blogger: false,
            post_url: null
          });
        } else {
          console.error(`❌ Erro ao atualizar o post "${idJogo}":`, errPost.message);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n🎉 Sincronização de SEO concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro geral no robô de SEO:', error.message);
  }
}

sincronizarDescricoesSEO();
