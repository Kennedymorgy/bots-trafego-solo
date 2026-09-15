import os
import json
import requests

BLOG_HOST = "k-404modapk.blogspot.com"
FEED_URL = f"https://{BLOG_HOST}/feeds/posts/default?alt=json&max-results=20"
CACHE_FILE = "historico_sindicacao.json"

INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
PINGOMATIC_URL = "http://rpc.pingomatic.com/"

def carregar_historico():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def salvar_historico(historico):
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(historico, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Erro ao salvar histórico: {e}")

def buscar_posts_blog():
    print(f"📰 Conectando ao feed de {BLOG_HOST} (Buscando ultimos artigos)...")
    try:
        res = requests.get(FEED_URL, timeout=15)
        if res.status_code != 200:
            return []

        data = res.json()
        entries = data.get("feed", {}).get("entry", [])
        posts = []

        for entry in entries:
            titulo = entry.get("title", {}).get("$t", "").strip()
            link = ""
            for l in entry.get("link", []):
                if l.get("rel") == "alternate":
                    link = l.get("href")
                    break

            if link:
                posts.append({"titulo": titulo, "link": link})

        return posts
    except Exception as e:
        print(f"❌ Erro ao ler feed: {e}")
        return []

def enviar_indexnow(urls):
    if not urls:
        return
    print(f"🚀 [IndexNow] Enviando {len(urls)} URL(s) para indexação instantânea...")
    payload = {
        "host": BLOG_HOST,
        "key": "404modapkindexkey2026",
        "keyLocation": f"https://{BLOG_HOST}/404modapkindexkey2026.txt",
        "urlList": urls
    }
    headers = {"Content-Type": "application/json; charset=utf-8"}

    try:
        res = requests.post(INDEXNOW_ENDPOINT, json=payload, headers=headers, timeout=15)
        if res.status_code in [200, 202]:
            print("✅ [IndexNow] URLs enviadas com sucesso!")
        else:
            print(f"⚠️ [IndexNow] Resposta HTTP: {res.status_code}")
    except Exception as e:
        print(f"❌ [IndexNow] Erro na requisição: {e}")

def enviar_ping_rpc(titulo_blog, post_url):
    xml_payload = f"""<?xml version="1.0"?>
<methodCall>
  <methodName>weblogUpdates.ping</methodName>
  <params>
    <param><value>{titulo_blog}</value></param>
    <param><value>{post_url}</value></param>
  </params>
</methodCall>"""
    headers = {"Content-Type": "text/xml"}
    try:
        requests.post(PINGOMATIC_URL, data=xml_payload.encode('utf-8'), headers=headers, timeout=10)
    except Exception:
        pass

def executar_sindicacao_avancada():
    posts = buscar_posts_blog()
    if not posts:
        print("❌ Nenhum post encontrado.")
        return

    historico = carregar_historico()
    urls_para_indexar = []

    print(f"🔎 Encontrados {len(posts)} artigos no feed.")

    for idx, post in enumerate(posts):
        url = post["link"]
        titulo = post["titulo"]

        # Se for o post mais recente ou um post novo que mudou de link/versao
        if url not in historico:
            print(f"⚡ Novo post/atualização detectada: {titulo}")
            urls_para_indexar.append(url)
            historico[url] = titulo
            
            # Envia ping individual
            enviar_ping_rpc("K-404 MOD APK", url)

    # Dispara a lista inteira de novidades para o IndexNow de uma vez
    if urls_para_indexar:
        enviar_indexnow(urls_para_indexar)
        salvar_historico(historico)
        print("🎉 SINDICAÇÃO COMPLETA CONCLUÍDA!")
    else:
        print("⏸️ Todos os jogos já estão cadastrados e indexados no histórico. Nenhuma alteração pendente.")

if __name__ == "__main__":
    executar_sindicacao_avancada()
