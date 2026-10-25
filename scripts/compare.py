"""Create a same-speed side-by-side video, reference left and candidate right."""
import argparse
import json
import math
import subprocess
import tempfile
from pathlib import Path
from output_paths import require_new, publish


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, encoding='utf-8').stdout


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--reference', required=True, type=Path)
    p.add_argument('--candidate', required=True, type=Path)
    p.add_argument('--out', required=True, type=Path)
    p.add_argument('--duration', required=True, type=float)
    p.add_argument('--reference-start', type=float, default=0)
    p.add_argument('--candidate-start', type=float, default=0)
    p.add_argument('--audio', choices=['none', 'reference', 'candidate'], default='none')
    p.add_argument('--panel-width', type=int, default=960)
    p.add_argument('--panel-height', type=int, default=540)
    p.add_argument('--fps', type=int, default=30)
    p.add_argument('--ffmpeg', default='ffmpeg')
    p.add_argument('--ffprobe', default='ffprobe')
    args = p.parse_args()
    if not all(math.isfinite(v) for v in [args.duration, args.reference_start, args.candidate_start]) or args.duration <= 0 or min(args.reference_start, args.candidate_start) < 0:
        p.error('Invalid duration or offsets')
    if args.fps < 1 or min(args.panel_width, args.panel_height) < 2 or args.panel_width % 2 or args.panel_height % 2:
        p.error('Panel dimensions must be positive even integers; fps positive')
    output = args.out.resolve()
    if output in [args.reference.resolve(), args.candidate.resolve()]:
        p.error('Output must differ from both inputs')
    if output.suffix.lower() != '.mp4':
        p.error('Output must end in .mp4')
    labels_target = output.with_suffix('.labels.png')
    report_target = output.with_suffix('.comparison.json')
    require_new([output, labels_target, report_target])
    probes=[]
    for src, start in [(args.reference, args.reference_start), (args.candidate, args.candidate_start)]:
        probe=json.loads(run([args.ffprobe, '-v', 'error', '-show_entries', 'stream=codec_type,duration:format=duration', '-of', 'json', str(src)]));probes.append(probe)
        video=next(s for s in probe['streams'] if s['codec_type']=='video')
        length=float(video.get('duration',probe['format']['duration']))
        if length+0.02 < start+args.duration:
            p.error(f'{src}: requested range exceeds source duration {length}')
    audio_index={'reference':0,'candidate':1}.get(args.audio)
    if audio_index is not None and not any(s['codec_type']=='audio' for s in probes[audio_index]['streams']):
        p.error('Selected audio source has no audio stream')
    output.parent.mkdir(parents=True, exist_ok=True)
    # Header uses tiny bitmap glyphs, avoiding system-font or drawtext dependencies.
    from PIL import Image, ImageDraw
    temporary = tempfile.TemporaryDirectory(prefix='.pixel-compare-', dir=output.parent)
    header=Path(temporary.name)/'labels.png'
    encoded=Path(temporary.name)/'encoded.mp4'
    image=Image.new('RGB',(args.panel_width*2,40),'#14252d');draw=ImageDraw.Draw(image)
    draw.text((16,13),'REFERENCE',fill='#e8ca79');draw.text((args.panel_width+16,13),'CANDIDATE',fill='#d7ef80');image.save(header)
    filt=[]
    for i,start in enumerate([args.reference_start,args.candidate_start]):
        filt.append(f'[{i}:v]setpts=PTS-STARTPTS,trim=start={start}:duration={args.duration},setpts=PTS-STARTPTS,fps={args.fps},scale={args.panel_width}:{args.panel_height}:force_original_aspect_ratio=decrease,pad={args.panel_width}:{args.panel_height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v{i}]')
    filt.extend(['[v0][v1]hstack=inputs=2[panels]','[2:v][panels]vstack=inputs=2[v]'])
    cmd=[args.ffmpeg,'-hide_banner','-v','error','-n','-i',str(args.reference),'-i',str(args.candidate),'-loop','1','-framerate',str(args.fps),'-i',str(header)]
    if audio_index is not None:
        start=[args.reference_start,args.candidate_start][audio_index]
        filt.append(f'[{audio_index}:a]asetpts=PTS-STARTPTS,atrim=start={start}:duration={args.duration},asetpts=PTS-STARTPTS,apad,atrim=duration={args.duration}[a]')
    cmd+=['-filter_complex',';'.join(filt),'-map','[v]']
    cmd+=['-map','[a]','-c:a','aac'] if audio_index is not None else ['-an']
    cmd+=['-t',str(args.duration),'-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(encoded)]
    run(cmd)
    run([args.ffmpeg,'-v','error','-i',str(encoded),'-f','null','-'])
    result={'output':output.name,'left':'reference','right':'candidate','speed':1,'duration':args.duration,
            'offsets':[args.reference_start,args.candidate_start],'audio':args.audio,'decode':'passed'}
    publish(encoded,output)
    publish(header,labels_target)
    with report_target.open('x',encoding='utf-8') as report:
        report.write(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    temporary.cleanup()
    print(json.dumps(result,ensure_ascii=False))


if __name__=='__main__':
    main()
