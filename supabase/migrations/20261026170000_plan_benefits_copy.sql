-- Keep default plan benefit text aligned with currently available CareerBridge features.
update public.subscription_plans set features = array[
  'Browse active opportunities, save jobs, and manage your profile',
  'Apply to roles and request referrals',
  'Monthly recurring plan; payment confirmation follows admin review'
] where id = 'careerbridge-plus';
update public.subscription_plans set features = array[
  'Browse active opportunities, save jobs, and manage your profile',
  'Apply to roles and request referrals',
  'Yearly recurring plan; payment confirmation follows admin review'
] where id = 'careerbridge-pro';
