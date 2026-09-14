import os
import requests
import xml.etree.ElementTree as ET

# Configurações reais do seu blog
HOST = "k-404modapk.blogspot.com"
INDEXNOW_KEY = os.environ.get("INDEXNOW_KEY", "4a8b1c2d3e4f5a6b7c8d9e0f1a2b3c4d")

def obter_urls_do_sitemap():
    """Busca todas as URLs reais de posts publicados no seu Blogger."""
    urls = [f"https://{HOST}/"]
    sitemap_url = f"https://{HOST}/sitemap.xml"
    
    try:
        res = requests.get(sitemap_url, timeout=15)
        if res.status_code == 200:
            root = ET.fromstring(res.content)
            ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            for loc in root.findall('.//s:loc', ns):
                if loc.text and loc.text not in urls:
                    urls.append(loc.text)
            print(f"📦 Sucesso! {len(urls)} URLs reais encontradas no seu site.")
    except Exception as e:
        print(f"⚠️ Erro ao ler sitemap do blog: {e}")
        
    return urls

def enviar_indexnow(urls):
    """Envia as URLs direto para a API do IndexNow (Bing, Yandex e Yahoo)."""
    endpoint = "https://api.indexnow.org/indexnow"
    
    payload = {
        "host": HOST,
        "key": INDEXNOW_KEY,
        "keyLocation": f"https://{HOST}/{INDEXNOW_KEY}.txt",
        "urlList": urls
    }
    
    headers = {"Content-Type": "application/json; charset=utf-8"}
    
    try:
        res = requests.post(endpoint, json=payload, headers=headers, timeout=15)
        if res.status_code in [200, 202]:
            print(f"🚀 INDEXNOW SUCESSO! {len(urls)} URLs enviadas para Bing/Yandex.")
        else:
            print(f"❌ Resposta do IndexNow ({res.status_code}): {res.text}")
    except Exception as e:
        print(f"❌ Erro de conexao: {e}")

if __name__ == "__main__":
    lista_urls = obter_urls_do_sitemap()
    if lista_urls:
        enviar_indexnow(lista_urls)
