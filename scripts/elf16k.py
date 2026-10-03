#!/usr/bin/env python3
"""Exit 1 if any PT_LOAD segment of the ELF has p_align < 16384 (not 16 KB page-size compatible)."""
import struct
import sys

PT_LOAD = 1
data = open(sys.argv[1], 'rb').read()
if data[:4] != b'\x7fELF':
    sys.exit('not an ELF file')
is64 = data[4] == 2
if is64:
    phoff = struct.unpack_from('<Q', data, 32)[0]
    phentsize, phnum = struct.unpack_from('<HH', data, 54)
else:
    phoff = struct.unpack_from('<I', data, 28)[0]
    phentsize, phnum = struct.unpack_from('<HH', data, 42)
bad = False
for i in range(phnum):
    o = phoff + i * phentsize
    if is64:
        p_type, _flags, _off, _va, _pa, _fs, _ms, align = struct.unpack_from('<IIQQQQQQ', data, o)
    else:
        p_type, _off, _va, _pa, _fs, _ms, _flags, align = struct.unpack_from('<IIIIIIII', data, o)
    if p_type == PT_LOAD and align < 16384:
        bad = True
print(('FAIL ' if bad else 'PASS ') + sys.argv[1])
sys.exit(1 if bad else 0)
