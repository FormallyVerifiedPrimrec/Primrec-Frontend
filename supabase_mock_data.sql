-- 1. Insert Mock Profiles
-- Note: These IDs won't exist in auth.users unless you manually create them there first,
-- but for testing purposes, we can disable the FK constraint temporarily or just use your existing user ID.
-- REPLACEMENT HINT: Replace 'YOUR_USER_ID' with your actual Supabase User ID from the Auth tab.

/* 
-- Use this if you want to insert fake users directly (might fail if FK is strictly enforced)
INSERT INTO public.profiles (id, username, rank_points)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'RecursionMaster', 150),
  ('00000000-0000-0000-0000-000000000002', 'MathWhiz', 80),
  ('00000000-0000-0000-0000-000000000003', 'PrimRecPro', 200);
*/

-- 2. Insert Initial Challenges
-- We use a subquery to get a valid creator ID (the first profile found) 
-- OR you can hardcode your own ID here.

INSERT INTO public.challenges (creator_id, title, description, template_func, postcondition, suggested_solution, votes)
VALUES 
(
  (SELECT id FROM public.profiles LIMIT 1), 
  'Addition ($x + y$)', 
  'Implement the addition function using primitive recursion. Use the successor function `succ`.', 
  'plusBase(x) = x;\nplusStep(x, y, previous) = succ(previous);\nplus(x, y) = primrec(plusBase, plusStep);', 
  'plus(x, y) = x + y', 
  'plusBase(x) = x; plusStep(x, y, p) = succ(p); plus(x, y) = primrec(plusBase, plusStep);',
  15
),
(
  (SELECT id FROM public.profiles LIMIT 1), 
  'Multiplication ($x \cdot y$)', 
  'Now that you have addition, implement multiplication. Remember that $x \cdot 0 = 0$ and $x \cdot (y+1) = x \cdot y + x$.', 
  'multBase(x) = zero();\nmultStep(x, y, previous) = plus(previous, x);\nmult(x, y) = primrec(multBase, multStep);', 
  'mult(x, y) = x * y', 
  'multBase(x) = zero(); multStep(x, y, p) = plus(p, x); mult(x, y) = primrec(multBase, multStep);',
  24
),
(
  (SELECT id FROM public.profiles LIMIT 1), 
  'Factorial ($n!$)', 
  'The factorial function is defined as:\n\n$$n! = \prod_{i=1}^{n} i$$\n\nImplement it using `mult` and `succ`. Note: $0! = 1$.', 
  'factBase() = 1;\nfactStep(y, previous) = mult(succ(y), previous);\nfact(n) = primrec(factBase, factStep);', 
  'fact(n) = n!', 
  'factBase() = 1; factStep(y, p) = mult(succ(y), p); fact(n) = primrec(factBase, factStep);',
  42
),
(
  (SELECT id FROM public.profiles LIMIT 1), 
  'Predecessor ($n - 1$)', 
  'Implement the predecessor function `pred(n)`. \n\n$$\text{pred}(n) = \begin{cases} 0 & n = 0 \\ n-1 & n > 0 \end{cases}$$', 
  'predBase() = 0;\npredStep(y, previous) = y;\npred(n) = primrec(predBase, predStep);', 
  'pred(n) = max(0, n-1)', 
  'predBase() = 0; predStep(y, p) = y; pred(n) = primrec(predBase, predStep);',
  12
);

-- 3. Insert some interactions
-- This assumes you have at least one challenge and one profile.
INSERT INTO public.user_interactions (user_id, challenge_id, vote_type, has_solved)
SELECT 
  p.id, 
  c.id, 
  1, 
  true
FROM public.profiles p, public.challenges c
WHERE c.title LIKE 'Addition%'
LIMIT 1;
