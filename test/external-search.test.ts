import fs from 'node:fs';
import path from 'node:path';
import {describe,it,expect} from 'vitest';
import {parseAhrefsCsv,parseExternalNumber,csvRecords} from '../src/ahrefs-csv.js';
const c={profile:'test',domain:'example.com',gscProperty:'sc-domain:example.com'};
const fixture=fs.readFileSync(path.join(process.cwd(),'fixtures/ahrefs-organic-keywords.csv'));
const parse=(text:string)=>parseAhrefsCsv(Buffer.from(text),'sample.csv',c);
describe('realistic Organic Keywords exports',()=>{
  it('normalizes current, historical, flags, dates and provider context with provenance',()=>{
    const data=parseAhrefsCsv(fixture,'sample.csv',c);
    expect(data.observations).toHaveLength(7);
    expect(data.diagnostics).toMatchObject({rowsProcessed:7,rowsAccepted:7,rowsSkipped:0,historicalRows:1,encoding:'utf-8',delimiter:','});
    expect(data.observations[0]).toMatchObject({query:'enterprise cms',searchDemand:{value:1200},sourceRef:{datasetId:data.id,rowNumbers:[2]},observedAt:'2026-10-01 22:44:02',providerSpecific:{positionChange:"'-5",unmapped:{'Unknown optional column':'preserved, but unused'}}});
    expect(data.observations[1].intents).toEqual(['informational','commercial']);
    expect(data.observations[4]).toMatchObject({state:'historical',rankingUrl:'https://example.com/old-cms',position:{value:8},observedAt:'2026-08-14 18:58:11'});
    expect(data.observations[5].searchDemand).toMatchObject({range:{min:0,max:10}});
    expect(data.scope.rankingHosts).toContain('docs.example.com');
  });
  it('does not pick previous columns when current columns are reordered',()=>{
    const data=parse('Previous position,Previous URL,Keyword,Current URL,Volume,Current position\n2,https://example.com/old,cms,https://example.com/current,100,12');
    expect(data.observations[0]).toMatchObject({rankingUrl:'https://example.com/current',position:{value:12}});
  });
  it('accepts optional fields missing and empty metrics without inventing zeroes',()=>{
    const data=parse('Keyword,URL,Volume\ncms,https://example.com/cms,');
    expect(data.observations[0].position).toBeUndefined();expect(data.observations[0].searchDemand).toBeUndefined();
    expect(data.diagnostics.missingFields).toContain('country');
  });
  it('handles UTF-16 tab exports, BOM, quoted delimiters and multiline fields',()=>{
    const text='Keyword\tCurrent URL\tVolume\tEntities\r\n"cms, guide"\thttps://example.com/cms\t100\t"one\nsecond"';
    const bytes=Buffer.concat([Buffer.from([255,254]),Buffer.from(text,'utf16le')]);
    const data=parseAhrefsCsv(bytes,'excel.csv',c);expect(data.diagnostics.encoding).toBe('utf-16le');expect(data.observations[0].query).toBe('cms, guide');
    expect(data.observations[0].providerSpecific.entities).toBe('one\nsecond');
    expect(parse('\uFEFFKeyword;URL;Volume\ncms;https://example.com/cms;100').observations).toHaveLength(1);
  });
  it('skips width errors and invalid URLs, retains valid rows with invalid optional numbers',()=>{
    const data=parse('Keyword,URL,Volume,KD\na,https://example.com/a,100,20\nb,https://example.com/b,banana,\nbad,broken,1,2\nbadwidth,extra\nc,https://example.com/c,200,999');
    expect(data.diagnostics).toMatchObject({rowsAccepted:3,rowsSkipped:2});
    expect(data.observations[1].searchDemand).toBeUndefined();expect(data.observations[2].competitiveness).toBeUndefined();
    expect(data.diagnostics.warningCount).toBeGreaterThan(2);
  });
  it('deduplicates observations while retaining each source row',()=>{
    const data=parse('Keyword,URL,Volume\ncms,https://example.com/cms,100\ncms,https://example.com/cms,100');
    expect(data.observations).toHaveLength(1);expect(data.observations[0].sourceRef.rowNumbers).toEqual([2,3]);
    expect(data.diagnostics).toMatchObject({rowsAccepted:1,duplicatesSkipped:1,rowsSkipped:1});
  });
  it('keeps distinct countries and conflicting metrics separate',()=>{
    const data=parse('Keyword,URL,Volume,Country\ncms,https://example.com/cms,100,US\ncms,https://example.com/cms,200,DK\ncms,https://example.com/cms,300,US');
    expect(data.observations).toHaveLength(3);
  });
  it.each(['Keyword,URL,Volume\n"broken,https://example.com/a,10','Keyword,Keyword,URL,Volume\na,b,https://example.com,10','query,url\na,https://example.com','Keyword,URL,Volume\n,https://example.com,10'])('fails safely on unreliable data',text=>expect(()=>parse(text)).toThrow());
  it('uses stable content IDs scoped by site and preserves unknown fields',()=>{
    expect(parseAhrefsCsv(fixture,'a.csv',c).id).toBe(parseAhrefsCsv(fixture,'b.csv',c).id);
    expect(parseAhrefsCsv(fixture,'a.csv',{...c,domain:'other.com'}).id).not.toBe(parseAhrefsCsv(fixture,'a.csv',c).id);
  });
});
describe('numeric normalization',()=>{
  it.each([['1,234',1234],['1 234',1234],['1\u202f234',1234],['1.5K',1500],['2M',2000000],["'12",12],['0',0]])('parses %s', (raw,value)=>expect(parseExternalNumber(raw,'volume','searches')?.value).toBe(value));
  it.each(['1,2','-5','NaN','Infinity','10-0'])('rejects ambiguous or invalid %s',raw=>expect(()=>parseExternalNumber(raw,'volume','searches')).toThrow());
  it('does not lose doubled quotes',()=>expect(csvRecords('a,b\n"a ""quote""",b',',')[1].fields[0]).toBe('a "quote"'));
  it('does not invent invalid positions or calendar dates',()=>{
    const data=parse('Keyword,URL,Volume,Position,Current date\ncms,https://example.com/cms,100,1.5,2026-02-31 10:00:00');
    expect(data.observations[0].position).toBeUndefined();expect(data.observations[0].observedAt).toBeUndefined();
    expect(data.diagnostics.warningCount).toBeGreaterThan(1);
  });
  it('decodes BOM-marked UTF-16BE exports',()=>{
    const body=Buffer.from('Keyword\tURL\tVolume\ncms\thttps://example.com/cms\t100','utf16le');body.swap16();
    expect(parseAhrefsCsv(Buffer.concat([Buffer.from([254,255]),body]),'be.csv',c).observations[0].searchDemand?.value).toBe(100);
  });
});
