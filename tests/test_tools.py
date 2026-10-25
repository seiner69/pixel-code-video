import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('output_paths', ROOT / 'scripts/output_paths.py')
outputs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(outputs)


class Tools(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def cli(self, name, *args):
        return subprocess.run([sys.executable, str(ROOT/'scripts'/name), *map(str, args)],
                              capture_output=True, text=True, encoding='utf-8')

    def test_bootstrap_rounds_to_whole_frames(self):
        out = self.root/'project'
        result = self.cli('bootstrap.py','--out',out,'--duration','1.15','--fps','10')
        self.assertEqual(result.returncode, 0, result.stderr)
        cfg = json.loads((out/'config.json').read_text(encoding='utf-8'))
        self.assertEqual(cfg['frames'], 12)
        self.assertEqual(cfg['duration'], 1.2)
        self.assertTrue((out/'src/film.js').is_file())
        self.assertFalse(list(out.rglob('*.woff2')))

    def test_bootstrap_refuses_existing_even_empty(self):
        for name in ['empty', 'populated']:
            out = self.root/name
            out.mkdir()
            if name == 'populated': (out/'config.json').write_text('keep')
            self.assertNotEqual(self.cli('bootstrap.py','--out',out).returncode, 0)
            if name == 'populated': self.assertEqual((out/'config.json').read_text(), 'keep')

    def test_invalid_dimensions_and_nonfinite_duration(self):
        for args in [('--width','3'),('--duration','nan'),('--duration','inf'),('--fps','0')]:
            out = self.root/'invalid'
            self.assertNotEqual(self.cli('bootstrap.py','--out',out,*args).returncode, 0)
            self.assertFalse(out.exists())

    def test_existing_extract_directory_is_unchanged(self):
        video = self.root/'input.mp4'
        video.write_bytes(b'synthetic placeholder')
        out = self.root/'frames'
        out.mkdir()
        marker = out/'frame_000000.png'
        marker.write_bytes(b'keep')
        r = self.cli('extract_frames.py','--video',video,'--out',out)
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(marker.read_bytes(),b'keep')

    def test_compare_reserves_all_named_outputs_before_probe(self):
        for suffix in ['.mp4','.labels.png','.comparison.json']:
            out = self.root/'result.mp4'
            marker = out.with_suffix(suffix)
            marker.write_bytes(b'keep')
            r = self.cli('compare.py','--reference','unused-a.mp4','--candidate','unused-b.mp4',
                         '--out',out,'--duration','1')
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('Output already exists',r.stderr)
            self.assertEqual(marker.read_bytes(),b'keep')
            marker.unlink()

    def test_publish_race_never_replaces_file(self):
        src, dst = self.root/'encoded', self.root/'final'
        src.write_bytes(b'new')
        outputs.require_new([dst])
        dst.write_bytes(b'concurrent writer')
        with self.assertRaises(FileExistsError): outputs.publish(src,dst)
        self.assertEqual(dst.read_bytes(),b'concurrent writer')

    def test_exclusive_publish_success(self):
        src, dst = self.root/'encoded', self.root/'final'
        src.write_bytes(b'new')
        outputs.publish(src,dst)
        src.unlink()
        self.assertEqual(dst.read_bytes(),b'new')

if __name__ == '__main__':
    unittest.main()
