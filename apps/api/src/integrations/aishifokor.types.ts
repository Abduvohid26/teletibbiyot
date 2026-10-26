export interface AishifokorHandoffPatient {
  registry_number?: string;
  first_name?: string;
  last_name?: string;
  father_name?: string;
  age?: string;
  gender?: string;
  phone?: string;
  complaints?: string;
  region_id?: string;
  district_id?: string;
}

export interface AishifokorHandoffClinical {
  consensus_diagnosis?: string[];
  summary?: string;
  confidence_score?: number;
  red_flags?: string[];
  differential_count?: number;
  debate_rounds?: number;
}

export interface AishifokorHandoffPayload {
  correlation_id: string;
  referral_id: number;
  source: string;
  reason: string;
  urgency: string;
  status: string;
  analysis_id?: number | null;
  patient: AishifokorHandoffPatient;
  clinical: AishifokorHandoffClinical;
  clinician_note?: string;
  fhir_bundle_url?: string;
  referrer?: { name?: string; email?: string };
  created_at?: string;
}

export interface AishifokorReferralPushBody {
  correlation_id: string;
  handoff_token: string;
  handoff_url?: string;
  payload: AishifokorHandoffPayload;
}
