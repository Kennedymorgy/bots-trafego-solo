import os
import re
import requests

# Configurações do Blog e Secrets do GitHub
BLOG_HOST = "k-404modapk.blogspot.com"
FEED_URL = f"https://{BLOG_HOST}/feeds/posts/default?alt=json"

PINTEREST_TOKEN = os.getenv("PINTEREST_ACCESS_TOKEN")
PINTEREST_BOARD_ID = os.getenv("PINTEREST_BOARD_ID")

def buscar_ultimo_post():
    """Busca o ultimo post publicado no blog com titulo, link e imagem em alta qualidade."""
    print("📰 Conectando ao feed do blog para extrair novidades...")
    try:
        res = requests.get(FEED_URL, timeout=15)
        if res.status_code != 200:
            print(f"❌ Erro ao acessar o feed do blog (Status Code: {res.status_code})")
            return None

        data = res.json()
        entries = data.get("feed", {}).get("entry", [])
        if not entries:
            print("❌ Nenhum artigo encontrado no feed.")
            return None

        post = entries[0]
        titulo = post.get("title", {}).get("$t", "Download MOD APK")

        # Extrai o link direto do post
        link = ""
        for l in post.get("link", []):
            if l.get("rel") == "alternate":
                link = l.get("href")
                break

        # Extrai a imagem da postagem
        imagem_url = None
        
        # 1. Tenta pegar a thumbnail do Blogger e converte para alta resolução (HD)
        if "media$thumbnail" in post:
            thumb = post["media$thumbnail"]["url"]
            imagem_url = re.sub(r'/s\d+(-c)?/', '/w1200-h630-p-k-no-nu/', thumb)
        
        # 2. Se nao tiver thumbnail, busca no conteudo HTML do artigo
        if not imagem_url and "content" in post:
            conteudo = post["content"]["$t"]
            imagens = re.findall(r'src=["\'](https?://[^"\']+\.(?:png|jpg|jpeg|webp))["\']', conteudo, re.IGNORECASE)
            if imagens:
                imagem_url = imagens[0]

        # 3. Fallback: Favicon se nao houver imagens no post
        if not imagem_url:
            imagem_url = f"https://{BLOG_HOST}/favicon.ico"

        nome_limpo = titulo.replace("MOD APK", "").strip()
        descricao = f"Baixe {nome_limpo} MOD APK atualizado com dinheiro infinito e todas as funções liberadas. Link direto e seguro!"

        return {
            "title": titulo[:100],
            "description": descricao[:500],
            "link": link,
            "image_url": imagem_url
        }

    except Exception as e:
        print(f"❌ Exceção ao ler feed do blog: {e}")
        return None

def enviar_pin_pinterest(post):
    """Envia o Pin diretamente para a API v5 do Pinterest."""
    if not PINTEREST_TOKEN:
        print("❌ PINTEREST_ACCESS_TOKEN nao foi encontrado nos Secrets do GitHub.")
        return

    if not PINTEREST_BOARD_ID:
        print("❌ PINTEREST_BOARD_ID nao foi encontrado nos Secrets do GitHub.")
        return

    endpoint = "https://api.pinterest.com/v5/pins"
    headers = {
        "Authorization": f"Bearer {PINTEREST_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "board_id": PINTEREST_BOARD_ID,
        "title": post["title"],
        "description": post["description"],
        "link": post["link"],
        "media_source": {
            "source_type": "image_url",
            "url": post["image_url"]
        }
    }

    print(f"📌 Enviando Pin: '{post['title']}'...")
    print(f"🎯 Pasta ID Target: {PINTEREST_BOARD_ID}")
    print(f"🖼️ Imagem Target: {post['image_url']}")

    try:
        res = requests.post(endpoint, json=payload, headers=headers, timeout=20)
        
        if res.status_code in [200, 201]:
            dados = res.json()
            pin_id = dados.get("id", "N/A")
            print(f"🚀 SUCCESS: PIN PUBLICADO COM SUCESSO NO PINTEREST! (ID: {pin_id})")
        else:
            print(f"❌ ERRO API PINTEREST ({res.status_code}): {res.text}")

    except Exception as e:
        print(f"❌ Exceção ao enviar Pin para o Pinterest: {e}")

if __name__ == "__main__":
    post = buscar_ultimo_post()
    if post:
        enviar_pin_pinterest(post)
    else:
        print("❌ Execucao finalizada sem postagens válidas.")
