import fs from 'node:fs';
import path from 'node:path';
import {config,normalize,pageKey,type Config} from './core.js';

const sourceExtensions=/\.(md|mdx|astro|html)$/i;
const ignoredDirectories=new Set(['node_modules','.git','dist']);
const files=(directory:string,output:string[]=[]):string[]=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(ignoredDirectories.has(entry.name)||/^node_modules\./.test(entry.name))continue;const full=path.join(directory,entry.name);if(entry.isDirectory())files(full,output);else if(sourceExtensions.test(entry.name))output.push(full)}return output};
const slugFor=(url:string,c:any)=>normalize(url,c).replace(/^\/+|\/+$/g,'').split('/').pop()||'';
const titleFor=(text:string)=>/^title:\s*["']?(.+?)["']?\s*$/m.exec(text)?.[1]||null;
const stopWords=new Set(['about','after','also','and','are','can','content','does','for','from','have','how','into','more','that','the','this','what','when','where','which','with','your']);
const searchableTerms=(terms:string[])=>[...new Set(terms.flatMap(term=>term.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]{3,}/gu)||[]).filter(term=>!stopWords.has(term)))].slice(0,20);

export function contentEvidence(text:string,terms:string[]){const wanted=searchableTerms(terms),body=text.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/,'').trim(),lines=body.split(/\r?\n/),headings=lines.flatMap(line=>{const match=/^(#{1,6})\s+(.+?)\s*$/.exec(line);if(!match)return[];const matchedTerms=wanted.filter(term=>match[2].toLocaleLowerCase().includes(term));return matchedTerms.length?[{level:match[1].length,heading:match[2],matchedTerms}]:[]}),excerpts=body.split(/\n\s*\n/).map(part=>part.replace(/\s+/g,' ').trim()).filter(part=>part&&!/^#{1,6}\s/.test(part)).flatMap(part=>{const matchedTerms=wanted.filter(term=>part.toLocaleLowerCase().includes(term));return matchedTerms.length?[{text:part.slice(0,500),matchedTerms}]:[]}).slice(0,5);return{title:titleFor(text),matchingHeadings:headings.slice(0,10),excerpts}}

function mappedFiles(url:string,c:any){if(!c.repositoryPath||!fs.existsSync(c.repositoryPath))return[];const key=normalize(url,c),slug=slugFor(url,c);return files(c.repositoryPath).flatMap(file=>{const text=fs.readFileSync(file,'utf8'),base=path.basename(file).replace(sourceExtensions,'');if(text.includes(key)||text.includes(url))return[{file,text,mapping:'direct_url_reference'}];if(base===slug)return[{file,text,mapping:'filename_slug'}];return[]}).slice(0,20)}

export async function repositoryContext(url:string){const c=config(),key=normalize(url,c);if(!c.repositoryPath)return{configured:false,reason:'PAGE_EVIDENCE_REPOSITORY_PATH is not configured.'};if(!fs.existsSync(c.repositoryPath))return{configured:false,reason:'Configured repository path does not exist.'};const sourceFiles=mappedFiles(url,c).map(({file,mapping})=>({file,mapping}));return{configured:true,targetPath:key,sourceFiles,limitation:'Only configured local source files are inspected. URL mapping is either a direct URL reference or an exact filename-slug match; an empty result is valid.'}}

export async function pageSourceContext(url:string,terms:string[]=[]){const c=config(),key=normalize(url,c);if(!c.repositoryPath)return{configured:false,reason:'PAGE_EVIDENCE_REPOSITORY_PATH is not configured.'};if(!fs.existsSync(c.repositoryPath))return{configured:false,reason:'Configured repository path does not exist.'};const sources=mappedFiles(url,c).map(({file,text,mapping})=>({file,mapping,...contentEvidence(text,terms)}));return{configured:true,targetPath:key,terms:searchableTerms(terms),sources,limitation:'Source context is bounded excerpts and headings from explicitly configured local files. It shows matching text, not whether the page answers the question well.'}}

export function sourceLinkEvidence(text:string,target:string,c:Config){
  const targetKey=pageKey(target,c),links:{href:string;anchor:string;line:number;excerpt:string}[]=[];
  // Source is not a rendered DOM: dynamic expressions and custom components remain unknown.
  const definitions=new Map([...text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?/gm)].map(match=>[match[1].trim().toLowerCase(),match[2]]));
  const pattern=/(?<!!)\[([^\]\n]+)\]\(\s*<?([^\s)>]+)>?(?:\s+[^)]*)?\)|\[([^\]\n]+)\]\[([^\]\n]*)\]|<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\5[^>]*>([\s\S]*?)<\/a>/gi;
  for(const match of text.matchAll(pattern)){
    const href=match[2]||definitions.get((match[4]||match[3]||'').trim().toLowerCase())||match[6];
    if(!href)continue;
    // A relative link cannot be resolved safely without the source page's published URL.
    if(!/^(https?:\/\/|\/)/i.test(href))continue;
    let key:string|null=null;try{key=pageKey(new URL(href,target).href,c)}catch{continue}
    if(!targetKey||key!==targetKey)continue;
    const index=match.index??0;
    links.push({href,anchor:(match[1]||match[3]||match[7]||'').replace(/<[^>]*>/g,'').slice(0,200),line:text.slice(0,index).split('\n').length,excerpt:text.slice(Math.max(0,index-120),index+match[0].length+120).replace(/\s+/g,' ').slice(0,500)});
  }
  return{links:links.slice(0,5),count:links.length,truncated:links.length>5};
}

function matchingExcerpts(text:string,terms:string[]){
  const bodyStart=text.startsWith('---')?(text.match(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/)?.[0].length??0):0;
  const body=text.slice(bodyStart),lower=body.toLocaleLowerCase();
  return terms.flatMap(term=>{const index=lower.indexOf(term.toLocaleLowerCase());if(index<0)return[];const start=Math.max(0,index-120),end=Math.min(body.length,index+term.length+220);return[{matchedTerms:[term],line:text.slice(0,bodyStart+index).split('\n').length,text:body.slice(start,end).replace(/\s+/g,' ').slice(0,500)}]}).slice(0,3);
}

export async function internalLinkContext(url:string,terms:string[]=[]){
  const c=config();if(!pageKey(url,c))throw Error('URL must belong to the configured site and use HTTP or HTTPS.');
  const repo=await repositoryContext(url),key=normalize(url,c);let sitemap:any={configured:false};
  if(c.sitemapUrl){try{const text=await(await fetch(c.sitemapUrl)).text();sitemap={configured:true,containsTarget:text.includes(url)||text.includes(key)}}catch{sitemap={configured:true,error:'Could not fetch configured sitemap.'}}}
  const wanted=searchableTerms(terms),verifiedOpportunities:{file:string;matchedTerms:string[];excerpts:ReturnType<typeof matchingExcerpts>;existingLinkCount:number}[]=[],existingLinks:{file:string;evidence:ReturnType<typeof sourceLinkEvidence>}[]=[];
  let filesInspected=0,candidateCount=0,existingLinkFiles=0;
  if(c.repositoryPath&&fs.existsSync(c.repositoryPath))for(const file of files(c.repositoryPath)){
    filesInspected++;const text=fs.readFileSync(file,'utf8'),evidence=sourceLinkEvidence(text,url,c);
    if(evidence.count){existingLinkFiles++;if(existingLinks.length<20)existingLinks.push({file,evidence});continue}
    if(path.basename(file).replace(sourceExtensions,'')===slugFor(url,c))continue;
    const excerpts=matchingExcerpts(text,wanted),matchedTerms=[...new Set(excerpts.flatMap(excerpt=>excerpt.matchedTerms))];
    if(matchedTerms.length){candidateCount++;if(verifiedOpportunities.length<20)verifiedOpportunities.push({file,matchedTerms,excerpts,existingLinkCount:0})}
  }
  return{profile:c.profile,site:{domain:c.domain,gscProperty:c.gscProperty},analyticsProvider:c.analyticsProvider,target:url,repository:repo,sitemap,verifiedOpportunities,existingLinks,coverage:{filesInspected,candidateCount,existingLinkFiles,candidateLimit:20,existingLinkFileLimit:20,candidatesTruncated:candidateCount>20,existingLinksTruncated:existingLinkFiles>20},limitation:'Configured local source only, not a rendered-site crawl. Candidates contain matching text and no statically detected target link; review relevance and anchors in the chat client. Existing-link evidence covers absolute/root-relative Markdown inline/reference links and HTML anchors; relative paths, dynamic components, shortcut references and rendered navigation may be missed. Filename-slug matches are excluded as possible target sources, not verified URL mappings.'};
}
