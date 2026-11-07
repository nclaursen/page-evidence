import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach,describe,expect,it} from 'vitest';
import {urlInventory,INVENTORY_LIMITS} from '../src/url-inventory.js';
import type {Config} from '../src/core.js';
const roots:string[]=[];
const setup=()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'inventory-test-'));roots.push(root);return{root,c:{repositoryPath:root,domain:'example.test',profile:'synthetic',gscProperty:'sc-domain:example.test',analyticsProvider:'none',trackingParams:['utm_source']} as Config}};
afterEach(()=>{for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true})});
describe('bounded local URL inventory',()=>{
  it('distinguishes declared URL mappings from references and filename candidates',()=>{
    const {root,c}=setup();
    fs.writeFileSync(path.join(root,'known.md'),'---\ncanonical: "https://example.test/known/"\n---\n[Other](https://example.test/other/)\nhttps://foreign.test/no\nhttps://user:secret@example.test/no');
    fs.writeFileSync(path.join(root,'other.mdx'),'# Other\nA filename is not a published URL.');
    const result=urlInventory(50,c);
    expect(result.urls).toHaveLength(2);
    expect(result.urls[0]).toMatchObject({url:'https://example.test/known/',mapping:'declared_url',declaredSources:['known.md']});
    expect(result.urls[1]).toMatchObject({mapping:'unmapped',referenceSources:['known.md'],filenameCandidates:['other.mdx']});
    expect(result.unmappedSourceFiles).toEqual(['other.mdx']);
    expect(result.coverage).toMatchObject({knownUrls:2,declaredUrls:1,unmappedUrls:1});
  });
  it('discloses absent repository and unsupported sitemap-only setup',()=>{
    const {c}=setup();expect(urlInventory(50,{...c,repositoryPath:'',sitemapUrl:'https://example.test/sitemap.xml'})).toMatchObject({state:'unavailable',source:{sitemapConfigured:true},urls:[]});
    expect(urlInventory(50,{...c,repositoryPath:'/missing-inventory-synthetic-path'})).toMatchObject({state:'partial',coverage:{readFailures:1}});
  });
  it('excludes dependency copies, ignored outputs and symlink directories',()=>{
    const {root,c}=setup();for(const folder of ['node_modules','node_modules 2','node_modules.old','outputs']){fs.mkdirSync(path.join(root,folder));fs.writeFileSync(path.join(root,folder,'hidden.md'),'https://example.test/hidden')}
    const outside=fs.mkdtempSync(path.join(os.tmpdir(),'inventory-external-'));roots.push(outside);fs.writeFileSync(path.join(outside,'hidden.md'),'https://example.test/symlink');fs.symlinkSync(outside,path.join(root,'linked'));
    expect(urlInventory(50,c)).toMatchObject({urls:[],coverage:{filesInspected:0,symlinksFollowed:false}});
  });
  it('bounds returned URLs and mappings and reports omitted rows',()=>{
    const {root,c}=setup();for(let i=0;i<8;i++)fs.writeFileSync(path.join(root,`${i}.md`),'https://example.test/a\nhttps://example.test/b');
    const result=urlInventory(1,c);expect(result.urls).toHaveLength(1);expect(result.urls[0].referenceSources).toHaveLength(5);expect(result.coverage).toMatchObject({urlsTruncated:true,mappingTruncated:true});
    expect(()=>urlInventory(101,c)).toThrow('limit');
  });
  it('skips oversized files and stops at the file scan bound',()=>{
    const {root,c}=setup();fs.writeFileSync(path.join(root,'oversize.md'),'x'.repeat(INVENTORY_LIMITS.fileBytes+1));
    expect(urlInventory(50,c)).toMatchObject({state:'partial',coverage:{skippedOversize:1,filesInspected:0}});
    for(let i=0;i<502;i++)fs.writeFileSync(path.join(root,`page-${i}.md`),'https://example.test/a');
    const result=urlInventory(50,c);expect(result.coverage?.filesInspected).toBe(500);expect(result.coverage?.scanTruncated).toBe(true);
  });
});
