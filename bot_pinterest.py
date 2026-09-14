import os
import requests
import xml.etree.ElementTree as ET

# Configurações do seu blog
HOST = "k-404modapk.blogspot.com"
PINTEREST_ACCESS_TOKEN = os.environ.get("PINTEREST_ACCESS_TOKEN", "")

def obter_board_id_automatico(headers):
    """Busca automaticamente a primeira pasta (Board) criada na sua conta do Pinterest."""
    try:
        res = requests.get("https://api.pinterest.com/v5/boards", headers=headers, timeout=15)
        if res.status_code == 200:
            dados = res.json()
            items = dados.get("items", [])
            if items:
                board = items[0]
                print(f"🎯 Pasta encontrada automaticamente: '{board['name']}' (ID: {board['id']})")
                return board['id']
            else:
                print("⚠️ Nenhuma pasta encontrada na sua conta do Pinterest. Crie uma pasta primeiro!")
        else:
            print(f"❌ Erro ao buscar pastas ({res.status_code}): {res.text}")
    except Exception as e:
        print(f"❌ Falha ao conectar na API do Pinterest: {e}")
    return None

def extrair_dados_sitemap():
    """Busca o post mais recente do seu sitemap."""
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
                    nome_jogo = url.split("/")[-1].replace(".html", "").replace("-", " ").title()
                    posts.append({
                        "url": url,
                        "titulo": f"Download {nome_jogo} MOD APK",
                        "descricao": f"Baixe {nome_jogo} MOD APK atualizado com dinheiro infinito e link direto no site!"
                    })
    except Exception as e:
        print(f"⚠️ Erro ao ler sitemap: {e}")
        
    return posts

def publicar_pin_pinterest(post):
    """Publica o Pin oficial no seu Pinterest."""
    if not PINTEREST_ACCESS_TOKEN:
        print("ℹ️ Token do Pinterest nao encontrado. Cadastre o PINTEREST_ACCESS_TOKEN nos Secrets do GitHub.")
        return

    headers = {
        "Authorization": f"Bearer {PINTEREST_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    # Busca a pasta automaticamente
    board_id = obter_board_id_automatico(headers)
    if not board_id:
        print("❌ Impossivel publicar Pin sem um Board ID valido.")
        return

    endpoint = "https://api.pinterest.com/v5/pins"
    payload = {
        "board_id": board_id,
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
            print(f"🚀 PIN PUBLICADO COM SUCESSO! Titulo: {post['titulo']}")
        else:
            print(f"❌ Erro ao criar Pin ({res.status_code}): {res.text}")
    except Exception as e:
        print(f"❌ Erro de conexao com Pinterest: {e}")

if __name__ == "__main__":
    lista_posts = extrair_dados_sitemap()
    if lista_posts:
        publicar_pin_pinterest(lista_posts[0])
