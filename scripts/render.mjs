#!/usr/bin/env node
// Canvas frame export, with explicit dependencies and deterministic seek checks.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {requireNew, publish, assetPath} from './runtime.mjs';

const help=`node render.mjs --project DIR --out FILE.mp4 [--chrome EXE] [--audio FILE]
  [--dependency-root DIR] [--ffmpeg EXE] [--ffprobe EXE]
The project contains config.json, studio.html and window.ready/renderAt().
Default output is silent. Audio is trimmed/padded to the requested frame duration.
Install puppeteer-core in the project, or supply a dependency root containing it.`;
const opts={};
for(let i=2;i<process.argv.length;i++){const key=process.argv[i];if(key==='--help'){console.log(help);process.exit(0);}if(!['--project','--out','--chrome','--audio','--dependency-root','--ffmpeg','--ffprobe'].includes(key)||!process.argv[i+1])throw Error(`Invalid argument: ${key}\n${help}`);opts[key.slice(2)]=process.argv[++i];}
if(!opts.project||!opts.out)throw Error(help);
const root=path.resolve(opts.project),out=path.resolve(opts.out);
const cfg=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8'));
const {width,height,fps,frames}=cfg;
if(![width,height,fps,frames].every(x=>Number.isInteger(x)&&x>0)||width%2||height%2)throw Error('config: width/height must be even; fps/frames positive integers');
if(!Number.isFinite(cfg.duration)||Math.abs(cfg.duration-frames/fps)>1e-8)throw Error('config duration must equal frames / fps');
if(path.extname(out).toLowerCase()!=='.mp4')throw Error('--out must end in .mp4');
if(opts.audio&&!fs.existsSync(opts.audio))throw Error(`Missing audio: ${opts.audio}`);
const frameDir=out.replace(/\.mp4$/i,'.frames');
const reportPath=out.replace(/\.mp4$/i,'.render-report.json');
requireNew([out,frameDir,reportPath]);
const localRequire=createRequire(path.join(path.resolve(opts['dependency-root']||root),'package.json'));
let puppeteer;try{const mod=localRequire('puppeteer-core');puppeteer=mod.default||mod;}catch{throw Error('Install puppeteer-core in project or provide --dependency-root.');}
const candidates=[opts.chrome,process.env.CHROME_PATH,
 process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Google/Chrome/Application/chrome.exe'),
 process.env['PROGRAMFILES(X86)']&&path.join(process.env['PROGRAMFILES(X86)'],'Microsoft/Edge/Application/msedge.exe'),
 '/usr/bin/google-chrome','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const chrome=candidates.find(x=>x&&fs.existsSync(x));if(!chrome)throw Error('Chrome not found; supply --chrome EXE');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.mkdirSync(frameDir);
const temporaryOutput=path.join(frameDir,'encoded.mp4');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.png':'image/png'};
const server=http.createServer((req,res)=>{
 try{
  if(req.method!=='GET'||req.headers.host!==`127.0.0.1:${server.address().port}`){res.writeHead(403);res.end();return;}
  const file=assetPath(root,req.url);if(!file){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(400);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const hash=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const checks=[...new Set([0,Math.floor(frames*.23),Math.floor(frames*.51),frames-1])];const hashes={};
function run(exe,args){const r=spawnSync(exe,args,{encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true});if(r.error||r.status!==0)throw Error(`${exe} failed: ${r.error?.message||r.stderr}`);return r.stdout;}
try{
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--disable-gpu','--hide-scrollbars']});
 const page=await browser.newPage();await page.setViewport({width,height,deviceScaleFactor:1});
 const runtimeErrors=[];page.on('pageerror',e=>runtimeErrors.push(e.message));
 // Media preview elements may keep range requests open; the composition's ready
 // promise, not network idleness, owns font/config/render readiness.
 await page.goto(`http://127.0.0.1:${server.address().port}/studio.html?render`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction('window.ready !== undefined');await page.evaluate(async()=>await window.ready);
 for(let n=0;n<frames;n++){
  const data=await page.evaluate(t=>window.renderAt(t),n/fps);const png=Buffer.from(data.split(',')[1],'base64');
  fs.writeFileSync(path.join(frameDir,`f${String(n).padStart(6,'0')}.png`),png);if(checks.includes(n))hashes[n]=hash(png);
  if(n%fps===0)console.log(`Rendered ${n}/${frames}`);
 }
 const seekChecks=[];for(const n of [...checks].reverse().concat(checks)){
  const data=await page.evaluate(t=>window.renderAt(t),n/fps);const actual=hash(Buffer.from(data.split(',')[1],'base64'));
  seekChecks.push({frame:n,match:actual===hashes[n]});
 }
 if(seekChecks.some(x=>!x.match))throw Error('Out-of-order seeking changed the output. Repair state handling before export.');
 if(runtimeErrors.length)throw Error(`Browser errors: ${runtimeErrors.join('; ')}`);
 const ffmpeg=opts.ffmpeg||'ffmpeg',ffprobe=opts.ffprobe||'ffprobe';
 const args=['-hide_banner','-loglevel','error','-n','-framerate',String(fps),'-i',path.join(frameDir,'f%06d.png')];
 if(opts.audio)args.push('-i',path.resolve(opts.audio),'-filter_complex',`[1:a:0]apad,atrim=duration=${frames/fps},asetpts=PTS-STARTPTS[a]`,'-map','0:v:0','-map','[a]','-c:a','aac','-b:a','192k');else args.push('-an');
 args.push('-frames:v',String(frames),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',temporaryOutput);
 run(ffmpeg,args);
 run(ffmpeg,['-hide_banner','-v','error','-i',temporaryOutput,'-f','null','-']);
 const probe=JSON.parse(run(ffprobe,['-v','error','-count_frames','-show_entries','stream=codec_name,codec_type,width,height,avg_frame_rate,nb_read_frames,duration:format=duration','-of','json',temporaryOutput]));
 const video=probe.streams.find(s=>s.codec_type==='video');if(Number(video.nb_read_frames)!==frames||video.width!==width||video.height!==height)throw Error('Encoded video specification mismatch');
 const report={output:path.basename(out),audio:opts.audio?'provided':'silent',frames,duration:frames/fps,seekChecks,probe,decode:'passed',renderer:'Canvas via Puppeteer; FFmpeg encode'};
 publish(temporaryOutput,out);
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 fs.unlinkSync(temporaryOutput);
 console.log(JSON.stringify({output:out,report:reportPath,frames,seekChecks:'passed'}));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
