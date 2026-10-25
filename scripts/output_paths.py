"""Publish a completed file without replacing an existing path, including races."""
import os
from pathlib import Path


def require_new(paths):
    for path in paths:
        if os.path.lexists(path):
            raise FileExistsError(f'Output already exists: {Path(path).name}')


def publish(source, target):
    # Both paths must be on the same filesystem. No copying fallback: an
    # unsupported filesystem must fail instead of weakening no-clobber behavior.
    os.link(source, target)
