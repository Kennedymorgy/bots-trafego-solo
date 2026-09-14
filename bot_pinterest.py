import os
import requests
import xml.etree.ElementTree as ET

# Configurações do seu blog
HOST = "k-404modapk.blogspot.com"
PINTEREST_ACCESS_TOKEN = os.environ.get("PINTEREST_ACCESS_TOKEN", "")
BOARD_ID = os.environ.get("PINTEREST_BOARD_ID", "")

def extrair_dados_sitemap():
    """Busca os posts do sitemap para gerar Pins visuais no Pinterest."""
    sitemap_url = f"https://{HOST}/sitemap.xml"
    posts = []
    
    try:
        res = requests.get(sitemap_url, timeout=15)
        if res.status_code == 200:
            root = ET.fromstring(res.content)
            ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            for loc in root.findall('.//s:loc', ns):
                url = loc.text
                if url and ("/p/" in url or ".html" in url):
                    # Extrai um titulo limpo a partir da URL
                    nome_jogo = url.split("/")[-1].replace(".html", "").replace("-", " ").title()
                    posts.append({
                        "url": url,
                        "titulo": f"Download {nome_jogo} MOD APK (Atualizado)",
                        "descricao": f"Baixe {nome_jogo} MOD APK com dinheiro infinito e todas as funções desbloqueadas. Link direto e seguro!"
                    })
            print(f"📌 Encontrados {len(posts)} posts para otimização visual no Pinterest.")
    except Exception as e:
        print(f"⚠️ Erro ao ler sitemap: {e}")
        
    return posts

def publicar_pin_pinterest(post):
    """Envia o Pin para a API do Pinterest com o link direto do seu site."""
    if not PINTEREST_ACCESS_TOKEN or not BOARD_ID:
        print("ℹ️ Modo de Teste: Tokens do Pinterest nao configurados no GitHub Secrets.")
        print(f"📍 Criando Pin simulado: {post['titulo']} -> {post['url']}")
        return

    endpoint = "https://api.pinterest.com/v5/pins"
    headers = {
        "Authorization": f"Bearer {PINTEREST_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "board_id": BOARD_ID,
        "title": post['titulo'],
        "description": post['descricao'],
        "link": post['url'],
        "media_source": {
            "source_type": "image_url",
            "url": f"https://{HOST}/favicon.ico"
        }
    }
    
    try:
        res = requests.post(endpoint, json=payload, headers=headers, timeout=15)
        if res.status_code in [200, 201]:
            print(f"🚀 PIN PUBLICADO COM SUCESSO: {post['titulo']}")
        else:
            print(f"⚠️ Resposta Pinterest ({res.status_code}): {res.text}")
    except Exception as e:
        print(f"❌ Erro ao enviar Pin: {e}")

if __name__ == "__main__":
    lista_posts = extrair_dados_sitemap()
    if lista_posts:
        publicar_pin_pinterest(lista_posts[0])
