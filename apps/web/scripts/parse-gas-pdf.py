#!/usr/bin/env python3
"""
Gas PDF Parser - Uses pdfplumber for accurate table extraction
Supports both Gasnor and GasNEA PDF formats

Usage:
    python parse-gas-pdf.py <pdf_path> [--format gasnor|gasnea|auto]
    
Output:
    JSON array of parsed records to stdout
"""

import sys
import json
import re
import argparse

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber not installed. Run: pip install pdfplumber"}))
    sys.exit(1)


def format_phone_for_whatsapp(phone: str, default_area_code: str = "387") -> str:
    """
    Format an Argentine phone number for WhatsApp.
    WhatsApp format: +549XXXXXXXXXX (country + 9 + area code + number)
    
    Handles:
    - +54-9-387-4475398 → +5493874475398
    - +54-387-4509527 → +5493874509527
    - 3874875200 → +5493874875200
    - 3624-262302 → +5493624262302
    - 154475398 → +549{area}4475398
    - 4250995 → +549{area}4250995
    """
    if not phone or phone.strip() in ['-', '', 'Email']:
        return None
    
    # Remove all non-digit characters except +
    cleaned = re.sub(r'[^\d+]', '', phone.strip())
    
    # If empty after cleaning, return None
    if not cleaned or cleaned == '+':
        return None
    
    # Remove + if present
    if cleaned.startswith('+'):
        cleaned = cleaned[1:]
    
    # Remove leading 54 if present
    if cleaned.startswith('54'):
        cleaned = cleaned[2:]
    
    # Remove leading 9 if present (mobile indicator)
    if cleaned.startswith('9'):
        cleaned = cleaned[1:]
    
    # Remove leading 0 from area code
    if cleaned.startswith('0'):
        cleaned = cleaned[1:]
    
    # Remove 15 prefix (local mobile indicator) - it becomes 9 in international format
    if cleaned.startswith('15') and len(cleaned) >= 9:
        cleaned = cleaned[2:]
        # Need to prepend area code since 15 numbers are local
        if len(cleaned) <= 8:
            cleaned = default_area_code + cleaned
    
    # If number is only 6-8 digits, it's a local number needing area code
    if len(cleaned) <= 8 and len(cleaned) >= 6:
        cleaned = default_area_code + cleaned
    
    # Validate: should be 10-11 digits (area code + number)
    if len(cleaned) < 10 or len(cleaned) > 12:
        return None
    
    # Format for WhatsApp: +549 + number
    return f"+549{cleaned}"


def parse_multiple_phones(phone_str: str, default_area_code: str = "387") -> list:
    """
    Parse a phone string that may contain multiple phones separated by / or spaces.
    
    Examples:
    - "03445-482402/1664199" → two phones
    - "4351129/15469 9730" → two phones  
    - "0343-4890284 / 0343-15467426" → two phones
    - "+54-388-4275845" → one phone
    """
    if not phone_str or phone_str.strip() in ['-', '', 'Email']:
        return []
    
    phones = []
    seen = set()
    
    # First, try to extract the area code from the first part if it exists
    area_code = default_area_code
    
    # Check if first part has area code (0XXX or 3XXX pattern)
    first_part = phone_str.split('/')[0].split()[0] if phone_str else ''
    cleaned_first = re.sub(r'[^\d]', '', first_part)
    if len(cleaned_first) >= 10:
        # Full number, extract area code (first 3-4 digits after removing 0)
        if cleaned_first.startswith('0'):
            cleaned_first = cleaned_first[1:]
        area_code = cleaned_first[:3]
    elif cleaned_first.startswith('0') and len(cleaned_first) >= 4:
        area_code = cleaned_first[1:4]  # Remove leading 0
    elif cleaned_first.startswith('3') and len(cleaned_first) >= 3:
        area_code = cleaned_first[:3]
    
    # Split by / or space (but not space inside +54-9-387 patterns)
    # First normalize the string
    normalized = phone_str.replace(' / ', '/').replace('/ ', '/').replace(' /', '/')
    
    # Split by /
    parts = normalized.split('/')
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
        
        # Check if this part has spaces that might be multiple numbers
        # But avoid splitting +54-9... patterns
        if ' ' in part and not part.startswith('+'):
            # Additional split by space for patterns like "15469 9730"
            subparts = part.split()
            for subpart in subparts:
                formatted = format_phone_for_whatsapp(subpart, area_code)
                if formatted and formatted not in seen:
                    phones.append(formatted)
                    seen.add(formatted)
        else:
            formatted = format_phone_for_whatsapp(part, area_code)
            if formatted and formatted not in seen:
                phones.append(formatted)
                seen.add(formatted)
    
    return phones


def extract_postal_code(address: str) -> tuple:
    """
    Extract postal code from address string.
    Returns (address_without_cp, postal_code)
    
    Examples:
    - "GUIRALDES 921 CP:3503" → ("GUIRALDES 921", "3503")
    - "BELGRANO 962 CP.3170" → ("BELGRANO 962", "3170")
    """
    if not address:
        return (address, None)
    
    # Pattern for CP:XXXX or CP.XXXX or CP XXXX
    cp_match = re.search(r'\bCP[:\.\s]?\s*(\d{4,5})\b', address, re.IGNORECASE)
    
    if cp_match:
        postal_code = cp_match.group(1)
        # Remove CP part from address
        clean_address = re.sub(r'\s*CP[:\.\s]?\s*\d{4,5}\b', '', address, flags=re.IGNORECASE).strip()
        return (clean_address, postal_code)
    
    return (address, None)


def detect_format(tables: list, text: str) -> str:
    """
    Detect whether this is a Gasnor or GasNEA PDF.
    
    Gasnor: Has columns MAT, CAT, APELLIDO, NOMBRE, DOMICILIO, LOCALIDAD, PROVINCIA, TELEFONO, CELULAR, EMAIL
    GasNEA: Has columns LOCALIDAD, NOMBRE, CUIT, DOMICILIO, TELEFONO, EMAIL, MATRICULA, TIPO, VIGENCIA
    """
    text_upper = text.upper()
    
    # Check for Gasnor-specific headers
    if 'APELLIDO' in text_upper and 'CELULAR' in text_upper:
        return 'GASNOR'
    
    # Check for GasNEA-specific headers
    if 'CUIT' in text_upper and 'VIGENCIA' in text_upper:
        return 'GASNEA'
    
    # Check table headers if available
    if tables and len(tables) > 0 and tables[0]:
        first_row = ' '.join(str(cell or '') for cell in tables[0][0] if cell).upper()
        if 'APELLIDO' in first_row:
            return 'GASNOR'
        if 'CUIT' in first_row:
            return 'GASNEA'
    
    # Default to GasNEA (original format)
    return 'GASNEA'


def parse_gasnor_row(row: list, default_area_code: str = "387") -> dict:
    """
    Parse a Gasnor format row.
    Columns: MAT, CAT, APELLIDO, NOMBRE, DOMICILIO, LOCALIDAD, PROVINCIA, TELEFONO, CELULAR, EMAIL
    Indices:  0    1    2         3       4          5          6          7         8        9
    """
    if not row or len(row) < 8:
        return None
    
    # Skip header rows
    first_cell = str(row[0] or '').strip().upper()
    if first_cell in ['MAT', 'MATRICULA', '']:
        return None
    
    # Extract matricula - should be a number
    matricula = str(row[0] or '').strip()
    if not matricula.isdigit():
        return None
    
    # Map category
    cat_raw = str(row[1] or '').strip().lower()
    category = 'M1' if '1ra' in cat_raw else 'M2' if '2da' in cat_raw else 'M3' if '3ra' in cat_raw else None
    
    # Get category description
    category_desc = {
        'M1': 'Instalador de 1ra categoría',
        'M2': 'Instalador de 2da categoría', 
        'M3': 'Instalador de 3ra categoría'
    }.get(category)
    
    # Name (APELLIDO + NOMBRE)
    apellido = str(row[2] or '').strip()
    nombre = str(row[3] or '').strip()
    full_name = f"{apellido} {nombre}".strip()
    
    if not full_name or len(full_name) < 3:
        return None
    
    # Address
    address = str(row[4] or '').strip() if len(row) > 4 else None
    
    # Locality
    locality = str(row[5] or '').strip() if len(row) > 5 else None
    
    # Province
    province = str(row[6] or '').strip() if len(row) > 6 else None
    
    # Infer area code from province
    if province:
        prov_upper = province.upper()
        if 'JUJUY' in prov_upper:
            default_area_code = '388'
        elif 'TUCUMAN' in prov_upper:
            default_area_code = '381'
        elif 'SANTIAGO' in prov_upper:
            default_area_code = '385'
        else:
            default_area_code = '387'  # Salta
    
    # Phones (TELEFONO and CELULAR) - may have multiple phones with / separator
    phones = []
    seen_phones = set()
    
    telefono = str(row[7] or '').strip() if len(row) > 7 else None
    celular = str(row[8] or '').strip() if len(row) > 8 else None
    
    # Parse multiple phones from each field
    for phone_str in [telefono, celular]:
        parsed = parse_multiple_phones(phone_str, default_area_code)
        for p in parsed:
            if p not in seen_phones:
                phones.append(p)
                seen_phones.add(p)
    
    # Email
    email = None
    email_raw = str(row[9] or '').strip() if len(row) > 9 else None
    if email_raw and '@' in email_raw:
        email = email_raw.lower()
    
    return {
        'matricula': matricula,
        'fullName': full_name,
        'category': category,
        'categoryDesc': category_desc,
        'address': address,
        'city': locality,
        'province': province,
        'phone': phones[0] if phones else None,
        'phones': phones,
        'email': email,
        'cuit': None,  # Gasnor doesn't have CUIT
        'profession': 'Gasista',
        'source': 'GASNOR'
    }


def parse_gasnea_row(row: list, default_area_code: str = "379") -> dict:
    """
    Parse a GasNEA format row.
    Columns: LOCALIDAD, NOMBRE, CUIT, DOMICILIO, TELEFONO, EMAIL, MATRICULA, TIPO, VIGENCIA
    Indices:  0         1       2     3          4         5      6          7     8
    """
    if not row or len(row) < 7:
        return None
    
    # Skip header rows
    first_cell = str(row[0] or '').strip().upper()
    if first_cell in ['LOCALIDAD', '']:
        return None
    
    # Locality
    locality = str(row[0] or '').strip()
    
    # Name
    full_name = str(row[1] or '').strip()
    if not full_name or len(full_name) < 3:
        return None
    
    # CUIT (11 digits)
    cuit_raw = str(row[2] or '').strip()
    cuit = re.sub(r'[^\d]', '', cuit_raw)
    if len(cuit) != 11:
        cuit = None
    
    # Address with postal code extraction
    address_raw = str(row[3] or '').strip() if len(row) > 3 else None
    address, postal_code = extract_postal_code(address_raw)
    
    # Infer area code from locality (expanded list)
    if locality:
        loc_upper = locality.upper()
        # Chaco
        if any(x in loc_upper for x in ['RESISTENCIA', 'BARRANQUERAS', 'FONTANA', 'CHARATA', 'SAENZ PEÑA']):
            default_area_code = '362'
        # Misiones
        elif any(x in loc_upper for x in ['POSADAS', 'OBERA', 'ELDORADO', 'IGUAZU']):
            default_area_code = '376'
        # Formosa
        elif any(x in loc_upper for x in ['FORMOSA', 'CLORINDA', 'PIRANE']):
            default_area_code = '370'
        # Entre Ríos
        elif any(x in loc_upper for x in ['PARANA', 'CONCORDIA', 'GUALEGUAYCHU', 'COLON', 'BASAVILBASO', 'VILLAGUAY']):
            default_area_code = '343'
        # Corrientes specific cities
        elif any(x in loc_upper for x in ['GOYA', 'PASO DE LOS LIBRES', 'MONTE CASEROS']):
            default_area_code = '3777'
        else:
            default_area_code = '379'  # Corrientes city default
    
    # Phone - may have multiple phones with / separator (e.g., "03445-482402/1664199")
    phones = parse_multiple_phones(
        str(row[4] or '').strip() if len(row) > 4 else None, 
        default_area_code
    )
    
    # Email
    email = None
    email_raw = str(row[5] or '').strip() if len(row) > 5 else None
    if email_raw and '@' in email_raw:
        email = email_raw.lower()
    
    # Matricula
    matricula = str(row[6] or '').strip() if len(row) > 6 else None
    
    # Type (M1, M2, M3)
    category = str(row[7] or '').strip().upper() if len(row) > 7 else None
    if category and not category.startswith('M'):
        category = None
    
    category_desc = {
        'M1': 'Instalador de 1ra categoría',
        'M2': 'Instalador de 2da categoría',
        'M3': 'Instalador de 3ra categoría'
    }.get(category)
    
    # Vigencia (license expiry)
    vigencia = str(row[8] or '').strip() if len(row) > 8 else None
    
    # Infer province from locality
    province = 'Corrientes'  # Default
    if locality:
        loc_upper = locality.upper()
        if any(x in loc_upper for x in ['RESISTENCIA', 'BARRANQUERAS', 'FONTANA', 'CHARATA']):
            province = 'Chaco'
        elif any(x in loc_upper for x in ['POSADAS', 'OBERA', 'ELDORADO']):
            province = 'Misiones'
        elif any(x in loc_upper for x in ['FORMOSA', 'CLORINDA']):
            province = 'Formosa'
        elif any(x in loc_upper for x in ['PARANA', 'CONCORDIA', 'GUALEGUAYCHU']):
            province = 'Entre Ríos'
    
    return {
        'matricula': matricula,
        'fullName': full_name,
        'category': category,
        'categoryDesc': category_desc,
        'address': address,
        'postalCode': postal_code,
        'city': locality,
        'province': province,
        'phone': phones[0] if phones else None,
        'phones': phones,
        'email': email,
        'cuit': cuit,
        'licenseExpiry': vigencia,
        'profession': 'Gasista',
        'source': 'GASNEA'
    }


def parse_pdf(pdf_path: str, format_hint: str = 'auto') -> list:
    """
    Parse a gas company PDF and extract records.
    
    Args:
        pdf_path: Path to the PDF file
        format_hint: 'gasnor', 'gasnea', or 'auto'
    
    Returns:
        List of parsed records
    """
    records = []
    
    with pdfplumber.open(pdf_path) as pdf:
        all_tables = []
        full_text = ""
        
        # First pass: collect all tables and text
        for page in pdf.pages:
            tables = page.extract_tables()
            if tables:
                all_tables.extend(tables)
            text = page.extract_text()
            if text:
                full_text += text + "\n"
        
        # Detect format if auto
        if format_hint == 'auto':
            detected_format = detect_format(all_tables, full_text)
        else:
            detected_format = format_hint.upper()
        
        print(f"Detected format: {detected_format}", file=sys.stderr)
        print(f"Found {len(all_tables)} tables", file=sys.stderr)
        
        # Parse each table
        for table in all_tables:
            for row in table:
                if not row:
                    continue
                
                try:
                    if detected_format == 'GASNOR':
                        record = parse_gasnor_row(row)
                    else:
                        record = parse_gasnea_row(row)
                    
                    if record:
                        records.append(record)
                except Exception as e:
                    print(f"Error parsing row: {e}", file=sys.stderr)
                    continue
    
    # Deduplicate by matricula
    seen_matriculas = set()
    unique_records = []
    for record in records:
        mat = record.get('matricula')
        if mat and mat not in seen_matriculas:
            seen_matriculas.add(mat)
            unique_records.append(record)
        elif not mat:
            unique_records.append(record)
    
    return unique_records


def main():
    parser = argparse.ArgumentParser(description='Parse Gasnor/GasNEA PDF files')
    parser.add_argument('pdf_path', help='Path to the PDF file')
    parser.add_argument('--format', choices=['gasnor', 'gasnea', 'auto'], 
                        default='auto', help='PDF format (default: auto-detect)')
    
    args = parser.parse_args()
    
    try:
        records = parse_pdf(args.pdf_path, args.format)
        
        print(f"Parsed {len(records)} records", file=sys.stderr)
        
        # Output JSON to stdout
        print(json.dumps(records, ensure_ascii=False, indent=2))
        
    except FileNotFoundError:
        print(json.dumps({"error": f"File not found: {args.pdf_path}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
