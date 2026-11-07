import http from 'node:http';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import type {Config} from './core.js';

export const HTTP_LIMITS={redirects:5,headerBytes:16*1024,bodyBytes:256*1024,timeoutMs:20000,canonicals:10} as const;
type Address={address:string;family:number};
type PageResponse={status:number;location?:string;contentType:string;body:string;truncated:boolean;bodyUnavailable?:string};
type Dependencies={resolve:(hostname:string)=>Promise<Address[]>;request:(url:URL,address:Address,signal:AbortSignal)=>Promise<PageResponse>};
class Blocked extends Error{}

/** Conservatively exclude private, reserved, transition and documentation ranges. */
export function publicAddress(address:string):boolean{
  if(isIP(address)===4){
    const [a,b,c]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||
      (a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===88&&c===99))||
      (a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113));
  }
  if(isIP(address)===6){
    const groups=address.toLowerCase().split(':'),first=parseInt(groups[0],16),second=parseInt(groups[1]||'0',16);
    return first>=0x2000&&first<=0x3fff&&!(first===0x2001&&(second<0x200||second===0xdb8))&&first!==0x2002&&!(first===0x3fff&&second<0x1000);
  }
  return false;
}

// Use native requests with a pinned lookup: validation and connection cannot resolve different IPs.
export function requestPage(url:URL,address:Address,signal:AbortSignal):Promise<PageResponse>{
  return new Promise((resolve,reject)=>{
    const options:http.RequestOptions&{autoSelectFamily:boolean}={
      method:'GET',signal,autoSelectFamily:false,family:address.family,maxHeaderSize:HTTP_LIMITS.headerBytes,headers:{accept:'text/html,application/xhtml+xml','accept-encoding':'identity','user-agent':'Page-Evidence/0.9 (selected-page evidence)'},
      lookup:(_hostname,_options,callback)=>callback(null,address.address,address.family)
    };
    const request=(url.protocol==='https:'?https:http).request(url,options,response=>{
      const status=response.statusCode||0,location=response.headers.location,contentType=String(response.headers['content-type']||'');
      const finish=(body='',truncated=false,bodyUnavailable?:string)=>resolve({status,location,contentType,body,truncated,bodyUnavailable});
      if([301,302,303,307,308].includes(status)||!/^\s*(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(contentType)){
        finish();response.destroy();return;
      }
      const encoding=response.headers['content-encoding'],charset=contentType.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1];
      if((encoding&&encoding.toLowerCase()!=='identity')||(charset&&!/^(utf-8|utf8|us-ascii)$/i.test(charset))){
        finish('',false,'Response encoding is unsupported; canonical evidence is unavailable.');response.destroy();return;
      }
      const chunks:Buffer[]=[];let size=0;
      response.on('data',(chunk:Buffer)=>{
        const remaining=HTTP_LIMITS.bodyBytes-size;
        chunks.push(chunk.subarray(0,remaining));size+=Math.min(remaining,chunk.length);
        if(chunk.length>remaining){finish(Buffer.concat(chunks).toString('utf8'),true);response.destroy()}
      });
      response.on('end',()=>finish(Buffer.concat(chunks).toString('utf8')));
      response.on('error',()=>finish('',false,'HTML response was interrupted; canonical evidence is unavailable.'));
      response.on('aborted',()=>finish('',false,'HTML response was interrupted; canonical evidence is unavailable.'));
    });
    request.on('error',reject);request.end();
  });
}

function decoded(value:string){return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(entity,key:string)=>{
  if(key[0]==='#'){const hex=key[1].toLowerCase()==='x',n=parseInt(key.slice(hex?2:1),hex?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):entity}
  return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'} as Record<string,string>)[key.toLowerCase()]||entity;
})}
function attributes(tag:string){
  const result:Record<string,string>={};
  for(const match of tag.matchAll(/([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)){
    const name=match[1].toLowerCase();if(!(name in result))result[name]=decoded(match[2]??match[3]??match[4]);
  }
  return result;
}
export function htmlCanonicals(html:string,documentUrl:string){
  // Static, bounded head evidence only; this is deliberately not a rendered-DOM parser.
  const clean=html.replace(/<!--[\s\S]*?(?:-->|$)/g,'').replace(/<(script|style|template|title|textarea|noscript)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,'');
  const head=clean.split(/<\/head\s*>|<body\b/i)[0];let base=documentUrl;
  const references:{href:string;url:string|null}[]=[];let truncated=false,baseSeen=false;
  const tags=[...head.matchAll(/<(?:base|link)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)];
  for(const match of tags){
    if(!/^<base\b/i.test(match[0]))continue;
    const a=attributes(match[0]);if(a.href===undefined||baseSeen)continue;
    baseSeen=true;try{base=new URL(a.href,documentUrl).href}catch{}
  }
  for(const match of tags){
    const tag=match[0],a=attributes(tag);
    if(!/^<link\b/i.test(tag)||!a.rel?.toLowerCase().split(/\s+/).includes('canonical')||a.href===undefined)continue;
    if(references.length===HTTP_LIMITS.canonicals){truncated=true;break}
    let url:string|null=null;try{const resolved=new URL(a.href,base);if(['http:','https:'].includes(resolved.protocol)&&!resolved.username&&!resolved.password)url=resolved.href}catch{}
    references.push({href:a.href.slice(0,4096),url:url&&url.length<=4096?url:null});
  }
  return{references,truncated};
}

async function beforeDeadline<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(Error('Deadline exceeded.'));
    signal.addEventListener('abort',abort,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}

export async function inspectPageHttp(raw:string,c:Pick<Config,'domain'|'profile'|'analyticsProvider'>,dependencies:Dependencies={resolve:hostname=>lookup(hostname,{all:true}),request:requestPage}){
  const result={profile:c.profile,site:c.domain,analyticsProvider:c.analyticsProvider,source:'selected-page-http' as const,
    requestedUrl:raw,retrievedAt:new Date().toISOString(),state:'failed' as 'complete'|'partial'|'blocked'|'failed',
    chain:[] as {url:string;status:number;location:string|null;retrievedAt:string}[],finalUrl:null as string|null,
    canonicalEvidence:{state:'unavailable' as 'observed'|'not_observed'|'unavailable',references:[] as {href:string;url:string|null}[],complete:false},
    limits:HTTP_LIMITS,limitations:['One unauthenticated GET observation; responses may differ by client, location or time.','Static UTF-8 HTML head references only; no JavaScript, HTTP Link-header canonical parsing or Google-selected canonical evidence.'],reason:null as string|null};
  const signal=AbortSignal.timeout(HTTP_LIMITS.timeoutMs);
  try{
    const configured=new URL(`https://${c.domain}`),root=configured.hostname.replace(/^www\./,'');
    if(!c.domain||configured.username||configured.password||configured.port||configured.pathname!=='/'||configured.search||configured.hash)throw new Blocked('SITE_DOMAIN must be a hostname.');
    const allowed=new Set([root,`www.${root}`]);
    const validate=(url:URL)=>{
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||!allowed.has(url.hostname)||url.href.length>4096)throw new Blocked('Only credential-free HTTP(S) URLs on the configured host or root/www alias, with default ports, are allowed.');
      url.hash='';return url;
    };
    let url=validate(new URL(raw));const seen=new Set<string>();
    for(let hop=0;hop<=HTTP_LIMITS.redirects;hop++){
      if(seen.has(url.href))throw new Blocked('Redirect loop detected.');seen.add(url.href);
      const hostname=url.hostname.replace(/^\[|\]$/g,''),addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await beforeDeadline(dependencies.resolve(hostname),signal);
      if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Blocked('DNS returned a non-public or unsupported address.');
      const response=await beforeDeadline(dependencies.request(url,addresses[0],signal),signal);
      result.chain.push({url:url.href,status:response.status,location:response.location?.slice(0,4096)??null,retrievedAt:new Date().toISOString()});
      if([301,302,303,307,308].includes(response.status)){
        if(!response.location)throw Error('Redirect response has no Location.');
        if(hop===HTTP_LIMITS.redirects)throw new Blocked('Redirect limit reached.');
        url=validate(new URL(response.location,url));continue;
      }
      result.finalUrl=url.href;result.state='complete';
      if(response.bodyUnavailable){result.state='partial';result.limitations.push(response.bodyUnavailable);return result}
      if(!/^\s*(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.contentType)){
        result.limitations.push('Final response is not declared HTML; canonical evidence is unavailable.');return result;
      }
      const parsed=htmlCanonicals(response.body,url.href),complete=!response.truncated&&!parsed.truncated;
      result.canonicalEvidence={state:parsed.references.length?'observed':complete?'not_observed':'unavailable',references:parsed.references,complete};
      if(!complete){result.state='partial';result.limitations.push('HTML body or canonical-reference limit reached; absence cannot be established.')}
      return result;
    }
  }catch(error){
    result.state=result.chain.length?'partial':error instanceof Blocked?'blocked':'failed';
    result.reason=error instanceof Blocked?error.message:signal.aborted?'The 20-second retrieval deadline was exceeded.':'Could not complete retrieval (invalid URL, DNS, TLS, network or response failure).';
  }
  return result;
}
