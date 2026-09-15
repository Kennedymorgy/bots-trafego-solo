import os
import re
import json
import requests

BLOG_HOST = "k-404modapk.blogspot.com"
FEED_URL = f"https://{BLOG_HOST}/feeds/posts/default?alt=json&max-results=20"
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
            link = ""
            for l in entry.get("link", []):
                if l.get("rel") == "alternate":
                    link = l.get("href")
                    break
            if titulo and link:
                posts.append({"titulo": titulo, "link": link})
        return posts
    except Exception as e:
        print(f"Erro ao obter posts: {e}")
        return []

def gerar_json_ld_schema(post):
    titulo = post["titulo"]
    link = post["link"]
    nome_limpo = re.sub(r'MOD MENU.*|MOD APK.*|\(.*?\)', '', titulo, flags=re.IGNORECASE).strip() or "Jogo Android"

    schema = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": nome_limpo,
        "operatingSystem": "ANDROID",
        "applicationCategory": "GameApplication",
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "ratingCount": "1250"
        },
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "url": link
    }
    return schema

def executar_bot():
    posts = obter_posts()
    if not posts:
        print("Nenhum post encontrado.")
        return

    snippets_db = {}
    for post in posts:
        schema = gerar_json_ld_schema(post)
        snippets_db[post["link"]] = {
            "titulo": post["titulo"],
            "schema_json_ld": schema
        }

    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(snippets_db, f, ensure_ascii=False, indent=2)

    print(f"✅ Bot 5 gerou dados de Rich Snippets para {len(snippets_db)} jogos!")

if __name__ == "__main__":
    executar_bot()
