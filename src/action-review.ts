import type {Config} from './core.js';

export function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
export function reviewAssessment(baseline:any,after:any,implementationDate:string,windowDays:number,otherChanges:any[],c:Config){
  const reasons:string[]=[];
  const warnings:string[]=[];
  if(!validDate(implementationDate))reasons.push('A valid implementation date is required.');
  if(!baseline)reasons.push('No comparable baseline snapshot is stored.');
  if(!after)reasons.push('No clean post-implementation snapshot is stored yet.');
  for(const [label,entry]of [['Baseline',baseline],['After',after]] as const){
    if(!entry)continue;
    if(entry.readiness.state!=='ready')reasons.push(`${label} coverage/readiness: ${entry.readiness.reasons.join(' ')}`);
    if(entry.performance.impressions<c.minimumBaselineImpressions)reasons.push(`${label} has fewer than ${c.minimumBaselineImpressions} impressions.`);
    const lastComplete=new Date();lastComplete.setUTCDate(lastComplete.getUTCDate()-c.lag-1);
    if(entry.period.end>lastComplete.toISOString().slice(0,10))reasons.push(`${label} period has not cleared the configured reporting lag.`);
  }
  if(baseline&&after&&(baseline.windowDays!==windowDays||after.windowDays!==windowDays||baseline.period.end>=after.period.start))reasons.push('Before and after periods must be equal-length and non-overlapping.');
  if(otherChanges.length)warnings.push('Other recorded changes affect this page during the comparison span; their effects cannot be separated here.');
  const comparable=baseline&&after&&validDate(implementationDate)&&baseline.period.end<implementationDate&&after.period.start>implementationDate&&baseline.windowDays===windowDays&&after.windowDays===windowDays;
  const delta=(metric:string)=>{const before=baseline.performance[metric],now=after.performance[metric];return{before,after:now,absolute:now-before,relativePercent:before===0?null:(now-before)/before*100}};
  const deltas=comparable?{clicks:delta('clicks'),impressions:delta('impressions'),ctrPercentagePoints:(after.performance.ctr-baseline.performance.ctr)*100,positionChange:baseline.performance.impressions&&after.performance.impressions?after.performance.position-baseline.performance.position:null}:null;
  return{deltas,evidenceAssessment:{state:reasons.length?'insufficient_evidence':warnings.length?'review_with_caution':'ready_for_descriptive_review',reasons,warnings,windowDays,reportingLagDays:c.lag,minimumImpressionsPerPeriod:c.minimumBaselineImpressions,causalityEstablished:false,limitation:'Readiness is a descriptive evidence check, not statistical significance or proof of an edit’s effect. Seven-day windows use the same volume and coverage checks as longer windows.'}};
}
