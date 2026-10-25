"""Copy the editable starter; refuse to overwrite an existing project."""
import argparse
import json
import math
import shutil
from pathlib import Path


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', required=True, type=Path)
    p.add_argument('--title', default='需求先聚集')
    p.add_argument('--duration', type=float, default=6)
    p.add_argument('--fps', type=int, default=30)
    p.add_argument('--width', type=int, default=1280)
    p.add_argument('--height', type=int, default=720)
    args = p.parse_args()
    if not math.isfinite(args.duration) or args.duration <= 0 or args.fps <= 0:
        p.error('duration and fps must be positive and finite')
    if min(args.width, args.height) < 2 or args.width % 2 or args.height % 2:
        p.error('width and height must be positive even integers')
    out = args.out.resolve()
    if out.exists():
        p.error('Use a new project directory; existing destinations are never overwritten')
    source = Path(__file__).resolve().parents[1] / 'assets' / 'starter'
    frames = max(1, round(args.duration * args.fps))
    shutil.copytree(source, out, dirs_exist_ok=False)
    config_path = out / 'config.json'
    config = json.loads(config_path.read_text(encoding='utf-8'))
    config.update(title=args.title, duration=frames/args.fps, frames=frames,
                  fps=args.fps, width=args.width, height=args.height)
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (out / 'BRIEF.md').write_text(
        f'# {args.title}\n\n{args.width}×{args.height}, {args.fps} fps, {frames} 帧，{frames/args.fps:.3f} 秒。\n\n'
        '这是原创静音功能样例；更换文案时重新编排动作与最终配音。\n\n'
        '| 标准 6 秒时间 | 理解目标 | 动作与状态 |\n|---|---|---|\n'
        '| 0–1.5 | 零散需求可聚集 | 三张需求卡聚合；手与订单接触后持有 |\n'
        '| 1.5–3.9 | 订单交给生产者 | 角色持卡行走，到工厂投递；订单归工厂 |\n'
        '| 3.9–5.2 | 订单触发生产 | 指示灯亮，生产后产品出厂落地 |\n'
        '| 5.2–6 | 看清结果 | 人物、产品位置保持，字幕说明结果 |\n\n'
        '其他时长只对样例按比例缩放；实际创作按新文案重定时。\n', encoding='utf-8')
    print(json.dumps({'project': str(out), 'frames': frames, 'duration': frames/args.fps}, ensure_ascii=False))


if __name__ == '__main__':
    main()
