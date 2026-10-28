"""Generate the fixed test series from Occurrence (1).xlsx, without editing it.

Usage: python scripts/extract-obis-test-data.py "Occurrence (1).xlsx"
No third-party Python packages are required.
"""

import argparse
import hashlib
import json
import xml.etree.ElementTree as ET
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from zipfile import ZipFile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def extract(source):
    with ZipFile(source) as archive:
        strings = [''.join(n.text or '' for n in item.findall('.//s:t', NS))
                   for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))]

        def rows(path):
            result = []
            for row in ET.fromstring(archive.read(path)).findall('.//s:sheetData/s:row', NS):
                values = {}
                for cell in row.findall('s:c', NS):
                    value = cell.find('s:v', NS)
                    text = value.text if value is not None else ''.join(n.text or '' for n in cell.findall('.//s:t', NS))
                    if cell.get('t') == 's' and text:
                        text = strings[int(text)]
                    values[''.join(c for c in cell.get('r', '') if c.isalpha())] = text
                if values:
                    result.append(values)
            return result

        # The chart definitions point to pivot sheets whose cell values are not
        # stored in this workbook. Rebuild the aggregates from their source rows.
        abundance_rows = rows('xl/worksheets/sheet7.xml')[1:]  # Hoja 2
        abundance = Counter(row['A'] for row in abundance_rows if row.get('A'))
        years = Counter()
        unknown_years = 0
        for row in rows('xl/worksheets/sheet3.xml')[1:]:  # Tabla por año y especie
            try:
                year = Decimal(row.get('A') or '')
                if not year.is_finite() or year != int(year) or not 1000 <= year <= 9999:
                    raise ValueError('Invalid year')
                years[int(year)] += 1
            except (ValueError, ArithmeticError):
                unknown_years += 1

        original = rows('xl/worksheets/sheet1.xml')  # Occurrence
        columns = {value: key for key, value in original[0].items()}
        species_order = ['Carcharhinus limbatus', 'Carcharhinus perezii',
                         'Ginglymostoma cirratum', 'Negaprion brevirostris', 'Squalus cubensis']
        depths = []
        for species in species_order:
            values = []
            for row in original[1:]:
                if row.get(columns['country']) != 'Puerto Rico' or row.get(columns['scientificName']) != species:
                    continue
                try:
                    value = Decimal(row.get(columns['maximumDepthInMeters']) or '')
                    if value.is_finite() and value >= 0:
                        values.append(value)
                except ArithmeticError:
                    pass
            if not values:
                raise ValueError(f'Missing depth data for {species}')
            mean = sum(values) / len(values)
            display = format(mean.quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP), 'f').rstrip('0').rstrip('.')
            depths.append({'label': species, 'value': float(mean), 'display': display, 'sampleSize': len(values)})

        output = {
            'source': source.name,
            'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'totalRecords': sum(abundance.values()),
            'unknownYears': unknown_years,
            'depthField': 'maximumDepthInMeters',
            'abundance': [{'label': label, 'value': count, 'display': str(count)}
                          for label, count in sorted(abundance.items(), key=lambda pair: (pair[1], pair[0]), reverse=True)],
            'temporal': [{'label': str(year), 'value': count, 'display': str(count)} for year, count in sorted(years.items())],
            'depth': depths,
        }
        if output['totalRecords'] != 115 or len(abundance) != 24 or len(years) != 17:
            raise ValueError('Unexpected source data. No output was written.')
        if [point['display'] for point in depths] != ['35', '26.38461538', '23.43605263', '13', '329']:
            raise ValueError('Depth aggregates differ from the PDF. No output was written.')
        target = Path(__file__).resolve().parents[1] / 'lib' / 'sightings' / 'obis-test-data.json'
        target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{target.name}: 24 taxa, 17 years, 5 depth means; {unknown_years} records without a valid year.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    extract(parser.parse_args().source)
