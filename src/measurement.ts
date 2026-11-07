import type {AnalyticsEvidence} from './core.js';

export type AvailabilityState='observed'|'not_observed'|'missing'|'unsupported'|'failed';
export type LensEvidence={state:AvailabilityState;scope:'landing_page'|'site'|'none';values:string[];reason:string};

/** Summarize returned values, preserving nulls and observed zero. Never infer missing rows as zero. */
export function metricEvidence(evidence:AnalyticsEvidence){
  return Object.fromEntries(Object.entries(evidence.metricLabels).map(([metric,label])=>{
    const values=evidence.rows.map(row=>row.metrics[metric]),observed=values.filter(value=>typeof value==='number'&&Number.isFinite(value));
    return[metric,{label,state:observed.length?'observed':'missing',observedRows:observed.length,missingRows:values.length-observed.length,zeroRows:observed.filter(value=>value===0).length,reason:observed.length?'Numeric values were returned; zero is an observation.':evidence.metricAvailability?.[metric]?.reason||'No numeric values were returned.'}];
  }));
}

export function unavailableLenses(state:'unsupported'|'failed',reason:string){
  const lens:LensEvidence={state,scope:'none',values:[],reason};
  return{googleOrganic:{...lens},allOrganic:{...lens},identifiableAiReferrals:{...lens}};
}
