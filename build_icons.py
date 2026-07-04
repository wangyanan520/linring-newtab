import struct, zlib, os

def create_png(filepath, size, r=108, g=99, b=255):
    sig = b'\x89PNG\r\n\x1a\n'

    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
    ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)

    raw_data = b''
    for y in range(size):
        raw_data += b'\x00'
        for x in range(size):
            margin = size // 4
            if margin <= x < size - margin and margin <= y < size - margin:
                raw_data += bytes([r, g, b])
            else:
                raw_data += bytes([30, 30, 50])

    compressed = zlib.compress(raw_data)
    idat_crc = zlib.crc32(b'IDAT' + compressed) & 0xffffffff
    idat = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)

    iend_crc = zlib.crc32(b'IEND') & 0xffffffff
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'wb') as f:
        f.write(sig + ihdr + idat + iend)

base = '/Users/wyn/Dev/浏览器导航页/src/images/icons'
create_png(f'{base}/icon-16.png', 16)
create_png(f'{base}/icon-48.png', 48)
create_png(f'{base}/icon-128.png', 128)
print('Icons created successfully')
print(os.listdir(base))
