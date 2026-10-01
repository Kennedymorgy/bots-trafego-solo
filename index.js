const axios = require('axios');
const { google } = require('googleapis');

const BLOG_ID = '2435792559888581201';
const FIREBASE_BASE_URL = 'https://meublog-apks-default-rtdb.firebaseio.com';

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/blogger'],
});

const blogger = google.blogger({ version: 'v3', auth });

async function verificarEAtualizarPosts() {
  try {
    console.log('🔍 Buscando postagens do Blogger...');
    
    const res = await blogger.posts.list({
      blogId: BLOG_ID,
      maxResults: 50,
      fetchBodies: true
    });

    const posts = res.data.items || [];
    console.log(`📋 Total de posts encontrados: ${posts.length}`);

    for (const post of posts) {
      const htmlContent = post.content || '';

      const matchInput = htmlContent.match(/id=["']realDownloadLink["'].*?value=["']([^"']+)["']/i);
      if (!matchInput) continue;

      const linkWorker = matchInput[1];
      const url = new URL(linkWorker);
      const idJogo = url.searchParams.get('id');

      if (!idJogo) continue;

      try {
        const fbRes = await axios.get(`${FIREBASE_BASE_URL}/jogos/${idJogo}/versao.json`);
        const versaoFirebase = fbRes.data;

        if (!versaoFirebase) continue;

        let vFormatada = versaoFirebase.toString().trim();
        if (!vFormatada.toLowerCase().startsWith('v')) {
          vFormatada = 'v' + vFormatada;
        }

        const tituloAtual = post.title;
        const regexVersao = /v?\d+(\.\d+)+/gi;

        if (regexVersao.test(tituloAtual)) {
          const novoTitulo = tituloAtual.replace(regexVersao, vFormatada);

          if (novoTitulo !== tituloAtual) {
            console.log(`🚀 Atualizando post: "${tituloAtual}" ➡️ "${novoTitulo}"`);

            await blogger.posts.patch({
              blogId: BLOG_ID,
              postId: post.id,
              requestBody: {
                title: novoTitulo
              }
            });

            console.log(`✅ Post do jogo "${idJogo}" atualizado com sucesso no painel!`);
          } else {
            console.log(`ℹ️ O jogo "${idJogo}" já está na versão mais atual (${vFormatada}).`);
          }
        }
      } catch (errFb) {
        console.error(`⚠️ Erro ao consultar Firebase para ${idJogo}:`, errFb.message);
      }
    }
  } catch (err) {
    console.error('❌ Erro no script de atualização:', err);
    process.exit(1);
  }
}

verificarEAtualizarPosts();
