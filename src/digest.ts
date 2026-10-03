import {normalize,type Config} from './core.js';

/** Compare rolling page totals, not individual days or causal effects. */
export function digestChanges(current:any,previous:any,c:Config,limit:number){
  const now=new Map<string,any>(current.gsc.map((row:any)=>[normalize(row.url,c),row]));
  const before=new Map<string,any>(previous.gsc.map((row:any)=>[normalize(row.url,c),row]));
  const gains:any[]=[],declines:any[]=[],maturing:any[]=[],missing:any[]=[];
  for(const key of new Set([...now.keys(),...before.keys()])){
    const a=now.get(key),b=before.get(key);
    // Absence from bounded GSC results is not a measured zero.
    if(!a){missing.push({url:b.url,previous:b,reason:'Absent from the current fetched rows; not proof of zero traffic.'});continue}
    if(!b||b.impressions<c.minimumBaselineImpressions){
      if(a.impressions>=100)maturing.push({url:a.url,current:a,previous:b||null,reason:'No comparable baseline, or baseline below the minimum impressions.'});
      continue;
    }
    const clickChange=a.clicks-b.clicks,impressionChange=a.impressions-b.impressions;
    const clickRelative=Math.abs(clickChange)/Math.max(1,b.clicks),impressionRelative=Math.abs(impressionChange)/Math.max(1,b.impressions);
    if(Math.max(a.impressions,b.impressions)<100)continue;
    const clickSignal=Math.abs(clickChange)>=3&&clickRelative>=0.2;
    const impressionSignal=Math.abs(impressionChange)>=25&&impressionRelative>=0.2;
    if(!clickSignal&&!impressionSignal)continue;
    const primaryMetric=clickSignal?'clicks':'impressions';
    const change={url:a.url,current:a,previous:b,clickChange,impressionChange,primaryMetric,mixedDirection:clickChange*impressionChange<0};
    ((clickSignal?clickChange:impressionChange)>0?gains:declines).push(change);
  }
  const rank=(a:any,b:any)=>Math.abs(b.clickChange)-Math.abs(a.clickChange)||Math.abs(b.impressionChange)-Math.abs(a.impressionChange)||a.url.localeCompare(b.url);
  gains.sort(rank);declines.sort(rank);
  maturing.sort((a,b)=>b.current.impressions-a.current.impressions);
  missing.sort((a,b)=>b.previous.impressions-a.previous.impressions);
  return{counts:{gains:gains.length,declines:declines.length,maturing:maturing.length,missing:missing.length},gains:gains.slice(0,limit),declines:declines.slice(0,limit),maturing:maturing.slice(0,limit),missing:missing.slice(0,limit)};
}
