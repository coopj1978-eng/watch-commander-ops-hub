-- Fix admin account role to WC (Watch Commander)
UPDATE users SET role = 'WC', is_active = true, updated_at = NOW()
WHERE email = 'coopj1978@gmail.com';

-- Fix auditor account role to AU (Audit Officer)
UPDATE users SET role = 'AU', is_active = true, updated_at = NOW()
WHERE email = 'auditor@firestation.local';
