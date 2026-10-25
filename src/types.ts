export type Role = 'candidate' | 'coordinator' | 'admin';
export type Job = { id: string; title: string; company: string; location: string; type: string; experience: string; salary: string; description: string; skills: string[]; posted: string; kind: 'job' | 'referral'; status: 'active' | 'pending' | 'closed'; coordinator_id?: string };
export type Profile = { id: string; full_name: string; email: string; phone?: string; whatsapp_opt_in?: boolean; sms_opt_in?: boolean; headline?: string; location?: string; experience?: string; skills?: string[]; role: Role };
export type ReferralRequest = { id: string; job_id: string; user_id: string; message: string; status: string; created_at: string };
