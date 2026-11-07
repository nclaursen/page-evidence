import fs from 'node:fs';
import path from 'node:path';
import {config,pageKey,type Config} from './core.js';

export const INVENTORY_LIMITS={files:500,entries:5000,fileBytes:256*1024,urls:2000,mappings:5} as const;
const extensions=/\.(md|mdx|astro|html)$/i;
const ignored=new Set(['node_modules','.git','dist','.astro','outputs','drafts']);

/** Local source references are evidence of references, not proof of published routes. */
export function urlInventory(limit=50,c:Config=config()){
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('limit must be a whole number from 1 to 100.');
  const identity={profile:c.profile,site:{domain:c.domain,gscProperty:c.gscProperty},analyticsProvider:c.analyticsProvider};
  const source={type:'repository',configured:Boolean(c.repositoryPath),sitemapConfigured:Boolean(c.sitemapUrl)};
  const limitation='Only configured local source is inspected. URL references are not proof of published pages; explicit frontmatter url/canonical/permalink declarations are source declarations, not verified routes. Filename candidates are not mappings. Dynamic routes, HTML canonicals, relative declarations and sitemap fetching are unsupported. No crawl or analytics comparison.';
  if(!c.repositoryPath)return{...identity,source,state:'unavailable',reason:'PAGE_EVIDENCE_REPOSITORY_PATH is not configured; sitemap fetching is not supported by this inventory.',urls:[],limitation};
  const known=new Map<string,{url:string;declaredSources:string[];referenceSources:string[]}>();
  const inspected:{file:string;slug:string;declared:boolean}[]=[],unmappedSourceFiles:string[]=[];
  let entries=0,filesInspected=0,skippedOversize=0,readFailures=0,truncated=false,mappingTruncated=false;
  function record(raw:string,file:string,declared:boolean){
    let parsed:URL;try{parsed=new URL(raw)}catch{return false}
    if(parsed.username||parsed.password||raw.length>4096||!pageKey(parsed.href,c))return false;
    const key=pageKey(parsed.href,c)!;let row=known.get(key);
    if(!row){if(known.size>=INVENTORY_LIMITS.urls){truncated=true;return false}row={url:parsed.href,declaredSources:[],referenceSources:[]};known.set(key,row)}
    const sources=declared?row.declaredSources:row.referenceSources;
    if(!sources.includes(file)){if(sources.length<INVENTORY_LIMITS.mappings)sources.push(file);else mappingTruncated=true}
    return true;
  }
  function scan(directory:string){
    const handle=fs.opendirSync(directory);
    try{let entry:fs.Dirent|null;while((entry=handle.readSync())){
      if(++entries>INVENTORY_LIMITS.entries||filesInspected>=INVENTORY_LIMITS.files){truncated=true;break}
      if(ignored.has(entry.name)||/^node_modules[.\s-]/.test(entry.name)||entry.isSymbolicLink())continue;
      const full=path.join(directory,entry.name);
      if(entry.isDirectory()){scan(full);if(truncated&&(entries>INVENTORY_LIMITS.entries||filesInspected>=INVENTORY_LIMITS.files))break;continue}
      if(!entry.isFile()||!extensions.test(entry.name))continue;
      let text:string;try{const size=fs.statSync(full).size;if(size>INVENTORY_LIMITS.fileBytes){skippedOversize++;continue}text=fs.readFileSync(full,'utf8');if(Buffer.byteLength(text)>INVENTORY_LIMITS.fileBytes){skippedOversize++;continue}}catch{readFailures++;continue}
      filesInspected++;const file=path.relative(c.repositoryPath!,full);let declared=false;
      const frontmatter=/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1]||'';
      for(const match of frontmatter.matchAll(/^(?:url|canonical|permalink):\s*["']?(https?:\/\/[^\s"'<>]+)["']?\s*$/gm))declared=record(match[1],file,true)||declared;
      for(const match of text.matchAll(/https?:\/\/[^\s<>"'`\]\)]+/g))record(match[0],file,false);
      inspected.push({file,slug:path.basename(file).replace(extensions,''),declared});
      if(!declared)unmappedSourceFiles.push(file);
    }}finally{handle.closeSync()}
  }
  try{scan(c.repositoryPath)}catch{readFailures++}
  const rows=[...known.values()].sort((a,b)=>a.url.localeCompare(b.url));
  const urls=rows.slice(0,limit).map(row=>{
    const slug=new URL(row.url).pathname.replace(/\/+$/,'').split('/').pop();
    const candidates=inspected.filter(file=>file.slug===slug&&!row.declaredSources.includes(file.file));
    return{...row,mapping:row.declaredSources.length?'declared_url':'unmapped',filenameCandidates:candidates.slice(0,INVENTORY_LIMITS.mappings).map(file=>file.file),filenameCandidatesTruncated:candidates.length>INVENTORY_LIMITS.mappings};
  });
  return{...identity,source,state:readFailures||truncated||skippedOversize?'partial':'available',checkedAt:new Date().toISOString(),urls,unmappedSourceFiles:unmappedSourceFiles.slice(0,limit),
    coverage:{filesInspected,entriesInspected:entries,knownUrls:rows.length,declaredUrls:rows.filter(row=>row.declaredSources.length).length,unmappedUrls:rows.filter(row=>!row.declaredSources.length).length,unmappedSourceFiles:unmappedSourceFiles.length,readFailures,skippedOversize,scanTruncated:truncated,urlsTruncated:rows.length>limit,unmappedSourceFilesTruncated:unmappedSourceFiles.length>limit,mappingTruncated,limits:INVENTORY_LIMITS,ignoredDirectories:[...ignored],symlinksFollowed:false},limitation};
}
