SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict X8YUTPXCVdqaF7q4UvAM7Yp9zaT2cBeVskfBPNEFrklitsBQkdQHbzwsB1EzTiK

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") FROM stdin;
\.


--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."custom_oauth_providers" ("id", "provider_type", "identifier", "name", "client_id", "client_secret", "acceptable_client_ids", "scopes", "pkce_enabled", "attribute_mapping", "authorization_params", "enabled", "email_optional", "issuer", "discovery_url", "skip_nonce_check", "cached_discovery", "discovery_cached_at", "authorization_url", "token_url", "userinfo_url", "jwks_uri", "created_at", "updated_at", "custom_claims_allowlist") FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at", "invite_token", "referrer", "oauth_client_state_id", "linking_target_id", "email_optional") FROM stdin;
c98dfe40-a23c-489b-b187-fdc2307fa2e3	\N	\N	\N	\N	google			2026-09-09 17:21:53.467245+00	2026-09-09 17:21:53.467245+00	oauth	\N	\N	http://127.0.0.1:5173/auth/callback	\N	\N	f
a427a14d-8f46-4f87-8ba5-b7527aa3c44a	\N	\N	\N	\N	google			2026-09-10 10:31:33.365121+00	2026-09-10 10:31:33.365121+00	oauth	\N	\N	http://localhost:3000	\N	\N	f
c989b176-6630-4226-a9ad-6adf4a0eee35	\N	\N	\N	\N	google			2026-09-15 07:29:34.635417+00	2026-09-15 07:29:34.635417+00	oauth	\N	\N	http://localhost:4173/auth/callback	\N	\N	f
4ee71894-3c00-4322-816a-04b1f57e6ebc	\N	\N	\N	\N	google			2026-09-15 16:02:48.650627+00	2026-09-15 16:02:48.650627+00	oauth	\N	\N	http://localhost:3000/auth/callback	\N	\N	f
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") FROM stdin;
00000000-0000-0000-0000-000000000000	a1d1679a-e2f0-4260-96a4-6582f431f0df	authenticated	authenticated	axe@gmail.com	$2a$10$g3UvlJW77N78NI2WdJYH7.8QF6snpy0yafJHEMCg33IsdUmAUg3ce	2026-09-15 10:29:14.129587+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-09-15 10:29:14.103445+00	2026-09-15 10:29:14.130621+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	46803d0f-aff8-4351-9831-1a44776d289a	authenticated	authenticated	jaivarshan732005@gmail.com	\N	2026-09-09 17:22:44.64215+00	\N		\N		\N			\N	2026-09-09 17:32:37.07723+00	{"provider": "google", "providers": ["google"]}	{"iss": "https://accounts.google.com", "sub": "117965056667250929320", "name": "Jaivarshan", "email": "jaivarshan732005@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJIHVBsIUGu-YpQ71XYu4Q4QSmundd5LGS-1dFFVvpX5vwGDQ=s96-c", "full_name": "Jaivarshan", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJIHVBsIUGu-YpQ71XYu4Q4QSmundd5LGS-1dFFVvpX5vwGDQ=s96-c", "provider_id": "117965056667250929320", "email_verified": true, "phone_verified": false}	\N	2026-09-09 17:22:44.600593+00	2026-09-09 17:32:37.087423+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	5642f2b3-a9d3-4efc-ab66-4b52e1c651e4	authenticated	authenticated	23su2360207@student.hindustanuniv.ac.in	\N	2026-09-09 17:33:03.966492+00	\N		\N		\N			\N	2026-09-09 17:33:03.969436+00	{"provider": "google", "providers": ["google"]}	{"iss": "https://accounts.google.com", "sub": "106742289454176239581", "name": "JAIVARSHAN B STUDENT - BCA", "email": "23su2360207@student.hindustanuniv.ac.in", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKhF8FuzI-il_9roSoFdE_7PhU8c6CvsSVnwub1xKY4FM3jsA=s96-c", "full_name": "JAIVARSHAN B STUDENT - BCA", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKhF8FuzI-il_9roSoFdE_7PhU8c6CvsSVnwub1xKY4FM3jsA=s96-c", "provider_id": "106742289454176239581", "custom_claims": {"hd": "student.hindustanuniv.ac.in"}, "email_verified": true, "phone_verified": false}	\N	2026-09-09 17:33:03.959265+00	2026-09-09 17:33:03.971375+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	dfeb5652-9f20-40c8-bd71-3ff527c0bb51	authenticated	authenticated	30josh07@gmail.com	\N	2026-09-15 12:26:27.648433+00	\N		\N		\N			\N	2026-09-15 12:26:27.649854+00	{"provider": "google", "providers": ["google"]}	{"iss": "https://accounts.google.com", "sub": "117618981943442227603", "name": "Joshua Joy", "email": "30josh07@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKsVHLj1eIuPa2pJe7fzchyR37ku5lZS-QdCWq5EaDQySYE5L2W=s96-c", "full_name": "Joshua Joy", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKsVHLj1eIuPa2pJe7fzchyR37ku5lZS-QdCWq5EaDQySYE5L2W=s96-c", "provider_id": "117618981943442227603", "email_verified": true, "phone_verified": false}	\N	2026-09-15 12:26:27.640615+00	2026-09-15 12:26:27.651692+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	5895f77b-80d9-4b97-b1a5-42ff65c0fc6a	authenticated	authenticated	platform-admin@example.test	$2a$10$7A7dwMPSyCwHy/EcUgLP7ucojRLCxc2zdn0FCkzvsLpPuF9BY50Mi	2026-09-15 12:28:33.832574+00	\N		\N		\N			\N	2026-09-15 12:30:26.056917+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-09-15 12:28:33.821121+00	2026-09-15 12:30:26.059509+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	29f9fc2c-719b-4a0f-8d52-75b41e065eb4	authenticated	authenticated	jake@gmail.com	$2a$10$GwYWBPAMbTE/ts8GaHFvGeiT7d6/mcltm.kCk3GAwR9OqjT0FleG6	2026-09-15 15:55:07.897586+00	\N		\N		\N			\N	2026-09-15 16:01:49.876142+00	{"provider": "email", "providers": ["email"]}	{"created_at": "2026-09-15T15:55:07.755Z", "created_by": "ec754300-67ec-43fe-a6c5-34d978491fb6", "email_verified": true}	\N	2026-09-15 15:55:07.883213+00	2026-09-15 16:01:49.894793+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	7d508b33-9473-4beb-89b1-649d5e5b5cac	authenticated	authenticated	maxi@gmail.com	$2a$10$DXsHoJ6123f6VvB7dDnTOuZj6YM9hN.7RAH/d.OqAHbmMamuSfJv6	2026-09-15 12:44:13.314904+00	\N		\N		\N			\N	2026-09-15 12:44:58.695421+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-09-15 12:44:13.305429+00	2026-09-15 12:44:58.697952+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	e5bd3b03-ac38-48c1-bc6b-59c8ee9e9bda	authenticated	authenticated	ramu@gmail.com	$2a$10$RBfFIRQWN69xihb8vCaD0OdBqE3o2hcAwQh6ZKgRk9sYtBwI2Q7Tq	2026-09-15 10:29:58.444599+00	\N		\N		\N			\N	2026-09-15 10:57:01.544433+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-09-15 10:29:58.441945+00	2026-09-15 16:03:04.79906+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	9bdf7009-f6f0-4265-aba9-5af74629473a	authenticated	authenticated	alex@gmail.com	$2a$10$WpQCKvSdUabxewaO5ojtI.yT9SeKZagWBwCBuw8WYVUA39FQQCPLK	2026-09-15 15:31:29.077789+00	\N		\N		\N			\N	2026-09-17 08:08:30.035776+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-09-15 15:31:29.055376+00	2026-09-17 08:08:30.090515+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	cfbd4054-c84a-440a-809b-f69e71a29136	authenticated	authenticated	ts305715@gmail.com	\N	2026-09-15 16:03:21.372992+00	\N		\N		\N			\N	2026-09-15 16:37:16.282084+00	{"provider": "google", "providers": ["google"]}	{"iss": "https://accounts.google.com", "sub": "117298590453348164025", "name": "Jaivarshan B", "email": "ts305715@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIpcyc0hGhHS_JrxY6FeZ67L-ArYO6yBNB5IjIpCJH-BcmU5LXe=s96-c", "full_name": "Jaivarshan B", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIpcyc0hGhHS_JrxY6FeZ67L-ArYO6yBNB5IjIpCJH-BcmU5LXe=s96-c", "provider_id": "117298590453348164025", "email_verified": true, "phone_verified": false}	\N	2026-09-15 16:03:21.361504+00	2026-09-17 13:36:35.673634+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") FROM stdin;
117298590453348164025	cfbd4054-c84a-440a-809b-f69e71a29136	{"iss": "https://accounts.google.com", "sub": "117298590453348164025", "name": "Jaivarshan B", "email": "ts305715@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIpcyc0hGhHS_JrxY6FeZ67L-ArYO6yBNB5IjIpCJH-BcmU5LXe=s96-c", "full_name": "Jaivarshan B", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIpcyc0hGhHS_JrxY6FeZ67L-ArYO6yBNB5IjIpCJH-BcmU5LXe=s96-c", "provider_id": "117298590453348164025", "email_verified": true, "phone_verified": false}	google	2026-09-15 16:03:21.366502+00	2026-09-15 16:03:21.366551+00	2026-09-15 16:37:16.268784+00	37fdfdfb-50f0-4923-957f-bc9c120a8bd9
117965056667250929320	46803d0f-aff8-4351-9831-1a44776d289a	{"iss": "https://accounts.google.com", "sub": "117965056667250929320", "name": "Jaivarshan", "email": "jaivarshan732005@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJIHVBsIUGu-YpQ71XYu4Q4QSmundd5LGS-1dFFVvpX5vwGDQ=s96-c", "full_name": "Jaivarshan", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJIHVBsIUGu-YpQ71XYu4Q4QSmundd5LGS-1dFFVvpX5vwGDQ=s96-c", "provider_id": "117965056667250929320", "email_verified": true, "phone_verified": false}	google	2026-09-09 17:22:44.630986+00	2026-09-09 17:22:44.631038+00	2026-09-09 17:32:37.06975+00	bdf193ce-c700-4a8d-b2dd-37c4156f2086
106742289454176239581	5642f2b3-a9d3-4efc-ab66-4b52e1c651e4	{"iss": "https://accounts.google.com", "sub": "106742289454176239581", "name": "JAIVARSHAN B STUDENT - BCA", "email": "23su2360207@student.hindustanuniv.ac.in", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKhF8FuzI-il_9roSoFdE_7PhU8c6CvsSVnwub1xKY4FM3jsA=s96-c", "full_name": "JAIVARSHAN B STUDENT - BCA", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKhF8FuzI-il_9roSoFdE_7PhU8c6CvsSVnwub1xKY4FM3jsA=s96-c", "provider_id": "106742289454176239581", "custom_claims": {"hd": "student.hindustanuniv.ac.in"}, "email_verified": true, "phone_verified": false}	google	2026-09-09 17:33:03.963198+00	2026-09-09 17:33:03.963251+00	2026-09-09 17:33:03.963251+00	d8affd65-d404-4f10-bb86-4f990ff82705
a1d1679a-e2f0-4260-96a4-6582f431f0df	a1d1679a-e2f0-4260-96a4-6582f431f0df	{"sub": "a1d1679a-e2f0-4260-96a4-6582f431f0df", "email": "axe@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-09-15 10:29:14.120685+00	2026-09-15 10:29:14.120745+00	2026-09-15 10:29:14.120745+00	f02b7e63-06ee-4854-a90e-10af18c7b74c
e5bd3b03-ac38-48c1-bc6b-59c8ee9e9bda	e5bd3b03-ac38-48c1-bc6b-59c8ee9e9bda	{"sub": "e5bd3b03-ac38-48c1-bc6b-59c8ee9e9bda", "email": "ramu@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-09-15 10:29:58.443051+00	2026-09-15 10:29:58.443101+00	2026-09-15 10:29:58.443101+00	0f536605-6929-4f19-a9de-2bfc58230df1
117618981943442227603	dfeb5652-9f20-40c8-bd71-3ff527c0bb51	{"iss": "https://accounts.google.com", "sub": "117618981943442227603", "name": "Joshua Joy", "email": "30josh07@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKsVHLj1eIuPa2pJe7fzchyR37ku5lZS-QdCWq5EaDQySYE5L2W=s96-c", "full_name": "Joshua Joy", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKsVHLj1eIuPa2pJe7fzchyR37ku5lZS-QdCWq5EaDQySYE5L2W=s96-c", "provider_id": "117618981943442227603", "email_verified": true, "phone_verified": false}	google	2026-09-15 12:26:27.645502+00	2026-09-15 12:26:27.645551+00	2026-09-15 12:26:27.645551+00	c24ea113-9aa8-4bd0-9318-ec108394f858
5895f77b-80d9-4b97-b1a5-42ff65c0fc6a	5895f77b-80d9-4b97-b1a5-42ff65c0fc6a	{"sub": "5895f77b-80d9-4b97-b1a5-42ff65c0fc6a", "email": "platform-admin@example.test", "email_verified": false, "phone_verified": false}	email	2026-09-15 12:28:33.830176+00	2026-09-15 12:28:33.830224+00	2026-09-15 12:28:33.830224+00	45e18ed9-1451-4915-af11-bcfce627fe7e
7d508b33-9473-4beb-89b1-649d5e5b5cac	7d508b33-9473-4beb-89b1-649d5e5b5cac	{"sub": "7d508b33-9473-4beb-89b1-649d5e5b5cac", "email": "maxi@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-09-15 12:44:13.312757+00	2026-09-15 12:44:13.312808+00	2026-09-15 12:44:13.312808+00	38dce45f-a344-4b6e-9639-12d74f065aae
9bdf7009-f6f0-4265-aba9-5af74629473a	9bdf7009-f6f0-4265-aba9-5af74629473a	{"sub": "9bdf7009-f6f0-4265-aba9-5af74629473a", "email": "alex@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-09-15 15:31:29.073572+00	2026-09-15 15:31:29.073625+00	2026-09-15 15:31:29.073625+00	d4432c0c-52cd-49cb-8e8e-eeb0b7f525ae
29f9fc2c-719b-4a0f-8d52-75b41e065eb4	29f9fc2c-719b-4a0f-8d52-75b41e065eb4	{"sub": "29f9fc2c-719b-4a0f-8d52-75b41e065eb4", "email": "jake@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-09-15 15:55:07.892104+00	2026-09-15 15:55:07.892174+00	2026-09-15 15:55:07.892174+00	2432546d-5c88-4523-9291-5083f2b5f1d5
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."instances" ("id", "uuid", "raw_base_config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_clients" ("id", "client_secret_hash", "registration_type", "redirect_uris", "grant_types", "client_name", "client_uri", "logo_uri", "created_at", "updated_at", "deleted_at", "client_type", "token_endpoint_auth_method") FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") FROM stdin;
4a943dc2-f0fe-4c33-9891-62dba685ba51	dfeb5652-9f20-40c8-bd71-3ff527c0bb51	2026-09-15 12:26:27.650009+00	2026-09-15 12:26:27.650009+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0	223.178.81.79	\N	\N	\N	\N	\N
9dad3cf5-de9f-4955-9a6e-db8d8f0c2b12	7d508b33-9473-4beb-89b1-649d5e5b5cac	2026-09-15 12:44:58.695526+00	2026-09-15 12:44:58.695526+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0	223.178.81.79	\N	\N	\N	\N	\N
87347821-29d1-42b8-9ccf-73d8958adeb5	cfbd4054-c84a-440a-809b-f69e71a29136	2026-09-15 16:37:16.283184+00	2026-09-17 13:36:35.695685+00	\N	aal1	\N	2026-09-17 13:36:35.695505	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	117.193.177.144	\N	\N	\N	\N	\N
28013cf1-caf7-47f3-adb3-54d559f2b6f3	9bdf7009-f6f0-4265-aba9-5af74629473a	2026-09-16 06:18:18.409421+00	2026-09-16 09:14:26.882617+00	\N	aal1	\N	2026-09-16 09:14:26.882522	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.137.0 Chrome/148.0.7778.280 Electron/42.10.0 Safari/537.36	61.2.120.3	\N	\N	\N	\N	\N
4a1acac5-ec7a-4b69-b78d-fcf1602fff62	9bdf7009-f6f0-4265-aba9-5af74629473a	2026-09-16 09:22:04.785002+00	2026-09-16 11:21:50.00273+00	\N	aal1	\N	2026-09-16 11:21:50.002634	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	61.2.120.3	\N	\N	\N	\N	\N
bd9a6a25-9353-4993-8ece-86f1345da550	9bdf7009-f6f0-4265-aba9-5af74629473a	2026-09-17 08:08:30.036493+00	2026-09-17 08:08:30.036493+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.138.0 Chrome/148.0.7778.280 Electron/42.10.0 Safari/537.36	117.193.177.144	\N	\N	\N	\N	\N
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") FROM stdin;
4a943dc2-f0fe-4c33-9891-62dba685ba51	2026-09-15 12:26:27.652052+00	2026-09-15 12:26:27.652052+00	oauth	97a1e776-1c2a-46bb-863e-606f3df4cdc1
9dad3cf5-de9f-4955-9a6e-db8d8f0c2b12	2026-09-15 12:44:58.698482+00	2026-09-15 12:44:58.698482+00	password	eb420b8b-e2d3-468c-b502-6d50ca6e62c4
87347821-29d1-42b8-9ccf-73d8958adeb5	2026-09-15 16:37:16.302699+00	2026-09-15 16:37:16.302699+00	oauth	eec7cb7d-cbc2-411e-887d-f6020ea112b4
28013cf1-caf7-47f3-adb3-54d559f2b6f3	2026-09-16 06:18:18.431795+00	2026-09-16 06:18:18.431795+00	password	b884196a-2232-415b-ab7d-5e5cbce6ea55
4a1acac5-ec7a-4b69-b78d-fcf1602fff62	2026-09-16 09:22:04.813869+00	2026-09-16 09:22:04.813869+00	password	e193356f-46c2-4bc8-887d-b371706d9296
bd9a6a25-9353-4993-8ece-86f1345da550	2026-09-17 08:08:30.100859+00	2026-09-17 08:08:30.100859+00	password	3cc63ab9-e293-411f-b2b5-9c7797880991
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_factors" ("id", "user_id", "friendly_name", "factor_type", "status", "created_at", "updated_at", "secret", "phone", "last_challenged_at", "web_authn_credential", "web_authn_aaguid", "last_webauthn_challenge_data") FROM stdin;
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_challenges" ("id", "factor_id", "created_at", "verified_at", "ip_address", "otp_code", "web_authn_session_data") FROM stdin;
\.


--
-- Data for Name: mfa_recovery_code_sets; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_recovery_code_sets" ("id", "user_id", "mfa_factor_id", "failed_verification_count", "verification_locked_until", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: mfa_recovery_codes; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_recovery_codes" ("id", "mfa_recovery_code_set_id", "code_hash", "consumed_at", "created_at") FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_authorizations" ("id", "authorization_id", "client_id", "user_id", "redirect_uri", "scope", "state", "resource", "code_challenge", "code_challenge_method", "response_type", "status", "authorization_code", "created_at", "expires_at", "approved_at", "nonce") FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_client_states" ("id", "provider_type", "code_verifier", "created_at") FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_consents" ("id", "user_id", "client_id", "scopes", "granted_at", "revoked_at") FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at", "expires_at") FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") FROM stdin;
00000000-0000-0000-0000-000000000000	8	mvkq7pawyrnv	dfeb5652-9f20-40c8-bd71-3ff527c0bb51	f	2026-09-15 12:26:27.650843+00	2026-09-15 12:26:27.650843+00	\N	4a943dc2-f0fe-4c33-9891-62dba685ba51
00000000-0000-0000-0000-000000000000	13	foeq6z2mxka5	7d508b33-9473-4beb-89b1-649d5e5b5cac	f	2026-09-15 12:44:58.696851+00	2026-09-15 12:44:58.696851+00	\N	9dad3cf5-de9f-4955-9a6e-db8d8f0c2b12
00000000-0000-0000-0000-000000000000	23	whaajzq37c45	cfbd4054-c84a-440a-809b-f69e71a29136	t	2026-09-15 16:37:16.2883+00	2026-09-15 17:37:04.159353+00	\N	87347821-29d1-42b8-9ccf-73d8958adeb5
00000000-0000-0000-0000-000000000000	27	2zz4xjsekeyz	9bdf7009-f6f0-4265-aba9-5af74629473a	t	2026-09-16 06:18:18.425675+00	2026-09-16 07:17:40.405863+00	\N	28013cf1-caf7-47f3-adb3-54d559f2b6f3
00000000-0000-0000-0000-000000000000	24	r4uspzyuq4ke	cfbd4054-c84a-440a-809b-f69e71a29136	t	2026-09-15 17:37:04.172589+00	2026-09-16 09:12:25.192765+00	whaajzq37c45	87347821-29d1-42b8-9ccf-73d8958adeb5
00000000-0000-0000-0000-000000000000	28	vvoszyb3jyed	9bdf7009-f6f0-4265-aba9-5af74629473a	t	2026-09-16 07:17:40.425282+00	2026-09-16 09:14:26.850657+00	2zz4xjsekeyz	28013cf1-caf7-47f3-adb3-54d559f2b6f3
00000000-0000-0000-0000-000000000000	30	ib4ti3fjjjil	9bdf7009-f6f0-4265-aba9-5af74629473a	f	2026-09-16 09:14:26.856899+00	2026-09-16 09:14:26.856899+00	vvoszyb3jyed	28013cf1-caf7-47f3-adb3-54d559f2b6f3
00000000-0000-0000-0000-000000000000	31	2ttiwleoqsq7	9bdf7009-f6f0-4265-aba9-5af74629473a	t	2026-09-16 09:22:04.801589+00	2026-09-16 10:22:02.192892+00	\N	4a1acac5-ec7a-4b69-b78d-fcf1602fff62
00000000-0000-0000-0000-000000000000	32	skdbnlx4xwfm	9bdf7009-f6f0-4265-aba9-5af74629473a	t	2026-09-16 10:22:02.209352+00	2026-09-16 11:21:49.958758+00	2ttiwleoqsq7	4a1acac5-ec7a-4b69-b78d-fcf1602fff62
00000000-0000-0000-0000-000000000000	33	s4tk7nfufy4h	9bdf7009-f6f0-4265-aba9-5af74629473a	f	2026-09-16 11:21:49.972319+00	2026-09-16 11:21:49.972319+00	skdbnlx4xwfm	4a1acac5-ec7a-4b69-b78d-fcf1602fff62
00000000-0000-0000-0000-000000000000	34	iarp5zc3r6mj	9bdf7009-f6f0-4265-aba9-5af74629473a	f	2026-09-17 08:08:30.065268+00	2026-09-17 08:08:30.065268+00	\N	bd9a6a25-9353-4993-8ece-86f1345da550
00000000-0000-0000-0000-000000000000	29	5mcydxw5ar5r	cfbd4054-c84a-440a-809b-f69e71a29136	t	2026-09-16 09:12:25.201732+00	2026-09-17 09:58:54.950885+00	r4uspzyuq4ke	87347821-29d1-42b8-9ccf-73d8958adeb5
00000000-0000-0000-0000-000000000000	35	ckkxc32ax5xr	cfbd4054-c84a-440a-809b-f69e71a29136	t	2026-09-17 09:58:54.968677+00	2026-09-17 10:57:49.85442+00	5mcydxw5ar5r	87347821-29d1-42b8-9ccf-73d8958adeb5
00000000-0000-0000-0000-000000000000	36	6bsj4dlgp26y	cfbd4054-c84a-440a-809b-f69e71a29136	t	2026-09-17 10:57:49.86548+00	2026-09-17 13:36:35.650497+00	ckkxc32ax5xr	87347821-29d1-42b8-9ccf-73d8958adeb5
00000000-0000-0000-0000-000000000000	37	cj3omjcux6ok	cfbd4054-c84a-440a-809b-f69e71a29136	f	2026-09-17 13:36:35.664366+00	2026-09-17 13:36:35.664366+00	6bsj4dlgp26y	87347821-29d1-42b8-9ccf-73d8958adeb5
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_providers" ("id", "resource_id", "created_at", "updated_at", "disabled") FROM stdin;
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_providers" ("id", "sso_provider_id", "entity_id", "metadata_xml", "metadata_url", "attribute_mapping", "created_at", "updated_at", "name_id_format") FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_relay_states" ("id", "sso_provider_id", "request_id", "for_email", "redirect_to", "created_at", "updated_at", "flow_state_id") FROM stdin;
\.


--
-- Data for Name: scim_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."scim_tokens" ("id", "sso_provider_id", "token_hash", "prefix", "created_at", "expires_at", "revoked_at", "last_used_at") FROM stdin;
\.


--
-- Data for Name: scim_users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."scim_users" ("id", "sso_provider_id", "user_id", "resource", "created_at", "updated_at", "deleted_at") FROM stdin;
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_domains" ("id", "sso_provider_id", "domain", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_challenges" ("id", "user_id", "challenge_type", "session_data", "created_at", "expires_at") FROM stdin;
\.


--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_credentials" ("id", "user_id", "credential_id", "public_key", "attestation_type", "aaguid", "sign_count", "transports", "backup_eligible", "backed_up", "friendly_name", "created_at", "updated_at", "last_used_at") FROM stdin;
\.


--
-- Data for Name: Tenant; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."Tenant" ("id", "name", "slug", "gstNumber", "logoUrl", "status", "address", "phone", "email", "createdAt", "updatedAt") FROM stdin;
7398ea38-92ce-4a6f-96ac-135c051c36ac	pure aura	pure	\N	\N	ACTIVE	\N	\N	\N	2026-09-09 15:33:06.665	2026-09-09 15:33:06.665
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."User" ("id", "tenantId", "supabaseUserId", "role", "name", "email", "mobile", "status", "createdAt", "updatedAt", "avatarUrl") FROM stdin;
f833abde-a39b-4154-a3bd-9ef5a3529897	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	CLIENT	ram	ram@gmail.com	6787898780	ACTIVE	2026-09-10 10:35:09.894	2026-09-10 10:35:09.894	\N
384d2191-a74b-4bb4-8b26-ac301fd95f33	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	CLIENT	ash	ash@gmail.com	275327	ACTIVE	2026-09-11 19:28:02.867	2026-09-11 19:28:02.867	\N
cf0d395c-3cf9-459f-92e1-1ec33078c0d6	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	CLIENT	ken	ken@gmail.com	727837	ACTIVE	2026-09-11 20:08:47.075	2026-09-11 20:08:47.075	\N
42caa2e3-ee15-42a9-bebe-bfcf4e42b9e4	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	CLIENT	kev	kev@gmail.com	278327	ACTIVE	2026-09-12 17:00:59.198	2026-09-12 17:00:59.198	\N
4fe06303-aeed-42bf-bbbb-0fda080079a5	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	WAREHOUSE_STAFF	ravu	ravu@gmail.com	72827382	ACTIVE	2026-09-12 18:37:34.96	2026-09-13 16:00:23.608	\N
91785a38-73a3-434b-9fd4-7de10be08bcf	7398ea38-92ce-4a6f-96ac-135c051c36ac	e5bd3b03-ac38-48c1-bc6b-59c8ee9e9bda	CLIENT	ramu	ramu@gmail.com	7327832783	ACTIVE	2026-09-13 17:53:06.485	2026-09-13 17:53:06.485	\N
4e5a4c57-509e-4c2c-a2e4-382b291f988d	7398ea38-92ce-4a6f-96ac-135c051c36ac	a1d1679a-e2f0-4260-96a4-6582f431f0df	CLIENT	axe	axe@gmail.com	783786378637	ACTIVE	2026-09-15 09:48:21.065	2026-09-15 09:48:21.065	\N
cmtpry8fi0001ehlc44z2nurr	\N	5895f77b-80d9-4b97-b1a5-42ff65c0fc6a	PLATFORM_ADMIN	Platform Admin	platform-admin@example.test	\N	ACTIVE	2026-09-06 12:14:59.119	2026-09-06 12:14:59.119	\N
5e913785-569e-43a4-8ce7-dbcac6a10f5e	7398ea38-92ce-4a6f-96ac-135c051c36ac	7d508b33-9473-4beb-89b1-649d5e5b5cac	CLIENT	maxi	maxi@gmail.com	9893029837	ACTIVE	2026-09-15 12:34:33.105	2026-09-15 12:34:33.105	\N
ec754300-67ec-43fe-a6c5-34d978491fb6	7398ea38-92ce-4a6f-96ac-135c051c36ac	9bdf7009-f6f0-4265-aba9-5af74629473a	WAREHOUSE_OWNER	alex	alex@gmail.com	7865367609	ACTIVE	2026-09-09 15:35:26.119	2026-09-09 15:35:26.119	\N
usr_pwus558kdymm2gs60w	7398ea38-92ce-4a6f-96ac-135c051c36ac	29f9fc2c-719b-4a0f-8d52-75b41e065eb4	ACCOUNTANT	jake	jake@gmail.com	\N	ACTIVE	2026-09-15 15:55:07.972	2026-09-15 15:55:07.972	\N
c93e919a-0a8d-4f4f-9b8f-0c9e7300c759	7398ea38-92ce-4a6f-96ac-135c051c36ac	cfbd4054-c84a-440a-809b-f69e71a29136	PLATFORM_ADMIN	Jaivarshan B	ts305715@gmail.com	07339028707	ACTIVE	2026-09-13 15:36:49.067	2026-09-13 15:36:49.067	\N
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."AuditLog" ("id", "tenantId", "userId", "userRole", "action", "entity", "entityId", "previousValue", "newValue", "ipAddress", "userAgent", "createdAt") FROM stdin;
aud_4169a3832f32a2ff	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Generated draft invoice	Invoice	inv_1d298acae4bf3a5a	\N	{"status": "DRAFT", "invoiceNumber": "INV-2026-000001"}	\N	\N	2026-09-09 15:43:07.025
aud_aa83c0a265736a84	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Generated draft invoice	Invoice	inv_e2ef4f0199a8f5f4	\N	{"status": "DRAFT", "invoiceNumber": "INV-2026-000002"}	\N	\N	2026-09-09 15:46:29.594
f48cf2ff-1b4f-4821-82ac-ac7aaf2e87bd	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Created new employee	User	2a1fe91b-93b7-475a-95b7-054c32396428	\N	{"name": "arun", "role": "WAREHOUSE_STAFF", "email": "arun@user.com", "status": "ACTIVE"}	\N	\N	2026-09-10 09:01:02.49
9b201432-1c15-49eb-9ba3-70654a33b049	\N	cmtpry8fi0001ehlc44z2nurr	PLATFORM_ADMIN	CREATE_CLIENT_EMPLOYEE	Client	9470f11a-ad7b-4f4b-99d6-17464f1cd2ca	\N	{"email": "asdfg@user.com", "mobile": "2743278", "userId": "8e209a1e-eddf-4864-a689-af34982f03a5", "companyName": "kauvery", "employeeRole": "RECEIVER", "contactPerson": "aw4h"}	\N	\N	2026-09-10 10:13:23.153
c08fdb8b-29b4-4673-99d1-edabfb237ccd	7398ea38-92ce-4a6f-96ac-135c051c36ac	cmtpry8fi0001ehlc44z2nurr	PLATFORM_ADMIN	CREATE_CLIENT_EMPLOYEE	Client	a5ddae1c-8f8d-4e91-be72-7392c03ed06b	\N	{"email": "ram@gmail.com", "mobile": "6787898780", "userId": "f833abde-a39b-4154-a3bd-9ef5a3529897", "companyName": "pvr", "employeeRole": "RECEIVER", "contactPerson": "ram"}	\N	\N	2026-09-10 10:35:10.416
aud_0c4a3ee03cdcd9e3	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Created order with invoice	Order	ord_77340e22dbe2e663	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000005", "invoiceNumber": "INV-2026-000001"}	\N	\N	2026-09-11 18:48:14.061
aud_bbbd655e347f4909	7398ea38-92ce-4a6f-96ac-135c051c36ac	f833abde-a39b-4154-a3bd-9ef5a3529897	CLIENT	Recorded payment	Payment	pay_7cec41c918333273	\N	{"amount": 212.4, "paymentStatus": "PAID"}	\N	\N	2026-09-11 18:58:59.75
aud_8c4b30f62714e9ca	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Created order with invoice	Order	ord_0d1fca08c7920d18	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000006", "invoiceNumber": "INV-2026-000002"}	\N	\N	2026-09-11 18:59:56.308
36a82f8e-10e8-4ac6-9fc4-3e984fb0bfe8	7398ea38-92ce-4a6f-96ac-135c051c36ac	cmtpry8fi0001ehlc44z2nurr	PLATFORM_ADMIN	CREATE_CLIENT_EMPLOYEE	Client	f438e74f-55ba-478f-823a-01510696a980	\N	{"email": "ash@gmail.com", "mobile": "275327", "userId": "384d2191-a74b-4bb4-8b26-ac301fd95f33", "companyName": "kauvery", "employeeRole": "RECEIVER", "contactPerson": "ash"}	\N	\N	2026-09-11 19:28:03.27
cd78fb32-2070-49db-af9d-0f5a23bd539d	7398ea38-92ce-4a6f-96ac-135c051c36ac	cmtpry8fi0001ehlc44z2nurr	PLATFORM_ADMIN	CREATE_CLIENT_EMPLOYEE	Client	6f12996a-634a-4422-82be-ed9ae2b4f368	\N	{"email": "ken@gmail.com", "mobile": "727837", "userId": "cf0d395c-3cf9-459f-92e1-1ec33078c0d6", "companyName": "kauvery", "employeeRole": "MANAGER", "contactPerson": "ken"}	\N	\N	2026-09-11 20:08:47.274
aud_af753c238eba2a26	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Created order with invoice	Order	ord_c8f7f478399a2de0	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000007", "invoiceNumber": "INV-2026-000003"}	\N	\N	2026-09-11 20:09:46.932
aud_672f1b2d3b854aad	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Created order with invoice	Order	ord_5bcb675f32a96e8e	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000008", "invoiceNumber": "INV-2026-000004"}	\N	\N	2026-09-12 08:47:20.34
aud_c44af947476d7dc6	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Created order with invoice	Order	ord_7e5671527dcb6fdd	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000009", "invoiceNumber": "INV-2026-000005"}	\N	\N	2026-09-12 10:13:07.747
aud_e283fdf22ccb3473	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Created order with invoice	Order	ord_5c0f2565f759cca9	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000010", "invoiceNumber": "INV-2026-000006"}	\N	\N	2026-09-12 12:41:31.426
aud_0cd4358b1c60ac4a	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Generated draft invoice	Invoice	inv_c44a48e08ed83142	\N	{"status": "DRAFT", "invoiceNumber": "INV-2026-000007"}	\N	\N	2026-09-12 12:42:32.347
f959fab6-32b4-46e4-b70c-12a00e165753	7398ea38-92ce-4a6f-96ac-135c051c36ac	cmtpry8fi0001ehlc44z2nurr	PLATFORM_ADMIN	CREATE_CLIENT_EMPLOYEE	Client	516ede8f-4e53-43dc-8ed7-01e190312522	\N	{"email": "kev@gmail.com", "mobile": "278327", "userId": "42caa2e3-ee15-42a9-bebe-bfcf4e42b9e4", "companyName": "pvr", "employeeRole": "RECEIVER", "contactPerson": "kev"}	\N	\N	2026-09-12 17:00:59.521
aud_372344e7308ce7e6	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Created order with invoice	Order	ord_1e2393e075aa9706	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000011", "invoiceNumber": "INV-2026-000008"}	\N	\N	2026-09-12 17:04:23.182
2994de4d-52b5-4883-9109-bcba26f5b0da	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Created new employee	User	4fe06303-aeed-42bf-bbbb-0fda080079a5	\N	{"name": "ravu", "role": "WAREHOUSE_STAFF", "email": "ravu@gmail.com", "status": "ACTIVE"}	\N	\N	2026-09-12 18:37:35.151
aud_8a5a1371e89da00f	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_r771o0kqj	{"status": "DISPATCHED"}	{"status": "RECEIVED"}	\N	\N	2026-09-12 18:38:16.967
aud_b7449fa38c25cfee	7398ea38-92ce-4a6f-96ac-135c051c36ac	384d2191-a74b-4bb4-8b26-ac301fd95f33	CLIENT	Submitted verification	Order	ord_r771o0kqj	{"verificationStatus": "PENDING"}	{"verificationStatus": "VERIFIED"}	\N	\N	2026-09-12 18:39:31.217
aud_2b5f4691734d81ab	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Generated draft invoice	Invoice	inv_6931f9ee95468bed	\N	{"status": "DRAFT", "invoiceNumber": "INV-2026-000009"}	\N	\N	2026-09-12 18:42:22.111
aud_64d88e1255bfd8d1	7398ea38-92ce-4a6f-96ac-135c051c36ac	cf0d395c-3cf9-459f-92e1-1ec33078c0d6	CLIENT	Recorded payment	Payment	pay_5627f8688dc053c4	\N	{"amount": 26535.95, "paymentStatus": "PAID"}	\N	\N	2026-09-12 19:22:30.347
aud_008b39142b956bd7	7398ea38-92ce-4a6f-96ac-135c051c36ac	cf0d395c-3cf9-459f-92e1-1ec33078c0d6	CLIENT	Recorded payment	Payment	pay_c1a6470739bd4aba	\N	{"amount": 88.5, "paymentStatus": "PAID"}	\N	\N	2026-09-13 05:55:09.576
aud_26b00f5f26092470	7398ea38-92ce-4a6f-96ac-135c051c36ac	cf0d395c-3cf9-459f-92e1-1ec33078c0d6	CLIENT	Recorded payment	Payment	pay_cf24e7d2fbbc59d6	\N	{"amount": 88.5, "paymentStatus": "PAID"}	\N	\N	2026-09-13 06:31:08.053
aud_1bf47c1b89349690	7398ea38-92ce-4a6f-96ac-135c051c36ac	cf0d395c-3cf9-459f-92e1-1ec33078c0d6	CLIENT	Recorded payment	Payment	pay_ca1debde304f8ca0	\N	{"amount": 88.5, "paymentStatus": "PAID"}	\N	\N	2026-09-13 06:35:04.478
aud_7e59687843bcc2a6	7398ea38-92ce-4a6f-96ac-135c051c36ac	cf0d395c-3cf9-459f-92e1-1ec33078c0d6	CLIENT	Recorded payment	Payment	pay_c7a44a613c877996	\N	{"amount": 649, "paymentStatus": "PAID"}	\N	\N	2026-09-13 09:50:43.865
aud_00dc16e7c15c9dcf	7398ea38-92ce-4a6f-96ac-135c051c36ac	cf0d395c-3cf9-459f-92e1-1ec33078c0d6	CLIENT	Recorded payment	Payment	pay_a4533bb521b9e455	\N	{"amount": 29.5, "paymentStatus": "PAID"}	\N	\N	2026-09-13 10:21:56.157
aud_70b61916aee1f482	7398ea38-92ce-4a6f-96ac-135c051c36ac	cf0d395c-3cf9-459f-92e1-1ec33078c0d6	CLIENT	Recorded payment	Payment	pay_7766370a1df0636c	\N	{"amount": 57.75, "paymentStatus": "PAID"}	\N	\N	2026-09-13 10:30:05.492
aud_ceeeb685ee93802d	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Created order with invoice	Order	ord_4569c5254cdcc2af	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000012", "invoiceNumber": "INV-2026-000010"}	\N	\N	2026-09-13 11:23:34.743
aud_a36ea7159e7dd729	7398ea38-92ce-4a6f-96ac-135c051c36ac	cf0d395c-3cf9-459f-92e1-1ec33078c0d6	CLIENT	Recorded payment	Payment	pay_f52d3becbd31ce06	\N	{"amount": 649, "paymentStatus": "PAID"}	\N	\N	2026-09-13 11:24:12.419
8257523d-e69e-4203-b01d-dea820769056	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Created new employee	User	c93e919a-0a8d-4f4f-9b8f-0c9e7300c759	\N	{"name": "Jaivarshan B", "role": "ACCOUNTANT", "email": "ts305715@gmail.com", "status": "ACTIVE"}	\N	\N	2026-09-13 15:36:49.296
aud_ee1bea3905fee1b7	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Updated employee record	User	4fe06303-aeed-42bf-bbbb-0fda080079a5	{"id": "4fe06303-aeed-42bf-bbbb-0fda080079a5", "name": "ravu", "role": "WAREHOUSE_STAFF", "email": "ravu@gmail.com", "mobile": "72827382", "status": "ACTIVE", "tenantId": "7398ea38-92ce-4a6f-96ac-135c051c36ac", "avatarUrl": null, "createdAt": "2026-09-12T18:37:34.96", "updatedAt": "2026-09-12T18:37:34.96", "supabaseUserId": null}	{"id": "4fe06303-aeed-42bf-bbbb-0fda080079a5", "name": "ravu", "role": "ACCOUNTANT", "email": "ravu@gmail.com", "mobile": "72827382", "status": "ACTIVE", "tenantId": "7398ea38-92ce-4a6f-96ac-135c051c36ac", "avatarUrl": null, "createdAt": "2026-09-12T18:37:34.96", "updatedAt": "2026-09-13T16:00:14.569", "supabaseUserId": null}	\N	\N	2026-09-13 16:00:14.569
aud_10637888e295f196	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Updated employee record	User	4fe06303-aeed-42bf-bbbb-0fda080079a5	{"id": "4fe06303-aeed-42bf-bbbb-0fda080079a5", "name": "ravu", "role": "ACCOUNTANT", "email": "ravu@gmail.com", "mobile": "72827382", "status": "ACTIVE", "tenantId": "7398ea38-92ce-4a6f-96ac-135c051c36ac", "avatarUrl": null, "createdAt": "2026-09-12T18:37:34.96", "updatedAt": "2026-09-13T16:00:14.569", "supabaseUserId": null}	{"id": "4fe06303-aeed-42bf-bbbb-0fda080079a5", "name": "ravu", "role": "WAREHOUSE_STAFF", "email": "ravu@gmail.com", "mobile": "72827382", "status": "ACTIVE", "tenantId": "7398ea38-92ce-4a6f-96ac-135c051c36ac", "avatarUrl": null, "createdAt": "2026-09-12T18:37:34.96", "updatedAt": "2026-09-13T16:00:23.608", "supabaseUserId": null}	\N	\N	2026-09-13 16:00:23.608
2b600377-13ed-41f4-98c0-c5cdae721259	7398ea38-92ce-4a6f-96ac-135c051c36ac	cmtpry8fi0001ehlc44z2nurr	PLATFORM_ADMIN	CREATE_CLIENT_EMPLOYEE	Client	5576749a-1a4a-4414-bb79-1e2e018c0252	\N	{"email": "ramu@gmail.com", "mobile": "7327832783", "userId": "91785a38-73a3-434b-9fd4-7de10be08bcf", "companyName": "pvr", "employeeRole": "GM", "contactPerson": "ramu"}	\N	\N	2026-09-13 17:53:07.158
aud_04c54f8dc0b46c80	7398ea38-92ce-4a6f-96ac-135c051c36ac	91785a38-73a3-434b-9fd4-7de10be08bcf	CLIENT	Recorded payment	Payment	pay_cc6be49131cc28c2	\N	{"amount": 29.5, "paymentStatus": "PAID"}	\N	\N	2026-09-13 17:53:27.741
aud_4513b4b09b49eb3f	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Generated final invoice	Invoice	inv_c54ffcf5fb34fcf6	\N	{"status": "FINAL", "invoiceNumber": "INV-2026-000011"}	\N	\N	2026-09-14 09:36:51.474
aud_2b79fe66916fbace	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_STAFF	Created order with final invoice	Order	ord_bf77a625780c3195	\N	{"status": "ISSUED", "orderNumber": "ORD-2026-000013", "totalAmount": 47.20, "invoiceNumber": "INV-2026-000012", "invoiceStatus": "FINAL"}	\N	\N	2026-09-15 05:36:42.567
aud_5fc0e49ecfee2464	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_bf77a625780c3195	{"status": "ISSUED"}	{"status": "DISPATCHED"}	\N	\N	2026-09-15 05:37:12.344
aud_83e8547a7cc01c7c	7398ea38-92ce-4a6f-96ac-135c051c36ac	f833abde-a39b-4154-a3bd-9ef5a3529897	CLIENT	Submitted delivery verification	Order	ord_bf77a625780c3195	{"status": "DISPATCHED", "verificationStatus": "PENDING"}	{"status": "VERIFIED", "verificationStatus": "VERIFIED"}	\N	\N	2026-09-15 05:37:27.836
aud_409149e4bedd0e5b	7398ea38-92ce-4a6f-96ac-135c051c36ac	f833abde-a39b-4154-a3bd-9ef5a3529897	CLIENT	Submitted delivery verification	Order	ord_vmbqcjay6	{"status": "DISPATCHED", "verificationStatus": "PENDING"}	{"status": "VERIFIED", "verificationStatus": "VERIFIED"}	\N	\N	2026-09-15 05:37:41.861
aud_3e0ddcbb537d8c29	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Recorded payment	Payment	pay_2e9b55427da034b0	\N	{"amount": 26535.95, "paymentStatus": "PAID"}	\N	\N	2026-09-15 05:38:45.456
aud_e9b682fa8f80c313	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Recorded payment	Payment	pay_94cf0d289480021c	\N	{"amount": 47.2, "paymentStatus": "PAID"}	\N	\N	2026-09-15 07:09:06.839
aud_4d3c1b9786a3f6c8	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_STAFF	Created order with final invoice	Order	ord_0641ebad8b88a29d	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000014", "totalAmount": 94.40, "invoiceNumber": "INV-2026-000013", "invoiceStatus": "FINAL"}	\N	\N	2026-09-15 07:30:14.84
aud_3b42087d20dc1066	7398ea38-92ce-4a6f-96ac-135c051c36ac	91785a38-73a3-434b-9fd4-7de10be08bcf	CLIENT	Recorded payment	Payment	pay_1a1991f1e30f07e8	\N	{"amount": 94.4, "paymentStatus": "PAID"}	\N	\N	2026-09-15 07:30:32.743
aud_b2f73ff231c0d6a0	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_STAFF	Created order with final invoice	Order	ord_f6ae4cc226ef8e72	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000015", "totalAmount": 47.20, "invoiceNumber": "INV-2026-000014", "invoiceStatus": "FINAL"}	\N	\N	2026-09-15 09:43:29.502
aud_d47631829739db72	7398ea38-92ce-4a6f-96ac-135c051c36ac	91785a38-73a3-434b-9fd4-7de10be08bcf	CLIENT	Recorded payment	Payment	pay_0dbc450aa787bff0	\N	{"amount": 47.2, "paymentStatus": "PAID"}	\N	\N	2026-09-15 09:43:56.045
8af6df69-ee54-4ca5-ade5-d284051cda8d	7398ea38-92ce-4a6f-96ac-135c051c36ac	cmtpry8fi0001ehlc44z2nurr	PLATFORM_ADMIN	CREATE_CLIENT_EMPLOYEE	Client	06febca4-8e43-464f-86df-da1b3254670d	\N	{"email": "axe@gmail.com", "mobile": "783786378637", "userId": "4e5a4c57-509e-4c2c-a2e4-382b291f988d", "companyName": "kauvery", "employeeRole": "GM", "contactPerson": "axe"}	\N	\N	2026-09-15 09:48:21.557
aud_f80dcea2ebc0b089	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_STAFF	Created order with final invoice	Order	ord_897a558d4baf7ae4	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000016", "totalAmount": 29.50, "invoiceNumber": "INV-2026-000015", "invoiceStatus": "FINAL"}	\N	\N	2026-09-15 10:32:41.287
aud_eae20ccbc1989478	7398ea38-92ce-4a6f-96ac-135c051c36ac	91785a38-73a3-434b-9fd4-7de10be08bcf	CLIENT	Recorded payment	Payment	pay_5596b67ae8bb70b9	\N	{"amount": 29.5, "paymentStatus": "PAID"}	\N	\N	2026-09-15 10:33:03.339
aud_de3160aa3268b6ee	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_STAFF	Created order with final invoice	Order	ord_e8fcb588cc0fcfac	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000017", "totalAmount": 212.40, "invoiceNumber": "INV-2026-000016", "invoiceStatus": "FINAL"}	\N	\N	2026-09-15 10:56:22.36
aud_630d4dd28d9df235	7398ea38-92ce-4a6f-96ac-135c051c36ac	91785a38-73a3-434b-9fd4-7de10be08bcf	CLIENT	Recorded payment	Payment	pay_1bdb0cb1f73b0127	\N	{"amount": 212.4, "paymentStatus": "PAID"}	\N	\N	2026-09-15 10:57:21.715
9bbf7ec5-c476-45db-b4be-5fae8e968617	7398ea38-92ce-4a6f-96ac-135c051c36ac	cmtpry8fi0001ehlc44z2nurr	PLATFORM_ADMIN	CREATE_CLIENT_EMPLOYEE	Client	f24af5bc-bc7d-43b4-b13d-c20f86c19e9a	\N	{"email": "maxi@gmail.com", "mobile": "9893029837", "userId": "5e913785-569e-43a4-8ce7-dbcac6a10f5e", "companyName": "kauvery", "employeeRole": "ACCOUNT", "contactPerson": "maxi"}	\N	\N	2026-09-15 12:34:34.384
aud_94892cedcf305804	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_STAFF	Created order with final invoice	Order	ord_cf5a69d14af1411c	\N	{"status": "ISSUED", "orderNumber": "ORD-2026-000018", "totalAmount": 47200.00, "invoiceNumber": "INV-2026-000017", "invoiceStatus": "FINAL"}	\N	\N	2026-09-15 13:41:59.486
842af7e8-765e-4f3f-8616-d28e95974b01	7398ea38-92ce-4a6f-96ac-135c051c36ac	cmtpry8fi0001ehlc44z2nurr	PLATFORM_ADMIN	UPDATE_USER_ROLE	User	c93e919a-0a8d-4f4f-9b8f-0c9e7300c759	{"role": "ACCOUNTANT"}	{"role": "PLATFORM_ADMIN"}	\N	\N	2026-09-15 15:09:48.343
aud_9470af438424b733	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_STAFF	Created order with final invoice	Order	ord_d6788badb4955cec	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000019", "totalAmount": 2360.00, "invoiceNumber": "INV-2026-000018", "invoiceStatus": "FINAL"}	\N	\N	2026-09-15 17:11:00.371
aud_daff531567452c1b	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_d6788badb4955cec	{"status": "DRAFT"}	{"status": "ISSUED"}	\N	\N	2026-09-15 17:11:15.395
aud_d8abc2054bb18fff	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_d6788badb4955cec	{"status": "ISSUED"}	{"status": "PROCESSING"}	\N	\N	2026-09-15 17:12:14.65
aud_1524c63fb8abba99	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_d6788badb4955cec	{"status": "PROCESSING"}	{"status": "READY_FOR_DISPATCH"}	\N	\N	2026-09-15 17:12:20.523
aud_dc11258b304dcad7	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_d6788badb4955cec	{"status": "READY_FOR_DISPATCH"}	{"status": "DISPATCHED"}	\N	\N	2026-09-15 17:12:24.828
aud_510d04ebba08cb6f	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_e8fcb588cc0fcfac	{"status": "DRAFT"}	{"status": "ISSUED"}	\N	\N	2026-09-15 17:55:04.556
aud_35352245c3fe5ef0	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_897a558d4baf7ae4	{"status": "DRAFT"}	{"status": "ISSUED"}	\N	\N	2026-09-15 17:55:25.075
aud_08f97443caf3550b	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_STAFF	Created order with final invoice	Order	ord_163b17edfcd83624	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000020", "totalAmount": 10030.00, "invoiceNumber": "INV-2026-000019", "invoiceStatus": "FINAL"}	\N	\N	2026-09-15 17:55:38.652
aud_c29f65ff7efe778d	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_STAFF	Created order with final invoice	Order	ord_b80cd580b8401355	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000021", "totalAmount": 22420.00, "invoiceNumber": "INV-2026-000020", "invoiceStatus": "FINAL"}	\N	\N	2026-09-15 17:57:27.742
aud_8917184fdec509f0	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_b80cd580b8401355	{"status": "DRAFT"}	{"status": "ISSUED"}	\N	\N	2026-09-16 06:18:45.398
aud_f47cb9217d6ecc37	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_STAFF	Created order with final invoice	Order	ord_087b39c6a86e5585	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000022", "totalAmount": 57750.00, "invoiceNumber": "INV-2026-000021", "invoiceStatus": "FINAL"}	\N	\N	2026-09-16 09:13:28.692
aud_1bbb7eaae6f90dd5	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_087b39c6a86e5585	{"status": "DRAFT"}	{"status": "ISSUED"}	\N	\N	2026-09-16 09:13:39.335
aud_ac0630e5fc1188d9	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_STAFF	Created order with final invoice	Order	ord_2b87efa1d28ff39c	\N	{"status": "DRAFT", "orderNumber": "ORD-2026-000023", "totalAmount": 560500.00, "invoiceNumber": "INV-2026-000022", "invoiceStatus": "FINAL"}	\N	\N	2026-09-16 09:14:53.995
aud_6c4f095c1e9562cb	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_2b87efa1d28ff39c	{"status": "DRAFT"}	{"status": "ISSUED"}	\N	\N	2026-09-16 09:22:28.602
aud_4821aca41380edaa	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_2b87efa1d28ff39c	{"status": "ISSUED"}	{"status": "PROCESSING"}	\N	\N	2026-09-16 09:22:38.386
aud_94f024ba97e8bd77	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_2b87efa1d28ff39c	{"status": "PROCESSING"}	{"status": "READY_FOR_DISPATCH"}	\N	\N	2026-09-16 09:22:44.151
aud_0154ba7946518060	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_2b87efa1d28ff39c	{"status": "READY_FOR_DISPATCH"}	{"status": "DISPATCHED"}	\N	\N	2026-09-16 09:22:47.762
aud_c03080e79904b09f	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_087b39c6a86e5585	{"status": "ISSUED"}	{"status": "PROCESSING"}	\N	\N	2026-09-16 11:04:51.049
aud_f3a8da756298921e	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_087b39c6a86e5585	{"status": "PROCESSING"}	{"status": "READY_FOR_DISPATCH"}	\N	\N	2026-09-16 11:04:56.545
aud_909cb036813c61e7	7398ea38-92ce-4a6f-96ac-135c051c36ac	ec754300-67ec-43fe-a6c5-34d978491fb6	WAREHOUSE_OWNER	Changed order status	Order	ord_087b39c6a86e5585	{"status": "READY_FOR_DISPATCH"}	{"status": "DISPATCHED"}	\N	\N	2026-09-16 11:05:02.365
aud_a377dedef6358328	7398ea38-92ce-4a6f-96ac-135c051c36ac	c93e919a-0a8d-4f4f-9b8f-0c9e7300c759	PLATFORM_ADMIN	Recorded payment	Payment	pay_214c5b78445978fc	\N	{"amount": 47200, "method": "NEFT / RTGS", "reference": "PAY-169135", "paymentStatus": "PAID"}	\N	\N	2026-09-17 09:59:29.067
aud_d7e228e1dff5fbd2	7398ea38-92ce-4a6f-96ac-135c051c36ac	c93e919a-0a8d-4f4f-9b8f-0c9e7300c759	PLATFORM_ADMIN	Attached payment proof	Payment	pay_214c5b78445978fc	\N	{"proofUrl": "7398ea38-92ce-4a6f-96ac-135c051c36ac/inv_31873a1161db370b/pay_214c5b78445978fc/1789639168127-2g4u68.jpeg", "invoiceId": "inv_31873a1161db370b", "paymentId": "pay_214c5b78445978fc"}	\N	\N	2026-09-17 09:59:30.137
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."Category" ("id", "tenantId", "name", "createdAt") FROM stdin;
\.


--
-- Data for Name: CompanyGroup; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."CompanyGroup" ("id", "tenantId", "name", "description", "createdAt", "updatedAt") FROM stdin;
cg_2a65e8fe88ea48d4	7398ea38-92ce-4a6f-96ac-135c051c36ac	kauvery	\N	2026-09-12 11:21:34.28	2026-09-12 11:21:34.28
cg_1e029fc10371853f	7398ea38-92ce-4a6f-96ac-135c051c36ac	pvr	\N	2026-09-12 11:21:34.28	2026-09-12 11:21:34.28
\.


--
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."Client" ("id", "tenantId", "userId", "companyName", "contactPerson", "mobile", "email", "gstNumber", "billingAddress", "shippingAddress", "status", "createdAt", "updatedAt", "companyGroupId", "employeeRole") FROM stdin;
5576749a-1a4a-4414-bb79-1e2e018c0252	7398ea38-92ce-4a6f-96ac-135c051c36ac	91785a38-73a3-434b-9fd4-7de10be08bcf	pvr	ramu	7327832783	ramu@gmail.com	\N	Main Office	Main Office	ACTIVE	2026-09-13 17:53:06.974	2026-09-13 17:53:06.974	cg_1e029fc10371853f	GM
06febca4-8e43-464f-86df-da1b3254670d	7398ea38-92ce-4a6f-96ac-135c051c36ac	4e5a4c57-509e-4c2c-a2e4-382b291f988d	kauvery	axe	783786378637	axe@gmail.com	\N	Main Office	Main Office	ACTIVE	2026-09-15 09:48:21.379	2026-09-15 09:48:21.379	cg_2a65e8fe88ea48d4	GM
7c5eac47-1b6f-44ce-8814-9b773aa7cfa8	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	kauvery	john	7896546787	john@gmail.com	\N	bhbuh	vgvyg	ACTIVE	2026-09-09 15:34:12.49	2026-09-09 15:34:12.49	cg_2a65e8fe88ea48d4	MANAGER
c2bd9c66-df6f-403d-8650-3b6ba78a59d4	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	pvr	max	9890987656	max@gmail.com	\N	bbuubu	vyv	ACTIVE	2026-09-10 10:34:33.522	2026-09-10 10:34:33.522	cg_1e029fc10371853f	MANAGER
a5ddae1c-8f8d-4e91-be72-7392c03ed06b	7398ea38-92ce-4a6f-96ac-135c051c36ac	f833abde-a39b-4154-a3bd-9ef5a3529897	pvr	ram	6787898780	ram@gmail.com	\N	Main Office	Main Office	ACTIVE	2026-09-10 10:35:10.179	2026-09-10 10:35:10.179	cg_1e029fc10371853f	RECEIVER
f438e74f-55ba-478f-823a-01510696a980	7398ea38-92ce-4a6f-96ac-135c051c36ac	384d2191-a74b-4bb4-8b26-ac301fd95f33	kauvery	ash	275327	ash@gmail.com	\N	Main Office	Main Office	ACTIVE	2026-09-11 19:28:03.068	2026-09-11 19:28:03.068	cg_2a65e8fe88ea48d4	RECEIVER
6f12996a-634a-4422-82be-ed9ae2b4f368	7398ea38-92ce-4a6f-96ac-135c051c36ac	cf0d395c-3cf9-459f-92e1-1ec33078c0d6	kauvery	ken	727837	ken@gmail.com	\N	Main Office	Main Office	ACTIVE	2026-09-11 20:08:47.177	2026-09-11 20:08:47.177	cg_2a65e8fe88ea48d4	MANAGER
516ede8f-4e53-43dc-8ed7-01e190312522	7398ea38-92ce-4a6f-96ac-135c051c36ac	42caa2e3-ee15-42a9-bebe-bfcf4e42b9e4	pvr	kev	278327	kev@gmail.com	\N	Main Office	Main Office	ACTIVE	2026-09-12 17:00:59.427	2026-09-12 17:00:59.427	cg_1e029fc10371853f	RECEIVER
f24af5bc-bc7d-43b4-b13d-c20f86c19e9a	7398ea38-92ce-4a6f-96ac-135c051c36ac	5e913785-569e-43a4-8ce7-dbcac6a10f5e	kauvery	maxi	9893029837	maxi@gmail.com	\N	sxwqw1	sxwqw1	ACTIVE	2026-09-15 12:34:34.229	2026-09-15 12:34:34.229	cg_2a65e8fe88ea48d4	ACCOUNT
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."Order" ("id", "tenantId", "clientId", "orderNumber", "orderDate", "expectedDelivery", "status", "verificationStatus", "subtotal", "taxTotal", "discountTotal", "totalAmount", "notes", "createdById", "assignedStaffId", "createdAt", "updatedAt") FROM stdin;
ord_cgeddwjcy	7398ea38-92ce-4a6f-96ac-135c051c36ac	7c5eac47-1b6f-44ce-8814-9b773aa7cfa8	ORD-2026-000003	2026-09-10 12:30:33.197	\N	ISSUED	PENDING	40.00	7.20	0.00	47.20	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-10 12:30:33.197	2026-09-10 12:30:33.197
ord_7owqrol20	7398ea38-92ce-4a6f-96ac-135c051c36ac	7c5eac47-1b6f-44ce-8814-9b773aa7cfa8	ORD-2026-000004	2026-09-11 08:30:03.106	\N	ISSUED	PENDING	400.00	72.00	0.00	472.00	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-11 08:30:03.106	2026-09-11 08:30:03.106
ord_77340e22dbe2e663	7398ea38-92ce-4a6f-96ac-135c051c36ac	7c5eac47-1b6f-44ce-8814-9b773aa7cfa8	ORD-2026-000005	2026-09-11 18:48:14.061	\N	DRAFT	PENDING	180.00	32.40	0.00	212.40	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-11 18:48:14.061	2026-09-11 18:48:14.061
ord_0d1fca08c7920d18	7398ea38-92ce-4a6f-96ac-135c051c36ac	a5ddae1c-8f8d-4e91-be72-7392c03ed06b	ORD-2026-000006	2026-09-11 18:59:56.308	\N	DRAFT	PENDING	25.00	4.50	0.00	29.50	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-11 18:59:56.308	2026-09-11 18:59:56.308
ord_c8f7f478399a2de0	7398ea38-92ce-4a6f-96ac-135c051c36ac	f438e74f-55ba-478f-823a-01510696a980	ORD-2026-000007	2026-09-11 20:09:46.932	\N	DRAFT	PENDING	55.00	2.75	0.00	57.75	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-11 20:09:46.932	2026-09-11 20:09:46.932
ord_5bcb675f32a96e8e	7398ea38-92ce-4a6f-96ac-135c051c36ac	f438e74f-55ba-478f-823a-01510696a980	ORD-2026-000008	2026-09-12 08:47:20.34	\N	DRAFT	PENDING	25.00	4.50	0.00	29.50	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-12 08:47:20.34	2026-09-12 08:47:20.34
ord_7e5671527dcb6fdd	7398ea38-92ce-4a6f-96ac-135c051c36ac	f438e74f-55ba-478f-823a-01510696a980	ORD-2026-000009	2026-09-12 10:13:07.747	\N	DRAFT	PENDING	550.00	99.00	0.00	649.00	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-12 10:13:07.747	2026-09-12 10:13:07.747
ord_5c0f2565f759cca9	7398ea38-92ce-4a6f-96ac-135c051c36ac	f438e74f-55ba-478f-823a-01510696a980	ORD-2026-000010	2026-09-12 12:41:31.426	\N	DRAFT	PENDING	75.00	13.50	0.00	88.50	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-12 12:41:31.426	2026-09-12 12:41:31.426
ord_1e2393e075aa9706	7398ea38-92ce-4a6f-96ac-135c051c36ac	f438e74f-55ba-478f-823a-01510696a980	ORD-2026-000011	2026-09-12 17:04:23.182	\N	DRAFT	PENDING	75.00	13.50	0.00	88.50	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-12 17:04:23.182	2026-09-12 17:04:23.182
ord_4569c5254cdcc2af	7398ea38-92ce-4a6f-96ac-135c051c36ac	f438e74f-55ba-478f-823a-01510696a980	ORD-2026-000012	2026-09-13 11:23:34.743	\N	DRAFT	PENDING	550.00	99.00	0.00	649.00	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-13 11:23:34.743	2026-09-13 11:23:34.743
ord_bf77a625780c3195	7398ea38-92ce-4a6f-96ac-135c051c36ac	c2bd9c66-df6f-403d-8650-3b6ba78a59d4	ORD-2026-000013	2026-09-15 05:36:42.567	\N	VERIFIED	VERIFIED	40.00	7.20	0.00	47.20	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 05:36:42.567	2026-09-15 05:37:27.836
ord_vmbqcjay6	7398ea38-92ce-4a6f-96ac-135c051c36ac	a5ddae1c-8f8d-4e91-be72-7392c03ed06b	ORD-2026-000002	2026-09-10 10:37:15.234	\N	VERIFIED	VERIFIED	305.00	47.75	0.00	352.75	Imported invoice 2399. Imported from Pure Aura invoice: document	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-10 10:37:15.234	2026-09-15 05:37:41.861
ord_r771o0kqj	7398ea38-92ce-4a6f-96ac-135c051c36ac	7c5eac47-1b6f-44ce-8814-9b773aa7cfa8	ORD-2026-000001	2026-09-09 15:48:30.502	\N	PAID	VERIFIED	23302.80	3233.15	0.00	26535.95	Imported invoice 2324. Imported from Pure Aura invoice: document	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-09 15:48:30.502	2026-09-15 05:38:45.456
ord_0641ebad8b88a29d	7398ea38-92ce-4a6f-96ac-135c051c36ac	c2bd9c66-df6f-403d-8650-3b6ba78a59d4	ORD-2026-000014	2026-09-15 07:30:14.84	\N	DRAFT	PENDING	80.00	14.40	0.00	94.40	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 07:30:14.84	2026-09-15 07:30:14.84
ord_f6ae4cc226ef8e72	7398ea38-92ce-4a6f-96ac-135c051c36ac	c2bd9c66-df6f-403d-8650-3b6ba78a59d4	ORD-2026-000015	2026-09-15 09:43:29.502	\N	DRAFT	PENDING	40.00	7.20	0.00	47.20	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 09:43:29.502	2026-09-15 09:43:29.502
ord_cf5a69d14af1411c	7398ea38-92ce-4a6f-96ac-135c051c36ac	f438e74f-55ba-478f-823a-01510696a980	ORD-2026-000018	2026-09-15 13:41:59.486	\N	ISSUED	PENDING	40000.00	7200.00	0.00	47200.00	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 13:41:59.486	2026-09-15 13:41:59.486
ord_d6788badb4955cec	7398ea38-92ce-4a6f-96ac-135c051c36ac	516ede8f-4e53-43dc-8ed7-01e190312522	ORD-2026-000019	2026-09-15 17:11:00.371	\N	DISPATCHED	PENDING	2000.00	360.00	0.00	2360.00	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 17:11:00.371	2026-09-15 17:12:24.828
ord_e8fcb588cc0fcfac	7398ea38-92ce-4a6f-96ac-135c051c36ac	c2bd9c66-df6f-403d-8650-3b6ba78a59d4	ORD-2026-000017	2026-09-15 10:56:22.36	\N	ISSUED	PENDING	180.00	32.40	0.00	212.40	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 10:56:22.36	2026-09-15 17:55:04.556
ord_897a558d4baf7ae4	7398ea38-92ce-4a6f-96ac-135c051c36ac	c2bd9c66-df6f-403d-8650-3b6ba78a59d4	ORD-2026-000016	2026-09-15 10:32:41.287	\N	ISSUED	PENDING	25.00	4.50	0.00	29.50	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 10:32:41.287	2026-09-15 17:55:25.075
ord_163b17edfcd83624	7398ea38-92ce-4a6f-96ac-135c051c36ac	f438e74f-55ba-478f-823a-01510696a980	ORD-2026-000020	2026-09-15 17:55:38.652	\N	DRAFT	PENDING	8500.00	1530.00	0.00	10030.00	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 17:55:38.652	2026-09-15 17:55:38.652
ord_b80cd580b8401355	7398ea38-92ce-4a6f-96ac-135c051c36ac	f438e74f-55ba-478f-823a-01510696a980	ORD-2026-000021	2026-09-15 17:57:27.742	\N	ISSUED	PENDING	19000.00	3420.00	0.00	22420.00	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 17:57:27.742	2026-09-16 06:18:45.398
ord_2b87efa1d28ff39c	7398ea38-92ce-4a6f-96ac-135c051c36ac	f438e74f-55ba-478f-823a-01510696a980	ORD-2026-000023	2026-09-16 09:14:53.995	\N	DISPATCHED	PENDING	475000.00	85500.00	0.00	560500.00	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-16 09:14:53.995	2026-09-16 09:22:47.762
ord_087b39c6a86e5585	7398ea38-92ce-4a6f-96ac-135c051c36ac	f438e74f-55ba-478f-823a-01510696a980	ORD-2026-000022	2026-09-16 09:13:28.692	\N	DISPATCHED	PENDING	55000.00	2750.00	0.00	57750.00	\N	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-16 09:13:28.692	2026-09-16 11:05:02.365
\.


--
-- Data for Name: Document; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."Document" ("id", "tenantId", "orderId", "type", "name", "url", "mimeType", "sizeBytes", "createdAt") FROM stdin;
\.


--
-- Data for Name: Invoice; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."Invoice" ("id", "tenantId", "orderId", "clientId", "invoiceNumber", "invoiceDate", "status", "paymentStatus", "subtotal", "cgst", "sgst", "igst", "discountTotal", "total", "pdfUrl", "finalizedAt", "createdAt", "updatedAt") FROM stdin;
inv_84ebf935c079b55c	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_77340e22dbe2e663	7c5eac47-1b6f-44ce-8814-9b773aa7cfa8	INV-2026-000001	2026-09-11 00:00:00	DRAFT	PAID	180.00	16.20	16.20	0.00	0.00	212.40	\N	\N	2026-09-11 18:48:14.061	2026-09-11 18:58:59.75
inv_6931f9ee95468bed	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_r771o0kqj	7c5eac47-1b6f-44ce-8814-9b773aa7cfa8	INV-2026-000009	2026-09-12 18:42:22.111	DRAFT	PAID	23302.80	1616.58	1616.58	0.00	0.00	26535.95	\N	\N	2026-09-12 18:42:22.111	2026-09-12 19:22:30.347
inv_465e036afcc94ca5	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_1e2393e075aa9706	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000008	2026-09-12 00:00:00	DRAFT	PAID	75.00	6.75	6.75	0.00	0.00	88.50	\N	\N	2026-09-12 17:04:23.182	2026-09-13 05:55:09.576
inv_c44a48e08ed83142	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_5c0f2565f759cca9	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000007	2026-09-12 12:42:32.347	DRAFT	PAID	75.00	6.75	6.75	0.00	0.00	88.50	\N	\N	2026-09-12 12:42:32.347	2026-09-13 06:31:08.053
inv_a114f47e45e3ad7e	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_5c0f2565f759cca9	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000006	2026-09-12 00:00:00	DRAFT	PAID	75.00	6.75	6.75	0.00	0.00	88.50	\N	\N	2026-09-12 12:41:31.426	2026-09-13 06:35:04.478
inv_ec9f0afb4206fb2f	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_7e5671527dcb6fdd	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000005	2026-09-12 00:00:00	DRAFT	PAID	550.00	49.50	49.50	0.00	0.00	649.00	\N	\N	2026-09-12 10:13:07.747	2026-09-13 09:50:43.865
inv_6eb8602db86be0a3	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_5bcb675f32a96e8e	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000004	2026-09-12 00:00:00	DRAFT	PAID	25.00	2.25	2.25	0.00	0.00	29.50	\N	\N	2026-09-12 08:47:20.34	2026-09-13 10:21:56.157
inv_b4c4512e7756e190	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_c8f7f478399a2de0	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000003	2026-09-11 00:00:00	DRAFT	PAID	55.00	1.38	1.38	0.00	0.00	57.75	\N	\N	2026-09-11 20:09:46.932	2026-09-13 10:30:05.492
inv_e9d8baf5b6c9bd4d	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_4569c5254cdcc2af	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000010	2026-09-13 00:00:00	DRAFT	PAID	550.00	49.50	49.50	0.00	0.00	649.00	\N	\N	2026-09-13 11:23:34.743	2026-09-13 11:24:12.419
inv_6e5429174d12a914	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_0d1fca08c7920d18	a5ddae1c-8f8d-4e91-be72-7392c03ed06b	INV-2026-000002	2026-09-11 00:00:00	DRAFT	PAID	25.00	2.25	2.25	0.00	0.00	29.50	\N	\N	2026-09-11 18:59:56.308	2026-09-13 17:53:27.741
inv_c54ffcf5fb34fcf6	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_r771o0kqj	7c5eac47-1b6f-44ce-8814-9b773aa7cfa8	INV-2026-000011	2026-09-14 09:36:51.474	FINAL	PAID	23302.80	1616.58	1616.58	0.00	0.00	26535.95	\N	2026-09-14 09:36:51.474	2026-09-14 09:36:51.474	2026-09-15 05:38:45.456
inv_0e0cefcb162c81ff	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_bf77a625780c3195	c2bd9c66-df6f-403d-8650-3b6ba78a59d4	INV-2026-000012	2026-09-15 00:00:00	FINAL	PAID	40.00	3.60	3.60	0.00	0.00	47.20	\N	2026-09-15 05:36:42.567	2026-09-15 05:36:42.567	2026-09-15 07:09:06.839
inv_6a7c6d26d62c4fe2	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_0641ebad8b88a29d	c2bd9c66-df6f-403d-8650-3b6ba78a59d4	INV-2026-000013	2026-09-15 00:00:00	FINAL	PAID	80.00	7.20	7.20	0.00	0.00	94.40	\N	2026-09-15 07:30:14.84	2026-09-15 07:30:14.84	2026-09-15 07:30:32.743
inv_e83552a16f2b8e21	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_f6ae4cc226ef8e72	c2bd9c66-df6f-403d-8650-3b6ba78a59d4	INV-2026-000014	2026-09-15 00:00:00	FINAL	PAID	40.00	3.60	3.60	0.00	0.00	47.20	\N	2026-09-15 09:43:29.502	2026-09-15 09:43:29.502	2026-09-15 09:43:56.045
inv_d23d059f6b75c739	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_897a558d4baf7ae4	c2bd9c66-df6f-403d-8650-3b6ba78a59d4	INV-2026-000015	2026-09-15 00:00:00	FINAL	PAID	25.00	2.25	2.25	0.00	0.00	29.50	\N	2026-09-15 10:32:41.287	2026-09-15 10:32:41.287	2026-09-15 10:33:03.339
inv_721a33d9f6cefa7a	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_e8fcb588cc0fcfac	c2bd9c66-df6f-403d-8650-3b6ba78a59d4	INV-2026-000016	2026-09-15 00:00:00	FINAL	PAID	180.00	16.20	16.20	0.00	0.00	212.40	\N	2026-09-15 10:56:22.36	2026-09-15 10:56:22.36	2026-09-15 10:57:21.715
inv_b0815c71664e0453	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_d6788badb4955cec	516ede8f-4e53-43dc-8ed7-01e190312522	INV-2026-000018	2026-09-15 00:00:00	FINAL	UNPAID	2000.00	180.00	180.00	0.00	0.00	2360.00	\N	2026-09-15 17:11:00.371	2026-09-15 17:11:00.371	2026-09-15 17:11:00.371
inv_c29ac441ab97ee33	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_163b17edfcd83624	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000019	2026-09-15 00:00:00	FINAL	UNPAID	8500.00	765.00	765.00	0.00	0.00	10030.00	\N	2026-09-15 17:55:38.652	2026-09-15 17:55:38.652	2026-09-15 17:55:38.652
inv_00643f11c7e870f4	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_b80cd580b8401355	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000020	2026-09-15 00:00:00	FINAL	UNPAID	19000.00	1710.00	1710.00	0.00	0.00	22420.00	\N	2026-09-15 17:57:27.742	2026-09-15 17:57:27.742	2026-09-15 17:57:27.742
inv_ab9cd9002d205064	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_087b39c6a86e5585	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000021	2026-09-16 00:00:00	FINAL	UNPAID	55000.00	1375.00	1375.00	0.00	0.00	57750.00	\N	2026-09-16 09:13:28.692	2026-09-16 09:13:28.692	2026-09-16 09:13:28.692
inv_f1a23d75ec7b37c9	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_2b87efa1d28ff39c	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000022	2026-09-16 00:00:00	FINAL	UNPAID	475000.00	42750.00	42750.00	0.00	0.00	560500.00	\N	2026-09-16 09:14:53.995	2026-09-16 09:14:53.995	2026-09-16 09:14:53.995
inv_31873a1161db370b	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_cf5a69d14af1411c	f438e74f-55ba-478f-823a-01510696a980	INV-2026-000017	2026-09-15 00:00:00	FINAL	PAID	40000.00	3600.00	3600.00	0.00	0.00	47200.00	\N	2026-09-15 13:41:59.486	2026-09-15 13:41:59.486	2026-09-17 09:59:29.067
\.


--
-- Data for Name: ImportedInvoice; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ImportedInvoice" ("id", "tenantId", "originalDocumentId", "invoiceId", "orderId", "clientId", "uploadedById", "importNumber", "status", "extractedData", "correctedData", "missingFields", "confidence", "failureReason", "confirmedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: DeliveryVerification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."DeliveryVerification" ("id", "tenantId", "orderId", "invoiceId", "importedInvoiceId", "clientId", "status", "confirmationText", "comments", "attachments", "ipAddress", "userAgent", "verifiedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ImportedInvoiceItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ImportedInvoiceItem" ("id", "importedInvoiceId", "productName", "sku", "hsnSac", "quantity", "unit", "rate", "discount", "taxableValue", "gstRate", "cgst", "sgst", "igst", "total", "requiresReview") FROM stdin;
\.


--
-- Data for Name: DeliveryVerificationItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."DeliveryVerificationItem" ("id", "verificationId", "importedInvoiceItemId", "expectedQuantity", "receivedQuantity", "status", "comment", "attachment", "verifiedAt") FROM stdin;
\.


--
-- Data for Name: EWayBill; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."EWayBill" ("id", "tenantId", "invoiceId", "importedInvoiceId", "ewayBillNumber", "documentNumber", "documentDate", "supplierGstin", "recipientGstin", "dispatchFrom", "shipTo", "transporterId", "vehicleNumber", "transportMode", "distance", "status", "missingFields", "requestData", "responseData", "generatedAt", "expiryDate", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."Product" ("id", "tenantId", "categoryId", "sku", "name", "brand", "description", "unit", "purchasePrice", "sellingPrice", "gstRate", "barcode", "minimumStock", "reorderLevel", "status", "imageUrl", "createdAt", "updatedAt") FROM stdin;
prod_xq6fnymjh	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-29071220-1	Acid - HCL - 1 Liter	\N	\N	Btl	42.37	42.37	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:23.796	2026-09-09 15:43:23.796
prod_jojns280g	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-39249090-2	Hand wash Dispenser	\N	\N	Pcs	180.00	180.00	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:23.896	2026-09-09 15:43:23.896
prod_xk7pttvgs	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-4419-3	Wooden Stirrer - 110 mm  (450pcs/packet )	\N	\N	Pac	60.00	60.00	5.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:24.029	2026-09-09 15:43:24.029
prod_zsf2nbnkb	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-4419-4	Wooden Spoon - 110 mm  (100pcs/pac)	\N	\N	Pac	55.00	55.00	5.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:24.136	2026-09-09 15:43:24.136
prod_bziw07a4l	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-48070010-5	8mm - White Paper Straw - 18 cm  (100pcs/pac)	\N	\N	Pac	52.50	52.50	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:24.233	2026-09-09 15:43:24.233
prod_yzfdmig1l	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-3402-6	Wopper - Floor Cleaner - 5 Liter  (Lemon)	\N	\N	Can	550.00	550.00	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:24.339	2026-09-09 15:43:24.339
prod_eqlcoj0po	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-34022090-7	Dishwash - 5 Liter  (More Light)	\N	\N	Can	450.00	450.00	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:24.448	2026-09-09 15:43:24.448
prod_tx43uqo5l	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-96032900-8	Meema export Quality mop white with thread head	\N	\N	Pcs	75.00	75.00	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:24.528	2026-09-09 15:43:24.528
prod_wkhq9x8qs	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-96031000-9	Double Sided Hockey Toilet Brush  (Big)	\N	\N	Pcs	85.00	85.00	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:24.604	2026-09-09 15:43:24.604
prod_48ahgjufe	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-3402-10	harpic - Drain Powder	\N	\N	Pcs	25.00	25.00	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:24.749	2026-09-09 15:43:24.749
prod_4p4f4ewh6	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-3402-11	Dishwash soap	\N	\N	Pcs	8.47	8.47	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:24.821	2026-09-09 15:43:24.821
prod_rrax25ea1	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-38089400-12	B2 - FCH - 5 Liter  (Machine Floor Cleaner for Premium Tiles & Marbles)	\N	\N	Can	950.00	950.00	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:24.923	2026-09-09 15:43:24.923
prod_kwcj8dujw	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-3923-13	100ml PET JLI bottle  (with spary head)	\N	\N	Pcs	40.00	40.00	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:24.995	2026-09-09 15:43:24.995
prod_yoge2x8qy	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-9603-15	wooden Mop Handle	\N	\N	Pcs	19.00	19.00	5.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:25.265	2026-09-09 15:43:25.265
prod_23cj0dagn	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-3926-14	500 ml - Transparent Bottle  (with spary head)	\N	\N	Pcs	50.00	50.00	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:25.092	2026-09-09 15:43:25.092
prod_lx77uu1ws	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-3304-16	Freight charges	\N	\N	Pcs	90.00	90.00	18.00	\N	0	0	ACTIVE	\N	2026-09-09 15:43:25.336	2026-09-09 15:43:25.336
prod_nuzwenbww	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	HSN-4419-1	SIPCOT INDUSTRIAL GROWTH CENTRE GANGAIKONDAN Contact No.: 96263 81177 GSTIN Number: 33AIHPA6467A2ZQ State: 33-Tamil Nadu  Invoice Details  Invoice No.: 2399 Date: 28-08-2026 Place of Supply: 33-Tamil Nadu  Due Date: 12-09-2026 #   Item Name   HSN   MRP   Quantity   Unit   Price/ Unit Taxable Price/ Unit Taxable Amount   CGST   SGST   Final Rate   Amount  1  INRD0171 Iris Reed Diffuser Oil - Aluminium can - 1 litre - Lemon Grass  330749 00   2499.00   2   Nos   ₹ 1,508.48 ₹ 1,508.48 ₹ 3,016.96 ₹ 271.53 (9.0%) ₹ 271.53 (9.0%) ₹ 1,780.01 ₹ 3,560.01 2  Wooden Stirrer - 140 mm  (500 pcs /packet)	\N	\N	Pac	80.00	80.00	18.00	\N	0	0	ACTIVE	\N	2026-09-10 10:36:43.815	2026-09-10 10:36:43.815
\.


--
-- Data for Name: Warehouse; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."Warehouse" ("id", "tenantId", "name", "code", "address", "status", "createdAt", "updatedAt") FROM stdin;
1470a30a-1438-438a-af42-f6eb5871dbe5	7398ea38-92ce-4a6f-96ac-135c051c36ac	tirunelveli	WH1	ijnin	ACTIVE	2026-09-09 15:33:27.601	2026-09-09 15:33:27.601
\.


--
-- Data for Name: WarehouseLocation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."WarehouseLocation" ("id", "tenantId", "warehouseId", "zone", "rack", "shelf", "bin", "active") FROM stdin;
\.


--
-- Data for Name: Inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."Inventory" ("id", "tenantId", "warehouseId", "locationId", "productId", "totalQuantity", "availableQuantity", "reservedQuantity", "damagedQuantity", "updatedAt") FROM stdin;
\.


--
-- Data for Name: InventoryMovement; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."InventoryMovement" ("id", "tenantId", "inventoryId", "productId", "orderId", "type", "quantity", "previousQuantity", "newQuantity", "notes", "createdById", "createdAt") FROM stdin;
\.


--
-- Data for Name: InvoiceItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."InvoiceItem" ("id", "invoiceId", "productId", "quantity", "rate", "discount", "cgst", "sgst", "igst", "total") FROM stdin;
ii_1272ca9df7d3d2c3	inv_84ebf935c079b55c	prod_jojns280g	1	180.00	0.00	16.20	16.20	0.00	212.40
ii_55f841cfd4cbf62d	inv_6e5429174d12a914	prod_48ahgjufe	1	25.00	0.00	2.25	2.25	0.00	29.50
ii_50c4bf38a8123876	inv_b4c4512e7756e190	prod_zsf2nbnkb	1	55.00	0.00	1.38	1.38	0.00	57.75
ii_bffd99bc51ad69e0	inv_6eb8602db86be0a3	prod_48ahgjufe	1	25.00	0.00	2.25	2.25	0.00	29.50
ii_627b59a0217d71fb	inv_ec9f0afb4206fb2f	prod_yzfdmig1l	1	550.00	0.00	49.50	49.50	0.00	649.00
ii_8e88d9106d062474	inv_a114f47e45e3ad7e	prod_tx43uqo5l	1	75.00	0.00	6.75	6.75	0.00	88.50
ii_3a4450b5b502eec7	inv_c44a48e08ed83142	prod_tx43uqo5l	1	75.00	0.00	6.75	6.75	0.00	88.50
ii_fa3bc062967e79a9	inv_465e036afcc94ca5	prod_tx43uqo5l	1	75.00	0.00	6.75	6.75	0.00	88.50
ii_e4c5cfffe22286d3	inv_6931f9ee95468bed	prod_xq6fnymjh	10	42.37	0.00	38.13	38.13	0.00	499.97
ii_398faa5a185b7933	inv_6931f9ee95468bed	prod_jojns280g	5	180.00	0.00	81.00	81.00	0.00	1062.00
ii_24792d529af830e3	inv_6931f9ee95468bed	prod_xk7pttvgs	30	60.00	0.00	45.00	45.00	0.00	1890.00
ii_98e815e858493fee	inv_6931f9ee95468bed	prod_zsf2nbnkb	100	55.00	0.00	137.50	137.50	0.00	5775.00
ii_7b2225e626a2d594	inv_6931f9ee95468bed	prod_bziw07a4l	152	52.50	0.00	718.20	718.20	0.00	9416.40
ii_8e5db5202e351388	inv_6931f9ee95468bed	prod_yzfdmig1l	2	550.00	0.00	99.00	99.00	0.00	1298.00
ii_782d8857913bbc58	inv_6931f9ee95468bed	prod_eqlcoj0po	2	450.00	0.00	81.00	81.00	0.00	1062.00
ii_849035f535582635	inv_6931f9ee95468bed	prod_tx43uqo5l	5	75.00	0.00	33.75	33.75	0.00	442.50
ii_217ea9c1e30f6fa4	inv_6931f9ee95468bed	prod_wkhq9x8qs	5	85.00	0.00	38.25	38.25	0.00	501.50
ii_7f4e835ca5012bcc	inv_6931f9ee95468bed	prod_48ahgjufe	30	25.00	0.00	67.50	67.50	0.00	885.00
ii_e2a3366e94395855	inv_6931f9ee95468bed	prod_4p4f4ewh6	30	8.47	0.00	22.87	22.87	0.00	299.84
ii_e313ca741bed601c	inv_6931f9ee95468bed	prod_rrax25ea1	2	950.00	0.00	171.00	171.00	0.00	2242.00
ii_320eda25dea7c577	inv_6931f9ee95468bed	prod_kwcj8dujw	5	40.00	0.00	18.00	18.00	0.00	236.00
ii_5a7db67183708b68	inv_6931f9ee95468bed	prod_23cj0dagn	5	50.00	0.00	22.50	22.50	0.00	295.00
ii_8d0e542b07ab1754	inv_6931f9ee95468bed	prod_yoge2x8qy	5	19.00	0.00	2.38	2.38	0.00	99.75
ii_808ca72df875e4be	inv_6931f9ee95468bed	prod_lx77uu1ws	5	90.00	0.00	40.50	40.50	0.00	531.00
ii_15a55eff010ebefb	inv_e9d8baf5b6c9bd4d	prod_yzfdmig1l	1	550.00	0.00	49.50	49.50	0.00	649.00
ii_f422096542c870e2	inv_c54ffcf5fb34fcf6	prod_xq6fnymjh	10	42.37	0.00	38.13	38.13	0.00	499.97
ii_efa896871b540a13	inv_c54ffcf5fb34fcf6	prod_jojns280g	5	180.00	0.00	81.00	81.00	0.00	1062.00
ii_85318978c35d0fc4	inv_c54ffcf5fb34fcf6	prod_xk7pttvgs	30	60.00	0.00	45.00	45.00	0.00	1890.00
ii_b564d16a5c2224ee	inv_c54ffcf5fb34fcf6	prod_zsf2nbnkb	100	55.00	0.00	137.50	137.50	0.00	5775.00
ii_6d4e653ebe06bfd0	inv_c54ffcf5fb34fcf6	prod_bziw07a4l	152	52.50	0.00	718.20	718.20	0.00	9416.40
ii_5cd3469676a930ec	inv_c54ffcf5fb34fcf6	prod_yzfdmig1l	2	550.00	0.00	99.00	99.00	0.00	1298.00
ii_5663cae8d1094152	inv_c54ffcf5fb34fcf6	prod_eqlcoj0po	2	450.00	0.00	81.00	81.00	0.00	1062.00
ii_4551d20c03ceadba	inv_c54ffcf5fb34fcf6	prod_tx43uqo5l	5	75.00	0.00	33.75	33.75	0.00	442.50
ii_aa5af8e14ea33d54	inv_c54ffcf5fb34fcf6	prod_wkhq9x8qs	5	85.00	0.00	38.25	38.25	0.00	501.50
ii_9dce4da9f97ccb30	inv_c54ffcf5fb34fcf6	prod_48ahgjufe	30	25.00	0.00	67.50	67.50	0.00	885.00
ii_bd9f18978e4a3fbf	inv_c54ffcf5fb34fcf6	prod_4p4f4ewh6	30	8.47	0.00	22.87	22.87	0.00	299.84
ii_9dd5198003b7cc4a	inv_c54ffcf5fb34fcf6	prod_rrax25ea1	2	950.00	0.00	171.00	171.00	0.00	2242.00
ii_edc09d53a0ca78a7	inv_c54ffcf5fb34fcf6	prod_kwcj8dujw	5	40.00	0.00	18.00	18.00	0.00	236.00
ii_a020acac976a28de	inv_c54ffcf5fb34fcf6	prod_23cj0dagn	5	50.00	0.00	22.50	22.50	0.00	295.00
ii_eeb6bcc10b8d3ba1	inv_c54ffcf5fb34fcf6	prod_yoge2x8qy	5	19.00	0.00	2.38	2.38	0.00	99.75
ii_b906bdcfce5ca0fa	inv_c54ffcf5fb34fcf6	prod_lx77uu1ws	5	90.00	0.00	40.50	40.50	0.00	531.00
ii_793cf13e9ec7ff04	inv_0e0cefcb162c81ff	prod_kwcj8dujw	1	40.00	0.00	3.60	3.60	0.00	47.20
ii_72edd19b5b64e9e0	inv_6a7c6d26d62c4fe2	prod_nuzwenbww	1	80.00	0.00	7.20	7.20	0.00	94.40
ii_7d30fa46450c213d	inv_e83552a16f2b8e21	prod_kwcj8dujw	1	40.00	0.00	3.60	3.60	0.00	47.20
ii_492f4402530e1bcf	inv_d23d059f6b75c739	prod_48ahgjufe	1	25.00	0.00	2.25	2.25	0.00	29.50
ii_012c3cf92a83c7ef	inv_721a33d9f6cefa7a	prod_jojns280g	1	180.00	0.00	16.20	16.20	0.00	212.40
ii_8cbfa937e0cf241a	inv_31873a1161db370b	prod_kwcj8dujw	1000	40.00	0.00	3600.00	3600.00	0.00	47200.00
ii_d480736019a2e687	inv_b0815c71664e0453	prod_kwcj8dujw	50	40.00	0.00	180.00	180.00	0.00	2360.00
ii_88b819bfa77b0662	inv_c29ac441ab97ee33	prod_wkhq9x8qs	100	85.00	0.00	765.00	765.00	0.00	10030.00
ii_f5d91cf2d0c17aac	inv_00643f11c7e870f4	prod_lx77uu1ws	100	190.00	0.00	1710.00	1710.00	0.00	22420.00
ii_53dc1609d347abd3	inv_ab9cd9002d205064	prod_zsf2nbnkb	1000	55.00	0.00	1375.00	1375.00	0.00	57750.00
ii_2682183a038152bd	inv_f1a23d75ec7b37c9	prod_rrax25ea1	500	950.00	0.00	42750.00	42750.00	0.00	560500.00
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."Notification" ("id", "tenantId", "userId", "orderId", "type", "title", "message", "read", "createdAt", "actionUrl", "metadata", "priority", "readAt", "warehouseId") FROM stdin;
notif_e024f0aec4e4fb09	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_77340e22dbe2e663	ORDER_ISSUED	New Order Issued: ORD-2026-000005	Commercial order ORD-2026-000005 has been issued and assigned for fulfillment.	t	2026-09-11 18:48:14.061	/operations/orders/ord_77340e22dbe2e663	{}	NORMAL	2026-09-12 13:01:46.075	\N
notif_gmo2x4oj	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_7owqrol20	ORDER_ISSUED	New Order Issued: ORD-2026-000004	Commercial order ORD-2026-000004 has been issued and assigned for fulfillment.	t	2026-09-11 08:30:04.183	/operations/orders/ord_7owqrol20	{}	NORMAL	2026-09-12 13:01:46.73	\N
notif_m8xn5h9n	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_r771o0kqj	ORDER_ISSUED	New Order Issued: ORD-2026-000001	Commercial order ORD-2026-000001 has been issued and assigned for fulfillment.	t	2026-09-09 15:48:31.138	/operations/orders/ord_r771o0kqj	{}	NORMAL	2026-09-10 10:20:57.078	\N
notif_ee07783294f6a7b5	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_5bcb675f32a96e8e	ORDER_ISSUED	New Order Issued: ORD-2026-000008	Commercial order ORD-2026-000008 has been issued and assigned for fulfillment.	t	2026-09-12 08:47:20.34	/operations/orders/ord_5bcb675f32a96e8e	{}	NORMAL	2026-09-12 08:46:41.042	\N
notif_8f141b5ab84c5c78	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_c8f7f478399a2de0	ORDER_ISSUED	New Order Issued: ORD-2026-000007	Commercial order ORD-2026-000007 has been issued and assigned for fulfillment.	t	2026-09-11 20:09:46.932	/operations/orders/ord_c8f7f478399a2de0	{}	NORMAL	2026-09-12 08:46:42.373	\N
notif_0ee5386e3a2891d2	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_5c0f2565f759cca9	ORDER_ISSUED	New Order Issued: ORD-2026-000010	Commercial order ORD-2026-000010 has been issued and assigned for fulfillment.	t	2026-09-12 12:41:31.426	/operations/orders/ord_5c0f2565f759cca9	{}	NORMAL	2026-09-12 13:01:31.575	\N
notif_fec775efd360c010	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_7e5671527dcb6fdd	ORDER_ISSUED	New Order Issued: ORD-2026-000009	Commercial order ORD-2026-000009 has been issued and assigned for fulfillment.	t	2026-09-12 10:13:07.747	/operations/orders/ord_7e5671527dcb6fdd	{}	NORMAL	2026-09-12 13:01:32.483	\N
notif_2d7d2db791bea8d1	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_7e5671527dcb6fdd	ORDER_ISSUED	New Order Issued: ORD-2026-000009	Commercial order ORD-2026-000009 has been issued and assigned for fulfillment.	t	2026-09-12 10:13:07.747	/operations/orders/ord_7e5671527dcb6fdd	{}	NORMAL	2026-09-12 13:01:33.288	\N
notif_8960fd323c882e34	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_c8f7f478399a2de0	ORDER_ISSUED	New Order Issued: ORD-2026-000007	Commercial order ORD-2026-000007 has been issued and assigned for fulfillment.	t	2026-09-11 20:09:46.932	/operations/orders/ord_c8f7f478399a2de0	{}	NORMAL	2026-09-12 13:01:34.58	\N
notif_ef394cb273528d56	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_0d1fca08c7920d18	ORDER_ISSUED	New Order Issued: ORD-2026-000006	Commercial order ORD-2026-000006 has been issued and assigned for fulfillment.	t	2026-09-11 18:59:56.308	/operations/orders/ord_0d1fca08c7920d18	{}	NORMAL	2026-09-12 13:01:44.249	\N
notif_8f47e43e6b6f3308	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_0d1fca08c7920d18	ORDER_ISSUED	New Order Issued: ORD-2026-000006	Commercial order ORD-2026-000006 has been issued and assigned for fulfillment.	t	2026-09-11 18:59:56.308	/operations/orders/ord_0d1fca08c7920d18	{}	NORMAL	2026-09-12 13:01:45.025	\N
notif_ps207lv4	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_cgeddwjcy	ORDER_ISSUED	New Order Issued: ORD-2026-000003	Commercial order ORD-2026-000003 has been issued and assigned for fulfillment.	t	2026-09-10 12:30:33.853	/operations/orders/ord_cgeddwjcy	{}	NORMAL	2026-09-12 13:01:47.442	\N
notif_vb64ie83	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_vmbqcjay6	ORDER_ISSUED	New Order Issued: ORD-2026-000002	Commercial order ORD-2026-000002 has been issued and assigned for fulfillment.	t	2026-09-10 10:37:16.561	/operations/orders/ord_vmbqcjay6	{}	NORMAL	2026-09-12 13:01:48.019	\N
notif_2lxqir3x	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_vmbqcjay6	ORDER_ISSUED	New Order Issued: ORD-2026-000002	Commercial order ORD-2026-000002 has been issued and assigned for fulfillment.	t	2026-09-10 10:37:16.42	/operations/orders/ord_vmbqcjay6	{}	NORMAL	2026-09-12 13:01:48.592	\N
notif_6ffcb33e6088e2fb	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_1e2393e075aa9706	ORDER_ISSUED	New Order Issued: ORD-2026-000011	Commercial order ORD-2026-000011 has been issued and assigned for fulfillment.	t	2026-09-12 17:04:23.182	/operations/orders/ord_1e2393e075aa9706	{}	NORMAL	2026-09-12 17:27:08.291	\N
notif_6a8eb344d88d54f3	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_1e2393e075aa9706	ORDER_ISSUED	New Order Issued: ORD-2026-000011	Commercial order ORD-2026-000011 has been issued and assigned for fulfillment.	t	2026-09-12 17:04:23.182	/operations/orders/ord_1e2393e075aa9706	{}	NORMAL	2026-09-12 17:27:22.218	\N
notif_7ae0d0b7fe489ad9	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_r771o0kqj	CLIENT_COMPLETED_VERIFICATION	Client verification completed	Order ORD-2026-000001 was marked VERIFIED	t	2026-09-12 18:39:31.217	/dashboard/orders/ord_r771o0kqj	{}	normal	2026-09-12 18:40:44.154	\N
notif_a17b636dd1c10d96	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_4569c5254cdcc2af	ORDER_ISSUED	New Order Issued: ORD-2026-000012	Commercial order ORD-2026-000012 has been issued and assigned for fulfillment.	t	2026-09-13 11:23:34.743	/operations/orders/ord_4569c5254cdcc2af	{}	NORMAL	2026-09-13 14:39:42.606	\N
notif_940d8218a8a37de8	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_4569c5254cdcc2af	ORDER_ISSUED	New Order Issued: ORD-2026-000012	Commercial order ORD-2026-000012 has been issued and assigned for fulfillment.	t	2026-09-13 11:23:34.743	/operations/orders/ord_4569c5254cdcc2af	{}	NORMAL	2026-09-13 14:39:43.537	\N
notif_ee8143acbf29be02	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_vmbqcjay6	CLIENT_COMPLETED_VERIFICATION	Delivery Verification Completed	Order ORD-2026-000002 was verified as VERIFIED	t	2026-09-15 05:37:41.861	/operations/orders/ord_vmbqcjay6	{}	normal	2026-09-15 07:06:00.975	\N
notif_9f1db3889c27c2d5	7398ea38-92ce-4a6f-96ac-135c051c36ac	\N	ord_bf77a625780c3195	CLIENT_COMPLETED_VERIFICATION	Delivery Verification Completed	Order ORD-2026-000013 was verified as VERIFIED	t	2026-09-15 05:37:27.836	/operations/orders/ord_bf77a625780c3195	{}	normal	2026-09-15 07:06:02.101	\N
notif_8b6cea8ea6ebc7bc	7398ea38-92ce-4a6f-96ac-135c051c36ac	384d2191-a74b-4bb4-8b26-ac301fd95f33	ord_cf5a69d14af1411c	NEW_ORDER	New Order Created	Order ORD-2026-000018 has been created with final invoice.	t	2026-09-15 13:41:59.486	/operations/orders/ord_cf5a69d14af1411c	{}	normal	2026-09-15 16:00:50.623	\N
notif_d3e6d5b66739a10b	7398ea38-92ce-4a6f-96ac-135c051c36ac	384d2191-a74b-4bb4-8b26-ac301fd95f33	ord_b80cd580b8401355	NEW_ORDER	New Order Created	Order ORD-2026-000021 has been created with final invoice.	t	2026-09-15 17:57:27.742	/operations/orders/ord_b80cd580b8401355	{}	normal	2026-09-16 11:04:10.668	\N
notif_102048982e65457a	7398ea38-92ce-4a6f-96ac-135c051c36ac	384d2191-a74b-4bb4-8b26-ac301fd95f33	ord_163b17edfcd83624	NEW_ORDER	New Order Created	Order ORD-2026-000020 has been created with final invoice.	t	2026-09-15 17:55:38.652	/operations/orders/ord_163b17edfcd83624	{}	normal	2026-09-16 11:04:11.486	\N
notif_27af9118d97547c5	7398ea38-92ce-4a6f-96ac-135c051c36ac	42caa2e3-ee15-42a9-bebe-bfcf4e42b9e4	ord_d6788badb4955cec	NEW_ORDER	New Order Created	Order ORD-2026-000019 has been created with final invoice.	t	2026-09-15 17:11:00.371	/operations/orders/ord_d6788badb4955cec	{}	normal	2026-09-16 11:04:12.92	\N
notif_ccc94a63b46c7e2d	7398ea38-92ce-4a6f-96ac-135c051c36ac	384d2191-a74b-4bb4-8b26-ac301fd95f33	ord_2b87efa1d28ff39c	NEW_ORDER	New Order Created	Order ORD-2026-000023 has been created with final invoice.	t	2026-09-16 09:14:53.995	/operations/orders/ord_2b87efa1d28ff39c	{}	normal	2026-09-16 11:04:08.541	\N
notif_536a203d77f5e07f	7398ea38-92ce-4a6f-96ac-135c051c36ac	384d2191-a74b-4bb4-8b26-ac301fd95f33	ord_087b39c6a86e5585	NEW_ORDER	New Order Created	Order ORD-2026-000022 has been created with final invoice.	t	2026-09-16 09:13:28.692	/operations/orders/ord_087b39c6a86e5585	{}	normal	2026-09-16 11:04:09.721	\N
\.


--
-- Data for Name: NotificationSettings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."NotificationSettings" ("id", "tenantId", "enabled", "eventConfig", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: OrderItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."OrderItem" ("id", "orderId", "productId", "quantity", "unitPrice", "taxRate", "discount", "total") FROM stdin;
oi_y87ozklh9	ord_r771o0kqj	prod_xq6fnymjh	10	42.37	18.00	0.00	499.97
oi_ftxoxhd4c	ord_r771o0kqj	prod_jojns280g	5	180.00	18.00	0.00	1062.00
oi_czkogoptv	ord_r771o0kqj	prod_xk7pttvgs	30	60.00	5.00	0.00	1890.00
oi_0dg6wp0yu	ord_r771o0kqj	prod_zsf2nbnkb	100	55.00	5.00	0.00	5775.00
oi_o25qnwp8o	ord_r771o0kqj	prod_bziw07a4l	152	52.50	18.00	0.00	9416.40
oi_fk3my4ipt	ord_r771o0kqj	prod_yzfdmig1l	2	550.00	18.00	0.00	1298.00
oi_n4wolcz67	ord_r771o0kqj	prod_eqlcoj0po	2	450.00	18.00	0.00	1062.00
oi_30z1mijig	ord_r771o0kqj	prod_tx43uqo5l	5	75.00	18.00	0.00	442.50
oi_t69numq9e	ord_r771o0kqj	prod_wkhq9x8qs	5	85.00	18.00	0.00	501.50
oi_j5qznylwn	ord_r771o0kqj	prod_48ahgjufe	30	25.00	18.00	0.00	885.00
oi_kd6vsfkmr	ord_r771o0kqj	prod_4p4f4ewh6	30	8.47	18.00	0.00	299.84
oi_q6w6esam6	ord_r771o0kqj	prod_rrax25ea1	2	950.00	18.00	0.00	2242.00
oi_chdj5b6qa	ord_r771o0kqj	prod_kwcj8dujw	5	40.00	18.00	0.00	236.00
oi_wdw2uxvij	ord_r771o0kqj	prod_23cj0dagn	5	50.00	18.00	0.00	295.00
oi_ug6dz9rft	ord_r771o0kqj	prod_yoge2x8qy	5	19.00	5.00	0.00	99.75
oi_nva9nxcrj	ord_r771o0kqj	prod_lx77uu1ws	5	90.00	18.00	0.00	531.00
oi_9xduofxrr	ord_vmbqcjay6	prod_nuzwenbww	2	80.00	18.00	0.00	188.80
oi_rt0o7sd6x	ord_vmbqcjay6	prod_zsf2nbnkb	1	55.00	5.00	0.00	57.75
oi_42be2q5zd	ord_vmbqcjay6	prod_lx77uu1ws	1	90.00	18.00	0.00	106.20
oi_5kfoecgoj	ord_cgeddwjcy	prod_kwcj8dujw	1	40.00	18.00	0.00	47.20
oi_62fc3lkr6	ord_7owqrol20	prod_kwcj8dujw	10	40.00	18.00	0.00	472.00
oi_6fabdaf8692e9137	ord_77340e22dbe2e663	prod_jojns280g	1	180.00	18.00	0.00	212.40
oi_75052620f6d17f4c	ord_0d1fca08c7920d18	prod_48ahgjufe	1	25.00	18.00	0.00	29.50
oi_0a8029003774622c	ord_c8f7f478399a2de0	prod_zsf2nbnkb	1	55.00	5.00	0.00	57.75
oi_f56f76bb31c4fd51	ord_5bcb675f32a96e8e	prod_48ahgjufe	1	25.00	18.00	0.00	29.50
oi_1ed2fb7a59f05bf1	ord_7e5671527dcb6fdd	prod_yzfdmig1l	1	550.00	18.00	0.00	649.00
oi_09ffadc2370ebe22	ord_5c0f2565f759cca9	prod_tx43uqo5l	1	75.00	18.00	0.00	88.50
oi_70d44a978011bf3c	ord_1e2393e075aa9706	prod_tx43uqo5l	1	75.00	18.00	0.00	88.50
oi_1745c81f31dee0ab	ord_4569c5254cdcc2af	prod_yzfdmig1l	1	550.00	18.00	0.00	649.00
oi_8c2a8621d2e135bd	ord_bf77a625780c3195	prod_kwcj8dujw	1	40.00	18.00	0.00	47.20
oi_d2d9d74ad03a63c7	ord_0641ebad8b88a29d	prod_nuzwenbww	1	80.00	18.00	0.00	94.40
oi_76e18822c3227d3f	ord_f6ae4cc226ef8e72	prod_kwcj8dujw	1	40.00	18.00	0.00	47.20
oi_04bd0b0c8155cc9b	ord_897a558d4baf7ae4	prod_48ahgjufe	1	25.00	18.00	0.00	29.50
oi_8d7cf20fb9d11c7e	ord_e8fcb588cc0fcfac	prod_jojns280g	1	180.00	18.00	0.00	212.40
oi_5064bb9182caac64	ord_cf5a69d14af1411c	prod_kwcj8dujw	1000	40.00	18.00	0.00	47200.00
oi_9ecec01f77fa9f21	ord_d6788badb4955cec	prod_kwcj8dujw	50	40.00	18.00	0.00	2360.00
oi_321fd6a69f608fda	ord_163b17edfcd83624	prod_wkhq9x8qs	100	85.00	18.00	0.00	10030.00
oi_9cdd44c9e6c96fc6	ord_b80cd580b8401355	prod_lx77uu1ws	100	190.00	18.00	0.00	22420.00
oi_33de17a5a7911d78	ord_087b39c6a86e5585	prod_zsf2nbnkb	1000	55.00	5.00	0.00	57750.00
oi_95a2c03853499547	ord_2b87efa1d28ff39c	prod_rrax25ea1	500	950.00	18.00	0.00	560500.00
\.


--
-- Data for Name: OrderStatusHistory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."OrderStatusHistory" ("id", "tenantId", "orderId", "previousStatus", "newStatus", "changedById", "notes", "createdAt") FROM stdin;
osh_w5p5kjfi	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_r771o0kqj	\N	DISPATCHED	ec754300-67ec-43fe-a6c5-34d978491fb6	Imported and dispatched	2026-09-09 15:48:30.673
osh_dr7em9em	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_vmbqcjay6	\N	DISPATCHED	ec754300-67ec-43fe-a6c5-34d978491fb6	Imported and dispatched	2026-09-10 10:37:15.66
osh_1usxn1n6	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_cgeddwjcy	\N	ISSUED	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-10 12:30:33.415
osh_sh2xtvo8	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_7owqrol20	\N	ISSUED	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-11 08:30:03.514
osh_f18be0d11118bde4	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_77340e22dbe2e663	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-11 18:48:14.061
osh_fa93e15b0cf406b4	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_0d1fca08c7920d18	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-11 18:59:56.308
osh_5c8f3e8321cd98e9	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_c8f7f478399a2de0	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-11 20:09:46.932
osh_f162706d7b43d6f3	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_5bcb675f32a96e8e	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-12 08:47:20.34
osh_8adfa4c327bed911	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_7e5671527dcb6fdd	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-12 10:13:07.747
osh_8a52f3b7a25f7a0c	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_5c0f2565f759cca9	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-12 12:41:31.426
osh_649b89bffdf5defe	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_1e2393e075aa9706	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-12 17:04:23.182
osh_90d9c4c3fce07baa	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_r771o0kqj	DISPATCHED	RECEIVED	ec754300-67ec-43fe-a6c5-34d978491fb6	Order marked as received by warehouse	2026-09-12 18:38:16.967
osh_94bbdb5ce2e1d816	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_r771o0kqj	RECEIVED	VERIFIED	384d2191-a74b-4bb4-8b26-ac301fd95f33	\N	2026-09-12 18:39:31.217
osh_3db1f644d93ae4f2	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_4569c5254cdcc2af	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-13 11:23:34.743
osh_b914b79743a2f678	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_bf77a625780c3195	\N	ISSUED	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-15 05:36:42.567
osh_406f4563122ca85b	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_bf77a625780c3195	ISSUED	DISPATCHED	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 05:37:12.344
osh_e0c8e26218dd7a07	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_bf77a625780c3195	DISPATCHED	VERIFIED	f833abde-a39b-4154-a3bd-9ef5a3529897	Delivery verification completed with status: VERIFIED	2026-09-15 05:37:27.836
osh_0badaab5ceb655da	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_vmbqcjay6	DISPATCHED	VERIFIED	f833abde-a39b-4154-a3bd-9ef5a3529897	Delivery verification completed with status: VERIFIED	2026-09-15 05:37:41.861
osh_31fc68e6a67fe314	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_0641ebad8b88a29d	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-15 07:30:14.84
osh_c7a442d38ec454f3	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_f6ae4cc226ef8e72	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-15 09:43:29.502
osh_353f92c8066302e4	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_897a558d4baf7ae4	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-15 10:32:41.287
osh_f03d4527efe72618	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_e8fcb588cc0fcfac	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-15 10:56:22.36
osh_3d0fef0a35b05b11	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_cf5a69d14af1411c	\N	ISSUED	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-15 13:41:59.486
osh_fb3ac65dc619ae22	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_d6788badb4955cec	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-15 17:11:00.371
osh_db4b9f300badd3c9	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_d6788badb4955cec	DRAFT	ISSUED	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 17:11:15.395
osh_cb207638377481a8	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_d6788badb4955cec	ISSUED	PROCESSING	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 17:12:14.65
osh_433cf6cd283b1dce	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_d6788badb4955cec	PROCESSING	READY_FOR_DISPATCH	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 17:12:20.523
osh_9484edff087328ee	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_d6788badb4955cec	READY_FOR_DISPATCH	DISPATCHED	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 17:12:24.828
osh_b9a10f961fa3a5cd	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_e8fcb588cc0fcfac	DRAFT	ISSUED	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 17:55:04.556
osh_dea0be92260b32e2	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_897a558d4baf7ae4	DRAFT	ISSUED	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-15 17:55:25.075
osh_4527acbdf449e224	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_163b17edfcd83624	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-15 17:55:38.652
osh_4bf87d76e4599d3e	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_b80cd580b8401355	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-15 17:57:27.742
osh_4167f9d878b77ad2	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_b80cd580b8401355	DRAFT	ISSUED	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-16 06:18:45.398
osh_7b06666afa10d326	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_087b39c6a86e5585	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-16 09:13:28.692
osh_9df1fe6de2de0e90	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_087b39c6a86e5585	DRAFT	ISSUED	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-16 09:13:39.335
osh_7536cf5e73cc20e8	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_2b87efa1d28ff39c	\N	DRAFT	ec754300-67ec-43fe-a6c5-34d978491fb6	Initial order created	2026-09-16 09:14:53.995
osh_f69c92d9c36913a7	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_2b87efa1d28ff39c	DRAFT	ISSUED	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-16 09:22:28.602
osh_ef86e5888007e6b5	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_2b87efa1d28ff39c	ISSUED	PROCESSING	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-16 09:22:38.386
osh_01cf188b32bfad71	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_2b87efa1d28ff39c	PROCESSING	READY_FOR_DISPATCH	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-16 09:22:44.151
osh_11ad52dd2685b595	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_2b87efa1d28ff39c	READY_FOR_DISPATCH	DISPATCHED	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-16 09:22:47.762
osh_08e45cd59e8f146e	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_087b39c6a86e5585	ISSUED	PROCESSING	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-16 11:04:51.049
osh_666e823e25bbf834	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_087b39c6a86e5585	PROCESSING	READY_FOR_DISPATCH	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-16 11:04:56.545
osh_38dbf90082e5db85	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_087b39c6a86e5585	READY_FOR_DISPATCH	DISPATCHED	ec754300-67ec-43fe-a6c5-34d978491fb6	\N	2026-09-16 11:05:02.365
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."Payment" ("id", "tenantId", "invoiceId", "amount", "status", "method", "reference", "paidAt", "createdAt", "proofUrl") FROM stdin;
pay_7cec41c918333273	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_84ebf935c079b55c	212.40	PAID	UPI	\N	2026-09-11 18:58:59.75	2026-09-11 18:58:59.75	\N
pay_5627f8688dc053c4	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_6931f9ee95468bed	26535.95	PAID	NEFT / RTGS	\N	2026-09-12 19:22:30.347	2026-09-12 19:22:30.347	\N
pay_c1a6470739bd4aba	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_465e036afcc94ca5	88.50	PAID	NEFT / RTGS	\N	2026-09-13 05:55:09.576	2026-09-13 05:55:09.576	\N
pay_cf24e7d2fbbc59d6	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_c44a48e08ed83142	88.50	PAID	UPI	\N	2026-09-13 06:31:08.053	2026-09-13 06:31:08.053	\N
pay_ca1debde304f8ca0	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_a114f47e45e3ad7e	88.50	PAID	UPI	\N	2026-09-13 06:35:04.478	2026-09-13 06:35:04.478	\N
pay_c7a44a613c877996	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_ec9f0afb4206fb2f	649.00	PAID	NEFT / RTGS	\N	2026-09-13 09:50:43.865	2026-09-13 09:50:43.865	\N
pay_a4533bb521b9e455	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_6eb8602db86be0a3	29.50	PAID	NEFT / RTGS	\N	2026-09-13 10:21:56.157	2026-09-13 10:21:56.157	\N
pay_7766370a1df0636c	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_b4c4512e7756e190	57.75	PAID	NEFT / RTGS	\N	2026-09-13 10:30:05.492	2026-09-13 10:30:05.492	\N
pay_f52d3becbd31ce06	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_e9d8baf5b6c9bd4d	649.00	PAID	NEFT / RTGS	\N	2026-09-13 11:24:12.419	2026-09-13 11:24:12.419	\N
pay_cc6be49131cc28c2	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_6e5429174d12a914	29.50	PAID	NEFT / RTGS	\N	2026-09-13 17:53:27.741	2026-09-13 17:53:27.741	\N
pay_2e9b55427da034b0	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_c54ffcf5fb34fcf6	26535.95	PAID	NEFT / RTGS	\N	2026-09-15 05:38:45.456	2026-09-15 05:38:45.456	\N
pay_94cf0d289480021c	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_0e0cefcb162c81ff	47.20	PAID	NEFT / RTGS	\N	2026-09-15 07:09:06.839	2026-09-15 07:09:06.839	\N
pay_1a1991f1e30f07e8	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_6a7c6d26d62c4fe2	94.40	PAID	NEFT / RTGS	\N	2026-09-15 07:30:32.743	2026-09-15 07:30:32.743	\N
pay_0dbc450aa787bff0	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_e83552a16f2b8e21	47.20	PAID	NEFT / RTGS	\N	2026-09-15 09:43:56.045	2026-09-15 09:43:56.045	\N
pay_5596b67ae8bb70b9	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_d23d059f6b75c739	29.50	PAID	NEFT / RTGS	\N	2026-09-15 10:33:03.339	2026-09-15 10:33:03.339	\N
pay_1bdb0cb1f73b0127	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_721a33d9f6cefa7a	212.40	PAID	NEFT / RTGS	\N	2026-09-15 10:57:21.715	2026-09-15 10:57:21.715	7398ea38-92ce-4a6f-96ac-135c051c36ac/inv_721a33d9f6cefa7a/pay_1bdb0cb1f73b0127/1789469777448-v1bift.jpeg
pay_214c5b78445978fc	7398ea38-92ce-4a6f-96ac-135c051c36ac	inv_31873a1161db370b	47200.00	PAID	NEFT / RTGS	PAY-169135	2026-09-17 09:59:29.067	2026-09-17 09:59:29.067	7398ea38-92ce-4a6f-96ac-135c051c36ac/inv_31873a1161db370b/pay_214c5b78445978fc/1789639168127-2g4u68.jpeg
\.


--
-- Data for Name: PlatformSetting; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."PlatformSetting" ("id", "tenantId", "platformName", "platformLogo", "featureFlags", "notificationSettings", "createdAt", "updatedAt") FROM stdin;
cmtpry8dv0000ehlcynt2akav	\N	WarehouseOS	\N	{"clientOtp": true, "realtimeNotifications": true}	{}	2026-09-06 12:14:59.058	2026-09-06 12:14:59.058
\.


--
-- Data for Name: VerificationChecklist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."VerificationChecklist" ("id", "tenantId", "name", "active") FROM stdin;
\.


--
-- Data for Name: VerificationItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."VerificationItem" ("id", "checklistId", "text", "required", "active", "sortOrder") FROM stdin;
\.


--
-- Data for Name: VerificationResponse; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."VerificationResponse" ("id", "tenantId", "orderId", "clientId", "userId", "status", "responses", "comments", "attachments", "createdAt") FROM stdin;
vr_aa84c9d240924c27	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_r771o0kqj	7c5eac47-1b6f-44ce-8814-9b773aa7cfa8	384d2191-a74b-4bb4-8b26-ac301fd95f33	VERIFIED	[{"text": "Correct product received", "checked": true}, {"text": "Correct quantity received", "checked": true}, {"text": "Product condition acceptable", "checked": true}, {"text": "Packaging acceptable", "checked": true}, {"text": "No visible damage", "checked": true}, {"text": "Required delivery documents received", "checked": true}, {"text": "Delivery details correct", "checked": true}]	\N	\N	2026-09-12 18:39:31.217
vr_73f1083a01f35904	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_bf77a625780c3195	c2bd9c66-df6f-403d-8650-3b6ba78a59d4	f833abde-a39b-4154-a3bd-9ef5a3529897	VERIFIED	[{"text": "Correct product received", "checked": true}, {"text": "Correct quantity received", "checked": true}, {"text": "Product condition acceptable", "checked": true}, {"text": "Packaging acceptable", "checked": true}, {"text": "No visible damage", "checked": true}, {"text": "Required delivery documents received", "checked": true}, {"text": "Delivery details correct", "checked": true}]	\N	\N	2026-09-15 05:37:27.836
vr_c072373dc24b4bb4	7398ea38-92ce-4a6f-96ac-135c051c36ac	ord_vmbqcjay6	a5ddae1c-8f8d-4e91-be72-7392c03ed06b	f833abde-a39b-4154-a3bd-9ef5a3529897	VERIFIED	[{"text": "Correct product received", "checked": true}, {"text": "Correct quantity received", "checked": true}, {"text": "Product condition acceptable", "checked": true}, {"text": "Packaging acceptable", "checked": true}, {"text": "No visible damage", "checked": true}, {"text": "Required delivery documents received", "checked": true}, {"text": "Delivery details correct", "checked": true}]	\N	\N	2026-09-15 05:37:41.861
\.


--
-- Data for Name: WarehouseSetting; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."WarehouseSetting" ("id", "tenantId", "orderPrefix", "invoicePrefix", "gstSettings", "notificationPreferences", "createdAt", "updatedAt") FROM stdin;
ws_hw1buyqsvoa	7398ea38-92ce-4a6f-96ac-135c051c36ac	ORD	0	{}	{}	2026-09-10 09:00:16.491	2026-09-14 04:19:34.987
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count") FROM stdin;
82428d56-8cfc-42a3-b21c-9d931146c155	1464bac00139bdbb7ebc1703f6ea9caf145ea5f24e44fc58cf0433a35d295c17	2026-09-03 17:06:05.431334+00	20260824121212_warevo	\N	\N	2026-09-03 17:06:04.784731+00	1
64f2a9d2-c7c4-4077-bed5-d8cb41766d9f	7f53007532b4e43273a0429c71d310d19293455c011cbbb9f69b5167a6d4e8a6	2026-09-03 17:06:06.148105+00	20260830054918_add_notification_profile_fields	\N	\N	2026-09-03 17:06:05.636313+00	1
27c6168c-c1d2-4ac1-8a8f-904be0725969	35578aa9e13cc1d061cd5aa81c93e8257608ea45845a6016d20ad08c9b28ce55	2026-09-03 17:06:06.762597+00	20260903000000_add_account_client_employee_role	\N	\N	2026-09-03 17:06:06.352971+00	1
15777a05-1367-4342-a9a0-b3f5b37a5fb4	6d24bf97f24e49e2c20057508510d7537998bf923aca10e0f7427c9f85c7da0b	2026-09-03 17:06:07.22039+00	20260903010000_add_client_accountant_role	\N	\N	2026-09-03 17:06:07.093183+00	1
bfdbed4e-8652-4a27-baa3-8be8c0da10b4	c6714f42bd74fa6bc4893687d1da902996aeecd3fd2b5b82d9b763446d9a1f10	2026-09-03 17:06:07.397362+00	20260903020000_add_payment_proof_url	\N	\N	2026-09-03 17:06:07.271187+00	1
fbc9045b-ca57-4d38-8d48-f34d62406b19	f4398174b6bb77ef52218f2d04d3d1aa4fd50f0c4b58e753f17da6e9abaa45aa	2026-09-11 13:44:11.509984+00	20260911180000_add_accounts_team_role	\N	\N	2026-09-11 13:44:11.357632+00	1
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type", "versioning_status") FROM stdin;
payment-proofs	payment-proofs	\N	2026-09-11 16:05:47.994353+00	2026-09-11 16:05:47.994353+00	f	f	\N	\N	\N	STANDARD	DISABLED
invoices	invoices	\N	2026-09-03 15:36:38.638091+00	2026-09-03 15:36:38.638091+00	f	f	\N	\N	\N	STANDARD	DISABLED
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_analytics" ("name", "type", "format", "created_at", "updated_at", "id", "deleted_at") FROM stdin;
\.


--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_vectors" ("id", "type", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata", "archived_at", "is_delete_marker", "is_versioned") FROM stdin;
c2d0589a-c3e9-400c-b889-af2dfd018333	invoices	payment-proofs/cmtka6p96002zehiogvtfuck6-1788449766838.png	\N	2026-09-03 15:36:38.789407+00	2026-09-03 15:36:38.789407+00	2026-09-03 15:36:38.789407+00	{"eTag": "\\"8db9e772b0e4ef1a56cccf6bfc57c44b\\"", "size": 21886, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-09-03T15:36:39.000Z", "contentLength": 21886, "httpStatusCode": 200}	adeaa1dc-ba25-4b97-81a1-da3dc495ff6e	\N	{}	\N	f	f
7818d9f6-d614-4eea-bc50-f3912a81010d	payment-proofs	7398ea38-92ce-4a6f-96ac-135c051c36ac/inv_721a33d9f6cefa7a/pay_1bdb0cb1f73b0127/1789469777448-v1bift.jpeg	e5bd3b03-ac38-48c1-bc6b-59c8ee9e9bda	2026-09-15 10:57:22.8335+00	2026-09-15 10:57:22.8335+00	2026-09-15 10:57:22.8335+00	{"eTag": "\\"fd9cb9cb8f63daf9ebb7d74d452dcffd\\"", "size": 64607, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-09-15T10:57:23.000Z", "contentLength": 64607, "httpStatusCode": 200}	b3b6acbe-4ab5-44b3-b670-64bfe5993100	e5bd3b03-ac38-48c1-bc6b-59c8ee9e9bda	{}	\N	f	f
57a424b2-0b6b-4b5f-af65-3e158722d9b0	payment-proofs	7398ea38-92ce-4a6f-96ac-135c051c36ac/inv_31873a1161db370b/pay_214c5b78445978fc/1789639168127-2g4u68.jpeg	cfbd4054-c84a-440a-809b-f69e71a29136	2026-09-17 09:59:29.987066+00	2026-09-17 09:59:29.987066+00	2026-09-17 09:59:29.987066+00	{"eTag": "\\"fd9cb9cb8f63daf9ebb7d74d452dcffd\\"", "size": 64607, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-09-17T09:59:30.000Z", "contentLength": 64607, "httpStatusCode": 200}	bf1ec6cd-1cc8-4552-9d50-da94ba22cda6	cfbd4054-c84a-440a-809b-f69e71a29136	{}	\N	f	f
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads" ("id", "in_progress_size", "upload_signature", "bucket_id", "key", "version", "owner_id", "created_at", "user_metadata", "metadata") FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads_parts" ("id", "upload_id", "size", "part_number", "bucket_id", "key", "etag", "owner_id", "version", "created_at") FROM stdin;
\.


--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."vector_indexes" ("id", "name", "bucket_id", "data_type", "dimension", "distance_metric", "metadata_configuration", "created_at", "updated_at") FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 37, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict X8YUTPXCVdqaF7q4UvAM7Yp9zaT2cBeVskfBPNEFrklitsBQkdQHbzwsB1EzTiK

RESET ALL;
