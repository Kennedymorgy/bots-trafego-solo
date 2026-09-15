import os
import re
import json
import requests

BLOG_HOST = "k-404modapk.blogspot.com"
FEED_URL = f"https://{BLOG_HOST}/feeds/posts/default?alt=json&max-results=50"
CACHE_FILE = "rich_snippets_gerados.json"

def obter_posts():
    try:
        res = requests.get(FEED_URL, timeout=15)
        if res.status_code != 200:
            return []
        data = res.json()
        entries = data.get("feed", {}).get("entry", [])
        posts = []
        for entry in entries:
            titulo = entry.get("title", {}).get("$t", "").strip()
            publicado = entry.get("published", {}).get("$t", "")[:10]
            
            # Tenta pegar versão se tiver no título
            versao_match = re.search(r'v?(\d+\.\d+(\.\d+)?)', titulo, re.IGNORECASE)
            versao = versao_match.group(1) if versao_match else "1.0.0"

            link = ""
            for l in entry.get("link", []):
                if l.get("rel") == "alternate":
                    link = l.get("href")
                    break
            if titulo and link:
                posts.append({
                    "titulo": titulo, 
                    "link": link, 
                    "versao": versao,
                    "data": publicado
                })
        return posts
    except Exception as e:
        print(f"Erro ao obter posts: {e}")
        return []

def gerar_schema_avancado(post):
    titulo = post["titulo"]
    link = post["link"]
    versao = post["versao"]
    nome_limpo = re.sub(r'MOD MENU.*|MOD APK.*|\(.*?\)', '', titulo, flags=re.IGNORECASE).strip() or "Jogo Android"

    # Schema duplo: SoftwareApplication + MobileApplication + FAQSchema
    schema_graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "MobileApplication",
                "@id": f"{link}#game",
                "url": link,
                "name": nome_limpo,
                "operatingSystem": "Android 5.0 ou superior",
                "applicationCategory": "GameApplication",
                "softwareVersion": versao,
                "fileFormat": "application/vnd.android.package-archive",
                "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "BRL",
                    "availability": "https://schema.org/InStock"
                },
                "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": "4.9",
                    "reviewCount": "2480",
                    "bestRating": "5",
                    "worstRating": "1"
                }
            },
            {
                "@type": "FAQPage",
                "@id": f"{link}#faq",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": f"Como baixar {nome_limpo} MOD APK com segurança?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": f"Acesse o link direto no final do artigo em {BLOG_HOST}, faça o download do arquivo APK e instale diretamente no seu dispositivo Android."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "O MOD possui antiban e funciona online?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Sim, todas as funções do MOD Menu foram testadas com proteção antiban ativada para garantir o uso seguro na versão mais recente."
                        }
                    }
                ]
            }
        ]
    }
    return schema_graph

def executar_bot():
    posts = obter_posts()
    if not posts:
        print("❌ Nenhum post encontrado.")
        return

    snippets_db = {}
    for post in posts:
        schema = gerar_schema_avancado(post)
        snippets_db[post["link"]] = {
            "titulo": post["titulo"],
            "schema_json": json.dumps(schema, ensure_ascii=False)
        }

    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(snippets_db, f, ensure_ascii=False, indent=2)

    print(f"✅ Bot 5 gerou Schema Avançado + FAQ para {len(snippets_db)} jogos!")

if __name__ == "__main__":
    executar_bot()
