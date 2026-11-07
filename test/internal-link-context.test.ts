import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach,expect,it,vi} from 'vitest';
import {config} from '../src/core.js';
import {internalLinkContext,repositoryContext,pageSourceContext,sourceLinkEvidence} from '../src/context.js';
let dir:string|undefined;
afterEach(()=>{vi.unstubAllEnvs();if(dir)fs.rmSync(dir,{recursive:true,force:true});dir=undefined});
function setup(){vi.stubEnv('SITE_DOMAIN','example.test');vi.stubEnv('GSC_PROPERTY','sc-domain:example.test');vi.stubEnv('PAGE_EVIDENCE_SITEMAP_URL','');vi.stubEnv('SITE_SIGNAL_SITEMAP_URL','')}
it('returns anchors and line evidence for exact target links, preserving host and path boundaries',()=>{
  setup();const text='[Good](/target#answer)\n<a href="https://example.test/target">HTML</a>\n[Ref][x]\n[x]: /target\n[Other](/target-extra)\n[Foreign](https://other.test/target)\n[Unknown](../target)';
  const result=sourceLinkEvidence(text,'https://example.test/target',config());
  expect(result.count).toBe(3);expect(result.links.map(link=>link.anchor)).toEqual(['Good','HTML','Ref']);expect(result.links[1].line).toBe(2);
});
it('returns bounded surrounding passages and separates already linked sources',async()=>{
  setup();dir=fs.mkdtempSync(path.join(os.tmpdir(),'page-evidence-links-'));vi.stubEnv('PAGE_EVIDENCE_REPOSITORY_PATH',dir);
  fs.writeFileSync(path.join(dir,'target.md'),'Useful enterprise text');
  fs.writeFileSync(path.join(dir,'linked.md'),'Useful enterprise [answer](/target).');
  fs.writeFileSync(path.join(dir,'mention.md'),'A plain mention /target does not establish a link.\n'+ 'x'.repeat(700)+' enterprise makes this passage relevant.');
  fs.writeFileSync(path.join(dir,'metadata.md'),'---\ntitle: enterprise\n---\nUnrelated text');
  for(let i=0;i<22;i++)fs.writeFileSync(path.join(dir,`candidate-${i}.md`),'Useful enterprise question.');
  const result=await internalLinkContext('https://example.test/target',['enterprise']);
  expect(result.verifiedOpportunities).toHaveLength(20);expect(result.coverage).toMatchObject({candidateCount:23,candidatesTruncated:true,existingLinkFiles:1});
  expect(result.existingLinks[0]).toMatchObject({file:path.join(dir,'linked.md'),evidence:{count:1}});
  const excerpt=result.verifiedOpportunities[0].excerpts[0];expect(excerpt.text).toContain('enterprise');expect(excerpt.text.length).toBeLessThanOrEqual(500);
});
it('reports unavailable repository evidence and rejects foreign targets',async()=>{
  setup();vi.stubEnv('PAGE_EVIDENCE_REPOSITORY_PATH','');vi.stubEnv('SITE_SIGNAL_REPOSITORY_PATH','');
  const result=await internalLinkContext('https://example.test/target',['enterprise']);expect(result.repository.configured).toBe(false);expect(result.coverage.filesInspected).toBe(0);
  await expect(internalLinkContext('https://other.test/target')).rejects.toThrow('configured site');
});

it.each([
  '![Image][target]\n[target]: /target',
  '<a data-href="/target">No destination</a>',
  '<!-- <a href="/target">Old link</a> -->',
  '```md\n[Example](/target)\n```',
  '~~~md\n[Example](/target)\n~~~',
  '`[Example](/target)`',
  '```md\n[Example](/target)',
  '```md\n[target]: /target\n```\n[Answer][target]',
])('does not treat non-link source as an existing target link: %s',text=>{
  setup();expect(sourceLinkEvidence(text,'https://example.test/target',config()).count).toBe(0);
});

it.each([
  '[Answer](/target_(guide))',
  '[Answer](/target_(guide) "Guide")',
  '[Answer](</target_(guide)>)',
  '[Answer](/target_\\(guide\\))',
])('recognises Markdown destinations with parentheses: %s',text=>{
  setup();expect(sourceLinkEvidence(text,'https://example.test/target_(guide)',config())).toMatchObject({count:1,links:[{anchor:'Answer'}]});
});

it('preserves line numbers after ignored examples and recognises nested destinations',()=>{
  setup();const text='```md\n[Example](/target_(nested_(guide)))\n```\n<!-- old -->\n[Answer](/target_(nested_(guide)))';
  expect(sourceLinkEvidence(text,'https://example.test/target_(nested_(guide))',config())).toMatchObject({count:1,links:[{line:5,anchor:'Answer'}]});
});

it('keeps relevant source as a candidate when its only target reference is a code example',async()=>{
  setup();dir=fs.mkdtempSync(path.join(os.tmpdir(),'page-evidence-links-'));vi.stubEnv('PAGE_EVIDENCE_REPOSITORY_PATH',dir);
  fs.writeFileSync(path.join(dir,'candidate.md'),'Enterprise content.\n```md\n[Example](/target)\n```');
  const result=await internalLinkContext('https://example.test/target',['enterprise']);
  expect(result.coverage).toMatchObject({candidateCount:1,existingLinkFiles:0});
  expect(result.verifiedOpportunities).toHaveLength(1);
});

it('excludes dependency copies from mapping, excerpts and link candidates while retaining site source',async()=>{
  setup();dir=fs.mkdtempSync(path.join(os.tmpdir(),'page-evidence-links-'));vi.stubEnv('PAGE_EVIDENCE_REPOSITORY_PATH',dir);
  const source=path.join(dir,'src','candidate.md');fs.mkdirSync(path.dirname(source),{recursive:true});
  fs.writeFileSync(source,'Enterprise source links to [answer](/target).');
  for(const name of ['node_modules','node_modules 2','node_modules.nosync','node_modules-backup']){
    const dependency=path.join(dir,name,'package');fs.mkdirSync(dependency,{recursive:true});
    fs.writeFileSync(path.join(dependency,'README.md'),'Enterprise dependency [answer](/target).');
  }
  const repository=await repositoryContext('https://example.test/target');
  expect(repository.sourceFiles).toEqual([{file:source,mapping:'direct_url_reference'}]);
  const context=await pageSourceContext('https://example.test/target',['enterprise']);
  expect(context.sources?.map(item=>item.file)).toEqual([source]);
  const links=await internalLinkContext('https://example.test/target',['enterprise']);
  expect(links.coverage).toMatchObject({filesInspected:1,existingLinkFiles:1,candidateCount:0});
  expect(links.existingLinks.map(item=>item.file)).toEqual([source]);
});
