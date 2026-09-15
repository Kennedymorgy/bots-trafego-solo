import os
import re
import json
import requests
import xml.etree.ElementTree as ET

# Configurações Globais do Blog
BLOG_HOST = "k-404modapk.blogspot.com"
FEED_URL = f"https://{BLOG_HOST}/feeds/posts/default?alt=json"
CACHE_FILE = "ultimo_post_sindicado.json"

# Serviços de Indexação Instantânea e Agregadores Reais
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
PINGOMATIC_URL = "http://rpc.pingomatic.com/"

def carregar_ultimo_sindicado():
    """Lê o arquivo local para checar qual foi o último post enviado."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                dados = json.load(f)
                return dados.get("url")
        except Exception as e:
            print(f"⚠️ Erro ao ler cache: {e}")
    return None

def salvar_ultimo_sindicado(url_post):
    """Salva a URL do post enviado para evitar duplicidade."""
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump({"url": url_post}, f, ensure_ascii=False, indent=2)
        print("💾 Histórico de publicação atualizado com sucesso.")
    except Exception as e:
        print(f"⚠️ Erro ao salvar cache: {e}")

def obter_ultimo_post():
    """Busca a postagem mais recente no feed do Blogger."""
    print(f"📰 Conectando ao feed de {BLOG_HOST}...")
    try:
        res = requests.get(FEED_URL, timeout=15)
        if res.status_code != 200:
            print(f"❌ Falha ao acessar o feed (Status HTTP: {res.status_code})")
            return None

        data = res.json()
        entries = data.get("feed", {}).get("entry", [])
        if not entries:
            print("❌ Nenhuma postagem encontrada no blog.")
            return None

        post = entries[0]
        titulo = post.get("title", {}).get("$t", "MOD APK").strip()

        # Extrai o Link Oficial do Artigo
        link = ""
        for l in post.get("link", []):
            if l.get("rel") == "alternate":
                link = l.get("href")
                break

        if not link:
            print("❌ Não foi possível extrair a URL do artigo.")
            return None

        return {
            "titulo": titulo,
            "link": link
        }

    except Exception as e:
        print(f"❌ Exceção ao processar feed: {e}")
        return None

def enviar_indexnow(post_url):
    """Dispara a URL para a API IndexNow (Bing, Yandex, Seznam)."""
    print(f"🚀 [IndexNow] Notificando motores de busca para a URL: {post_url}")
    payload = {
        "host": BLOG_HOST,
        "key": "404modapkindexkey2026", # Chave de verificação padrão do host
        "keyLocation": f"https://{BLOG_HOST}/404modapkindexkey2026.txt",
        "urlList": [post_url]
    }
    headers = {"Content-Type": "application/json; charset=utf-8"}

    try:
        res = requests.post(INDEXNOW_ENDPOINT, json=payload, headers=headers, timeout=15)
        if res.status_code in [200, 202]:
            print("✅ [IndexNow] Notificação aceita com sucesso!")
        else:
            print(f"⚠️ [IndexNow] Resposta com código: {res.status_code}")
    except Exception as e:
        print(f"❌ [IndexNow] Erro ao enviar requisição: {e}")

def enviar_ping_rpc(titulo_blog, post_url):
    """Dispara o XML-RPC Pingomatic para agregar o post na rede global."""
    print(f"📡 [Pingomatic] Disparando XML-RPC Ping para: {post_url}")
    
    xml_payload = f"""<?xml version="1.0"?>
<methodCall>
  <methodName>weblogUpdates.ping</methodName>
  <params>
    <param>
      <value>{titulo_blog}</value>
    </param>
    <param>
      <value>{post_url}</value>
    </param>
  </params>
</methodCall>"""

    headers = {"Content-Type": "text/xml"}

    try:
        res = requests.post(PINGOMATIC_URL, data=xml_payload.encode('utf-8'), headers=headers, timeout=15)
        if res.status_code == 200:
            print("✅ [Pingomatic] Ping distribuído para agregadores de tráfego!")
        else:
            print(f"⚠️ [Pingomatic] Resposta HTTP: {res.status_code}")
    except Exception as e:
        print(f"❌ [Pingomatic] Erro ao disparar ping: {e}")

def executar_sindicacao():
    post = obter_ultimo_post()
    if not post:
        print("❌ Encerrando execução: Post inválido ou inexistente.")
        return

    url_atual = post["link"]
    ultimo_enviado = carregar_ultimo_sindicado()

    print(f"🔎 Artigo no Feed: {post['titulo']}")
    print(f"🔗 URL do Artigo: {url_atual}")

    # Checa se o post já foi sindicado anteriormente
    if ultimo_enviado == url_atual:
        print("⏸️ Nenhuma novidade encontrada. O post mais recente já foi sindicado. Cancelando envio duplicado.")
        return

    print("⚡ Novo artigo detectado! Iniciando sindicação automática de tráfego...")
    
    # 1. Envia para o protocolo IndexNow
    enviar_indexnow(url_atual)
    
    # 2. Envia para o Pingomatic
    enviar_ping_rpc("K-404 MOD APK", url_atual)
    
    # 3. Salva a memória para não repetir
    salvar_ultimo_sindicado(url_atual)
    print("🎉 SINDICAÇÃO 100% CONCLUÍDA!")

if __name__ == "__main__":
    executar_sindicacao()
