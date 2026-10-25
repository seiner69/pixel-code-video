"""Extract source frames with real timestamps and build readable contact sheets."""
import argparse
import json
import math
import subprocess
from pathlib import Path


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, encoding='utf-8').stdout


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--video', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--start', type=float, default=0)
    p.add_argument('--duration', type=float, default=8)
    p.add_argument('--every', type=int, default=1, help='Keep every Nth source frame inside the interval')
    p.add_argument('--width', type=int, default=1280)
    p.add_argument('--ffmpeg', default='ffmpeg')
    p.add_argument('--ffprobe', default='ffprobe')
    args = p.parse_args()
    if not all(math.isfinite(v) for v in [args.start, args.duration]) or args.start < 0 or args.duration <= 0 or args.every < 1 or args.width < 1:
        p.error('Invalid time, every or width')
    if not args.video.is_file():
        p.error('Video does not exist')
    out = args.out.resolve()
    if out.exists():
        p.error('Use a new output directory to avoid overwriting or mixing analyses')
    meta = json.loads(run([args.ffprobe, '-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_streams',
                          '-show_entries', 'frame=best_effort_timestamp_time:stream=width,height,avg_frame_rate,r_frame_rate,duration', '-of', 'json', str(args.video)]))
    raw = meta.get('frames', [])
    if not raw or any('best_effort_timestamp_time' not in f for f in raw):
        p.error('Cannot obtain reliable source timestamps')
    first_pts = float(raw[0]['best_effort_timestamp_time'])
    inside = [(n, float(f['best_effort_timestamp_time'])) for n, f in enumerate(raw)
              if args.start-1e-7 <= float(f['best_effort_timestamp_time'])-first_pts < args.start+args.duration-1e-7]
    if not inside:
        p.error('No frames in requested interval')
    selected = inside[::args.every]
    out.mkdir(parents=True, exist_ok=False)
    # Select by decoded frame number, then preserve each selected frame; no CFR resampling.
    start_n, end_n = inside[0][0], inside[-1][0]
    expression = f'between(n,{start_n},{end_n})*not(mod(n-{start_n},{args.every}))'
    vf = f"select='{expression}',scale={args.width}:-2:flags=neighbor"
    run([args.ffmpeg, '-v', 'error', '-i', str(args.video), '-map', '0:v:0', '-vf', vf,
         '-fps_mode', 'passthrough', '-start_number', '0', str(out / 'frame_%06d.png')])
    files = sorted(out.glob('frame_*.png'))
    if len(files) != len(selected):
        raise RuntimeError(f'Timestamp/frame count mismatch: {len(selected)} vs {len(files)}')
    records = [{'file': file.name, 'source_frame': n, 'source_pts': pts, 'relative_time': pts-first_pts}
               for file, (n, pts) in zip(files, selected)]
    (out/'frames.json').write_text(json.dumps({'source': args.video.name, 'time_origin_pts': first_pts,
                                             'streams': meta['streams'], 'frames': records}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    from PIL import Image, ImageDraw
    # Up to 24 thumbnails per sheet; label timestamps instead of assuming fps.
    thumb_w, thumb_h, cell_h = 320, 180, 208
    for offset in range(0, len(records), 24):
        batch = records[offset:offset+24]
        sheet = Image.new('RGB', (thumb_w*4, cell_h*math.ceil(len(batch)/4)), '#15242b')
        draw = ImageDraw.Draw(sheet)
        for i, rec in enumerate(batch):
            img = Image.open(out/rec['file']).convert('RGB');img.thumbnail((thumb_w, thumb_h))
            x, y = (i%4)*thumb_w, (i//4)*cell_h
            sheet.paste(img, (x+(thumb_w-img.width)//2, y+(thumb_h-img.height)//2))
            draw.text((x+6, y+184), f"f{rec['source_frame']}  {rec['relative_time']:.4f}s", fill='white')
        sheet.save(out/f'contact_{offset//24+1:03d}.jpg', quality=92)
    print(json.dumps({'out': str(out), 'count': len(records), 'first': records[0], 'last': records[-1]}, ensure_ascii=False))


if __name__ == '__main__':
    main()
