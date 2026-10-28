"""Extract the three original RGB figures without resampling or new dependencies.

Usage: python scripts/extract-obis-test-figures.py path/to/Graficas.pdf
This deliberately supports only the supplied PDF's simple FlateDecode images.
"""

import argparse
import re
import struct
import zlib
from pathlib import Path
from shutil import copyfile


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))


def extract(source):
    raw = source.read_bytes()
    objects = re.finditer(
        rb'\d+\s+0\s+obj\s*<<(?P<header>[^<>]*?/Subtype\s*/Image[^<>]*)>>\s*stream[\r\n]+',
        raw,
    )
    images = []
    expected = [(1638, 1010), (1376, 850), (1200, 742)]
    for image in objects:
        header = image['header']
        if not all(value in header for value in (b'/DeviceRGB', b'/FlateDecode', b'/BitsPerComponent 8')):
            raise ValueError('Unsupported image encoding; do not approximate the source.')
        width = int(re.search(rb'/Width\s+(\d+)', header)[1])
        height = int(re.search(rb'/Height\s+(\d+)', header)[1])
        length = int(re.search(rb'/Length\s+(\d+)', header)[1])
        rgb = zlib.decompress(raw[image.end():image.end() + length])
        if len(rgb) != width * height * 3:
            raise ValueError('Unexpected pixel layout; original pixels cannot be preserved.')
        stride = width * 3
        scanlines = b''.join(b'\x00' + rgb[row * stride:(row + 1) * stride] for row in range(height))
        png = b'\x89PNG\r\n\x1a\n'
        png += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
        png += chunk(b'IDAT', zlib.compress(scanlines, 9))
        png += chunk(b'IEND', b'')
        images.append((width, height, png))
    if [(width, height) for width, height, _ in images] != expected:
        raise ValueError('This is not the expected three-figure PDF. No assets were written.')
    root = Path(__file__).resolve().parents[1]
    output = root / 'public' / 'images' / 'obis-test'
    output.mkdir(parents=True, exist_ok=True)
    for index, (width, height, png) in enumerate(images, 1):
        target = output / f'figure-{index}.png'
        target.write_bytes(png)
        print(f'{target.relative_to(root)}: {width} x {height}, {len(png)} bytes')
    copyfile(source, root / 'public' / 'pdf' / 'obis-resultados-prueba.pdf')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    extract(parser.parse_args().source)
