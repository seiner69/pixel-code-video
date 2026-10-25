import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assetPath, requireNew, publish} from '../scripts/runtime.mjs';
import {sample} from '../assets/starter/src/motion.js';

const root=fileURLToPath(new URL('../',import.meta.url));
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pixel-test-'));try{return fn(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}

test('repeat and reverse seeking preserve state and event ownership',()=>{
 const times=[0,1.2,1.5,2.5,3.5,3.9,4.65,5.2,6];
 const states=times.map(t=>sample(t));
 for(const t of [...times].reverse()) assert.deepEqual(sample(t),states[times.indexOf(t)]);
 assert.equal(sample(2.5).carrying,true);
 assert.equal(sample(4).carrying,false);
 assert.equal(sample(4).cardVisible,false);
 assert.equal(sample(4).productVisible,false);
 assert.equal(sample(5.5).productVisible,true);
 assert.equal(sample(5.5).result,true);
});
test('sample duration scaling and clamped endpoints',()=>{
 assert.deepEqual(sample(-1),sample(0));assert.deepEqual(sample(7),sample(6));
 assert.deepEqual(sample(2,12),sample(1,6));
});
test('publication rejects a competing writer after preflight',()=>fixture(dir=>{
 const a=path.join(dir,'a'),b=path.join(dir,'b');fs.writeFileSync(a,'new');requireNew([b]);fs.writeFileSync(b,'keep');
 assert.throws(()=>publish(a,b));assert.equal(fs.readFileSync(b,'utf8'),'keep');
}));
test('successful publication survives temporary file removal',()=>fixture(dir=>{
 const a=path.join(dir,'a'),b=path.join(dir,'b');fs.writeFileSync(a,'new');publish(a,b);fs.unlinkSync(a);assert.equal(fs.readFileSync(b,'utf8'),'new');
}));
test('server allowlist excludes hidden and unrelated files',()=>fixture(dir=>{
 fs.mkdirSync(path.join(dir,'src'));fs.writeFileSync(path.join(dir,'studio.html'),'ok');fs.writeFileSync(path.join(dir,'config.json'),'{}');
 fs.writeFileSync(path.join(dir,'src','film.js'),'ok');fs.writeFileSync(path.join(dir,'src','.private.js'),'secret');
 assert.equal(assetPath(dir,'/'),path.join(dir,'studio.html'));
 assert.equal(assetPath(dir,'/src/film.js'),path.join(dir,'src','film.js'));
 for(const name of ['/secret.json','/.env','/src/.private.js','/src/../../secret.json','/%2e%2e/secret.json'])assert.equal(assetPath(dir,name),null);
}));
test('server rejects directory junction escaping the root',()=>fixture(dir=>{
 const project=path.join(dir,'project'),outside=path.join(dir,'outside');fs.mkdirSync(project);fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'film.js'),'outside');
 fs.symlinkSync(outside,path.join(project,'src'),process.platform==='win32'?'junction':'dir');
 assert.equal(assetPath(project,'/src/film.js'),null);
}));
test('renderer rejects existing sidecars before loading browser dependencies',()=>fixture(dir=>{
 fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({width:100,height:100,fps:1,frames:1,duration:1}));
 for(const suffix of ['.mp4','.render-report.json','.frames']){
  const marker=path.join(dir,'result'+suffix);fs.writeFileSync(marker,'keep');
  const r=spawnSync(process.execPath,[path.join(root,'scripts/render.mjs'),'--project',dir,'--out',path.join(dir,'result.mp4')],{encoding:'utf8'});
  assert.notEqual(r.status,0);assert.match(r.stderr,/Output already exists/);assert.equal(fs.readFileSync(marker,'utf8'),'keep');fs.unlinkSync(marker);
 }
}));
