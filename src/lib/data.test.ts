// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: null, isSupabaseConfigured: false }));
import { applyJob, demoCredentials, demoLogin, getApplications, getSaved, requestReferral, toggleSaved } from './data';
import type { Role } from '../types';

afterEach(()=>localStorage.clear());
describe('candidate opportunity flows',()=>{
 it('saves and unsaves an opportunity for the current demo candidate',async()=>{
  expect(await toggleSaved('demo-candidate','j1')).toBe(true);expect(await getSaved('demo-candidate')).toContain('j1');
  expect(await toggleSaved('demo-candidate','j1')).toBe(false);expect(await getSaved('demo-candidate')).not.toContain('j1');
 });
 it('submits a job application once in the local preview',async()=>{
  const resume=new File(['sample resume'],'resume.pdf',{type:'application/pdf'});await applyJob('demo-candidate','j2',resume);await applyJob('demo-candidate','j2',resume);
  expect(await getApplications('demo-candidate')).toHaveLength(1);
  expect((await getApplications('demo-candidate'))[0].jobs.title).toBe('Frontend Engineer');
 });
 it('creates a referral request with pending status',async()=>{
  await requestReferral('demo-candidate','r1','I have built Java services and would value an introduction.');
  const requests=JSON.parse(localStorage.getItem('cb_requests')||'[]');expect(requests).toHaveLength(1);expect(requests[0].status).toBe('pending');
 });
 it.each(['candidate','coordinator','admin'] as Role[])('allows the %s demo account only with its role credentials',role=>{
  expect(demoLogin(demoCredentials[role],demoCredentials.password,role).role).toBe(role);
 });
 it('rejects incorrect demo credentials',()=>{expect(()=>demoLogin(demoCredentials.candidate,'wrong','candidate')).toThrow();});
});
