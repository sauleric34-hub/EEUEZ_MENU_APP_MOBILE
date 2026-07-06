import html
import mimetypes
import re
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from core.models import Plat


HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
    )
}

DISH_SOURCES = {
    'Beignets haricots': [
        'https://en.wikipedia.org/wiki/Akara',
    ],
    'Bouillon de bœuf': [
        'https://www.sayidaty.net/node/1547486/%D8%B5%D8%AD%D8%A9/%D8%B1%D8%B4%D8%A7%D9%82%D8%A9-%D9%88%D8%AA%D8%BA%D8%B0%D9%8A%D8%A9/%D9%87%D9%84-%D8%AA%D9%86%D8%A7%D9%88%D9%84-%D9%85%D8%B1%D9%82-%D8%A7%D9%84%D9%84%D8%AD%D9%85-%D9%85%D8%B6%D8%B1-%D8%A8%D8%A7%D9%84%D8%B5%D8%AD%D8%A9%D8%9F-%D8%A5%D9%84%D9%8A%D9%83-%D8%A7%D9%84%D8%A5%D8%AC%D8%A7%D8%A8%D8%A9-%D8%A8%D8%A7%D9%84%D8%AA%D9%81%D8%B5%D9%8A%D9%84',
        'https://www.bonappetit.com/test-kitchen/ingredients/article/beef-broth',
    ],
    'Eru et waterfufu': [
        'https://commons.wikimedia.org/wiki/File%3AWater_fufu_and_Eru.jpg',
    ],
    'Jus de gingembre': [
        'https://ingwerianer.de/blogs/ingwerianer/vom-trendgetrank-zum-alltagsritual-wie-ingwersaft-die-gesunde-ernahrung-revolutioniert',
    ],
    'Miondo + sauce jaune': [
        'https://www.nkosiagro.com/en/blogs/culture-africaine/miondo',
        'https://www.restaurant-tasolounge.com/mbongo-chobi-dish.html',
    ],
    'Ndolé au poisson': [
        'https://en.wikipedia.org/wiki/Ndol%C3%A9',
    ],
    'Pizza Margherita': [
        'https://en.wikipedia.org/wiki/Pizza_Margherita',
    ],
    'Pizza Test': [
        'https://en.wikipedia.org/wiki/Pizza_Margherita',
    ],
    'Plantains frits': [
        'https://en.wikipedia.org/wiki/Fried_plantain',
    ],
    'Plat Test': [
        'https://fr.wikipedia.org/wiki/Poulet_DG',
    ],
    'Poisson braisé': [
        'https://www.seriouseats.com/ho-to-grill-whole-fish',
    ],
    'Poulet DG': [
        'https://fr.wikipedia.org/wiki/Poulet_DG',
    ],
    'Soya grillé': [
        'https://en.wikipedia.org/wiki/Suya',
    ],
    'Tchiep bou dien': [
        'https://en.wikipedia.org/wiki/Thieboudienne',
    ],
}


class Command(BaseCommand):
    help = "Télécharge de vraies images de plats et les affecte aux enregistrements Plat."

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help="Retélécharge et remplace même si l'image existe déjà.",
        )

    def handle(self, *args, **options):
        force = options['force']
        media_dir = Path(settings.MEDIA_ROOT) / 'plats'
        media_dir.mkdir(parents=True, exist_ok=True)

        updated = 0
        skipped = 0

        for dish_name, sources in DISH_SOURCES.items():
            plats = list(Plat.objects.filter(nom=dish_name).order_by('id'))
            if not plats:
                self.stdout.write(self.style.WARNING(f'- {dish_name}: aucun plat en base'))
                continue

            target_name = self._pick_existing_name(plats, media_dir, force)
            if target_name and not force:
                skipped += len(plats)
                self.stdout.write(f'- {dish_name}: déjà présent ({target_name})')
                continue

            image_url = self._resolve_first_working_image(sources)
            if not image_url:
                self.stdout.write(self.style.ERROR(f'- {dish_name}: impossible de résoudre une image'))
                continue

            try:
                content, suffix = self._download_image(image_url)
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f'- {dish_name}: téléchargement échoué ({exc})'))
                continue

            filename = f"{slugify(dish_name) or 'plat'}{suffix}"
            file_path = media_dir / filename
            file_path.write_bytes(content)

            relative_name = f"plats/{filename}"
            for plat in plats:
                plat.image.name = relative_name
                plat.save(update_fields=['image'])

            updated += len(plats)
            self.stdout.write(self.style.SUCCESS(f'+ {dish_name}: {len(plats)} plat(s) mis à jour'))

        self.stdout.write(self.style.SUCCESS(f'Images mises à jour: {updated}'))
        if skipped:
            self.stdout.write(f'Ignorés: {skipped}')

    def _pick_existing_name(self, plats, media_dir: Path, force: bool) -> str | None:
        if force:
            return None
        for plat in plats:
            if not plat.image:
                continue
            existing = media_dir.parent / plat.image.name
            if existing.exists():
                return plat.image.name
        return None

    def _resolve_first_working_image(self, sources: list[str]) -> str | None:
        for source in sources:
            try:
                return self._resolve_image_url(source)
            except Exception:
                continue
        return None

    def _resolve_image_url(self, source: str) -> str:
        parsed = urlparse(source)
        if Path(parsed.path).suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}:
            return source

        response = requests.get(source, headers=HEADERS, timeout=30)
        response.raise_for_status()
        body = response.text

        patterns = [
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
        ]

        for pattern in patterns:
            match = re.search(pattern, body, flags=re.IGNORECASE)
            if match:
                image_url = html.unescape(match.group(1).strip())
                if image_url.startswith('//'):
                    image_url = f'https:{image_url}'
                return image_url

        raise RuntimeError(f"Aucune balise image trouvée pour {source}")

    def _download_image(self, image_url: str) -> tuple[bytes, str]:
        last_error = None
        for attempt in range(4):
            response = requests.get(image_url, headers=HEADERS, timeout=60)
            if response.status_code != 429:
                response.raise_for_status()

                suffix = Path(urlparse(image_url).path).suffix.lower()
                if suffix not in {'.jpg', '.jpeg', '.png', '.webp'}:
                    content_type = response.headers.get('Content-Type', '').split(';', 1)[0].strip().lower()
                    suffix = mimetypes.guess_extension(content_type) or '.jpg'
                    if suffix == '.jpe':
                        suffix = '.jpg'

                return response.content, suffix

            last_error = RuntimeError(f'HTTP 429 sur {image_url}')
            time.sleep(2 * (attempt + 1))

        raise last_error or RuntimeError(f'Échec du téléchargement de {image_url}')
