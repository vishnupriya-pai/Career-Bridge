-- Return the candidate checkout to one one-time CareerBridge Plus option.
update public.subscription_plans
set active = false,
    updated_at = now()
where id in ('free', 'careerbridge-pro');

update public.subscription_plans
set name = 'CareerBridge Plus',
    description = 'One simple payment for CareerBridge Plus.',
    billing_period = 'monthly',
    billing_interval = 1,
    total_cycles = 1,
    features = array[
      'Browse active opportunities, save jobs, and manage your profile',
      'Apply to roles and request referrals',
      'One-time payment; an administrator reviews it and confirms by email'
    ],
    active = true,
    updated_at = now()
where id = 'careerbridge-plus';
