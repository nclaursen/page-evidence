import {afterEach,describe,expect,it,vi} from 'vitest';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {HTTP_LIMITS,htmlCanonicals,inspectPageHttp,publicAddress,requestPage} from '../src/page-http.js';

const config={domain:'example.test',profile:'personal',analyticsProvider:'ga4' as const};
const publicIp={address:'93.184.216.34',family:4};
const html=(body='<head><link rel="canonical" href="/preferred"></head>',status=200)=>({status,contentType:'text/html; charset=utf-8',body,truncated:false});
const redirect=(location:string)=>({...html('',301),location});
const harness=(responses:ReturnType<typeof html>[])=>({resolve:vi.fn(async()=>[publicIp]),request:vi.fn(async()=>responses.shift()!)});
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers()});

describe('selected-page HTTP evidence',()=>{
  it('observes statuses and relative redirects, preserving URL details and static canonical references',async()=>{
    const deps=harness([redirect('/new?keep=1'),html('<head><base href="/docs/"><link REL="alternate CANONICAL" href="guide?a=1&amp;b=2"></head>')]);
    const result=await inspectPageHttp('https://example.test/old#fragment',config,deps);
    expect(result).toMatchObject({state:'complete',profile:'personal',site:'example.test',analyticsProvider:'ga4',finalUrl:'https://example.test/new?keep=1',
      chain:[{url:'https://example.test/old',status:301,location:'/new?keep=1'},{status:200,location:null}],
      canonicalEvidence:{state:'observed',complete:true,references:[{href:'guide?a=1&b=2',url:'https://example.test/docs/guide?a=1&b=2'}]}});
    expect(result.chain.every(row=>!Number.isNaN(Date.parse(row.retrievedAt)))).toBe(true);
    expect(deps.request).toHaveBeenCalledTimes(2);
    expect(deps.request.mock.calls[0]).toEqual([new URL('https://example.test/old'),publicIp,expect.any(AbortSignal)]);
  });

  it.each(['ga4','matomo','engage','none'] as const)('works without analytics or stored evidence for %s',async provider=>{
    const result=await inspectPageHttp('https://example.test/page',{...config,analyticsProvider:provider},harness([html()]));
    expect(result).toMatchObject({state:'complete',analyticsProvider:provider});
  });

  it('allows root/www aliases but records and stops at an external redirect',async()=>{
    const deps=harness([redirect('https://www.example.test/a'),redirect('https://other.test/a')]);
    const result=await inspectPageHttp('http://example.test/',config,deps);
    expect(result).toMatchObject({state:'partial',finalUrl:null,canonicalEvidence:{state:'unavailable'}});
    expect(result.chain.map(row=>row.location)).toEqual(['https://www.example.test/a','https://other.test/a']);
    expect(deps.resolve).toHaveBeenCalledTimes(2);expect(deps.request).toHaveBeenCalledTimes(2);
  });

  it.each(['https://sub.example.test/','https://example.test.evil.test/','http://example.test:8080/','https://user:secret@example.test/','file:///etc/passwd','/relative'])('blocks unsafe or out-of-scope input %s without resolving',async url=>{
    const deps=harness([]),result=await inspectPageHttp(url,config,deps);
    expect(['blocked','failed']).toContain(result.state);expect(deps.resolve).not.toHaveBeenCalled();expect(deps.request).not.toHaveBeenCalled();
  });

  it.each(['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','172.16.0.1','192.168.1.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2001:db8::1','2002:7f00:1::','3fff::1'])('rejects non-public address %s',address=>expect(publicAddress(address)).toBe(false));
  it.each(['8.8.8.8','93.184.216.34','2001:4860:4860::8888','2606:4700:4700::1111'])('accepts public address %s',address=>expect(publicAddress(address)).toBe(true));

  it('rejects mixed public/private DNS answers and revalidates every redirect hop',async()=>{
    const deps=harness([redirect('/next')]);
    deps.resolve.mockResolvedValueOnce([publicIp]).mockResolvedValueOnce([publicIp,{address:'127.0.0.1',family:4}]);
    const result=await inspectPageHttp('https://example.test/',config,deps);
    expect(result.state).toBe('partial');expect(result.chain).toHaveLength(1);expect(deps.request).toHaveBeenCalledTimes(1);
  });

  it('bounds redirects and detects loops',async()=>{
    const deps=harness(Array.from({length:6},(_,i)=>redirect(`/hop-${i}`)));
    expect(await inspectPageHttp('https://example.test/',config,deps)).toMatchObject({state:'partial',reason:'Redirect limit reached.'});
    expect(deps.request).toHaveBeenCalledTimes(6);
    const loop=harness([redirect('/')]);
    expect(await inspectPageHttp('https://example.test/',config,loop)).toMatchObject({state:'partial',reason:'Redirect loop detected.'});
    expect(loop.request).toHaveBeenCalledTimes(1);
  });

  it('preserves observed redirects on later network failure',async()=>{
    const deps=harness([redirect('/next')]);deps.request.mockRejectedValueOnce(Error('private detail')).mockResolvedValueOnce(html());
    const failed=await inspectPageHttp('https://example.test/',config,deps);
    expect(failed.state).toBe('failed');expect(JSON.stringify(failed)).not.toContain('private detail');
    deps.request.mockReset().mockResolvedValueOnce(redirect('/next')).mockRejectedValueOnce(Error('TLS failure'));
    expect(await inspectPageHttp('https://example.test/',config,deps)).toMatchObject({state:'partial',chain:[{status:301}],finalUrl:null});
  });

  it('distinguishes an observed 404 HTML response, non-HTML, absent canonical and truncated evidence',async()=>{
    expect(await inspectPageHttp('https://example.test/',config,harness([html('<head></head>',404)]))).toMatchObject({state:'complete',chain:[{status:404}],canonicalEvidence:{state:'not_observed',complete:true}});
    expect(await inspectPageHttp('https://example.test/',config,harness([{...html(),contentType:'application/pdf'}]))).toMatchObject({canonicalEvidence:{state:'unavailable',complete:false}});
    expect(await inspectPageHttp('https://example.test/',config,harness([{...html(''),truncated:true}]))).toMatchObject({state:'partial',canonicalEvidence:{state:'unavailable',complete:false}});
    expect(await inspectPageHttp('https://example.test/',config,harness([{...html(),truncated:true}]))).toMatchObject({state:'partial',canonicalEvidence:{state:'observed',complete:false}});
  });

  it('enforces the total deadline even while DNS is unresolved',async()=>{
    // AbortSignal.timeout uses a native timer; provide the same abort behavior under fake time.
    vi.useFakeTimers();const controller=new AbortController();
    vi.spyOn(AbortSignal,'timeout').mockImplementation(ms=>{setTimeout(()=>controller.abort(),ms);return controller.signal});
    const deps=harness([]);deps.resolve.mockImplementation(()=>new Promise(()=>{}));
    const pending=inspectPageHttp('https://example.test/',config,deps);
    await vi.advanceTimersByTimeAsync(HTTP_LIMITS.timeoutMs);
    expect(await pending).toMatchObject({state:'failed',reason:'The 20-second retrieval deadline was exceeded.'});
    expect(deps.request).not.toHaveBeenCalled();
  });
});

describe('bounded static canonical parsing',()=>{
  it('uses the first base href even when declared after the canonical link',()=>{
    expect(htmlCanonicals('<head><link rel=canonical href="a&#63;x=1&#x26;y=2"><base href="/docs/"><base href="/ignored/"></head>','https://example.test/')).toMatchObject({references:[{href:'a?x=1&y=2',url:'https://example.test/docs/a?x=1&y=2'}]});
  });
  it('ignores scripts/comments/body, retains duplicates and does not fetch external references',()=>{
    const parsed=htmlCanonicals(`<!-- <link rel="canonical" href="/comment"> --><head><script>const a='<link rel="canonical" href="/script">'</script><link href='/a' rel='canonical'><link rel=canonical href=https://other.test/a><link rel=canonical href='javascript:bad'></head><body><link rel=canonical href=/body>`, 'https://example.test/');
    expect(parsed.references).toEqual([{href:'/a',url:'https://example.test/a'},{href:'https://other.test/a',url:'https://other.test/a'},{href:'javascript:bad',url:null}]);
    expect(htmlCanonicals('<head>'+Array(11).fill('<link rel=canonical href=/a>').join('')+'</head>','https://example.test/')).toMatchObject({truncated:true,references:Array(10).fill({href:'/a',url:'https://example.test/a'})});
  });
});

describe('native HTTP boundary',()=>{
  it.each([{'content-encoding':'gzip'},{'content-type':'text/html; charset=iso-8859-1'}])('does not mistake unsupported encoding for absent canonical: %s',async headers=>{
    const request=new EventEmitter() as EventEmitter&{end:()=>void};request.end=()=>{};
    const response=Readable.from([]);Object.assign(response,{statusCode:200,headers:{'content-type':'text/html',...headers}});
    vi.spyOn(https,'request').mockImplementation(((_url:any,_options:any,callback:any)=>{queueMicrotask(()=>callback(response));return request}) as any);
    expect(await requestPage(new URL('https://example.test/'),publicIp,new AbortController().signal)).toMatchObject({status:200,bodyUnavailable:expect.stringContaining('unsupported')});
  });
  it('pins the validated address while keeping the hostname for Host and TLS, and limits bytes',async()=>{
    const request=new EventEmitter() as EventEmitter&{end:()=>void};let options:any;
    const response=Readable.from([Buffer.alloc(HTTP_LIMITS.bodyBytes+1,97)]);
    Object.assign(response,{statusCode:200,headers:{'content-type':'text/html'}});
    request.end=()=>{};
    vi.spyOn(https,'request').mockImplementation(((url:URL,input:any,callback:any)=>{expect(url.hostname).toBe('example.test');options=input;queueMicrotask(()=>callback(response));return request}) as any);
    const result=await requestPage(new URL('https://example.test/'),publicIp,new AbortController().signal);
    expect(result.truncated).toBe(true);expect(Buffer.byteLength(result.body)).toBe(HTTP_LIMITS.bodyBytes);
    expect(options).toMatchObject({method:'GET',autoSelectFamily:false,family:4,maxHeaderSize:16384});
    const callback=vi.fn();options.lookup('example.test',{},callback);expect(callback).toHaveBeenCalledWith(null,publicIp.address,4);
    expect(options.headers).not.toHaveProperty('authorization');expect(options.headers).not.toHaveProperty('cookie');
  });
});
