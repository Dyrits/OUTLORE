# A stand-in reader for process-table tests on macOS: reads another process's arguments and environment as
# `ps -E` does (sysctl KERN_PROCARGS2) and prints "seen" when the marker appears in them, "hidden" otherwise.
import ctypes
import ctypes.util
import sys

libc = ctypes.CDLL(ctypes.util.find_library("c"), use_errno=True)
mib = (ctypes.c_int * 3)(1, 49, int(sys.argv[1]))
size = ctypes.c_size_t(0)
ok = libc.sysctl(mib, 3, None, ctypes.byref(size), None, 0) == 0
buf = ctypes.create_string_buffer(size.value) if ok else None
ok = ok and libc.sysctl(mib, 3, buf, ctypes.byref(size), None, 0) == 0
print("seen" if ok and sys.argv[2].encode() in buf.raw[: size.value] else "hidden")
