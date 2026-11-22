#!/bin/sh
# A stand-in for the host's sandbox tool: it skips the fences' arguments (-D and -p pairs, everything before --) and
# runs exactly what a real sandbox would, so a check can drive the wrapped path without applying the fence itself.
until [ "$#" -eq 0 ]; do
  case "$1" in
    -D | -p) shift 2 ;;
    --) shift; break ;;
    *) break ;;
  esac
done
exec "$@"
