"""Fetch one official match into ignored public/data; do not commit the dataset."""
import argparse
import json
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError

BASE = 'https://raw.githubusercontent.com/SkillCorner/opendata/master/data'
def fetch(url, destination):
    with urlopen(url, timeout=120) as response, destination.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    with destination.open('rb') as saved:
        prefix = saved.read(100)
    if prefix.startswith(b'version https://git-lfs.github.com/spec/v1'):
        media_url = url.replace('raw.githubusercontent.com/SkillCorner/opendata/master/', 'media.githubusercontent.com/media/SkillCorner/opendata/master/')
        if media_url == url:
            raise RuntimeError('The upstream URL returned a Git LFS pointer rather than data.')
        fetch(media_url, destination)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--id', help='Match ID from SkillCorner data/matches.json; defaults to the first match')
    args = parser.parse_args()
    with urlopen(f'{BASE}/matches.json', timeout=60) as response:
        matches = json.load(response)
    if isinstance(matches, dict):
        matches = matches.get('matches', [])
    if not matches:
        raise SystemExit('The upstream match list is empty or has changed format.')
    match_id = str(args.id or matches[0]['id'])
    if not any(str(match['id']) == match_id for match in matches):
        raise SystemExit(f'Match {match_id} is not in the official match list.')
    folder = Path(__file__).resolve().parents[1] / 'public' / 'data'
    folder.mkdir(parents=True, exist_ok=True)
    metadata = f'{match_id}_match.json'
    fetch(f'{BASE}/matches/{match_id}/{metadata}', folder / metadata)
    tracking = f'{match_id}_tracking_extrapolated.jsonl'
    try:
        fetch(f'{BASE}/matches/{match_id}/{tracking}', folder / tracking)
    except HTTPError as error:
        if error.code != 404:
            raise
        tracking = f'{match_id}_tracking.json'
        fetch(f'{BASE}/matches/{match_id}/{tracking}', folder / tracking)
    (folder / 'manifest.json').write_text(json.dumps({'id': match_id, 'metadata': metadata, 'tracking': tracking}, indent=2))
    print(f'Downloaded official match {match_id}. Choose Load bundled match in the app.')

if __name__ == '__main__':
    main()
